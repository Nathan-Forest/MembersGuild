namespace MembersGuild.API.DTOs.Attendance;

using System.ComponentModel.DataAnnotations;

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
    bool CreditRefunded,
    int CreditBalance,
    string? Notes
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
public record UpdateLocationRequest(int? LocationId);
public record CancelSessionRequest(string? Reason);
public record EmailReportRequest(List<string> Emails);

public record AttendanceReportMember(
    string FullName,
    string? Status,
    bool CreditRefunded
);

public record UpdateNoteRequest(int UserId, string? Notes);
public record SessionNoteRequest(string? Note);

public record AddGuestRequest(
    [Required, MaxLength(150)] string Name,
    string? Email,
    string? Phone,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? HomeSuburb,
    bool IsMemberOfAnotherClub,
    string? AssociationNumber,
    string? Notes
);

public record GuestResponse(
    int Id,
    string Name,
    string? Email,
    string? Phone,
    string? HomeSuburb,
    bool IsMemberOfAnotherClub,
    string? AssociationNumber,
    string? Notes,
    DateTime AttendedAt
);