using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Middleware;

/// <summary>
/// First middleware in the pipeline. Reads X-Club-Slug from the request header,
/// looks up the club in platform.clubs, and populates ClubContext for this request.
///
/// Public endpoints (/api/public/*) still resolve the club — they just don't require auth.
/// If no slug header is present and the endpoint needs a club, returns 400.
/// </summary>
public class ClubResolutionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ClubResolutionMiddleware> _logger;

    public ClubResolutionMiddleware(RequestDelegate next, ILogger<ClubResolutionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, PlatformDbContext platformDb, ClubContext clubContext)
    {
        // Health check and platform-level endpoints don't need club resolution
        var path = context.Request.Path.Value ?? string.Empty;
        if (path.StartsWith("/api/health") || path.StartsWith("/api/platform"))
        {
            await _next(context);
            return;
        }

        var slug = context.Request.Headers["X-Club-Slug"].FirstOrDefault();

        if (string.IsNullOrWhiteSpace(slug))
        {
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new { error = "X-Club-Slug header is required" });
            return;
        }

        var club = await platformDb.Clubs
            .Include(c => c.Features)
            .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

        if (club is null)
        {
            _logger.LogWarning("Club not found for slug: {Slug}", slug);
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new { error = $"Club '{slug}' not found" });
            return;
        }

        if (club.SubscriptionStatus == "suspended")
        {
            context.Response.StatusCode = 402;
            await context.Response.WriteAsJsonAsync(new { error = "Club subscription is suspended" });
            return;
        }

        // Populate the scoped ClubContext for this request
        clubContext.ClubId = club.Id;
        clubContext.Slug = club.Slug;
        clubContext.SchemaName = club.SchemaName;
        clubContext.DisplayName = club.DisplayName;
        clubContext.LogoUrl = club.LogoUrl;
        clubContext.PrimaryColor = club.PrimaryColor;
        clubContext.SecondaryColor = club.SecondaryColor;
        clubContext.SubscriptionStatus = club.SubscriptionStatus;
        clubContext.IsDemo = club.IsDemo;
        clubContext.EnabledFeatures = club.Features
            .Where(f => f.IsEnabled)
            .Select(f => f.FeatureKey)
            .ToHashSet();

        _logger.LogDebug("Resolved club: {Slug} → schema: {Schema}", slug, club.SchemaName);

        await _next(context);
    }
}
