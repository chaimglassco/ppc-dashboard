# QA Checklist

## Campaign week-over-week comparison

- [ ] Select a completed week and confirm the selected Wednesday–Tuesday range is compared with the full preceding Wednesday–Tuesday range.
- [ ] Select a partial week and confirm both periods contain the same number of completed days, with Partial and the exact ranges visible.
- [ ] Confirm all six Sales/Spend/Orders increase/decline accordions begin collapsed and their headers show campaign counts plus combined changes.
- [ ] Open each accordion and confirm campaigns are sorted by primary-metric impact, the first ten appear initially, Show all exposes the remainder, and equal values appear in neither direction.
- [ ] Confirm every row shows Previous → Current Sales, Spend, and Orders plus absolute/percentage change. Verify New activity, No current-period activity, and a zero-current value's `−100%` handling.
- [ ] Open a campaign name and confirm the protected new tab is the exact Scale Insights campaign trend for its ID, sponsored type, and selected dates.
- [ ] Switch products/weeks quickly and confirm stale responses never replace the active comparison. Refresh Data must reload both weekly totals and the active campaign comparison without creating browser-storage entries.
- [ ] Verify loading, no-ASIN, no-campaign, empty-category, hosted-consent, malformed-data, pagination warning, provider-error, and Retry states at desktop and mobile widths with keyboard-accessible summaries.

Use this checklist before merging or deploying changes.

## Products reference rebuild

- Verify the first panel is a 300px white desktop column with a thin neutral right border, uppercase `PRODUCTS` title, neutral count badge, and one square plus action.
- Confirm the plus action opens Add product, Add tag, and Enable/Exit product editing; Escape closes the menu, and the existing dialogs still validate and persist browser-local catalog changes.
- Confirm search and tag filtering use compact bordered white controls and continue to filter by product name, ASIN, SKU, and tag.
- Confirm each product card has a 36px thumbnail, status dot, truncated name, and optional tag badge. The selected card must be solid black with white copy; inactive cards remain white with neutral borders.
- Exercise selection, add/edit/delete, Pipeline-product hiding confirmation, drag reorder, keyboard reorder, filtering, desktop scrolling, and 390px layout. Confirm the reporting and workspace panels retain their behavior and there are no hydration or console errors.

## Reporting Periods reference rebuild

- Verify the second panel is 340px wide on the desktop dashboard, white, square-edged, and separated by a thin neutral right border.
- Confirm the header reads `REPORTING PERIODS`, the calendar icon sits on the title row, and the current multi-month label remains centered inside one integrated previous/next control.
- Confirm visible ranges are abbreviated, while each period button’s accessible name states the full Wednesday–Tuesday range.
- Confirm the selected card has a two-pixel black border and white background. The current week must show the black Current badge, Week number, In Review cue, and its real report-status chip.
- Confirm each card has four bordered cells labeled Spend, Sales, Orders, and ACoS, populated from the existing PPC timeline fields. Past cards should show the selected product tag when present.
- Exercise previous/next range shifting, the multi-month dialog, current/future cutoff, report switching, cached metric hydration, keyboard focus, and narrow/mobile layout. Confirm the first and third panels retain their behavior and there are no hydration or console errors.

## Third-panel workspace hierarchy

- Verify goals/budget precede performance, followed by previous/current summaries and the action section.
- Verify five cards in each desktop metric row, Conversion Rate after Total Sales, and Total Orders after Org. Orders.
- Verify unavailable Conversion Rate stays a dash and no fabricated comparisons appear.
- Verify reference fonts, 24px spacing, 190px tiles, green/red deltas, TACOS gauge, and mobile wrapping.
- Exercise goal target/status/history, budget edits and expanded history, notes formatting/save/reload, action due dates/completion, Refresh Data, and JSON Export.
- Check that product and reporting-period panels retain their styling and behavior.
- Browser fixtures verify UI behavior only; production account/OAuth verification is separate.

## Product performance AI assistant

