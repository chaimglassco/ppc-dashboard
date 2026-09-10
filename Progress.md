# Project Progress

## September 11, 2026 — Workspace control refinements

Condensed the workspace header to vertically stacked Save and Refresh Data actions and removed the duplicate refresh control from Weekly PPC Performance. Made Previous Week Summary read-only, removed its empty-result warning, renamed the final card Action Items, and removed action due-date inputs without changing stored action compatibility. Weekly goals now present Target before Actual and stack outcome controls vertically. Budget Utilization now shows Daily limit inside Weekly Limit and removes the duplicated secondary detail row. No API or browser-storage schema changed.

## September 11, 2026 — Tag-driven product selection

The All Tags catalog now groups products as Lead Came, Complementary, Homasote Board, Shard Catcher, Kiln Paper, then all remaining tags and untagged products while retaining saved order inside each group. Every tag-filter change selects the first visible matching product so its reporting periods and workspace data appear immediately. The reporting-period Current badge is light blue, Partial is light red, and the workspace heading no longer repeats the selected product tag. No storage schema changed.

## September 10, 2026 — Campaign week-over-week comparison

Reduced the campaign diagnostic to a verifiable Spend-baseline stage. When campaign grouping is available, the server makes one Scale Insights request for the previous matched period and requires campaign name and Spend; campaign ID and sponsored type are optional. The table sorts those campaigns by Spend, shows ten first with Show all, and leaves Current Week Spend as an explicit pending dash. Loading, freshness, warning, consent, retry, provider failure, empty, stale-request, Refresh Data, protected trend links, and memory-only caching remain included. Current-period retrieval, deltas, Sales/Orders, and mover grouping are deferred until this first live source is confirmed.

The live-provider adapter recognizes nested campaign/entity records, formatted Spend strings, `const`-based grouping choices, embedded JSON, and MCP text-table rows while preserving strict scope, identifier, and nonnegative-Spend validation.

Deployed the production diagnostic gate at commit `c68cdc9` and correlated authenticated request `7274368f-fc45-4e62-ab36-cd7d799273f1`. The live `get_ads_performance` schema has ASIN/date/ad-type/paging/sorting/summary inputs but no campaign grouping, and the connector advertises no dedicated campaign-reporting tool. Campaign loading correctly stops before an aggregate call. The current connection cannot provide the real campaign Spend rows needed for Stage 1, so the dashboard presents a neutral capability notice without a Retry loop. Enabling the comparison requires a future Scale Insights campaign-reporting capability or another campaign-level source.

## September 10, 2026 — Reference-based first-panel rebuild

Rebuilt Products from the supplied HTML and image as a fixed 300px white panel with the reference title/count row, single plus action, bordered search and tag controls, 36px thumbnails, status dots, neutral tags, and a solid-black selected card. The plus action opens the existing Add product, Add tag, and product-edit controls, preserving local catalog validation, filters, selection, dialogs, deletion, and drag/keyboard reorder. The completed second- and third-panel rebuilds and all storage/API contracts remain intact. This work is local and has not been deployed.

## September 10, 2026 — Reference-based second-panel rebuild

Rebuilt Reporting Periods from the supplied HTML and image as a 340px white panel with the reference uppercase header, calendar placement, integrated month control, compact neutral cards, black Current/selection treatment, abbreviated visible date ranges, status chips, tag metadata, and four boxed statistics. Existing month selection, Wednesday–Tuesday boundaries, current-week cutoff, report switching, cached performance hydration, and local schemas remain intact. The completed third-panel rebuild is preserved. This work is local and has not been deployed.

## September 10, 2026 — Reference-based third-panel rebuild

Rebuilt the workspace from the supplied HTML with the corrected Total Orders tile and unavailable Conversion Rate card. Added isolated reference typography/layout, compact editable goals, expandable budget history, summary footers, and action completion. Retained the original first two panels and all existing API/storage boundaries at that stage. Later refinements removed the export and visible action dates. Browser fixture checks cover desktop/mobile layout and note persistence; final validation results are recorded in HANDOFF.md.

