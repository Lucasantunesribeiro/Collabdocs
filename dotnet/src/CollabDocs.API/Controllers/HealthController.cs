using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CollabDocs.API.Controllers;

/// <summary>
/// Health check endpoints used by ALB, ECS container health checks, and monitoring.
/// Both routes (/health and /api/health) return identical payloads.
/// </summary>
[ApiController]
[AllowAnonymous]
public class HealthController : ControllerBase
{
    /// <summary>Primary health endpoint expected by ALB and ECS health checks.</summary>
    [HttpGet("/health")]
    public IActionResult Get() =>
        Ok(new
        {
            status = "healthy",
            version = "1.0.0",
            timestamp = DateTime.UtcNow
        });

    /// <summary>Secondary health endpoint kept for backward compatibility.</summary>
    [HttpGet("/api/health")]
    public IActionResult GetHealth() => Get();
}
