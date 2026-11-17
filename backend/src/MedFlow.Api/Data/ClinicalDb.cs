using Microsoft.EntityFrameworkCore;
namespace MedFlow.Api.Data;

public sealed class User
{
    public int Id
    {
        get; set;
    }
    public string Email { get; set; } = "";
    public string Name { get; set; } = "";
    public string Role { get; set; } = "";
    public string PasswordHash { get; set; } = "";
}
public sealed class Patient
{
    public int Id
    {
        get; set;
    }
    public string Identifier { get; set; } = "";
    public string Name { get; set; } = "";
    public string ThaiName { get; set; } = "";
    public int Age
    {
        get; set;
    }
    public string Gender { get; set; } = "";
    public string BloodType { get; set; } = "";
    public string History { get; set; } = "";
    public string Allergies { get; set; } = "";
    public string Category { get; set; } = "";
    public string Color { get; set; } = "";
    public List<ClinicalNote> Notes { get; set; } = [];
}
public sealed class ClinicalNote
{
    public int Id
    {
        get; set;
    }
    public int PatientId
    {
        get; set;
    }
    public string? SeedKey
    {
        get; set;
    }
    public string Subjective { get; set; } = "";
    public string Objective { get; set; } = "";
    public string Assessment { get; set; } = "";
    public string Plan { get; set; } = "";
    public string Status { get; set; } = "Draft";
    public bool AiGenerated
    {
        get; set;
    }
    public string? AiMode
    {
        get; set;
    }
    public string? Summary
    {
        get; set;
    }
    public string? MissingInformation
    {
        get; set;
    }
    public string? Uncertainty
    {
        get; set;
    }
    public string Kind { get; set; } = "soap";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? ConfirmedBy
    {
        get; set;
    }
    public DateTime? ConfirmedAt
    {
        get; set;
    }
    public int Version { get; set; } = 1;
}
public sealed class AuditEvent
{
    public int Id
    {
        get; set;
    }
    public DateTime At { get; set; } = DateTime.UtcNow;
    public int? UserId
    {
        get; set;
    }
    public string Action { get; set; } = "";
    public int? PatientId
    {
        get; set;
    }
    public int? NoteId
    {
        get; set;
    }
}
public sealed class ClinicalDb(DbContextOptions<ClinicalDb> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Patient> Patients => Set<Patient>();
    public DbSet<ClinicalNote> Notes => Set<ClinicalNote>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Patient>().HasIndex(x => x.Identifier).IsUnique();
        b.Entity<ClinicalNote>().HasIndex(x => x.SeedKey).IsUnique();
        b.Entity<ClinicalNote>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ClinicalNote>().HasIndex(x => new { x.PatientId, x.CreatedAt });
        b.Entity<AuditEvent>().HasIndex(x => x.At);
    }
}