Last updated: September 9, 2026

## Third-panel workspace redesign

Rebuilt the selected-product workspace to closely reproduce the supplied compact monochrome reference while preserving every existing interaction. Weekly PPC Performance now leads with the reference date-comparison header, Target ACOS badge, live-sync control, four sales cards, PPC/organic order donut, order-share cards, and ACOS/TACOS radial gauges. Strategic Weekly Goals and Budget Utilization now follow as paired cards with progress rows, allocation/spend tiles, burn-rate pacing, and the existing paginated history. Thin neutral borders, centered metric typography, restrained black accents, and responsive fallbacks replace the earlier oversized control-center treatment without changing stored data.

## Larger Weekly Performance metrics

Redesigned Weekly Performance into two structured rows matching the requested visual hierarchy: Sales Metrics spans four cards, while Order Volume and Efficiency & Targets share the second row. Follow-up refinements substantially reduced card height and typography, centered titles and values, kept titles on one line, restored the intended vertical content flow, rendered current zero values beside their symbols, and suppressed false 100% comparison badges while current-period data is unavailable. Each card retains a compact centered `Prev. Week` footer. ACOS retains its red target warning and states the target gap; TACOS includes a total-advertising-ratio hint. The change is responsive and does not alter stored metric precision or report schemas.

## Product performance AI assistant

Added a compact floating Performance AI chat to the selected-product dashboard. It combines the active week, available prior week, populated visible-period trends, budget/Target ACOS, goals, actions, and notes with live read-only Scale Insights MCP tools; it provides starter questions and accepts free-form prompts. Conversations are isolated by product/week and remain session-only. The authenticated, no-store `/ppc/api/dashboard/ai-chat` route uses Vercel AI Gateway with OpenAI GPT-5.6 Sol plus the existing per-user Vercel Connect grant. Runtime MCP tools must be non-destructive and ASIN-scoped, while server-side argument enforcement pins every call to the selected ASIN, US, and visible completed dates. Added bounded tool output, hosted authorization recovery in the widget, runtime OIDC resolution through AI Gateway, safe provider/MCP errors, untrusted-context instructions, and route/widget regression tests.

## Goal history and previous-week metric indicators

Added Achieved and Missed goal actions that remove resolved goals from the active list and persist them in a product-wide Goal History dialog. Added backward-compatible parser migration and validation for terminal legacy goals. Weekly Performance comparisons retain rounded comma-formatted metrics, centered budget inputs, rounded Actual spend, and no redundant prior sales/TACOS summary.

Expanded structured goals to Increase Spend, Decrease Spend, PPC Sales, Total Sales, PPC Order, Organic Order, Total Orders, ACOS, and TACOS. Organic Order can be measured as a count or percentage of total orders. Goal Actual fields are read-only live projections of cached/imported weekly performance and display Waiting, Partial, or Final completeness; resolved history captures the derived actual and completeness state. Currency/percentage Targets show two decimals, legacy Spend/Sales goals migrate safely, and preceding Previous Week Result documentation automatically carries into the following week's field.

## Target ACOS warnings and product-scoped Scale Insights navigation

Added an auto-saved, centered Target ACOS to every weekly report and a red ACOS-card warning when actual efficiency exceeds the configured target. Eleven compact header links now open their real Scale Insights reports with the selected ASIN and active week applied. Daily, Weekly, and Monthly Performance Trend are isolated in a third column and open seven-column Advertising Trend views using 1-, 7-, and 30-day aggregation. The temporary internal report pages were removed, the header's duplicate date/week label was removed, and timeline ACOS is rendered as a whole number.

Reordered the first two Scale Insights columns into the requested workflow, tightened Current percentage suffix spacing, changed timeline summaries to PPC Sales/PPC Order, and paginated Budget History at five rows per page without altering stored history.

