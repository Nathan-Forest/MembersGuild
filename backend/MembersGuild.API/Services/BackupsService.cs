using MembersGuild.API.DTOs.Backups;
using MembersGuild.API.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public class BackupsService
{
    private readonly ClubDbContextFactory _dbFactory;

    private static readonly Dictionary<string, string> TypeLabels = new()
    {
        ["session_booking"]   = "Session booking",
        ["session_refund"]    = "Session refund",
        ["nsba_refund"]       = "NSBA refund",
        ["manual_add"]        = "Credits added",
        ["manual_remove"]     = "Credits removed",
        ["shop_purchase"]     = "Shop purchase",
        ["shop_refund"]       = "Shop refund",
        ["cats_initial"]      = "Welcome credits",
        ["payment_confirmed"] = "Payment confirmed",
    };

    public BackupsService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // ── Attendance Export ─────────────────────────────────────────────────────

    public async Task<List<AttendanceExportRow>> GetAttendanceExportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var sessions = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Pool)
            .Include(s => s.Coach)
            .Include(s => s.Bookings).ThenInclude(b => b.User)
            .Include(s => s.AttendanceRecords)
            .Where(s => s.StartTime >= start && s.StartTime <= end && !s.IsCancelled)
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        var sessionIds = sessions.Select(s => s.Id).ToList();
        var guests = await db.Guests
            .Where(g => sessionIds.Contains(g.SessionId))
            .ToListAsync();

        var rows = new List<AttendanceExportRow>();

        foreach (var s in sessions)
        {
            var coachName = s.Coach != null ? $"{s.Coach.FirstName} {s.Coach.LastName}" : null;

            foreach (var booking in s.Bookings)
            {
                var record = s.AttendanceRecords.FirstOrDefault(r => r.UserId == booking.UserId);
                rows.Add(new AttendanceExportRow(
                    s.StartTime.Date, s.Title, s.StartTime, s.EndTime,
                    s.Location?.Name, s.Pool?.Name, s.LanesCount, coachName,
                    booking.User != null ? $"{booking.User.FirstName} {booking.User.LastName}" : "Unknown",
                    "Member",
                    record?.Status ?? "unmarked",
                    record?.Notes
                ));
            }

            foreach (var g in guests.Where(g => g.SessionId == s.Id))
            {
                rows.Add(new AttendanceExportRow(
                    s.StartTime.Date, s.Title, s.StartTime, s.EndTime,
                    s.Location?.Name, s.Pool?.Name, s.LanesCount, coachName,
                    g.Name, "Guest", "attended", g.Notes
                ));
            }
        }

        return rows.OrderBy(r => r.Date).ThenBy(r => r.SessionTitle).ThenBy(r => r.AttendeeName).ToList();
    }

    // ── Membership Export ─────────────────────────────────────────────────────

    public async Task<List<MembershipExportRow>> GetMembershipExportAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var users = await db.Users
            .OrderBy(u => u.LastName).ThenBy(u => u.FirstName)
            .ToListAsync();

        return users.Select(u => new MembershipExportRow(
            u.FirstName, u.LastName, u.Email, u.Phone,
            u.Role, u.IsActive, u.MemberNumber, u.AssociationNumber,
            u.DateOfBirth, u.EmergencyContactName, u.EmergencyContactPhone,
            u.MarketingOptOut, u.CreditBalance, u.EffectiveJoinDate
        )).ToList();
    }

    // ── Credit History Export ─────────────────────────────────────────────────

    public async Task<List<CreditHistoryExportRow>> GetCreditHistoryExportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var transactions = await db.CreditTransactions
            .Include(t => t.User)
            .Where(t => t.CreatedAt >= start && t.CreatedAt <= end)
            .OrderBy(t => t.CreatedAt)
            .ToListAsync();

        var creatorIds = transactions
            .Where(t => t.CreatedBy.HasValue)
            .Select(t => t.CreatedBy!.Value)
            .Distinct()
            .ToList();

        var creatorNames = await db.Users
            .Where(u => creatorIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName);

        return transactions.Select(t => new CreditHistoryExportRow(
            t.CreatedAt,
            t.User != null ? $"{t.User.FirstName} {t.User.LastName}" : "Unknown",
            t.User?.Email ?? "",
            TypeLabels.GetValueOrDefault(t.TransactionType, t.TransactionType),
            t.Amount, t.BalanceAfter, t.Notes,
            t.CreatedBy.HasValue ? creatorNames.GetValueOrDefault(t.CreatedBy.Value, "Unknown") : "System"
        )).ToList();
    }
}