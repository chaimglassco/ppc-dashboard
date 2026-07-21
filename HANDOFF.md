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

- PPC Dashboard: `d792d4c` — latest synchronized Gallery and catalog-hydration update
- Product Pipeline: `c507888` — current synchronized gateway repository state

The PPC Dashboard checkout contains an unreleased video-header placement update. Pipeline remains synchronized with `origin/main`.

## Unreleased local work

- Video playback now sits in a large responsive right-hand section inside the blue header. Google Drive’s fixed toolbar is cropped outside the visible frame so its play control and playing content remain centered; a compact new-tab overlay remains and the redundant OPEN VIDEO text button is removed.
- Gallery full-image previews now reuse each tile’s already-resolved image source, so opening the modal does not trigger another authenticated media download.
- Key Insight remains one builder element and now includes persistent Green, Blue, and Red color tabs; missing legacy `insightColor` values render Green.
- The square Gallery presentation, catalog hydration fix, and Google Drive `/preview` URL support are already included in synchronized commit `d792d4c`.

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

All passed with 14 test files and 74 tests.

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

## July 21, 2026 — WYSIWYG Library composers

- Tiptap 3.28.0 powers supported body composers with Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls.
- Reader content uses static React rendering; checklist state persists and reader checkboxes are disabled.
- Optional JSON fields coexist with synchronized legacy strings. Legacy Markdown converts lazily, and malformed rich JSON falls back to saved text.
- Standalone list rows intentionally expose inline formatting only.
- Automated status at handoff: lint, typecheck, all 86 tests, and the 15-route production build pass. Rerun all four gates after any further changes.
- Authenticated browser verification now passes through a temporary local same-origin gateway that mirrors the production Pipeline `/ppc/*` rewrite: real Pipeline ADMIN login, PPC session verification, selection-aware Bold/Underline/Checklist editing, checked checklist persistence, save, reader rendering, full refresh, return to edit mode, and cleanup were verified against the production PPC build with no browser warnings or errors. The gateway and test content were removed afterward; no authentication bypass was added.
- Rich-text list presentation explicitly restores disc and decimal markers removed by the Tailwind reset. Task-list items use the actual editor/reader DOM contract so checkbox and copy remain in one aligned row. Ordered-list editor JSON drops Tiptap's unsupported `type: null` attribute before strict validation, allowing numbered formatting to persist after save.
