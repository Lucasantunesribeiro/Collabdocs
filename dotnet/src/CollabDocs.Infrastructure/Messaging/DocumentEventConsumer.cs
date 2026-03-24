using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace CollabDocs.Infrastructure.Messaging;

/// <summary>
/// Background service that consumes document events from RabbitMQ.
/// Handles structured audit logging for DocumentCreated, Updated, and Deleted events.
/// Reconnects with exponential backoff; degrades gracefully when RabbitMQ is unavailable.
/// </summary>
public class DocumentEventConsumer(
    IOptions<RabbitMQSettings> settings,
    ILogger<DocumentEventConsumer> logger) : BackgroundService
{
    private readonly RabbitMQSettings _settings = settings.Value;
    private IConnection? _connection;
    private IModel? _channel;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Document event consumer starting");

        // Wait for RabbitMQ to be ready (especially on docker compose startup)
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        for (var attempt = 1; attempt <= 5 && !stoppingToken.IsCancellationRequested; attempt++)
        {
            try
            {
                Connect();
                logger.LogInformation("Document event consumer connected to RabbitMQ");
                await Task.Delay(Timeout.Infinite, stoppingToken);
                break;
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                var delay = attempt * 5;
                logger.LogWarning(ex, "RabbitMQ consumer connection failed (attempt {Attempt}/5) — retrying in {Delay}s",
                    attempt, delay);
                await Task.Delay(TimeSpan.FromSeconds(delay), stoppingToken);
            }
        }
    }

    private void Connect()
    {
        var factory = new ConnectionFactory
        {
            HostName = _settings.Host,
            Port = _settings.Port,
            VirtualHost = _settings.VirtualHost,
            UserName = _settings.Username,
            Password = _settings.Password,
        };

        _connection = factory.CreateConnection("collabdocs-consumer");
        _channel = _connection.CreateModel();

        _channel.ExchangeDeclare(_settings.ExchangeName, ExchangeType.Topic, durable: true);
        _channel.QueueDeclare(_settings.QueueName, durable: true, exclusive: false, autoDelete: false);
        _channel.QueueBind(_settings.QueueName, _settings.ExchangeName, "#");
        _channel.BasicQos(0, 10, false);

        var consumer = new EventingBasicConsumer(_channel);
        consumer.Received += (_, ea) =>
        {
            try
            {
                var body = Encoding.UTF8.GetString(ea.Body.ToArray());
                var eventType = ea.BasicProperties.Type ?? "unknown";
                ProcessEvent(eventType, body);
                _channel.BasicAck(ea.DeliveryTag, false);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing event — nacking");
                _channel.BasicNack(ea.DeliveryTag, false, requeue: true);
            }
        };

        _channel.BasicConsume(_settings.QueueName, false, consumer);
    }

    private void ProcessEvent(string eventType, string payload)
    {
        using var doc = JsonDocument.Parse(payload);
        var root = doc.RootElement;

        switch (eventType)
        {
            case "document.created":
                logger.LogInformation(
                    "EVENT document.created — DocumentId={DocumentId} Title={Title} OwnerId={OwnerId}",
                    root.GetProperty("documentId").GetGuid(),
                    root.GetProperty("title").GetString(),
                    root.GetProperty("ownerId").GetString());
                break;

            case "document.updated":
                logger.LogInformation(
                    "EVENT document.updated — DocumentId={DocumentId} Version={Version} UpdatedBy={UpdatedBy}",
                    root.GetProperty("documentId").GetGuid(),
                    root.GetProperty("version").GetInt32(),
                    root.GetProperty("updatedBy").GetString());
                break;

            case "document.deleted":
                logger.LogInformation(
                    "EVENT document.deleted — DocumentId={DocumentId} DeletedBy={DeletedBy}",
                    root.GetProperty("documentId").GetGuid(),
                    root.GetProperty("deletedBy").GetString());
                break;

            default:
                logger.LogWarning("Unhandled event type: {EventType}", eventType);
                break;
        }
    }

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        base.Dispose();
    }
}
