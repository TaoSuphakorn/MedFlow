using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MedFlow.Api.Data;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MedFlow.Tests;
public class AtomicAuditTests
{
    private sealed class RejectAudit(string action) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(DbContextEventData eventData, InterceptionResult<int> result, CancellationToken ct = default)
        {
            if (eventData.Context!.ChangeTracker.Entries<AuditEvent>().Any(e => e.State == EntityState.Added && e.Entity.Action == action)) throw new InvalidOperationException("Simulated audit storage failure");
            return base.SavingChangesAsync(eventData, result, ct);
        }
    }
    [Theory] [InlineData("note.created", false)] [InlineData("ai.generated", true)]
    public async Task Failed_audit_rolls_back_new_record(string action, bool ai)
    {
        await using var root = new WebApplicationFactory<Program>();
        await using var factory = root.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddDbContext<ClinicalDb>(o => o.AddInterceptors(new RejectAudit(action)))));
        using var c = factory.CreateClient(new() { HandleCookies = true });
        var csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf"); c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { email = "doctor@medflow.demo", password = "Demo!2026" })).StatusCode);
        c.DefaultRequestHeaders.Remove("X-CSRF-TOKEN"); csrf = await c.GetFromJsonAsync<JsonElement>("/api/auth/csrf"); c.DefaultRequestHeaders.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        var before = (await c.GetFromJsonAsync<JsonElement>("/api/patients/1")).GetProperty("notes").GetArrayLength();
        var response = ai ? await c.PostAsJsonAsync("/api/patients/1/ai", new { kind = "soap" }) : await c.PostAsJsonAsync("/api/patients/1/notes", new { subjective = "Synthetic atomicity test", objective = "Synthetic", assessment = "Synthetic", plan = "Review required", version = 0 });
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        var after = (await c.GetFromJsonAsync<JsonElement>("/api/patients/1")).GetProperty("notes").GetArrayLength();
        Assert.Equal(before, after);
    }
}
