using System.Text;
using MembersGuild.API.Extensions;
using MembersGuild.API.Middleware;
using MembersGuild.API.Services;
using MembersGuild.Data.Contexts;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Stripe;
using Resend;
using Amazon.S3;
using Amazon;

var builder = WebApplication.CreateBuilder(args);

StripeConfiguration.ApiKey = builder.Configuration["Stripe__SecretKey"];

// ── Database ──────────────────────────────────────────────────────────────────

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("Connection string 'Default' is not configured");

// Platform context — single shared context for the platform.* schema
builder.Services.AddDbContext<PlatformDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddSingleton<IAmazonS3>(_ =>
    new AmazonS3Client(
        builder.Configuration["AWS:AccessKey"],
        builder.Configuration["AWS:SecretKey"],
        RegionEndpoint.GetBySystemName(
            builder.Configuration["AWS:Region"] ?? "ap-southeast-2")
    ));

// ── Multi-tenancy ─────────────────────────────────────────────────────────────

// ClubContext is scoped — one per HTTP request, populated by ClubResolutionMiddleware
builder.Services.AddScoped<ClubContext>();
builder.Services.AddScoped<ClubDbContextFactory>();

// ── Authentication ────────────────────────────────────────────────────────────

var jwtSecret = builder.Configuration["JWT_SECRET"]
    ?? throw new InvalidOperationException("JWT_SECRET is not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero,
        };
    });

builder.Services.AddAuthorization();

// ── Services ──────────────────────────────────────────────────────────────────

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IClubProvisioningService, ClubProvisioningService>();
builder.Services.AddScoped<SeedService>();
builder.Services.AddScoped<IMemberService, MemberService>();
builder.Services.AddScoped<ICreditService, CreditService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<ShopService>();
builder.Services.AddScoped<SettingsService>();
builder.Services.AddScoped<ReportsService>();
builder.Services.AddScoped<PlatformService>();
builder.Services.AddScoped<StorageService>();
builder.Services.AddScoped<CreditAlertService>();
builder.Services.AddResend(options =>
{
    options.ApiToken = builder.Configuration["Resend:ApiKey"] ?? "";
});
builder.Services.AddScoped<EmailService>();
builder.Services.AddScoped<SquareService>();

// ── API ───────────────────────────────────────────────────────────────────────

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Required: prevents circular reference errors with EF navigation properties
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.PropertyNamingPolicy =
            System.Text.Json.JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ── CORS ──────────────────────────────────────────────────────────────────────

builder.Services.AddCors(options =>
{
    options.AddPolicy("MembersGuildPolicy", policy =>
    {
        // In production: restrict to membersguild.com.au subdomains
        // In development: allow localhost Next.js dev server
        var allowedOrigins = builder.Configuration
            .GetSection("AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:3000"];

        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// ─────────────────────────────────────────────────────────────────────────────

var app = builder.Build();

StripeConfiguration.ApiKey = app.Configuration["Stripe:SecretKey"];

// ── Startup: seed platform schema and demo club ───────────────────────────────

using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<SeedService>();
    await seeder.SeedAsync();
}

// ── Middleware pipeline (ORDER MATTERS) ───────────────────────────────────────

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("MembersGuildPolicy");

// 1. Club resolution — must be first, populates ClubContext for all subsequent middleware
app.UseMiddleware<ClubResolutionMiddleware>();

// 2. JWT authentication
app.UseAuthentication();

// 3. Club scope validation — confirms token.club_id matches resolved club
app.UseMiddleware<ClubScopeValidationMiddleware>();

// 4. Feature flags — blocks requests to disabled modules
app.UseMiddleware<FeatureFlagMiddleware>();

// 5. Authorisation
app.UseAuthorization();

app.MapControllers();

app.UseMiddleware<PlatformKeyMiddleware>();

// Health check — no club context required
app.MapGet("/api/health", () => Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow }));

app.Run();
