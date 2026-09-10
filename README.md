# Glassco Team SOP Library and PPC Dashboard

## Dashboard reference redesign (September 10, 2026)

The dashboard workspace follows the supplied HTML reference across all three panels. Products is a fixed 300px white column with a compact title/count row, one plus-button action menu, search and tag controls, neutral product cards, and a solid-black selected card. Reporting Periods is a 340px white column with an integrated month navigator, neutral period cards, abbreviated ranges, and a black selected-card treatment. The workspace places Strategic Weekly Goals and Budget Utilization above two five-card performance rows, paired summaries, a campaign week-over-week diagnostic, and action items. Total Orders follows Organic Orders; ACOS and TACOS sit together; Conversion Rate follows Total Sales and shows an unavailable dash until a valid source exists. Planning and catalog edits still save only in this browser.

This repository provides the Glassco Team SOP Library—a responsive Amazon PPC knowledge base, shared document-administration interface, and structured document builder—and the authenticated Weekly PPC Performance workspace at `/ppc/dashboard`.

It is deployed as the PPC application inside the unified Glassco website:

- Canonical website: <https://glasscopipeline.vercel.app>
- PPC Library: <https://glasscopipeline.vercel.app/ppc/library>
- PPC Dashboard: <https://glasscopipeline.vercel.app/ppc/dashboard>
- Legacy PPC domain: <https://glasscoppc.vercel.app> redirects to the canonical PPC route.

## Unified Glassco behavior

- Product Pipeline is the default application at `/`.
- Team SOP Library remains at `/ppc/library/*`; PPC Dashboard begins at `/ppc/dashboard`. Both remain independently deployable under the `/ppc` base path.
- Three separate Product Pipeline, Team SOP Library, and PPC Dashboard cards remain visible in the reserved top bar and open any application—including the active one—in a new tab.
- The last valid route for each application is remembered independently in browser storage, with legacy two-route records remaining valid.
- Session-only Pipeline logins cross into a new tab through a 30-second one-use handoff; persistent “Remember me” sessions are unchanged.
- Missing or expired sessions return to Pipeline login with a validated requested PPC destination.
- PPC verifies the existing Pipeline session through Pipeline’s `/api/auth/session` endpoint.
- PPC Dashboard loads the authenticated user’s compact Pipeline product catalog and provides a three-panel product, reporting-period, and weekly documentation workspace.
- For products with an ASIN, the selected Wednesday–Tuesday period automatically loads Spend, PPC Sales, PPC Orders, Total Sales, and Total Orders from Scale Insights through an authenticated server route. Organic Sales, Organic Orders, ACOS, and TACOS are calculated by this application.
- Campaign Week-over-Week Comparison is currently staged as a previous-week Spend baseline. It makes one authenticated Scale Insights request for the preceding matched period, lists campaigns by Spend, leaves Current Week Spend blank, and opens the previous-period campaign trend; results remain in memory only.
- A session-only Performance AI widget combines the selected product, active week, populated visible reporting periods, and planning notes with live read-only Scale Insights MCP tools. Server-side enforcement limits every tool call to that ASIN, US, and the visible completed-date range without changing the saved report schema.
- The Products panel can add dashboard-only products, apply local edits and images, create reusable tags, filter by tag, and remove dashboard-added products. These catalog customizations use the validated `glassco.ppcDashboardCatalog.v1` browser record and do not mutate Product Pipeline records.
- Weekly goals, budget limits, performance figures, prior-week outcomes, notes, and action items save to the versioned `glassco.ppcPerformanceNotes.v1` browser record in this initial UI milestone; they are not yet shared across browsers.
- ADMIN users have full document, category, attributed recovery, reorder, snapshot, version, protected-archive, and integrity-incident access. Document content is never physically deleted through the application.
- USER users can create documents and edit active document content and metadata.
- VIEWER users receive read-only Library access. Personal bookmark and completion controls remain available to every role.

## Library capabilities

