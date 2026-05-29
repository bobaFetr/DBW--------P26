using Microsoft.EntityFrameworkCore;
//using MyLibrary.Data.Models;

namespace MyLibrary.Data
{
    public class AppDbContext : DbContext
    {
        //this cass is for the table relationships and the connection to the database
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        // public DbSet<> Books { get; set; }
        // public DbSet<> Authors { get; set; }
        // public DbSet<> Categories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure entity relationships and constraints here if needed
        }
    }
}
