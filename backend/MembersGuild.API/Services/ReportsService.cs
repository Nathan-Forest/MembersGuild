using MembersGuild.API.DTOs.Reports;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public class ReportsService
{
    private readonly ClubDbContextFactory _dbFactory;

    public ReportsService(ClubDbContextFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    private static readonly Dictionary<string, string> RoleLabels = new()
    {
        ["cats"]       = "CATS",
        ["member"]     = "Member",
        ["coach"]      = "Coach",
        ["committee"]  = "Committee",
        ["membership"] = "Membership",
        ["finance"]    = "Finance",
        ["webmaster"]  = "Webmaster",
    };

    // ── Financial ─────────────────────────────────────────────────────────────

    public async Task<FinancialReport> GetFinancialReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var orders = await db.ShopOrders
            .Include(o => o.Items).ThenInclude(i => i.ShopItem)
            .Where(o => o.CreatedAt >= start && o.CreatedAt <= end)
            .ToListAsync();

        var active   = orders.Where(o => o.Status != "cancelled").ToList();
        var confirmed = orders.Where(o => o.Status is "payment_confirmed" or "pending_delivery" or "delivered").ToList();

        var creditPackRevenue = confirmed
            .SelectMany(o => o.Items)
            .Where(i => i.ShopItem?.Category == "credits")
            .Sum(i => i.UnitPrice * i.Quantity);

        var merchRevenue = confirmed
            .SelectMany(o => o.Items)
            .Where(i => i.ShopItem?.Category != "credits")
            .Sum(i => i.UnitPrice * i.Quantity);

        var topItems = confirmed
            .SelectMany(o => o.Items)
            .GroupBy(i => i.ItemNameSnapshot)
            .Select(g => new TopItemReport(
                g.Key,
                g.Sum(i => i.Quantity),
                g.Sum(i => i.UnitPrice * i.Quantity)))
            .OrderByDescending(t => t.Revenue)
            .Take(10)
            .ToList();

        return new FinancialReport(
            TotalRevenue:       active.Sum(o => o.TotalAmount),
            ConfirmedRevenue:   confirmed.Sum(o => o.TotalAmount),
            PendingRevenue:     orders.Where(o => o.Status == "pending").Sum(o => o.TotalAmount),
            TotalOrders:        orders.Count,
            PendingOrders:      orders.Count(o => o.Status == "pending"),
            ConfirmedOrders:    orders.Count(o => o.Status == "payment_confirmed"),
            DeliveredOrders:    orders.Count(o => o.Status == "delivered"),
            CancelledOrders:    orders.Count(o => o.Status == "cancelled"),
            CreditPackRevenue:  creditPackRevenue,
            MerchandiseRevenue: merchRevenue,
            TotalCreditsIssued: confirmed.Sum(o => o.TotalCredits),
            TopItems:           topItems);
    }

    // ── Membership ────────────────────────────────────────────────────────────

    public async Task<MembershipReport> GetMembershipReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var allUsers = await db.Users.ToListAsync();
        var nonCats  = allUsers.Where(u => u.Role != "cats").ToList();

        var newInPeriod = nonCats
            .Where(u => u.CreatedAt >= start && u.CreatedAt <= end)
            .OrderByDescending(u => u.CreatedAt)
            .ToList();

        var roleBreakdown = nonCats
            .GroupBy(u => u.Role)
            .Select(g => new RoleCount(
                g.Key,
                RoleLabels.GetValueOrDefault(g.Key, g.Key),
                g.Count()))
            .OrderByDescending(r => r.Count)
            .ToList();

        return new MembershipReport(
            TotalMembers:      nonCats.Count,
            ActiveMembers:     nonCats.Count(u => u.IsActive),
            InactiveMembers:   nonCats.Count(u => !u.IsActive),
            NewMembersInPeriod: newInPeriod.Count,
            RoleBreakdown:     roleBreakdown,
            NewMembersList:    newInPeriod.Select(u => new NewMemberItem(
                u.Id, u.FullName, u.Email, u.Role, u.CreatedAt)).ToList());
    }

    // ── CATS ──────────────────────────────────────────────────────────────────

    public async Task<CatsReport> GetCatsReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var allUsers = await db.Users.ToListAsync();
        var cats     = allUsers.Where(u => u.Role == "cats").ToList();

        // Approximate conversion: users who had cats_initial credit but are now not cats
        var catsInitialUserIds = await db.CreditTransactions
            .Where(t => t.TransactionType == "cats_initial")
            .Select(t => t.UserId)
            .Distinct()
            .ToListAsync();

        var convertedAllTime = allUsers
            .Count(u => u.Role != "cats" && catsInitialUserIds.Contains(u.Id));

        var totalEverCats    = cats.Count + convertedAllTime;
        var conversionRate   = totalEverCats > 0
            ? Math.Round((decimal)convertedAllTime / totalEverCats * 100, 1)
            : 0;

        var newCatsInPeriod  = allUsers
            .Where(u => u.Role == "cats" && u.CreatedAt >= start && u.CreatedAt <= end)
            .OrderByDescending(u => u.CreatedAt)
            .ToList();

        return new CatsReport(
            TotalActiveCats:      cats.Count,
            NewCatsInPeriod:      newCatsInPeriod.Count,
            ConvertedAllTime:     convertedAllTime,
            ConversionRateAllTime: conversionRate,
            NewCatsList:  newCatsInPeriod.Select(u => new CatsMemberItem(
                u.Id, u.FullName, u.Email, u.CreditBalance, u.CreatedAt)).ToList(),
            ActiveCatsList: cats.OrderBy(u => u.CreatedAt)
                .Select(u => new CatsMemberItem(
                    u.Id, u.FullName, u.Email, u.CreditBalance, u.CreatedAt)).ToList());
    }

    // ── Attendance ────────────────────────────────────────────────────────────

    public async Task<AttendanceReport> GetAttendanceReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var sessions = await db.Sessions
            .Include(s => s.Location)
            .Include(s => s.Coach)
            .Include(s => s.AttendanceRecords)
            .Include(s => s.Bookings)
            .Where(s => s.StartTime >= start && s.StartTime <= end && !s.IsCancelled)
            .OrderByDescending(s => s.StartTime)
            .ToListAsync();

        var allRecords = sessions.SelectMany(s => s.AttendanceRecords).ToList();

        var attended  = allRecords.Count(r => r.Status == "attended");
        var absent    = allRecords.Count(r => r.Status == "absent");
        var late      = allRecords.Count(r => r.Status == "late");
        var nsba      = allRecords.Count(r => r.Status == "nsba");
        var noshow    = allRecords.Count(r => r.Status == "noshow");
        var totalReg  = sessions.Sum(s => s.Bookings.Count);
        var avgAtt    = sessions.Count > 0
            ? sessions.Average(s => s.AttendanceRecords.Count(r => r.Status == "attended"))
            : 0;
        var attRate   = totalReg > 0
            ? Math.Round((double)attended / totalReg * 100, 1)
            : 0;

        var sessionItems = sessions.Select(s => new SessionAttendanceItem(
            s.Id, s.Title, s.StartTime,
            s.Location?.Name,
            s.Coach != null ? $"{s.Coach.FirstName} {s.Coach.LastName}" : null,
            s.Bookings.Count,
            s.AttendanceRecords.Count(r => r.Status == "attended"),
            s.AttendanceRecords.Count(r => r.Status == "absent"),
            s.AttendanceRecords.Count(r => r.Status == "late"),
            s.AttendanceRecords.Count(r => r.Status == "nsba"),
            s.AttendanceRecords.Count(r => r.Status == "noshow")
        )).ToList();

        return new AttendanceReport(
            TotalSessions:      sessions.Count,
            TotalRegistrations: totalReg,
            TotalAttended:      attended,
            AverageAttendance:  Math.Round(avgAtt, 1),
            AttendanceRate:     attRate,
            StatusAttended:     attended,
            StatusAbsent:       absent,
            StatusLate:         late,
            StatusNsba:         nsba,
            StatusNoShow:       noshow,
            Sessions:           sessionItems);
    }

    // ── Lanes ─────────────────────────────────────────────────────────────────

    public async Task<LanesReport> GetLanesReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var sessions = await db.Sessions
            .Include(s => s.AttendanceRecords)
            .Where(s => s.StartTime >= start && s.StartTime <= end && !s.IsCancelled)
            .OrderBy(s => s.StartTime)
            .ToListAsync();

        var withLanes = sessions.Where(s => s.LanesCount.HasValue).ToList();

        var byDay = sessions
            .GroupBy(s => s.StartTime.DayOfWeek)
            .OrderBy(g => g.Key)
            .Select(g =>
            {
                var withL   = g.Where(s => s.LanesCount.HasValue).ToList();
                var avgLanes = withL.Count > 0 ? withL.Average(s => s.LanesCount!.Value) : 0;
                var avgAtt   = g.Any()
                    ? g.Average(s => s.AttendanceRecords.Count(r => r.Status == "attended"))
                    : 0;
                return new DayLanesItem(
                    g.Key.ToString(), g.Count(),
                    Math.Round(avgLanes, 1), Math.Round(avgAtt, 1));
            }).ToList();

        var sessionItems = sessions.Select(s => new SessionLanesItem(
            s.StartTime.Date,
            s.StartTime.DayOfWeek.ToString(),
            s.Title,
            s.LanesCount,
            s.AttendanceRecords.Count(r => r.Status == "attended")
        )).ToList();

        return new LanesReport(
            OverallAvgLanes:    withLanes.Count > 0 ? Math.Round(withLanes.Average(s => s.LanesCount!.Value), 1) : 0,
            OverallAvgAttendees: sessions.Count > 0
                ? Math.Round(sessions.Average(s => s.AttendanceRecords.Count(r => r.Status == "attended")), 1) : 0,
            SessionsWithLaneData: withLanes.Count,
            ByDayOfWeek:        byDay,
            Sessions:           sessionItems);
    }

    // ── Coaches ───────────────────────────────────────────────────────────────

    public async Task<CoachesReport> GetCoachesReportAsync(DateTime start, DateTime end)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var sessions = await db.Sessions
            .Include(s => s.Coach)
            .Where(s => s.StartTime >= start && s.StartTime <= end && s.CoachId.HasValue)
            .ToListAsync();

        var coachStats = sessions
            .GroupBy(s => s.Coach)
            .Where(g => g.Key != null)
            .Select(g => new CoachStatsItem(
                g.Key!.Id,
                $"{g.Key.FirstName} {g.Key.LastName}",
                g.Count(),
                g.Count(s => !s.IsCancelled),
                g.Count(s => s.IsCancelled)))
            .OrderByDescending(c => c.SessionsAssigned)
            .ToList();

        return new CoachesReport(
            TotalSessions: sessions.Count,
            Coaches:       coachStats);
    }
}