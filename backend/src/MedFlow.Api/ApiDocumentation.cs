using MedFlow.Api.Data;
using Microsoft.OpenApi.Any;
using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace MedFlow.Api;

public static class ApiDocumentation
{
    public static void Configure(SwaggerGenOptions options)
    {
        options.SwaggerDoc("v1", new OpenApiInfo {
            Title = "MedFlow AI API", Version = "v1",
            Description = "Synthetic portfolio demonstration only. Not for clinical use. Use the Demo API session panel to sign in with a normal account. Swagger sends browser session cookies and obtains CSRF tokens automatically for writes. Doctor confirmation is always a separate explicit operation."
        });
        options.AddSecurityDefinition("cookieAuth", new OpenApiSecurityScheme {
            Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Cookie, Name = "medflow.session",
            Description = "HttpOnly session cookie issued by /api/auth/login. Use the session panel above; browsers manage this cookie. Do not paste cookies into the Authorize dialog."
        });
        options.AddSecurityDefinition("csrf", new OpenApiSecurityScheme {
            Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Header, Name = "X-CSRF-TOKEN",
            Description = "Obtain a token from GET /api/auth/csrf using the same cookies. Swagger attaches a fresh token automatically to same-origin API writes."
        });
        options.OperationFilter<ClinicalOperationFilter>();
        options.SchemaFilter<ClinicalSchemaFilter>();
        options.SupportNonNullableReferenceTypes();
    }
}

public sealed class ClinicalOperationFilter : IOperationFilter
{
    private sealed record Entry(string Id, string Tag, string Summary, string Description, Type? Body, int Success = 200, int[]? Errors = null);
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        var path = "/" + context.ApiDescription.RelativePath?.Trim('/').Replace(":int", "");
        var method = context.ApiDescription.HttpMethod;
        Entry? entry = (method, path) switch {
            ("GET", "/health") => new("Health", "System", "Check database readiness", "Healthy only after migrations and seed complete.", typeof(HealthResponse), Errors: [503]),
            ("GET", "/api/auth/csrf") => new("GetCsrfToken", "Authentication", "Get a CSRF token", "Returns a request token and antiforgery cookie. Request a fresh token after changing the signed-in user.", typeof(CsrfResponse)),
            ("POST", "/api/auth/login") => new("SignIn", "Authentication", "Sign in with a demo account", "Normal password-hash verification. Requires a CSRF token. Local demo accounts: doctor@medflow.demo, nurse@medflow.demo, admin@medflow.demo. Default demo password: Demo!2026.", typeof(LoginResponse), Errors: [400, 401, 429]),
            ("GET", "/api/auth/me") => new("CurrentSession", "Authentication", "Read the current session", "Returns the current role and Demo/Live AI mode. No API keys are returned.", typeof(SessionResponse), Errors: [401]),
            ("POST", "/api/auth/logout") => new("SignOut", "Authentication", "End the current session", "Invalidates the browser session cookie. Requires CSRF.", null, 204, [400, 401]),
            ("GET", "/api/patients") => new("ListPatients", "Patients", "Search fictional patients", "Doctor, Nurse and Administrator. Search English names, Thai names or synthetic identifiers; maximum 100 characters. Returns up to 200 profiles.", typeof(PatientListResponse[]), Errors: [400, 401]),
            ("GET", "/api/patients/{id}") => new("GetPatient", "Patients", "Read patient history", "Doctor, Nurse and Administrator. Returns original confirmed notes and unapproved suggestions with their status/provenance. Access is audited.", typeof(Patient), Errors: [401, 404]),
            ("POST", "/api/patients/{id}/notes") => new("CreateSoapDraft", "Clinical notes", "Create an unapproved SOAP draft", "Doctor or Nurse. All four SOAP sections are required. Creation always produces Draft status; it cannot approve a record. Version may be 0 on creation.", typeof(ClinicalNote), 201, [400, 401, 403, 404]),
            ("PUT", "/api/notes/{id}") => new("EditSoapDraft", "Clinical notes", "Edit the current SOAP draft", "Doctor or Nurse. Supply the latest version. Summary suggestions and confirmed notes cannot be edited. A stale version returns 409; reopen before retrying.", typeof(ClinicalNote), Errors: [400, 401, 403, 404, 409]),
            ("POST", "/api/notes/{id}/confirm") => new("ConfirmSoapNote", "Clinical notes", "Explicitly confirm a reviewed SOAP note", "Doctor only. Review and edit the source content first, then explicitly set reviewed=true and send the latest version. Confirmed notes become immutable. AI suggestions cannot approve themselves; confirmation is audited.", typeof(ClinicalNote), Errors: [400, 401, 403, 404, 409]),
            ("POST", "/api/patients/{id}/ai") => new("GenerateSuggestion", "AI assistance", "Generate an unapproved suggestion", "Doctor or Nurse. Choose soap or summary. Without a key, responses are deterministic Demo AI. With a configured key, this operation can incur provider usage charges. Live failures return 502 and never silently fall back. All generated content requires human review.", typeof(ClinicalNote), Errors: [400, 401, 403, 404, 429, 502]),
            ("GET", "/api/audit") => new("ReadAuditLog", "Audit", "Read recent audit metadata", "Administrator only. Returns the 200 most recent events, containing action codes and identifiers rather than clinical content.", typeof(AuditEvent[]), Errors: [401, 403]),
            _ => null
        };
        if (entry is null) return;
        operation.OperationId = entry.Id;
        operation.Tags = [new OpenApiTag { Name = entry.Tag }];
        operation.Summary = entry.Summary;
        operation.Description = entry.Description;
        operation.Responses.Clear();
        var success = new OpenApiResponse { Description = entry.Success == 201 ? "Draft created; not approved" : entry.Success == 204 ? "Session ended" : "Success" };
        if (entry.Body is not null)
            success.Content["application/json"] = new OpenApiMediaType { Schema = context.SchemaGenerator.GenerateSchema(entry.Body, context.SchemaRepository) };
        operation.Responses[entry.Success.ToString()] = success;
        foreach (var code in entry.Errors ?? []) operation.Responses[code.ToString()] = new OpenApiResponse { Description = code switch {
            400 => "Invalid input or CSRF token", 401 => "Sign-in required or credentials invalid", 403 => "Role does not permit this action", 404 => "Record not found", 409 => "Wrong record kind/status or stale version", 429 => "Rate limit reached", 502 => "AI provider failed or returned invalid content; no suggestion saved", 503 => "Database not ready", _ => "Request failed"
        } };
        operation.Responses["500"] = new OpenApiResponse { Description = "Safe server error; trace identifier may be returned" };
        var security = new OpenApiSecurityRequirement();
        if (path is not ("/health" or "/api/auth/csrf" or "/api/auth/login")) security[Reference("cookieAuth")] = [];
        if (method is not ("GET" or "HEAD")) security[Reference("csrf")] = [];
        operation.Security = security.Count == 0 ? [] : [security];
    }
    private static OpenApiSecurityScheme Reference(string id) => new() { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = id } };
    private sealed record HealthResponse(string Status);
    private sealed record CsrfResponse(string Token);
    private sealed record LoginResponse(string Name, string Role, string Email);
    private sealed record SessionResponse(int UserId, string Name, string Role, string AiMode);
    private sealed record PatientListResponse(int Id, string Identifier, string Name, string ThaiName, int Age, string Gender, string Category, string Color, DateTime? LastVisit, int DraftCount, int VisitCount);
}

