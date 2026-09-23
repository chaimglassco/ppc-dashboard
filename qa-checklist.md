# QA Checklist

## September 22 workspace recovery and chunked Products checks

- [x] Confirm the Products route normalizes an inline Pipeline workspace and a chunked `binary-v2` manifest with versioned chunks.
- [x] Read the authoritative Pipeline workspace after recovery and confirm 23 products, with `B0D1PHP7HQ` and `B0DYSBW3X5` present and no existing product removed.
- [ ] After the next Library deployment, authenticate at `/ppc/dashboard`, confirm the Products count and both recovered ASIN searches, and verify the chunked response does not render as an empty catalog.

## September 21 account Campaign Compare checks

- [ ] Confirm Dashboard, Products, and Compare tabs expose the correct active `aria-selected` state and the existing Products workflow remains intact.
- [ ] Confirm Day compares adjacent completed dates, Weekly uses Wednesday–Tuesday periods, and Monthly uses completed calendar months.
- [ ] Upload two whole-account Campaign CSVs, verify the period labels, reject a recognizable mismatched filename, reload, and confirm saved snapshots restore.
- [ ] Confirm a next adjacent comparison reuses the saved previous snapshot and only requires the new current file; Replace CSVs can replace either slot.
- [ ] Verify CampaignId joining, zero-filled missing campaigns, duplicate aggregation, identity-conflict rejection, and the Spend change calculation.
- [ ] Select each single Spend Movement option and confirm only that result set appears; verify All is the default, the filtered count/combined change updates, and Show all reveals rows beyond ten.
- [ ] Sort Previous Spend, Current Spend, Spend Change, and Change % in both directions and verify campaign links open the Scale Insights trend.
- [ ] Confirm account comparison storage contains parsed snapshots without raw CSV text and remains independent of ASIN-specific comparison data.

## September 22 account comparison outcome checks

- [ ] Confirm Good, Bad, and Neutral filter groups match the existing campaign outcome rules and only one selected card controls the table.
- [ ] Verify Spend Up/Sales Up, Spend Down/Sales Up, Spend Up/Sales Down, Spend Down/Sales Down, Spend but No Sales, New Spend/High ACOS, and Unchanged/Mixed classifications.
- [ ] Confirm the selected table includes Previous/Current Spend, Spend Change, Previous/Current Sales, Sales Change, Orders, and Current ACOS.

## September 22 shared dashboard persistence checks

- [ ] Sign in as ADMIN at `/ppc/dashboard` with an empty shared store, confirm the migration prompt lists only local datasets absent online, download the local backup, and import them.
- [ ] Sign in from a second browser/session and confirm the imported catalog, reports, performance cache, account comparison, and opportunity cache load without local browser state.
- [ ] Edit a shared report and catalog value, reload from another session, and confirm the change persists; exercise Refresh team data and retry after a simulated conflict.
- [ ] Confirm VIEWER can read shared dashboard state but cannot upload or mutate it, and malformed/oversized payloads return bounded errors without replacing the confirmed state.
- [ ] Confirm the state route returns no-store responses, rejects missing/invalid Pipeline sessions, stores no raw CSV or credentials, and preserves a before-write history object.

## September 15 Dashboard disclosure and filter checks

- [ ] Confirm all seven Dashboard data sections are closed by default and expand/collapse independently from their full summary rows.
- [ ] Filter by a full or partial ASIN, SKU, and product name; confirm 7/14/30-day cards, ASIN rows, coverage values, product count, latest update, and detail scope all use the same matched products.
- [ ] Clear the filter and confirm the account-wide totals and rows return.
- [ ] Confirm search controls and disclosure summaries remain usable at mobile widths.

## September 15 dashboard-view checks

- [ ] Confirm Products is initially selected and Dashboard/Products tabs expose correct `aria-selected` state while switching without losing the selected product or reporting week.
- [ ] Confirm Dashboard renders five temporal cards, the ASIN Velocity table, and four detailed ledger scaffolds. Today/Yesterday and unconnected datasets must say unavailable/source pending rather than showing reference sample data.
- [ ] With saved current and prior weekly reports, confirm 7/14/30-day totals, weighted ACOS/TACOS, account shares, and ASIN Sales momentum derive from those records.
- [ ] Confirm Total Sales WoW appears above the Total Sales value and below its title.

## September 11 automatic-save and PPC-conversion checks

