using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260906120000_AddCaRequestsPermissionSetting")]
public partial class AddCaRequestsPermissionSetting : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SiteSettings",
            columns: table => new
            {
                Key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                BooleanValue = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SiteSettings", x => x.Key);
            });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "SiteSettings");
    }
}
