using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace MedFlow.Tests;
public class DocumentationTests
{
    [Fact] public async Task Swagger_documents_cookie_csrf_roles_and_soap_constraints()
    {
        await using var root = new WebApplicationFactory<Program>();
        await using var app = root.WithWebHostBuilder(b => b.UseEnvironment("Demo"));
        using var c = app.CreateClient();
        using var doc = JsonDocument.Parse(await c.GetStringAsync("/swagger/v1/swagger.json"));
        var json = doc.RootElement;
        Assert.Equal("MedFlow AI API", json.GetProperty("info").GetProperty("title").GetString());
        var paths = json.GetProperty("paths");
        Assert.Equal("Patients", paths.GetProperty("/api/patients").GetProperty("get").GetProperty("tags")[0].GetString());
        var confirm = paths.GetProperty("/api/notes/{id}/confirm").GetProperty("post");
        Assert.Contains("Doctor", confirm.GetProperty("description").GetString());
        Assert.Contains("409", confirm.GetProperty("responses").EnumerateObject().Select(p => p.Name));
        Assert.True(confirm.GetProperty("security")[0].TryGetProperty("cookieAuth", out _));
        Assert.True(confirm.GetProperty("security")[0].TryGetProperty("csrf", out _));
        var components = json.GetProperty("components");
        Assert.Equal("medflow.session", components.GetProperty("securitySchemes").GetProperty("cookieAuth").GetProperty("name").GetString());
        var soap = components.GetProperty("schemas").GetProperty("SoapInput");
        Assert.Contains("subjective", soap.GetProperty("required").EnumerateArray().Select(x => x.GetString()));
        Assert.Equal(8000, soap.GetProperty("properties").GetProperty("subjective").GetProperty("maxLength").GetInt32());
        Assert.DoesNotContain("passwordHash", json.GetRawText(), StringComparison.OrdinalIgnoreCase);
    }
    [Fact] public async Task Demo_swagger_serves_session_assets()
    {
        await using var root = new WebApplicationFactory<Program>();
        await using var app = root.WithWebHostBuilder(b => b.UseEnvironment("Demo"));
        using var c = app.CreateClient();
        Assert.Contains("medflow.js", await c.GetStringAsync("/swagger/index.html"));
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/swagger/medflow.js")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/swagger/medflow.css")).StatusCode);
    }
    [Fact] public async Task Production_does_not_expose_swagger_or_demo_assets()
    {
        await using var root = new WebApplicationFactory<Program>();
        await using var app = root.WithWebHostBuilder(b => b.UseEnvironment("Production"));
        using var c = app.CreateClient();
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/swagger/v1/swagger.json")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/swagger/medflow.js")).StatusCode);
    }
}
