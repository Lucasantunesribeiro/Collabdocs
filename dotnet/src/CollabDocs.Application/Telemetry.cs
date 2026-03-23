using System.Diagnostics;

namespace CollabDocs.Application;

/// <summary>
/// Shared ActivitySource for OpenTelemetry tracing across application handlers.
/// The source name must be registered with AddSource() in Program.cs.
/// </summary>
public static class Telemetry
{
    public static readonly ActivitySource Source = new("CollabDocs.Application", "2.0.0");
}
