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
    Task<ImportResult> ImportMembersAsync(List<ImportMemberRequest> requests, int importedBy);
}

public class MemberService : IMemberService
{
    private readonly ClubDbContextFactory _dbFactory;
    private readonly IAuthService _auth;

    private static readonly Dictionary<string, string> RoleLabels = new()
    {
        ["cats"] = "CATS",
        ["member"] = "Member",
        ["coach"] = "Coach",
        ["committee"] = "Committee",
        ["membership"] = "Membership",
        ["finance"] = "Finance",
        ["webmaster"] = "Webmaster",
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
            "low" => query.Where(u => u.CreditBalance > 0 && u.CreditBalance <= 2),
            "ok" => query.Where(u => u.CreditBalance > 2),
            _ => query
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
            Email = request.Email.ToLower(),
            PasswordHash = _auth.HashPassword(password),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Phone = request.Phone?.Trim(),
            MemberNumber = request.MemberNumber?.Trim(),
            AssociationNumber = request.AssociationNumber?.Trim(),
            DateOfBirth = request.DateOfBirth,
            EmergencyContactName = request.EmergencyContactName?.Trim(),
            EmergencyContactPhone = request.EmergencyContactPhone?.Trim(),
            Role = request.Role,
            CreditBalance = 0,
            IsActive = true,
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

        user.FirstName = request.FirstName.Trim();
        user.LastName = request.LastName.Trim();
        user.Phone = request.Phone?.Trim();
        user.MemberNumber = request.MemberNumber?.Trim();
        user.AssociationNumber = request.AssociationNumber?.Trim();
        user.DateOfBirth = request.DateOfBirth;
        user.EmergencyContactName = request.EmergencyContactName?.Trim();
        user.EmergencyContactPhone = request.EmergencyContactPhone?.Trim();
        user.JoinedAt = request.JoinedAt;
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return MapDetail(user);
    }

    public async Task<bool> UpdateRoleAsync(int id, string role, int requestingUserId)
    {
        if (!Roles.AllClubRoles.Contains(role)) return false;

        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        // Auto-track CATS → Member conversion
        if (user.Role == Roles.Cats && role != Roles.Cats)
        {
            user.ConvertedFromCats = true;
            user.CatsConvertedAt = DateTime.UtcNow;
        }

        user.Role = role;
        user.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> SetActiveAsync(int id, bool isActive)
    {
        await using var db = _dbFactory.CreateForCurrentClub();
        var user = await db.Users.FindAsync(id);
        if (user is null) return false;

        user.IsActive = isActive;
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
        user.UpdatedAt = DateTime.UtcNow;
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
        u.Role, u.CreditBalance, u.Phone, u.MemberNumber, u.AssociationNumber,
        u.ProfilePhotoUrl, u.DateOfBirth, u.EmergencyContactName,
        u.EmergencyContactPhone, u.IsActive, u.LastLoginAt, u.CreatedAt,
        u.JoinedAt,
        u.EffectiveJoinDate
    );

    public async Task<ImportResult> ImportMembersAsync(List<ImportMemberRequest> requests, int importedBy)
    {
        await using var db = _dbFactory.CreateForCurrentClub();

        var errors = new List<string>();
        var toCreate = new List<(User User, int Credits)>();

        // Fetch existing emails in one query
        var allEmails = await db.Users.Select(u => u.Email).ToListAsync();
        var emailSet = new HashSet<string>(allEmails, StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < requests.Count; i++)
        {
            var req = requests[i];
            var row = $"Row {i + 2}"; // +2 because row 1 is header

            if (string.IsNullOrWhiteSpace(req.FirstName)) { errors.Add($"{row}: First name is required"); continue; }
            if (string.IsNullOrWhiteSpace(req.LastName)) { errors.Add($"{row}: Last name is required"); continue; }
            if (string.IsNullOrWhiteSpace(req.Email)) { errors.Add($"{row}: Email is required"); continue; }

            var email = req.Email.Trim().ToLower();
            if (emailSet.Contains(email))
            {
                errors.Add($"{row} ({email}): Already exists — skipped");
                continue;
            }

            var role = Roles.AllClubRoles.Contains(req.Role?.ToLower() ?? "")
                ? req.Role!.ToLower() : "member";

            DateTime? joinedAt = null;
            if (!string.IsNullOrWhiteSpace(req.JoinDate))
            {
                if (DateTime.TryParseExact(req.JoinDate,
                    new[] { "dd/MM/yyyy", "d/M/yyyy", "d/MM/yyyy", "dd/M/yyyy", "yyyy-MM-dd" },
                    null, System.Globalization.DateTimeStyles.None, out var parsed))
                {
                    joinedAt = DateTime.SpecifyKind(parsed, DateTimeKind.Utc);
                }
                else
                {
                    errors.Add($"{row} ({email}): Invalid date format '{req.JoinDate}' — use DD/MM/YYYY");
                    continue;
                }
            }

            var user = new User
            {
                Email = email,
                PasswordHash = _auth.HashPassword(_auth.GenerateTemporaryPassword()),
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                Phone = req.Phone?.Trim(),
                AssociationNumber = req.AssociationNumber?.Trim(),
                Role = role,
                CreditBalance = Math.Max(0, req.StartingCredits),
                JoinedAt = joinedAt,
                IsActive = true,
            };

            emailSet.Add(email); // prevent duplicates within the same import
            toCreate.Add((user, Math.Max(0, req.StartingCredits)));
        }

        // Batch insert users
        db.Users.AddRange(toCreate.Select(x => x.User));
        await db.SaveChangesAsync();

        // Add credit transactions for those with starting credits
        foreach (var (user, credits) in toCreate.Where(x => x.Credits > 0))
        {
            db.CreditTransactions.Add(new CreditTransaction
            {
                UserId = user.Id,
                Amount = credits,
                BalanceAfter = credits,
                TransactionType = "import_credit",
                Notes = "Starting credits on member import",
                CreatedBy = importedBy,
                CreatedAt = DateTime.UtcNow,
            });
        }
        await db.SaveChangesAsync();

        var skipped = requests.Count - toCreate.Count - errors.Count(e => e.Contains("Already exists"));
        return new ImportResult(toCreate.Count, requests.Count - toCreate.Count, errors);
    }
}