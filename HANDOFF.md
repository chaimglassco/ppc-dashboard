# Glassco PPC Dashboard Handoff

Last updated: September 11, 2026

## September 11, 2026 — compact goals, prior documentation, and Conversion Rate

- Goal Actual now sits directly below Target. The active status selector and achieved, missed, and delete buttons form one compact inline group.
- Previous Week Summary always shows a Performance Documentation label and vertically resizable read-only textarea. Archived/Completed/Status/ROAS metadata is removed, and Current Week Summary no longer shows Draft or another report-status badge.
- Weekly performance now reads `Summary.TotalSessions` from the existing Scale Insights sales request and calculates Conversion Rate as Total Orders divided by Total Sessions. A live Sep 2–8 check for B0H8P24MP4 returned 42 orders and 87 sessions, matching Scale Insights at 48.28%.
- `totalSessions` and `conversionRate` are optional in version-1 report/cache parsing for backward compatibility. Old snapshots stay valid with an unavailable dash and populate after Refresh Data; no new storage key or migration exists.
- Lint, typecheck, all 310 tests across 51 files (6 skipped), the production build, and `git diff --check` pass. Controlled browser QA at the app browser's 327px viewport confirmed Actual below Target, the status and three icons on one row, native vertical resizing on the read-only prior documentation, all removed summary metadata absent, Conversion Rate at 48.28% with a 48.36% prior value, zero horizontal overflow, and no console or hydration errors.

## September 11, 2026 — workspace control refinements

- Workspace actions are now stacked in the product header as Save then Refresh Data; Weekly PPC Performance retains its sync/authorization text without a second refresh control.
- Previous Week Summary is read-only and suppresses the former “No outcome summary was entered” placeholder. Existing `previousWeekResult` values and preceding notes remain visible through the current fallback order.
- The final card is Action Items. Due-date inputs are hidden while the optional stored `dueDate` field remains accepted for backward compatibility.
- Weekly goals render the read-only Actual directly below Target and place achieved, missed, and delete buttons beside the status selector. Budget Utilization places Daily limit inside Weekly Limit and removes the duplicated secondary daily/balance row.
- This is a presentation-only change: no storage key, report schema, API, authentication, or provider contract changed.
- Lint, typecheck, all 310 tests across 51 files (6 skipped), the production build, and `git diff --check` pass. A live browser fixture loaded a stored prior result and action due date, then confirmed the new controls, target/action geometry, empty-summary behavior, budget copy, no horizontal overflow, and no hydration or console errors at the app browser's 327px mobile viewport. Desktop structure and order are covered by the same responsive component and regression assertions.

## September 11, 2026 — tag-driven product selection

- All Tags applies a stable display priority of Lead Came, Complementary, Homasote Board, Shard Catcher, Kiln Paper, then remaining/untagged products. The existing saved product order remains the tie-breaker inside each group, and the browser-storage schema is unchanged.
- Changing the tag filter immediately selects the first product matching the selected tag and current search so Reporting Periods and workspace data switch with it. Initial loading also selects the first product from the ordered merged catalog.
- Current is light blue, Partial is light red, and the workspace product name no longer repeats its tag badge. The product cards and prior-period tag metadata retain their existing tags.
- Lint, typecheck, all 310 tests across 51 files (6 skipped), production build, and `git diff --check` pass. Local browser verification used a deliberately scrambled six-product catalog and confirmed the exact tag grouping, initial and filter-driven selection, `rgb(219, 234, 254)` Current background, `rgb(255, 241, 242)` Partial background, no redundant title tag, no page overflow, and no hydration or console errors.

## September 10, 2026 — campaign week-over-week comparison

