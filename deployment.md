# Deployment Guide

## Current deployment model

The Library deploys as a Next.js microfrontend under `/ppc`. Pipeline Postgres is authoritative for documents, categories, tombstones, versions, audit records, and shared backups after the protected one-time legacy Blob migration. Private Vercel Blob remains required for uploaded images and the immutable legacy migration artifact. Repository Markdown is bootstrap/compatibility content only; bookmarks, history, completion, and last-read position remain browser-local.

Goal History extends the existing version-1 browser report value with an optional array and requires no environment variable, database, or server migration. The larger Weekly Performance card layout is presentation-only. After deployment, verify resolving one Achieved and one Missed goal survives reload, is scoped to the selected product, and does not reappear in the active list. Also verify the four-card Sales row, split Orders/Efficiency row, percentage badges, `Prev. Week` footers, metric-specific favorable colors, ACOS target-gap copy, comma-formatted whole metrics, centered budget values, and removal of the redundant previous sales/TACOS summary.

Structured goals use the existing optional `metric`, `unit`, and history `dataState` fields in the version-1 browser value. No backend, environment, storage-key, or database migration is required. The parser maps legacy `spend`/`sales` values into the expanded taxonomy. After rollout, verify all nine goal choices against a live Scale Insights week, Organic Order's two measures, two-decimal currency/percentage Targets, read-only Actual fields, Partial/Final transitions after refresh, preservation of derived values in Goal History, and previous-result carry-forward into the following week.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Git repository containing the full project
- A private Vercel Blob store connected to the project
- A deployed Pipeline project with Postgres configured and `/api/library-state` available
- An active Pipeline ADMIN account for migration and rollout verification
- The `mcp.scaleinsights.com/glassco-scale-insights` Vercel Connect connector attached to the PPC project for Production, Preview, and Development
- Vercel AI Gateway available to the PPC project; deployments use project OIDC, while local standalone development requires `AI_GATEWAY_API_KEY`

## AI performance assistant

The assistant route calls `openai/gpt-5.6-sol` through Vercel AI Gateway and opens the existing Scale Insights MCP connector with the same verified Pipeline user subject. Do not expose `AI_GATEWAY_API_KEY`, Vercel OIDC, or MCP access tokens as `NEXT_PUBLIC_` values or place them in browser storage. The AI SDK resolves the automatically available project OIDC token at request time in Vercel deployments; application code must not reject a request by directly prechecking that build-time environment value. For local development outside `vercel dev`, copy `.env.example` to `.env.local` and set a scoped AI Gateway key; the Scale Insights connector still requires project OIDC and per-user hosted consent. If a pulled OIDC token expires, refresh it with `vercel env pull .env.local --yes` and restart the dev server.

After deployment, ask a product question from `/ppc/dashboard`, confirm a no-store `POST /ppc/api/dashboard/ai-chat`, and verify the answer identifies live Scale Insights facts separately from saved dashboard context. Test an ungranted user and complete the returned hosted Connect flow, then retry. Confirm discovered mutation/account-wide tools are unavailable, generated tool arguments cannot override the selected ASIN/US/visible dates, the function permits up to 120 seconds, and no credential, raw MCP result, or tool schema appears in client bundles, browser storage, URLs, or response bodies.

## Pre-deployment validation

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Do not deploy if any command fails.

## Local production test

```bash
npm run build
npm run start
```

