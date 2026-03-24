using CollabDocs.Domain.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using System.Text;

namespace CollabDocs.Infrastructure.Messaging;

/// <summary>
/// Background service that polls the Outbox table and publishes pending messages to RabbitMQ.
/// Implements the Transactional Outbox Pattern — events are only published after the DB write succeeds.
/// Reconnects automatically on failure; degrades gracefully when RabbitMQ is unavailable.
/// </summary>
public class OutboxPublisherService(
    IServiceScopeFactory scopeFactory,
    IOptions<RabbitMQSettings> settings,
    ILogger<OutboxPublisherService> logger) : BackgroundService
{
    private readonly RabbitMQSettings _settings = settings.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Outbox publisher starting. Exchange={Exchange} Queue={Queue}",
            _settings.ExchangeName, _settings.QueueName);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishPendingAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox publisher error — retrying in 5s");
            }

            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }

    private async Task PublishPendingAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var outbox = scope.ServiceProvider.GetRequiredService<IOutboxRepository>();
        var messages = await outbox.GetPendingAsync(20, ct);

        if (!messages.Any()) return;

        IConnection? connection = null;
        IModel? channel = null;

        try
        {
            var factory = new ConnectionFactory
            {
                HostName = _settings.Host,
                Port = _settings.Port,
                VirtualHost = _settings.VirtualHost,
                UserName = _settings.Username,
                Password = _settings.Password,
                RequestedHeartbeat = TimeSpan.FromSeconds(60),
            };

            connection = factory.CreateConnection("collabdocs-outbox");
            channel = connection.CreateModel();

            channel.ExchangeDeclare(_settings.ExchangeName, ExchangeType.Topic, durable: true);
            channel.QueueDeclare(_settings.QueueName, durable: true, exclusive: false, autoDelete: false);
            channel.QueueBind(_settings.QueueName, _settings.ExchangeName, "#");

            foreach (var msg in messages)
            {
                try
                {
                    var body = Encoding.UTF8.GetBytes(msg.Payload);
                    var props = channel.CreateBasicProperties();
                    props.Persistent = true;
                    props.ContentType = "application/json";
                    props.Type = msg.EventType;
                    props.MessageId = msg.Id.ToString();

                    channel.BasicPublish(_settings.ExchangeName, msg.EventType, props, body);
                    await outbox.MarkProcessedAsync(msg.Id, ct);

                    logger.LogInformation("Published {EventType} {MessageId}", msg.EventType, msg.Id);
                }
                catch (Exception ex)
                {
                    await outbox.MarkFailedAsync(msg.Id, ex.Message, ct);
                    logger.LogWarning(ex, "Failed to publish {MessageId}", msg.Id);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Cannot connect to RabbitMQ at {Host}:{Port} — messages will retry",
                _settings.Host, _settings.Port);
        }
        finally
        {
            channel?.Close();
            connection?.Close();
        }
    }
}
