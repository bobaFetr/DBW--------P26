using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260905181000_AddContentRequestTargetVersion")]
public partial class AddContentRequestTargetVersion : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "TargetVersion",
            table: "ContentChangeRequests",
            type: "character varying(64)",
            maxLength: 64,
            nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "TargetVersion",
            table: "ContentChangeRequests");
    }
}
