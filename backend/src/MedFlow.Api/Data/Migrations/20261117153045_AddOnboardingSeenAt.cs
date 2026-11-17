using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MedFlow.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOnboardingSeenAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "OnboardingSeenAt",
                table: "Users",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OnboardingSeenAt",
                table: "Users");
        }
    }
}
