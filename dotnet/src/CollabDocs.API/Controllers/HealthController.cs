using Microsoft.AspNetCore.Mvc;

namespace CollabDocs.API.Controllers;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult GetHealth() =>
        Ok(new
        {
            status = "healthy",
            version = "1.0.0",
            timestamp = DateTime.UtcNow
        });
}