- [ ] Select a product and confirm a compact `Ask Performance AI` launcher appears at the lower-right without covering primary controls. Open, minimize, and reopen the accessible dialog at desktop and mobile widths.
- [ ] Ask each starter question and a typed question. Confirm the request contains only the selected product, active week, populated visible periods, bounded report planning context, and at most eight prior messages; switching product or week shows its separate conversation.
- [ ] Confirm the route opens Scale Insights MCP with the verified Pipeline subject, offers only read-only tools with an ASIN parameter, forcibly scopes calls to the selected ASIN/US/visible completed dates, and closes the session after generation. Attempt to prompt for another ASIN or an account-wide/mutating action and confirm it is not executed.
- [ ] Confirm answers distinguish Partial, Final, and saved/manual weeks, identify live Scale Insights facts separately from saved dashboard context, render as plain text, and refuse to invent unavailable data.
- [ ] Test a Pipeline user without a Scale Insights grant. Confirm the widget renders only a validated `Connect Scale Insights` link, hosted consent returns to the dashboard, and retry succeeds without exposing OAuth material.
- [ ] Confirm `/ppc/api/dashboard/ai-chat` rejects unauthenticated, malformed, oversized, invalid-ASIN, and active-week-missing requests; successful and error responses use `Cache-Control: no-store` and never expose Gateway/OIDC credentials or raw provider errors.
- [ ] Verify production with Vercel project OIDC and local development with `AI_GATEWAY_API_KEY`. Confirm the route delegates credential resolution to AI Gateway, and that an actual provider 401/403 or missing local key produces the bounded authentication message without exposing provider details or affecting the rest of the dashboard.

## Goal history and previous-week comparisons

Create or edit a goal, then use the circle-check Achieved action and verify it immediately leaves the active list and appears in Goal History with its target, actual, outcome, reporting week, and recorded date. Repeat with the X Missed action. Reload and switch weeks to confirm product-wide history persists. Verify Delete still removes without creating history, active status choices are limited to On Track/At Risk, malformed history is dropped, legacy terminal goals migrate, Escape/backdrop/Close dismiss the dialog, and other products do not expose this product's history.

Click Add Goal and verify the selector offers exactly Increase Spend, Decrease Spend, PPC Sales, Total Sales, PPC Order, Organic Order, Total Orders, ACOS, and TACOS. Confirm each Actual maps to its matching weekly metric and both Spend directions use actual spend. Select Organic Order and confirm Number/Percentage appears; Number must equal organic orders, while Percentage must equal rounded organic orders divided by total orders. Enter currency and percentage Targets and confirm they show two decimal places after blur; count Targets remain whole. Verify Actual is read-only, updates when refreshed Scale Insights metrics change, shows Waiting without a snapshot, Partial when the snapshot ends before Tuesday, and Final when it covers Wednesday–Tuesday. Resolve both a Partial and Final goal and confirm Goal History preserves the formatted Target, displayed Actual, and completeness label. Restore legacy Spend/Sales goal data and verify it maps to Decrease Spend/PPC Sales while unknown names are not discarded.

With adjacent weeks containing data, verify Weekly Performance displays four Sales Metrics cards in the first row, followed by three Order Volume and two Efficiency & Targets cards. Confirm every card uses a small vertical stack, keeps its centered title on one line, centers the current value and helper copy, uses a compact percentage badge, and centers the prior value in a `Prev. Week` footer without clipping or spillover. Lower Spend/ACOS/TACOS must be green; higher sales/orders must be green; movement in the unfavorable direction must be red; unchanged or unavailable comparisons show no badge. For an unavailable current week with a populated previous week, confirm current values show `0` with their symbol and no false 100% decrease badges. Confirm values such as 1667 display as 1,667 while stored precision remains unchanged. Verify the ACOS target-gap copy, TACOS helper copy, centered budget values, and removal of the redundant previous total-sales/TACOS line.

Enter Previous Week Result documentation, open the immediately following week, and confirm Carry-forward result and lessons is automatically populated. Confirm text already saved in the newer week takes priority.

## Target ACOS and ASIN-scoped Scale Insights navigation

