using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Locations;

public record LocationResponse(
    int Id,
    string Name,
    string? Address,
    string? Phone,
    int? Capacity,
    bool IsActive
);

public record CreateLocationRequest(
    [Required, MaxLength(200)] string Name,
    string? Address,
    string? Phone,
    int? Capacity
);

public record UpdateLocationRequest(
    [Required, MaxLength(200)] string Name,
    string? Address,
    string? Phone,
    int? Capacity,
    bool IsActive
);

public record PoolResponse(
    int Id,
    int LocationId,
    string Name,
    decimal? HireFeePerHourPerLane,
    bool IsActive
);

public record CreatePoolRequest(
    [Required, MaxLength(100)] string Name,
    decimal? HireFeePerHourPerLane
);

public record UpdatePoolRequest(
    [Required, MaxLength(100)] string Name,
    decimal? HireFeePerHourPerLane,
    bool IsActive
);