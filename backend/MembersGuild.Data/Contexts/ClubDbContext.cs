using MembersGuild.Data.Models.Club;
using Microsoft.EntityFrameworkCore;

namespace MembersGuild.Data.Contexts;

/// <summary>
/// Manages a single club's schema (e.g. club_bsm.*).
/// The schema is set dynamically at request time via ClubResolutionMiddleware.
/// Every query through this context is physically scoped to one club's tables.
/// </summary>
public class ClubDbContext : DbContext
{
    private readonly string _schemaName;

    public ClubDbContext(DbContextOptions<ClubDbContext> options, string schemaName)
        : base(options)
    {
        _schemaName = schemaName;
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<CatsProfile> CatsProfiles => Set<CatsProfile>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<Session> Sessions => Set<Session>();
    public DbSet<SessionBooking> SessionBookings => Set<SessionBooking>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<CreditTransaction> CreditTransactions => Set<CreditTransaction>();
    public DbSet<ShopItem> ShopItems => Set<ShopItem>();
    public DbSet<ShopItemVariant> ShopItemVariants => Set<ShopItemVariant>();
    public DbSet<ShopOrder> ShopOrders => Set<ShopOrder>();
    public DbSet<ShopOrderItem> ShopOrderItems => Set<ShopOrderItem>();
    public DbSet<ShopCategory> ShopCategories => Set<ShopCategory>();
    public DbSet<TrainingMetric> TrainingMetrics => Set<TrainingMetric>();
    public DbSet<MemberTime> MemberTimes => Set<MemberTime>();
    public DbSet<SwimSet> SwimSets => Set<SwimSet>();
    public DbSet<TrainingVideo> TrainingVideos => Set<TrainingVideo>();
    public DbSet<ClubSetting> ClubSettings => Set<ClubSetting>();
    public DbSet<CatsFormField> CatsFormFields => Set<CatsFormField>();
    public DbSet<PaymentSettings> PaymentSettings => Set<PaymentSettings>();
    public DbSet<ClubUpdate> ClubUpdates => Set<ClubUpdate>();


    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // All club tables live in this club's schema (e.g. "club_bsm")
        modelBuilder.HasDefaultSchema(_schemaName);

        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Email).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Role).HasMaxLength(20).HasDefaultValue("member");
            entity.Property(e => e.CreditBalance).HasDefaultValue(0);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
            entity.Ignore(e => e.FullName);
        });

        modelBuilder.Entity<CatsProfile>(entity =>
        {
            entity.ToTable("cats_profiles");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.CustomFields).HasDefaultValue("{}");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.User).WithOne().HasForeignKey<CatsProfile>(e => e.UserId);
        });

        modelBuilder.Entity<Location>(entity =>
        {
            entity.ToTable("locations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<Session>(entity =>
        {
            entity.ToTable("sessions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Capacity).HasDefaultValue(25);
            entity.Property(e => e.CreditCost).HasDefaultValue(1);
            entity.Property(e => e.RegistrationCutoffHours).HasDefaultValue(24);
            entity.Property(e => e.IsCancelled).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.Location).WithMany(l => l.Sessions).HasForeignKey(e => e.LocationId);
            entity.HasOne(e => e.Coach).WithMany().HasForeignKey(e => e.CoachId);
        });

        modelBuilder.Entity<SessionBooking>(entity =>
        {
            entity.ToTable("session_bookings");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.SessionId, e.UserId }).IsUnique();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.Session).WithMany(s => s.Bookings).HasForeignKey(e => e.SessionId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
        });

        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            entity.ToTable("attendance_records");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.SessionId, e.UserId }).IsUnique();
            entity.Property(e => e.Status).HasMaxLength(20).IsRequired();
            entity.Property(e => e.CreditRefunded).HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.Session).WithMany(s => s.AttendanceRecords).HasForeignKey(e => e.SessionId);
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
        });

        modelBuilder.Entity<CreditTransaction>(entity =>
        {
            entity.ToTable("credit_transactions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.TransactionType).HasMaxLength(50).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
        });

        modelBuilder.Entity<ShopItem>(entity =>
        {
            entity.ToTable("shop_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(50).HasDefaultValue("merchandise");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.BasePrice).HasPrecision(10, 2);
            entity.HasMany(e => e.Variants).WithOne(v => v.ShopItem).HasForeignKey(v => v.ShopItemId);
        });

        modelBuilder.Entity<ShopItemVariant>(entity =>
        {
            entity.ToTable("shop_item_variants");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.StockQuantity).HasDefaultValue(0);
            entity.Property(e => e.AdditionalPrice).HasPrecision(10, 2).HasDefaultValue(0);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<ShopOrder>(entity =>
        {
            entity.ToTable("shop_orders");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasMaxLength(30).HasDefaultValue("pending");
            entity.Property(e => e.TotalAmount).HasPrecision(10, 2);
            entity.Property(e => e.TotalCredits).HasDefaultValue(0);
            entity.Property(e => e.PaymentMethod).HasMaxLength(50).HasDefaultValue("bank_transfer");
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
            entity.HasMany(e => e.Items).WithOne(i => i.Order).HasForeignKey(i => i.OrderId);
            entity.HasOne(e => e.ConfirmedByUser).WithMany()
    .HasForeignKey(e => e.PaymentConfirmedBy).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.DeliveredByUser).WithMany()
                .HasForeignKey(e => e.DeliveredBy).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(e => e.CancelledByUser).WithMany()
                .HasForeignKey(e => e.CancelledBy).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ShopOrderItem>(entity =>
        {
            entity.ToTable("shop_order_items");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Quantity).HasDefaultValue(1);
            entity.Property(e => e.UnitPrice).HasPrecision(10, 2);
            entity.Property(e => e.CreditValue).HasDefaultValue(0);
            entity.HasOne(e => e.ShopItem).WithMany().HasForeignKey(e => e.ShopItemId);
            entity.HasOne(e => e.Variant).WithMany().HasForeignKey(e => e.VariantId);
        });

        modelBuilder.Entity<ShopCategory>(entity =>
        {
            entity.ToTable("shop_categories");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Slug).IsUnique();
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Slug).HasMaxLength(50).IsRequired();
            entity.Property(e => e.IsSystem).HasDefaultValue(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
        });

        modelBuilder.Entity<TrainingMetric>(entity =>
        {
            entity.ToTable("training_metrics");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).HasMaxLength(100).IsRequired();
            entity.Property(e => e.Unit).HasMaxLength(50).IsRequired();
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.HasMany(e => e.MemberTimes).WithOne(t => t.Metric).HasForeignKey(t => t.MetricId);
        });

        modelBuilder.Entity<MemberTime>(entity =>
        {
            entity.ToTable("member_times");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.UserId, e.MetricId }).IsUnique();
            entity.Property(e => e.Value).HasMaxLength(20).IsRequired();
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
            entity.HasOne(e => e.User).WithMany().HasForeignKey(e => e.UserId);
            entity.HasOne(e => e.Metric).WithMany(m => m.MemberTimes).HasForeignKey(e => e.MetricId);
        });

        modelBuilder.Entity<SwimSet>(entity =>
        {
            entity.ToTable("swim_sets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Difficulty).HasMaxLength(20).HasDefaultValue("intermediate");
            entity.Property(e => e.Category).HasMaxLength(50).HasDefaultValue("other");
            entity.Property(e => e.IsSetOfWeek).HasDefaultValue(false);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
        });

        modelBuilder.Entity<TrainingVideo>(entity =>
        {
            entity.ToTable("training_videos");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
            entity.Property(e => e.Category).HasMaxLength(50).HasDefaultValue("drills");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
        });

        modelBuilder.Entity<ClubSetting>(entity =>
        {
            entity.ToTable("club_settings");
            entity.HasKey(e => e.Key);
            entity.Property(e => e.Key).HasMaxLength(100);
            entity.Property(e => e.Value).IsRequired();
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
        });

        modelBuilder.Entity<CatsFormField>(entity =>
        {
            entity.ToTable("cats_form_fields");
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.FieldKey).IsUnique();
            entity.Property(e => e.FieldKey).HasMaxLength(100).IsRequired();
            entity.Property(e => e.FieldLabel).HasMaxLength(200).IsRequired();
            entity.Property(e => e.FieldType).HasMaxLength(50).HasDefaultValue("text");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
        });

        modelBuilder.Entity<PaymentSettings>(entity =>
        {
            entity.ToTable("payment_settings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UpdatedAt).HasDefaultValueSql("NOW()");
        });

        modelBuilder.Entity<ClubUpdate>(entity =>
{
    entity.ToTable("club_updates");
    entity.HasKey(e => e.Id);
    entity.Property(e => e.Title).HasMaxLength(200).IsRequired();
    entity.Property(e => e.Content).HasMaxLength(1000).IsRequired();
    entity.Property(e => e.IsActive).HasDefaultValue(true);
    entity.Property(e => e.CreatedAt).HasDefaultValueSql("NOW()");
    entity.HasOne(e => e.Author).WithMany().HasForeignKey(e => e.CreatedBy)
        .OnDelete(DeleteBehavior.Restrict);
});
    }
}
