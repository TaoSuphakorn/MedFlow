# Dropdowns and paging

Patient visit-type filters, saved-draft selection and page-size controls use a shared Radix Select component styled for Calm Care. The menu shows the selected item, manages focus and keyboard navigation/typeahead, and uses viewport collision handling. This replaces native selects only in the workspace; Swagger's independent demo-role control remains native.

Full Patients and Drafts tables default to 10 records per page with choices of 5, 10 or 20. Search and category filtering apply to the loaded list before paging. Changing criteria or page size returns to page 1; shrinking data clamps the page. The overview keeps its five-record preview and View all patients link. Going into a patient and Back to patients preserves the directory's search, filter, size and page.

Audit uses the same paging controls for the server-returned latest 200 events; the existing 200-event notice remains visible. Paging is client-side over loaded records. The patients endpoint also currently returns at most 200 records, so this change does not introduce server-side pagination or an unlimited history browser.

Opening another saved draft still uses the existing discard-confirmation guard. Select menus close as soon as session verification begins and stay unavailable during verification errors, preventing a body-level portal from exposing the prior workspace or blocking Retry. Retrying a failed same-account check retains unsaved SOAP text.

The reusable pieces are `components/ui/select.tsx`, `components/ui/pagination.tsx` and `controls.css`. `@radix-ui/react-select` is pinned to 2.4.1; dependency resolution and builds ran in Docker. The component follows the [official Radix Select API](https://www.radix-ui.com/primitives/docs/components/select).

Browser tests cover patient paging, size/filter/search resets, round-trip page retention, draft discard handling, menu closure during delayed/failed session checks, audit paging, phone fit and keyboard selection. Tests use the disposable `medflow-paging` project; the working demonstration database is not used for browser writes.
