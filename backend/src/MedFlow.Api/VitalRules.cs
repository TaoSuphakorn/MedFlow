using MedFlow.Api.Data;
namespace MedFlow.Api;

public sealed record VitalInput(int? Systolic, int? Diastolic, int? Pulse, decimal? TemperatureC, int? RespiratoryRate, int? SpO2);
public sealed record VitalFlag(string Field, string Level, string Direction);
public sealed record VitalReading(int Id, DateTime RecordedAt, int Systolic, int Diastolic, int Pulse, decimal TemperatureC, int RespiratoryRate, int SpO2, IReadOnlyList<VitalFlag> Flags);

/// <summary>
/// Adult demonstration thresholds. They drive warning/critical alerts in the UI and API,
/// but they are not clinically validated and must not be used for care.
/// </summary>
public static class VitalRules
{
    private sealed record Band(string Field, decimal CriticalLow, decimal WarningLow, decimal WarningHigh, decimal CriticalHigh, decimal Min, decimal Max);
    // A value below WarningLow or above WarningHigh warns; at or beyond a critical edge it is critical.
    private static readonly Band[] Bands =
    [
        new("systolic", 90, 100, 139, 180, 50, 260),
        new("diastolic", 40, 50, 89, 120, 30, 160),
        new("pulse", 40, 50, 100, 130, 20, 250),
        new("temperatureC", 35.0m, 36.0m, 37.4m, 39.5m, 30, 43),
        new("respiratoryRate", 8, 12, 20, 30, 4, 60),
        new("spO2", 90, 95, 100, 101, 50, 100),
    ];

    private static decimal Value(string field, VitalInput v) => field switch
    {
        "systolic" => v.Systolic!.Value,
        "diastolic" => v.Diastolic!.Value,
        "pulse" => v.Pulse!.Value,
        "temperatureC" => v.TemperatureC!.Value,
        "respiratoryRate" => v.RespiratoryRate!.Value,
        _ => v.SpO2!.Value,
    };

    /// <summary>Rejects missing or physiologically impossible entries, which are almost always typing errors.</summary>
    public static bool IsPlausible(VitalInput v) =>
        v.Systolic is not null && v.Diastolic is not null && v.Pulse is not null && v.TemperatureC is not null && v.RespiratoryRate is not null && v.SpO2 is not null
        && v.Diastolic < v.Systolic
        && Bands.All(b => Value(b.Field, v) >= b.Min && Value(b.Field, v) <= b.Max);

    public static IReadOnlyList<VitalFlag> Evaluate(VitalInput v)
    {
        var flags = new List<VitalFlag>();
        foreach (var b in Bands)
        {
            var x = Value(b.Field, v);
            if (x <= b.CriticalLow) flags.Add(new(b.Field, "critical", "low"));
            else if (x >= b.CriticalHigh) flags.Add(new(b.Field, "critical", "high"));
            else if (x < b.WarningLow) flags.Add(new(b.Field, "warning", "low"));
            else if (x > b.WarningHigh) flags.Add(new(b.Field, "warning", "high"));
        }
        return flags;
    }

    public static VitalReading ToReading(VitalSign s) =>
        new(s.Id, s.RecordedAt, s.Systolic, s.Diastolic, s.Pulse, s.TemperatureC, s.RespiratoryRate, s.SpO2,
            Evaluate(new(s.Systolic, s.Diastolic, s.Pulse, s.TemperatureC, s.RespiratoryRate, s.SpO2)));
}
