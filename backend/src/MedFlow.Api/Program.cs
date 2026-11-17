using System.Security.Claims;
using System.Threading.RateLimiting;
using MedFlow.Api;
using MedFlow.Api.Data;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddJsonConsole();
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);
builder.Services.AddDbContext<ClinicalDb>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Database") ?? throw new InvalidOperationException("Database connection is required.")));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "medflow.session";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = builder.Environment.IsEnvironment("Production") ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(4);
    o.SlidingExpiration = false;
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(o => { o.HeaderName = "X-CSRF-TOKEN"; o.Cookie.Name = "medflow.csrf"; o.Cookie.SameSite = SameSiteMode.Strict; });
var dp = builder.Services.AddDataProtection().SetApplicationName("MedFlow.AI");
if (!builder.Environment.IsEnvironment("Testing")) dp.PersistKeysToFileSystem(new DirectoryInfo("/keys"));
builder.Services.AddHttpClient<AiService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddPolicy("login", c => RateLimitPartition.GetFixedWindowLimiter(c.Connection.RemoteIpAddress?.ToString() ?? "local", _ => new() { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("ai", c => RateLimitPartition.GetFixedWindowLimiter(c.User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "anonymous", _ => new() { PermitLimit = 12, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 262144);
var app = builder.Build();
// This single backend owns initialization; it listens only after migrations and seed succeed.
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ClinicalDb>();
    await db.Database.MigrateAsync();
    if (app.Environment.IsEnvironment("Demo") || app.Environment.IsEnvironment("Testing"))
        await Seeder.SeedAsync(db, app.Configuration["Demo:Password"] ?? "Demo!2026");
}
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Content-Type-Options"] = "nosniff";
    ctx.Response.Headers["Cache-Control"] = "no-store";
    try
    {
        await next();
    }
    catch (DbUpdateConcurrencyException) { ctx.Response.StatusCode = 409; await ctx.Response.WriteAsJsonAsync(new { error = "This note changed. Reopen it before saving." }); }
    catch (BadHttpRequestException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { error = "Invalid request." }); }
    catch (Exception) { app.Logger.LogError("Unhandled request failure; trace {TraceId}", ctx.TraceIdentifier); ctx.Response.StatusCode = 500; await ctx.Response.WriteAsJsonAsync(new { error = "The request could not be completed.", traceId = ctx.TraceIdentifier }); }
});
if (app.Environment.IsEnvironment("Demo")) { app.UseSwagger(); app.UseSwaggerUI(); }
app.UseAuthentication();
app.Use(async (ctx, next) =>
{
    await next();
    if (ctx.Response.StatusCode >= 400 && ctx.Request.Path.StartsWithSegments("/api"))
        await Audit(ctx.RequestServices.GetRequiredService<ClinicalDb>(), ctx, $"request.failed.{ctx.Response.StatusCode}");
});
app.UseAuthorization();
app.UseRateLimiter();
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/api") && !HttpMethods.IsGet(ctx.Request.Method) && !HttpMethods.IsHead(ctx.Request.Method) && !HttpMethods.IsOptions(ctx.Request.Method))
    {
        try
        {
            await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);
        }
        catch (AntiforgeryValidationException) { ctx.Response.StatusCode = 400; await ctx.Response.WriteAsJsonAsync(new { error = "Security token expired. Refresh and try again." }); return; }
    }
    await next();
});
app.MapGet("/health", async (ClinicalDb db) => await db.Database.CanConnectAsync() ? Results.Ok(new { status = "healthy" }) : Results.StatusCode(503));
app.MapGet("/api/auth/csrf", (HttpContext ctx, IAntiforgery anti) => Results.Ok(new { token = anti.GetAndStoreTokens(ctx).RequestToken }));
app.MapPost("/api/auth/login", async (LoginInput input, ClinicalDb db, HttpContext ctx) =>
{
    if (string.IsNullOrWhiteSpace(input.Email) || input.Email.Length > 200 || string.IsNullOrEmpty(input.Password) || input.Password.Length > 200)
        return Results.BadRequest(new
        {
            error = "Enter a valid email and password."
        });
    var user = await db.Users.SingleOrDefaultAsync(x => x.Email == input.Email.ToLower().Trim());
    var hasher = new PasswordHasher<User>();
    if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, input.Password) == PasswordVerificationResult.Failed)
    {
        await Audit(db, ctx, "auth.failed");
        return Results.Unauthorized();
    }
    var claims = new[] { new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Name, user.Name), new Claim(ClaimTypes.Role, user.Role) };
    await ctx.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    await Audit(db, ctx, "auth.login", userId: user.Id);
    return Results.Ok(new
    {
        user.Name,
        user.Role,
        user.Email
    });
}).RequireRateLimiting("login");
app.MapGet("/api/auth/me", (HttpContext ctx, AiService ai) => Results.Ok(new { name = ctx.User.Identity!.Name, role = ctx.User.FindFirstValue(ClaimTypes.Role), aiMode = ai.IsDemo ? "Demo" : "Live" })).RequireAuthorization();
app.MapPost("/api/auth/logout", async (HttpContext ctx, ClinicalDb db) => { await Audit(db, ctx, "auth.logout"); await ctx.SignOutAsync(); return Results.NoContent(); }).RequireAuthorization();
var api = app.MapGroup("/api").RequireAuthorization();
api.MapGet("/patients", async (string? search, ClinicalDb db) =>
{
    if (search?.Length > 100)
        return Results.BadRequest(new
        {
            error = "Search must be 100 characters or fewer."
        });
    var q = db.Patients.AsNoTracking();
    if (!string.IsNullOrWhiteSpace(search))
    {
        var s = search.Trim().ToLower();
        q = q.Where(p => p.Name.ToLower().Contains(s) || p.ThaiName.Contains(s) || p.Identifier.ToLower().Contains(s));
    }
    return Results.Ok(await q.OrderBy(p => p.Id).Select(p => new { p.Id, p.Identifier, p.Name, p.ThaiName, p.Age, p.Gender, p.Category, p.Color, lastVisit = p.Notes.Where(n => n.Status == "Confirmed").Max(n => (DateTime?)n.CreatedAt), draftCount = p.Notes.Count(n => n.Status == "Draft" && n.Kind == "soap"), visitCount = p.Notes.Count(n => n.Status == "Confirmed") }).Take(200).ToListAsync());
});
api.MapGet("/patients/{id:int}", async (int id, ClinicalDb db, HttpContext ctx) =>
{
    var p = await db.Patients.AsNoTracking().Include(p => p.Notes.OrderByDescending(n => n.CreatedAt)).SingleOrDefaultAsync(p => p.Id == id);
    if (p is null)
        return Results.NotFound();
    await Audit(db, ctx, "patient.accessed", id);
    return Results.Ok(p);
});
api.MapPost("/patients/{id:int}/notes", async (int id, SoapInput input, ClinicalDb db, HttpContext ctx) =>
{
    if (!input.IsValid())
        return InvalidSoap();
    if (!await db.Patients.AnyAsync(p => p.Id == id))
        return Results.NotFound();
    await using var tx = await db.Database.BeginTransactionAsync();
    var note = new ClinicalNote { PatientId = id };
    Apply(note, input);
    db.Notes.Add(note);
    await db.SaveChangesAsync();
    await Audit(db, ctx, "note.created", id, note.Id);
    await tx.CommitAsync();
    return Results.Created($"/api/notes/{note.Id}", note);
}).RequireAuthorization(p => p.RequireRole("Doctor", "Nurse"));
api.MapPut("/notes/{id:int}", async (int id, SoapInput input, ClinicalDb db, HttpContext ctx) =>
{
    if (!input.IsValid())
        return InvalidSoap();
    var note = await db.Notes.FindAsync(id);
    if (note is null)
        return Results.NotFound();
    if (note.Kind != "soap")
        return Results.Conflict(new { error = "Only SOAP drafts can be edited." });
    if (note.Status != "Draft" || note.Version != input.Version)
        return Results.Conflict(new
        {
            error = "Note is confirmed or changed. Reopen before editing."
        });
    Apply(note, input);
    note.Version++;
    await Audit(db, ctx, "note.modified", note.PatientId, id);
    return Results.Ok(note);
}).RequireAuthorization(p => p.RequireRole("Doctor", "Nurse"));
api.MapPost("/notes/{id:int}/confirm", async (int id, ConfirmInput input, ClinicalDb db, HttpContext ctx) =>
{
    if (!input.Reviewed)
        return Results.BadRequest(new
        {
            error = "Explicit clinician review is required."
        });
    var note = await db.Notes.FindAsync(id);
    if (note is null)
        return Results.NotFound();
    if (note.Kind != "soap" || note.Status != "Draft" || note.Version != input.Version)
        return Results.Conflict(new
        {
            error = "Only the current SOAP draft can be confirmed."
        });
    if (!new SoapInput(note.Subjective, note.Objective, note.Assessment, note.Plan, note.Version).IsValid())
        return InvalidSoap();
    note.Status = "Confirmed";
    note.ConfirmedBy = int.Parse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    note.ConfirmedAt = DateTime.UtcNow;
    note.UpdatedAt = DateTime.UtcNow;
    note.Version++;
    await Audit(db, ctx, "note.confirmed", note.PatientId, id);
    return Results.Ok(note);
}).RequireAuthorization(p => p.RequireRole("Doctor"));
api.MapPost("/patients/{id:int}/ai", async (int id, AiInput input, ClinicalDb db, AiService ai, HttpContext ctx, CancellationToken ct) =>
{
    if (input.Kind is not ("soap" or "summary"))
        return Results.BadRequest(new
        {
            error = "Choose soap or summary."
        });
    var p = await db.Patients.AsNoTracking().Include(p => p.Notes).SingleOrDefaultAsync(p => p.Id == id, ct);
    if (p is null)
        return Results.NotFound();
    await Audit(db, ctx, "ai.requested", id);
    try
    {
        var payload = await ai.GenerateAsync(p, input.Kind, ct);
        var note = new ClinicalNote { PatientId = id, Subjective = payload.Subjective, Objective = payload.Objective, Assessment = payload.Assessment, Plan = payload.Plan, Summary = payload.Summary, MissingInformation = payload.MissingInformation, Uncertainty = payload.Uncertainty, AiGenerated = true, AiMode = ai.IsDemo ? "Demo" : "Live", Kind = input.Kind };
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        db.Notes.Add(note);
        await db.SaveChangesAsync(ct);
        await Audit(db, ctx, "ai.generated", id, note.Id);
        await tx.CommitAsync(ct);
        return Results.Ok(note);
    }
    catch (AiUnavailableException) { await Audit(db, ctx, "ai.failed", id); return Results.Json(new { error = "AI assistance is unavailable or returned invalid content. No suggestion was saved. Try again later." }, statusCode: 502); }
}).RequireAuthorization(p => p.RequireRole("Doctor", "Nurse")).RequireRateLimiting("ai");
api.MapGet("/audit", async (ClinicalDb db) => Results.Ok(await db.AuditEvents.AsNoTracking().OrderByDescending(a => a.Id).Take(200).ToListAsync())).RequireAuthorization(p => p.RequireRole("Administrator"));
app.Run();
static IResult InvalidSoap() => Results.BadRequest(new { error = "All four SOAP sections are required and must be 8,000 characters or fewer." });
static void Apply(ClinicalNote n, SoapInput i) { n.Subjective = i.Subjective!.Trim(); n.Objective = i.Objective!.Trim(); n.Assessment = i.Assessment!.Trim(); n.Plan = i.Plan!.Trim(); n.UpdatedAt = DateTime.UtcNow; }
static async Task Audit(ClinicalDb db, HttpContext ctx, string action, int? patientId = null, int? noteId = null, int? userId = null)
{
    var uid = int.TryParse(ctx.User.FindFirstValue(ClaimTypes.NameIdentifier), out var parsed) ? parsed : (int?)null;
    db.AuditEvents.Add(new AuditEvent { Action = action, UserId = userId ?? uid, PatientId = patientId, NoteId = noteId });
    await db.SaveChangesAsync();
}
public partial class Program;
