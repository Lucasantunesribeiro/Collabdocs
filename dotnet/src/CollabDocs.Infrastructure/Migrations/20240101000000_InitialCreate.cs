using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CollabDocs.Infrastructure.Migrations;

public partial class InitialCreate : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Users",
            columns: table => new
            {
                Id = table.Column<string>(type: "text", nullable: false),
                Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                Provider = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Users", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "Documents",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "uuid", nullable: false),
                OwnerId = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                Title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                Content = table.Column<string>(type: "text", nullable: false),
                Visibility = table.Column<string>(type: "text", nullable: false),
                Version = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Documents", x => x.Id);
            });

        migrationBuilder.CreateTable(
            name: "DocumentCollaborators",
            columns: table => new
            {
                DocumentId = table.Column<Guid>(type: "uuid", nullable: false),
                UserId = table.Column<string>(type: "text", nullable: false),
                UserEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                Permission = table.Column<string>(type: "text", nullable: false),
                GrantedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_DocumentCollaborators", x => new { x.DocumentId, x.UserId });
            });

        migrationBuilder.CreateIndex(
            name: "IX_Documents_OwnerId",
            table: "Documents",
            column: "OwnerId");

        migrationBuilder.CreateIndex(
            name: "IX_Documents_UpdatedAt",
            table: "Documents",
            column: "UpdatedAt");

        migrationBuilder.CreateIndex(
            name: "IX_DocumentCollaborators_DocumentId",
            table: "DocumentCollaborators",
            column: "DocumentId");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "DocumentCollaborators");
        migrationBuilder.DropTable(name: "Documents");
        migrationBuilder.DropTable(name: "Users");
    }
}
