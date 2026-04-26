using MembersGuild.API.DTOs.Auth;
using MembersGuild.API.Extensions;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _auth;
    private readonly ClubDbContextFactory _dbFactory;

    public AuthController(IAuthService auth, ClubDbContextFactory dbFactory)
    {
        _auth = auth;
        _dbFactory = dbFactory;
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

/// <summary>POST /api/auth/change-password</summary>
[Authorize]
[HttpPost("change-password")]
public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
{
    var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");

    await using var db = _dbFactory.CreateForCurrentClub();
    var user = await db.Users.FindAsync(userId);
    if (user is null) return NotFound();

    if (!_auth.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        return BadRequest(new { error = "Current password is incorrect" });

    user.PasswordHash = _auth.HashPassword(request.NewPassword);
    user.UpdatedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    return Ok(new { message = "Password changed successfully" });
}