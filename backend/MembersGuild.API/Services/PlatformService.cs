using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;
using System.Text.Json;
using MembersGuild.API.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Services;

public class PlatformService
{
    private readonly PlatformDbContext      _platformDb;
    private readonly ClubDbContextFactory   _dbFactory;

    public PlatformService(PlatformDbContext platformDb, ClubDbContextFactory dbFactory)
    {
        _platformDb = platformDb;
        _dbFactory  = dbFactory;
    }

    public async Task AuditAsync(
        string  action,
        string  actor,
        string? clubSlug    = null,
        int?    clubId      = null,
        string? entityType  = null,
        string? entityId    = null,
        object? metadata    = null)
    {
        _platformDb.AuditLogs.Add(new AuditLog
        {
            Action     = action,
            ActorEmail = actor,
            ClubSlug   = clubSlug,
            ClubId     = clubId,
            EntityType = entityType,
            EntityId   = entityId,
            Metadata   = metadata != null ? JsonSerializer.Serialize(metadata) : null,
            CreatedAt  = DateTime.UtcNow
        });
        await _platformDb.SaveChangesAsync();
    }

    public async Task<int> GetMemberCountAsync(string schemaName)
    {
        try
        {
            await using var db = _dbFactory.CreateForSchema(schemaName);
            return await db.Users.CountAsync(u => u.IsActive);
        }
        catch { return 0; }
    }

    public async Task<int> GetSessionCountAsync(string schemaName)
    {
        try
        {
            await using var db = _dbFactory.CreateForSchema(schemaName);
            return await db.Sessions.CountAsync();
        }
        catch { return 0; }
    }

    public int GetTierCap(string tier) => tier switch
    {
        "small"  => 50,
        "medium" => 150,
        "large"  => 999,
        _        => 50
    };

    public async Task<int> GetMemberCapAsync(int clubId)
{
    // Cap = highest MemberCap across all active packages for this club
    var cap = await _platformDb.ClubPackages
        .Include(cp => cp.Package)
        .Where(cp => cp.ClubId == clubId && cp.EndDate == null && cp.Package != null)
        .MaxAsync(cp => (int?)cp.Package!.MemberCap);

    return cap ?? 50; // default to Small cap if no packages assigned
}

public async Task<string> ResetWebmasterPasswordAsync(string schemaName, string webmasterEmail)
{
    // Generate a random 12-char alphanumeric temp password
    const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    var rng = new Random(Guid.NewGuid().GetHashCode());
    var tempPassword = new string(Enumerable.Range(0, 12).Select(_ => chars[rng.Next(chars.Length)]).ToArray());

    var hashedPassword = BCrypt.Net.BCrypt.HashPassword(tempPassword);

    await using var db = _dbFactory.CreateForSchema(schemaName);
    var user = await db.Users.FirstOrDefaultAsync(u =>
    u.Email.ToLower() == webmasterEmail.ToLower());
    if (user is null) throw new InvalidOperationException("Webmaster account not found.");

    user.PasswordHash = hashedPassword;
    await db.SaveChangesAsync();

    return tempPassword;
}
}