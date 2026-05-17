using System.ComponentModel.DataAnnotations;
using MembersGuild.Data.Models.Club;

namespace MembersGuild.API.DTOs.Members;

public record MemberListResponse(
    int Id,
    string Email,
    string FirstName,
    string LastName,
    string FullName,
    string Role,
    string RoleLabel,
    int CreditBalance,
    string? Phone,
    string? MemberNumber,
    string? ProfilePhotoUrl,
    bool IsActive,
    DateTime CreatedAt,
    int UpcomingSessionCount
);

public record MemberDetailResponse(
    int Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    string RoleLabel,
    int CreditBalance,
    string? Phone,
    string? MemberNumber,
    string? AssociationNumber,
    string? ProfilePhotoUrl,
    DateOnly? DateOfBirth,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    bool IsActive,
    DateTime? LastLoginAt,
    DateTime CreatedAt,
    DateTime? JoinedAt,
    DateTime EffectiveJoinDate
);

public record CreateMemberRequest(
    [Required, EmailAddress, MaxLength(200)] string Email,
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    [Required] string Role,
    string? Phone,
    string? MemberNumber,
    string? AssociationNumber,
    DateOnly? DateOfBirth,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? Password  // auto-generated if not provided
);

public record UpdateMemberRequest(
    [Required, MaxLength(100)] string FirstName,
    [Required, MaxLength(100)] string LastName,
    string? Phone,
    string? MemberNumber,
    DateOnly? DateOfBirth,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    string? AssociationNumber,
    DateTime? JoinedAt    
);

public record UpdateRoleRequest(
    [Required] string Role
);

public record ResetPasswordResponse(
    string TemporaryPassword
);

public record MemberStatsResponse(
    int TotalMembers,
    int ActiveMembers,
    int LowCreditMembers,
    int NoCreditsMembers
);