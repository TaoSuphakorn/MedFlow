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
    public DateTime? OnboardingSeenAt { get; set; }
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
    public List<NoteSectionReview> SectionReviews { get; set; } = [];
    public List<SummarySentence> SummarySentences { get; set; } = [];
}
/// <summary>One sentence of an AI summary and the confirmed visits it is grounded in.</summary>
public sealed class SummarySentence
{
    public int Id
    {
        get; set;
    }
    public int NoteId
    {
        get; set;
    }
    public int Ordinal
    {
        get; set;
    }
    public string Text { get; set; } = "";
    /// <summary>Confirmed SOAP note ids. Empty means the sentence is not linked to any visit.</summary>
    public int[] SourceNoteIds { get; set; } = [];
}
public sealed class VitalSign
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
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;
    public int? RecordedBy
    {
        get; set;
    }
    public int Systolic
    {
        get; set;
    }
    public int Diastolic
    {
        get; set;
    }
    public int Pulse
    {
        get; set;
    }
    public decimal TemperatureC
    {
        get; set;
    }
    public int RespiratoryRate
    {
        get; set;
    }
    public int SpO2
    {
        get; set;
    }
}
/// <summary>Original AI text for one SOAP section and the clinician review that cleared it.</summary>
public sealed class NoteSectionReview
{
    public static readonly string[] Sections = ["subjective", "objective", "assessment", "plan"];
    public int Id
    {
        get; set;
    }
    public int NoteId
    {
        get; set;
    }
    public string Section { get; set; } = "";
    public string AiText { get; set; } = "";
    public int? ReviewedBy
    {
        get; set;
    }
    public DateTime? ReviewedAt
    {
        get; set;
    }
    public static List<NoteSectionReview> Baseline(ClinicalNote n) =>
    [
        new() { Section = "subjective", AiText = n.Subjective.Trim() },
        new() { Section = "objective", AiText = n.Objective.Trim() },
        new() { Section = "assessment", AiText = n.Assessment.Trim() },
        new() { Section = "plan", AiText = n.Plan.Trim() },
    ];
    public static string TextOf(ClinicalNote n, string section) => section switch
    {
        "subjective" => n.Subjective,
        "objective" => n.Objective,
        "assessment" => n.Assessment,
        "plan" => n.Plan,
        _ => throw new ArgumentOutOfRangeException(nameof(section)),
    };
    /// <summary>A section still needs review when it is unchanged from the AI text and nobody has marked it reviewed.</summary>
    public bool IsPending(ClinicalNote n) => ReviewedAt is null && TextOf(n, Section).Trim() == AiText;
}
/// <summary>A scheduled or walk-in visit on the clinic's daily worklist.</summary>
public sealed class Encounter
{
    public static readonly string[] Statuses = ["Waiting", "InExam", "Completed"];
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
    public DateTime ScheduledAt
    {
        get; set;
    }
    public string Reason { get; set; } = "";
    public string Room { get; set; } = "";
    public string Status { get; set; } = "Waiting";
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int Version { get; set; } = 1;
    public static bool CanMove(string from, string to) => (from, to) is ("Waiting", "InExam") or ("InExam", "Completed") or ("InExam", "Waiting");
}
/// <summary>Thailand has no daylight saving, so the clinic day is a fixed UTC+7 window.</summary>
public static class ClinicDay
{
    public static readonly TimeSpan Offset = TimeSpan.FromHours(7);
    public static (DateTime Start, DateTime End) Range(DateTime utcNow)
    {
        var start = DateTime.SpecifyKind((utcNow + Offset).Date - Offset, DateTimeKind.Utc);
        return (start, start.AddDays(1));
    }
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
    public DbSet<NoteSectionReview> NoteSectionReviews => Set<NoteSectionReview>();
    public DbSet<Encounter> Encounters => Set<Encounter>();
    public DbSet<SummarySentence> SummarySentences => Set<SummarySentence>();
    public DbSet<VitalSign> VitalSigns => Set<VitalSign>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<User>().HasIndex(x => x.Email).IsUnique();
        b.Entity<Patient>().HasIndex(x => x.Identifier).IsUnique();
        b.Entity<ClinicalNote>().HasIndex(x => x.SeedKey).IsUnique();
        b.Entity<ClinicalNote>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<ClinicalNote>().HasIndex(x => new { x.PatientId, x.CreatedAt });
        b.Entity<AuditEvent>().HasIndex(x => x.At);
        b.Entity<ClinicalNote>().HasMany(x => x.SectionReviews).WithOne().HasForeignKey(x => x.NoteId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<NoteSectionReview>().HasIndex(x => new { x.NoteId, x.Section }).IsUnique();
        b.Entity<NoteSectionReview>().Property(x => x.Section).HasMaxLength(16);
        b.Entity<Encounter>().HasOne<Patient>().WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<Encounter>().HasIndex(x => x.ScheduledAt);
        b.Entity<Encounter>().HasIndex(x => x.SeedKey).IsUnique();
        b.Entity<Encounter>().Property(x => x.Version).IsConcurrencyToken();
        b.Entity<Encounter>().Property(x => x.Status).HasMaxLength(16);
        b.Entity<Encounter>().Property(x => x.Reason).HasMaxLength(200);
        b.Entity<Encounter>().Property(x => x.Room).HasMaxLength(40);
        b.Entity<ClinicalNote>().HasMany(x => x.SummarySentences).WithOne().HasForeignKey(x => x.NoteId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<SummarySentence>().HasIndex(x => new { x.NoteId, x.Ordinal }).IsUnique();
        b.Entity<SummarySentence>().Property(x => x.Text).HasMaxLength(1000);
        b.Entity<VitalSign>().HasOne<Patient>().WithMany().HasForeignKey(x => x.PatientId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<VitalSign>().HasIndex(x => new { x.PatientId, x.RecordedAt });
        b.Entity<VitalSign>().HasIndex(x => x.SeedKey).IsUnique();
        b.Entity<VitalSign>().Property(x => x.TemperatureC).HasPrecision(4, 1);
    }
}
