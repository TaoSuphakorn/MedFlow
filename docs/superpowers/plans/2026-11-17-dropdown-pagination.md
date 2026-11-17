# Dropdown styling and pagination

Continue inline with practical defaults under the user's standing authorization. Use Radix Select to match the existing Radix dialogs and provide keyboard/focus behavior. Style patient filters, saved-draft selection and page-size controls consistently with Calm Care. Paginate full patient/draft tables and the loaded audit list, retaining the overview's five-row preview.

- [x] Write failing browser coverage for page navigation, page size, search/filter resets, keyboard dropdown selection and phone fit.
- [x] Add a reusable Select and pagination controls/hook. Default 10 rows; choices 5/10/20; filter/search before slicing; reset to page 1 when criteria or size changes; clamp after data changes.
- [x] Migrate existing dropdown interactions/tests, preserve draft discard guards and add table paging. Audit remains explicitly limited to the latest 200 server-returned events.
- [x] Docker builds/tests in a disposable Compose project, screenshot inspection, local frontend update and verification. Preserve README edits and live seeded data.

Evidence: full browser suite 43/43. Review fixes retain directory state across the detail route and close Select portals during session verification/error. Regression tests failed before each fix. No backend changes, paid AI calls or publication. Login helpers respect the real rate limit. Existing README changes remain user-owned.
