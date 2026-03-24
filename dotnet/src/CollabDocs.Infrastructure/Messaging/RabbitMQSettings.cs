namespace CollabDocs.Infrastructure.Messaging;

public class RabbitMQSettings
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string VirtualHost { get; set; } = "/";
    public string Username { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string ExchangeName { get; set; } = "collabdocs.events";
    public string QueueName { get; set; } = "document.events";
}