public sealed class ClinicalSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type == typeof(SoapInput)) {
            foreach (var name in new[] { "subjective", "objective", "assessment", "plan" }) {
                schema.Required.Add(name); schema.Properties[name].MinLength = 1; schema.Properties[name].MaxLength = 8000;
                schema.Properties[name].Description = "Required non-whitespace text, up to 8,000 characters. Source clinical content must be reviewed by a clinician.";
            }
            schema.Properties["version"].Description = "0 for creation; current returned version for updates. Stale edits return 409.";
        }
        if (context.Type == typeof(ConfirmInput)) {
            schema.Required.UnionWith(["reviewed", "version"]);
            schema.Properties["reviewed"].Example = new OpenApiBoolean(false);
            schema.Properties["reviewed"].Description = "Explicit clinician attestation after reviewing the note. Must be true to confirm; never set automatically by AI.";
            schema.Properties["version"].Minimum = 1;
        }
        if (context.Type == typeof(LoginInput)) {
            schema.Required.UnionWith(["email", "password"]);
            schema.Properties["email"].Example = new OpenApiString("doctor@medflow.demo");
            schema.Properties["password"].Format = "password";
            schema.Properties["password"].Example = new OpenApiString("Demo!2026");
        }
        if (context.Type == typeof(AiInput)) {
            schema.Required.Add("kind"); schema.Properties["kind"].Enum = [new OpenApiString("soap"), new OpenApiString("summary")];
        }
    }
}
