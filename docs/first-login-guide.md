# First-login guide

On first entry to the workspace, a signed-in account sees a four-step introduction covering the overview, patient search, SOAP/AI drafts and its role permissions. Thai and English can be switched inside the guide. It describes the workflow without opening a patient, generating AI content, saving a note or confirming anything.

Next and Previous move through the steps. Skip, Close, Escape, clicking outside and finishing all dismiss the introduction and remember it for that account. Help & demo guide → Restart walkthrough opens it again without navigating away from an unsaved draft. Dismissing a replay returns keyboard focus to Help on desktop or the navigation opener on a phone; the initial introduction returns focus to the main workspace.

`Users.OnboardingSeenAt` is a nullable UTC timestamp introduced by an automatic EF migration. Existing accounts see the introduction once after this upgrade. `GET /api/auth/me` supplies the preference. Authenticated, CSRF-protected `POST /api/auth/onboarding` marks only the current account as seen and preserves the first timestamp on repeated calls. The preference follows the account across browsers and devices. Skip and finish intentionally share one preference; this is not a completion analytics system.

Transient save failures leave the guide open with an error and retry controls. An expired session returns to login. Clearing browser storage does not reset the server preference. Resetting patient demo records also leaves account preferences intact.

The existing Radix dialog supplies focus trapping and Escape handling. Small viewports scroll inside the dialog when needed. No dependency or external service was added. Browser tests for existing clinical flows override only the guide preference to exercise returning users; dedicated onboarding tests cover first display, real persistence, role copy, replay/draft preservation, phone/language behavior, focus and error recovery. Browser writes run in a disposable Docker project to preserve the working demo.
