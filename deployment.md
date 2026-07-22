# Deployment Guide

## Current deployment model

The Library deploys as a Next.js microfrontend under `/ppc`. Pipeline Postgres is authoritative for documents, categories, tombstones, versions, audit records, and shared backups after the protected one-time legacy Blob migration. Private Vercel Blob remains required for uploaded images and the immutable legacy migration artifact. Repository Markdown is bootstrap/compatibility content only; bookmarks, history, completion, and last-read position remain browser-local.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Git repository containing the full project
- A private Vercel Blob store connected to the project
- A deployed Pipeline project with Postgres configured and `/api/library-state` available
- An active Pipeline ADMIN account for migration and rollout verification

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
9. Open a document, enter edit mode, and change its title, description, and category in the blue header; save and refresh to confirm persistence.
10. Open the new-document form and confirm it does not show Document Type, Tags, or Content Markdown.
11. Use the Category Plus control to create and select a temporary category.
12. Use the Category Pencil control to open the category manager; verify rename, reorder, and recoverable deletion controls.
13. Confirm deleted categories are absent from the main list, then use the recovery icon to open the recovery dialog and recover one.
   Add a Key Insight, click Green, Blue, and Red, and confirm each color previews immediately; save on Red, refresh, and confirm Red persists. Confirm an older insight without `insightColor` remains Green.
14. Add a Roadmap, select Center number, and confirm its number, title, and subtext are centered and its image uses the full step width after saving.
15. Upload a Roadmap step image, confirm its shared upload completes, and verify each subtext format edits directly inside the composer and persists in a second browser session.
16. Upload Feature Card and Gallery images, switch every Gallery layout, and confirm minimum slots, responsive grids, shared previews, replacement, and removal.
   Confirm the preview request includes authenticated media access and displays the actual image rather than a broken image icon.
   Confirm square, portrait, and landscape Gallery sources are fully visible inside square tiles without cropping, then click each loaded tile to verify the full-image preview opens immediately without another media request.
17. Add Buttons for internal and HTTPS links; verify every width/alignment option, invalid-link feedback, secure new-tab attributes, and mobile full-width behavior.
18. Add a shared Google Drive video link and confirm a large 16:9 Drive preview player appears inside the blue document header’s right column. Confirm the play icon and playing video content are centered, the compact new-tab icon works, and no separate OPEN VIDEO text button appears.
19. Open a second authenticated account and confirm the temporary document appears within five seconds, then edit it and confirm the ADMIN tab updates within five seconds or immediately after focus.
20. Verify USER can create/edit active documents but cannot delete, recover, reorder, or manage categories; verify VIEWER cannot mutate and direct forbidden PATCH requests return `403`.
21. Check the browser console for hydration or runtime errors.
22. Confirm mobile layout at approximately 390px width.
23. Confirm the Product Pipeline, Team SOP Library, and PPC Dashboard cards appear separately in the reserved top bar, show white text for the active app, and each open its remembered route in a new browser tab—including the active tab—without changing or overlapping the source page.
24. Confirm `/ppc/dashboard` renders the shared authenticated shell and centered “PPC Dashboard — Coming soon” placeholder.
25. From a session-only Pipeline login, open each PPC card and confirm the one-time handoff is consumed without another login. Confirm persistent “Remember me,” expired-session return, external `returnTo` rejection, keyboard focus, hover, and narrow-screen horizontal scrolling.

## Authoritative persistence rollout

Production data cleanup is deliberately separate from code deployment. Use this order:

1. Deploy Pipeline first. Confirm `/api/library-state` authenticates through the current user table, returns revision/record versions, enforces ADMIN/USER/VIEWER permissions, records audit attribution, and can create/list a backup.
2. Deploy Library next. Confirm `/ppc/api/library` is a thin authenticated adapter, old local administration keys are ignored, server failures make the confirmed cache read-only, and repository Markdown is not merged after initialization.
3. With an ADMIN bearer session, POST `{ "action": "create-backup" }` to `/ppc/api/library/migration`. Record the returned checksum and Blob pathname. Optionally GET the same route to download the exact legacy JSON.
4. Inspect the backup and confirm exactly one legacy record exists for each retained title: **Sample Document with all the elements** and **Checking Spenders with No Sales**.
5. Only when Pipeline returns revision `0` with an empty catalog, POST `{ "action": "initialize-clean-catalog" }` to the migration route. The operation preserves retained IDs/slugs/content/rich text/images/settings and tombstones every other legacy document.
6. Confirm the response reports two active documents. Verify those two and only those two appear for ADMIN, USER, and VIEWER; confirm tombstoned documents appear only in ADMIN recovery and do not flash after refresh.
7. Test a same-record stale edit and require `409` plus current shared state before enabling routine editing.

Never run initialization before the server and client protections are deployed. It is revision-zero-only and must not be used to overwrite an initialized catalog.

## Rollback

Before restoring catalog data, create a Pipeline backup. Restore through the ADMIN backup API with the current `expectedRevision`; the server creates an automatic before-restore backup and tombstones records absent from the restored state. Use Vercel's deployment history to roll back code independently. Never restore catalog state from localStorage or repository Markdown.
# Unified deployment

For the authoritative persistence rollout, deploy Pipeline's database endpoint before Library, then perform the backup/initialization sequence above. For navigation-only releases, deploy PPC before enabling updated Pipeline navigation. The production build must serve the `/ppc` base path. Verify `/ppc/library`, `/ppc/dashboard`, `/ppc/_next/*`, `/ppc/api/pipeline-session`, `/ppc/api/library`, and the ADMIN-only migration route through the public PPC production alias before changing the Pipeline rewrite/cards. The PPC proxy must allow requests forwarded by `glasscopipeline.vercel.app` while redirecting direct visitors from the legacy PPC host.

Optional environment variables:

- `PIPELINE_AUTH_ORIGIN` — server-to-server Pipeline authentication origin.
- `NEXT_PUBLIC_PIPELINE_ORIGIN` — browser destination when leaving PPC or when authentication fails.

Both default to `https://glasscopipeline.vercel.app`. Roll back PPC and Pipeline independently by promoting their previous production deployments.

## Rich-text deployment notes

Rich-text support adds client/runtime packages and optional fields inside the existing shared Library JSON payload. It requires no environment variables, database migration, or conversion job. Existing documents are upgraded lazily when edited and remain readable through synchronized legacy fields. Verify a saved formatted document through the canonical `/ppc/library/:slug` route before promotion.
