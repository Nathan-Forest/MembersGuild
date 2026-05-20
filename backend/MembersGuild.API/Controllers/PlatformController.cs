using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MembersGuild.API.DTOs.Platform;
using MembersGuild.API.Services;
using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("platform")]
public class PlatformController : ControllerBase
{
    private readonly PlatformDbContext _platformDb;
    private readonly PlatformService _platform;
    private readonly IServiceScopeFactory _scopeFactory;

    public PlatformController(
        PlatformDbContext platformDb,
        PlatformService platform,
        IServiceScopeFactory scopeFactory)
    {
        _platformDb = platformDb;
        _platform = platform;
        _scopeFactory = scopeFactory;
    }

    // GET /platform/clubs
    [HttpGet("clubs")]
    public async Task<IActionResult> GetClubs()
    {
        var clubs = await _platformDb.Clubs
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();

        var result = new List<ClubSummaryResponse>();

        foreach (var club in clubs)
        {
            var memberCount = await _platform.GetMemberCountAsync(club.SchemaName);
            var sessionCount = await _platform.GetSessionCountAsync(club.SchemaName);

            result.Add(new ClubSummaryResponse(
                Id: club.Id,
                Slug: club.Slug,
                Name: club.Name,
                DisplayName: club.DisplayName,
                Tier: club.SubscriptionTier,
                Status: club.SubscriptionStatus,
                MemberCount: memberCount,
                TierCap: _platform.GetTierCap(club.SubscriptionTier),
                SessionCount: sessionCount,
                CreatedAt: club.CreatedAt,
                LastActivityAt: club.UpdatedAt
            ));
        }

        return Ok(result);
    }

    // POST /platform/clubs
    [HttpPost("clubs")]
    public async Task<IActionResult> ProvisionClub([FromBody] ProvisionClubRequest req)
    {
        // Validate slug is unique
        var exists = await _platformDb.Clubs.AnyAsync(c => c.Slug == req.Slug);
        if (exists)
            return BadRequest(new { error = $"Club with slug '{req.Slug}' already exists" });

        // Create the job record
        var job = new ProvisioningJob
        {
            Id = Guid.NewGuid(),
            Type = "provision_club",
            TargetSlug = req.Slug,
            Status = "pending",
            StartedAt = DateTime.UtcNow
        };

        _platformDb.ProvisioningJobs.Add(job);
        await _platformDb.SaveChangesAsync();

        // Fire and forget — provisioning runs in background
        _ = Task.Run(async () =>
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var provisioningService = scope.ServiceProvider
                .GetRequiredService<ClubProvisioningService>();
            var platformDb = scope.ServiceProvider
                .GetRequiredService<PlatformDbContext>();
            var platformSvc = scope.ServiceProvider
                .GetRequiredService<PlatformService>();

            // Mark running
            var jobToUpdate = await platformDb.ProvisioningJobs.FindAsync(job.Id);
            if (jobToUpdate is null) return;
            jobToUpdate.Status = "running";
            await platformDb.SaveChangesAsync();

            try
            {
                await provisioningService.ProvisionClubAsync(
    req.Slug, req.Name, req.DisplayName, req.Sport);

                // Then update branding and tier on the club record
                var club = await platformDb.Clubs
                    .FirstOrDefaultAsync(c => c.Slug == req.Slug);

                if (club != null)
                {
                    club.PrimaryColor = req.PrimaryColor;
                    club.SecondaryColor = req.SecondaryColor;
                    club.LogoUrl = req.LogoUrl;
                    club.SubscriptionTier = req.Tier;
                    club.UpdatedAt = DateTime.UtcNow;
                    await platformDb.SaveChangesAsync();
                }

                jobToUpdate.Status = "completed";
                jobToUpdate.CompletedAt = DateTime.UtcNow;
                await platformDb.SaveChangesAsync();

                await platformSvc.AuditAsync(
                    action: "club.provisioned",
                    actor: "system",
                    clubSlug: req.Slug,
                    metadata: new { req.Tier, req.Sport });
            }
            catch (Exception ex)
            {
                jobToUpdate.Status = "failed";
                jobToUpdate.CompletedAt = DateTime.UtcNow;
                jobToUpdate.Error = ex.Message;
                await platformDb.SaveChangesAsync();

                await platformSvc.AuditAsync(
                    action: "club.provision_failed",
                    actor: "system",
                    clubSlug: req.Slug,
                    metadata: new { error = ex.Message });
            }
        });

