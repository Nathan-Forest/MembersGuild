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
}