Open [http://localhost:3000/ppc/library](http://localhost:3000/ppc/library).

Also verify `/ppc/dashboard`, set a Target ACOS below the selected product's actual ACOS, and open at least one header analysis link. It must open `portal.scaleinsights.com` in a new tab with the selected ASIN and active-week dates in its filters, without credentials in the URL.

## Deploy with Vercel

1. Push the complete repository to GitHub.
2. Sign in to Vercel and choose **Add New Project**.
3. Import the GitHub repository.
4. Keep the detected framework as **Next.js**.
5. Use the repository root as the root directory.
6. Use `npm run build` as the build command.
7. Connect a private Vercel Blob store to production, preview, and development. Vercel injects the Blob credentials automatically.
8. Deploy and verify `/ppc/library`, `/ppc/api/library`, `/ppc/api/library/migration`, and at least one `/ppc/library/[slug]` page.

## Files that must be committed

- `src/`
- `content/`
- `public/`
- `package.json`
- `package-lock.json`
- Next.js, TypeScript, ESLint, PostCSS, and Vitest configuration files
- Product and engineering Markdown documentation

Do not commit generated or local-only folders such as:

- `node_modules/`
- `.next/`
- `coverage/`
- `.vercel/`
- local `.env*` files
- `.data/`

The existing `.gitignore` already excludes these paths.

## Post-deployment smoke test

1. Load `/library` in a private browser window.
2. Confirm the Category and Search controls render.
3. Open a document and use its topic navigation.
4. Bookmark and complete the document, then refresh.
5. As ADMIN, enter admin mode, create a temporary document, and save it.
6. Return to view mode and confirm the Plus control remains visible and can open new-document creation.
7. Delete a temporary document in admin mode; confirm no recovery list appears below the catalog, then use the toolbar recovery icon to open the dialog and recover it.
   Before recovering it, refresh the page and confirm the deleted card never appears while the shared catalog is loading.
8. Confirm catalog admin cards do not show an Edit / Rename action.
9. Open a document and confirm the sidebar shows an Eye in view mode. Enter edit mode and confirm it changes to a Pencil and reveals a separate `Save changes` button without issuing a save. Change the title, description, and category in the blue header, click `Save changes`, then refresh to confirm persistence and the return of the Eye control.
10. Open the new-document form and confirm it does not show Document Type, Tags, or Content Markdown.
11. Use the Category Plus control to create and select a temporary category.
12. Use the Category Pencil control to open the category manager; verify rename, reorder, and recoverable deletion controls.
13. Confirm deleted categories are absent from the main list, then use the recovery icon to open the recovery dialog and recover one.
14. In document recovery, confirm manual deletions show the user name/email/role, July 22 cleanup records show `System — Initial Library cleanup`, unmatched historical records show the unknown-source fallback, and backup-attributed records identify the initiating administrator when available.
15. Confirm **Recover system-deleted documents** shows the affected count and confirmation, restores only migration-attributed documents atomically, reports progress/success, and returns `409` without partial recovery after a deliberate stale-revision change.
16. Click a recovery-row trash icon, cancel the warning once, then confirm it; verify progress and success feedback, verify the document leaves recovery, and verify restoring an older backup does not recreate it.
16. Add a Key Insight, click Green, Blue, and Red, and confirm each color previews immediately; save on Red, refresh, and confirm Red persists. Confirm an older insight without `insightColor` remains Green.
17. Add a Roadmap, select Center number, and confirm its number, title, and subtext are centered and its image uses the full step width after saving.
18. Upload a Roadmap step image, confirm its shared upload completes, and verify each subtext format edits directly inside the composer and persists in a second browser session.
19. Upload Feature Card and Gallery images, switch every Gallery layout, and confirm minimum slots, responsive grids, shared previews, replacement, and removal.
   Confirm the preview request includes authenticated media access and displays the actual image rather than a broken image icon.
   Confirm square, portrait, and landscape Gallery sources are fully visible inside square tiles without cropping, then click each loaded tile to verify the full-image preview opens immediately without another media request.
20. Add Buttons for internal and HTTPS links; verify every width/alignment option, invalid-link feedback, secure new-tab attributes, and mobile full-width behavior.
21. Add a shared Google Drive video link and confirm a large 16:9 Drive preview player appears inside the blue document header’s right column. Confirm the play icon and playing video content are centered, the compact new-tab icon works, and no separate OPEN VIDEO text button appears.
22. Edit a long document and confirm the compact icon toolbar groups text styles, alignment, lists, and links with separators. Highlight text near the viewport bottom, add/edit/remove a link in the floating toolbar, save, refresh, and confirm alignment plus secure new-tab navigation persist.
   Use the neighboring Document link icon, search for a different published visible document, save, refresh, and confirm the linked text opens the selected `/ppc/library/:slug` route in a protected new tab. Confirm current, hidden, draft, deleted, archived, and recovery-only records are absent and catalog-load errors offer Retry without blocking other edits.
   For each formatting type (Bold, Italic, Underline, alignment, bullets, checklist, numbers, and link), confirm the same document remains active after save, its record version advances, and it reopens from the catalog.
   Simulate an incomplete or malformed formatting-save response and confirm edit mode stays open with unsaved changes. A genuine concurrent delete must be displayed only from an explicit `deleted` status.
22. Open a second authenticated account and confirm the temporary document appears within five seconds, then edit it and confirm the ADMIN tab updates within five seconds or immediately after focus.
23. Verify USER can create/edit active documents but cannot delete, recover, reorder, or manage categories; verify VIEWER cannot mutate and direct forbidden PATCH requests return `403`.
24. Check the browser console for hydration or runtime errors.
25. Confirm mobile layout at approximately 390px width.
26. Confirm the Product Pipeline, Team SOP Library, and PPC Dashboard cards appear separately in the reserved top bar, show white text for the active app, and each open its remembered route in a new browser tab—including the active tab—without changing or overlapping the source page.
27. Confirm `/ppc/dashboard` renders the authenticated three-panel Weekly PPC Performance workspace, loads the signed-in user’s Pipeline products, preserves a saved local report after refresh, and supports add/edit/delete of dashboard products plus persistent tag creation/filtering without changing Pipeline records. Select an ASIN; if prompted, complete the Vercel-hosted `Connect Scale Insights` consent and return to the dashboard. Verify all visible uncached Wednesday–Tuesday periods populate automatically without week-card clicks, the active week retrieves first, each period calculates the four derived metrics, and the active detail view displays freshness and locks imported inputs.
28. From a session-only Pipeline login, open each PPC card and confirm the one-time handoff is consumed without another login. Confirm persistent “Remember me,” expired-session return, external `returnTo` rejection, keyboard focus, hover, and narrow-screen horizontal scrolling.

## Authoritative persistence rollout

Production data cleanup is deliberately separate from code deployment. Use this order:

1. Deploy Pipeline first. Confirm `/api/library-state` authenticates through the current user table, returns revision/record versions, enforces ADMIN/USER/VIEWER permissions, records audit attribution, and can create/list a backup.
2. Deploy Library next. Confirm `/ppc/api/library` is a thin authenticated adapter, old local administration keys are ignored, server failures make the confirmed cache read-only, and repository Markdown is not merged after initialization.
3. With an ADMIN bearer session, POST `{ "action": "create-backup" }` to `/ppc/api/library/migration`. Record the returned checksum and Blob pathname. Optionally GET the same route to download the exact legacy JSON.
4. Inspect the backup and record its complete document/category counts and checksum.
5. Only when Pipeline returns revision `0` with an empty catalog, POST `{ "action": "initialize-catalog" }` to the migration route. The operation preserves the complete validated catalog and creates no new tombstones.
6. Confirm the response counts match the immutable backup. Verify all previously active documents appear for authorized readers and pre-existing tombstones remain only in ADMIN recovery.
7. Test a same-record stale edit and require `409` plus current shared state before enabling routine editing.

Never run initialization before the server and client protections are deployed. It is revision-zero-only and must not be used to overwrite an initialized catalog.

## Rollback

Before restoring catalog data, create a Pipeline backup. Restore through the ADMIN backup API with the current `expectedRevision`; the server creates an automatic before-restore backup and performs a non-destructive merge. Records absent from the backup, newer active documents, and active records represented as tombstones in an older backup remain active and unchanged. Use Vercel's deployment history to roll back code independently. Never restore catalog state from localStorage or repository Markdown.
# Unified deployment

For the authoritative persistence rollout, deploy Pipeline's database endpoint before Library, then perform the backup/initialization sequence above. For navigation-only releases, deploy PPC before enabling updated Pipeline navigation. The production build must serve the `/ppc` base path. Verify `/ppc/library`, `/ppc/dashboard`, `/ppc/_next/*`, `/ppc/api/pipeline-session`, `/ppc/api/library`, and the ADMIN-only migration route through the public PPC production alias before changing the Pipeline rewrite/cards. The PPC proxy must allow requests forwarded by `glasscopipeline.vercel.app` while redirecting direct visitors from the legacy PPC host.

Optional environment variables:

- `PIPELINE_AUTH_ORIGIN` — server-to-server Pipeline authentication origin.
- `NEXT_PUBLIC_PIPELINE_ORIGIN` — browser destination when leaving PPC or when authentication fails.

Scale Insights/Vercel Connect configuration:

- Attach connector `mcp.scaleinsights.com/glassco-scale-insights` to the PPC project for every deployed environment that may retrieve metrics.
- `SCALE_INSIGHTS_CONNECTOR` may override that non-secret UID, and `SCALE_INSIGHTS_MCP_URL` may override the default `https://mcp.scaleinsights.com/mcp` endpoint.
- Do not create static Scale Insights OAuth variables. Vercel injects project OIDC at runtime, and Vercel Connect stores and refreshes each server-verified Pipeline user's grant.

Both default to `https://glasscopipeline.vercel.app`. Roll back PPC and Pipeline independently by promoting their previous production deployments.

After deployment, call `/ppc/api/dashboard/performance` through an authenticated dashboard session and verify `401` without that session, a no-store `409` plus hosted consent URL before user authorization, `no-store` on success, exact requested scope, and no OIDC/token material in the response or client bundle. If Scale Insights is not configured, the dashboard intentionally retains manual metric entry and shows a configuration error.

## Budget history and multi-month timeline

This release keeps the existing version-1 browser report key and needs no server migration or environment change. Existing reports receive an empty budget history during validation. After deployment, verify a budget change persists after reload, Draft UI is absent, multiple months and Select Year work, overlap weeks are deduplicated, and current/future cutoffs still prevent requests for weeks with no completed days.

## Saved weekly performance and smaller tags

The performance cache, compact badges, upper-right week labels, and smaller whole-number metric cards need no environment or server data migration. Verify active-week-first automatic backfill of every visible uncached week, switching weeks without new requests, page reload, active-week-only Refresh, failed-refresh retention, and rounded presentation without precision loss in the cached DTO. Existing values that were never saved by the previous release are populated automatically when their weeks become visible. Cache persistence is local to this browser, not synchronized across devices.

The three-column Scale Insights navigation requires no environment or migration change. Verify the first two columns use the requested report ordering and the isolated trend column opens Daily, Weekly, and Monthly Advertising Trend views with the selected ASIN, selected Tuesday, seven columns, and 1-, 7-, and 30-day aggregation respectively. Confirm timeline cards use PPC Sales/PPC Order, Current percentages keep a tight suffix, and Budget History paginates the existing array at five rows per page.

## Compact product cards

Portfolio cards display the image, product name, and tag without ASIN/SKU rows. View-mode cards use a compact 66px minimum height; edit mode retains room for Edit, Delete, and Reorder controls. ASIN/SKU remain in the selected-product header, edit form, search index, and existing storage; this is presentation-only with no data migration. Verify both identifier links remain in the detail header after selecting a product.

## Product portfolio ordering

Product reordering requires no service or environment changes. Existing version-1 browser catalogs accept the optional productOrderIds field without migration. Verify a drag/drop in edit mode, refresh persistence, and a filtered reorder; ordering is local to the browser.

## Automatic listing images

The ASIN image lookup uses the existing Scale Insights connector and requires no new environment variables or migrations. Verify the Add product form with an authorized session: enter a valid ASIN, wait for the listing image preview, and confirm the saved card uses it. Unavailable images must leave manual upload usable.

## Current-week performance verification

After the September 7 date-cutoff fix, verify a current Wednesday–Tuesday reporting week requests only through yesterday in UTC and displays both the actual through-date and partial-week warning. Verify a completed week still returns its exact Tuesday end date. On Wednesday, the new week must show “no completed days yet” without an MCP request. No environment or data migration is required.

## Rich-text deployment notes

Rich-text support adds client/runtime packages and optional fields inside the existing shared Library JSON payload. It requires no environment variables, database migration, or conversion job. Searchable document links reuse the existing `link.href` mark and compact summary endpoint. Existing documents are upgraded lazily when edited and remain readable through synchronized legacy fields. Verify a saved formatted document through the canonical `/ppc/library/:slug` route before promotion.

## Live-state rollout

Deploy the Pipeline API first because it introduces active-only snapshots, opt-in Recovery data, and structured slug status. Verify authenticated catalog, document, deleted-link, and Recovery reads before deploying Library. Then deploy the Library UI and verify cached read-only mode, Back/Forward revalidation, deleted-link recovery, purge messaging, and precise disabled-control explanations through the canonical production route. No document migration, automatic restoration, or automatic deletion is part of this rollout.

For an approved protected-document repair, deploy only this repository. Open ADMIN Recovery after deployment, verify the permanent-deletion history, confirm the requested restore action, and then verify the original title and reader route are active. Protected repair is limited to the approved bQool and Check Spend records; do not initialize, merge, or restore the remaining purged catalog.

## Reorder, Recovery, bookmark, and empty-catalog rollout

Deploy the Pipeline Library API first because the reordered IDs require the scalar-safe PostgreSQL expansion before the UI can reliably persist them. Verify a revision-guarded `documents.reorder` request succeeds and that Pipeline runtime logs contain no PostgreSQL `22023` errors. Then deploy this Library UI and verify Save order progress/close/toast behavior, the reconciled bookmark badge, immediate Recovery loading and retry, and confirmed deletion/recovery of the final active document. This rollout requires no schema or data migration and must not modify Pipeline UI code.

## Weekly comparison rollout

The side-by-side Weekly Performance comparison is a presentation-only Library deployment. It requires no environment variable, API, storage-schema, or data migration. Verify equal-width Current and Previous values, the vertical divider, neutral prior values, compact non-overflowing symbols, direction color on current values, and shortened Daily/Weekly/Monthly Performance links at desktop and mobile widths.
