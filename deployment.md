# Deployment Guide

## Current deployment model

The current application can be deployed as a Next.js application without environment variables or external services. Repository Markdown is built into the deployment, while mutable reading and administration state remains in each visitor's browser.

## Prerequisites

- Node.js 20.9 or newer
- npm
- A Git repository containing the full project

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
7. No environment variables are required for this milestone.
8. Deploy and verify `/library` plus at least one `/library/[slug]` page.

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

The existing `.gitignore` already excludes these paths.

## Post-deployment smoke test

1. Load `/library` in a private browser window.
2. Confirm the Category and Search controls render.
3. Open a document and use its topic navigation.
4. Bookmark and complete the document, then refresh.
5. Enter local admin mode and verify the category manager opens.
6. Add a temporary document element and save it.
7. Check the browser console for hydration or runtime errors.
8. Confirm mobile layout at approximately 390px width.

## Important persistence warning

Vercel deployment does not make the local admin state shared. Each browser receives its own document/category edits, bookmarks, history, completion state, and video links. Clearing site data removes those local changes.

Before a shared production launch, add authenticated server persistence, authorization, migrations, backups, and audit logging.

## Rollback

Use Vercel's deployment history to promote the last known-good deployment, or redeploy a previously verified Git commit. Browser-local data schemas should remain backward compatible across rollbacks whenever possible.

