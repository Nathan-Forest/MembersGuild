using System.Security.Claims;
namespace MembersGuild.API.Middleware;

/// <summary>
/// Runs after JWT authentication. Confirms that the token's club_id claim
/// matches the club resolved by ClubResolutionMiddleware.
///
/// This is the second layer of tenant isolation — the database schema is the first.
/// A valid JWT from Club A cannot be used to access Club B's API.
/// </summary>
public class ClubScopeValidationMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ClubScopeValidationMiddleware> _logger;

    public ClubScopeValidationMiddleware(RequestDelegate next, ILogger<ClubScopeValidationMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ClubContext clubContext)
    {
        // Only validate for authenticated requests
        if (!context.User.Identity?.IsAuthenticated ?? true)
        {
            await _next(context);
            return;
        }

        var tokenClubId = context.User.FindFirst("club_id")?.Value;

        // Platform admin (Nathan) can access any club
        var role = context.User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "platform_admin")
        {
            await _next(context);
            return;
        }

        if (string.IsNullOrEmpty(tokenClubId) || !int.TryParse(tokenClubId, out var clubIdFromToken))
        {
            _logger.LogWarning("JWT missing club_id claim");
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "Invalid token: missing club_id" });
            return;
        }

        if (clubIdFromToken != clubContext.ClubId)
        {
            _logger.LogWarning(
                "Cross-club token use detected. Token club_id: {TokenClub}, Request club: {RequestClub}",
                clubIdFromToken, clubContext.ClubId);
            context.Response.StatusCode = 401;
            await context.Response.WriteAsJsonAsync(new { error = "Token not valid for this club" });
            return;
        }

        await _next(context);
    }
}
