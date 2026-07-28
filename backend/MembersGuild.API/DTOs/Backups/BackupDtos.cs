namespace MembersGuild.API.DTOs.Backups;

public record AttendanceExportRow(
    DateTime Date,
    string SessionTitle,
    DateTime StartTime,
    DateTime EndTime,
    string? Location,
    string? Pool,
    int? Lanes,
    string? Coach,
    string AttendeeName,
    string AttendeeType,      // "Member" or "Guest"
    string? Status,
    string? Notes
);

public record MembershipExportRow(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string Role,
    bool IsActive,
    string? MemberNumber,
    string? AssociationNumber,
    DateOnly? DateOfBirth,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool MarketingOptOut,
    int CreditBalance,
    DateTime MemberSince
);

public record CreditHistoryExportRow(
    DateTime Date,
    string MemberName,
    string MemberEmail,
    string TransactionType,
    int Amount,
    int BalanceAfter,
    string? Notes,
    string AddedBy
);