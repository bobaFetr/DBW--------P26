using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MyLibrary;

public class AppDbContext : IdentityDbContext<ApplicationUser>
{
    public AppDbContext(DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<Concerts> Concerts { get; set; }
    public DbSet<Singles> Singles { get; set; }
    public DbSet<Albums> Albums { get; set; }
    public DbSet<ConcertSong> ConcertSongs { get; set; }
    public DbSet<News> News { get; set; }
    public DbSet<TimeLine> TimeLines { get; set; }
    public DbSet<Members> Members { get; set; }
    public DbSet<Gallery> Gallery { get; set; }
    public DbSet<MediaUpload> MediaUploads { get; set; }
    public DbSet<MediaUploadChunk> MediaUploadChunks { get; set; }

    public DbSet<AdminProfile> AdminProfiles { get; set; }
    public DbSet<AdminRequest> AdminRequests { get; set; }
    public DbSet<ContentChangeRequest> ContentChangeRequests { get; set; }
    public DbSet<AdminAuditLog> AdminAuditLogs { get; set; }
    public DbSet<SiteSetting> SiteSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // AdminProfile: one Identity user can have one admin profile
        modelBuilder.Entity<AdminProfile>()
            .HasOne(a => a.User)
            .WithOne(u => u.AdminProfile)
            .HasForeignKey<AdminProfile>(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AdminProfile>()
            .HasIndex(a => a.UserId)
            .IsUnique();

        modelBuilder.Entity<AdminProfile>()
            .HasIndex(a => a.AdminCode)
            .IsUnique();

        modelBuilder.Entity<AdminProfile>()
            .Property(a => a.AdminCode)
            .IsRequired()
            .HasMaxLength(30);

        // AdminRequest: one user can have many requests over time
        modelBuilder.Entity<AdminRequest>()
            .HasOne(r => r.User)
            .WithMany(u => u.AdminRequests)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AdminRequest>()
            .HasIndex(r => r.RequestCode)
            .IsUnique();

        modelBuilder.Entity<AdminRequest>()
            .Property(r => r.RequestCode)
            .IsRequired()
            .HasMaxLength(30);

        modelBuilder.Entity<AdminRequest>()
            .Property(r => r.Message)
            .HasMaxLength(1000);

        modelBuilder.Entity<AdminRequest>()
            .Property(r => r.ReviewNote)
            .HasMaxLength(1000);

        // Optional: prevent multiple pending requests from same user
        modelBuilder.Entity<AdminRequest>()
            .HasIndex(r => new { r.UserId, r.Status });

        modelBuilder.Entity<AdminRequest>()
            .HasIndex(r => r.UserId)
            .HasFilter("\"Status\" = 1")
            .IsUnique();

        // ContentChangeRequest: content admins submit changes for superadmin review.
        modelBuilder.Entity<ContentChangeRequest>()
            .HasOne(r => r.RequestedByUser)
            .WithMany(u => u.ContentChangeRequests)
            .HasForeignKey(r => r.RequestedByUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ContentChangeRequest>()
            .HasIndex(r => r.ChangeCode)
            .IsUnique();

        modelBuilder.Entity<ContentChangeRequest>()
            .HasIndex(r => new { r.ContentType, r.Status });

        modelBuilder.Entity<ContentChangeRequest>()
            .HasIndex(r => new { r.RequestedByUserId, r.Status });

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.ChangeCode)
            .IsRequired()
            .HasMaxLength(30);

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.ContentType)
            .IsRequired()
            .HasMaxLength(80);

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.TargetEntityId)
            .HasMaxLength(80);

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.TargetVersion)
            .HasMaxLength(64);

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.PayloadJson)
            .IsRequired();

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.Message)
            .HasMaxLength(1000);

        modelBuilder.Entity<ContentChangeRequest>()
            .Property(r => r.ReviewNote)
            .HasMaxLength(1000);

        modelBuilder.Entity<AdminAuditLog>()
            .HasOne(log => log.AdminUser)
            .WithMany()
            .HasForeignKey(log => log.AdminUserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AdminAuditLog>()
            .HasIndex(log => new { log.AdminUserId, log.CreatedAtUtc });

        modelBuilder.Entity<AdminAuditLog>()
            .Property(log => log.Action)
            .IsRequired()
            .HasMaxLength(120);

        modelBuilder.Entity<AdminAuditLog>()
            .Property(log => log.EntityType)
            .HasMaxLength(80);

        modelBuilder.Entity<AdminAuditLog>()
            .Property(log => log.EntityId)
            .HasMaxLength(80);

        modelBuilder.Entity<SiteSetting>()
            .Property(setting => setting.Key)
            .HasMaxLength(100);

        // Your existing relations
        modelBuilder.Entity<Singles>()
            .HasOne(s => s.Album)
            .WithMany(a => a.Singles)
            .HasForeignKey(s => s.AlbumId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ConcertSong>()
            .HasKey(cs => new { cs.ConcertId, cs.SongId });

        modelBuilder.Entity<ConcertSong>()
            .HasOne(cs => cs.Concert)
            .WithMany(c => c.ConcertSongs)
            .HasForeignKey(cs => cs.ConcertId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<ConcertSong>()
            .HasOne(cs => cs.Song)
            .WithMany(s => s.ConcertSongs)
            .HasForeignKey(cs => cs.SongId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Concerts>()
            .Property(c => c.Location)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Singles>()
            .Property(s => s.SongName)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Singles>()
            .Property(s => s.Description)
            .HasColumnType("text");

        modelBuilder.Entity<Albums>()
            .Property(a => a.Title)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Albums>()
            .Property(a => a.TrackListJson)
            .HasColumnType("text");

        modelBuilder.Entity<News>()
            .Property(n => n.Title)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<News>()
            .Property(n => n.Content)
            .IsRequired();

        modelBuilder.Entity<News>()
            .Property(n => n.Author)
            .IsRequired()
            .HasMaxLength(150);

        modelBuilder.Entity<TimeLine>()
            .Property(t => t.Event)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<TimeLine>()
            .Property(t => t.Description)
            .IsRequired();

        modelBuilder.Entity<Members>()
            .Property(m => m.Name)
            .IsRequired()
            .HasMaxLength(150);

        modelBuilder.Entity<Members>()
            .Property(m => m.Instrument)
            .IsRequired()
            .HasMaxLength(100);

        modelBuilder.Entity<Gallery>()
            .Property(g => g.Title)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Gallery>()
            .Property(g => g.ImageUrl)
            .IsRequired();

        modelBuilder.Entity<MediaUpload>()
            .Property(upload => upload.FileName)
            .IsRequired()
            .HasMaxLength(260);

        modelBuilder.Entity<MediaUpload>()
            .Property(upload => upload.ContentType)
            .IsRequired()
            .HasMaxLength(120);

        modelBuilder.Entity<MediaUpload>()
            .Property(upload => upload.Kind)
            .IsRequired()
            .HasMaxLength(40);

        modelBuilder.Entity<MediaUpload>()
            .Property(upload => upload.Data)
            .IsRequired();

        modelBuilder.Entity<MediaUpload>()
            .HasIndex(upload => upload.CreatedAtUtc);

        modelBuilder.Entity<MediaUploadChunk>()
            .HasOne(chunk => chunk.MediaUpload)
            .WithMany()
            .HasForeignKey(chunk => chunk.MediaUploadId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<MediaUploadChunk>()
            .Property(chunk => chunk.Data)
            .IsRequired();

        modelBuilder.Entity<MediaUploadChunk>()
            .HasIndex(chunk => new { chunk.MediaUploadId, chunk.Sequence })
            .IsUnique();
    }
}
