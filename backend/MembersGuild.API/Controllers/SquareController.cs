using MembersGuild.API.Middleware;
using MembersGuild.API.Services;
using MembersGuild.Data.Contexts;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/square")]
public class SquareController : ControllerBase
{
    private readonly SquareService _square;
    private readonly PlatformDbContext _platformDb;
    private readonly ClubContext _clubContext;

    public SquareController(
        SquareService square,
        PlatformDbContext platformDb,
        ClubContext clubContext)
    {
        _square = square;
        _platformDb = platformDb;
        _clubContext = clubContext;
    }

    // GET /api/square/connect — webmaster initiates OAuth
    [HttpGet("connect")]
    [Authorize(Roles = "webmaster")]
    public IActionResult Connect()
    {
        var authUrl = _square.BuildAuthUrl(_clubContext.Slug);
        return Ok(new { authUrl });
    }

    // GET /api/square/callback — Square redirects here after approval
    [HttpGet("callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(
        [FromQuery] string? code,
        [FromQuery] string? state,
        [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
        {
            return Redirect($"https://membersguild.com.au/management/settings" +
                            $"?square_error={Uri.EscapeDataString(error)}");
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return BadRequest(new { error = "Missing code or state" });

        var (clubSlug, valid) = _square.ValidateStateToken(state);
        if (!valid)
            return BadRequest(new { error = "Invalid or expired state token" });

        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == clubSlug && c.IsActive);

        if (club is null)
            return NotFound(new { error = "Club not found" });

        try
        {
            await _square.ExchangeCodeAsync(code, club.Id);
            return Redirect($"https://{clubSlug}.membersguild.com.au/management/settings" +
                            $"?square_connected=true");
        }
        catch (Exception ex)
        {
            return Redirect($"https://{clubSlug}.membersguild.com.au/management/settings" +
                            $"?square_error={Uri.EscapeDataString(ex.Message)}");
        }
    }

    // GET /api/square/status — check connection status
    [HttpGet("status")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> Status()
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is null) return NotFound();

        var status = await _square.GetStatusAsync(club.Id);
        if (status is null) return Ok(new { connected = false });
        return Ok(status);
    }

    // DELETE /api/square/disconnect
    [HttpDelete("disconnect")]
    [Authorize(Roles = "webmaster")]
    public async Task<IActionResult> Disconnect()
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is null) return NotFound();

        await _square.DisconnectAsync(club.Id);
        return Ok(new { success = true });
    }
}