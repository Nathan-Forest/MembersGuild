namespace MembersGuild.API.DTOs.Platform;

public record ClubSummaryResponse(
    int      Id,
    string   Slug,
    string   Name,
    string   DisplayName,
    string   Tier,
    string   Status,
    int      MemberCount,
    int      TierCap,
    int      SessionCount,
    DateTime  CreatedAt,
    DateTime? LastActivityAt
);

public record ProvisionClubRequest(
    string  Slug,
    string  Name,
    string  DisplayName,
    string  Tier,
    string  Sport,
    string  PrimaryColor,
    string  SecondaryColor,
    string? LogoUrl
);

public record ProvisionClubResponse(
    string Slug,
    string Status,
    string ProvisioningJobId,
    int    EstimatedCompletionSeconds
);

public record JobStatusResponse(
    string    JobId,
    string    Type,
    string    TargetSlug,
    string    Status,
    DateTime  StartedAt,
    DateTime? CompletedAt,
    string?   Error
);