Set Target ACOS below actual ACOS and verify only the ACOS card turns red; set it equal to or above actual and verify the warning clears. Confirm the entered value is centered. Reload and switch weeks/products to confirm the value follows its product/week report. Verify zero and malformed stored values do not warn.

For each of the eleven analysis links, confirm a new Scale Insights tab opens on the correct report and its URL contains the selected ASIN plus active-week scope. Confirm the header columns read Campaigns/Keyword Targeting/Product Targeting/Search Terms; Ad Types/Match Types/Placements/Main Keywords; and Daily/Weekly/Monthly Performance. These trend links must open Advertising Trend with seven 1-day, 7-day, and 30-day columns respectively, all ending on the selected Tuesday. Confirm changing product or week updates all eleven links. Verify no connector token or OAuth credential appears in the URL or browser storage. Confirm the selected-product identity row contains ASIN and SKU but no duplicate date/week label, timeline cards label PPC Sales and PPC Order, and timeline ACOS values have no decimals.

Create at least six budget changes. Confirm Budget History shows exactly five data rows on page 1, exposes numbered pages and previous/next controls, shows the remaining entries on page 2, and preserves all entries after reload.

## Budget history and multi-month timeline

Change a Weekly limit using multiple keystrokes, blur or press Enter, and verify exactly one newest-first history row appears with `Date of Change`, `From`, and `To`. Reload and confirm the row persists. Verify invalid stored rows are dropped and older reports without history still load. Confirm the reporting-period status chip may show Draft and that no separate Save Draft button is visible.

Select adjacent, non-adjacent, and cross-year months; apply the selection and verify only intersecting Wednesday–Tuesday weeks appear, duplicates are removed, future weeks stay hidden, boundary weeks and their extra month names remain visible, Escape/Close discards un-applied changes, and Select Year can display a full historical year.

## Saved weekly performance and smaller tags

Select or revisit an ASIN and verify the active week loads first while every other visible uncached week populates automatically without clicking its card. Switch among populated weeks, reload, and verify timeline cards and selected metrics retain their values without another performance request. Refresh must update only the selected ASIN/week and retain the last values on error. Verify zero-valued snapshots are reusable, malformed snapshots are ignored, storage failure is reported, week numbers appear at the upper-right of timeline cards without colliding with Current/status badges, compact tags remain readable, and the large weekly metric cards plus timeline ACOS values display rounded whole numbers.

## Compact product cards

Portfolio cards display the image, product name, and tag without ASIN/SKU rows. View-mode cards use a compact 66px minimum height; edit mode retains room for Edit, Delete, and Reorder controls. ASIN/SKU remain in the selected-product header, edit form, search index, and existing storage; this is presentation-only with no data migration. Verify both identifier links remain in the detail header after selecting a product.

## Product portfolio ordering

Check that reorder handles appear below Delete only in edit mode; drag a card up/down and confirm refresh retains its position. Verify keyboard Up/Down, filtered moves preserving unrelated slots, no-op/boundary moves, storage failure feedback, and continued selection/report association.

## Automatic listing images

Verify entering a valid ASIN previews its listing image, saving retains the image after refresh, manual upload wins over a pending lookup, changing/clearing ASIN cancels stale results, and unavailable images show a manual-upload fallback. Verify invalid ASINs, unauthenticated requests, mismatched metadata, non-image content, redirects and oversized downloads cannot return an image.

## Automated gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 266 tests passing and 6 skipped across 45 test files
- [x] `npm run build`

## Catalog and navigation

- [x] `/` redirects or opens the Library experience.
- [x] `/library` loads without a hydration error.
- [x] Glassco Back Office Library branding is visible.
- [x] Only the Category and Search filters are shown.
- [x] Search is case-insensitive and clears correctly.
- [x] Category filter combines with search.
- [x] Category arrow is inset from the right border.
- [x] View mode displays the Eye control.
- [x] Admin mode displays Pencil and Plus controls.
- [x] Plus remains visible in view mode and opens new-document creation.

## Document administration

