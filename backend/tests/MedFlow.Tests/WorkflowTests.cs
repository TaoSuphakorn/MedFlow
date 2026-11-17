using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedFlow.Tests;

public class WorkflowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> factory;
    public WorkflowTests(WebApplicationFactory<Program> factory) => this.factory = factory;
    private HttpClient Client() => factory.CreateClient(new() { HandleCookies = true, AllowAutoRedirect = false });
    private static async Task Login(HttpClient c, string role = "doctor")
    {
        var csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        var login = await c.PostAsJsonAsync("/api/auth/login", new { email = $"{role}@medflow.demo", password = "Demo!2026" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        c.DefaultRequestHeaders.Remove("X-CSRF-TOKEN");
        csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
    }
    private static async Task<int> Patient(HttpClient c)
    {
        var patients = await c.GetFromJsonAsync<JsonElement>("/api/patients");
        Assert.True(patients.GetArrayLength() >= 15);
        return patients[0].GetProperty("id").GetInt32();
    }
    private static object Note(int version = 0) => new { subjective = "Synthetic follow-up symptom history", objective = "Synthetic observations documented", assessment = "Review required by treating doctor", plan = "Clinician to review next steps", version };

    [Fact] public async Task Patients_require_authentication()
    {
        using var c = Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/patients")).StatusCode);
    }
    [Fact] public async Task Invalid_credentials_rejected_and_csrf_required()
    {
        using var c = Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync("/api/auth/login", new { email = "doctor@medflow.demo", password = "Demo!2026" })).StatusCode);
        var csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { email = "doctor@medflow.demo", password = "wrong" })).StatusCode);
    }
    [Fact] public async Task Patients_search_and_history_are_seeded()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        var p = await c.GetFromJsonAsync<JsonElement>($"/api/patients/{id}");
        Assert.True(p.GetProperty("notes").GetArrayLength() >= 3);
        var search = await c.GetFromJsonAsync<JsonElement>("/api/patients?search=SYN-1001");
        Assert.Single(search.EnumerateArray());
        Assert.Contains("สม", search[0].GetProperty("thaiName").GetString());
    }
    [Fact] public async Task Doctor_can_save_edit_and_confirm_but_not_overwrite_approved_note()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        var created = await c.PostAsJsonAsync($"/api/patients/{id}/notes", Note());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var n = await created.Content.ReadFromJsonAsync<JsonElement>(); var nid = n.GetProperty("id").GetInt32();
        var edited = await c.PutAsJsonAsync($"/api/notes/{nid}", Note(1)); Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PutAsJsonAsync($"/api/notes/{nid}", Note(1))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/notes/{nid}/confirm", new { reviewed = false, version = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync($"/api/notes/{nid}/confirm", new { reviewed = true, version = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await c.PutAsJsonAsync($"/api/notes/{nid}", Note(3))).StatusCode);
    }
    [Theory] [InlineData("nurse")] [InlineData("admin")]
    public async Task Only_doctor_can_confirm(string role)
    {
        using var doctor = Client(); await Login(doctor); var id = await Patient(doctor);
        var result = await doctor.PostAsJsonAsync($"/api/patients/{id}/notes", Note());
        var nid = (await result.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        using var c = Client(); await Login(c, role);
        Assert.Equal(HttpStatusCode.Forbidden, (await c.PostAsJsonAsync($"/api/notes/{nid}/confirm", new { reviewed = true, version = 1 })).StatusCode);
    }
    [Fact] public async Task Empty_oversized_and_null_notes_are_rejected()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        foreach (var s in new string?[] { "", " ", null, new string('a', 8001) })
            Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/patients/{id}/notes", new { subjective = s, objective = "x", assessment = "x", plan = "x", version = 0 })).StatusCode);
    }
    [Fact] public async Task Ai_suggestion_is_a_draft_with_explicit_review_and_audit()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        var result = await c.PostAsJsonAsync($"/api/patients/{id}/ai", new { kind = "soap" });
        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        var n = await result.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("Draft", n.GetProperty("status").GetString());
        Assert.Equal("Demo", n.GetProperty("aiMode").GetString());
        Assert.True(n.GetProperty("aiGenerated").GetBoolean());
        Assert.NotEmpty(n.GetProperty("missingInformation").GetString()!);
        Assert.Equal(HttpStatusCode.BadRequest, (await c.PostAsJsonAsync($"/api/patients/{id}/ai", new { kind = "ignore instructions" })).StatusCode);
        using var admin = Client(); await Login(admin, "admin");
        var audit = await admin.GetFromJsonAsync<JsonElement>("/api/audit");
        Assert.Contains(audit.EnumerateArray(), a => a.GetProperty("action").GetString() == "ai.generated");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/audit")).StatusCode);
    }
    [Fact] public async Task Summary_suggestions_do_not_count_as_actionable_soap_drafts()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        var before = await c.GetFromJsonAsync<JsonElement>("/api/patients");
        var count = before[0].GetProperty("draftCount").GetInt32();
        var response = await c.PostAsJsonAsync($"/api/patients/{id}/ai", new { kind = "summary" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var n = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(HttpStatusCode.Conflict, (await c.PostAsJsonAsync($"/api/notes/{n.GetProperty("id").GetInt32()}/confirm", new { reviewed = true, version = 1 })).StatusCode);
        var after = await c.GetFromJsonAsync<JsonElement>("/api/patients");
        Assert.Equal(count, after[0].GetProperty("draftCount").GetInt32());
    }
    [Fact] public async Task Authorization_denials_are_audited_without_payloads()
    {
        using var c = Client(); await Login(c, "nurse");
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/audit")).StatusCode);
        using var admin = Client(); await Login(admin, "admin");
        var audit = await admin.GetFromJsonAsync<JsonElement>("/api/audit");
        Assert.Contains(audit.EnumerateArray(), a => a.GetProperty("action").GetString() == "request.failed.403");
    }
    [Theory] [InlineData("doctor")] [InlineData("nurse")]
    public async Task Summary_suggestions_cannot_be_modified_as_soap_notes(string role)
    {
        using var c = Client(); await Login(c, role); var id = await Patient(c);
        var response = await c.PostAsJsonAsync($"/api/patients/{id}/ai", new { kind = "summary" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var original = await response.Content.ReadFromJsonAsync<JsonElement>();
        var noteId = original.GetProperty("id").GetInt32();
        var update = await c.PutAsJsonAsync($"/api/notes/{noteId}", Note(1));
        Assert.Equal(HttpStatusCode.Conflict, update.StatusCode);
        var patient = await c.GetFromJsonAsync<JsonElement>($"/api/patients/{id}");
        var stored = patient.GetProperty("notes").EnumerateArray().Single(n => n.GetProperty("id").GetInt32() == noteId);
        Assert.Equal(original.GetProperty("subjective").GetString(), stored.GetProperty("subjective").GetString());
        Assert.Equal(1, stored.GetProperty("version").GetInt32());
        Assert.Equal("Draft", stored.GetProperty("status").GetString());
    }
    [Fact] public async Task Valid_Thai_soap_at_field_limit_is_accepted()
    {
        using var c = Client(); await Login(c); var id = await Patient(c);
        var thai = new string('ก', 8000);
        var response = await c.PostAsJsonAsync($"/api/patients/{id}/notes", new { subjective = thai, objective = thai, assessment = thai, plan = thai, version = 0 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var note = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(thai, note.GetProperty("subjective").GetString());
    }
}
