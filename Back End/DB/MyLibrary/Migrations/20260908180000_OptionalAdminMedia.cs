using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace MyLibrary.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260908180000_OptionalAdminMedia")]
public class OptionalAdminMedia : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<string>(
            name: "PhotoUrl", table: "Members", type: "text", nullable: true,
            oldClrType: typeof(string), oldType: "text");
        migrationBuilder.Sql("""
            UPDATE "Members" SET "PhotoUrl" = NULL WHERE "PhotoUrl" ~ '^\s*$';
            UPDATE "Gallery" SET "ImageUrl" = NULL WHERE "ImageUrl" ~ '^\s*$';
            UPDATE "Albums" SET "PhotoUrl" = NULL WHERE "PhotoUrl" ~ '^\s*$';
            UPDATE "Singles" SET "PhotoUrl" = NULL WHERE "PhotoUrl" ~ '^\s*$';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""UPDATE "Members" SET "PhotoUrl" = '' WHERE "PhotoUrl" IS NULL;""");
        migrationBuilder.AlterColumn<string>(
            name: "PhotoUrl", table: "Members", type: "text", nullable: false,
            oldClrType: typeof(string), oldType: "text", oldNullable: true);
    }
}
