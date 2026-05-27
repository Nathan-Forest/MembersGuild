using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MembersGuild.API.DTOs.Platform;
using MembersGuild.API.Services;
using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;
using Stripe;
using System.IO;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("platform")]
public class PlatformController : ControllerBase
{
    private readonly PlatformDbContext _platformDb;
    private readonly PlatformService _platform;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _config;
    private readonly EmailService _email;  // ← ADD

    public PlatformController(
        PlatformDbContext platformDb,
        PlatformService platform,
        IServiceScopeFactory scopeFactory,
        IConfiguration config,
        EmailService email)  // ← ADD
    {
        _platformDb = platformDb;
        _platform = platform;
        _scopeFactory = scopeFactory;
        _config = config;
        _email = email;  // ← ADD
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
                TierCap: await _platform.GetMemberCapAsync(club.Id),
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
                .GetRequiredService<IClubProvisioningService>();
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
                // Drill into inner exceptions to get the real Postgres error
                jobToUpdate.Error = ex.InnerException?.InnerException?.Message
                    ?? ex.InnerException?.Message
                    ?? ex.Message;
                await platformDb.SaveChangesAsync();

                // Also log it so we can see it in docker logs
                Console.WriteLine($"[PROVISION FAILED] {ex}");
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

    // GET /platform/clubs/{slug}
    [HttpGet("clubs/{slug}")]
    public async Task<IActionResult> GetClub(string slug)
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        var memberCount = await _platform.GetMemberCountAsync(club.SchemaName);
        var sessionCount = await _platform.GetSessionCountAsync(club.SchemaName);

        return Ok(new ClubSummaryResponse(
            Id: club.Id,
            Slug: club.Slug,
            Name: club.Name,
            DisplayName: club.DisplayName,
            Tier: club.SubscriptionTier,
            Status: club.SubscriptionStatus,
            MemberCount: memberCount,
            TierCap: await _platform.GetMemberCapAsync(club.Id),
            SessionCount: sessionCount,
            CreatedAt: club.CreatedAt,
            LastActivityAt: club.UpdatedAt
        ));
    }

    // PUT /platform/clubs/{slug}/status
    [HttpPut("clubs/{slug}/status")]
    public async Task<IActionResult> UpdateClubStatus(string slug, [FromBody] UpdateClubStatusRequest req)
    {
        var validStatuses = new[] { "active", "suspended", "cancelled" };
        if (!validStatuses.Contains(req.Status))
            return BadRequest(new { error = "Status must be active, suspended or cancelled" });

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        var previous = club.SubscriptionStatus;
        club.SubscriptionStatus = req.Status;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: $"club.status_changed",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { from = previous, to = req.Status });

