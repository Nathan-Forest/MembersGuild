namespace MembersGuild.API.DTOs.Reports;

// ── Financial ─────────────────────────────────────────────────────────────────

public record FinancialReport(
    decimal TotalRevenue,
    decimal ConfirmedRevenue,
    decimal PendingRevenue,
    int TotalOrders,
    int PendingOrders,
    int ConfirmedOrders,
    int DeliveredOrders,
    int CancelledOrders,
    decimal CreditPackRevenue,
    decimal MerchandiseRevenue,
    int TotalCreditsIssued,
    List<TopItemReport> TopItems);

public record TopItemReport(string Name, int QuantitySold, decimal Revenue);

// ── Membership ────────────────────────────────────────────────────────────────

public record MembershipReport(
    int TotalMembers,
    int ActiveMembers,
    int InactiveMembers,
    int NewMembersInPeriod,
    List<RoleCount> RoleBreakdown,
    List<NewMemberItem> NewMembersList);

public record RoleCount(string Role, string Label, int Count);

public record NewMemberItem(
    int Id, string Name, string Email,
    string Role, DateTime CreatedAt);

// ── CATS ──────────────────────────────────────────────────────────────────────

public record CatsReport(
    int TotalActiveCats,
    int NewCatsInPeriod,
    int ConvertedAllTime,
    decimal ConversionRateAllTime,
    List<CatsMemberItem> NewCatsList,
    List<CatsMemberItem> ActiveCatsList);

public record CatsMemberItem(
    int Id, string Name, string Email,
    int CreditBalance, DateTime CreatedAt);

// ── Attendance ────────────────────────────────────────────────────────────────

public record AttendanceReport(
    int TotalSessions,
    int TotalRegistrations,
    int TotalAttended,
    double AverageAttendance,
    double AttendanceRate,
    int StatusAttended,
    int StatusAbsent,
    int StatusLate,
    int StatusNsba,
    int StatusNoShow,
    List<SessionAttendanceItem> Sessions);

public record SessionAttendanceItem(
    int Id, string Title, DateTime StartTime,
    string? Location, string? CoachName,
    int Registered, int Attended, int Absent,
    int Late, int Nsba, int NoShow);

// ── Lanes ─────────────────────────────────────────────────────────────────────

public record LanesReport(
    double OverallAvgLanes,
    double OverallAvgAttendees,
    int SessionsWithLaneData,
    List<DayLanesItem> ByDayOfWeek,
    List<SessionLanesItem> Sessions);

public record DayLanesItem(
    string Day, int SessionCount,
    double AvgLanes, double AvgAttendees);

public record SessionLanesItem(
    DateTime Date, string DayOfWeek,
    string Title, int? Lanes, int Attended);

// ── Coaches ───────────────────────────────────────────────────────────────────

public record CoachReport(
    int CoachId,
    string CoachName,
    int SessionsAssigned,
    int SessionsPresent,    // ← was SessionsCompleted
    int SessionsNoShow,     // ← new
    int SessionsCancelled
);

public record CoachesReport(
    int TotalSessions,
    List<CoachReport> Coaches
);

public record CoachStatsItem(
    int UserId, string Name,
    int SessionsAssigned,
    int SessionsCompleted,
    int SessionsCancelled);