using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
namespace MedFlow.Api.Data;

public static class Seeder
{
    public static async Task SeedAsync(ClinicalDb db, string password)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        var hasher = new PasswordHasher<User>();
        foreach (var (email, name, role) in new[] {
            ("doctor@medflow.demo", "Dr. Narin Suksawat", "Doctor"),
            ("nurse@medflow.demo", "Nurse Mali Wong", "Nurse"),
            ("admin@medflow.demo", "Workspace Administrator", "Administrator") })
        {
            if (await db.Users.AnyAsync(x => x.Email == email))
                continue;
            var user = new User { Email = email, Name = name, Role = role };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Users.Add(user);
        }
        await db.SaveChangesAsync();
        var doctorId = await db.Users.Where(x => x.Role == "Doctor").Select(x => x.Id).FirstAsync();
        string[] names = ["Somchai Jaidee", "Suda Wongchai", "Anan Chaisiri", "Malee Srisuk", "Prasert Thongdee", "Nonglak Saetang", "Wichai Boonmee", "Supaporn Rattanakorn", "Kittipong Saengchai", "Pimchanok Meesuk", "Thanakorn Intara", "Siriporn Kaewjai", "Chaiwat Phongsri", "Waraporn Jaroen", "Nattapong Sombat"];
        string[] thai = ["สมชาย ใจดี", "สุดา วงศ์ชัย", "อนันต์ ชัยศิริ", "มาลี ศรีสุข", "ประเสริฐ ทองดี", "นงลักษณ์ แซ่ตั้ง", "วิชัย บุญมี", "สุภาพร รัตนากร", "กิตติพงษ์ แสงชัย", "พิมพ์ชนก มีสุข", "ธนากร อินทร", "ศิริพร แก้วใจ", "ชัยวัฒน์ พงษ์ศรี", "วราภรณ์ เจริญ", "ณัฐพงษ์ สมบัติ"];
        string[] categories = ["Follow-up", "New visit", "Routine check", "Follow-up", "Routine check"];
        string[] histories = ["Synthetic history: type 2 diabetes and hypertension. Routine follow-up documented. No real patient data.", "Synthetic history: intermittent seasonal rhinitis. No previous admissions. No real patient data.", "Synthetic history: episodic lower back discomfort. No previous surgery. No real patient data."];
        for (var i = 0; i < names.Length; i++)
        {
            var identifier = $"SYN-{1001 + i}";
            var patient = await db.Patients.SingleOrDefaultAsync(p => p.Identifier == identifier);
            if (patient is null)
            {
                patient = new Patient { Identifier = identifier, Name = names[i], ThaiName = thai[i], Age = new[] { 58, 34, 42, 67, 51, 29, 63, 46, 38, 25, 55, 61, 44, 32, 49 }[i], Gender = i % 2 == 0 ? "Male" : "Female", BloodType = new[] { "O+", "A+", "B+", "AB+" }[i % 4], History = histories[i % 3], Allergies = i % 5 == 0 ? "Penicillin (synthetic)" : "No known allergies (synthetic)", Category = categories[i % 5], Color = new[] { "teal", "purple", "blue", "amber" }[i % 4] };
                db.Patients.Add(patient);
                await db.SaveChangesAsync();
            }
            for (var visit = 0; visit < 3; visit++)
            {
                var key = $"{identifier}-visit-{visit}";
                if (await db.Notes.AnyAsync(n => n.SeedKey == key))
                    continue;
                var date = new DateTime(2026, 11, 17, 2, 30, 0, DateTimeKind.Utc).AddDays(-visit * 30 - i);
                db.Notes.Add(new ClinicalNote { PatientId = patient.Id, SeedKey = key, Subjective = "Synthetic visit: patient reports mild fatigue and is attending scheduled follow-up. No new symptoms reported in this fictional record.", Objective = "Synthetic observations: BP 128/78 mmHg, pulse 76 bpm, temperature 36.7 °C. Alert and comfortable.", Assessment = "Documented follow-up of existing synthetic history. Assessment recorded by demo clinician.", Plan = "Review documented observations and reconcile history at the next fictional follow-up. Clinician review required.", Status = "Confirmed", ConfirmedBy = doctorId, ConfirmedAt = date, CreatedAt = date, UpdatedAt = date });
            }
        }
        var first = await db.Patients.OrderBy(p => p.Id).FirstAsync();
        if (!await db.Notes.AnyAsync(n => n.SeedKey == "demo-ai-draft"))
            db.Notes.Add(new ClinicalNote { PatientId = first.Id, SeedKey = "demo-ai-draft", Subjective = "Synthetic follow-up: mild fatigue reported.", Objective = "Previously recorded synthetic BP 128/78 mmHg; current measurements not provided.", Assessment = "Draft summary of source documentation; clinician assessment required.", Plan = "Clinician to review source notes and complete missing information.", AiGenerated = true, AiMode = "Demo", Summary = "Three fictional follow-up visits are available for review.", MissingInformation = "Current medication list and current vital signs are not documented.", Uncertainty = "Historical observations may not reflect the current visit. No diagnosis is inferred." });
        if (!await db.AuditEvents.AnyAsync(x => x.Action == "demo.seeded"))
            db.AuditEvents.Add(new AuditEvent { Action = "demo.seeded", UserId = doctorId });
        await db.SaveChangesAsync();
        await tx.CommitAsync();
    }
}