- [x] Confirm the header has Refresh Data and no Save action; edit notes/goals/actions and verify the existing debounce persists changes.
- [x] Confirm a full cached Wednesday–Tuesday range renders Completed and shorter cached coverage renders Partial without manual status mutation.
- [x] Confirm a new report has no Action Items row until Add Action Item is selected, and an explicitly empty stored array remains empty after reload.
- [x] Confirm goal status/outcome controls share the footer with Partial/Final, the summary toolbar shares the documentation-label row, and Sales WoW is absent below SKU and present below Total Sales.
- [x] Confirm 23 PPC Orders / 48 automatically retrieved PPC Clicks calculates 47.92% and renders 48%, while Total Sessions alone does not populate PPC Conversion Rate.
- [x] Confirm missing advertising-total PPC Clicks uses the complete same-ASIN/week Search Term Performance click total, removes the missing-click warning, and leaves the rate unavailable when that result is incomplete.
- [x] Confirm the advertising request uses one ASIN row, discovers exact click aliases in a scoped row, and adds no provider call.
- [x] Copy the selected ASIN by mouse and keyboard, confirm the exact ten-character value reaches the clipboard, and confirm copied feedback is announced.
- [x] Confirm ACOS goal Targets and PPC Conversion Rate display without decimals, the active-goal count is absent, and Goal History/Add Goal share the upper-right header group.

## September 11 custom-goal and planning-alignment checks

- [x] Add at least three goals and confirm Budget Utilization remains top-aligned with no blank spacer above Weekly Limit.
- [x] Select Custom Goal, enter arbitrary text including a predefined metric phrase, set a Target and status, then reload and confirm it remains a custom goal.
- [x] Switch a custom goal back to a predefined metric and confirm the manual field disappears and automatic Actual resumes.
- [x] Resolve and delete custom goals and confirm Goal History and removal behavior use the manual title.
- [x] Verify keyboard operation, narrow wrapping, horizontal overflow, hydration, and console errors.

## September 11 compact-goal, summary, and conversion checks

- [x] Confirm Actual renders directly below Target for every goal and all three icon buttons share the status-selector row.
- [x] Confirm Previous Week Summary is labeled Performance Documentation, contains a read-only textarea, and can be resized vertically without changing its value.
- [x] Confirm Archived, Completed, Status, ROAS, and the Current Week Summary Draft/status badge are absent from the summary cards.
- [x] Confirm the superseding PPC Conversion Rate definition uses PPC Orders divided by PPC Clicks, renders current/previous values without decimals, and retains the correct week-over-week direction.
- [x] Restore a legacy performance cache entry without PPC Clicks and confirm it remains valid and shows the unavailable state.
- [x] Verify keyboard focus, desktop/mobile wrapping, horizontal overflow, hydration, and console errors.

## September 11 workspace-control checks

- [x] Confirm Refresh Data appears in the workspace header and no duplicate Refresh button remains in Weekly PPC Performance.
- [x] Confirm previous-week text appears in a read-only, vertically resizable textarea with no formatting toolbar or empty-result warning.
- [x] Confirm the final card is named Action Items and each row has no due-date input while existing stored records still parse.
- [x] Confirm every weekly goal displays Target before Actual and its achieved, missed, and delete controls remain keyboard accessible.
- [x] Confirm Weekly Limit shows Daily limit inside its tile, Spend retains the single remaining/overspent detail, and no duplicate balance row appears below the tiles.
- [x] Verify the affected workspace at desktop and mobile widths with no horizontal overflow, hydration warning, or console error.

## September 11 tag-filter and period-style checks

- [x] In All Tags, confirm Lead Came products precede Complementary, Homasote Board, Shard Catcher, and Kiln Paper, with other/untagged products last and stable ordering inside each group.
- [x] Change tag filters and confirm the first matching visible product becomes selected and drives Reporting Periods and workspace data immediately, including the All Tags reset.
- [ ] Confirm Current is light blue, Partial is light red, and no tag badge appears beside the workspace product name at desktop and mobile widths.
- [ ] Confirm product-card tags and previous-period tag metadata remain visible and keyboard product selection still works.

## Campaign week-over-week comparison

