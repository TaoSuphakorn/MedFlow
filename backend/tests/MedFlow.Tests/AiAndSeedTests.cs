using System.Net;
using System.Text;
using System.Text.Json;
using MedFlow.Api;
using MedFlow.Api.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedFlow.Tests;

public class AiAndSeedTests
{
    private const string Valid = """{"subjective":"Source symptom","objective":"Historical source finding","assessment":"Clinician assessment required","plan":"Clinician review required","summary":"Fictional visit summary","missingInformation":"Current vital signs","uncertainty":"Historical observations only"}""";
    // The external HTTP boundary is stubbed: schema validation and parsing remain real.
    private sealed class Upstream(string body, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => Task.FromResult(new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") });
    }
    private sealed class Unreachable : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => throw new TaskCanceledException("Simulated timeout");
    }
    private static AiService Live(HttpMessageHandler handler) => new(new HttpClient(handler), new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["OPENAI_API_KEY"] = "test-key-not-a-secret" }).Build());
    private static string Envelope(string content) => JsonSerializer.Serialize(new { choices = new[] { new { message = new { content, refusal = (string?)null } } } });

    [Fact] public async Task Live_response_passes_schema_validation_without_a_paid_call()
    {
        var result = await Live(new Upstream(Envelope(Valid))).GenerateAsync(new Patient(), "soap", default);
        Assert.Equal("Source symptom", result.Subjective);
        Assert.Equal("Current vital signs", result.MissingInformation);
    }
    [Theory]
    [InlineData("{}")]
    [InlineData("not-json")]
    [InlineData("{\"choices\":[]}")]
    [InlineData("{\"choices\":[{\"message\":{\"content\":null,\"refusal\":\"Unable\"}}]}")]
    public async Task Live_invalid_or_refused_response_is_safe_failure(string body)
    {
        await Assert.ThrowsAsync<AiUnavailableException>(() => Live(new Upstream(body)).GenerateAsync(new Patient(), "soap", default));
    }
    [Theory] [InlineData("{}")] [InlineData("{\"subjective\":null}")]
    public async Task Structured_content_requires_all_nonempty_fields(string content)
    {
        await Assert.ThrowsAsync<AiUnavailableException>(() => Live(new Upstream(Envelope(content))).GenerateAsync(new Patient(), "soap", default));
    }
    [Fact] public async Task Live_http_failure_does_not_fall_back_to_demo()
    {
        await Assert.ThrowsAsync<AiUnavailableException>(() => Live(new Upstream("upstream failure", HttpStatusCode.TooManyRequests)).GenerateAsync(new Patient(), "soap", default));
    }
    [Fact] public async Task Live_timeout_is_safe_failure()
    {
        await Assert.ThrowsAsync<AiUnavailableException>(() => Live(new Unreachable()).GenerateAsync(new Patient(), "soap", default));
    }
    [Fact] public async Task Seeder_is_idempotent_and_preserves_custom_drafts_and_password_hashes()
    {
        await using var f = new WebApplicationFactory<Program>(); using var client = f.CreateClient();
        await using var scope = f.Services.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<ClinicalDb>();
        var p = await db.Patients.FirstAsync();
        var note = new ClinicalNote { PatientId = p.Id, Subjective = "User-created synthetic draft", Objective = "Preserved", Assessment = "Preserved", Plan = "Preserved" };
        db.Notes.Add(note); await db.SaveChangesAsync();
        var before = (await db.Users.CountAsync(), await db.Patients.CountAsync(), await db.Notes.CountAsync());
        await Seeder.SeedAsync(db, "different-password-not-used"); await Seeder.SeedAsync(db, "different-password-not-used");
        Assert.Equal(before, (await db.Users.CountAsync(), await db.Patients.CountAsync(), await db.Notes.CountAsync()));
        Assert.Equal("User-created synthetic draft", (await db.Notes.FindAsync(note.Id))!.Subjective);
        var user = await db.Users.FirstAsync(x => x.Email == "doctor@medflow.demo");
        Assert.NotEqual("Demo!2026", user.PasswordHash);
        Assert.NotEqual(PasswordVerificationResult.Failed, new PasswordHasher<User>().VerifyHashedPassword(user, user.PasswordHash, "Demo!2026"));
        db.Notes.Remove(note); await db.SaveChangesAsync();
    }
}
