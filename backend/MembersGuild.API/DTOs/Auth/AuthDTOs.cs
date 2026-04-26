using System.ComponentModel.DataAnnotations;

namespace MembersGuild.API.DTOs.Auth;

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password
);

public record LoginResponse(
    string Token,
    UserDto User
);

public record UserDto(
    int Id,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    int CreditBalance,
    string? ProfilePhotoUrl,
    bool IsActive
);

public record ChangePasswordRequest(
    [Required] string CurrentPassword,
    [Required, MinLength(8)] string NewPassword
);
