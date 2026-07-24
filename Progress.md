# Project Progress

Last updated: July 22, 2026

## Overall status

The Glassco Back Office Library is buildable with Pipeline-authenticated, Postgres-authoritative shared persistence, scoped versioned mutations, read-only outage caching, and cross-account synchronization.

## 2026-07-24 — Unexpected deletion prevention and attributed recovery

- Removed the two-document cleanup transformation; protected initialization now backs up and imports the complete catalog without creating tombstones.
- Added optional ADMIN deletion attribution for direct users, the July 22 cleanup migration, backup restores, and unknown historical sources.
- Added a confirmed, progress-aware bulk recovery control that sends one atomic revision-guarded mutation for migration-attributed documents only.
- Added a separately confirmed ADMIN permanent-delete action for recovery rows. It removes only tombstoned content, retains actor audit metadata, and blocks backup restoration of purged IDs.
- Updated the Pipeline restore contract to a non-destructive merge so backup-absent and newer active documents survive.
- Passed 151 automated tests across 29 files, ESLint, TypeScript, and the Next.js production build.

## Completed

### Application shell and catalog

- Glassco branding and Library-only navigation.
- Responsive desktop and mobile application shell.
- Glassco Back Office Library hero.
- Document search and configurable category filtering.
- Bookmark and recent-document entry points.
- Loading, empty, error, and not-found states.

### Reader experience

- Safe GFM Markdown rendering.
- Stable numbered topic navigation.
- Conditional full-title tooltips only for truncated topics.
- Bookmark, recent-view, and completion tracking.
- Responsive tables and document layouts.
- Hydration-safe browser reading state.

### Shared library administration

- Eye control in view mode, Pencil control in admin mode, and an always-visible Plus control for creating documents.
- Create and edit documents.
- Rename, hide/show, reorder, delete, and recover documents.
- Create, rename, hide/show, reorder, delete, and recover category options.
- Category recovery moved behind a compact recovery icon and dedicated deleted-category dialog.
- Document recovery moved out of the catalog footer and behind an admin-toolbar recovery icon with a dedicated deleted-document dialog.
- Creation-only document form with document type, tags, and legacy Markdown removed from the visible form while their saved defaults remain preserved.
- Category Plus and Pencil controls beside the document Category field for quick creation and full category management.
- Removed the catalog-card Edit / Rename action; existing document title, description, and category now edit directly in the blue document header during builder edit mode.
- Pipeline Postgres persistence with recoverable tombstones, global revision, per-record versions, audit attribution, and backup/restore support.
- Refresh-safe catalog hydration keeps all document cards behind a skeleton until authoritative state or the confirmed read-only cache resolves, eliminating deleted-document flashes.
- Repository Markdown is bootstrap-only after initialization; legacy browser administration state cannot merge into or upload to the shared catalog.
- Visible tabs poll every five seconds and refresh on focus. Server failure switches a validated confirmed cache to read-only mode instead of queuing local writes.
- ADMIN has full catalog/category lifecycle control, USER can create/update documents, and VIEWER is read-only; Pipeline enforces each permission against the current active user record.

### Structured document builder

- View and edit modes.
- Responsive element picker that flips to available viewport space.
- Topic numbering and sidebar synchronization.
- Repeatable dropdown entries with multiline preservation.
- Editable tables with add-row, add-column, row-height, and column-width controls.
- One unified Bullets element with Bullets, Checklist, and Numbers tabs; previously saved standalone list types remain compatible.
- Diagnostic Flow steps support independent multiline rich-text descriptions while preserving connector labels and legacy saved nodes.
- Headline and Description elements provide Left, Center, and Right alignment; Headline is inline-format only and Description exposes the full composer toolbar.
- Highlighted text opens a matching viewport-aware selection toolbar, and all fixed/floating toolbar controls retain compact typography inside large-text elements.
- Editable Tables provide exact row and column deletion with one-row/one-column minimum safeguards and synchronized column widths.
- Centered statements, callouts, lists, color-configurable Key Insights, feature cards, text blocks, roadmaps, and diagnostic flows. Key Insights retain the existing Green default and provide persistent Green/Blue/Red tabs in edit mode.
- Roadmap step-number position controls for Left, Center, and Right layouts; Center stacks the step copy and displays images at full available width.
- Roadmap steps upload images to shared Blob storage and edit Plain/Bullets/Checklist/Numbered text directly inside the composer while remaining compatible with previously saved image URLs.
- Feature Cards and Galleries use the shared upload flow; Gallery layout selection immediately creates the minimum responsive upload slots. Saved and editor Gallery tiles are square, show the complete uncropped source image, and open full-image previews from the already-loaded tile source without a second request.
- Private shared images now display through authenticated object-URL previews instead of broken direct `<img>` requests to bearer-protected media routes.
- Standalone Button elements support validated links, four widths, three alignments, secure new-tab navigation, and mobile full-width rendering.
- Video tutorials now render as a large responsive player inside the blue document header’s right column; Google Drive’s fixed toolbar is cropped outside the visible frame so its play control and playing content stay centered, while a compact new-tab icon preserves external viewing. Direct files use native playback, generic HTTPS links retain a safe fallback, and the redundant OPEN VIDEO text button is removed.
- Video Add/Pencil controls restricted to document edit mode.

