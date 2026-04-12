using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WelpenWache.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddInternshipTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "InternshipTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternshipTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "InternshipTemplateAssignments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InternshipTemplateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TeamId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SupervisorId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    StartOffsetDays = table.Column<int>(type: "int", nullable: false),
                    EndOffsetDays = table.Column<int>(type: "int", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InternshipTemplateAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InternshipTemplateAssignments_InternshipTemplates_InternshipTemplateId",
                        column: x => x.InternshipTemplateId,
                        principalTable: "InternshipTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_InternshipTemplateAssignments_Supervisors_SupervisorId",
                        column: x => x.SupervisorId,
                        principalTable: "Supervisors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InternshipTemplateAssignments_Teams_TeamId",
                        column: x => x.TeamId,
                        principalTable: "Teams",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InternshipTemplateAssignments_InternshipTemplateId_SortOrder",
                table: "InternshipTemplateAssignments",
                columns: new[] { "InternshipTemplateId", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_InternshipTemplateAssignments_SupervisorId",
                table: "InternshipTemplateAssignments",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_InternshipTemplateAssignments_TeamId",
                table: "InternshipTemplateAssignments",
                column: "TeamId");

            migrationBuilder.CreateIndex(
                name: "IX_InternshipTemplates_IsActive_Name",
                table: "InternshipTemplates",
                columns: new[] { "IsActive", "Name" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InternshipTemplateAssignments");

            migrationBuilder.DropTable(
                name: "InternshipTemplates");
        }
    }
}
