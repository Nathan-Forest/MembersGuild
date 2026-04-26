using MembersGuild.API.DTOs.Auth;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;

    public AuthController(IAuthService auth)
    {
        _auth = auth;
    }

    /// <summary>POST /api/auth/login</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var result = await _auth.LoginAsync(request.Email, request.Password);

        if (result is null)
            return Unauthorized(new { error = "Invalid email or password" });

        return Ok(result);
    }

    /// <summary>GET /api/auth/profile — returns the current user's profile</summary>
    [Authorize]
    [HttpGet("profile")]
    public IActionResult Profile()
    {
        // Claims are injected by JWT middleware
        var userId   = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        var email    = User.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value;
        var role     = User.FindFirst("role")?.Value;
        var clubSlug = User.FindFirst("club_slug")?.Value;

        return Ok(new { userId, email, role, clubSlug });
    }
}
