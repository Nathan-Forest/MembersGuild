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
}