# Glassco Back Office Library — Product Specification

## September 11 automatic status, empty actions, and PPC conversion

The workspace has no manual Save button because edits are automatically saved. Reporting Periods labels cached full weeks Completed and cached incomplete weeks Partial from their actual coverage dates. Action Items begins empty until Add Action Item is selected. Goal status and outcome controls sit at the lower right beside the Partial/Final label; summary formatting controls sit at the upper right of the documentation label; the Sales WoW line sits below the Total Sales value.

PPC Conversion Rate equals PPC Orders divided by exact PPC Clicks. Scale Insights supplies clicks automatically from its single-ASIN advertising row or aggregate totals; the card contains no manual click field and displays the result as a whole percentage. If the connector omits an exact, unambiguous click count, the rate remains unavailable. Overall Orders/Sessions and non-reconciling search-term click totals are never substituted.

The ASIN row includes a keyboard-accessible copy button with copied feedback. ACOS goal Targets display without decimals. Strategic Weekly Goals omits the active-count badge and places Goal History and Add Goal together at the upper right.

## September 11 custom-goal and budget-card behavior

Budget Utilization remains top-aligned beside Strategic Weekly Goals and does not move its controls when the goal list becomes taller. The goal selector offers Custom Goal. A custom selection displays a manual goal-text field, keeps Target editable, leaves Actual unavailable because no live metric is mapped, and retains On Track/At Risk plus achieved, missed, and delete controls.

## September 11 compact goals and conversion rate

Each active goal displays Target on the first line and Actual directly below it. The On Track/At Risk selector and achieved, missed, and delete icon buttons share the same top-row control group. Previous Week Summary contains the label Performance Documentation and a vertically resizable read-only field. Both summary headers omit report-state badges, and the prior summary omits Completed, Status, archive, and ROAS metadata.

PPC Conversion Rate is displayed as a whole percentage. When the prior period also has PPC Clicks, the card shows its whole-number previous value and week-over-week direction.

## September 11 dashboard control revision

The workspace header presents **Refresh Data** and edits save automatically. Previous Week Summary is view-only and stays blank when no result was entered. The final card is titled **Action Items** and contains completion, title, priority, assignee placeholder, and delete controls without a due-date picker. Weekly goal progress places Actual below Target, and achieved/missed/delete buttons sit beside the status selector. Budget Utilization places the calculated daily limit inside the Weekly Limit tile and does not repeat daily limit or over/remaining balance outside the primary tiles.

## September 11 dashboard catalog behavior

The All Tags product view groups products in this order: Lead Came, Complementary, Homasote Board, Shard Catcher, Kiln Paper, then every other or untagged product. Existing saved order is preserved inside each group. Changing the tag filter selects the first product matching that tag and the active search, immediately updating Reporting Periods and the workspace. The current-period badge uses light blue, Partial uses light red, and the workspace product title no longer repeats the product tag.

## Campaign week-over-week comparison

Below the Previous and Current Week Summary cards, Stage 1 of Campaign Week-over-Week Comparison loads only the selected ASIN's previous matched reporting period from Scale Insights. It extracts campaign display name and Spend, plus campaign ID and sponsored type when the provider supplies them. The table is sorted by previous-week Spend, shows ten campaigns first with Show all when needed, and contains Campaign, Previous Week Spend, and Current Week Spend columns. Current Week Spend intentionally displays a blank dash until the next stage is implemented.

When Scale Insights supplies both campaign ID and sponsored type, the campaign name opens the previous period's exact campaign trend in a protected new tab; otherwise the name remains readable plain text. The section shows both date ranges, previous-data freshness, warnings, loading, consent, retry, provider failure, and empty states. Refresh Data reloads the baseline. Results remain in React memory for the page session and never change campaigns, bids, budgets, weekly notes, or browser-storage schemas. Increase/decline grouping and Sales/Orders comparison remain deferred until the previous Spend source is verified with live data.

