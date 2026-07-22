# Glassco Back Office Library — Product Specification

## Product direction

Glassco Back Office Library is the knowledge and operating-procedure foundation for the Amazon PPC management suite. It provides a searchable shared document catalog, guided reading experience, role-aware administration, and structured document builder.

## Current implementation mode

The current milestone uses the existing Pipeline identity and one authoritative Postgres catalog shared across accounts and devices. ADMIN has full administration, USER can create/edit documents, and VIEWER is read-only.

## Implemented requirements

### Catalog and reading

- **LIB-001** — A published, visible document catalog is available at `/library`.
- **LIB-002** — Search covers title, description, tags, and document type case-insensitively.
- **LIB-003** — A configurable category filter combines with search and is represented in the URL.
- **LIB-004** — Repository bootstrap fixtures use validated IDs, slugs, categories, and types without being merged into an initialized shared catalog.
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

### Shared administration

- **LIB-ADMIN-001** — View mode displays Eye, admin mode displays Pencil, and the Plus control for creating a document remains visible in both modes.
- **LIB-ADMIN-002** — ADMIN and USER can create documents and edit active document content/metadata.
- **LIB-ADMIN-003** — Documents can be renamed, hidden, reordered, deleted, and recovered.
- **LIB-ADMIN-004** — Categories can be created, renamed, hidden, reordered, deleted, and recovered.
- **LIB-ADMIN-005** — ADMIN category renames atomically update assigned active documents.
- **LIB-ADMIN-006** — Normal reader access excludes hidden and deleted documents.
- **LIB-ADMIN-007** — Pipeline Postgres stores one globally revisioned catalog with per-document and per-category versions, audit attribution, and recoverable tombstones.
- **LIB-ADMIN-008** — The new-document form exposes only title, description, and category; document type, tags, and legacy Markdown use preserved defaults and are not edited there.
- **LIB-ADMIN-009** — Existing documents are not renamed from catalog cards; their title, description, and assigned category are edited directly in the document header while builder edit mode is active.
- **LIB-ADMIN-010** — Category controls beside the document Category field support quick creation and open the full rename, reorder, delete, and recovery manager.
- **LIB-ADMIN-011** — Deleted categories stay hidden from the category manager until the recovery icon opens a dedicated recovery dialog.
- **LIB-ADMIN-012** — Deleted documents stay out of the catalog layout until the admin toolbar recovery icon opens a dedicated recovery dialog.
- **LIB-ADMIN-013** — The catalog renders a loading skeleton until shared administration state or its cached fallback is ready, so deleted seed documents never flash in the active list during refresh.
- **LIB-ADMIN-014** — Visible tabs synchronize every five seconds and revalidate immediately on focus.
- **LIB-ADMIN-015** — A validated confirmed cache may be shown during an outage only in read-only mode; stale browser administration data is never merged or uploaded.
- **LIB-ADMIN-016** — Same-record stale edits receive a conflict and current server state rather than silently overwriting another account.
- **LIB-ADMIN-017** — ADMIN exclusively controls document/category delete, restore, reorder, category management, and shared backups; VIEWER cannot mutate catalog content.

### Structured builder

- **LIB-BUILDER-001** — Documents support separate view and edit modes.
- **LIB-BUILDER-002** — The element menu remains inside the viewport and scrolls when necessary.
- **LIB-BUILDER-003** — Topics, statements, callouts, lists, checklists, insights, tables, dropdowns, feature cards, text blocks, roadmaps, galleries, buttons, and flows can be added. A single Key Insight element supports persistent Green, Blue, and Red presentation choices through segmented color tabs.
- **LIB-BUILDER-004** — Tables support rows, columns, row height, and saved column width.
- **LIB-BUILDER-005** — Dropdown blocks support multiple entries and preserved line breaks.
- **LIB-BUILDER-006** — Video links render in a large responsive player inside the blue document header’s right column. YouTube and shared Google Drive files use embedded players, Google Drive’s play control and playback content remain centered in the visible 16:9 frame with a compact new-tab icon, direct video files use native controls, and generic HTTPS links retain a secure clickable fallback.
- **LIB-BUILDER-007** — Video Add/Pencil controls are visible only in document edit mode.
- **LIB-BUILDER-008** — Builder edit mode replaces the blue header metadata with editable title, description, and category controls and saves those values with the structured elements.
- **LIB-BUILDER-009** — Roadmaps independently support overall Left/Center/Right placement and Left/Center/Right step-number positions; centered numbers stack step copy and a full-width image.
- **LIB-BUILDER-010** — Each Roadmap step supports a shared Blob-backed image upload up to 2 MB and an inline Plain, Bullets, Checklist, or Numbered composer while retaining legacy saved image URLs.
- **LIB-BUILDER-011** — Feature Cards and Gallery slots use shared authenticated image uploads; selecting a Gallery layout immediately creates its minimum visible slots without deleting extras. Gallery tiles are square, contain the complete uncropped image at its natural ratio, and open the existing full-image preview from the already-rendered tile source without a second media fetch.
- **LIB-BUILDER-011A** — Uploaded private images render as actual previews in editors, saved documents, Roadmaps, Galleries, Feature Cards, and image modals through authenticated media retrieval.
- **LIB-BUILDER-012** — Standalone Buttons support validated internal or HTTP(S) links, Full/Large/Medium/Small widths, Left/Center/Right alignment, and secure new-tab navigation.

## Current acceptance criteria

Authenticated users can open the Library, search/filter/read shared content, and retain personal reading state. ADMIN and USER changes synchronize across accounts within five seconds or on focus; ADMIN-only lifecycle actions remain protected. Deleted records do not reappear unless restored, conflicts do not silently overwrite work, and an outage cache remains read-only.

## Deferred requirements

- Secure same-origin cookie sessions and account recovery.
- Organizations, workspaces, and invitations beyond the current shared team catalog.
- Row-level multi-workspace isolation beyond current role authorization.
- Amazon Ads API integrations.
- PPC analyzers, audits, reporting automation, collaboration, and analytics.
- Public sharing and billing.

These require a separately approved milestone and must preserve the current shared-state and stable-ID contracts.
# Unified Glassco application behavior

- Team SOP Library is presented at `/ppc/library/*`; PPC Dashboard is the authenticated `/ppc/dashboard` coming-soon page.
- Three responsive application cards remain visible in the reserved top bar, with the active application shown in white text on blue.
- Clicking any application card, including the active card, opens its remembered route in a new browser tab and leaves the current page unchanged.
- Team SOP Library and PPC Dashboard remember routes independently and otherwise open `/ppc/library` and `/ppc/dashboard` respectively.
- A session-only Pipeline login is handed off once to the destination tab; missing or expired authentication returns to the requested safe PPC route after login.
- A verified Pipeline session is required before the PPC interface renders.
- ADMIN can create/edit/reorder/hide/delete/recover documents, manage categories, and manage backups. USER can create and edit active documents. VIEWER is read-only apart from personal reading controls.

# Rich-text composer behavior

- Supported element body fields provide selection-aware Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls with a live WYSIWYG editing surface.
- Titles, labels, metadata, button text, tables, code blocks, and diagnostic-flow nodes remain plain-text controls.
- Standalone list-element rows retain their element-level markers and support only Normal, Bold, Italic, and Underlined formatting.
- Pasted content is constrained by the editor schema to supported paragraphs, marks, lists, and checklists; links, images, colors, fonts, headings, and arbitrary HTML are not persisted.
- Checklist boxes are editable in admin mode and disabled in reader mode.
