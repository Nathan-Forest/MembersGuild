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
    private readonly IConfiguration _config;

    public SquareController(
        SquareService square,
        PlatformDbContext platformDb,
        ClubContext clubContext,
        IConfiguration config)
    {
        _square = square;
        _platformDb = platformDb;
        _clubContext = clubContext;
        _config = config;
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
            // Try to recover the club slug from state even on error, so the user
            // lands back on their own club's settings rather than the root domain
            var (errorSlug, errorValid) = state is not null
                ? _square.ValidateStateToken(state)
                : (null, false);

            var target = errorValid
                ? $"https://{errorSlug}.membersguild.com.au/management/settings?square_error={Uri.EscapeDataString(error)}"
                : $"https://membersguild.com.au/management/settings?square_error={Uri.EscapeDataString(error)}";

            return Ok(new { redirectUrl = target });
        }

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Ok(new { redirectUrl = "https://membersguild.com.au/management/settings?square_error=missing_code_or_state" });

        var (clubSlug, valid) = _square.ValidateStateToken(state);
        if (!valid)
            return Ok(new { redirectUrl = "https://membersguild.com.au/management/settings?square_error=invalid_state" });

        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == clubSlug && c.IsActive);

        if (club is null)
            return Ok(new { redirectUrl = "https://membersguild.com.au/management/settings?square_error=club_not_found" });

        try
        {
            await _square.ExchangeCodeAsync(code, club.Id);
            return Ok(new { redirectUrl = $"https://{clubSlug}.membersguild.com.au/management/settings?square_connected=true" });
        }
        catch (Exception ex)
        {
            return Ok(new { redirectUrl = $"https://{clubSlug}.membersguild.com.au/management/settings?square_error={Uri.EscapeDataString(ex.Message)}" });
        }
    }

    // GET /api/square/available — any authenticated member; used to show/hide Pay by Card
    [HttpGet("available")]
    public async Task<IActionResult> Available()
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == _clubContext.Slug);

        if (club is null) return Ok(new { available = false });

        var connection = await _platformDb.SquareConnections
            .FirstOrDefaultAsync(s => s.ClubId == club.Id && s.IsActive);

        if (connection is null) return Ok(new { available = false });

        return Ok(new
        {
            available = true,
            applicationId = _config["Square:AppId"],
            locationId = connection.LocationId,
            environment = _config["Square:Environment"]?.ToLower() == "production" ? "production" : "sandbox",
        });
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