- Browse the shared catalog held by Pipeline's authoritative Postgres Library service.
- Search documents and filter by configurable categories.
- Read responsive documents with numbered, scroll-synchronized topic navigation.
- Bookmark documents, track recent views, and mark documents complete.
- Create and update active documents as ADMIN or USER; document/category lifecycle, ordering, recovery, and backup controls remain ADMIN-only.
- Use the ADMIN Recovery Center tabs for Deleted, Protected archive, Version history, Snapshots, and Incidents. Moving a tombstone out of normal Recovery keeps its full content protected indefinitely.
- Keep the catalog list hidden behind a loading skeleton until saved shared state is resolved, preventing deleted documents from flashing during refresh.
- Create, rename, hide, reorder, delete, and recover category options as an ADMIN.
- Attach YouTube, Google Drive, direct-file, or other HTTPS video links; supported providers render in a large responsive player inside the blue document header’s right column. Google Drive playback is centered in the visible frame and keeps a compact new-tab icon without a redundant text button.
- Reorder content elements by dragging or insert new elements between existing blocks.
- Format document copy with a compact icon-only toolbar for text styles, Left/Center/Right alignment, lists, and safe new-tab links; highlighting text exposes the same controls beside the selection.
- Build documents from reusable elements:
  - Topics
  - Centered statements
  - Blue callouts
  - Bullet and numbered text
  - Checklist bullets
  - Key insights with one-click Green, Blue, and Red color variants
  - Editable tables with resizable columns
  - Repeatable multiline dropdowns
  - Feature cards with shared image uploads
  - Blue text blocks
  - Roadmaps with shared per-step image uploads, inline plain/bulleted/checklist/numbered composers, and layout controls
  - Diagnostic flows
  - Image galleries with shared uploads, responsive one- to four-column layouts, square tiles that preserve the complete image ratio, and instant click-to-preview viewing that reuses the loaded tile image
  - Clickable buttons with width and alignment controls

## Architecture and persistence

- Next.js uses `basePath: "/ppc"` for pages, assets, and API routes.
- `/ppc/api/dashboard/performance` verifies the Pipeline session before requesting a short-lived Scale Insights token from Vercel Connect for that stable Pipeline user ID. Vercel stores and refreshes the OAuth grant; credentials and tokens are never returned to the browser or written to browser storage.
- `/ppc/api/dashboard/campaign-comparison` currently applies the authenticated no-store boundary to one previous matched campaign period, follows advertised provider pagination, validates scope and Spend, and returns the staged normalized baseline.
- Authenticated `/ppc/api/dashboard/ai-chat` validates bounded product/week context and invokes `openai/gpt-5.6-sol` through Vercel AI Gateway; model credentials remain server-side and responses are not cached.
- Private shared images are fetched by client previews with the Pipeline bearer token and rendered through temporary browser object URLs; raw private API URLs are never assigned directly to image elements.
- Pipeline proxies `/ppc/:path*` to the independently deployed PPC Vercel project.
- Pipeline's Postgres-backed `/api/library-state` endpoint is the only authoritative document and category store. Repository Markdown under `content/library` is bootstrap/compatibility input and is never merged into an initialized catalog.
- `/ppc/api/library` is an authenticated adapter for scoped Pipeline mutations. It never maintains a second writable snapshot.
- Successful shared responses are cached in browser storage only as a validated read-only outage fallback. Old browser administration snapshots are never uploaded or merged.
- Private Vercel Blob remains the image store and also receives immutable daily offsite Library snapshots. Pipeline Postgres remains the only live catalog store.
- Bookmarks, recent history, completion, last-read position, and remembered application routes remain browser-local.
- Pipeline authorizes every request against the current active user row: ADMIN has full access, USER may create/update active documents, and VIEWER is read-only.
- Catalog responses include a global revision and per-record versions. ADMIN responses also include user/system/unknown deletion attribution. Stale mutations return `409` with current shared state rather than overwriting another account's work.
- Legacy initialization imports the complete validated catalog after making its immutable backup; it no longer creates new tombstones. Pipeline backup restore is a non-destructive merge.
- Visible Library tabs poll every five seconds and refresh immediately on focus. Failed server access leaves a validated cache visible in read-only mode.
- The `/ppc/api/library/maintenance` cron runs daily at 16:30 UTC, asks Pipeline to verify/repair integrity and create a database snapshot, then stores the same state under `glassco/library-snapshots-v2/` in private Vercel Blob. `LIBRARY_BACKUP_SECRET` must match in both Vercel projects, and Library's Vercel `CRON_SECRET` must use that same value so scheduled requests are authenticated.

The current browser-stored Pipeline bearer token is not the final page-security boundary. A future authentication milestone should move the session to secure same-origin cookies so authenticated access can be enforced before page HTML is returned.

## Technology

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4 toolchain and project CSS
- Pipeline Postgres (authoritative Library state, audit, and backups)
- Vercel Blob (private images and legacy migration backup only)
- Vitest and Testing Library
- `gray-matter`, `react-markdown`, and `remark-gfm`

## Requirements

- Node.js 20.9 or newer
- npm

## Local setup