Campaign retrieval requires a campaign grouping capability explicitly advertised by the connected Scale Insights MCP schema. The application never substitutes ASIN aggregate totals for campaign rows. Missing capability and unreadable-row responses have separate safe UI messages and correlation IDs; server diagnostics contain only tool/schema names and response structure, never campaign values, user data, or credentials.

The September 10 production contract check confirmed that the connected `get_ads_performance` tool has no campaign grouping input and that no dedicated campaign-reporting tool is advertised. Until that provider capability or another campaign-level source exists, the section displays a neutral capability notice without Retry because repeating the same request cannot produce campaign rows.

## Product performance AI assistant

The PPC dashboard provides a compact bottom-right Performance AI widget whenever a product is selected. It answers questions using the selected ASIN/product, active reporting week, available previous week, every populated reporting period in the current month selection, weekly budget and Target ACOS, active goals, action items, saved notes, and live read-only Scale Insights MCP tools. Suggested questions cover summary, ACOS movement, and next priorities; users can also type free-form performance questions. Every answer must distinguish Partial, Final, and saved/manual values, identify whether facts came from Scale Insights or saved dashboard context, and acknowledge unavailable data rather than inventing it.

Chat conversations are separated by product and active week and remain only in component memory for the current page session. They are not added to the browser report schema. The browser sends bounded context only after the user asks a question; an authenticated server route invokes the OpenAI model through Vercel AI Gateway and supplies only Scale Insights tools that are read-only and accept an ASIN scope. The route forcibly replaces generated ASIN, marketplace, and date arguments with the selected product and visible reporting range. Scale Insights OAuth, AI credentials, provider errors, and model internals are never returned to the client. A missing Scale Insights grant produces a hosted Connect link inside the widget.

## Product-panel hierarchy

The first panel follows the supplied HTML and image reference as a fixed 300px white product column. Its header places the uppercase Products title and neutral count together, with one square plus action on the right. Search and tag filtering use compact bordered white controls. Product cards use 36px thumbnails, a status dot, truncated product name, and optional neutral tag badge; the selected product is a solid black card with white copy. Add product, Add tag, and product-edit mode remain available from the plus action menu so the default header keeps the reference hierarchy. Existing local catalog validation, filtering, selection, editing, deletion, and reorder behavior remains unchanged.

## Reporting-period and workspace hierarchy

The second panel follows the supplied HTML reference as a 340px white reporting column. Its title and calendar action share one compact header row, the selected-month label sits between integrated previous/next controls, and period cards use abbreviated visible ranges with full Wednesday–Tuesday ranges retained as accessible names. The selected card uses a two-pixel black border; the current week carries a black Current badge, Week number, and In Review cue. Each card projects Spend, PPC Sales as Sales, PPC Orders as Orders, and ACoS in four bordered neutral cells. Non-current cards use the selected product tag when available. The existing multi-month picker, current/future cutoff, report selection, metric hydration, and local persistence remain unchanged.

## Third-panel workspace hierarchy

The third panel follows the supplied HTML reference: product header; Strategic Weekly Goals and Budget Utilization; Weekly PPC Performance; side-by-side Previous/Current Week Summary; Campaign Week-over-Week Comparison; and Action Items. Desktop metrics are two rows of five equal cards. Row one is Total Spend, PPC Sales, Organic Sales, Total Sales, and Conversion Rate. Row two is PPC Orders, Org. Orders, Total Orders, ACOS, and TACOS. Goals, budget history, current-week notes formatting, and action completion remain functional. Save retains local auto-save.

## Goal history and previous-week metric comparisons

Each active weekly goal has explicit Achieved and Missed actions beside Delete. Resolving a goal removes it from the active list and records its title, target, actual, outcome, completion time, and reporting week in the selected product's Goal History. The history button sits beside Add Goal and shows resolved goals across that product's saved weeks. Active status choices remain On Track or At Risk. Older terminal goals are migrated into history when restored.

