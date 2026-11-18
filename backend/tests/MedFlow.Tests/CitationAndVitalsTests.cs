using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MedFlow.Api;
using MedFlow.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedFlow.Tests;

public class CitationAndVitalsTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    public CitationAndVitalsTests(WebApplicationFactory<Program> factory) => this.factory = factory;

    private async Task<HttpClient> Login(string role)
    {
        var c = factory.CreateClient(new() { HandleCookies = true, AllowAutoRedirect = false });
        var csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { email = $"{role}@medflow.demo", password = "Demo!2026" })).StatusCode);
        c.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        return c;
    }

    [Fact] public void Citations_outside_the_supplied_context_are_dropped()
    {
        var context = new[] { new ClinicalNote { Id = 10 }, new ClinicalNote { Id = 11 } };
        var payload = new AiPayload
        {
            Summary = "fallback",
            SummarySentences = [new() { Text = " Grounded ", Sources = [10, 10, 11] }, new() { Text = "Forged", Sources = [999] }, new() { Text = "Unsupported", Sources = [] }],
        };
        var cited = AiService.Cite(payload, context);
        Assert.Equal(new[] { 0, 1, 2 }, cited.Select(s => s.Ordinal));
        Assert.Equal("Grounded", cited[0].Text);
        Assert.Equal(new[] { 10, 11 }, cited[0].SourceNoteIds);
        Assert.Empty(cited[1].SourceNoteIds);
        Assert.Empty(cited[2].SourceNoteIds);
    }

    [Fact] public void Missing_sentences_fall_back_to_one_uncited_summary()
    {
        var cited = AiService.Cite(new AiPayload { Summary = "Plain summary" }, []);
        Assert.Equal("Plain summary", Assert.Single(cited).Text);
        Assert.Empty(cited[0].SourceNoteIds);
    }

    [Fact] public void Too_many_or_empty_sentences_fail_validation()
    {
        var baseJson = """{"subjective":"a","objective":"b","assessment":"c","plan":"d","summary":"e","missingInformation":"f","uncertainty":"g","summarySentences":SENTENCES}""";
        var many = JsonSerializer.Serialize(Enumerable.Range(0, 13).Select(i => new { text = $"s{i}", sources = Array.Empty<int>() }));
        Assert.Throws<AiUnavailableException>(() => AiService.Parse(baseJson.Replace("SENTENCES", many)));
        Assert.Throws<AiUnavailableException>(() => AiService.Parse(baseJson.Replace("SENTENCES", """[{"text":" ","sources":[]}]""")));
        Assert.Single(AiService.Parse(baseJson.Replace("SENTENCES", """[{"text":"ok","sources":[1]}]""")).SummarySentences);
    }

    [Fact] public async Task Demo_summary_cites_only_confirmed_visits_of_the_patient()
    {
        using var c = await Login("doctor");
        var note = await (await c.PostAsJsonAsync("/api/patients/2/ai", new { kind = "summary" })).Content.ReadFromJsonAsync<JsonElement>();
        var patient = await c.GetFromJsonAsync<JsonElement>("/api/patients/2");
        var confirmed = patient.GetProperty("notes").EnumerateArray().Where(n => n.GetProperty("status").GetString() == "Confirmed").Select(n => n.GetProperty("id").GetInt32()).ToHashSet();
        var stored = patient.GetProperty("notes").EnumerateArray().Single(n => n.GetProperty("id").GetInt32() == note.GetProperty("id").GetInt32());
        var sentences = stored.GetProperty("summarySentences").EnumerateArray().ToList();
        Assert.True(sentences.Count >= 3);
        Assert.Equal(Enumerable.Range(0, sentences.Count), sentences.Select(s => s.GetProperty("ordinal").GetInt32()));
        var sources = sentences.SelectMany(s => s.GetProperty("sourceNoteIds").EnumerateArray().Select(x => x.GetInt32())).ToList();
        Assert.NotEmpty(sources);
        Assert.All(sources, id => Assert.Contains(id, confirmed));
        Assert.Contains(sentences, s => s.GetProperty("sourceNoteIds").GetArrayLength() == 0);
    }

    [Theory]
    [InlineData(120, 78, 72, 36.8, 16, 98, "")]
    [InlineData(168, 98, 88, 36.8, 16, 98, "systolic:warning:high,diastolic:warning:high")]
    [InlineData(184, 70, 72, 36.8, 16, 98, "systolic:critical:high")]
    [InlineData(88, 60, 72, 36.8, 16, 98, "systolic:critical:low")]
    [InlineData(120, 78, 135, 39.6, 32, 89, "pulse:critical:high,temperatureC:critical:high,respiratoryRate:critical:high,spO2:critical:low")]
    [InlineData(120, 78, 104, 38.2, 16, 93, "pulse:warning:high,temperatureC:warning:high,spO2:warning:low")]
    public void Vital_thresholds_raise_warning_and_critical_flags(int sys, int dia, int pulse, double temp, int rr, int spo2, string expected)
    {
        var flags = VitalRules.Evaluate(new(sys, dia, pulse, (decimal)temp, rr, spo2));
        Assert.Equal(expected, string.Join(",", flags.Select(f => $"{f.Field}:{f.Level}:{f.Direction}")));
    }

    [Theory]
    [InlineData(null, 80, 70, 36.8, 16, 98)]
    [InlineData(300, 80, 70, 36.8, 16, 98)]
    [InlineData(120, 130, 70, 36.8, 16, 98)]
    [InlineData(120, 80, 70, 45.0, 16, 98)]
    [InlineData(120, 80, 70, 36.8, 16, 101)]
    public void Impossible_vital_signs_are_rejected(int? sys, int? dia, int? pulse, double? temp, int? rr, int? spo2) =>
        Assert.False(VitalRules.IsPlausible(new(sys, dia, pulse, (decimal?)temp, rr, spo2)));

    [Fact] public async Task Vitals_are_recorded_flagged_ordered_and_role_checked()
    {
        using var nurse = await Login("nurse");
        var seeded = await nurse.GetFromJsonAsync<JsonElement>("/api/patients/1/vitals");
        Assert.True(seeded.GetArrayLength() >= 3);
        Assert.Contains(seeded[0].GetProperty("flags").EnumerateArray(), f => f.GetProperty("field").GetString() == "systolic");
        Assert.Equal(HttpStatusCode.BadRequest, (await nurse.PostAsJsonAsync("/api/patients/4/vitals", new { systolic = 120, diastolic = 80, pulse = 70, temperatureC = 36.8, respiratoryRate = 16 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await nurse.PostAsJsonAsync("/api/patients/999999/vitals", new { systolic = 120, diastolic = 80, pulse = 70, temperatureC = 36.8, respiratoryRate = 16, spO2 = 98 })).StatusCode);
        var created = await nurse.PostAsJsonAsync("/api/patients/4/vitals", new { systolic = 150, diastolic = 80, pulse = 70, temperatureC = 36.84, respiratoryRate = 16, spO2 = 98 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var reading = await created.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(36.8m, reading.GetProperty("temperatureC").GetDecimal());
        var flag = Assert.Single(reading.GetProperty("flags").EnumerateArray());
        Assert.Equal("warning", flag.GetProperty("level").GetString());
        var latest = await nurse.GetFromJsonAsync<JsonElement>("/api/patients/4/vitals");
        Assert.Equal(reading.GetProperty("id").GetInt32(), latest[0].GetProperty("id").GetInt32());

        using var admin = await Login("admin");
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/patients/4/vitals")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/patients/4/vitals", new { systolic = 120, diastolic = 80, pulse = 70, temperatureC = 36.8, respiratoryRate = 16, spO2 = 98 })).StatusCode);
        var audit = await admin.GetFromJsonAsync<JsonElement>("/api/audit");
        Assert.Contains(audit.EnumerateArray(), a => a.GetProperty("action").GetString() == "vitals.recorded" && a.GetProperty("patientId").GetInt32() == 4);
    }
}
