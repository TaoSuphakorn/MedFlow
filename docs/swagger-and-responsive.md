# Swagger and responsive workspace

## API documentation

Open either [Swagger through the workspace](http://localhost:3000/swagger/) or [Swagger directly on the API](http://localhost:8080/swagger). Both use the same API operations. Swagger and its demo session assets are available only in the `Demo` environment; production does not expose them.

The OpenAPI document groups operations under Authentication, Patients, Clinical notes, AI assistance, Audit and System. It describes request fields, SOAP length limits, status codes, role restrictions, concurrency versions and explicit clinician confirmation. Login examples use the public local demonstration credentials. Response schemas do not expose password hashes or API keys.

### Try an authenticated request

1. Choose a role in the **Demo API session** panel. The default doctor account is prefilled. If you configured a different demo password, enter that password.
2. Click **Sign in to API**. The status shows the authenticated user, role and AI mode.
3. Expand **Patients / GET /api/patients**, select **Try it out**, and click **Execute**.
4. To write a draft, expand **Clinical notes / POST /api/patients/{id}/notes**, supply a patient ID and all four SOAP sections, then execute. Creation returns 201 and `Draft` status.
5. Only a Doctor can confirm a current SOAP draft. Review the source content, send its current version, and explicitly set `reviewed=true`. The example defaults to false to avoid suggesting automatic approval.
6. **Sign out of API** ends the shared browser session.

Swagger obtains a fresh CSRF token for same-origin API writes and uses the normal HttpOnly session cookie. It does not bypass authentication, authorization or antiforgery validation. The **Authorize** dialog documents the cookie/header schemes; use the demo session panel to establish browser cookies instead of pasting session tokens.

The external session script installs Swagger interceptors directly, without evaluating function strings. The frontend proxy keeps `script-src 'self'` and does not enable `unsafe-eval` or inline scripts. The session panel also updates after login/logout executed through Try it out.

The AI generation operation may incur provider charges if a live key is configured. The examples and automated tests do not call paid AI. Use Demo AI Mode for recruiter walkthroughs.

## Shared sessions across tabs

The workspace and Swagger share cookies when served from the same host. Changing accounts or signing out in one tab therefore affects the other. Same-origin tabs send a payload-free session-change signal; the workspace also rechecks authentication on focus and visibility changes, covering unavailable broadcasts and different localhost ports.

When identity changes, the workspace cancels pending queries, clears the previous user's cached data, renews CSRF state and resets the patient/draft view. Save your draft before deliberately switching accounts in another tab. Returning to the same account preserves unsaved SOAP text. While a session check is pending or fails, the previous workspace is hidden until verification succeeds or is retried.

## Responsive behavior

- At phone widths, patient rows become labeled cards so each open action remains on screen.
- The narrow-screen navigation drawer closes with its button, backdrop or Escape. It traps focus while open, restores focus when closed, and makes closed navigation inert.
- On narrow screens, the SOAP editor appears before the AI assistance panel. Save and confirmation controls fit the available width.
- Inputs use 16 CSS px on narrow screens; primary icon controls have larger touch areas. Safe-area spacing, reduced-motion rules and visible keyboard focus remain in place.
- Thai and English labels use the same responsive layout. Clinical source content is kept in its original language.

Browser checks cover 360, 390, 768 and 1024 CSS px, plus Swagger session controls at 360 px. These are Chromium viewport checks, not native-device, screen-reader or formal WCAG certification. Native mobile keyboard behavior has not been tested.

## Readiness endpoints

`/health` returns the backend's JSON readiness result on both application origins. It fails when the backend or database is unavailable. `/frontend-health` is Nginx's separate liveness probe and is used by the frontend Docker health check. A separate disposable Compose project verified that stopping the backend makes API readiness fail while Nginx liveness still succeeds.

## Verification

Run the documented Docker backend and browser test commands. Coverage includes normal Swagger login, real GET and CSRF-protected POST through Try it out, production Swagger exclusion, role changes across tabs, focus fallback without BroadcastChannel, same-user draft preservation, phone navigation and visible patient actions. Screenshots are in `docs/screenshots/`, including `swagger.png`, `swagger-mobile.png`, `patients-mobile-th.png` and `responsive-360-th.png`.

Implementation references: [Swashbuckle UI options](https://github.com/domaindrivendev/Swashbuckle.AspNetCore/blob/v7.3.1/src/Swashbuckle.AspNetCore.SwaggerUI/SwaggerUIOptionsExtensions.cs) and [Swagger UI configuration](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/).
