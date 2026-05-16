using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Training;

public record TrainingSettingsResponse(
    bool MetricsEnabled,
    bool SetsEnabled,
    bool VideosEnabled,
    string SetsLabel,
    string MetricsLabel
);

public record TrainingMetricResponse(
    int Id,
    string Name,
    string Unit,
    string? Category,
    int DisplayOrder,
    bool IsActive
);

public record MemberTimeResponse(
    int MetricId,
    string MetricName,
    string Unit,
    string? Category,
    string? Value,
    DateTime? UpdatedAt
);

public record UpdateMemberTimesRequest(
    List<MemberTimeEntry> Times
);

public record MemberTimeEntry(
    int MetricId,
    string? Value  // null = clear the time
);

public record TrainingSetResponse(
    int Id,
    string Title,
    string? Description,
    string Difficulty,
    string Category,
    string Content,
    int? TotalDistance,
    bool IsSetOfWeek,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateTrainingSetRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    [Required] string Difficulty,
    [Required] string Category,
    [Required] string Content,
    int? TotalDistance
);

public record UpdateTrainingSetRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    [Required] string Difficulty,
    [Required] string Category,
    [Required] string Content,
    int? TotalDistance,
    bool IsActive
);

public record TrainingVideoResponse(
    int Id,
    string Title,
    string? Description,
    string Category,
    string YoutubeUrl,
    string? ThumbnailUrl,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateTrainingVideoRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    [Required] string Category,
    [Required] string YoutubeUrl
);

public record UpdateTrainingVideoRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    [Required] string Category,
    [Required] string YoutubeUrl,
    bool IsActive
);