- Campaign Week-over-Week Comparison is reduced to a Stage 1 Spend baseline below the paired summaries. The authenticated no-store route makes one Scale Insights request for the previous matched period and requires only campaign name and Spend; campaign ID and sponsored type are retained when available.
- The table sorts by Previous Week Spend, shows ten first with Show all, and leaves Current Week Spend as an explicit pending dash. Campaign links open the exact previous-period Scale Insights trend. Current retrieval, deltas, Sales/Orders, and mover groups remain deferred.
- The provider adapter accepts nested campaign/entity records, formatted Spend strings, `const`-based grouping choices, embedded JSON, and MCP text tables while retaining exact scope and nonnegative-Spend validation. Baselines remain in React memory and no browser-storage contract changed.
- Production deployment `dpl_AiPseuCo3En2hqSbrT1W8xTAg3fJ` at commit `c68cdc9` reached READY. Authenticated request `7274368f-fc45-4e62-ab36-cd7d799273f1` verified that `get_ads_performance` exposes only `account_ref`, `ad_type`, `asin_list`, `count`, `country`, `days`, `end_date`, `mode`, `page`, `sort_by`, `sort_direction`, `start_date`, and `summary_only`; it exposes no campaign grouping field. The other advertised read-only tools are inventory, organic-upside, exact-coverage, product-metadata, search-query, and underwater-product reports, with no dedicated campaign-reporting tool.
- The adapter correctly stopped before making an aggregate advertising request and returned `campaign_capability_missing`. The current Scale Insights connection therefore cannot supply real campaign Spend rows. The UI presents this as a neutral provider limitation without a futile Retry control. Do not describe the live campaign table as working; enabling it requires a future Scale Insights campaign-reporting capability or another campaign-level source.
- Lint, typecheck, all 307 passing tests across 51 files (6 skipped), and the production build pass. Local browser verification covers missing-capability, unreadable-row, and populated-table states, including correlation IDs, pending Current Week values, protected links, and responsive overflow containment.

## September 10, 2026 — local first-panel redesign

- Products was rebuilt from the supplied HTML/image reference as a fixed 300px white column. The header now has the compact uppercase title and count on the left and one square plus action on the right; search and tag filtering use bordered white controls.
- Product cards now use 36px thumbnails, a small status dot, truncated names, optional neutral tag badges, white inactive surfaces, and a solid-black selected state. The default layout matches the reference without removing catalog functions.
- The plus action opens Add product, Add tag, and Enable/Exit product editing. Existing local validation, image lookup/upload, Pipeline-product hiding confirmation, filtering, selection, dialogs, deletion, and drag/keyboard reorder remain intact. The menu is transient and no API or storage schema changed.
- Production-browser verification confirmed the 300px white panel, one-pixel neutral divider, 32px search/tag controls, 62px cards with 36px thumbnails, solid-black selected state, working search and product selection, plus-menu actions, Escape dismissal, and a 390px layout without horizontal overflow. The dashboard and `/ppc/library` produced no browser warnings or exceptions. Lint, typecheck, all 283 tests across 47 files (6 skipped), and the production build pass. This redesign is local and has not been deployed.

## September 10, 2026 — local second-panel redesign

- Reporting Periods was rebuilt from the supplied HTML/image reference as a 340px white column. The reference hierarchy is now uppercase title plus calendar action, integrated month navigation, and 12px-spaced neutral period cards.
- Visible dates use compact ranges such as `Aug 26 – Sep 1, 2026`; each button retains the full Wednesday–Tuesday range in its accessible name. The selected card has a two-pixel black border, the current week has a black Current badge plus Week/In Review metadata, and every card exposes its existing report status.
- The four reference statistic cells read Spend, Sales, Orders, and ACoS while projecting the existing Spend, PPC Sales, PPC Orders, and calculated ACOS fields. Past periods show the selected product tag when one exists.
- Multi-month/year selection, future-week exclusion, report switching, metric backfill/cache overlay, browser-local reports, and all first/third-panel interactions remain unchanged. No API, storage, or data-contract migration is required.
- Clean production-browser verification confirmed a 340px white panel, one-pixel neutral divider, two-pixel black selected border, Geist/mono typography, correct Spend/Sales/Orders/ACoS projections, full accessible week names, working period selection and month dialog, 390px responsive fit without page overflow, and no browser exceptions. Lint, typecheck, all 283 tests across 47 files (6 skipped), and the production build pass. This redesign is local and has not been deployed.

## September 10, 2026 — local third-panel redesign

