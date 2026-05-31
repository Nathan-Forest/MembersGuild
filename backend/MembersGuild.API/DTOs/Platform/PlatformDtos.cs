namespace MembersGuild.API.DTOs.Platform;

public record ClubSummaryResponse(
    int Id,
    string Slug,
    string Name,
    string DisplayName,
    string Tier,
    string Status,
    int MemberCount,
    int TierCap,
    int SessionCount,
    DateTime CreatedAt,
    DateTime? LastActivityAt
);

public record ProvisionClubRequest(
    string Slug,
    string Name,
    string DisplayName,
    string Tier,
    string Sport,
    string PrimaryColor,
    string SecondaryColor,
    string? LogoUrl,
    string? WebmasterName,
    string? WebmasterEmail
);

public record ProvisionClubResponse(
    string Slug,
    string Status,
    string ProvisioningJobId,
    int EstimatedCompletionSeconds
);

public record JobStatusResponse(
    string JobId,
    string Type,
    string TargetSlug,
    string Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    string? Error
);

public record UpdateClubStatusRequest(
    string Status   // "active", "suspended", "cancelled"
);

public record UpdateClubTierRequest(
    string Tier,        // "small", "medium", "large"
    decimal MonthlyAmount
);

public record OnboardApplicationRequest(string Slug, string? Notes);
public record RejectApplicationRequest(string? Notes);

public record ClubDetailResponse(
    int Id, string Slug, string Name, string DisplayName,
    string Tier, string Status, int MemberCount, int TierCap, int SessionCount,
    string? SportType, string? Website, string? Phone, string? Address,
    string? WebmasterName, string? WebmasterEmail, string? WebmasterPhone,
    DateTime? OnboardedAt, DateTime CreatedAt, DateTime? LastActivityAt
);

public record SetWebmasterStatusRequest(bool IsActive);
public record ExtendGracePeriodRequest(int Days, string? Note);