- [x] Create a new document.
- [x] Edit and rename a document.
- [x] New-document editor shows title, description, and category without document type, tags, or Content Markdown fields.
- [x] New-document creation supplies the hidden type, tags, and legacy Markdown defaults.
- [x] Catalog admin cards do not show the removed Edit / Rename action.
- [x] Hide and show a document.
- [x] Move documents up and down.
- [x] Delete a document into recovery.
- [x] Deleted documents do not render as a recovery section below the catalog.
- [x] Admin toolbar recovery icon opens the deleted-document recovery dialog.
- [x] Recover a deleted document.
- [x] Deleted-document rows show direct-user, migration-system, backup-system, or unknown-source attribution.
- [x] Bulk recovery requires confirmation, shows progress/errors, and contains only migration-attributed document IDs.
- [x] A stale catalog revision or mixed eligibility returns a conflict without partial recovery.
- [x] Permanent delete uses an icon-only recovery-row action, requires a second confirmation, shows progress/errors, removes only a tombstoned document, and cannot be undone by backup restore.
- [x] Hidden/deleted documents are unavailable in normal reader mode.
- [x] Refreshing the catalog shows skeletons until saved state resolves; deleted seed documents never flash in the active list.

## Category administration

- [x] Open Manage Categories from admin mode.
- [x] Category Plus beside the document selector creates and selects a category.
- [x] Category Pencil beside the document selector opens category management.
- [x] Create a category.
- [x] Rename a category and update assigned documents.
- [x] Hide/show a category option.
- [x] Reorder category options.
- [x] Delete a category into recovery.
- [x] Deleted categories remain hidden until the recovery icon opens the recovery dialog.
- [x] Recover a deleted category.
- [x] Duplicate category names are rejected.

## Reader and structured builder

- [x] Open a document and return to Library.
- [x] Topic links scroll to their content.
- [x] Topic numbers follow the main topic order.
- [x] Full-title tooltip appears only for truncated sidebar titles.
- [x] Enter edit mode and open the element menu.
- [x] Enter edit mode and edit the document title, description, and category directly in the blue header.
- [x] Save header metadata together with structured elements while preserving document ID, slug, type, tags, and legacy Markdown.
- [x] Element menu remains inside the viewport and scrolls when needed.
- [x] Add, edit, and delete each supported element type.
- [x] Add multiple dropdown entries in one dropdown block.
- [x] Dropdown line breaks remain after saving.
- [x] Add rows and columns to a table.
- [x] Resize table rows and columns.
- [x] Saved table widths render in view mode.
- [x] Add checklist bullets.
- [x] A single Key Insight element offers Green, Blue, and Red color tabs, previews the choice immediately, persists it after save, and keeps legacy insights Green.
- [x] Roadmap step-number position saves as Left number, Center number, or Right number.
- [x] Roadmap image uploads save to shared Blob storage, preview through the authenticated media route, reject unsupported images and files over 2 MB, and can be removed.
- [x] Roadmap subtext edits inline as Plain, Bullets, Checklist, or Numbered rows; Enter, multiline paste, and empty-row Backspace preserve newline storage.
- [x] Feature Card and Gallery images use authenticated shared uploads with progress, validation, preview, replacement, removal, and legacy URL compatibility.
- [x] Private shared-image previews send the Pipeline bearer token, resolve to browser object URLs, render actual images in edit/view/modal surfaces, and revoke temporary URLs during cleanup.
- [x] Gallery layout changes create minimum upload slots and immediately display the selected responsive editor grid without deleting extras.
- [x] Gallery tiles remain square in edit and view modes, show square/portrait/landscape sources without cropping, and open the full-image modal from the tile’s resolved source without issuing a second authenticated image request.
- [x] Standalone Buttons validate internal and HTTP(S) links, persist width/alignment, open safely in a new tab, and become full-width on mobile.
- [x] Center number layout centers the number, title, and subtext and uses the full available width for the image.
- [x] View mode shows the Eye control; entering edit mode changes it to a Pencil without saving, reveals a separate `Save changes` button, and only that button persists changes and returns to view mode.

