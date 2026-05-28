using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Npgsql;

namespace MembersGuild.API.Services;

public interface IClubProvisioningService
{
    Task<Club> ProvisionClubAsync(
        string slug,
        string name,
        string displayName,
        string sport = "general",
        int? packageId = null,
        int? applicationId = null,
        string? webmasterName = null,
        string? webmasterEmail = null);
    Task SeedSwimmingTemplateAsync(string schemaName);
    Task ResetDemoClubAsync(string slug);
}

public class DynamicSchemaModelCacheKeyFactory : IModelCacheKeyFactory
{
    public object Create(DbContext context, bool designTime) =>
        context is ClubDbContext clubCtx
            ? (context.GetType(), clubCtx.SchemaName, designTime)
            : (object)(context.GetType(), designTime);
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
        string slug,
        string name,
        string displayName,
        string sport = "general",
        int? packageId = null,
        int? applicationId = null,
        string? webmasterName = null,    // ← ADD
        string? webmasterEmail = null)   // ← ADD
    {
        var schemaName = $"club_{slug.ToLower().Replace("-", "_")}";

        // 1. Create schema and all tables
        await RunClubMigrationsAsync(schemaName);

        // 2. Seed default settings
        await SeedDefaultSettingsAsync(schemaName);

        // 3. Resolve features — from package if provided, else default set
        List<string> featureKeys;

        if (packageId.HasValue)
        {
            featureKeys = await _platformDb.PackageFeatures
                .Where(pf => pf.PackageId == packageId.Value)
                .Select(pf => pf.FeatureKey)
                .ToListAsync();
        }
        else
        {
            // Fallback for manual provisioning (BSM, demo clubs etc.)
            featureKeys = new List<string>
        {
            FeatureKeys.Calendar, FeatureKeys.MySessions, FeatureKeys.Attendance,
            FeatureKeys.Training, FeatureKeys.Shop, FeatureKeys.MyAccount,
            FeatureKeys.Reports, FeatureKeys.News
        };
        }

        // 4. Write platform record
        var club = new Club
        {
            Slug = slug.ToLower(),
            Name = name,
            DisplayName = displayName,
            SchemaName = schemaName,
            SubscriptionTier = "standard",
            SubscriptionStatus = "active",
            SportType = sport,
            ApplicationId = applicationId,
            OnboardedAt = DateTime.UtcNow,
            WebmasterName = webmasterName,   // ← ADD
            WebmasterEmail = webmasterEmail,  // ← ADD
        };
        _platformDb.Clubs.Add(club);
        await _platformDb.SaveChangesAsync();

        // 5. Enable features from package
        foreach (var key in featureKeys)
        {
            _platformDb.ClubFeatures.Add(new ClubFeature
            {
                ClubId = club.Id,
                FeatureKey = key,
                IsEnabled = true,
                PlatformGranted = true,
                EnabledBy = "platform"
            });
        }
        await _platformDb.SaveChangesAsync();

        // 5b. Link package to club in ClubPackages
        if (packageId.HasValue)
        {
            _platformDb.ClubPackages.Add(new ClubPackage
            {
                ClubId = club.Id,
                PackageId = packageId.Value,
                StartDate = DateTime.UtcNow,
            });
            await _platformDb.SaveChangesAsync();
        }


        // 6. Mark application as onboarded if applicable
        if (applicationId.HasValue)
        {
            var application = await _platformDb.ClubApplications.FindAsync(applicationId.Value);
            if (application != null)
            {
                application.Status = "onboarded";
                application.ReviewedAt = DateTime.UtcNow;
                await _platformDb.SaveChangesAsync();
            }
        }

        // 7. Sport-specific template
        if (sport == "swimming")
            await SeedSwimmingTemplateAsync(schemaName);

        _logger.LogInformation(
            "Provisioned club: {Slug} → schema: {Schema} | package: {PackageId}",
            slug, schemaName, packageId);

        // At end of ProvisionClubAsync, before return:
        if (!string.IsNullOrEmpty(webmasterEmail))
        {
            var tempPassword = await CreateWebmasterAccountAsync(
                schemaName, webmasterName ?? displayName, webmasterEmail);

            _logger.LogInformation(
                "Webmaster credentials — Email: {Email} TempPass: {Pass}",
                webmasterEmail, tempPassword);
        }

        return club;
    }

    private async Task<string> CreateWebmasterAccountAsync(
    string schemaName, string name, string email)
    {
        var connectionString = _config.GetConnectionString("Default")!;
        var builder = new NpgsqlConnectionStringBuilder(connectionString)
        { SearchPath = schemaName };
        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(builder.ToString()).Options;
        await using var db = new ClubDbContext(options, schemaName);

        // Generate temporary password
        var tempPassword = GenerateTempPassword();
        var hash = BCrypt.Net.BCrypt.HashPassword(tempPassword);

        // Split name
        var parts = name.Trim().Split(' ', 2);
        var firstName = parts[0];
        var lastName = parts.Length > 1 ? parts[1] : "";

        var user = new User
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email.ToLower().Trim(),
            Phone = "",
            Role = "webmaster",
            PasswordHash = hash,
            IsActive = true,
            JoinedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);
        await db.SaveChangesAsync();

        _logger.LogInformation(
            "Created webmaster account for {Email} in {Schema}", email, schemaName);

        return tempPassword;
    }

    private static string GenerateTempPassword()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
        var random = new Random();
        return new string(Enumerable.Repeat(chars, 12)
            .Select(s => s[random.Next(s.Length)]).ToArray());
    }

    private async Task RunClubMigrationsAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")
            ?? throw new InvalidOperationException("Connection string 'Default' not configured");

        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString)
            .ReplaceService<IModelCacheKeyFactory, DynamicSchemaModelCacheKeyFactory>()
            .Options;

        await using var db = new ClubDbContext(options, schemaName);

        // Make DDL idempotent before executing
        var script = db.Database.GenerateCreateScript()
            .Replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
            .Replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
            .Replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
            .Replace("CREATE SEQUENCE ", "CREATE SEQUENCE IF NOT EXISTS ");

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();

        // Create schema
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"CREATE SCHEMA IF NOT EXISTS \"{schemaName}\"";
            await cmd.ExecuteNonQueryAsync();
        }

        // Run full DDL — IF NOT EXISTS on every statement makes this safe to run multiple times
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = script;
            await cmd.ExecuteNonQueryAsync();
        }

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
    .UseNpgsql(builder.ToString())
    .ReplaceService<IModelCacheKeyFactory, DynamicSchemaModelCacheKeyFactory>()
    .Options;
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