        return Accepted(new ProvisionClubResponse(
            Slug: req.Slug,
            Status: "provisioning",
            ProvisioningJobId: job.Id.ToString(),
            EstimatedCompletionSeconds: 15
        ));
    }

    // GET /platform/jobs/{jobId}
    [HttpGet("jobs/{jobId}")]
    public async Task<IActionResult> GetJobStatus(Guid jobId)
    {
        var job = await _platformDb.ProvisioningJobs.FindAsync(jobId);
        if (job is null) return NotFound();

        return Ok(new JobStatusResponse(
            JobId: job.Id.ToString(),
            Type: job.Type,
            TargetSlug: job.TargetSlug,
            Status: job.Status,
            StartedAt: job.StartedAt,
            CompletedAt: job.CompletedAt,
            Error: job.Error
        ));
    }

    // PUT /platform/clubs/{slug}/status
    [HttpPut("clubs/{slug}/status")]
    public async Task<IActionResult> UpdateClubStatus(string slug, [FromBody] UpdateClubStatusRequest req)
    {
        var validStatuses = new[] { "active", "suspended", "cancelled" };
        if (!validStatuses.Contains(req.Status))
            return BadRequest(new { error = "Status must be active, suspended or cancelled" });

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        var previous = club.SubscriptionStatus;
        club.SubscriptionStatus = req.Status;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: $"club.status_changed",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { from = previous, to = req.Status });

        return Ok(new { slug, status = req.Status });
    }

    // PUT /platform/clubs/{slug}/tier
    [HttpPut("clubs/{slug}/tier")]
    public async Task<IActionResult> UpdateClubTier(string slug, [FromBody] UpdateClubTierRequest req)
    {
        var validTiers = new[] { "small", "medium", "large" };
        if (!validTiers.Contains(req.Tier))
            return BadRequest(new { error = "Tier must be small, medium or large" });

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        var previous = club.SubscriptionTier;
        club.SubscriptionTier = req.Tier;
        club.MonthlyAmount = req.MonthlyAmount;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "club.tier_changed",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { from = previous, to = req.Tier, monthlyAmount = req.MonthlyAmount });

        return Ok(new { slug, tier = req.Tier, monthlyAmount = req.MonthlyAmount });
    }

    // DELETE /platform/clubs/{slug}
    [HttpDelete("clubs/{slug}")]
    public async Task<IActionResult> DeleteClub(string slug)
    {
        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        // Soft delete — mark inactive rather than destroy data
        club.IsActive = false;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "club.deleted",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { name = club.Name });

        return Ok(new { slug, deleted = true });
    }

    // GET /platform/health
    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        var checkedAt = DateTime.UtcNow;

        try
        {
            var canConnect = await _platformDb.Database.CanConnectAsync();
            var totalClubs = await _platformDb.Clubs.CountAsync();
            var activeClubs = await _platformDb.Clubs.CountAsync(c => c.IsActive);

            var conn = _platformDb.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();

            // Active DB connections
            int connectionCount;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()";
                connectionCount = (int)(await cmd.ExecuteScalarAsync() ?? 0);
            }

            // Total database size
            long dbSizeBytes;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT pg_database_size(current_database())";
                dbSizeBytes = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
            }

            // Per-club schema sizes
            var clubs = await _platformDb.Clubs.Where(c => c.IsActive).ToListAsync();
            var schemaStats = new List<object>();

            foreach (var club in clubs)
            {
                long schemaSizeBytes;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                    SELECT COALESCE(
                        SUM(pg_total_relation_size(
                            quote_ident(schemaname) || '.' || quote_ident(tablename)
                        )), 0)
                    FROM pg_tables
                    WHERE schemaname = '{club.SchemaName}'";
                    schemaSizeBytes = (long)(await cmd.ExecuteScalarAsync() ?? 0L);
                }

                schemaStats.Add(new
                {
                    slug = club.Slug,
                    schemaName = club.SchemaName,
                    status = club.SubscriptionStatus,
                    sizeBytes = schemaSizeBytes,
                    sizeMb = Math.Round(schemaSizeBytes / 1024.0 / 1024.0, 2)
                });
            }

            return Ok(new
            {
                status = "healthy",
                checkedAt,
                database = new
                {
                    connected = canConnect,
                    connectionCount,
                    databaseSizeBytes = dbSizeBytes,
                    databaseSizeMb = Math.Round(dbSizeBytes / 1024.0 / 1024.0, 2)
                },
                clubs = new
                {
                    total = totalClubs,
                    active = activeClubs,
                    schemas = schemaStats
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new
            {
                status = "unhealthy",
                checkedAt,
                error = ex.Message
            });
        }
    }
}