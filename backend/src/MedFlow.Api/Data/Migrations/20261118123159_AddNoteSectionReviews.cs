using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace MedFlow.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNoteSectionReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NoteSectionReviews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NoteId = table.Column<int>(type: "integer", nullable: false),
                    Section = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    AiText = table.Column<string>(type: "text", nullable: false),
                    ReviewedBy = table.Column<int>(type: "integer", nullable: true),
                    ReviewedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NoteSectionReviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NoteSectionReviews_Notes_NoteId",
                        column: x => x.NoteId,
                        principalTable: "Notes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_NoteSectionReviews_NoteId_Section",
                table: "NoteSectionReviews",
                columns: new[] { "NoteId", "Section" },
                unique: true);

            // Existing AI SOAP drafts predate provenance tracking; their current text is the best available baseline.
            migrationBuilder.Sql("""
                INSERT INTO "NoteSectionReviews" ("NoteId", "Section", "AiText")
                SELECT n."Id", s.section, s.text
                FROM "Notes" n
                CROSS JOIN LATERAL (VALUES
                    ('subjective', n."Subjective"),
                    ('objective', n."Objective"),
                    ('assessment', n."Assessment"),
                    ('plan', n."Plan")) AS s(section, text)
                WHERE n."AiGenerated" AND n."Kind" = 'soap' AND n."Status" = 'Draft';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "NoteSectionReviews");
        }
    }
}
