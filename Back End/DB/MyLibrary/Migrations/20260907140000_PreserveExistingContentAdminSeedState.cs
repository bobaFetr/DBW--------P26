using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260907140000_PreserveExistingContentAdminSeedState")]
public partial class PreserveExistingContentAdminSeedState : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            INSERT INTO "SiteSettings" ("Key", "BooleanValue")
            SELECT 'DefaultContentAdminSeeded', TRUE
            WHERE EXISTS (SELECT 1 FROM "AspNetUsers")
              AND NOT EXISTS (
                  SELECT 1
                  FROM "SiteSettings"
                  WHERE "Key" = 'DefaultContentAdminSeeded'
              );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            DELETE FROM "SiteSettings"
            WHERE "Key" = 'DefaultContentAdminSeeded';
            """);
    }
}
