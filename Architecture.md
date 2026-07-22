# Glassco Back Office Library — Architecture

## Current mode

The Library is an authenticated Next.js microfrontend. Pipeline owns the authoritative Postgres Library state and authorization boundary; this repository owns the `/ppc` user interface, authenticated API adapter, private image media route, and protected legacy migration route.

## Runtime stack

- Next.js 16.2.10 App Router
- React 19.2.4
- Strict TypeScript
- npm
- Tailwind CSS 4 toolchain and project CSS
- Vitest and Testing Library

## Module boundaries

- `src/app` owns route composition, metadata, shared layout, boundaries, and global CSS.
- `src/components` owns the application shell.
- `src/features/library/domain` owns contracts, headings, search, and builder defaults.
- `src/features/library/data` owns repository Markdown bootstrap validation and legacy Blob backup/migration access.
- `src/features/library/state` owns the shared-state client, response validation, scoped mutations, confirmed-cache fallback, and browser-only reading state.
- `src/features/library/ui` owns catalog, reader, administration, and builder interfaces.
- `content/library` is bootstrap/compatibility content, not an ongoing source merged into the authoritative catalog.

## Rendering model

Server Components can load bootstrap documents for deterministic rendering, but active documents/categories hydrate from Pipeline's shared response. Focused Client Components manage search parameters, browser-only reading state, role-aware administration, structured editing, five-second visible-tab polling, and focus revalidation.

The reading-state hook uses a server-safe hydration snapshot so server HTML and the first browser render remain deterministic even when bookmarks already exist locally.

## Content repository

The repository parser validates bootstrap Markdown, rejects duplicate IDs/slugs, derives reading time, and extracts stable topics. Once the Postgres catalog is initialized, bootstrap Markdown is not merged or republished; active/tombstoned state comes only from Pipeline.

Markdown does not allow arbitrary raw HTML. GFM tables are constrained for responsive horizontal scrolling.

## Structured document builder

Legacy Markdown documents are converted into editable topic elements on entry to edit mode. Once saved, structured elements become the shared document representation. Optional fields provide backward compatibility for newer repeatable dropdowns and table column widths.

The builder owns:

- Element creation and deletion
- Topic derivation and numbering
- View/edit rendering
- Viewport-aware element menu placement
- Repeatable dropdown editing
- Table row/column sizing
- Roadmap placement, step-number position, shared Blob-backed image uploads, inline list-style subtext composers, and full-width centered image rendering
- Reusable authenticated image-upload controls for Roadmaps, Feature Cards, and Gallery slots, backed by the private Blob media route
- Authenticated image rendering fetches private media with the stored Pipeline bearer token, creates a temporary object URL, and revokes it when the preview unmounts or changes
- Key Insight blocks use one optional `insightColor` presentation field with a legacy-safe Green default and Green/Blue/Red editor controls
- Responsive Gallery editor grids with minimum slot creation; square `object-fit: contain` presentation preserves each source ratio while the image modal reuses the rendered image `currentSrc` for immediate full-size inspection
- Video link validation and header presentation derivation: YouTube privacy-enhanced embeds, cropped-toolbar Google Drive `/preview` embeds with centered player content and a compact new-tab overlay, native direct-file playback, and secure link fallback render in the blue header’s responsive right column

## Document metadata editor

The catalog modal is now a creation-only boundary. It accepts title, description, and category while assigning the existing defaults for document type, tags, and legacy Markdown. Existing catalog cards no longer expose an Edit / Rename action.

Existing-document metadata editing lives in the structured builder. Entering edit mode replaces the blue header copy with controlled title, description, and category fields. Saving edit mode sends those metadata values and the current structured elements through one shared document update, while retaining the stable document ID and slug and preserving type, tags, and legacy Markdown.

The creation modal retains Category Plus and Pencil controls for quick creation and full category management. The library category manager remains the boundary for rename, reorder, visibility, recoverable deletion, and recovery. Deleted categories are not rendered in the main manager list; a recovery icon opens a focused dialog containing only recoverable categories. Reader edit mode consumes the validated active category list for reassignment.

The catalog toolbar keeps document creation available in both view and admin modes. Document recovery remains an admin action: deleted documents are excluded from the catalog layout, and an admin-only recovery icon opens a focused dialog containing the recoverable document list.