- The PPC Dashboard third panel was rebuilt from the supplied HTML reference. Its order is product header; Strategic Weekly Goals and Budget Utilization; two five-card performance rows; Previous/Current Week Summary; and action items.
- The first metric row is Total Spend, PPC Sales, Organic Sales, Total Sales, and Conversion Rate. Conversion Rate uses Scale Insights Total Orders divided by Total Sessions and shows `—` only for legacy periods without session data. The second row is PPC Orders, Org. Orders, Total Orders, ACOS, and TACOS.
- The third panel now uses isolated Geist/JetBrains Mono styling with a 1152px canvas, 24px spacing, neutral monochrome surfaces, 190px desktop metric cards, and responsive mobile stacking. The Products and Reporting Periods panels were not redesigned in that change.
- Existing goals, Goal History, budget editing/history, Scale Insights refresh, notes, action completion, and browser-local persistence remain active. Later revisions removed Export and the visible action due-date controls while preserving stored-field compatibility.
- The Next.js route helper for dashboard product normalization moved into `src/features/dashboard/domain/pipeline-products.ts`; behavior is unchanged, and the route now conforms to Next.js route-export constraints.
- Isolated browser verification confirmed both five-card grids, exact 190px tile height, Geist rendering, no horizontal overflow at desktop or 390px, note save/reload, and no JavaScript exceptions. Lint, typecheck, all 283 tests across 47 files (6 skipped), and the production build pass. Production-account/OAuth verification remains for deployment review.
- The redesign is local and has not been deployed.

## Start here

The unified Glassco application milestone is implemented, deployed, committed, and pushed. Do not rebuild the integration from scratch.

Canonical production URLs:

- Product Pipeline: <https://glasscopipeline.vercel.app/>
- PPC Library: <https://glasscopipeline.vercel.app/ppc/library>
- Legacy PPC URL: <https://glasscoppc.vercel.app/> redirects to the canonical PPC Library URL.

Local repositories:

- Team SOP Library: `C:\Users\HomePC\Documents\GitHub\library`
- Product Pipeline: `C:\Users\HomePC\Documents\GitHub\pipeline`

Current production commits:

- PPC Dashboard: `d792d4c` — latest synchronized Gallery and catalog-hydration update
- Product Pipeline: `c507888` — current synchronized gateway repository state

The PPC Dashboard checkout contains an unreleased video-header placement update. Pipeline remains synchronized with `origin/main`.

## Unreleased local work

- `/ppc/dashboard` now contains the Weekly PPC Performance three-panel workspace instead of the coming-soon placeholder.
- The dashboard loads a compact authenticated list of real Pipeline products through `/ppc/api/dashboard/products` and keeps the full workspace payload server-side.
- The first panel now merges those Pipeline products with validated browser-local `glassco.ppcDashboardCatalog.v1` custom products, local display overrides, optional images, reusable tags, and locally hidden Pipeline product IDs. Add/edit/tag/filter are local-only; deleting a Pipeline product removes it only from PPC Weekly Goals after confirmation and never mutates Pipeline; ASIN/SKU links open protected new tabs.
- Goals, weekly/daily budgets, performance metrics, previous-week results, notes, and action items save to validated browser-local `glassco.ppcPerformanceNotes.v1` records. Shared cross-browser reporting persistence is not part of this UI milestone.
- The dashboard removes the old Library sidebar so Products, Reporting Periods, and the working panel are the only content columns.

- Video playback now sits in a large responsive right-hand section inside the blue header. Google Drive’s fixed toolbar is cropped outside the visible frame so its play control and playing content remain centered; a compact new-tab overlay remains and the redundant OPEN VIDEO text button is removed.
- Gallery full-image previews now reuse each tile’s already-resolved image source, so opening the modal does not trigger another authenticated media download.
- Key Insight remains one builder element and now includes persistent Green, Blue, and Red color tabs; missing legacy `insightColor` values render Green.
- Bullet Text, Checklist Bullets, and Numbered Text are consolidated into one **Bullets** picker item with Bullets, Checklist, and Numbers tabs. Existing saved list types remain compatible.
- Diagnostic Flow steps now include independent multiline rich-text descriptions above their connector labels; legacy nodes hydrate with empty descriptions.
- Text selections open a viewport-aware formatting Bubble Menu while the fixed composer toolbar remains available, and large-text elements no longer enlarge toolbar controls.
- Both rich-text toolbars now include a Document link icon beside the URL-link icon. It preserves the selection, lazily searches one shared authoritative catalog of other published visible documents, and saves the chosen target through the existing protected `link.href` route.
- Editable Tables can delete exact rows and columns while retaining at least one of each. Standalone Headline and Description elements provide Left/Center/Right alignment with inline-only and full formatting respectively.
- The square Gallery presentation, catalog hydration fix, and Google Drive `/preview` URL support are already included in synchronized commit `d792d4c`.

