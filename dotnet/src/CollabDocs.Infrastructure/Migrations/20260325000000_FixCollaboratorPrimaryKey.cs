using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CollabDocs.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FixCollaboratorPrimaryKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Drop the composite PK (DocumentId, UserId)
            migrationBuilder.DropPrimaryKey(
                name: "PK_DocumentCollaborators",
                table: "DocumentCollaborators");

            // 2. Add Id column — existing rows get a UUID via DB default
            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "DocumentCollaborators",
                type: "uuid",
                nullable: false,
                defaultValueSql: "gen_random_uuid()");

            // 3. Add new PK on Id
            migrationBuilder.AddPrimaryKey(
                name: "PK_DocumentCollaborators",
                table: "DocumentCollaborators",
                column: "Id");

            // 4. Add unique constraint on (DocumentId, UserEmail) — one invite per email per document
            migrationBuilder.CreateIndex(
                name: "IX_DocumentCollaborators_DocumentId_UserEmail",
                table: "DocumentCollaborators",
                columns: new[] { "DocumentId", "UserEmail" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_DocumentCollaborators_DocumentId_UserEmail",
                table: "DocumentCollaborators");

            migrationBuilder.DropPrimaryKey(
                name: "PK_DocumentCollaborators",
                table: "DocumentCollaborators");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "DocumentCollaborators");

            migrationBuilder.AddPrimaryKey(
                name: "PK_DocumentCollaborators",
                table: "DocumentCollaborators",
                columns: new[] { "DocumentId", "UserId" });
        }
    }
}
