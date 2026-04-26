using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MembersGuild.API.Services;

public interface IClubProvisioningService
{
    Task<Club> ProvisionClubAsync(string slug, string name, string displayName, string sport = "general");
    Task SeedSwimmingTemplateAsync(string schemaName);
    Task ResetDemoClubAsync(string slug);
}

public class ClubProvisioningService : IClubProvisioningService
{
    private readonly PlatformDbContext _platformDb;
    private readonly IConfiguration _config;
    private readonly ILogger<ClubProvisioningService> _logger;

    public ClubProvisioningService(
        PlatformDbContext platformDb,
        IConfiguration config,
        ILogger<ClubProvisioningService> logger)
    {
        _platformDb = platformDb;
        _config = config;
        _logger = logger;
    }

    public async Task<Club> ProvisionClubAsync(
        string slug, string name, string displayName, string sport = "general")
    {
        var schemaName = $"club_{slug.ToLower().Replace("-", "_")}";

        // 1. Create schema and all tables FIRST
        // If this fails, no platform record is written and the seed will retry cleanly
        await RunClubMigrationsAsync(schemaName);

        // 2. Seed default settings into the new schema
        await SeedDefaultSettingsAsync(schemaName);

        // 3. Only write the platform record once schema + tables exist
        var club = new Club
        {
            Slug = slug.ToLower(),
            Name = name,
            DisplayName = displayName,
            SchemaName = schemaName,
            SubscriptionTier = "standard",
            SubscriptionStatus = "active",
        };

        _platformDb.Clubs.Add(club);
        await _platformDb.SaveChangesAsync();

        // 4. Enable all standard features
        var features = new[]
        {
            FeatureKeys.Calendar, FeatureKeys.MySessions, FeatureKeys.Attendance,
            FeatureKeys.Training, FeatureKeys.Shop, FeatureKeys.MyAccount
        };

        foreach (var key in features)
        {
            _platformDb.ClubFeatures.Add(new ClubFeature
            {
                ClubId = club.Id,
                FeatureKey = key,
                IsEnabled = true,
                EnabledBy = "platform"
            });
        }
        await _platformDb.SaveChangesAsync();

        // 5. Sport-specific template
        if (sport == "swimming")
            await SeedSwimmingTemplateAsync(schemaName);

        _logger.LogInformation("Provisioned club: {Slug} → schema: {Schema}", slug, schemaName);

        return club;
    }

    private async Task RunClubMigrationsAsync(string schemaName)
    {
        var baseConnectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        // Step 1: Create the schema using a direct connection
        await using (var conn = new NpgsqlConnection(baseConnectionString))
        {
            await conn.OpenAsync();
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        // Step 2: Build a connection string with SearchPath set to our schema.
        // This tells EnsureCreatedAsync to create all tables inside this schema.
        var builder = new NpgsqlConnectionStringBuilder(baseConnectionString)
        {
            SearchPath = schemaName
        };

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(builder.ToString())
            .Options;

        await using var db = new ClubDbContext(options, schemaName);
        await db.Database.EnsureCreatedAsync();

        _logger.LogInformation("Schema and tables created for: {Schema}", schemaName);
    }

    private async Task SeedDefaultSettingsAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")!;

        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schemaName
        };

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(builder.ToString()).Options;
        await using var db = new ClubDbContext(options, schemaName);

        db.ClubSettings.AddRange(
            new ClubSetting { Key = ClubSettingKeys.CatsInitialCredits, Value = "3" },
            new ClubSetting { Key = ClubSettingKeys.CatsSessionLimit, Value = "3" },
            new ClubSetting { Key = ClubSettingKeys.LowCreditThreshold, Value = "2" },
            new ClubSetting { Key = ClubSettingKeys.SessionDefaultCap, Value = "25" }
        );

        db.PaymentSettings.Add(new PaymentSettings { Id = 1 });

        await db.SaveChangesAsync();
    }

    public async Task SeedSwimmingTemplateAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")!;

        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = schemaName
        };

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(builder.ToString()).Options;
        await using var db = new ClubDbContext(options, schemaName);

        var strokes = new[] { "Freestyle", "Backstroke", "Breaststroke", "Butterfly" };
        var distances = new[] { "25m", "50m", "100m", "200m", "400m", "800m" };
        var order = 1;

        foreach (var stroke in strokes)
        {
            foreach (var distance in distances)
            {
                db.TrainingMetrics.Add(new TrainingMetric
                {
                    Name = $"{distance} {stroke}",
                    Unit = MetricUnits.TimeSwim,
                    Category = stroke,
                    DisplayOrder = order++,
                    IsActive = true
                });
            }
        }

        db.CatsFormFields.AddRange(
            new CatsFormField { FieldKey = "swam_squad_before", FieldLabel = "Have you swum in a squad before?", FieldType = "boolean", DisplayOrder = 1, IsActive = true },
            new CatsFormField { FieldKey = "freestyle_100m", FieldLabel = "Approximate 100m freestyle time", FieldType = "text", DisplayOrder = 2, IsActive = true },
            new CatsFormField { FieldKey = "strokes", FieldLabel = "Strokes you swim", FieldType = "select",
                FieldOptions = "[\"Freestyle\",\"Backstroke\",\"Breaststroke\",\"Butterfly\"]", DisplayOrder = 3, IsActive = true },
            new CatsFormField { FieldKey = "health_concerns", FieldLabel = "Any health concerns we should know about?", FieldType = "boolean", DisplayOrder = 4, IsActive = true },
            new CatsFormField { FieldKey = "goals", FieldLabel = "What are your swimming goals?", FieldType = "text", DisplayOrder = 5, IsActive = false }
        );

        await db.SaveChangesAsync();
        _logger.LogInformation("Seeded swimming template for: {Schema}", schemaName);
    }

    public async Task ResetDemoClubAsync(string slug)
    {
        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug && c.IsDemo)
            ?? throw new InvalidOperationException($"No demo club found with slug: {slug}");

        var connectionString = _config.GetConnectionString("Default")!;

        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        {
            SearchPath = club.SchemaName
        };

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(builder.ToString()).Options;
        await using var db = new ClubDbContext(options, club.SchemaName);

        db.AttendanceRecords.RemoveRange(db.AttendanceRecords);
        db.SessionBookings.RemoveRange(db.SessionBookings);
        db.Sessions.RemoveRange(db.Sessions);
        db.CreditTransactions.RemoveRange(db.CreditTransactions);
        db.ShopOrderItems.RemoveRange(db.ShopOrderItems);
        db.ShopOrders.RemoveRange(db.ShopOrders);
        db.MemberTimes.RemoveRange(db.MemberTimes);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        _logger.LogInformation("Reset demo club: {Slug}", slug);
    }
}