## Video tutorial

- [x] Add Video Link is hidden in document view mode.
- [x] Add/Pencil video controls appear in document edit mode.
- [x] Valid HTTPS, YouTube, and Google Drive links save.
- [x] YouTube and shared Google Drive links render a responsive 16:9 embedded player inside the blue document header’s right column; the Drive play control and playing content are centered in the visible frame.
- [x] Direct MP4/WebM/OGG links render native controls; other HTTPS links retain a safe open fallback.
- [x] No separate OPEN VIDEO text button renders; Google Drive retains a compact new-tab icon and generic links retain their safe fallback.
- [x] Video Pencil is hidden after returning to view mode.

## Reading state

- [x] Bookmark toggles and persists after refresh.
- [x] Recent documents are deduplicated and ordered newest first.
- [x] Completion state is independent from view history.
- [x] Malformed or unavailable storage falls back safely.
- [x] Server and client bookmark markup hydrate consistently.

## Accessibility and responsive checks

- [x] Icon-only controls have accessible names.
- [x] Keyboard focus is visible.
- [x] Buttons expose pressed/disabled state where appropriate.
- [x] Reduced-motion preference is respected.
- [x] Desktop layout has no page-level horizontal overflow.
- [ ] Re-run physical iOS Safari verification before a public release.
- [ ] Re-run physical Android Chrome verification before a public release.
- [ ] Complete an external WCAG audit before a public release.

## Shared persistence and authorization

- [x] Library reads require a verified Pipeline session.
- [x] Pipeline Postgres is the authoritative document/category store; `/ppc/api/library` is an adapter only.
- [x] Server authorization permits ADMIN full access, USER document create/update, and VIEWER read-only access.
- [x] Scoped mutations use global/record versions and return current state on `409` conflicts.
- [x] Deleted records remain tombstoned until explicit ADMIN restore.
- [x] Repository Markdown is not merged after initialization; legacy local admin/category snapshots are ignored and never uploaded.
- [x] Successful responses update a validated confirmed cache; outage fallback is read-only and disables mutations.
- [x] Visible tabs poll every five seconds and refresh immediately on focus.
- [x] Pipeline audit and backup/restore contracts are covered by automated tests.
- [x] Complete legacy import creates no new tombstones, and backup restore preserves backup-absent/newer active records.
- [ ] Complete production backup/restore verification after deploying Pipeline and before catalog initialization.
- [ ] Complete authenticated multi-account browser verification with dedicated ADMIN, USER, and VIEWER accounts.
- [ ] Move bearer authentication to secure same-origin cookies before treating returned HTML as access-controlled.
# Unified application checks

