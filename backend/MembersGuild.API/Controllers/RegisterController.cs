using MembersGuild.Data.Contexts;
using MembersGuild.Data.Models.Platform;
using MembersGuild.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Stripe;

namespace MembersGuild.API.Controllers;

[ApiController]
[Route("api/register")]
public class RegisterController : ControllerBase
{
    private readonly PlatformDbContext _platformDb;
    private readonly IConfiguration _config;
    private readonly EmailService _email;

    public RegisterController(
        PlatformDbContext platformDb,
        IConfiguration config,
        EmailService email)
    {
        _platformDb = platformDb;
        _config = config;
        _email = email;
    }

    // POST /api/register/create-intent
    // Public — no auth required
    [HttpPost("create-intent")]
    public async Task<IActionResult> CreateIntent([FromBody] CreateApplicationRequest req)
    {
        // Validate package exists
        var package = await _platformDb.Packages.FindAsync(req.PackageId);
        if (package == null)
            return BadRequest(new { error = "Invalid package selected." });

        // Create Stripe customer
        var customerService = new CustomerService();
        var customer = await customerService.CreateAsync(new CustomerCreateOptions
        {
            Email = req.ContactEmail,
            Name = req.ContactName,
            Metadata = new Dictionary<string, string>
            {
                ["club_name"] = req.ClubName,
                ["package_name"] = package.DisplayName ?? package.Name,
            }
        });

        // Create PaymentIntent for $199 setup fee
        // Create PaymentIntent for $199 setup fee
        var piService = new PaymentIntentService();
        var pi = await piService.CreateAsync(new PaymentIntentCreateOptions
        {
            Amount = 19900, // $199.00 AUD in cents
            Currency = "aud",
            Customer = customer.Id,
            AutomaticPaymentMethods = new PaymentIntentAutomaticPaymentMethodsOptions
            {
                Enabled = true
            },
            SetupFutureUsage = "off_session",  // ← ADD — saves card for recurring billing
            Description = $"MembersGuild Setup Fee — {req.ClubName}",
            Metadata = new Dictionary<string, string>
            {
                ["application_type"] = "club_registration",
                ["club_name"] = req.ClubName,
                ["contact_email"] = req.ContactEmail,
                ["package_id"] = req.PackageId.ToString(),
            }
        });

        // Save application
        var application = new ClubApplication
        {
            Status = "pending_payment",
            ClubName = req.ClubName,
            DisplayName = req.DisplayName,
            SportType = req.SportType,
            EstimatedMembers = req.EstimatedMembers,
            Website = req.Website,
            ContactName = req.ContactName,
            ContactEmail = req.ContactEmail,
            ContactPhone = req.ContactPhone,
            PackageId = req.PackageId,
            StripeCustomerId = customer.Id,
            StripePaymentIntentId = pi.Id,
            SubmittedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _platformDb.ClubApplications.Add(application);
        await _platformDb.SaveChangesAsync();

        return Ok(new
        {
            clientSecret = pi.ClientSecret,
            applicationId = application.Id,
            amount = 199.00,
            packageName = package.DisplayName ?? package.Name,
            monthlyPrice = package.Price,
        });
    }

    // GET /api/register/packages
    // Public — returns active packages for sign-up page
    [HttpGet("packages")]
    public async Task<IActionResult> GetPackages()
    {
        var packages = await _platformDb.Packages
            .Include(p => p.Features)
            .Where(p => p.IsActive && p.Id <= 3) // Small, Medium, Large only
            .OrderBy(p => p.SortOrder)
            .Select(p => new
            {
                id = p.Id,
                name = p.DisplayName ?? p.Name,
                price = p.Price,
                memberCap = p.MemberCap,
                featureKeys = p.Features.Select(f => f.FeatureKey).ToList(),
            })
            .ToListAsync();

        return Ok(packages);
    }
}

public record CreateApplicationRequest(
    string ClubName,
    string DisplayName,
    string SportType,
    int? EstimatedMembers,
    string? Website,
    string ContactName,
    string ContactEmail,
    string? ContactPhone,
    int PackageId
);