- [ ] Select a completed week and confirm the table requests campaign data only for the immediately preceding Wednesday–Tuesday range.
- [ ] Select a partial week and confirm the displayed previous/current ranges have the same completed-day length, while only the previous range is requested.
- [ ] Confirm campaigns are sorted by Previous Week Spend, the first ten appear initially, and Show all exposes the remainder.
- [ ] Confirm each row shows campaign name, populated Previous Week Spend, and a pending dash for Current Week Spend.
- [ ] Open a campaign name and confirm the protected new tab is the exact Scale Insights campaign trend for its ID, sponsored type, and previous-period dates.
- [ ] Switch products/weeks quickly and confirm stale responses never replace the active baseline. Refresh Data must reload the previous Spend request without creating browser-storage entries.
- [ ] Verify loading, no-ASIN, no-campaign, hosted-consent, malformed-data, pagination warning, provider-error, and Retry states at desktop and mobile widths.
- [x] Supply a tool schema without campaign grouping and confirm no provider call occurs, the API returns `campaign_capability_missing` with a correlation ID, and the UI explains that weekly totals remain available.
- [ ] Supply an unrecognized positive campaign response and confirm `campaign_rows_unreadable`; verify logs contain schema/property names, structural paths, counts, content types, and table headers without ASINs, campaign names/IDs, Spend values, user data, tokens, or raw payloads.
- [x] After the approved diagnostic deployment, trigger one authenticated production request, find both correlated diagnostic events in Vercel logs, and record the advertised contract. Reference `7274368f-fc45-4e62-ab36-cd7d799273f1` confirmed no campaign grouping input and no dedicated campaign-reporting tool.
- [ ] Do not approve the final provider fix until production returns `200`, real previous-week campaign rows render, their Spend reconciles with Scale Insights for the same ASIN/dates, and no hydration or console errors occur.

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
- Verify PPC Conversion Rate uses PPC Orders ÷ PPC Clicks; older periods without exact clicks stay unavailable and never receive fabricated comparisons.
- Verify reference fonts, 24px spacing, 190px tiles, green/red deltas, TACOS gauge, and mobile wrapping.
- Exercise goal target/status/history, budget edits and expanded history, current-note formatting/save/reload, action completion, Save, and Refresh Data.
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

Click Add Goal and verify the selector offers exactly Increase Spend, Decrease Spend, PPC Sales, Total Sales, PPC Order, Organic Order, Total Orders, ACOS, and TACOS. Confirm each Actual maps to its matching weekly metric and both Spend directions use actual spend. Select Organic Order and confirm Number/Percentage appears; Number must equal organic orders, while Percentage must equal rounded organic orders divided by total orders. Enter Targets and confirm currency plus non-ACOS percentages show two decimals after blur, while ACOS and count Targets remain whole. Verify Actual is read-only, updates when refreshed Scale Insights metrics change, shows Waiting without a snapshot, Partial when the snapshot ends before Tuesday, and Final when it covers Wednesday–Tuesday. Resolve both a Partial and Final goal and confirm Goal History preserves the formatted Target, displayed Actual, and completeness label. Restore legacy Spend/Sales goal data and verify it maps to Decrease Spend/PPC Sales while unknown names are not discarded.

With adjacent weeks containing data, verify Weekly Performance displays four Sales Metrics cards in the first row, followed by three Order Volume and two Efficiency & Targets cards. Confirm every card uses a small vertical stack, keeps its centered title on one line, centers the current value and helper copy, uses a compact percentage badge, and centers the prior value in a `Prev. Week` footer without clipping or spillover. Lower Spend/ACOS/TACOS must be green; higher sales/orders must be green; movement in the unfavorable direction must be red; unchanged or unavailable comparisons show no badge. For an unavailable current week with a populated previous week, confirm current values show `0` with their symbol and no false 100% decrease badges. Confirm values such as 1667 display as 1,667 while stored precision remains unchanged. Verify the ACOS target-gap copy, TACOS helper copy, centered whole-dollar Budget limit/Actual/Burn Rate Progress values, and removal of the redundant previous total-sales/TACOS line.