```bash
npm install
copy .env.example .env.local
npm run dev
```

The optional connector and endpoint values in `.env.example` are non-secret identifiers. Local Vercel Connect calls require the project OIDC environment produced by `vercel link` or `vercel env pull`; never copy a returned Scale Insights token into `.env.local`. Vercel deployments use project OIDC for AI Gateway; standalone local AI chat requires a server-only `AI_GATEWAY_API_KEY` in `.env.local`.

Open <http://localhost:3000/ppc/library>.

Because PPC verifies the Pipeline production session, a browser without a valid Pipeline session redirects to <https://glasscopipeline.vercel.app>.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The last verified state passes all four commands with 51 test files, 303 passing tests, and 6 intentionally skipped tests.

## Project structure

```text
content/library/                    Bootstrap/compatibility Markdown documents
src/app/                            Next.js routes, APIs, layout, and global styling
src/app/api/library/                Authenticated shared-library API
src/app/api/pipeline-session/       Pipeline session verification endpoint
src/app/api/dashboard/performance/ Authenticated Scale Insights performance endpoint
src/app/api/dashboard/campaign-comparison/ Authenticated campaign comparison endpoint
src/components/                     Application shell and session provider
src/features/dashboard/data/       Scale Insights validation and server-only MCP transport
src/features/library/data/          Markdown bootstrap and legacy Blob migration adapters
src/features/library/domain/        Types, validation, search, and builder rules
src/features/library/state/         Shared-library client and browser reading state
src/features/library/ui/            Catalog, reader, administration, and builder UI
src/lib/                            Unified routing and Pipeline authorization helpers
src/proxy.ts                        Legacy PPC-domain canonical redirect
```

## Environment and deployment

Production requires the existing private Vercel Blob connection for images and the protected legacy backup/migration route. Pipeline must be deployed with its Postgres connection and `/api/library-state` before this application is promoted. These optional overrides are supported:

- `PIPELINE_AUTH_ORIGIN` — server-side Pipeline authentication origin; defaults to `https://glasscopipeline.vercel.app`.
- `NEXT_PUBLIC_PIPELINE_ORIGIN` — browser navigation origin; defaults to `https://glasscopipeline.vercel.app`.

Automatic dashboard metrics use the Vercel Connect connector attached to this project:

- `SCALE_INSIGHTS_CONNECTOR` optionally overrides the non-secret connector UID; it defaults to `mcp.scaleinsights.com/glassco-scale-insights`.
- `SCALE_INSIGHTS_MCP_URL` optionally overrides the default `https://mcp.scaleinsights.com/mcp`; production endpoints must use HTTPS.
- Vercel injects the project OIDC credential at runtime. Each stable, server-verified Pipeline user completes hosted Scale Insights consent once when the dashboard prompts them.

Never expose the Vercel OIDC credential, Connect-issued access token, or upstream OAuth grant through a `NEXT_PUBLIC_` variable, frontend code, API response, or `localStorage`.

For this persistence rollout, deploy Pipeline's authoritative endpoint before the Library client, then back up and initialize data as described in [deployment.md](deployment.md). For later base-path or gateway-only changes, deploy PPC before Pipeline navigation changes. Pipeline’s rewrite targets the public PPC production alias so it is not blocked by Vercel deployment protection.

See [deployment.md](deployment.md) for the full rollout, verification, and rollback procedure.

## Documentation

- [New-chat handoff](HANDOFF.md)
- [Product specification](Product-Spec.md)
- [Architecture](Architecture.md)
- [Progress](Progress.md)
- [QA checklist](qa-checklist.md)
- [Deployment](deployment.md)
- [Data contract](data-contract.md)
- [Agent guidance](AGENTS.md)

## Rich-text Library content

Supported Library body fields use a visual Tiptap composer with Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls. Topic callouts, statements, quotes, insights, feature cards, dropdown bodies, and roadmap step bodies share the same editor and reader typography. Standalone Bullet Text, Checklist Bullets, and Numbered Text rows intentionally expose inline styles only.

Rich content is stored as validated JSON beside synchronized legacy text fields. Existing plain-text and repository Markdown bodies are converted when opened; no separate rich-text conversion job is required. Reader checklists are disabled, while checklist state can be edited and persisted in the builder.

Formatting saves use a content-only mutation. Pipeline canonicalizes the rich-text JSON, preserves the document identity and lifecycle, and returns the saved active document with its new record version. Library verifies that response before leaving edit mode; a missing or malformed response keeps the editor and unsaved changes open instead of removing the document from the reader or cache.
