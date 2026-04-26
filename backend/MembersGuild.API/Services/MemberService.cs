using MembersGuild.API.DTOs.Members;
using MembersGuild.API.Extensions;
using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public interface IMemberService
{
    Task<List<MemberListResponse>> GetMembersAsync(string? search, string? creditFilter);
    Task<MemberDetailResponse?> GetMemberAsync(int id);
    Task<MemberDetailResponse> CreateMemberAsync(CreateMemberRequest request, int createdBy);
    Task<MemberDetailResponse?> UpdateMemberAsync(int id, UpdateMemberRequest request);
    Task<bool> UpdateRoleAsync(int id, string role, int requestingUserId);
    Task<bool> SetActiveAsync(int id, bool isActive);
    Task<string> ResetPasswordAsync(int id);
    Task<bool> DeleteMemberAsync(int id, int requestingUserId);
    Task<MemberStatsResponse> GetStatsAsync();
}

public class MemberService : IMemberService
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly IAuthService _auth;

    private static readonly Dictionary<string, string> RoleLabels = new()
    {
        ["cats"]       = "CATS",
        ["member"]     = "Member",
        ["coach"]      = "Coach",
        ["committee"]  = "Committee",
        ["membership"] = "Membership",
        ["finance"]    = "Finance",
        ["webmaster"]  = "Webmaster",
    };

    public MemberService(ClubDbContextFactory dbFactory, IAuthService auth)
    {
        _dbFactory = dbFactory;
        _auth = auth;
    }

    public async Task<List<MemberListResponse>> GetMembersAsync(string? search, string? creditFilter)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var now = DateTime.UtcNow;

        var query = db.Users.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            search = search.ToLower();
            query = query.Where(u =>
                u.FirstName.ToLower().Contains(search) ||
                u.LastName.ToLower().Contains(search) ||
                u.Email.ToLower().Contains(search) ||
                (u.MemberNumber != null && u.MemberNumber.ToLower().Contains(search)));
        }

        query = creditFilter switch
        {
            "none" => query.Where(u => u.CreditBalance <= 0),
            "low"  => query.Where(u => u.CreditBalance > 0 && u.CreditBalance <= 2),
            "ok"   => query.Where(u => u.CreditBalance > 2),
            _      => query
        };

        var users = await query.OrderBy(u => u.LastName).ThenBy(u => u.FirstName).ToListAsync();

        // Get upcoming booking counts in one query
        var userIds = users.Select(u => u.Id).ToList();
        var upcomingCounts = await db.SessionBookings
            .Where(b => userIds.Contains(b.UserId) && b.Session!.StartTime > now && !b.Session.IsCancelled)
            .GroupBy(b => b.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        return users.Select(u => new MemberListResponse(
            u.Id, u.Email, u.FirstName, u.LastName, u.FullName,
            u.Role, RoleLabels.GetValueOrDefault(u.Role, u.Role),
            u.CreditBalance, u.Phone, u.MemberNumber, u.ProfilePhotoUrl,
            u.IsActive, u.CreatedAt,
            upcomingCounts.GetValueOrDefault(u.Id, 0)
        )).ToList();
    }

    public async Task<MemberDetailResponse?> GetMemberAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var u = await db.Users.FindAsync(id);
        return u is null ? null : MapDetail(u);
    }

    public async Task<MemberDetailResponse> CreateMemberAsync(CreateMemberRequest request, int createdBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var exists = await db.Users.AnyAsync(u => u.Email == request.Email.ToLower());
        if (exists) throw new InvalidOperationException("Email already in use");

        if (!Roles.AllClubRoles.Contains(request.Role))
            throw new InvalidOperationException($"Invalid role: {request.Role}");

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? _auth.GenerateTemporaryPassword()
            : request.Password;

        var user = new User
        {
            Email                 = request.Email.ToLower(),
            PasswordHash          = _auth.HashPassword(password),
            FirstName             = request.FirstName.Trim(),
            LastName              = request.LastName.Trim(),
            Phone                 = request.Phone?.Trim(),
            MemberNumber          = request.MemberNumber?.Trim(),
            DateOfBirth           = request.DateOfBirth,
            EmergencyContactName  = request.EmergencyContactName?.Trim(),
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim(),
            Role                  = request.Role,
            CreditBalance         = 0,
            IsActive              = true,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();
        return MapDetail(user);
    }

    public async Task<MemberDetailResponse?> UpdateMemberAsync(int id, UpdateMemberRequest request)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return null;

        user.FirstName             = request.FirstName.Trim();
        user.LastName              = request.LastName.Trim();
        user.Phone                 = request.Phone?.Trim();
        user.MemberNumber          = request.MemberNumber?.Trim();
        user.DateOfBirth           = request.DateOfBirth;
        user.EmergencyContactName  = request.EmergencyContactName?.Trim();
        user.EmergencyContactPhone = request.EmergencyContactPhone?.Trim();
        user.UpdatedAt             = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return MapDetail(user);
    }

    public async Task<bool> UpdateRoleAsync(int id, string role, int requestingUserId)
    {
        if (!Roles.AllClubRoles.Contains(role)) return false;

        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        user.Role      = role;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetActiveAsync(int id, bool isActive)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        user.IsActive  = isActive;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<string> ResetPasswordAsync(int id)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id)
            ?? throw new InvalidOperationException("User not found");

        var temp = _auth.GenerateTemporaryPassword();
        user.PasswordHash = _auth.HashPassword(temp);
        user.UpdatedAt    = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return temp;
    }

    public async Task<bool> DeleteMemberAsync(int id, int requestingUserId)
    {
        if (id == requestingUserId) return false; // cannot delete yourself

        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        db.Users.Remove(user);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<MemberStatsResponse> GetStatsAsync()
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var users = await db.Users.ToListAsync();

        return new MemberStatsResponse(
            users.Count,
            users.Count(u => u.IsActive),
            users.Count(u => u.CreditBalance > 0 && u.CreditBalance <= 2),
            users.Count(u => u.CreditBalance <= 0)
        );
    }

    private static MemberDetailResponse MapDetail(User u) => new(
        u.Id, u.Email, u.FirstName, u.LastName, u.Role,
        u.Role, u.CreditBalance, u.Phone, u.MemberNumber,
        u.ProfilePhotoUrl, u.DateOfBirth, u.EmergencyContactName,
        u.EmergencyContactPhone, u.IsActive, u.LastLoginAt, u.CreatedAt
    );
}