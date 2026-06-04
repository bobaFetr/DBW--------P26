using Microsoft.EntityFrameworkCore;

namespace MyLibrary;

public class AppDbContext : DbContext
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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Album 1 -> many Singles
        modelBuilder.Entity<Singles>()
            .HasOne(s => s.Album)
            .WithMany(a => a.Singles)
            .HasForeignKey(s => s.AlbumId)
            .OnDelete(DeleteBehavior.SetNull);

        // ConcertSong composite primary key
        modelBuilder.Entity<ConcertSong>()
            .HasKey(cs => new { cs.ConcertId, cs.SongId });

        // Concert 1 -> many ConcertSongs
        modelBuilder.Entity<ConcertSong>()
            .HasOne(cs => cs.Concert)
            .WithMany(c => c.ConcertSongs)
            .HasForeignKey(cs => cs.ConcertId)
            .OnDelete(DeleteBehavior.Cascade);

        // Single 1 -> many ConcertSongs
        modelBuilder.Entity<ConcertSong>()
            .HasOne(cs => cs.Song)
            .WithMany(s => s.ConcertSongs)
            .HasForeignKey(cs => cs.SongId)
            .OnDelete(DeleteBehavior.Cascade);

        // String length rules
        modelBuilder.Entity<Concerts>()
            .Property(c => c.Location)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Singles>()
            .Property(s => s.SongName)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Singles>()
            .Property(s => s.AvailableOnYoutube)
            .HasMaxLength(500);

        modelBuilder.Entity<Singles>()
            .Property(s => s.AvailableOnSpotify)
            .HasMaxLength(500);

        modelBuilder.Entity<Albums>()
            .Property(a => a.Title)
            .IsRequired()
            .HasMaxLength(200);

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

        modelBuilder.Entity<TimeLine>()
            .Property(t => t.Location)
            .HasMaxLength(200);

        modelBuilder.Entity<Members>()
            .Property(m => m.Name)
            .IsRequired()
            .HasMaxLength(150);

        modelBuilder.Entity<Members>()
            .Property(m => m.Instrument)
            .IsRequired()
            .HasMaxLength(100);

        modelBuilder.Entity<Members>()
            .Property(m => m.PhotoUrl)
            .HasMaxLength(500);

        modelBuilder.Entity<Gallery>()
            .Property(g => g.Title)
            .IsRequired()
            .HasMaxLength(200);

        modelBuilder.Entity<Gallery>()
            .Property(g => g.Description)
            .HasMaxLength(1000);

        modelBuilder.Entity<Gallery>()
            .Property(g => g.ImageUrl)
            .IsRequired()
            .HasMaxLength(500);
    }
}