        return Ok(new { slug, status = req.Status });
    }

    // PUT /platform/clubs/{slug}/tier
    [HttpPut("clubs/{slug}/tier")]
    public async Task<IActionResult> UpdateClubTier(string slug, [FromBody] UpdateClubTierRequest req)
    {
        var validTiers = new[] { "small", "medium", "large" };
        if (!validTiers.Contains(req.Tier))
            return BadRequest(new { error = "Tier must be small, medium or large" });

        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        var previous = club.SubscriptionTier;
        club.SubscriptionTier = req.Tier;
        club.MonthlyAmount = req.MonthlyAmount;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "club.tier_changed",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { from = previous, to = req.Tier, monthlyAmount = req.MonthlyAmount });

        return Ok(new { slug, tier = req.Tier, monthlyAmount = req.MonthlyAmount });
    }

    // DELETE /platform/clubs/{slug}
    [HttpDelete("clubs/{slug}")]
    public async Task<IActionResult> DeleteClub(string slug)
    {
        var club = await _platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == slug);
        if (club is null) return NotFound(new { error = $"Club '{slug}' not found" });

        // Soft delete — mark inactive rather than destroy data
        club.IsActive = false;
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "club.deleted",
            actor: "platform_admin",
            clubSlug: slug,
            clubId: club.Id,
            metadata: new { name = club.Name });

        return Ok(new { slug, deleted = true });
    }

    // GET /platform/health
    [HttpGet("health")]
    public async Task<IActionResult> GetHealth()
    {
        var checkedAt = DateTime.UtcNow;

        try
        {
            var canConnect = await _platformDb.Database.CanConnectAsync();
            var totalClubs = await _platformDb.Clubs.CountAsync();
            var activeClubs = await _platformDb.Clubs.CountAsync(c => c.IsActive);

            var conn = _platformDb.Database.GetDbConnection();
            if (conn.State != System.Data.ConnectionState.Open)
                await conn.OpenAsync();

            // Active DB connections
            int connectionCount;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText =
                    "SELECT count(*)::int FROM pg_stat_activity WHERE datname = current_database()";
                connectionCount = Convert.ToInt32(await cmd.ExecuteScalarAsync() ?? 0);
            }

            // Total database size
            long dbSizeBytes;
            using (var cmd = conn.CreateCommand())
            {
                cmd.CommandText = "SELECT pg_database_size(current_database())";
                dbSizeBytes = Convert.ToInt64(await cmd.ExecuteScalarAsync() ?? 0L);
            }

            // Per-club schema sizes
            var clubs = await _platformDb.Clubs.Where(c => c.IsActive).ToListAsync();
            var schemaStats = new List<object>();

            foreach (var club in clubs)
            {
                long schemaSizeBytes;
                using (var cmd = conn.CreateCommand())
                {
                    cmd.CommandText = $@"
                    SELECT COALESCE(
                        SUM(pg_total_relation_size(
                            quote_ident(schemaname) || '.' || quote_ident(tablename)
                        )), 0)
                    FROM pg_tables
                    WHERE schemaname = '{club.SchemaName}'";
                    schemaSizeBytes = Convert.ToInt64(await cmd.ExecuteScalarAsync() ?? 0L);
                }

                schemaStats.Add(new
                {
                    slug = club.Slug,
                    schemaName = club.SchemaName,
                    status = club.SubscriptionStatus,
                    sizeBytes = schemaSizeBytes,
                    sizeMb = Math.Round(schemaSizeBytes / 1024.0 / 1024.0, 2)
                });
            }

            return Ok(new
            {
                status = "healthy",
                checkedAt,
                database = new
                {
                    connected = canConnect,
                    connectionCount,
                    databaseSizeBytes = dbSizeBytes,
                    databaseSizeMb = Math.Round(dbSizeBytes / 1024.0 / 1024.0, 2)
                },
                clubs = new
                {
                    total = totalClubs,
                    active = activeClubs,
                    schemas = schemaStats
                }
            });
        }
        catch (Exception ex)
        {
            return StatusCode(503, new
            {
                status = "unhealthy",
                checkedAt,
                error = ex.Message
            });
        }
    }

    [HttpPost("stripe/webhook")]
    public async Task<IActionResult> StripeWebhook()
    {
        string json;
        using (var reader = new StreamReader(Request.Body))
            json = await reader.ReadToEndAsync();

        try
        {
            var stripeEvent = EventUtility.ConstructEvent(
                json,
                Request.Headers["Stripe-Signature"],
                _config["Stripe:WebhookSecret"],
                throwOnApiVersionMismatch: false
            );

            switch (stripeEvent.Type)
            {
                case "payment_intent.succeeded":
                    await HandleSetupFeeSucceeded(stripeEvent);
                    break;
                case "customer.subscription.updated":
                    await HandleSubscriptionUpdated(stripeEvent);
                    break;
                case "invoice.payment_succeeded":
                    await HandlePaymentSucceeded(stripeEvent);
                    break;
                case "invoice.payment_failed":
                    await HandlePaymentFailed(stripeEvent);
                    break;
            }

            return Ok();  // ← INSIDE the try block
        }
        catch (StripeException ex)  // ← PART OF the try-catch
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task HandleSetupFeeSucceeded(Event stripeEvent)
    {
        var pi = stripeEvent.Data.Object as PaymentIntent;
        if (pi is null) return;

        // Only handle club registration intents
        if (pi.Metadata.GetValueOrDefault("application_type") != "club_registration") return;

        var application = await _platformDb.ClubApplications
            .FirstOrDefaultAsync(a => a.StripePaymentIntentId == pi.Id);
        if (application is null) return;

        application.Status = "pending_onboard";
        application.SetupFeePaidAt = DateTime.UtcNow;
        application.UpdatedAt = DateTime.UtcNow;

        _platformDb.PaymentEvents.Add(new PaymentEvent
        {
            EventType = "setup_paid",
            AmountAud = pi.Amount / 100m,
            StripeEventId = stripeEvent.Id,
            Notes = $"Setup fee paid — {application.ClubName}",
        });

        await _platformDb.SaveChangesAsync();

        // Email webmaster
        await _email.SendGenericAsync(
            to: application.ContactEmail,
            subject: "Payment confirmed — MembersGuild onboarding within 24 hours",
            body: $"Hi {application.ContactName},\n\nYour payment of $199 has been confirmed.\n\nWe'll have {application.DisplayName}'s portal live within 24 hours. You'll receive your login details by email.\n\nKind regards,\nThe MembersGuild Team",
            clubName: "MembersGuild",
            clubSlug: "membersguild",
            primaryColor: "#1a56db"
        );

        // Email Nathan
        await _email.SendGenericAsync(
            to: "hello@membersguild.com.au",
            subject: $"🎉 New club registration — {application.ClubName}",
            body: $"New paying customer!\n\nClub: {application.ClubName}\nContact: {application.ContactName} ({application.ContactEmail})\nPackage: ID {application.PackageId}\nPhone: {application.ContactPhone ?? "not provided"}\n\nReady to onboard in the admin panel.",
            clubName: "MembersGuild",
            clubSlug: "membersguild",
            primaryColor: "#1a56db"
        );
    }

    private async Task HandleSubscriptionUpdated(Event stripeEvent)
    {
        var sub = stripeEvent.Data.Object as Subscription;
        if (sub is null) return;

        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.StripeSubId == sub.Id);
        if (club is null) return;

        var previousStatus = club.SubscriptionStatus;
        club.StripeSubId = sub.Id;
        club.SubscriptionStatus = sub.Status switch
        {
            "active" => "active",
            "past_due" => "active",
            "canceled" => "cancelled",
            "unpaid" => "suspended",
            _ => club.SubscriptionStatus
        };
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "stripe.subscription_updated",
            actor: "system",
            clubSlug: club.Slug,
            clubId: club.Id,
            metadata: new { stripeStatus = sub.Status, from = previousStatus, to = club.SubscriptionStatus });
    }

    private async Task HandlePaymentSucceeded(Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Invoice;
        if (invoice is null) return;

        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.StripeCustomerId == invoice.CustomerId);
        if (club is null) return;

        club.FailedPaymentCount = 0;
        club.SubscriptionStatus = "active";
        club.UpdatedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "stripe.payment_succeeded",
            actor: "system",
            clubSlug: club.Slug,
            clubId: club.Id,
            metadata: new
            {
                invoiceId = invoice.Id,
                amount = invoice.AmountPaid / 100.0,
                currency = invoice.Currency
            });
    }

    private async Task HandlePaymentFailed(Event stripeEvent)
    {
        var invoice = stripeEvent.Data.Object as Invoice;
        if (invoice is null) return;

        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.StripeCustomerId == invoice.CustomerId);
        if (club is null) return;

        club.FailedPaymentCount++;
        club.UpdatedAt = DateTime.UtcNow;

        // Suspend after 3 consecutive failures
        if (club.FailedPaymentCount >= 3)
            club.SubscriptionStatus = "suspended";

        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync(
            action: "stripe.payment_failed",
            actor: "system",
            clubSlug: club.Slug,
            clubId: club.Id,
            metadata: new
            {
                invoiceId = invoice.Id,
                failedCount = club.FailedPaymentCount,
                suspended = club.FailedPaymentCount >= 3,
                nextRetry = invoice.NextPaymentAttempt
            });
    }

    // ── Packages ──────────────────────────────────────────────────────────────────

    // GET /platform/packages
    [HttpGet("packages")]
    public async Task<IActionResult> GetPackages()
    {
        var packages = await _platformDb.Packages
            .Include(p => p.Features)
            .OrderBy(p => p.SortOrder)
            .Select(p => new PackageResponse(
    p.Id, p.Name, p.Type, p.Price, p.MemberCap,
    p.Description, p.IsActive, p.SortOrder,
    p.Features.Select(f => f.FeatureKey).ToList()))
            .ToListAsync();

        return Ok(packages);
    }

    // POST /platform/packages
    [HttpPost("packages")]
    public async Task<IActionResult> CreatePackage([FromBody] CreatePackageRequest req)
    {
        var maxOrder = await _platformDb.Packages.MaxAsync(p => (int?)p.SortOrder) ?? 0;

        var package = new Package
        {
            Name = req.Name.Trim(),
            Type = req.Type,
            Price = req.Price,
            Description = req.Description?.Trim(),
            IsActive = true,
            SortOrder = maxOrder + 1,
        };

        _platformDb.Packages.Add(package);
        await _platformDb.SaveChangesAsync();

        foreach (var key in req.FeatureKeys)
        {
            _platformDb.PackageFeatures.Add(new PackageFeature
            {
                PackageId = package.Id,
                FeatureKey = key,
            });
        }
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync("package.created", "platform_admin",
            metadata: new { package.Name, package.Type, package.Price });

        return Ok(new PackageResponse(
            package.Id, package.Name, package.Type, package.Price, package.MemberCap,
            package.Description, package.IsActive, package.SortOrder,
            req.FeatureKeys));
    }

    // PUT /platform/packages/{id}
    [HttpPut("packages/{id}")]
    public async Task<IActionResult> UpdatePackage(int id, [FromBody] UpdatePackageRequest req)
    {
        var package = await _platformDb.Packages
            .Include(p => p.Features)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (package is null) return NotFound();

        package.Name = req.Name.Trim();
        package.Price = req.Price;
        package.Description = req.Description?.Trim();
        package.IsActive = req.IsActive;

        // Replace features
        _platformDb.PackageFeatures.RemoveRange(package.Features);
        foreach (var key in req.FeatureKeys)
        {
            _platformDb.PackageFeatures.Add(new PackageFeature
            {
                PackageId = package.Id,
                FeatureKey = key,
            });
        }
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync("package.updated", "platform_admin",
            metadata: new { package.Name, package.Price });

        return Ok(new PackageResponse(
            package.Id, package.Name, package.Type, package.Price, package.MemberCap,
            package.Description, package.IsActive, package.SortOrder,
            req.FeatureKeys));
    }

    // ── Club Billing ──────────────────────────────────────────────────────────────

    // GET /platform/clubs/{slug}/billing
    [HttpGet("clubs/{slug}/billing")]
    public async Task<IActionResult> GetClubBilling(string slug)
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

        if (club is null) return NotFound();

        var clubPackages = await _platformDb.ClubPackages
            .Include(cp => cp.Package)
                .ThenInclude(p => p!.Features)
            .Where(cp => cp.ClubId == club.Id && cp.EndDate == null)
            .ToListAsync();

        var packages = clubPackages
            .Where(cp => cp.Package != null)
            .Select(cp => new PackageResponse(
                cp.Package!.Id, cp.Package.Name, cp.Package.Type, cp.Package.Price, cp.Package.MemberCap,
                cp.Package.Description, cp.Package.IsActive,
                cp.Package.SortOrder,
                cp.Package.Features.Select(f => f.FeatureKey).ToList()))
            .ToList();

        var gross = packages.Sum(p => p.Price);
        var net = club.DiscountType == "free_forever" ? 0 :
                      club.DiscountType == "percentage" ? gross * (1 - club.DiscountValue / 100) :
                      gross;

        return Ok(new ClubBillingResponse(
            club.Id, club.Slug, club.DisplayName,
            club.DiscountType, club.DiscountValue, club.DiscountNote,
            gross, net, packages));
    }

    // PUT /platform/clubs/{slug}/billing
    [HttpPut("clubs/{slug}/billing")]
    public async Task<IActionResult> UpdateClubBilling(
        string slug, [FromBody] UpdateClubBillingRequest req)
    {
        var club = await _platformDb.Clubs
            .FirstOrDefaultAsync(c => c.Slug == slug && c.IsActive);

        if (club is null) return NotFound();

        // Update discount
        club.DiscountType = req.DiscountType;
        club.DiscountValue = req.DiscountValue;
        club.DiscountNote = req.DiscountNote;
        club.UpdatedAt = DateTime.UtcNow;

        // Replace packages — delete existing, insert new
        var existing = await _platformDb.ClubPackages
            .Where(cp => cp.ClubId == club.Id)
            .ToListAsync();
        _platformDb.ClubPackages.RemoveRange(existing);
        await _platformDb.SaveChangesAsync();

        foreach (var packageId in req.PackageIds)
        {
            _platformDb.ClubPackages.Add(new ClubPackage
            {
                ClubId = club.Id,
                PackageId = packageId,
                StartDate = DateTime.UtcNow,
            });
        }
        await _platformDb.SaveChangesAsync();

        // Sync ClubFeatures.PlatformGranted — UPDATE only, never INSERT
        // (provisioning creates all feature rows when club is first set up)
        // Sync ClubFeatures.PlatformGranted from new packages
        var grantedKeys = await _platformDb.ClubPackages
            .Include(cp => cp.Package)
                .ThenInclude(p => p!.Features)
            .Where(cp => cp.ClubId == club.Id && cp.Package != null)
            .SelectMany(cp => cp.Package!.Features.Select(f => f.FeatureKey))
            .Distinct()
            .ToListAsync();

        var clubFeatures = await _platformDb.ClubFeatures
            .Where(f => f.ClubId == club.Id)
            .ToListAsync();

        var allKeys = new[]
        {
        "calendar", "my_sessions", "attendance",
        "training", "shop", "my_account", "news"
    };

        foreach (var key in allKeys)
        {
            var granted = grantedKeys.Contains(key);
            var feature = clubFeatures.FirstOrDefault(f => f.FeatureKey == key);

            if (feature is not null)
            {
                feature.PlatformGranted = granted;
                if (!granted) feature.IsEnabled = false;
            }
            else
            {
                _platformDb.ClubFeatures.Add(new ClubFeature
                {
                    ClubId = club.Id,
                    FeatureKey = key,
                    PlatformGranted = granted,
                    IsEnabled = granted,
                    EnabledBy = "platform",
                });
            }
        }

        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync("club.billing_updated", "platform_admin",
            clubSlug: slug, clubId: club.Id,
            metadata: new { discountType = req.DiscountType, discountValue = req.DiscountValue, packageIds = req.PackageIds });

        return Ok(new { success = true });
    }

    // ── Revenue Summary ───────────────────────────────────────────────────────────

    // GET /platform/revenue/summary
    [HttpGet("revenue/summary")]
    public async Task<IActionResult> GetRevenueSummary()
    {
        var clubs = await _platformDb.Clubs
            .Where(c => c.IsActive)
            .ToListAsync();

        var clubPackages = await _platformDb.ClubPackages
            .Include(cp => cp.Package)
            .Where(cp => cp.Package != null)
            .ToListAsync();

        decimal totalMrr = 0;
        int freeClubs = 0;
        var packageGroups = new Dictionary<string, (int Count, decimal Mrr)>();

        foreach (var club in clubs)
        {
            var myPackages = clubPackages.Where(cp => cp.ClubId == club.Id).ToList();
            var gross = myPackages.Sum(cp => cp.Package!.Price);
            var net = club.DiscountType == "free_forever" ? 0 :
                             club.DiscountType == "percentage"
                                 ? gross * (1 - club.DiscountValue / 100)
                                 : gross;

            totalMrr += net;
            if (net == 0) freeClubs++;

            foreach (var cp in myPackages)
            {
                var name = cp.Package!.Name;
                if (!packageGroups.ContainsKey(name))
                    packageGroups[name] = (0, 0);
                var pkgNet = club.DiscountType == "free_forever" ? 0 : cp.Package.Price;
                packageGroups[name] = (packageGroups[name].Count + 1, packageGroups[name].Mrr + pkgNet);
            }
        }

        var breakdown = packageGroups
            .Select(g => new TierBreakdown(g.Key, g.Value.Count, g.Value.Mrr))
            .OrderByDescending(t => t.Mrr)
            .ToList();

        return Ok(new RevenueSummaryResponse(
            totalMrr, clubs.Count, freeClubs, breakdown));
    }

    // ── Applications ──────────────────────────────────────────────────────────────

    // GET /platform/applications
    [HttpGet("applications")]
    public async Task<IActionResult> GetApplications([FromQuery] string? status = null)
    {
        var query = _platformDb.ClubApplications
            .Include(a => a.Package)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
            query = query.Where(a => a.Status == status);

        var applications = await query
            .OrderByDescending(a => a.SubmittedAt)
            .Select(a => new
            {
                id = a.Id,
                status = a.Status,
                clubName = a.ClubName,
                displayName = a.DisplayName,
                sportType = a.SportType,
                contactName = a.ContactName,
                contactEmail = a.ContactEmail,
                contactPhone = a.ContactPhone,
                estimatedMembers = a.EstimatedMembers,
                packageId = a.PackageId,
                packageName = a.Package != null ? a.Package.DisplayName ?? a.Package.Name : null,
                packagePrice = a.Package != null ? a.Package.Price : (decimal?)null,
                setupFeePaidAt = a.SetupFeePaidAt,
                submittedAt = a.SubmittedAt,
                notes = a.Notes,
            })
            .ToListAsync();

        return Ok(applications);
    }

    // POST /platform/applications/{id}/onboard
    [HttpPost("applications/{id}/onboard")]
    public async Task<IActionResult> OnboardApplication(
        int id, [FromBody] OnboardApplicationRequest req)
    {
        var application = await _platformDb.ClubApplications
            .Include(a => a.Package)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (application is null) return NotFound();
        if (application.Status == "onboarded")
            return BadRequest(new { error = "Already onboarded." });

        var slugExists = await _platformDb.Clubs.AnyAsync(c => c.Slug == req.Slug);
        if (slugExists)
            return BadRequest(new { error = $"Slug '{req.Slug}' is already taken." });

        _ = Task.Run(async () =>
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var provisioningService = scope.ServiceProvider.GetRequiredService<IClubProvisioningService>();
            var platformDb = scope.ServiceProvider.GetRequiredService<PlatformDbContext>();

            try
            {
                await provisioningService.ProvisionClubAsync(
                    slug: req.Slug,
    name: application.ClubName,
    displayName: application.DisplayName,
    sport: application.SportType,
    packageId: application.PackageId,
    applicationId: application.Id,
    webmasterName: application.ContactName,
    webmasterEmail: application.ContactEmail
                );

                var club = await platformDb.Clubs.FirstOrDefaultAsync(c => c.Slug == req.Slug);
                if (club != null)
                {
                    club.WebmasterName = application.ContactName;
                    club.WebmasterEmail = application.ContactEmail;
                    club.WebmasterPhone = application.ContactPhone;
                    club.SportType = application.SportType;
                    club.OnboardedAt = DateTime.UtcNow;
                    await platformDb.SaveChangesAsync();
                }

                var app = await platformDb.ClubApplications.FindAsync(id);
                if (app != null)
                {
                    app.Status = "onboarded";
                    app.ReviewedAt = DateTime.UtcNow;
                    app.Notes = req.Notes;
                    await platformDb.SaveChangesAsync();
                }
            }
            catch (Exception ex)
            {
                var app = await platformDb.ClubApplications.FindAsync(id);
                if (app != null)
                {
                    app.Notes = $"Provisioning failed: {ex.Message}";
                    await platformDb.SaveChangesAsync();
                }
            }
        });

        return Accepted(new { slug = req.Slug, status = "provisioning" });
    }

    // POST /platform/applications/{id}/reject
    [HttpPost("applications/{id}/reject")]
    public async Task<IActionResult> RejectApplication(
        int id, [FromBody] RejectApplicationRequest req)
    {
        var application = await _platformDb.ClubApplications.FindAsync(id);
        if (application is null) return NotFound();

        application.Status = "rejected";
        application.Notes = req.Notes;
        application.ReviewedAt = DateTime.UtcNow;
        await _platformDb.SaveChangesAsync();

        await _platform.AuditAsync("application.rejected", "platform_admin",
            metadata: new { applicationId = id, notes = req.Notes });

        return Ok(new { success = true });
    }
}