No document cards render while shared administration state is hydrating. The document grid remains a skeleton until the authoritative response succeeds or the validated confirmed cache is selected as a read-only fallback, preventing stale or deleted records from appearing during refresh.

## Persistence and synchronization

- Pipeline `/api/library-state` stores documents, categories, tombstones, ordering, global revision, per-record versions, audit records, and backups in Postgres.
- Library `/ppc/api/library` forwards authenticated GET/PATCH/POST requests and does not keep writable catalog state.
- Document/category changes are scoped operations. Record updates, delete, and restore use `expectedVersion`; catalog ordering and initialization use `expectedRevision`. Conflicts return `409` plus the latest full response.
- ADMIN may perform every mutation and backup action. USER may create and update active documents. VIEWER is read-only. Pipeline checks the current active database user on every request.
- Successful server responses replace the confirmed browser cache. If the server cannot be reached, a validated cache may render read-only; mutations are disabled and local edits are never queued for upload.
- Deleted documents and categories retain `deletedAt` tombstones and remain inactive until explicit ADMIN recovery.
- Only bookmarks, recent history, last topic, completion, session/route handoff, and the confirmed read-only catalog cache remain browser-local.

## Styling

`src/app/globals.css` contains the base application design system. `src/app/library-admin.css` contains catalog/admin overrides and category-manager styling. The structured builder uses a colocated CSS module.

The shared application launcher renders three independent card links inside each shell's reserved top bar. Product Pipeline, Team SOP Library, and PPC Dashboard are real `target="_blank"` links; the current application remains visually active and `glassco.appRoutes.v1` supplies independently validated destinations. Its optional `ppcDashboard` field extends the legacy `{ pipeline, ppc }` record without invalidating it.

For session-only logins, the source tab writes the versioned `glassco.authHandoff.v1` record to same-origin local storage with a 30-second expiration and a Pipeline/PPC target. The matching destination consumes it once into its own session storage, removes the record, and verifies the bearer token through `/ppc/api/pipeline-session`. Persistent local-storage sessions bypass the handoff. Missing/401 sessions return to Pipeline with a validated `/ppc/library/*` or `/ppc/dashboard` `returnTo`; temporary verification failures show a retry gate.

## Storage boundaries

Pipeline Postgres is authoritative for catalog data. Private Vercel Blob remains authoritative only for uploaded images; the old `glassco/library-state-v1.json` object and checksum-addressed copies under `glassco/library-backups/` are migration/rollback artifacts, never live writable state.

The protected `/ppc/api/library/migration` route is ADMIN-only. It can download the legacy snapshot, create an immutable checksum backup, and initialize an empty Pipeline catalog with the two retained production documents while tombstoning all others. Initialization is revision-zero-only and must run after both server and client protections deploy.

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Current verified result: all gates pass, including 124 tests across 22 files.
# Pipeline-domain integration

Next.js is compiled with `basePath: "/ppc"`. Pipeline proxies `/ppc/:path*` to the stable PPC deployment alias, producing one browser origin without combining repositories or persistence systems.

`GlasscoSessionProvider` reads the existing Pipeline bearer session and verifies it through the PPC `/api/pipeline-session` server route. The Library adapter passes that bearer token to Pipeline `/api/library-state`; Pipeline reloads the active user and role before authorizing each operation. The client gate and hidden controls improve navigation but are not treated as the authorization boundary.

`PIPELINE_AUTH_ORIGIN` may override the server verification origin, and `NEXT_PUBLIC_PIPELINE_ORIGIN` may override the browser return destination. Both default to `https://glasscopipeline.vercel.app`.

# Rich-text architecture

`domain/rich-text.ts` owns the persistence allowlist, legacy Markdown/plain-text conversion, text fallback generation, and malformed-document fallback. The domain contract intentionally does not depend on Tiptap types.

`ui/rich-text.tsx` is the client-only editor boundary. It configures Tiptap with `immediatelyRender: false`, excludes unsupported nodes and marks, and emits both JSON and searchable legacy text. Reader output uses `@tiptap/static-renderer` React mappings rather than raw HTML. The same CSS typography rules are applied to editable and static content.

Rich JSON fields are optional and additive. Shared/local state validation removes invalid optional rich content while retaining the surrounding document so the builder can reconstruct it from legacy strings.