## What is implemented

- PPC production deployment `dpl_6xM9bVCRqW8dLUqGL8GXtymQRR1V` is READY and aliased to `glasscoppc.vercel.app`. `/ppc/dashboard` is already available through the canonical Pipeline gateway; deploy Pipeline only after explicit production approval.
- Pipeline remains the default application at `/`.
- PPC is mounted behind the Pipeline domain at `/ppc` using a Vercel external rewrite. Team SOP Library remains at `/ppc/library/*`; `/ppc/dashboard` is the authenticated weekly performance workspace.
- Both application shells include separate Product Pipeline, Team SOP Library, and PPC Dashboard cards.
- Each application card opens its last validated route from the backward-compatible `glassco.appRoutes.v1` record in a new browser tab, including the active app, while leaving the source page unchanged.
- PPC uses `basePath: "/ppc"`; pages, assets, client API calls, and nested routes respect it.
- PPC reads the existing Pipeline session from `launchflow.authSession.v1` and verifies it through Pipeline `/api/auth/session` before showing the application. A session-only source tab uses a 30-second target-scoped one-use `glassco.authHandoff.v1`; missing/expired sessions return through validated `returnTo` login behavior.
- ADMIN users receive document, category, Recovery Center, reorder, snapshot, version, protected-archive, integrity-incident, and builder controls.
- USER users can create documents and edit active document content/metadata. VIEWER users are read-only; bookmarks and completion controls remain available to all roles.
- `/ppc/api/library` requires a verified Pipeline session and proxies scoped requests to Pipeline's authoritative Postgres `/api/library-state` endpoint. Pipeline enforces permissions against the current active user record.
- Direct visitors to the old PPC domain are redirected to the canonical Pipeline domain.
- Shared PPC documents, categories, append-only full-content versions, audit attribution, integrity incidents, and snapshots live in Pipeline Postgres. Private Blob stores authenticated images plus immutable daily offsite Library snapshots.
- Bookmarks, recent history, completion, and remembered app routes remain browser-local on the unified Pipeline origin.
- The Library refreshes shared state every five seconds while visible and on tab focus. A validated confirmed cache is read-only during outages and cannot be uploaded back to the server.
- Normal deletion creates a recoverable tombstone. “Delete forever” was replaced by protected archival: content is removed from normal Recovery but remains retained indefinitely. The Recovery Center can restore tombstones, archived documents, prior versions, selected snapshot records, and acknowledge automatic repair incidents.
- The Library Vercel cron runs `/ppc/api/library/maintenance` at 16:30 UTC daily. Set the same value for Pipeline `LIBRARY_BACKUP_SECRET`, Library `LIBRARY_BACKUP_SECRET`, and Library `CRON_SECRET`, and keep the private Blob connection available.

## Important boundaries

- This is a unified-domain microfrontend integration, not a monorepo conversion.
- Pipeline and PPC remain separate repositories and Vercel projects with independent rollback.
- Deploy PPC first so `/ppc/dashboard` and handoff consumption exist before the updated Pipeline cards are released.
- Pipeline authentication still originates from a browser-stored bearer token. The PPC browser gate improves the user flow, but it is not the final server-rendered page security boundary.
- PPC shared API reads and mutations are authenticated. ADMIN has full mutation access, USER has document create/update access, and VIEWER is read-only; these rules are server-enforced.
- Repository Markdown and legacy browser administration keys must never be merged into an initialized catalog. Deleted records remain tombstoned until an explicit ADMIN restore.
- Do not change stable document IDs, slugs, category IDs, topic IDs, or structured element schemas.
- Do not point Pipeline’s rewrite at a Vercel-protected deployment URL. It intentionally targets the public `glasscoppc.vercel.app` alias; PPC distinguishes forwarded Pipeline requests from direct legacy-domain visits.

## Verification completed

PPC Dashboard:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All passed with 22 test files and 124 tests.

Product Pipeline:

```bash
npm run check
npm run build
```

Both passed.

Production verification confirmed:

