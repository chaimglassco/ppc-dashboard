# Glassco PPC Dashboard Handoff

Last updated: July 21, 2026

## Start here

The unified Glassco application milestone is implemented, deployed, committed, and pushed. Do not rebuild the integration from scratch.

Canonical production URLs:

- Product Pipeline: <https://glasscopipeline.vercel.app/>
- PPC Library: <https://glasscopipeline.vercel.app/ppc/library>
- Legacy PPC URL: <https://glasscoppc.vercel.app/> redirects to the canonical PPC Library URL.

Local repositories:

- PPC Dashboard: `C:\Users\HomePC\Documents\GitHub\ppc-dashboard`
- Product Pipeline: `C:\Users\HomePC\Documents\GitHub\pipeline`

Current production commits:

- PPC Dashboard: `8060b8d` — latest production deployment before the local video-player update
- Product Pipeline: `c507888` — current synchronized gateway repository state

The PPC Dashboard checkout contains an unreleased Library video-player update. Pipeline remains synchronized with `origin/main`.

## Unreleased local work

- Moved document videos out of the blue header and into a large responsive 16:9 section immediately below it.
- Added embedded playback for YouTube and Google Drive shared-file URLs, native playback for direct MP4/WebM/OGG URLs, and a safe fallback for other HTTPS links.
- Added pure URL-presentation tests. Lint, TypeScript, 13 test files/72 tests, and the production build pass.
- Browser verification reached the Pipeline sign-in gate; the signed-in reader flow still needs a final visual smoke test before release.

## What is implemented

- Pipeline remains the default application at `/`.
- PPC is mounted behind the Pipeline domain at `/ppc` using a Vercel external rewrite.
- Both sidebars include a Product Pipeline/PPC Dashboard selector.
- Switching applications performs full-page navigation and restores the last validated route for each application from `glassco.appRoutes.v1`.
- PPC uses `basePath: "/ppc"`; pages, assets, client API calls, and nested routes respect it.
- PPC reads the existing Pipeline session from `launchflow.authSession.v1` and verifies it through Pipeline `/api/auth/session` before showing the application.
- ADMIN users receive PPC document, category, recovery, reorder, and builder controls.
- USER and VIEWER users receive read-only library access while bookmarks and completion controls remain available.
- `/ppc/api/library` requires a verified Pipeline session for reads and ADMIN permission for writes.
- Direct visitors to the old PPC domain are redirected to the canonical Pipeline domain.
- Shared PPC documents and categories remain in the existing private Vercel Blob snapshot.
- Bookmarks, recent history, completion, and remembered app routes remain browser-local on the unified Pipeline origin.

## Important boundaries

- This is a unified-domain microfrontend integration, not a monorepo conversion.
- Pipeline and PPC remain separate repositories and Vercel projects with independent rollback.
- Pipeline authentication still originates from a browser-stored bearer token. The PPC browser gate improves the user flow, but it is not the final server-rendered page security boundary.
- PPC shared API reads are authenticated and mutations are ADMIN-protected server-side.
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

All passed with 13 test files and 72 tests.

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
cd "C:\Users\HomePC\Documents\PPC Dashboard"
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

## Recommended next milestone

Move Pipeline authentication to secure same-origin cookies and enforce authenticated page access before PPC HTML is served. Then add browser E2E coverage using dedicated ADMIN, USER, and VIEWER test accounts.