## Budget history, cleaner report controls, and multi-month timeline

Added per-week budget-change rows, removed visible Draft badges and the secondary Save Draft action, and introduced an apply-based multi-month/year picker with boundary-week inclusion, future-week exclusion, deduplication, and coverage-aware labels. Added parser, date-range, selection, persistence, and UI regression coverage.

## Saved weekly performance and smaller tags

Fixed fetched metrics disappearing after reload: imports previously updated only React report state and were not included in the dirty-report save flow. Added validated ASIN/week snapshots, timeline hydration, active-week-first automatic backfill for every visible uncached week with two-worker concurrency, explicit-refresh-only updates for the active saved week, and failure retention. Added reload/navigation/backfill/refresh regression coverage, moved week numbers into the upper-right of timeline cards, compacted portfolio tag badges, and reduced weekly metric cards with whole-number presentation.

## Compact product cards

Portfolio cards display the image, product name, and tag without ASIN/SKU rows. View-mode cards use a compact 66px minimum height; edit mode retains room for Edit, Delete, and Reorder controls. ASIN/SKU remain in the selected-product header, edit form, search index, and existing storage; this is presentation-only with no data migration. Verify both identifier links remain in the detail header after selecting a product.

## Product portfolio ordering

Added edit-only drag handles below each product's Delete icon, keyboard reordering, drag/drop feedback, and browser-persisted product order. Filtered moves preserve non-visible slots; existing catalogs remain compatible.

## Automatic listing images

Added automatic ASIN image lookup to the product form using Scale Insights' actual Amazon thumbnail. Manual uploads remain available. No credentials enter frontend code and no catalog schema or existing product data is changed.

## Overall status

The Glassco Back Office Library is buildable with Pipeline-authenticated, Postgres-authoritative shared persistence, scoped versioned mutations, read-only outage caching, and cross-account synchronization.

## 2026-09-07 — Current-week Scale Insights date correction

- Reproduced the production scope error with live MCP calls: a September 2–8 request returned September 2–6 from both reports because Scale Insights excludes today and future days.
- Cap upstream requests at yesterday in UTC, retain strict marketplace/date matching, return the actual end date, and add a partial-week warning. A week with no completed days returns an actionable no-store `404` without querying MCP.
- Added date-controlled regression coverage for partial weeks, completed weeks, Wednesday, and future weeks. No estimates, new credentials, or storage schema changes.

## 2026-09-07 — Vercel Connect authorization

- Replaced static Scale Insights OAuth/access-token configuration with `@vercel/connect` and the attached `mcp.scaleinsights.com/glassco-scale-insights` connector.
- Bound every token request to the stable user ID returned by server-side Pipeline session verification, namespaced by the Pipeline issuer.
- Added a no-store hosted consent response and dashboard `Connect Scale Insights` action for users who have not granted access; returning to the dashboard triggers its existing automatic sync.
- Added URL allowlisting and regression coverage so OAuth credentials, Vercel OIDC material, Connect tokens, and raw MCP responses never enter browser storage or response payloads.

## 2026-09-04 — Scale Insights weekly performance

- Added an authenticated, no-store `/ppc/api/dashboard/performance` route backed by the official MCP client and server-only Scale Insights credentials.
- Added strict query and upstream response validation for exact ASIN, marketplace, and Wednesday–Tuesday reporting scope.
- Added concurrent `get_ads_performance` and `get_sales_data` retrieval for Spend, PPC Sales, PPC Orders, Total Sales, and Total Orders.
- Centralized Organic Sales, Organic Orders, ACOS, and TACOS calculations in the dashboard domain layer.
- Added automatic dashboard sync, freshness/error/warning feedback, explicit refresh, and imported-field locking with manual fallback when the connector is unavailable.
- Added focused domain, MCP adapter, API route, and UI coverage. Production credential configuration and authenticated live-data smoke testing remain deployment steps.