### Quality

- ESLint passes.
- Strict TypeScript check passes.
- Twenty-two Vitest files and 124 tests pass.
- Production build passes and generates 15 routes/pages.
- Core desktop flows were visually verified in the local browser.
- Bookmark hydration mismatch was reproduced and fixed.

## Not implemented

- Secure cookie-based page authentication and account recovery.
- Organizations, workspaces, invitations, or row-level multi-tenant isolation.
- Amazon Ads API integration.
- Analytics, reporting automation, and PPC analyzers.
- Automated committed browser E2E suite.

## Recommended next milestone

1. Deploy and verify Pipeline's authoritative `/api/library-state` endpoint.
2. Deploy the Library adapter, scoped mutation client, polling/focus sync, and read-only cache behavior.
3. Create the protected immutable legacy Blob backup, then initialize the revision-zero Postgres catalog with the complete validated legacy catalog.
4. Complete authenticated multi-account browser verification for ADMIN, USER, VIEWER, conflict, deletion, recovery, and outage behavior.
5. Add committed Playwright coverage and secure cookie-based page authentication.
# Unified Glassco integration

- Production deployment `dpl_6xM9bVCRqW8dLUqGL8GXtymQRR1V` was released first on 2026-07-22 and aliased to `glasscoppc.vercel.app`; the canonical Pipeline gateway serves `/ppc/dashboard` with HTTP 200 and rejects unsigned session checks with HTTP 401.
- Added `/ppc` base-path support for pages, assets, and APIs, including the authenticated `/ppc/dashboard` coming-soon route.
- Replaced the combined switcher with three independent, responsive Product Pipeline, Team SOP Library, and PPC Dashboard new-tab cards with per-application active states and remembered routes.
- Added a 30-second one-use cross-tab handoff for session-only logins, preserved “Remember me,” and added validated post-login return destinations.
- Added Pipeline session verification and role-aware Team SOP Library administration.
- Protected shared-library reads and scoped writes through Pipeline: ADMIN has full access, USER may create/update documents, and VIEWER is read-only.
- Added legacy `glasscoppc.vercel.app` canonical redirect handling.

# WYSIWYG Library composers

- Added Tiptap 3.28.0 rich-text editors and static React rendering for all supported element body fields.
- Added selection-aware inline styles, bullets, numbers, editable checklists, accessible toolbar state, keyboard shortcuts, and responsive controls.
- Preserved standalone list elements with inline-only row formatting.
- Added validated JSON persistence, synchronized legacy fallbacks, lazy legacy Markdown conversion, and malformed-JSON recovery.
- Expanded automated coverage for shared-state validation/cache behavior, scoped permissions and conflicts, safe complete-catalog import, attributed recovery, catalog hydration, and the existing navigation/editor coverage.
- Completed authenticated same-origin browser verification with the production build: ADMIN edit, selection-aware toolbar state, editable checked checklist state, save, disabled/static reader rendering, full refresh persistence, edit-mode rehydration, cleanup, and zero browser warnings or errors.
- Restored visible disc/decimal markers in both editor and reader modes, aligned task-list checkbox/text rows, and normalized Tiptap ordered-list JSON so numbered formatting survives save and reader rendering.