- `/ppc/library`, recent, bookmarks, and nested document routes return `200` through the Pipeline domain.
- `/ppc/_next/static/*` assets return `200`.
- Unsigned PPC session and library API calls return `401`.
- The legacy PPC domain returns a permanent redirect to `/ppc/library`.
- The logged-out browser flow returns to Pipeline without hydration or console errors.
- Automated authorization tests cover ADMIN, USER, VIEWER, and expired-session behavior.

## Starting the next chat

Run these first in the PPC repository:

```powershell
cd "C:\Users\HomePC\Documents\GitHub\library"
git status --short --branch
npm install
npm run dev
```

The local PPC route is <http://localhost:3000/ppc/library>. A local browser without a valid Pipeline production session will redirect to the Pipeline production login by design.

Before changing Pipeline integration code, also inspect:

```powershell
cd "C:\Users\HomePC\Documents\GitHub\pipeline"
git status --short --branch
```

Read [README.md](README.md), [Architecture.md](Architecture.md), [data-contract.md](data-contract.md), and [deployment.md](deployment.md) before changing routing, authentication, persistence, or deployment behavior.

## Persistence rollout still required

Do not initialize or clean production data until this order is followed:

1. Deploy Pipeline's Postgres `/api/library-state` endpoint and verify authenticated GET, scoped PATCH, conflict, audit, and backup behavior.
2. Deploy the Library adapter/client so stale local data cannot write, failed saves cannot remain local-only, and cache fallback is read-only.
3. As ADMIN, call the protected `/ppc/api/library/migration` backup action and retain the returned checksum/path (or download the legacy snapshot with authenticated GET).
4. Call `initialize-clean-catalog` only while Pipeline revision is `0`. It preserves the existing IDs/content of **Sample Document with all the elements** and **Checking Spenders with No Sales**, tombstones every other legacy document, and reports the retained records.
5. Verify two active documents across ADMIN, USER, and VIEWER accounts before allowing normal edits.

After this rollout, move Pipeline authentication to secure same-origin cookies and add browser E2E coverage using dedicated role accounts.

## July 21, 2026 — WYSIWYG Library composers

- Tiptap 3.28.0 powers supported body composers with Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls.
- Reader content uses static React rendering; checklist state persists and reader checkboxes are disabled.
- Optional JSON fields coexist with synchronized legacy strings. Legacy Markdown converts lazily, and malformed rich JSON falls back to saved text.
- Standalone list rows intentionally expose inline formatting only.
- Automated status at handoff: lint, typecheck, all 220 passing tests across 37 files (6 skipped), and the production build (including `/dashboard`) pass. Rerun all four gates after any further changes.
- Reader mode controls now show Eye in view mode and a non-submitting Pencil indicator in edit mode. Edit mode exposes a separate `Save changes` button; successful saves return to view mode, while rejected saves retain the editor and unsaved draft.
- Authenticated browser verification covers the new selection toolbar, Headline/Description picker and alignment controls, Diagnostic Flow descriptions, exact table deletion safeguards, compact 11px/32px toolbar controls, desktop layout, and a 390px viewport. All verification edits were discarded without saving and produced no browser warnings or errors.
- Authenticated browser verification now passes through a temporary local same-origin gateway that mirrors the production Pipeline `/ppc/*` rewrite: real Pipeline ADMIN login, PPC session verification, selection-aware Bold/Underline/Checklist editing, checked checklist persistence, save, reader rendering, full refresh, return to edit mode, and cleanup were verified against the production PPC build with no browser warnings or errors. The gateway and test content were removed afterward; no authentication bypass was added.
- The searchable Document link flow was verified through the same authenticated local gateway: fixed and selection toolbars exposed the new control, the authoritative catalog excluded the current document, search narrowed to `TEST 1`, save/refresh preserved `/ppc/library/test-1-ee68c9a2` with protected new-tab attributes, and the target reader loaded successfully. `TEST 3` was restored to its original text and external `here` link afterward.
- Rich-text list presentation explicitly restores disc and decimal markers removed by the Tailwind reset. Task-list items use the actual editor/reader DOM contract so checkbox and copy remain in one aligned row. Ordered-list editor JSON drops Tiptap's unsupported `type: null` attribute before strict validation, allowing numbered formatting to persist after save.
