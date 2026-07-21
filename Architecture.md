# Glassco Back Office Library — Architecture

## Current mode

The application is a modular Next.js monolith with repository content and browser-local mutable state. There is no authentication, database, middleware authorization, remote CMS, or external API dependency.

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
- `src/features/library/data` owns repository Markdown loading and validation.
- `src/features/library/state` owns browser-storage schemas and adapters.
- `src/features/library/ui` owns catalog, reader, administration, and builder interfaces.
- `content/library` is the seeded Markdown content source.

## Rendering model

Pages and seeded documents are statically generated where practical. Server Components load repository content. Focused Client Components manage search parameters, reading state, local administration, category administration, and structured editing.

The reading-state hook uses a server-safe hydration snapshot so server HTML and the first browser render remain deterministic even when bookmarks already exist locally.

## Content repository

The repository parses front matter and Markdown, validates starter taxonomy, rejects duplicate IDs/slugs, derives reading time, and extracts stable topics. Reader-facing repository queries expose only published, non-hidden seed content.

Markdown does not allow arbitrary raw HTML. GFM tables are constrained for responsive horizontal scrolling.

## Structured document builder

Legacy Markdown documents are converted into editable topic elements on entry to edit mode. Once saved, structured elements become the local document representation. Optional fields provide backward compatibility for newer repeatable dropdowns and table column widths.

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
- Responsive Gallery editor grids with minimum slot creation; square `object-fit: contain` presentation preserves each source ratio while the image modal provides full-size inspection
- Video link validation and presentation derivation: YouTube privacy-enhanced embeds, Google Drive `/preview` embeds, native direct-file playback, and secure link fallback

## Document metadata editor

The catalog modal is now a creation-only boundary. It accepts title, description, and category while assigning the existing defaults for document type, tags, and legacy Markdown. Existing catalog cards no longer expose an Edit / Rename action.

Existing-document metadata editing lives in the structured builder. Entering edit mode replaces the blue header copy with controlled title, description, and category fields. Saving edit mode sends those metadata values and the current structured elements through one shared document update, while retaining the stable document ID and slug and preserving type, tags, and legacy Markdown.

The creation modal retains Category Plus and Pencil controls for quick creation and full category management. The library category manager remains the boundary for rename, reorder, visibility, recoverable deletion, and recovery. Deleted categories are not rendered in the main manager list; a recovery icon opens a focused dialog containing only recoverable categories. Reader edit mode consumes the validated active category list for reassignment.

The catalog toolbar keeps document creation available in both view and admin modes. Document recovery remains an admin action: deleted documents are excluded from the catalog layout, and an admin-only recovery icon opens a focused dialog containing the recoverable document list.

The catalog’s server-provided seed documents are not rendered as active cards while client administration state is hydrating. The document grid remains a skeleton until the shared snapshot succeeds or the validated browser cache is selected as fallback, preventing stale deleted records from appearing during refresh.

## Browser-local persistence

Three independent versioned stores are used:

- Reading state: bookmarks, recent history, last topic, completion
- Document administration: local documents, order, visibility, recovery, structured content, video URLs
- Category administration: category names, order, visibility, recovery

Every read validates untrusted JSON. Missing or malformed state falls back to defaults. Failed writes do not crash the UI.

This is an interface prototype, not a security boundary.

## Styling

`src/app/globals.css` contains the base application design system. `src/app/library-admin.css` contains catalog/admin overrides and category-manager styling. The structured builder uses a colocated CSS module.

The shared application switcher is a client-side segmented tab control rendered inside each application shell's reserved top bar. It reads and updates the existing `glassco.appRoutes.v1` browser route memory without changing its schema.

## Future replacement boundaries

The repository adapter can be replaced by a database or CMS while preserving `LibraryDocument`. Browser-state adapters can be replaced by authenticated server adapters while preserving UI actions.

A shared deployment must add:

- Authentication
- Server-side authorization
- Database migrations
- Workspace/role ownership
- Audit logging
- Backups and restore
- Secure media/content policies

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Current verified result: all gates pass, including 48 tests and 15 generated routes/pages.
# Pipeline-domain integration

Next.js is compiled with `basePath: "/ppc"`. Pipeline proxies `/ppc/:path*` to the stable PPC deployment alias, producing one browser origin without combining repositories or persistence systems.

`GlasscoSessionProvider` reads the existing Pipeline bearer session and verifies it through the PPC `/api/pipeline-session` server route. That route delegates verification to Pipeline `/api/auth/session`. The Library route handler repeats verification for reads and requires `ADMIN` for writes. The client gate improves navigation but is not treated as the authorization boundary; mutation authorization is server-enforced.

`PIPELINE_AUTH_ORIGIN` may override the server verification origin, and `NEXT_PUBLIC_PIPELINE_ORIGIN` may override the browser return destination. Both default to `https://glasscopipeline.vercel.app`.
