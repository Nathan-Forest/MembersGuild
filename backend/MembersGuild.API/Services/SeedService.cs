using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Club;
using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;
using MembersGuild.API.DTOs.Shop;

namespace MembersGuild.API.Services;

/// <summary>
/// Runs once on startup. Creates The Forest Den Sports Club demo if it doesn't
/// already exist. Completely idempotent — safe to run on every container start.
///
/// The Forest Den Sports Club is the demo/marketing club used to showcase
/// MembersGuild features. Its slug is "forestden" and it lives at
/// forestden.membersguild.com.au (or forestden.theforestden.dev in Phase 1).
/// </summary>
public class SeedService
{
    private readonly PlatformDbContext _platformDb;
    private readonly IClubProvisioningService _provisioning;
    private readonly IConfiguration _config;
    private readonly ILogger<SeedService> _logger;

    public SeedService(
        PlatformDbContext platformDb,
        IClubProvisioningService provisioning,
        IConfiguration config,
        ILogger<SeedService> logger)
    {
        _platformDb = platformDb;
        _provisioning = provisioning;
        _config = config;
        _logger = logger;
    }

    public async Task SeedAsync()
    {
        await EnsurePlatformSchemaAsync();
        await EnsureForestDenClubAsync();
    }

    // ── Platform schema ───────────────────────────────────────────────────────

    private async Task EnsurePlatformSchemaAsync()
    {
        _logger.LogInformation("Ensuring platform schema exists...");
        await _platformDb.Database.EnsureCreatedAsync();
        _logger.LogInformation("Platform schema ready.");
    }

    // ── Forest Den Sports Club ────────────────────────────────────────────────

    private async Task EnsureForestDenClubAsync()
    {
        const string slug = "forestden";

        var exists = await _platformDb.Clubs.AnyAsync(c => c.Slug == slug);
        if (exists)
        {
            _logger.LogInformation("Forest Den Sports Club already exists — skipping seed.");
            return;
        }

        _logger.LogInformation("Seeding The Forest Den Sports Club...");

        // Provision the club (creates schema, tables, default settings)
        var club = await _provisioning.ProvisionClubAsync(
            slug: slug,
            name: "The Forest Den Sports Club",
            displayName: "Forest Den SC",
            sport: "general"   // not swimming — we'll add custom metrics below
        );

        // Mark as demo club
        club.IsDemo = true;
        club.PrimaryColor = "#1a56db";
        club.SecondaryColor = "#1e429f";
        await _platformDb.SaveChangesAsync();

        // Seed realistic demo data into the club schema
        await SeedForestDenDataAsync(club.SchemaName);

        _logger.LogInformation("The Forest Den Sports Club seeded successfully.");
    }

