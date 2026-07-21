# Deployment Guide

## Current deployment model

The application deploys as Next.js with a private Vercel Blob store. Repository Markdown supplies the seed catalog; document and category administration state is shared through `/api/library`. Bookmarks, history, completion, and last-read position remain browser-local.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Git repository containing the full project
- A private Vercel Blob store connected to the project

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

Open [http://localhost:3000/library](http://localhost:3000/library).

## Deploy with Vercel

1. Push the complete repository to GitHub.
2. Sign in to Vercel and choose **Add New Project**.
3. Import the GitHub repository.
4. Keep the detected framework as **Next.js**.
5. Use the repository root as the root directory.
6. Use `npm run build` as the build command.
7. Connect a private Vercel Blob store to production, preview, and development. Vercel injects the Blob credentials automatically.
8. Deploy and verify `/library`, `/api/library`, and at least one `/library/[slug]` page.

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
5. Enter admin mode, create a temporary document, and save it.
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
19. Open a private browser window and confirm that temporary document is visible.
20. Add and reorder temporary document elements, then confirm the saved order in the private window.
21. Check the browser console for hydration or runtime errors.
22. Confirm mobile layout at approximately 390px width.
23. Confirm the Product Pipeline/PPC Dashboard tabs appear in the reserved top bar, show white text for the active app, switch to the remembered route, and never overlap page content.

## Temporary access warning

The shared admin API intentionally has no authentication during this MVP phase. Anyone with the application link can currently create, edit, hide, delete, recover, and reorder library content. Add server-side authentication, role authorization, audit logging, and stronger concurrency controls before sharing beyond the intended team.

## Rollback

Use Vercel's deployment history to promote the last known-good deployment, or redeploy a previously verified Git commit. Browser-local data schemas should remain backward compatible across rollbacks whenever possible.
# Unified deployment

Deploy PPC before enabling the Pipeline gateway. The production build must serve the `/ppc` base path. Verify `/ppc/library`, `/ppc/_next/*`, `/ppc/api/pipeline-session`, and `/ppc/api/library` through the public PPC production alias before deploying the Pipeline rewrite. The PPC proxy must allow requests forwarded by `glasscopipeline.vercel.app` while redirecting direct visitors from the legacy PPC host.

Optional environment variables:

- `PIPELINE_AUTH_ORIGIN` — server-to-server Pipeline authentication origin.
- `NEXT_PUBLIC_PIPELINE_ORIGIN` — browser destination when leaving PPC or when authentication fails.

Both default to `https://glasscopipeline.vercel.app`. Roll back PPC and Pipeline independently by promoting their previous production deployments.
