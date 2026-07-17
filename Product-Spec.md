# Glassco Back Office Library — Product Specification

## Product direction

Glassco Back Office Library is the knowledge and operating-procedure foundation for a future Amazon PPC management suite. It provides a searchable document catalog, guided reading experience, local administration prototype, and structured document builder.

## Current implementation mode

The current milestone is an unauthenticated, browser-local MVP for one operator on one device. It does not provide accounts, shared workspaces, secure administration, or cross-device synchronization.

## Implemented requirements

### Catalog and reading

- **LIB-001** — A published, visible document catalog is available at `/library`.
- **LIB-002** — Search covers title, description, tags, and document type case-insensitively.
- **LIB-003** — A configurable category filter combines with search and is represented in the URL.
- **LIB-004** — Eight realistic starter documents use validated IDs, slugs, categories, and types.
- **LIB-005** — Reader pages render safe Markdown without arbitrary raw HTML.
- **LIB-006** — Topic navigation uses stable IDs and numbered main headings.
- **LIB-007** — Topic tooltips appear only when sidebar text is truncated.
- **LIB-008** — Responsive layouts avoid page-level horizontal overflow.
- **LIB-009** — Loading, empty, no-result, error, and not-found states are present.

### Reading state

- **LIB-LOCAL-001** — Bookmarks persist in versioned browser storage.
- **LIB-LOCAL-002** — Recent documents are deduplicated and newest-first.
- **LIB-LOCAL-003** — Last meaningful topic state is stored locally.
- **LIB-LOCAL-004** — Complete/incomplete state is independent from view history.
- **LIB-LOCAL-005** — Missing, blocked, malformed, or old storage falls back safely.
- **LIB-LOCAL-006** — Server and browser markup hydrate without reading-state mismatch.

### Local administration

- **LIB-ADMIN-001** — View mode displays Eye, admin mode displays Pencil, and the Plus control for creating a document remains visible in both modes.
- **LIB-ADMIN-002** — An operator can create and edit documents.
- **LIB-ADMIN-003** — Documents can be renamed, hidden, reordered, deleted, and recovered.
- **LIB-ADMIN-004** — Categories can be created, renamed, hidden, reordered, deleted, and recovered.
- **LIB-ADMIN-005** — Category renames update locally assigned documents.
- **LIB-ADMIN-006** — Normal reader access excludes hidden and deleted documents.
- **LIB-ADMIN-007** — Administration state is versioned and device-local.
- **LIB-ADMIN-008** — The new-document form exposes only title, description, and category; document type, tags, and legacy Markdown use preserved defaults and are not edited there.
- **LIB-ADMIN-009** — Existing documents are not renamed from catalog cards; their title, description, and assigned category are edited directly in the document header while builder edit mode is active.
- **LIB-ADMIN-010** — Category controls beside the document Category field support quick creation and open the full rename, reorder, delete, and recovery manager.
- **LIB-ADMIN-011** — Deleted categories stay hidden from the category manager until the recovery icon opens a dedicated recovery dialog.
- **LIB-ADMIN-012** — Deleted documents stay out of the catalog layout until the admin toolbar recovery icon opens a dedicated recovery dialog.

### Structured builder

- **LIB-BUILDER-001** — Documents support separate view and edit modes.
- **LIB-BUILDER-002** — The element menu remains inside the viewport and scrolls when necessary.
- **LIB-BUILDER-003** — Topics, statements, callouts, lists, checklists, insights, tables, dropdowns, feature cards, text blocks, roadmaps, and flows can be added.
- **LIB-BUILDER-004** — Tables support rows, columns, row height, and saved column width.
- **LIB-BUILDER-005** — Dropdown blocks support multiple entries and preserved line breaks.
- **LIB-BUILDER-006** — Video links support thumbnails and a new-tab watch action.
- **LIB-BUILDER-007** — Video Add/Pencil controls are visible only in document edit mode.
- **LIB-BUILDER-008** — Builder edit mode replaces the blue header metadata with editable title, description, and category controls and saves those values with the structured elements.
- **LIB-BUILDER-009** — Roadmaps independently support overall Left/Center/Right placement and Left/Center/Right step-number positions; centered numbers stack step copy and a full-width image.

## Current acceptance criteria

An operator can open the Library, search and filter content, read documents, navigate topics, bookmark and complete documents, use the simplified document form, create or manage categories beside its selector, build structured content, add a video tutorial, refresh the browser, and retain local state without hydration errors.

## Deferred requirements

- Authentication and account recovery.
- Users, organizations, workspaces, roles, and invitations.
- Server-backed content, preferences, and audit history.
- Authorization and row-level security.
- Amazon Ads API integrations.
- PPC analyzers, audits, reporting automation, collaboration, and analytics.
- Public sharing and billing.

These require a separately approved milestone and must replace—not expose—the local browser-storage administration model.
# Unified Glassco application behavior

- The PPC Dashboard is presented under the Pipeline domain at `/ppc`.
- A responsive application selector switches between Product Pipeline and PPC Dashboard.
- PPC resumes its last valid route and otherwise opens `/ppc/library`.
- A verified Pipeline session is required before the PPC interface renders.
- ADMIN can create, edit, reorder, hide, delete, and recover content. USER and VIEWER are read-only apart from personal reading controls.
