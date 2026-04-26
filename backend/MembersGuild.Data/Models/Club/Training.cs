namespace MembersGuild.Data.Models.Club;

/// <summary>
/// Configurable performance metric — sport-agnostic.
/// A swimming club gets 24 metrics (4 strokes × 6 distances) via the swim template.
/// A rowing club gets different metrics. A triathlon club gets different again.
/// </summary>
public class TrainingMetric
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;      // "100m Freestyle", "5km Run"
    public string Unit { get; set; } = string.Empty;      // "MM:SS.ms", "kg", "km"
    public string? Category { get; set; }                  // "Freestyle", "Backstroke"
    public int DisplayOrder { get; set; } = 0;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<MemberTime> MemberTimes { get; set; } = new List<MemberTime>();
}

/// <summary>
/// A member's personal best for a specific metric.
/// </summary>
public class MemberTime
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int MetricId { get; set; }
    public string Value { get; set; } = string.Empty;  // "01:23.45"
    public int? UpdatedBy { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
    public TrainingMetric? Metric { get; set; }
}

public class SwimSet
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Difficulty { get; set; } = "intermediate";  // beginner, intermediate, advanced
    public string Category { get; set; } = "other";            // sprint, endurance, technique, im, other
    public string Content { get; set; } = string.Empty;        // the actual set
    public int? TotalDistance { get; set; }                    // metres
    public bool IsSetOfWeek { get; set; } = false;
    public bool IsActive { get; set; } = true;
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class TrainingVideo
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Category { get; set; } = "drills";  // drills, strength, stretches
    public string YoutubeUrl { get; set; } = string.Empty;
    public string? ThumbnailUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public int? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Unit type constants supported by the training module.
/// </summary>
public static class MetricUnits
{
    public const string TimeSwim     = "MM:SS.ms";  // Swimming
    public const string TimeRun      = "MM:SS";     // Running / rowing
    public const string TimeLong     = "HH:MM:SS";  // Cycling / triathlon
    public const string Kilograms    = "kg";
    public const string Kilometres   = "km";
    public const string Metres       = "m";
    public const string Repetitions  = "rep";
}
