using MembersGuild.Data.Models.Platform;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.Data.Contexts;

/// <summary>
/// Manages the platform.* schema — club registry, feature flags, audit log.
/// This is Nathan's view across all clubs.
/// </summary>
public class PlatformDbContext : DbContext
{
    public PlatformDbContext(DbContextOptions<PlatformDbContext> options) : base(options) { }

    public DbSet<Club> Clubs => Set<Club>();
    public DbSet<ClubFeature> ClubFeatures => Set<ClubFeature>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // All platform tables live in the "platform" schema
        modelBuilder.HasDefaultSchema("platform");

        modelBuilder.Entity<Club>(entity =>
        {
            entity.ToTable("clubs");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Slug).HasMaxLength(50).IsRequired();
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.DisplayName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.PrimaryColor).HasMaxLength(7).HasDefaultValue("#1a56db");
            entity.Property(e => e.SecondaryColor).HasMaxLength(7).HasDefaultValue("#1e429f");
            entity.Property(e => e.SubscriptionTier).HasMaxLength(20).HasDefaultValue("standard");
            entity.Property(e => e.SubscriptionStatus).HasMaxLength(20).HasDefaultValue("active");
            entity.Property(e => e.SchemaName).HasMaxLength(100).IsRequired();
            entity.Property(e => e.MemberCap).HasDefaultValue(50);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");

            entity.HasMany(e => e.Features)
                  .WithOne(f => f.Club)
                  .HasForeignKey(f => f.ClubId);
        });

        modelBuilder.Entity<ClubFeature>(entity =>
        {
            entity.ToTable("club_features");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.ClubId, e.FeatureKey }).IsUnique();
            entity.Property(e => e.FeatureKey).HasMaxLength(100).IsRequired();
            entity.Property(e => e.EnabledBy).HasMaxLength(50).HasDefaultValue("platform");
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_log");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Action).HasMaxLength(100).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
        });
    }
}