- [ ] `/ppc/library`, nested documents, recent, and bookmarks load directly and after refresh.
- [ ] `/ppc/dashboard` loads inside the authenticated full-width shell and renders Products, Reporting Periods, and Weekly PPC Performance workspace panels.
- [ ] Dashboard products combine the authenticated compact Pipeline list with the validated local catalog overlay, support search/tag-filter/retry/empty states, and never expose the full workspace response to the browser.
- [ ] Add Product accepts an optional image plus required name and optional ASIN, SKU, and tag; save selects the new card, ASIN and SKU open protected new tabs, and refresh preserves the product.
- [ ] Add Tag creates one reusable case-insensitive option, selects it in the filter, and exposes it in product forms; tagged cards show the tag instead of an active-status badge.
- [ ] Editing a Pipeline product creates only a dashboard-local override. Deleting is available only for dashboard-added products, retains weekly reports, and survives refresh.
- [ ] Selecting a product/week isolates its goals, weekly/daily budgets, performance metrics, prior-week result, notes, and action items.
- [ ] Selecting a product with an ASIN automatically requests every visible uncached Wednesday–Tuesday period and populates Spend, PPC Sales, PPC Orders, Total Sales, and Total Orders from Scale Insights without estimating values or requiring week-card clicks. Confirm the active week is requested first and at most two requests run concurrently. For the current week, confirm the request ends yesterday (UTC), the actual through-date and partial-week warning appear, and Wednesday/future weeks show “no completed days yet” without an MCP request.
- [ ] Organic Sales and Organic Orders equal non-negative total-minus-PPC values; ACOS equals Spend / PPC Sales and TACOS equals Spend / Total Sales, with zero-denominator behavior and two-decimal rounding verified.
- [ ] A verified Pipeline user without a Scale Insights grant receives a `Connect Scale Insights` link to an allowlisted Vercel HTTPS URL. Complete hosted consent and confirm return to `/ppc/dashboard` automatically retries the selected period.
- [ ] Successful Scale Insights imports lock the five source fields and Budget Actual spend, show data freshness, and support an explicit refresh. An unconfigured, unavailable, empty, malformed, or mismatched response leaves manual entry available with an actionable non-secret error.
- [ ] `/ppc/api/dashboard/performance` rejects unauthenticated requests, invalid ASINs, unsupported marketplaces, non-Wednesday starts, and differently scoped upstream results; successful responses include `Cache-Control: no-store`.
- [ ] Vercel OIDC credentials, Scale Insights OAuth grants, and Connect-issued access tokens are absent from client bundles, network response bodies, browser storage, and browser logs. The authorization-required response contains only the hosted consent URL and non-secret status fields.
- [ ] Save Draft and Save Weekly Report persist a schema-valid `glassco.ppcPerformanceNotes.v1` record, survive refresh, and clearly identify unsaved versus saved local state.
- [ ] At desktop widths all three panels remain usable; at narrow widths the panels stack without hiding save controls or producing inaccessible inputs.
- [ ] Missing and expired Pipeline sessions redirect to Pipeline with a validated requested PPC `returnTo`; temporary server failures remain on a retry gate.
- [ ] ADMIN sees full catalog/category controls and can save shared changes.
- [ ] USER can create/edit active documents but cannot delete, restore, reorder, or manage categories; forbidden direct `PATCH /ppc/api/library` returns `403`.
- [ ] VIEWER sees no mutation controls and direct `PATCH /ppc/api/library` returns `403`.
- [ ] All three application cards open their remembered routes in new browser tabs, including the active card, while the source page remains unchanged.
- [ ] Team SOP Library and PPC Dashboard active states follow `/ppc/library/*` and `/ppc/dashboard` independently.
- [ ] Legacy `{ pipeline, ppc }` route memory receives the dashboard fallback without losing its saved routes.
- [ ] Session-only handoff is consumed once into destination session storage and removed; malformed, expired, and wrong-target values are rejected; “Remember me” remains persistent.
- [ ] External, malformed, and unsupported `returnTo` destinations are rejected; successful login restores valid library and dashboard requests.
- [ ] The application cards remain keyboard accessible on desktop and mobile, preserve hover/focus states, scroll horizontally when needed, and do not overlap account controls.
- [ ] `glasscoppc.vercel.app` redirects to the equivalent canonical `/ppc` route without a loop.
- [ ] No hydration or browser-console errors appear.

## Rich-text composer