Enter Previous Week Result documentation, open the immediately following week, and confirm the value appears in the read-only Previous Week Summary. Confirm text already saved in the newer week takes priority.

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
- [ ] Save persists a schema-valid `glassco.ppcPerformanceNotes.v1` record, survives refresh, and clearly identifies unsaved versus saved local state.
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
- [ ] Campaign Week-over-Week Comparison labels the exact previous/current Wednesday–Tuesday CSV slots for the selected ASIN, accepts the Scale Insights Campaign export headers, and rejects missing/malformed columns, negative values, identity conflicts, and recognizable filename ranges that do not match the slot.
- [ ] A valid CSV pair joins by CampaignId, aggregates only compatible duplicate IDs, treats a missing weekly campaign as zero, saves under `glassco.ppcCampaignCsvComparison.v1`, restores after reload, and remains isolated when switching product or week. Replace CSVs updates only the active scope.
- [ ] Every imported campaign appears exactly once across the seven dropdowns. Verify the two Good rules, four Bad rules, Neutral, the inclusive 15% new-spend ACOS threshold, and precedence for Spend but No Sales This Week followed by New Spend with high ACOS. Confirm previous-week-only no-Sales campaigns follow the movement rules and no Lost Current-Week Sales dropdown appears.
- [ ] In two different campaign dropdowns, toggle every numeric header from highest-to-lowest to lowest-to-highest. Confirm sorting uses the displayed metric, Orders uses current-week Orders, unavailable ACOS remains last, `aria-sort` follows the active header, and each dropdown keeps its own sort selection.
- [ ] Each campaign table shows previous/current Spend and Sales, changes, Orders, and whole-number current ACOS. High ACOS is visually distinct, horizontal overflow remains contained, and campaign links open the fixed Scale Insights trend for both periods with protected new-tab attributes.
- [ ] The Untargeted Sales Opportunities card appears immediately below Campaign Week-over-Week Comparison and has no separate Load Opportunities, Fetch Again, or Retry control.
- [ ] Workspace **Refresh Data** requests the selected ASIN and Wednesday week once for weekly performance and once for PPC search-term opportunities; an in-progress week ends yesterday and shows `Partial`, while a completed week shows `Final`.
- [ ] Clicking each Impressions, Clicks, Spend, Sales, Orders, and ACOS header toggles descending/ascending order locally and does not call the opportunity endpoint again.
- [ ] The table summary totals the currently filtered Spend, Sales, and Orders and shows weighted ACOS as total Spend divided by total Sales.
- [ ] Every opportunity row has an accessible copy button that writes the exact term, shows Copied feedback, and returns from the checkmark to the copy icon after two seconds. Confirm a repeated copy restarts the feedback period.
- [ ] After Refresh Data, every opportunity source icon opens Scale Insights Search terms with the selected ASIN and report start/end dates and copies the selected row value for pasting into Instant Search.
- [ ] Confirm keyword rows have no green per-row campaign-creation icon; copy and Scale Insights source controls remain.
- [ ] Select two or more keyword opportunity checkboxes and confirm Create Bulk Campaigns opens one Scale Insights Customize page with the advertised ASIN and every selected term on its own keyword line. Confirm the header checkbox selects and clears all visible keyword rows, Product ASIN rows have no checkbox, and the bulk action is disabled with zero selections.
- [ ] Import adjacent campaign weeks, move to the following week, and confirm the prior current-week file is shown as reused while only the new current file is required. Confirm a different ASIN, country, or nonmatching period still requires both files.
- [ ] Every displayed row comes from PPC Search Term Performance, has at least one attributed Order, and is explicitly uncovered. Text terms lack an exact-match keyword. Product ASINs are absent from the complete Product Target Performance result for the selected advertised ASIN. Unknown, absent, incomplete, aggregate-only, zero-order, and already-targeted coverage never appears as `Not targeted`.
- [ ] Search terms and product ASINs render with Impressions, Clicks, Spend, Sales, Orders, whole-number ACOS, and a blue `Not targeted` badge; product ASIN links open Amazon safely.
- [ ] Type, minimum Sales, and maximum ACOS criteria filter locally without additional MCP/API calls; Show all expands beyond the first ten rows.
- [ ] Switching products/weeks and returning, including after a page reload, restores the latest validated cached result without another MCP request.
- [ ] A later workspace **Refresh Data** request replaces the cache only for its active product/week and does not implicitly fetch another selected product.
- [ ] Opportunity authorization, empty, capability-missing, malformed-search, malformed-coverage, partial, and provider-error states are actionable and contain no sensitive provider values.

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

## Account performance overview checks

- [ ] Reconcile ASIN Targeting with Product Target Performance for the applied dates and ASIN filter, including every provider page. Confirm nested product/category rows display, auto/audience rows are absent, repeated target ASINs remain separate, and the targeted ASIN is never displayed as the advertised ASIN.
- [ ] Sort Clicks, Spend, Sales, Orders, Conversion Rate, ACOS, and ROAS in both directions; verify missing values stay last and sorting makes no provider request. Verify the keyword endpoint cannot populate ASIN Targeting even when it appears first in the tool catalog.

