namespace MembersGuild.API.DTOs.Public;

public record SubmitSupportRequest(
    string  Category,
    string  Name,
    string  Email,
    string  Description,
    string? StartedAt,
    string? Device,
    bool    GuideRead
);