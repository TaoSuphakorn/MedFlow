namespace MedFlow.Api;

public sealed record SoapInput(string? Subjective, string? Objective, string? Assessment, string? Plan, int Version)
{
    public bool IsValid() => new[] { Subjective, Objective, Assessment, Plan }.All(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 8000);
}
public sealed record LoginInput(string? Email, string? Password);
public sealed record AiInput(string? Kind);
public sealed record ConfirmInput(bool Reviewed, int Version);
public sealed class AiPayload
{
    public string Subjective { get; set; } = "";
    public string Objective { get; set; } = "";
    public string Assessment { get; set; } = "";
    public string Plan { get; set; } = "";
    public string Summary { get; set; } = "";
    public string MissingInformation { get; set; } = "";
    public string Uncertainty { get; set; } = "";
    public bool IsValid() => new[] { Subjective, Objective, Assessment, Plan, Summary, MissingInformation, Uncertainty }.All(x => !string.IsNullOrWhiteSpace(x) && x.Length <= 8000);
}
