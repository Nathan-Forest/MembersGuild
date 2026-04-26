using MembersGuild.Data.Models.Platform;

namespace MembersGuild.API.Middleware;

/// <summary>
/// Blocks requests to feature endpoints that the club hasn't enabled.
/// Must run after ClubResolutionMiddleware (needs populated ClubContext).
///
/// Route prefix → feature key mapping.
/// If a club hasn't enabled "shop", any request to /api/shop/* returns 403.
/// </summary>
public class FeatureFlagMiddleware
{
    private readonly RequestDelegate _next;

    // Maps route prefixes to feature keys
    private static readonly Dictionary<string, string> FeatureRoutes = new()
    {
        ["/api/sessions"]    = FeatureKeys.Calendar,
        ["/api/calendar"]    = FeatureKeys.Calendar,
        ["/api/attendance"]  = FeatureKeys.Attendance,
        ["/api/training"]    = FeatureKeys.Training,
        ["/api/shop"]        = FeatureKeys.Shop,
        ["/api/credits"]     = FeatureKeys.MyAccount,
    };

    public FeatureFlagMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context, ClubContext clubContext)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // Public endpoints and member management are always accessible
        if (path.StartsWith("/api/public") || path.StartsWith("/api/members")
            || path.StartsWith("/api/auth") || path.StartsWith("/api/locations")
            || path.StartsWith("/api/settings") || path.StartsWith("/api/health")
            || path.StartsWith("/api/platform"))
        {
            await _next(context);
            return;
        }

        foreach (var (routePrefix, featureKey) in FeatureRoutes)
        {
            if (path.StartsWith(routePrefix) && !clubContext.HasFeature(featureKey))
            {
                context.Response.StatusCode = 403;
                await context.Response.WriteAsJsonAsync(new
                {
                    error = $"Feature '{featureKey}' is not enabled for this club"
                });
                return;
            }
        }

        await _next(context);
    }
}
