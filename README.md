# Glassco PPC Dashboard

Glassco PPC Dashboard currently provides the Glassco Back Office Library: a responsive Amazon PPC knowledge base, shared document-administration interface, and structured document builder.

It is deployed as the PPC application inside the unified Glassco website:

- Canonical website: <https://glasscopipeline.vercel.app>
- PPC Library: <https://glasscopipeline.vercel.app/ppc/library>
- Legacy PPC domain: <https://glasscoppc.vercel.app> redirects to the canonical PPC route.

## Unified Glassco behavior

- Product Pipeline is the default application at `/`.
- PPC Dashboard is mounted at `/ppc` while remaining independently deployable.
- Centered Product Pipeline/PPC Dashboard tabs remain visible in the reserved top bar of both applications and switch the complete application shell.
- The last valid route for each application is remembered in browser storage.
- PPC verifies the existing Pipeline session through Pipeline’s `/api/auth/session` endpoint.
- ADMIN users can administer PPC content.
- USER and VIEWER users receive read-only PPC access with bookmark and completion controls.

## Library capabilities

- Browse repository starter documents and shared administrator-created documents.
- Search documents and filter by configurable categories.
- Read responsive documents with numbered, scroll-synchronized topic navigation.
- Bookmark documents, track recent views, and mark documents complete.
- Create, rename, hide, reorder, delete, recover, and categorize documents as an ADMIN.
- Create, rename, hide, reorder, delete, and recover category options as an ADMIN.
- Attach video tutorial links with YouTube preview thumbnails.
- Reorder content elements by dragging or insert new elements between existing blocks.
- Build documents from reusable elements:
  - Topics
  - Centered statements
  - Blue callouts
  - Bullet and numbered text
  - Checklist bullets
  - Key insights
  - Editable tables with resizable columns
  - Repeatable multiline dropdowns
  - Feature cards with shared image uploads
  - Blue text blocks
  - Roadmaps with shared per-step image uploads, inline plain/bulleted/checklist/numbered composers, and layout controls
  - Diagnostic flows
  - Image galleries with shared uploads and responsive one-, two-, three-, or four-column editor layouts
  - Clickable buttons with width and alignment controls

## Architecture and persistence

- Next.js uses `basePath: "/ppc"` for pages, assets, and API routes.
- Private shared images are fetched by client previews with the Pipeline bearer token and rendered through temporary browser object URLs; raw private API URLs are never assigned directly to image elements.
- Pipeline proxies `/ppc/:path*` to the independently deployed PPC Vercel project.
- Repository Markdown under `content/library` supplies starter documents.
- Shared documents and categories are stored in private Vercel Blob object `glassco/library-state-v1.json`.
- Local development falls back to `.data/library-state-v1.json`.
- Bookmarks, recent history, completion, last-read position, and remembered application routes remain browser-local.
- `/ppc/api/library` verifies Pipeline sessions for reads and requires ADMIN permission for writes.

The current browser-stored Pipeline bearer token is not the final page-security boundary. A future authentication milestone should move the session to secure same-origin cookies so authenticated access can be enforced before page HTML is returned.

## Technology

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4 toolchain and project CSS
- Vercel Blob
- Vitest and Testing Library
- `gray-matter`, `react-markdown`, and `remark-gfm`

## Requirements

- Node.js 20.9 or newer
- npm

## Local setup

```bash
npm install
npm run dev
```

Open <http://localhost:3000/ppc/library>.

Because PPC verifies the Pipeline production session, a browser without a valid Pipeline session redirects to <https://glasscopipeline.vercel.app>.

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The last verified state passes all four commands with 12 test files and 62 tests.

## Project structure

```text
content/library/                    Starter Markdown documents
src/app/                            Next.js routes, APIs, layout, and global styling
src/app/api/library/                Authenticated shared-library API
src/app/api/pipeline-session/       Pipeline session verification endpoint
src/components/                     Application shell and session provider
src/features/library/data/          Markdown and Vercel Blob repository adapters
src/features/library/domain/        Types, validation, search, and builder rules
src/features/library/state/         Shared-library client and browser reading state
src/features/library/ui/            Catalog, reader, administration, and builder UI
src/lib/                            Unified routing and Pipeline authorization helpers
src/proxy.ts                        Legacy PPC-domain canonical redirect
```

## Environment and deployment

Production requires the existing private Vercel Blob connection. These optional overrides are supported:

- `PIPELINE_AUTH_ORIGIN` — server-side Pipeline authentication origin; defaults to `https://glasscopipeline.vercel.app`.
- `NEXT_PUBLIC_PIPELINE_ORIGIN` — browser navigation origin; defaults to `https://glasscopipeline.vercel.app`.

Deploy PPC before Pipeline whenever base-path or gateway behavior changes. Pipeline’s rewrite currently targets the public PPC production alias so it is not blocked by Vercel deployment protection.

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
