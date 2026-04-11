using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WelpenWache.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAuditLogs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EntityLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Action = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    ActorUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ActorUserName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OccurredUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ChangeCount = table.Column<int>(type: "int", nullable: false),
                    BeforeJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AfterJson = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ChangesJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_ActorUserId_OccurredUtc",
                table: "AuditLogs",
                columns: new[] { "ActorUserId", "OccurredUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_EntityType_EntityId_OccurredUtc",
                table: "AuditLogs",
                columns: new[] { "EntityType", "EntityId", "OccurredUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_OccurredUtc",
                table: "AuditLogs",
                column: "OccurredUtc");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditLogs");
        }
    }
}