- [ ] Confirm the temporal ledger is visible without opening a disclosure, every card places TACOS below ACOS, and Overview Source Coverage is absent.
- [ ] Confirm Daily Performance Quick Stats appears directly below the cards and the plot spans nearly the full panel width. Verify the chart has exactly two lines: red Spend and green PPC Sales. Each line uses its own peak scale, the selected line is emphasized, and every marker remains a tiny perfect circle at desktop and narrow widths. Confirm Total Sales, ACOS, and TACOS remain aggregate stats without line-selection behavior. Reconcile every plotted completed day with Scale Insights for the applied dates and ASIN filter. Hover dots and date regions at the left edge, center, and right edge; confirm the popup remains inside the chart and lists all five actual daily values. Confirm today/future dates are absent and no extra request occurs when switching or hovering metrics.
- [ ] Apply a valid custom range and reconcile Yesterday, 7-Day, 14-Day, and selected-range totals with Scale Insights; confirm Today remains unavailable and an end date of today is capped at yesterday.
- [ ] Open Keyword, Product/ASIN Target, and Search Term sections and reconcile row metrics with the same ASIN and selected period in Scale Insights.
- [ ] Reconcile Campaign Movers and Anchors against the dedicated campaign report for the applied range, including all provider pages, status, Spend, Sales, Orders, ACOS, ROAS, CPC, CTR, CVR, and Daily Budget. Confirm its account-wide scope is visible and no ASIN/traffic figures are invented.
- [ ] Click each campaign metric header twice; confirm descending then ascending order, missing values last, updated `aria-sort`, and no new provider request.
- [ ] Filter by ASIN, SKU, and product name; confirm the ASIN-capable live requests, cards, ranking rows, and detailed tables follow the filtered ASIN scope. Campaigns remain explicitly account-wide because the provider supplies no ASIN mapping.
- [ ] Reconcile every ASIN ranking row with Scale Insights for the applied range: Total Sales, Spend, Total Orders, Spend/PPC Sales ACOS, Spend/Total Sales TACOS, scoped Spend/Sales shares, and Total Sales momentum against the immediately preceding equal-length range.
- [ ] Click Refresh All and confirm one new overview request uses the unchanged applied dates and ASIN scope, then refreshes every temporal card and disclosure table without duplicating rows.
- [ ] Confirm Spend Share has a centered light-red background and Sales Share has a centered light-green background at desktop and mobile widths.
- [ ] Confirm authorization, unsupported multi-ASIN capability, empty period, malformed response, provider error, and local fallback states are explicit and reveal no credentials.

Verify currency goal targets show $70 rather than $70.00 after blur and in history, while editing preserves entered precision.

Verify summary defaults, icon-only +, active-topic formatting, inline title rename, deletion, and both reorder directions. Reload and switch product/week to verify scoped content and order. Restore legacy notes intact; reject malformed/duplicate topic IDs, preserve an explicit empty topic list, and confirm previous summaries/chat show the derived ordered notes.

Summary topic validation: lint, typecheck, production build, and 356 tests passed (6 skipped). Local /ppc/library and /ppc/dashboard reached the Pipeline sign-in gate without console warnings/errors; authenticated visual verification remains unavailable in the test browser.

Verify every opportunity metric shows its filtered total above the sortable label, including Impressions/Clicks and weighted ACOS. Confirm totals include collapsed rows and update with criteria. Confirm the MCP-usage notice is absent and bulk creation remains in the match summary toolbar with selection and disabled states intact.

Verify opportunity metric totals, sortable labels, row values, and Status are centered at desktop and narrow widths. Confirm Search Term remains left aligned, checkbox alignment is intact, and compact rows remain legible with horizontal scrolling.

## Six-week weekly performance table

- [ ] Select a product and verify Weekly PPC Performance renders exactly six Wednesday–Tuesday columns, with the selected week highlighted at the far right and the five preceding weeks ordered left to right.
- [ ] Confirm row order is Impressions, Clicks, CPC, Spend, PPC Sales, PPC Orders, PPC Units, Organic Sales, Organic Orders, Organic Units, Total Sales, Total Orders, Total Units, ACOS, TACOS.
- [ ] Reconcile Total Sales, Total Orders, and Total Units with the same Scale Insights weekly snapshot and confirm they appear directly above ACOS.
- [ ] Reconcile imported Spend, PPC Sales, orders, clicks, impressions, and units with Scale Insights. Confirm CPC equals Spend / PPC Clicks and Organic Units equals Total Units - PPC Units when both are available.
- [ ] Confirm imported cells are read-only, missing optional provider metrics display an em dash, and switching weeks reuses the saved cache without a new request.
- [ ] Check the compact Analysis trend bars and verify there are no hydration or browser console errors.

## Weekly traffic metric completion

- [ ] Restore revision-1 cached weeks and confirm all six visible weeks refresh once to revision 2 without requiring manual week selection.
- [ ] Reconcile Impressions and Clicks with complete ASIN-scoped Search Term Performance for each date range, and confirm CPC equals weekly Spend divided by refreshed Clicks.
- [ ] Confirm incomplete search-term pagination never displays a partial Impression total and produces a bounded warning.
- [ ] Confirm PPC Units and Organic Units remain unavailable when Scale Insights does not expose exact PPC-attributed units; no order-to-unit estimate may be shown.