Add Goal creates a structured selector with Increase Spend, Decrease Spend, PPC Sales, Total Sales, PPC Order, Organic Order, Total Orders, ACOS, and TACOS. Organic Order additionally supports Number or Percentage, where Percentage is organic orders divided by total orders. Actual is read-only and follows the matching selected-report metric; both Spend directions use actual spend. Currency and non-ACOS percentage Targets display two decimal places outside edit mode; ACOS and count Targets display as whole values. An available snapshot is labeled Partial until it covers the full Wednesday–Tuesday period and Final once complete; before data is available the field shows Waiting. Resolving a goal snapshots its current actual value and data state into Goal History.

Weekly Performance uses small grouped cards: four Sales Metrics cards across the first row, then three Order Volume cards and two Efficiency & Targets cards beneath them. Each card keeps its single-line centered title, current rounded value, helper copy, and centered `Prev. Week` footer in a stable vertical stack. A compact percentage-change badge appears only when current-period metrics are available. Favorable movement is green and unfavorable movement is red: lower is favorable for Spend, ACOS, and TACOS, while higher is favorable for sales and orders. Whole-number metric presentation uses thousands separators and unavailable current metrics render as an orderly zero instead of a detached symbol. The ACOS warning card also shows how far it is above Target ACOS; TACOS identifies itself as the total advertising ratio. Budget Weekly limit and Actual spend values remain centered, and the duplicate previous-week sales/TACOS summary remains removed from Previous Week Result.

When a user opens the following week, the read-only Previous Week Summary prefers result text already stored on the newer report, then the preceding report's result or notes. Existing text remains intact and is never overwritten.

## Target ACOS and ASIN analysis navigation

Each product/week report includes an editable Target ACOS beside Weekly Performance. When Target ACOS is greater than zero and actual ACOS exceeds it, the ACOS metric card changes to a red warning treatment; meeting the target or leaving it unset uses the normal card treatment.

The selected-product header provides links to Campaigns, Keyword Targeting, Product Targeting, Search Terms, Match Types, Placements, Ad Types, Main Keywords, and three Scale Insights trends. The links are arranged in three columns: Campaigns/Keyword Targeting/Product Targeting/Search Terms, Ad Types/Match Types/Placements/Main Keywords, and a visually separated trend column containing Daily, Weekly, and Monthly Performance. Each opens the matching Scale Insights page in a new tab with the validated ten-character ASIN and active Wednesday–Tuesday week. Trend links open Scale Insights' Advertising Trend with seven columns of 1, 7, or 30 days respectively, ending on the selected Tuesday. The compact product identity row keeps ASIN and SKU but omits the duplicate active-week date, and the Target ACOS value is centered in its field.

Reporting-period cards summarize Spend, PPC Sales, PPC Order, and ACOS for the selected ASIN. Budget History displays the five newest changes per page and exposes numbered pagination for older locally stored entries.

## Budget history, report controls, and multi-month timeline

Each product/week report shows a compact budget-history table with `Date of Change`, `From`, and `To` columns. One entry is recorded when a Weekly limit edit is committed by blur or Enter; intermediate keystrokes do not create rows. Reporting-period cards expose their existing report status in the reference status chip; the separate Save Draft button remains absent. The Current Week Summary omits its report-status badge, and the primary control is Save.

The reporting-period picker supports multiple selected months across years, plus a one-click full-year selection. The timeline displays the unique Wednesday–Tuesday weeks that intersect a selected month, includes weeks crossing a month boundary, omits future weeks, and labels the header with the months actually covered.

## Saved weekly performance and smaller tags

Fetched performance is saved in this browser per US ASIN and reporting week. Selecting or revisiting a product automatically retrieves every visible reporting week that does not already have a valid snapshot, prioritizing the active week. Returning to a saved week or reloading displays its saved metrics and coverage without another request. Only Refresh updates the active saved snapshot; pending/failed refreshes preserve the last values. Week numbers sit at the upper-right of their cards, and the large grouped weekly metric cards plus timeline ACOS values show rounded whole numbers while retaining exact source values in storage. Portfolio tag badges use compact 7px text and reduced padding.

## Compact product cards

