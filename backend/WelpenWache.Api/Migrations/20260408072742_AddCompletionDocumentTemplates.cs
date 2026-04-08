using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WelpenWache.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompletionDocumentTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "Interns",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "male");

            migrationBuilder.CreateTable(
                name: "DocumentTemplates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Purpose = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Language = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    RelativeFilePath = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    UploadedUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DocumentTemplates", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_DocumentTemplates_Purpose_Language_IsActive",
                table: "DocumentTemplates",
                columns: new[] { "Purpose", "Language", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "DocumentTemplates");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "Interns");
        }
    }
}
