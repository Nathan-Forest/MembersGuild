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