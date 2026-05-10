using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Sessions;

public record SessionResponse(
    int Id,
    string Title,
    string? Description,
    int? LocationId,
    string? LocationName,
    int? CoachId,
    string? CoachName,
    DateTime StartTime,
    DateTime EndTime,
    int Capacity,
    int CreditCost,
    int RegistrationCutoffHours,
    bool IsCancelled,
    bool IsRecurring,
    int BookedCount,
    bool IsBooked  // whether the current user is booked
);

public record CreateSessionRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    int? LocationId,
    int? CoachId,
    [Required] DateTime StartTime,
    [Required] DateTime EndTime,
    int Capacity = 25,
    int CreditCost = 1,
    int RegistrationCutoffHours = 24
);

public record UpdateSessionRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    int? LocationId,
    int? CoachId,
    [Required] DateTime StartTime,
    [Required] DateTime EndTime,
    int Capacity = 25,
    int CreditCost = 1,
    int RegistrationCutoffHours = 24
);

public record RecurringSessionRequest(
    [Required, MaxLength(200)] string Title,
    string? Description,
    int? LocationId,
    int? CoachId,
    [Required] TimeOnly StartTime,
    [Required] TimeOnly EndTime,
    [Required] List<DayOfWeek> DaysOfWeek,
    [Required] DateOnly StartDate,
    [Required] DateOnly EndDate,
    int Capacity = 25,
    int CreditCost = 1,
    int RegistrationCutoffHours = 24
);