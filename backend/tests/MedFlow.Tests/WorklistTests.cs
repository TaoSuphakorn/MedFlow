using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MedFlow.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedFlow.Tests;

public class WorklistTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    public WorklistTests(WebApplicationFactory<Program> factory) => this.factory = factory;

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

    [Fact] public void Clinic_day_uses_bangkok_midnight()
    {
        // 18:30 UTC is already 01:30 the next day in Bangkok.
        var (start, end) = ClinicDay.Range(new DateTime(2026, 11, 18, 18, 30, 0, DateTimeKind.Utc));
        Assert.Equal(new DateTime(2026, 11, 18, 17, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(start.AddDays(1), end);
    }

    [Theory]
    [InlineData("Waiting", "InExam", true)] [InlineData("InExam", "Completed", true)] [InlineData("InExam", "Waiting", true)]
    [InlineData("Waiting", "Completed", false)] [InlineData("Completed", "InExam", false)] [InlineData("Completed", "Waiting", false)]
    public void Visit_transitions_follow_the_clinic_workflow(string from, string to, bool allowed) => Assert.Equal(allowed, Encounter.CanMove(from, to));

    [Fact] public async Task Todays_queue_is_seeded_ordered_and_readable_by_every_role()
    {
        using var admin = await Login("admin");
        var list = await admin.GetFromJsonAsync<JsonElement>("/api/worklist");
        Assert.True(list.GetArrayLength() >= 8);
        var times = list.EnumerateArray().Select(x => x.GetProperty("scheduledAt").GetDateTime()).ToList();
        Assert.Equal(times.OrderBy(x => x), times);
        var statuses = list.EnumerateArray().Select(x => x.GetProperty("status").GetString()).ToHashSet();
        Assert.Superset(new HashSet<string?> { "Waiting", "InExam", "Completed" }, statuses);
        var first = list[0];
        Assert.False(string.IsNullOrEmpty(first.GetProperty("allergies").GetString()));
        Assert.True(first.TryGetProperty("draftCount", out _));
        using var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/worklist")).StatusCode);
    }

    [Fact] public async Task Check_in_and_status_changes_are_validated_versioned_and_audited()
    {
        using var nurse = await Login("nurse");
        // The test database can outlive one run, so pick a patient with no active visit today.
        var patients = await nurse.GetFromJsonAsync<JsonElement>("/api/patients");
        var queue = await nurse.GetFromJsonAsync<JsonElement>("/api/worklist");
        var busy = queue.EnumerateArray().Where(v => v.GetProperty("status").GetString() != "Completed").Select(v => v.GetProperty("patientId").GetInt32()).ToHashSet();
        var patientId = patients.EnumerateArray().Select(p => p.GetProperty("id").GetInt32()).Last(id => !busy.Contains(id));
        Assert.Equal(HttpStatusCode.BadRequest, (await nurse.PostAsJsonAsync("/api/encounters", new { patientId, reason = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await nurse.PostAsJsonAsync("/api/encounters", new { patientId = 999999, reason = "Walk-in" })).StatusCode);
        var created = await nurse.PostAsJsonAsync("/api/encounters", new { patientId, reason = "Walk-in review (synthetic)" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var visit = await created.Content.ReadFromJsonAsync<JsonElement>();
        var id = visit.GetProperty("id").GetInt32();
        Assert.Equal("Waiting", visit.GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await nurse.PostAsJsonAsync("/api/encounters", new { patientId, reason = "Duplicate" })).StatusCode);

        using var doctor = await Login("doctor");
        Assert.Equal(HttpStatusCode.BadRequest, (await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "Discharged", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "Completed", version = 1 })).StatusCode);
        var started = await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "InExam", version = 1 });
        Assert.Equal(HttpStatusCode.OK, started.StatusCode);
        Assert.Equal(2, (await started.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("version").GetInt32());
        Assert.Equal(HttpStatusCode.Conflict, (await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "Completed", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "Completed", version = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await doctor.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "InExam", version = 3 })).StatusCode);
        // A completed visit frees the patient for another check-in the same day.
        Assert.Equal(HttpStatusCode.Created, (await nurse.PostAsJsonAsync("/api/encounters", new { patientId, reason = "Second walk-in (synthetic)" })).StatusCode);

        using var admin = await Login("admin");
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync($"/api/encounters/{id}/status", new { status = "Waiting", version = 3 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.PostAsJsonAsync("/api/encounters", new { patientId, reason = "Admin" })).StatusCode);
        var audit = await admin.GetFromJsonAsync<JsonElement>("/api/audit");
        var actions = audit.EnumerateArray().Where(a => a.GetProperty("patientId").ValueKind == JsonValueKind.Number && a.GetProperty("patientId").GetInt32() == patientId).Select(a => a.GetProperty("action").GetString()).ToList();
        Assert.Contains("encounter.checked_in", actions);
        Assert.Contains("encounter.inexam", actions);
        Assert.Contains("encounter.completed", actions);
    }
}
