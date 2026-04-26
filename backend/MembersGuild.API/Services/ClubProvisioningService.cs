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

        // 1. Create platform record
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

        // 2. Enable all standard features by default
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

        // 3. Create schema and all tables
        await RunClubMigrationsAsync(schemaName);

        // 5. Seed default settings
        await SeedDefaultSettingsAsync(schemaName);

        // 6. Seed sport-specific template if applicable
        if (sport == "swimming")
            await SeedSwimmingTemplateAsync(schemaName);

        _logger.LogInformation("Provisioned club: {Slug} → schema: {Schema}", slug, schemaName);

        return club;
    }

    private async Task CreateSchemaAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();

        // Safe schema name — only alphanumeric and underscores allowed
        if (!System.Text.RegularExpressions.Regex.IsMatch(schemaName, @"^[a-z_][a-z0-9_]*$"))
            throw new ArgumentException($"Invalid schema name: {schemaName}");

        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS {schemaName}";
        await cmd.ExecuteNonQueryAsync();

        _logger.LogInformation("Created schema: {Schema}", schemaName);
    }

    private async Task RunClubMigrationsAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString)
            .Options;

        await using var db = new ClubDbContext(options, schemaName);

        // EnsureCreatedAsync only works when no tables exist yet.
        // We drop and recreate to guarantee a clean slate.
        await db.Database.ExecuteSqlRawAsync($"CREATE SCHEMA IF NOT EXISTS {schemaName}");

        // Get all table creation SQL and execute it
        var script = db.Database.GenerateCreateScript();
        await db.Database.ExecuteSqlRawAsync(script);

        _logger.LogInformation("Applied schema for: {Schema}", schemaName);
    }

    private async Task SeedDefaultSettingsAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")!;
        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString).Options;
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
        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString).Options;
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

        // Default CATS form fields for swimming
        db.CatsFormFields.AddRange(
            new CatsFormField { FieldKey = "swam_squad_before", FieldLabel = "Have you swum in a squad before?", FieldType = "boolean", DisplayOrder = 1, IsActive = true },
            new CatsFormField { FieldKey = "freestyle_100m", FieldLabel = "Approximate 100m freestyle time", FieldType = "text", DisplayOrder = 2, IsActive = true },
            new CatsFormField
            {
                FieldKey = "strokes",
                FieldLabel = "Strokes you swim",
                FieldType = "select",
                FieldOptions = "[\"Freestyle\",\"Backstroke\",\"Breaststroke\",\"Butterfly\"]",
                DisplayOrder = 3,
                IsActive = true
            },
            new CatsFormField { FieldKey = "health_concerns", FieldLabel = "Any health concerns we should know about?", FieldType = "boolean", DisplayOrder = 4, IsActive = true },
            new CatsFormField { FieldKey = "goals", FieldLabel = "What are your swimming goals?", FieldType = "text", DisplayOrder = 5, IsActive = false }
        );

        await db.SaveChangesAsync();
        _logger.LogInformation("Seeded swimming template for: {Schema}", schemaName);
    }

    /// <summary>
    /// Resets demo club data to a clean seeded state.
    /// Called from super-admin after a demo session.
    /// </summary>
    public async Task ResetDemoClubAsync(string slug)
    {
        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug && c.IsDemo)
            ?? throw new InvalidOperationException($"No demo club found with slug: {slug}");

        var connectionString = _config.GetConnectionString("Default")!;
        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString).Options;
        await using var db = new ClubDbContext(options, club.SchemaName);

        // Wipe all data tables (preserves settings and metrics)
        db.AttendanceRecords.RemoveRange(db.AttendanceRecords);
        db.SessionBookings.RemoveRange(db.SessionBookings);
        db.Sessions.RemoveRange(db.Sessions);
        db.CreditTransactions.RemoveRange(db.CreditTransactions);
        db.ShopOrderItems.RemoveRange(db.ShopOrderItems);
        db.ShopOrders.RemoveRange(db.ShopOrders);
        db.MemberTimes.RemoveRange(db.MemberTimes);
        db.Users.RemoveRange(db.Users);
        await db.SaveChangesAsync();

        // Re-seed demo data
        await SeedDemoDataAsync(db, club.SchemaName);

        _logger.LogInformation("Reset demo club: {Slug}", slug);
    }

    private static async Task SeedDemoDataAsync(ClubDbContext db, string schemaName)
    {
        // Webmaster account
        db.Users.Add(new User
        {
            Email = "webmaster@forestden.demo",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo1234!"),
            FirstName = "Alex",
            LastName = "Webmaster",
            Role = Roles.Webmaster,
            CreditBalance = 10,
            IsActive = true
        });

        // A few member accounts
        var members = new[]
        {
            ("sarah.jones@email.com", "Sarah", "Jones", Roles.Member, 8),
            ("james.smith@email.com", "James", "Smith", Roles.Member, 3),
            ("coach.ron@email.com",   "Ron",   "Rhodes", Roles.Coach,  0),
            ("fin.chen@email.com",    "Fiona", "Chen",   Roles.Finance, 0),
        };

        foreach (var (email, first, last, role, credits) in members)
        {
            db.Users.Add(new User
            {
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Demo1234!"),
                FirstName = first,
                LastName = last,
                Role = role,
                CreditBalance = credits,
                IsActive = true
            });
        }

        await db.SaveChangesAsync();
    }
}
