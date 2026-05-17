using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using MembersGuild.API.DTOs.Attendance;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/attendance")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly IConfiguration _config;

    public AttendanceController(ClubDbContextFactory dbFactory, IConfiguration config)
    {
        _dbFactory = dbFactory;
        _config = config;
    }

    private int CurrentUserId => int.Parse(
        User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
    private string CurrentRole =>
        User.FindFirst(ClaimTypes.Role)?.Value ?? "";

    private bool CanManageAttendance() =>
        CurrentRole is "coach" or "committee" or "membership" or "finance" or "webmaster";

    // ── GET /api/attendance/sessions ────────────────────────────────────────
    [HttpGet("sessions")]
    public async Task<IActionResult> GetSessions(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        [FromQuery] bool historical = false)
    {
        if (!CanManageAttendance()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var fromDate = historical
            ? new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc)
            : (from ?? DateTime.UtcNow.AddDays(-30));
        var toDate = historical
            ? DateTime.UtcNow.AddYears(1)
            : (to ?? DateTime.UtcNow.AddDays(7));

        var sessions = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.Bookings)
            .Where(s => s.StartTime >= fromDate &&
                        s.StartTime <= toDate &&
                        !s.IsCancelled)
            .OrderByDescending(s => s.StartTime)
            .ToListAsync();

        var result = new List<AttendanceSessionResponse>();
        foreach (var s in sessions)
        {
            var attendedCount = await db.AttendanceRecords
                .CountAsync(a => a.SessionId == s.Id && a.Status == "attended");
            var markedCount = await db.AttendanceRecords
                .CountAsync(a => a.SessionId == s.Id);

            result.Add(new AttendanceSessionResponse(
                s.Id, s.Title,
                s.Location?.Name,
                s.Coach != null
                    ? $"{s.Coach.FirstName} {s.Coach.LastName}"
                    : null,
                s.StartTime, s.EndTime,
                s.Capacity, s.Bookings.Count,
                attendedCount, markedCount
            ));
        }

        return Ok(result);
    }

    // ── GET /api/attendance/sessions/{id}/sheet ─────────────────────────────
    [HttpGet("sessions/{id:int}/sheet")]
    public async Task<IActionResult> GetSheet(int id)
    {
        if (!CanManageAttendance()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var session = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session is null) return NotFound();

        var bookings = await db.SessionBookings
            .Include(b => b.User)
            .Where(b => b.SessionId == id)
            .OrderBy(b => b.User!.FirstName)
            .ToListAsync();

        var records = await db.AttendanceRecords
            .Where(a => a.SessionId == id)
            .ToListAsync();

        var sheet = bookings.Select(b =>
        {
            var record = records.FirstOrDefault(r => r.UserId == b.UserId);
            return new AttendanceSheetMember(
                b.UserId,
                $"{b.User!.FirstName} {b.User.LastName}",
                b.User.Email,
                b.User.Role,
                record?.Status,
                record?.CreditRefunded ?? false
            );
        }).ToList();

        // Lane settings
        var lanesEnabled = (await db.ClubSettings
            .FirstOrDefaultAsync(s => s.Key == "attendance_lanes_enabled"))
            ?.Value == "true";
        var lanesLabel = (await db.ClubSettings
            .FirstOrDefaultAsync(s => s.Key == "attendance_lanes_label"))
            ?.Value ?? "Lanes";

        return Ok(new
        {
            session = new
            {
                id = session.Id,
                title = session.Title,
                startTime = session.StartTime,
                endTime = session.EndTime,
                locationName = session.Location?.Name,
                coachId = session.CoachId, 
                coachName = session.Coach != null
                    ? $"{session.Coach.FirstName} {session.Coach.LastName}"
                    : null,
                capacity = session.Capacity,
                lanesCount = session.LanesCount,
            },
            members = sheet,
            lanesEnabled = lanesEnabled,
            lanesLabel = lanesLabel,
        });
    }

    // ── POST /api/attendance/sessions/{id}/mark ─────────────────────────────
    [HttpPost("sessions/{id:int}/mark")]
    public async Task<IActionResult> MarkAttendance(
        int id, [FromBody] MarkAttendanceRequest request)
    {
        if (!CanManageAttendance()) return Forbid();

        var validStatuses = new[] { "attended", "absent", "late", "noshow", "nsba" };
        if (!validStatuses.Contains(request.Status))
            return BadRequest(new { error = "Invalid status" });

        await using var db = _dbFactory.CreateForCurrentClub();

        var session = await db.Sessions.FindAsync(id);
        if (session is null) return NotFound();

        var isBooked = await db.SessionBookings
            .AnyAsync(b => b.SessionId == id && b.UserId == request.UserId);
        if (!isBooked)
            return BadRequest(new { error = "Member is not registered for this session" });

        var existing = await db.AttendanceRecords
            .FirstOrDefaultAsync(a => a.SessionId == id && a.UserId == request.UserId);

        if (existing is null)
        {
            existing = new AttendanceRecord
            {
                SessionId = id,
                UserId = request.UserId,
                Status = request.Status,
                Notes = request.Notes,
                MarkedBy = CurrentUserId,
            };
            db.AttendanceRecords.Add(existing);
        }
        else
        {
            // Reverse previous NSBA refund if changing away from nsba
            if (existing.Status == "nsba" && existing.CreditRefunded &&
                request.Status != "nsba")
            {
                var user = await db.Users.FindAsync(request.UserId);
                if (user is not null)
                {
                    user.CreditBalance -= session.CreditCost;
                    db.CreditTransactions.Add(new CreditTransaction
                    {
                        UserId = request.UserId,
                        Amount = -session.CreditCost,
                        BalanceAfter = user.CreditBalance,
                        TransactionType = "nsba_refund_reversed",
                        ReferenceId = id,
                        ReferenceType = "session",
                        Notes = $"NSBA refund reversed: {session.Title}",
                    });
                }
                existing.CreditRefunded = false;
            }

            existing.Status = request.Status;
            existing.Notes = request.Notes;
            existing.MarkedBy = CurrentUserId;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        // NSBA — auto-refund credit
        if (request.Status == "nsba" && !existing.CreditRefunded)
        {
            var user = await db.Users.FindAsync(request.UserId);
            if (user is not null)
            {
                user.CreditBalance += session.CreditCost;
                db.CreditTransactions.Add(new CreditTransaction
                {
                    UserId = request.UserId,
                    Amount = session.CreditCost,
                    BalanceAfter = user.CreditBalance,
                    TransactionType = "nsba_refund",
                    ReferenceId = id,
                    ReferenceType = "session",
                    Notes = $"NSBA credit refund: {session.Title}",
                });
                existing.CreditRefunded = true;
            }
        }

        await db.SaveChangesAsync();

        return Ok(new AttendanceSheetMember(
            existing.UserId, "", "", "",
            existing.Status, existing.CreditRefunded
        ));
    }

    // ── POST /api/attendance/sessions/{id}/walkin ───────────────────────────
    [HttpPost("sessions/{id:int}/walkin")]
    public async Task<IActionResult> WalkIn(int id, [FromBody] int userId)
    {
        if (!CanManageAttendance()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();

        var session = await db.Sessions
            .Include(s => s.Bookings)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (session is null) return NotFound();

        var isBooked = session.Bookings.Any(b => b.UserId == userId);

        if (!isBooked)
        {
            db.SessionBookings.Add(new SessionBooking
            {
                SessionId = id,
                UserId = userId,
            });

            var user = await db.Users.FindAsync(userId);
            if (user is not null && session.CreditCost > 0)
            {
                user.CreditBalance = Math.Max(0, user.CreditBalance - session.CreditCost);
                db.CreditTransactions.Add(new CreditTransaction
                {
                    UserId = userId,
                    Amount = -session.CreditCost,
                    BalanceAfter = user.CreditBalance,
                    TransactionType = "session_booking",
                    ReferenceId = id,
                    ReferenceType = "session",
                    Notes = $"Walk-in: {session.Title}",
                });
            }
        }

        var existing = await db.AttendanceRecords
            .FirstOrDefaultAsync(a => a.SessionId == id && a.UserId == userId);

        if (existing is null)
        {
            db.AttendanceRecords.Add(new AttendanceRecord
            {
                SessionId = id,
                UserId = userId,
                Status = "attended",
                MarkedBy = CurrentUserId,
                Notes = "Walk-in",
            });
        }
        else
        {
            existing.Status = "attended";
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return Ok(new { success = true });
    }

    // ── GET /api/attendance/sessions/{id}/qr ────────────────────────────────
    [HttpGet("sessions/{id:int}/qr")]
    public async Task<IActionResult> GenerateQr(int id)
    {
        if (!CanManageAttendance()) return Forbid();

        await Task.CompletedTask; // satisfies async requirement

        var clubSlug = User.FindFirst("club_slug")?.Value ?? "";
        var expires = DateTimeOffset.UtcNow.AddHours(4).ToUnixTimeSeconds();
        var payload = $"{id}:{clubSlug}:{expires}";
        var secret = _config["JWT_SECRET"] ?? "fallback";
        var sig = ComputeHmac(payload, secret);
        var token = Convert.ToBase64String(
                           Encoding.UTF8.GetBytes(payload)) + "." + sig;
        var checkinUrl =
            $"https://{clubSlug}.membersguild.com.au/checkin" +
            $"?token={Uri.EscapeDataString(token)}";

        return Ok(new QrTokenResponse(
            token,
            checkinUrl,
            DateTimeOffset.FromUnixTimeSeconds(expires).UtcDateTime));
    }

    // ── PATCH /api/attendance/sessions/{id}/lanes ───────────────────────────
    [HttpPatch("sessions/{id:int}/lanes")]
    public async Task<IActionResult> UpdateLanes(int id, [FromBody] int lanesCount)
    {
        if (!CanManageAttendance()) return Forbid();

        await using var db = _dbFactory.CreateForCurrentClub();
        var session = await db.Sessions.FindAsync(id);
        if (session is null) return NotFound();

        session.LanesCount = lanesCount;
        await db.SaveChangesAsync();

        return Ok(new { lanesCount = session.LanesCount });
    }

    // ── POST /api/attendance/checkin ─────────────────────────────────────────
    [HttpPost("checkin")]
    public async Task<IActionResult> Checkin([FromBody] string token)
    {
        try
        {
            var parts = token.Split('.');
            if (parts.Length != 2)
                return BadRequest(new { error = "Invalid token" });

            var payload = Encoding.UTF8.GetString(
                                Convert.FromBase64String(parts[0]));
            var signature = parts[1];
            var secret = _config["JWT_SECRET"] ?? "fallback";

            if (ComputeHmac(payload, secret) != signature)
                return BadRequest(new { error = "Invalid token signature" });

            var segments = payload.Split(':');
            if (segments.Length != 3)
                return BadRequest(new { error = "Malformed token" });

            if (!int.TryParse(segments[0], out var sessionId))
                return BadRequest(new { error = "Invalid session" });

            var expires = long.Parse(segments[2]);
            if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > expires)
                return BadRequest(new { error = "QR code has expired" });

            await using var db = _dbFactory.CreateForCurrentClub();

            var session = await db.Sessions
                .Include(s => s.Bookings)
                .FirstOrDefaultAsync(s => s.Id == sessionId);

            if (session is null)
                return NotFound(new { error = "Session not found" });

            var userId = CurrentUserId;

            if (!session.Bookings.Any(b => b.UserId == userId))
            {
                db.SessionBookings.Add(new SessionBooking
                {
                    SessionId = sessionId,
                    UserId = userId,
                });

                var user = await db.Users.FindAsync(userId);
                if (user is not null && session.CreditCost > 0)
                {
                    user.CreditBalance =
                        Math.Max(0, user.CreditBalance - session.CreditCost);
                    db.CreditTransactions.Add(new CreditTransaction
                    {
                        UserId = userId,
                        Amount = -session.CreditCost,
                        BalanceAfter = user.CreditBalance,
                        TransactionType = "session_booking",
                        ReferenceId = sessionId,
                        ReferenceType = "session",
                        Notes = $"QR check-in: {session.Title}",
                    });
                }
            }

            var existing = await db.AttendanceRecords
                .FirstOrDefaultAsync(
                    a => a.SessionId == sessionId && a.UserId == userId);

            if (existing is null)
            {
                db.AttendanceRecords.Add(new AttendanceRecord
                {
                    SessionId = sessionId,
                    UserId = userId,
                    Status = "attended",
                    Notes = "QR check-in",
                });
            }
            else
            {
                existing.Status = "attended";
                existing.UpdatedAt = DateTime.UtcNow;
            }

            await db.SaveChangesAsync();

            return Ok(new
            {
                message = "Checked in successfully",
                sessionTitle = session.Title,
            });
        }
        catch
        {
            return BadRequest(new { error = "Check-in failed" });
        }
    }

    // GET /api/attendance/coaches — list of valid coaches for dropdown
    [HttpGet("coaches")]
    public async Task<IActionResult> GetCoaches()
    {
        if (!CanManageAttendance()) return Forbid();
        await using var db = _dbFactory.CreateForCurrentClub();
        var coaches = await db.Users
            .Where(u => u.IsActive && (u.Role == "coach" || u.Role == "committee" || u.Role == "webmaster"))
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .Select(u => new { u.Id, name = u.FirstName + " " + u.LastName })
            .ToListAsync();
        return Ok(coaches);
    }

    // PATCH /api/attendance/sessions/{id}/coach — reassign or clear coach
    [HttpPatch("sessions/{id:int}/coach")]
    public async Task<IActionResult> UpdateCoach(int id, [FromBody] int? coachId)
    {
        if (!CanManageAttendance()) return Forbid();
        await using var db = _dbFactory.CreateForCurrentClub();
        var session = await db.Sessions.FindAsync(id);
        if (session is null) return NotFound();

        session.CoachId = coachId;
        session.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        string? coachName = null;
        if (coachId.HasValue)
        {
            var coach = await db.Users.FindAsync(coachId.Value);
            coachName = coach is null ? null : $"{coach.FirstName} {coach.LastName}";
        }

        return Ok(new { coachId = session.CoachId, coachName });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string ComputeHmac(string payload, string secret)
    {
        var key = Encoding.UTF8.GetBytes(secret);
        var data = Encoding.UTF8.GetBytes(payload);
        using var hmac = new HMACSHA256(key);
        return Convert.ToHexString(hmac.ComputeHash(data)).ToLower();
    }
}