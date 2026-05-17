using MembersGuild.API.DTOs.Sessions;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using MembersGuild.API.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/sessions")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ISessionService _sessions;
    private readonly ClubDbContextFactory _dbFactory;

    public SessionsController(ISessionService sessions, ClubDbContextFactory dbFactory)
    {
        _sessions = sessions;
        _dbFactory = dbFactory;
    }

    private int CurrentUserId => int.Parse(
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole => User.FindFirst(ClaimTypes.Role)?.Value ?? "";
    private bool CanManage() =>
        CurrentRole is "coach" or "committee" or "webmaster";

    /// <summary>GET /api/sessions — all roles, optional date range</summary>
    [HttpGet]
    public async Task<IActionResult> GetSessions(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to)
    {
        var sessions = await _sessions.GetSessionsAsync(CurrentUserId, from, to);
        return Ok(sessions);
    }

    /// <summary>GET /api/sessions/{id}</summary>
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetSession(int id)
    {
        var session = await _sessions.GetSessionAsync(id, CurrentUserId);
        return session is null ? NotFound() : Ok(session);
    }

    /// <summary>POST /api/sessions — Coach/Committee/Webmaster</summary>
    [HttpPost]
    public async Task<IActionResult> CreateSession([FromBody] CreateSessionRequest request)
    {
        if (!CanManage()) return Forbid();
        var session = await _sessions.CreateSessionAsync(request, CurrentUserId);
        return CreatedAtAction(nameof(GetSession), new { id = session.Id }, session);
    }

    /// <summary>POST /api/sessions/recurring — Coach/Committee/Webmaster</summary>
    [HttpPost("recurring")]
    public async Task<IActionResult> CreateRecurringSessions(
        [FromBody] RecurringSessionRequest request)
    {
        if (!CanManage()) return Forbid();
        var sessions = await _sessions.CreateRecurringSessionsAsync(request, CurrentUserId);
        return Ok(sessions);
    }

    /// <summary>PUT /api/sessions/{id} — Coach/Committee/Webmaster</summary>
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateSession(
        int id, [FromBody] UpdateSessionRequest request)
    {
        if (!CanManage()) return Forbid();
        var session = await _sessions.UpdateSessionAsync(id, request);
        return session is null ? NotFound() : Ok(session);
    }

    /// <summary>DELETE /api/sessions/{id} — Coach/Committee/Webmaster</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSession(int id)
    {
        if (!CanManage()) return Forbid();
        var success = await _sessions.DeleteSessionAsync(id);
        return success ? NoContent() : NotFound();
    }

    /// <summary>POST /api/sessions/{id}/book — register current user</summary>
    [HttpPost("{id:int}/book")]
    public async Task<IActionResult> BookSession(int id)
    {
        try
        {
            var session = await _sessions.BookSessionAsync(id, CurrentUserId, CurrentRole);
            return Ok(session);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>DELETE /api/sessions/{id}/book — unregister</summary>
    [HttpDelete("{id:int}/book")]
    public async Task<IActionResult> UnbookSession(int id, [FromQuery] int? userId)
    {
        // Staff can unbook other members, members can only unbook themselves
        var targetUserId = userId ?? CurrentUserId;
        var success = await _sessions.UnbookSessionAsync(
            id, targetUserId, CurrentRole, CurrentUserId);
        return success ? Ok(new { success = true }) : NotFound();
    }

    /// <summary>GET /api/sessions/{id}/bookings — Staff only</summary>
    [HttpGet("{id:int}/bookings")]
    public async Task<IActionResult> GetBookings(int id)
    {
        var canView = CurrentRole is "coach" or "committee" or "membership" or "finance" or "webmaster";
        if (!canView) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var bookings = await db.SessionBookings
            .Include(b => b.User)
            .Where(b => b.SessionId == id)
            .OrderBy(b => b.User.FirstName)
            .Select(b => new
            {
                userId = b.UserId,
                fullName = b.User.FirstName + " " + b.User.LastName,
                email = b.User.Email,
                role = b.User.Role,
                bookedAt = b.CreatedAt,
            })
            .ToListAsync();

        return Ok(bookings);
    }

    /// <summary>GET /api/sessions/my-sessions — current user's bookings and stats</summary>
    [HttpGet("my-sessions")]
    public async Task<IActionResult> GetMySessions()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var userId = CurrentUserId;
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var allBookings = await db.SessionBookings
            .Include(b => b.Session).ThenInclude(s => s.Location)
            .Include(b => b.Session).ThenInclude(s => s.Coach)
            .Include(b => b.Session).ThenInclude(s => s.Bookings)
            .Where(b => b.UserId == userId)
            .OrderBy(b => b.Session.StartTime)
            .ToListAsync();

        var upcoming = allBookings
            .Where(b => b.Session.StartTime > now && !b.Session.IsCancelled)
            .Select(b => new
            {
                id = b.Session.Id,
                title = b.Session.Title,
                description = b.Session.Description,
                locationName = b.Session.Location != null ? b.Session.Location.Name : null,
                coachName = b.Session.Coach != null
                                    ? $"{b.Session.Coach.FirstName} {b.Session.Coach.LastName}" : null,
                startTime = b.Session.StartTime,
                endTime = b.Session.EndTime,
                capacity = b.Session.Capacity,
                creditCost = b.Session.CreditCost,
                registrationCutoffHours = b.Session.RegistrationCutoffHours,
                bookedCount = b.Session.Bookings.Count,
                isBooked = true,
            }).ToList();

        var past = allBookings
            .Where(b => b.Session.StartTime <= now)
            .OrderByDescending(b => b.Session.StartTime)
            .Take(30)
            .Select(b => new
            {
                sessionId = b.Session.Id,
                sessionTitle = b.Session.Title,
                startTime = b.Session.StartTime,
                locationName = b.Session.Location != null ? b.Session.Location.Name : null,
                coachName = b.Session.Coach != null
                                ? $"{b.Session.Coach.FirstName} {b.Session.Coach.LastName}" : null,
            }).ToList();

        return Ok(new
        {
            stats = new
            {
                upcomingBookings = upcoming.Count,
                thisMonthSessions = allBookings.Count(b => b.Session.StartTime >= startOfMonth),
                lifetimeSessions = allBookings.Count,
            },
            upcoming,
            past,
        });
    }
}