    private async Task SeedForestDenDataAsync(string schemaName)
    {
        var connectionString = _config.GetConnectionString("Default")!;
        var options = new DbContextOptionsBuilder<ClubDbContext>()
            .UseNpgsql(connectionString).Options;
        await using var db = new ClubDbContext(options, schemaName);

        // ── Training metrics (sport-agnostic demo — mix of activities) ───────

        var metrics = new[]
        {
            new TrainingMetric { Name = "50m Freestyle",     Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 1 },
            new TrainingMetric { Name = "100m Freestyle",    Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 2 },
            new TrainingMetric { Name = "200m Freestyle",    Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 3 },
            new TrainingMetric { Name = "50m Backstroke",    Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 4 },
            new TrainingMetric { Name = "100m Backstroke",   Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 5 },
            new TrainingMetric { Name = "50m Breaststroke",  Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 6 },
            new TrainingMetric { Name = "100m Breaststroke", Unit = MetricUnits.TimeSwim,  Category = "Swimming",  DisplayOrder = 7 },
            new TrainingMetric { Name = "5km Run",           Unit = MetricUnits.TimeRun,   Category = "Running",   DisplayOrder = 8 },
            new TrainingMetric { Name = "10km Run",          Unit = MetricUnits.TimeRun,   Category = "Running",   DisplayOrder = 9 },
            new TrainingMetric { Name = "1km Row",           Unit = MetricUnits.TimeRun,   Category = "Rowing",    DisplayOrder = 10 },
            new TrainingMetric { Name = "Back Squat",        Unit = MetricUnits.Kilograms, Category = "Strength",  DisplayOrder = 11 },
            new TrainingMetric { Name = "Bench Press",       Unit = MetricUnits.Kilograms, Category = "Strength",  DisplayOrder = 12 },
        };
        db.TrainingMetrics.AddRange(metrics);
        await db.SaveChangesAsync();

        // ── Users ─────────────────────────────────────────────────────────────

        var webmaster = new User
        {
            Email = "webmaster@forestden.demo",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ForestDen2026"),
            FirstName = "Alex",
            LastName = "Morgan",
            Phone = "0412 345 678",
            Role = Roles.Webmaster,
            CreditBalance = 20,
            MemberNumber = "FD-001",
            IsActive = true,
        };

        var coach = new User
        {
            Email = "coach@forestden.demo",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ForestDen2026"),
            FirstName = "Jamie",
            LastName = "Rivers",
            Phone = "0423 456 789",
            Role = Roles.Coach,
            CreditBalance = 0,
            MemberNumber = "FD-002",
            IsActive = true,
        };

        var finance = new User
        {
            Email = "finance@forestden.demo",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("ForestDen2026"),
            FirstName = "Sam",
            LastName = "Chen",
            Phone = "0434 567 890",
            Role = Roles.Finance,
            CreditBalance = 0,
            MemberNumber = "FD-003",
            IsActive = true,
        };

        // Standard members with credits
        var members = new[]
        {
            new User { Email = "sarah.wade@email.com",  FirstName = "Sarah",  LastName = "Wade",    Phone = "0445 111 222", Role = Roles.Member, CreditBalance = 8,  MemberNumber = "FD-004" },
            new User { Email = "tom.hunter@email.com",  FirstName = "Tom",    LastName = "Hunter",  Phone = "0445 222 333", Role = Roles.Member, CreditBalance = 3,  MemberNumber = "FD-005" },
            new User { Email = "priya.nair@email.com",  FirstName = "Priya",  LastName = "Nair",    Phone = "0445 333 444", Role = Roles.Member, CreditBalance = 12, MemberNumber = "FD-006" },
            new User { Email = "ben.cross@email.com",   FirstName = "Ben",    LastName = "Cross",   Phone = "0445 444 555", Role = Roles.Member, CreditBalance = 1,  MemberNumber = "FD-007" },
            new User { Email = "lucy.park@email.com",   FirstName = "Lucy",   LastName = "Park",    Phone = "0445 555 666", Role = Roles.Member, CreditBalance = 5,  MemberNumber = "FD-008" },
            new User { Email = "marcus.lee@email.com",  FirstName = "Marcus", LastName = "Lee",     Phone = "0445 666 777", Role = Roles.Member, CreditBalance = 0,  MemberNumber = "FD-009" },
        };

        // CATS trial member
        var catsUser = new User
        {
            Email = "trial.member@email.com",
            FirstName = "Jordan",
            LastName = "Taylor",
            Phone = "0456 789 012",
            Role = Roles.Cats,
            CreditBalance = 2,
            MemberNumber = null,
        };

        var demoPassword = BCrypt.Net.BCrypt.HashPassword("ForestDen2026");
        foreach (var m in members) { m.PasswordHash = demoPassword; m.IsActive = true; }
        catsUser.PasswordHash = demoPassword;
        catsUser.IsActive = true;

        db.Users.AddRange(webmaster, coach, finance);
        db.Users.AddRange(members);
        db.Users.Add(catsUser);
        await db.SaveChangesAsync();

        // ── Location ──────────────────────────────────────────────────────────

        var location = new Location
        {
            Name = "Forest Den Aquatic Centre",
            Address = "1 Lakeside Drive, Forest Den QLD 4000",
            Phone = "07 3123 4567",
            Capacity = 30,
            IsActive = true,
        };
        db.Locations.Add(location);
        await db.SaveChangesAsync();

        // ── Sessions (upcoming) ───────────────────────────────────────────────

        var now = DateTime.UtcNow;
        var thisMonday = now.Date.AddDays(-(int)now.DayOfWeek + 1);

        var sessions = new List<Session>();
        for (int week = 0; week < 4; week++)
        {
            // Monday morning squad
            sessions.Add(new Session
            {
                Title = "Morning Squad",
                Description = "General fitness session open to all members. Warm-up, main set, cool down.",
                LocationId = location.Id,
                CoachId = coach.Id,
                StartTime = thisMonday.AddDays(week * 7).AddHours(6),
                EndTime = thisMonday.AddDays(week * 7).AddHours(7.5),
                Capacity = 25,
                CreditCost = 1,
                RegistrationCutoffHours = 24,
                CreatedBy = webmaster.Id,
                IsRecurring = true,
            });

            // Wednesday technique
            sessions.Add(new Session
            {
                Title = "Technique & Drills",
                Description = "Focus on stroke technique and efficiency. Suitable for all levels.",
                LocationId = location.Id,
                CoachId = coach.Id,
                StartTime = thisMonday.AddDays(week * 7 + 2).AddHours(18),
                EndTime = thisMonday.AddDays(week * 7 + 2).AddHours(19.5),
                Capacity = 20,
                CreditCost = 1,
                RegistrationCutoffHours = 24,
                CreatedBy = webmaster.Id,
                IsRecurring = true,
            });

            // Saturday open water
            sessions.Add(new Session
            {
                Title = "Saturday Open Session",
                Description = "Relaxed open session. Bring a friend. Coffee afterwards.",
                LocationId = location.Id,
                CoachId = coach.Id,
                StartTime = thisMonday.AddDays(week * 7 + 5).AddHours(7.5),
                EndTime = thisMonday.AddDays(week * 7 + 5).AddHours(9),
                Capacity = 30,
                CreditCost = 1,
                RegistrationCutoffHours = 12,
                CreatedBy = webmaster.Id,
                IsRecurring = true,
            });
        }
        db.Sessions.AddRange(sessions);
        await db.SaveChangesAsync();

        // ── Book some members into upcoming sessions ───────────────────────────

        var upcomingSessions = sessions.Where(s => s.StartTime > now).Take(6).ToList();
        var bookableMembers = new[] { members[0], members[1], members[2], members[4] };

        foreach (var session in upcomingSessions.Take(3))
        {
            foreach (var member in bookableMembers)
            {
                db.SessionBookings.Add(new SessionBooking
                {
                    SessionId = session.Id,
                    UserId = member.Id,
                });
            }
        }
        await db.SaveChangesAsync();

        // ── Past attendance records (makes My Sessions look real) ─────────────

        var pastSessions = sessions.Where(s => s.StartTime < now).ToList();
        foreach (var session in pastSessions)
        {
            foreach (var member in members.Take(4))
            {
                db.AttendanceRecords.Add(new AttendanceRecord
                {
                    SessionId = session.Id,
                    UserId = member.Id,
                    Status = AttendanceStatus.Attended,
                    MarkedBy = coach.Id,
                    CreditRefunded = false,
                });
            }
            // One NSBA for realism
            db.AttendanceRecords.Add(new AttendanceRecord
            {
                SessionId = session.Id,
                UserId = members[4].Id,
                Status = AttendanceStatus.Nsba,
                MarkedBy = coach.Id,
                CreditRefunded = true,
                Notes = "Advised 2 hours before session",
            });
        }
        await db.SaveChangesAsync();

        // ── Credit transactions (so transaction history looks real) ───────────

        var allMembers = new[] { members[0], members[1], members[2], members[3], members[4], members[5] };
        foreach (var member in allMembers)
        {
            // Initial credit purchase
            db.CreditTransactions.Add(new CreditTransaction
            {
                UserId = member.Id,
                Amount = 10,
                BalanceAfter = 10,
                TransactionType = TransactionTypes.PaymentConfirmed,
                Notes = "10 credit pack — bank transfer confirmed",
                CreatedBy = finance.Id,
                CreatedAt = now.AddDays(-30),
            });

            // Session deductions
            for (int i = 0; i < (10 - member.CreditBalance); i++)
            {
                db.CreditTransactions.Add(new CreditTransaction
                {
                    UserId = member.Id,
                    Amount = -1,
                    BalanceAfter = 10 - (i + 1),
                    TransactionType = TransactionTypes.SessionBooking,
                    ReferenceType = "session",
                    Notes = "Session booking",
                    CreatedAt = now.AddDays(-25 + i * 3),
                });
            }
        }

        // CATS initial grant
        db.CreditTransactions.Add(new CreditTransaction
        {
            UserId = catsUser.Id,
            Amount = 3,
            BalanceAfter = 3,
            TransactionType = TransactionTypes.CatsInitial,
            Notes = "CATS initial credit grant",
            CreatedAt = now.AddDays(-5),
        });
        db.CreditTransactions.Add(new CreditTransaction
        {
            UserId = catsUser.Id,
            Amount = -1,
            BalanceAfter = 2,
            TransactionType = TransactionTypes.SessionBooking,
            ReferenceType = "session",
            Notes = "Session booking",
            CreatedAt = now.AddDays(-3),
        });
        await db.SaveChangesAsync();

        // ── Shop items ────────────────────────────────────────────────────────

        var creditPack5 = new ShopItem
        {
            Name = "5 Credit Pack",
            Description = "Purchase 5 session credits — use them anytime.",
            Category = "credits",
            BasePrice = 75.00m,
            CreditValue = 5,
            IsActive = true,
            DisplayOrder = 1,
        };

        var creditPack10 = new ShopItem
        {
            Name = "10 Credit Pack",
            Description = "Purchase 10 session credits — best value, save $25.",
            Category = "credits",
            BasePrice = 125.00m,
            CreditValue = 10,
            IsActive = true,
            DisplayOrder = 2,
        };

        var tshirt = new ShopItem
        {
            Name = "Forest Den Club Shirt",
            Description = "Official club shirt. Moisture-wicking, UPF 50+.",
            Category = "merchandise",
            BasePrice = 45.00m,
            CreditValue = null,
            IsActive = true,
            DisplayOrder = 3,
        };

        db.ShopItems.AddRange(creditPack5, creditPack10, tshirt);
        await db.SaveChangesAsync();

        // T-shirt variants
        db.ShopItemVariants.AddRange(
            new ShopItemVariant { ShopItemId = tshirt.Id, Name = "Small",      StockQuantity = 5,  AdditionalPrice = 0 },
            new ShopItemVariant { ShopItemId = tshirt.Id, Name = "Medium",     StockQuantity = 8,  AdditionalPrice = 0 },
            new ShopItemVariant { ShopItemId = tshirt.Id, Name = "Large",      StockQuantity = 6,  AdditionalPrice = 0 },
            new ShopItemVariant { ShopItemId = tshirt.Id, Name = "X-Large",   StockQuantity = 3,  AdditionalPrice = 0 },
            new ShopItemVariant { ShopItemId = tshirt.Id, Name = "XX-Large",  StockQuantity = 2,  AdditionalPrice = 0 }
        );

        // A completed order for realism
        var order = new ShopOrder
        {
            UserId = members[0].Id,
            Status = OrderStatus.Delivered,
            TotalAmount = 125.00m,
            TotalCredits = 10,
            PaymentMethod = "bank_transfer",
            PaymentReference = "BSB: 123-456 | Acc: 78901234",
            PaymentReceiptNumber = "RCP-20260401-001",
            PaymentConfirmedAt = now.AddDays(-28),
            PaymentConfirmedBy = finance.Id,
            DeliveredAt = now.AddDays(-20),
            DeliveredBy = webmaster.Id,
        };
        db.ShopOrders.Add(order);
        await db.SaveChangesAsync();

        db.ShopOrderItems.Add(new ShopOrderItem
        {
            OrderId = order.Id,
            ShopItemId = creditPack10.Id,
            Quantity = 1,
            UnitPrice = 125.00m,
            CreditValue = 10,
            ItemNameSnapshot = "10 Credit Pack",
        });

        // Pending order to show the workflow
        var pendingOrder = new ShopOrder
        {
            UserId = members[3].Id,
            Status = OrderStatus.Pending,
            TotalAmount = 75.00m,
            TotalCredits = 5,
            PaymentMethod = "bank_transfer",
            PaymentReference = "BSB: 123-456 | Acc: 78901234 | Ref: Marcus Lee",
        };
        db.ShopOrders.Add(pendingOrder);
        await db.SaveChangesAsync();

        db.ShopOrderItems.Add(new ShopOrderItem
        {
            OrderId = pendingOrder.Id,
            ShopItemId = creditPack5.Id,
            Quantity = 1,
            UnitPrice = 75.00m,
            CreditValue = 5,
            ItemNameSnapshot = "5 Credit Pack",
        });

        await db.SaveChangesAsync();

        // ── Swim sets ─────────────────────────────────────────────────────────

        db.SwimSets.AddRange(
            new SwimSet
            {
                Title = "Endurance Builder — 3km",
                Description = "Steady aerobic set focused on maintaining pace over distance.",
                Difficulty = "intermediate",
                Category = "endurance",
                Content = "400m warm-up (easy)\n" +
                          "4 × 200m @ 70% effort (30s rest)\n" +
                          "4 × 100m @ 75% effort (20s rest)\n" +
                          "8 × 50m @ 80% effort (15s rest)\n" +
                          "200m cool-down (easy)\n" +
                          "Total: ~3000m",
                TotalDistance = 3000,
                IsSetOfWeek = true,
                IsActive = true,
                CreatedBy = coach.Id,
            },
            new SwimSet
            {
                Title = "Sprint Sharpener — 2km",
                Description = "High-intensity short intervals. Max effort on the fast 25s.",
                Difficulty = "advanced",
                Category = "sprint",
                Content = "300m warm-up\n" +
                          "6 × 50m fast (30s rest)\n" +
                          "4 × 25m MAX (45s rest)\n" +
                          "6 × 50m @ 85% (20s rest)\n" +
                          "4 × 25m MAX (45s rest)\n" +
                          "200m easy cool-down\n" +
                          "Total: ~2000m",
                TotalDistance = 2000,
                IsSetOfWeek = false,
                IsActive = true,
                CreatedBy = coach.Id,
            },
            new SwimSet
            {
                Title = "Technique Focus — 2km",
                Description = "Drill-heavy set to reinforce good habits. Quality over quantity.",
                Difficulty = "beginner",
                Category = "technique",
                Content = "200m easy warm-up\n" +
                          "4 × 50m catch-up drill (focus on entry)\n" +
                          "4 × 50m finger-drag drill\n" +
                          "4 × 100m with pull buoy (focus on body rotation)\n" +
                          "4 × 50m kicking with board\n" +
                          "200m easy cool-down\n" +
                          "Total: ~2000m",
                TotalDistance = 2000,
                IsSetOfWeek = false,
                IsActive = true,
                CreatedBy = coach.Id,
            }
        );

        // ── Training videos ───────────────────────────────────────────────────

        db.TrainingVideos.AddRange(
            new TrainingVideo
            {
                Title = "Freestyle Catch Technique",
                Description = "Coach Shinji Takeuchi breaks down the perfect freestyle catch and pull phase.",
                Category = "drills",
                YoutubeUrl = "https://www.youtube.com/watch?v=dBpMsN6sYFc",
                IsActive = true,
                CreatedBy = coach.Id,
            },
            new TrainingVideo
            {
                Title = "Dryland Shoulder Warm-Up",
                Description = "Essential shoulder mobility and activation before getting in the water.",
                Category = "strength",
                YoutubeUrl = "https://www.youtube.com/watch?v=example2",
                IsActive = true,
                CreatedBy = coach.Id,
            },
            new TrainingVideo
            {
                Title = "Post-Session Cool-Down Stretches",
                Description = "10-minute routine targeting lats, shoulders, chest and hip flexors.",
                Category = "stretches",
                YoutubeUrl = "https://www.youtube.com/watch?v=example3",
                IsActive = true,
                CreatedBy = coach.Id,
            }
        );

        // ── Member personal bests ─────────────────────────────────────────────

        var pbMetrics = await db.TrainingMetrics.ToDictionaryAsync(m => m.Name, m => m.Id);

        var pbs = new[]
        {
            // Sarah Wade
            (members[0].Id, "50m Freestyle",  "00:29.45"),
            (members[0].Id, "100m Freestyle", "01:05.20"),
            (members[0].Id, "200m Freestyle", "02:22.80"),
            // Tom Hunter
            (members[1].Id, "50m Freestyle",  "00:31.10"),
            (members[1].Id, "100m Freestyle", "01:08.50"),
            // Priya Nair
            (members[2].Id, "50m Freestyle",  "00:28.90"),
            (members[2].Id, "100m Freestyle", "01:03.40"),
            (members[2].Id, "50m Backstroke", "00:34.20"),
            // Lucy Park
            (members[4].Id, "50m Freestyle",  "00:30.55"),
            (members[4].Id, "5km Run",         "25:40.00"),
        };

        foreach (var (userId, metricName, value) in pbs)
        {
            if (pbMetrics.TryGetValue(metricName, out var metricId))
            {
                db.MemberTimes.Add(new MemberTime
                {
                    UserId = userId,
                    MetricId = metricId,
                    Value = value,
                    UpdatedBy = coach.Id,
                    UpdatedAt = DateTime.UtcNow.AddDays(-7),
                });
            }
        }

        // ── Payment settings ──────────────────────────────────────────────────

        var existing = await db.PaymentSettings.FindAsync(1);
        if (existing is not null)
        {
            existing.BankName = "Commonwealth Bank";
            existing.AccountName = "The Forest Den Sports Club";
            existing.Bsb = "123-456";
            existing.AccountNumber = "78901234";
            existing.PaymentInstructions =
                "Transfer to the account above using your full name as the reference. " +
                "Screenshot your receipt and include it in the order notes. " +
                "Credits are released once payment is confirmed by our Finance team (usually within 24 hours).";
        }

        await db.SaveChangesAsync();
    }
}