## 2026-07-28 — Library control reliability

- Replaced the reorder query's JSON-scalar expansion with delimiter-safe scalar encoding and ordered PostgreSQL expansion.
- Added reorder save progress, duplicate-submit protection, success close/toast behavior, and retryable inline errors that preserve the selected order.
- Reconciled the bookmark badge against unique active, visible, published documents without deleting stale browser-local bookmark IDs.
- Made Recovery open immediately and load normal Recovery and permanent-deletion history independently with progress and retry states.
- Allowed ADMIN to delete the final active document into a recoverable empty-Library state with Add document and Recovery actions.

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

- View and edit modes now expose their Eye/Pencil state explicitly, with a separate manual `Save changes` button in edit mode so the mode indicator cannot accidentally submit a document.
- Responsive element picker that flips to available viewport space.
- Topic numbering and sidebar synchronization.
- Repeatable dropdown entries with multiline preservation.
- Editable tables with add-row, add-column, row-height, and column-width controls.
- One unified Bullets element with Bullets, Checklist, and Numbers tabs; previously saved standalone list types remain compatible.
- Diagnostic Flow steps support independent multiline rich-text descriptions while preserving connector labels and legacy saved nodes.
- Replaced word-based rich-text controls with a compact icon-only toolbar grouped by text styles, Left/Center/Right alignment, lists, and links; the same controls follow highlighted text in a floating selection menu.
- Headline and Description alignment now lives inside the shared formatting toolbar while legacy element-level alignment remains dual-written for compatibility; Headline continues to omit list controls.
- Added safe link creation, editing, removal, Markdown/paste preservation, new-tab reader rendering, and rejection of unsafe URL schemes.
- Added a searchable Document link control beside the URL-link icon. One lazy authoritative catalog is shared across all editors, unsafe/unavailable targets are excluded, and selected documents persist as protected new-tab `/ppc/library/:slug` links.
- Hardened formatting persistence end to end: client and server canonicalize rich-text JSON, content-only updates preserve document identity/lifecycle, and the reader verifies the authoritative active document plus advanced version before closing edit mode.
- Incomplete, stale, or malformed formatting responses now preserve the open editor, unsaved changes, and reader cache. Only explicit lifecycle status can show a deleted, purged, or archived document state.
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
- Fifty-one Vitest files pass with 307 passing tests and 6 intentionally skipped tests.
- Production build passes and generates 15 routes/pages.
- Core desktop flows were visually verified in the local browser.
- Bookmark hydration mismatch was reproduced and fixed.

## Not implemented

- Secure cookie-based page authentication and account recovery.
- Organizations, workspaces, invitations, or row-level multi-tenant isolation.
- Direct Amazon Ads API integration beyond the Scale Insights reporting connector.
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
- Added `/ppc` base-path support for pages, assets, and APIs, including the authenticated `/ppc/dashboard` route.
- Replaced the combined switcher with three independent, responsive Product Pipeline, Team SOP Library, and PPC Dashboard new-tab cards with per-application active states and remembered routes.
- Added a 30-second one-use cross-tab handoff for session-only logins, preserved “Remember me,” and added validated post-login return destinations.
- Added Pipeline session verification and role-aware Team SOP Library administration.
- Protected shared-library reads and scoped writes through Pipeline: ADMIN has full access, USER may create/update documents, and VIEWER is read-only.
- Added legacy `glasscoppc.vercel.app` canonical redirect handling.

# Weekly PPC Performance workspace