Portfolio cards display the image, product name, and tag without ASIN/SKU rows. View-mode cards use a compact 66px minimum height; edit mode retains room for Edit, Delete, and Reorder controls. ASIN/SKU remain in the selected-product header, edit form, search index, and existing storage; this is presentation-only with no data migration. Verify both identifier links remain in the detail header after selecting a product.

## Product portfolio ordering

In product edit mode, each card has a drag handle below Delete. Users can reorder by dragging or with Up/Down keys. The order is saved in this browser; filtered reordering changes only visible slots.

## Automatic listing images

Adding a product with a valid ASIN automatically looks up its US Amazon listing thumbnail through Scale Insights. The form previews the image before saving, allows manual replacement, and leaves manual upload available when no image is returned.

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
- **LIB-ADMIN-018** — ADMIN recovery shows who or what deleted every document, with an unknown-source fallback when historical evidence is incomplete.
- **LIB-ADMIN-019** — ADMIN may explicitly confirm one atomic recovery of all documents attributed to the Initial Library cleanup; manually deleted documents are excluded.
- **LIB-ADMIN-020** — Legacy initialization imports the complete catalog without newly tombstoning documents, and backup restore cannot delete backup-absent or newer active records.
- **LIB-ADMIN-021** — ADMIN may permanently delete an already-deleted document only after a separate confirmation; the content is removed, the actor audit is retained, and backup restore cannot recreate it.
- **LIB-ADMIN-022** — Recovery remains available while connected even when no ordinary tombstones exist, so ADMIN can inspect permanent-deletion history and perform the explicitly approved bQool repair.
- **LIB-ADMIN-023** — Reorder is available only when at least two active documents exist, and the UI explains how to enable it when the catalog contains fewer.
- **LIB-ADMIN-024** — ADMIN may delete the final active document after confirmation; the resulting empty Library offers Add document and Recovery actions, and the tombstone remains recoverable.
- **LIB-ADMIN-025** — “Monitor Product Listing Prices Through BQool” and “Check Spend with No Sales” may be explicitly restored with their original IDs, slugs, and content from the newest trusted snapshots; no other purged document is restored automatically.
- **LIB-ADMIN-026** — Reorder shows immediate save progress, prevents duplicate submissions, closes after confirmed success, and preserves the selected order with a retryable error after failure.
- **LIB-ADMIN-027** — Recovery opens immediately and loads recoverable documents and permanent-deletion history independently with visible progress and retry actions.
- **LIB-READ-007** — The bookmark badge counts only unique bookmarked documents that are currently active, visible, and published while retaining stale bookmark IDs for future recovery.

### Structured builder

- **LIB-BUILDER-001** — Documents support separate view and edit modes. The reader control shows an Eye in view mode and a Pencil in edit mode; entering edit mode never saves, and an explicit `Save changes` action is the only main builder control that persists the draft and returns to view mode.
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
- Direct Amazon Ads API integration beyond the Scale Insights reporting connector.
- PPC analyzers, audits, reporting automation, collaboration, and analytics.
- Public sharing and billing.

These require a separately approved milestone and must preserve the current shared-state and stable-ID contracts.
# Unified Glassco application behavior

