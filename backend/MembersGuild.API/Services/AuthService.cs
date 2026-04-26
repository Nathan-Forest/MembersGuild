using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MembersGuild.API.DTOs.Auth;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace MembersGuild.API.Services;

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(string email, string password);
    string GenerateToken(User user, ClubContext club);
    string HashPassword(string password);
    bool VerifyPassword(string password, string hash);
    string GenerateTemporaryPassword();
}

public class AuthService : IAuthService
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly ClubContext _clubContext;
    private readonly IConfiguration _config;

    public AuthService(ClubDbContextFactory dbFactory, ClubContext clubContext, IConfiguration config)
    {
        _dbFactory = dbFactory;
        _clubContext = clubContext;
        _config = config;
    }

    public async Task<LoginResponse?> LoginAsync(string email, string password)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Email == email.ToLower() && u.IsActive);

        if (user is null || !VerifyPassword(password, user.PasswordHash))
            return null;

        // Update last login timestamp
        user.LastLoginAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var token = GenerateToken(user, _clubContext);

        return new LoginResponse(token, new UserDto(
            user.Id,
            user.Email,
            user.FirstName,
            user.LastName,
            user.Role,
            user.CreditBalance,
            user.ProfilePhotoUrl,
            user.IsActive
        ));
    }

    public string GenerateToken(User user, ClubContext club)
    {
        var secret = _config["JWT_SECRET"]
            ?? throw new InvalidOperationException("JWT_SECRET not configured");

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("club_id", club.ClubId.ToString()),
            new Claim("club_slug", club.Slug),
            new Claim("role", user.Role),
        };

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddDays(7),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string HashPassword(string password) =>
        BCrypt.Net.BCrypt.HashPassword(password, workFactor: 12);

    public bool VerifyPassword(string password, string hash) =>
        BCrypt.Net.BCrypt.Verify(password, hash);

    public string GenerateTemporaryPassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 16)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }
}