- Replaced the dashboard placeholder with a responsive three-panel product, reporting-period, and weekly documentation UI based on the approved Stitch reference.
- Added an authenticated compact product-catalog proxy backed by Pipeline workspace state.
- Added editable weekly goals, weekly/daily budget limits, performance metrics, previous-week outcomes, summary notes, and next-week action items.
- Added product and tag management to the first panel: accessible add/edit/delete dialogs, optional browser-local images, reusable tag creation/filtering, protected ASIN and SKU links, and tag pills replacing active-status badges. Pipeline products are customized through a non-destructive local overlay.
- Added versioned, validated browser-local draft/report persistence with explicit unsaved and saved feedback.
- Added route, state-contract, API normalization, shell-layout, and idempotent UI coverage. Shared multi-browser PPC report persistence remains a future milestone.

# WYSIWYG Library composers

- Added Tiptap 3.28.0 rich-text editors and static React rendering for all supported element body fields.
- Added selection-aware inline styles, bullets, numbers, editable checklists, accessible toolbar state, keyboard shortcuts, and responsive controls.
- Preserved standalone list elements with inline-only row formatting.
- Added validated JSON persistence, synchronized legacy fallbacks, lazy legacy Markdown conversion, and malformed-JSON recovery.
- Expanded automated coverage for shared-state validation/cache behavior, scoped permissions and conflicts, safe complete-catalog import, attributed recovery, catalog hydration, and the existing navigation/editor coverage.
- Completed authenticated same-origin browser verification with the production build: ADMIN edit, selection-aware toolbar state, editable checked checklist state, save, disabled/static reader rendering, full refresh persistence, edit-mode rehydration, cleanup, and zero browser warnings or errors.
- Restored visible disc/decimal markers in both editor and reader modes, aligned task-list checkbox/text rows, and normalized Tiptap ordered-list JSON so numbered formatting survives save and reader rendering.

## Live-state stabilization

- Normal Library reads now exclude tombstones and avoid deletion-audit work.
- ADMIN Recovery performs a fresh recovery-specific read with attribution.
- Catalog and reader caches record snapshot metadata, reconcile on browser history restoration, and invalidate stale document entries.
- Deleted and permanently purged slug routes now render explicit states; recoverable deleted routes provide an ADMIN recovery action.
- Added automated coverage for Recovery request scoping, stale cache invalidation, `pageshow` revalidation, and deleted-link recovery.
- Kept ADMIN Recovery available at zero tombstones and added a separate permanent-deletion history view.
- Added an explicit, confirmed bQool-only repair from the newest trusted pre-purge snapshot while preserving all other permanent deletions.
- Replaced the final-document safeguard with intentional empty-catalog support; the final document can be tombstoned and recovered like any other document.
- Clarified Reorder availability and the authoritative empty-Library state.
- Hid the permanent-deletion history card when it has no records, while preserving protected bQool restoration when eligible history exists.
- Extended the explicit protected restore allowlist to “Check Spend with No Sales,” using its newest trusted Pipeline backup while preserving its original identity and leaving all other purged records untouched.
- Added read-only discovery across checksum-addressed legacy Library archives when an approved record is absent from the current snapshot and Pipeline backups.

## Authoritative catalog reconciliation

- Added strict all-or-nothing document/category parsing so one malformed row cannot silently shorten a catalog.
- Added required live-response lifecycle manifests and same-snapshot completeness counts.
- Preserved the last confirmed reader/catalog copy in read-only mode when a live response is malformed, incomplete, or omits an active document.
- Limited cache removal to explicit deleted/archived lifecycle metadata and verified active record-version changes.
- Kept verified formatting saves in the reader and per-document cache while rejecting incomplete mutation confirmations.
- Added regression coverage for partial HTTP 200 responses, lifecycle reconciliation, formatting saves, refresh omission, and legacy cache fallback.
- Pipeline and Library automated gates pass locally; production deployment and authenticated multi-account verification remain pending.

## Weekly comparison layout

- Replaced the corner-sized previous-week annotation with equal-size Current and Previous columns in every Weekly Performance metric card.
- Added a center divider and moved red/green direction styling to the current value and arrow only.
- Tightened the shared comparison typography to prevent percentage overflow and shortened the three Scale Insights performance-link labels.
