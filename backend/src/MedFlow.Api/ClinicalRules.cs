namespace MedFlow.Api;

public sealed record SoapInput(string? Subjective, string? Objective, string? Assessment, string? Plan, int Version)
{
    public bool IsValid() => new[] { Subjective, Objective, Assessment, Plan }.All(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 8000);
}
public sealed record LoginInput(string? Email, string? Password);
public sealed record AiInput(string? Kind);
public sealed record ConfirmInput(bool Reviewed, int Version);
public sealed record CheckInInput(int PatientId, string? Reason);
public sealed record EncounterStatusInput(string? Status, int Version);
public sealed record WorklistItem(int Id, int PatientId, string Identifier, string Name, string ThaiName, int Age, string Gender, string Allergies, DateTime ScheduledAt, string Reason, string Room, string Status, int Version, int DraftCount);
public sealed class AiPayload
{
    public string Subjective { get; set; } = "";
    public string Objective { get; set; } = "";
    public string Assessment { get; set; } = "";
    public string Plan { get; set; } = "";
    public string Summary { get; set; } = "";
    public string MissingInformation { get; set; } = "";
    public string Uncertainty { get; set; } = "";
    public List<CitedSentence> SummarySentences { get; set; } = [];
    public bool IsValid() => new[] { Subjective, Objective, Assessment, Plan, Summary, MissingInformation, Uncertainty }.All(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 8000)
        && SummarySentences.Count <= 12 && SummarySentences.All(s => !string.IsNullOrWhiteSpace(s.Text) && s.Text.Length <= 1000 && s.Sources.Count <= 5);
}
public sealed class CitedSentence
{
    public string Text { get; set; } = "";
    public List<int> Sources { get; set; } = [];
}