- Team SOP Library is presented at `/ppc/library/*`; PPC Dashboard is the authenticated `/ppc/dashboard` weekly performance documentation workspace.
- Three responsive application cards remain visible in the reserved top bar, with the active application shown in white text on blue.
- Clicking any application card, including the active card, opens its remembered route in a new browser tab and leaves the current page unchanged.
- Team SOP Library and PPC Dashboard remember routes independently and otherwise open `/ppc/library` and `/ppc/dashboard` respectively.
- A session-only Pipeline login is handed off once to the destination tab; missing or expired authentication returns to the requested safe PPC route after login.
- A verified Pipeline session is required before the PPC interface renders.
- Dashboard users select a real Pipeline product, choose a Wednesday–Tuesday reporting period, and document weekly goals, weekly/daily budget limits, current performance, prior-week results, summary notes, and next-week actions.
- Current-week performance includes actual values only through yesterday (UTC), with an explicit partial-week warning. Today and future days are excluded, and a week with no completed days shows an availability message. Completed weeks retain the exact Wednesday–Tuesday scope.
- When the selected product has an ASIN, the dashboard automatically requests exact-period Spend, PPC Sales, PPC Orders, Total Sales, and Total Orders for each visible uncached week through the authenticated server-side Scale Insights connector. The application calculates Organic Sales, Organic Orders, ACOS, and TACOS, displays freshness or mismatch warnings for the active week, and allows an explicit active-week retry. Vercel Connect scopes the OAuth grant to the stable, server-verified Pipeline user; a user without a grant receives a hosted one-time consent action. OAuth credentials and access tokens must never be sent to frontend code or browser storage.
- Pipeline products remain authoritative source records. The dashboard may layer browser-local names, ASINs, SKUs, images, and tags over them without changing Pipeline, and users may add/edit/delete dashboard-only products. The Products panel supports tag creation and filtering, renders tags instead of active-status badges, and opens saved ASIN/SKU destinations in protected new tabs. Report drafts and catalog customizations are versioned browser-local data; shared dashboard persistence is deferred.
- ADMIN can create/edit/reorder/hide/delete/recover documents, manage categories, and manage backups. USER can create and edit active documents. VIEWER is read-only apart from personal reading controls.

# Rich-text composer behavior

- Supported element body fields provide selection-aware Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls with a live WYSIWYG editing surface.
- The formatting toolbar is icon-only and separated into Text styles, Left/Center/Right alignment, Lists, and Link groups. A matching viewport-aware selection toolbar appears beside highlighted text.
- Highlighted text can receive a validated HTTP(S), email, or Library-relative link through a compact URL editor; saved links open in a protected new tab and can be edited or removed from the same control.
- A neighboring Document link control lazily loads the authoritative catalog, searches reader-visible documents by title/category/description, and applies the selected `/ppc/library/:slug` destination without exposing hidden, draft, deleted, archived, incomplete, or self-link targets.
- Titles, labels, metadata, button text, tables, code blocks, and diagnostic-flow nodes remain plain-text controls.
- Standalone list-element rows retain their element-level markers and omit nested-list controls while keeping text styles, alignment, and links.
- Pasted content is constrained by the editor schema to supported paragraphs, marks, safe links, lists, and checklists; images, colors, fonts, headings, unsafe URLs, and arbitrary HTML are not persisted.
- Checklist boxes are editable in admin mode and disabled in reader mode.
- **LIB-BUILDER-012** — A formatting save is accepted only when Pipeline returns the same active document ID and slug, a newer record version, and parseable matching content. Verification failure keeps edit mode and unsaved formatting open.
- **LIB-BUILDER-013** — Content formatting cannot alter visibility, publication status, deletion, archive state, identity, or slug. Only explicit lifecycle actions may remove a document from the active catalog.

# Library live-state behavior

- During an outage, the last confirmed document list or document remains readable with its snapshot time and revision, while every shared mutation stays disabled.
- Returning from a document, restoring a browser-cached page, changing visibility, or focusing the app revalidates immediately.
- A stale deleted-document link explains when and how it was deleted and offers ADMIN recovery while its tombstone exists.
- A permanently purged link explains that recovery is unavailable.
- Reorder states whether it is blocked by connectivity or fewer than two active documents. Recovery remains enabled while connected and opens a fresh view of tombstones plus permanent-deletion history.

## Weekly metric comparison

- Every Weekly Performance metric emphasizes the current value and places the previous value in a separate footer row; the upper-right percentage-change badge is omitted until current-period data is available.
- The previous value remains neutral. The current value and direction arrow are green when it increased, red when it decreased, and neutral when unchanged or when no previous week is available.
- Compact metric typography must keep currency and percentage symbols inside their corresponding Current or Previous column.
- Scale Insights trend destinations are labeled Daily Performance, Weekly Performance, and Monthly Performance without a redundant “Trend” suffix.
