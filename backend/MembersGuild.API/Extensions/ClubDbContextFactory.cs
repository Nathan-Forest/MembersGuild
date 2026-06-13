using MembersGuild.Data.Contexts;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.API.Extensions;

/// <summary>
/// Creates a ClubDbContext scoped to the current request's club schema.
/// Injected into controllers and services that need to query club data.
/// </summary>
public class ClubDbContextFactory
{
    private readonly IConfiguration _config;
    private readonly Middleware.ClubContext _clubContext;

    public ClubDbContextFactory(
        IConfiguration config,
        Middleware.ClubContext clubContext)
    {
        _config = config;
        _clubContext = clubContext;
    }

    public ClubDbContext CreateForCurrentClub()
    {
        if (string.IsNullOrEmpty(_clubContext.SchemaName))
            throw new InvalidOperationException(
                "ClubContext.SchemaName is not set. ClubResolutionMiddleware must run first.");

        var connectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = _clubContext.SchemaName
        };

        return new ClubDbContext(
            new DbContextOptionsBuilder<ClubDbContext>()
                .UseNpgsql(builder.ToString())
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory,
                    MembersGuild.API.Services.DynamicSchemaModelCacheKeyFactory>()
                .Options,
            _clubContext.SchemaName
        );
    }

    public ClubDbContext CreateForSchema(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        var builder = new Npgsql.NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schemaName
        };

        return new ClubDbContext(
            new DbContextOptionsBuilder<ClubDbContext>()
                .UseNpgsql(builder.ToString())
                .ReplaceService<Microsoft.EntityFrameworkCore.Infrastructure.IModelCacheKeyFactory,
                    MembersGuild.API.Services.DynamicSchemaModelCacheKeyFactory>()
                .Options,
            schemaName
        );
    }
}