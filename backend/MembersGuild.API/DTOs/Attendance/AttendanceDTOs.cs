namespace MembersGuild.API.DTOs.Attendance;

public record AttendanceSessionResponse(
    int Id,
    string Title,
    string? LocationName,
    string? CoachName,
    DateTime StartTime,
    DateTime EndTime,
    int Capacity,
    int BookedCount,
    int AttendedCount,
    int MarkedCount
);

public record AttendanceSheetMember(
    int UserId,
    string FullName,
    string Email,
    string Role,
    string? Status,  // null = not yet marked
    bool CreditRefunded
);

public record MarkAttendanceRequest(
    int UserId,
    string Status,  // attended | absent | late | noshow | nsba
    string? Notes
);

public record QrTokenResponse(
    string Token,
    string CheckinUrl,
    DateTime ExpiresAt
);

public record UpdateCoachRequest(int? CoachId, bool NoShow);