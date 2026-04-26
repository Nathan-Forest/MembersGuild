using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Extensions;

/// <summary>
/// Creates a ClubDbContext scoped to the current request's club schema.
/// Injected into controllers/services that need to query club data.
///
/// Usage in a controller:
///   var db = _factory.CreateForCurrentClub();
///   var users = await db.Users.ToListAsync();
///   // All queries automatically scoped to this club's schema
/// </summary>
public class ClubDbContextFactory
{
    private readonly IDbContextFactory<ClubDbContext> _factory;
    private readonly Middleware.ClubContext _clubContext;

    public ClubDbContextFactory(
        IDbContextFactory<ClubDbContext> factory,
        Middleware.ClubContext clubContext)
    {
        _factory = factory;
        _clubContext = clubContext;
    }

    public ClubDbContext CreateForCurrentClub()
    {
        if (string.IsNullOrEmpty(_clubContext.SchemaName))
            throw new InvalidOperationException(
                "ClubContext.SchemaName is not set. ClubResolutionMiddleware must run first.");

        return new ClubDbContext(
            new DbContextOptionsBuilder<ClubDbContext>()
                .UseNpgsql(GetConnectionString())
                .Options,
            _clubContext.SchemaName
        );
    }

    private string GetConnectionString()
    {
        // Connection string is pulled from the factory's underlying options
        // This works because the factory is registered with the connection string in Program.cs
        var context = _factory.CreateDbContext();
        var cs = context.Database.GetConnectionString()
            ?? throw new InvalidOperationException("Connection string not configured");
        context.Dispose();
        return cs;
    }
}