- [x] Every supported body field shows the full formatting toolbar in edit mode; excluded title, metadata, table, code, button, and flow fields remain plain.
- [x] Main and selection formatting toolbars are icon-only, expose accessible names/tooltips, and show visible separators between text styles, alignment, lists, and links.
- [x] Highlighting text near the bottom of a long editor opens the same compact toolbar beside the selection without scrolling the page.
- [x] Left, Center, and Right alignment persists in rich-text JSON; legacy Headline and Description alignment remains compatible.
- [x] Selected text supports adding, editing, and removing validated HTTP(S), email, and Library-relative links; reader links open in a protected new tab.
- [x] The neighboring Document link icon preserves highlighted text, loads one shared authoritative catalog on demand, searches title/category/description, excludes the current and unavailable records, supports retry/removal, and saves a protected `/ppc/library/:slug` link.
- [x] Selecting text and applying Normal, Bold, Italic, or Underlined updates only the selection and matches reader typography after save.
- [x] Bullets, Numbers, and Checklists can be toggled or converted, and toolbar `aria-pressed` states follow the cursor or selection.
- [x] Checklist state survives save and refresh; reader checkboxes are checked correctly and disabled.
- [x] Standalone Bullet Text, Checklist Bullets, and Numbered Text rows show only the four inline-style controls.
- [x] Pasting from Google Docs, Word, and webpages keeps supported formatting and safe links while removing media, colors, fonts, headings, unsafe URLs, and unsupported HTML.
- [x] Existing Markdown formatting appears correctly when first opened in structured edit mode.
- [x] Malformed rich JSON falls back to legacy text without removing the document.
- [x] Desktop and mobile toolbars remain keyboard accessible and do not create horizontal page overflow.
- [x] Formatting-save responses are verified for matching ID/slug, active lifecycle, advanced record version, and parseable matching content before edit mode closes.
- [x] Missing or malformed save responses keep the editor, unsaved formatting, and cached document visible; they never synthesize a deleted-document state.
- [x] Content updates cannot change hidden/status/deleted/archived fields, and unsafe links fail validation without losing the document.
- [x] A successful HTTP response with a malformed document/category or mismatched completeness count is rejected as a whole and cannot replace the confirmed cache.
- [x] A refresh that omits an active document without explicit deleted/archived/purged lifecycle metadata keeps the confirmed reader visible in read-only mode.
- [x] Cache reconciliation removes a document only for an explicit lifecycle transition and invalidates an active cache only after a verified version change.

## Live-state and stale-link checks

- [ ] Disconnect Pipeline, open the confirmed catalog and a confirmed document, and verify both remain read-only with snapshot time and revision.
- [ ] Restore connectivity and use Back/Forward; verify an immediate refresh occurs without waiting for polling.
- [ ] Delete a document in another ADMIN session; verify the first catalog explains that it is no longer active and removes its stale document cache.
- [ ] Open the deleted slug and verify deletion attribution plus ADMIN recovery; permanently purge a test tombstone and verify the slug reports that it cannot be recovered.
- [ ] Confirm Recovery performs a fresh request and normal catalog reads do not return tombstones or deletion-audit payloads.
- [ ] Confirm Reorder explains the difference between read-only mode and fewer than two active documents, and Recovery explains read-only mode versus no recoverable documents.
- [ ] With zero tombstones and no purged records, confirm Recovery opens without an empty permanent-deletion history card; when eligible bQool history exists, confirm that section appears.
- [ ] With fewer than two active documents, confirm Reorder is disabled with a visible explanation; after restoring/creating a second document, confirm it opens and saves.
- [ ] Confirm the final active document can be deleted after confirmation, the empty state offers Add document and Recovery, and Recovery can restore it.
- [ ] Reorder with drag and arrow controls; confirm Save order shows a spinner, blocks duplicates, closes on success, shows a four-second success toast, and preserves the pending order for retry after failure.
- [ ] Store active, hidden, and deleted bookmark IDs; confirm the hero badge counts only unique active, visible, published documents and that recovered bookmarked documents count again.
- [ ] Click Recovery with both requests delayed; confirm the modal shell appears immediately, each source shows independent loading/error state, and Try again works without closing the modal.
- [ ] Confirm protected restore lists only the approved bQool and Check Spend records as restorable, requires confirmation, preserves each original ID/slug/content, and leaves every other intentionally purged document unchanged.
- [ ] Confirm an approved record absent from the current snapshot can be discovered from a checksum-addressed legacy archive without exposing or restoring unapproved records.
- [ ] Open a report with a saved previous week and confirm every Weekly Performance card shows a compact current value, an upper-right percentage badge only when current data is available, and a separate `Prev. Week` footer; verify favorable/unfavorable colors follow the metric-specific rules.
- [ ] Open the earliest available report and confirm the Previous column displays a neutral unavailable marker without changing the current value color.
- [ ] Verify three-digit currency and percentage comparisons remain inside their Current and Previous columns, with the Current `%` directly adjacent to its number, and confirm the Scale Insights links read Daily Performance, Weekly Performance, and Monthly Performance.
