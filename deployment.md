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
6. Confirm the document form does not show Document Type, Tags, or Content Markdown.
7. Use the Category Plus control to create and select a temporary category.
8. Use the Category Pencil control to open the category manager; verify rename, reorder, and recoverable deletion controls.
9. Open a private browser window and confirm that temporary document is visible.
10. Add and reorder temporary document elements, then confirm the saved order in the private window.
11. Check the browser console for hydration or runtime errors.
12. Confirm mobile layout at approximately 390px width.

## Temporary access warning

The shared admin API intentionally has no authentication during this MVP phase. Anyone with the application link can currently create, edit, hide, delete, recover, and reorder library content. Add server-side authentication, role authorization, audit logging, and stronger concurrency controls before sharing beyond the intended team.

## Rollback

Use Vercel's deployment history to promote the last known-good deployment, or redeploy a previously verified Git commit. Browser-local data schemas should remain backward compatible across rollbacks whenever possible.
