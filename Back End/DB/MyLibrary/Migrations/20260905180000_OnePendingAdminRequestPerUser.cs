using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MyLibrary.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260905180000_OnePendingAdminRequestPerUser")]
public partial class OnePendingAdminRequestPerUser : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            """
            WITH ranked AS (
                SELECT "Id", ROW_NUMBER() OVER (
                    PARTITION BY "UserId" ORDER BY "RequestedAtUtc", "Id") AS row_number
                FROM "AdminRequests"
                WHERE "Status" = 1
            )
            UPDATE "AdminRequests" AS request
            SET "Status" = 4,
                "ReviewedAtUtc" = NOW(),
                "ReviewNote" = 'Cancelled automatically while enforcing one pending request per account.'
            FROM ranked
            WHERE request."Id" = ranked."Id" AND ranked.row_number > 1;
            """);

        migrationBuilder.CreateIndex(
            name: "IX_AdminRequests_UserId",
            table: "AdminRequests",
            column: "UserId",
            unique: true,
            filter: "\"Status\" = 1");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_AdminRequests_UserId",
            table: "AdminRequests");
    }
}
