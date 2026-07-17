# Glassco Back Office Library

Glassco Back Office Library is a responsive knowledge base and document builder for Amazon PPC operating procedures. The current release is an unauthenticated, browser-local MVP intended for one operator on one device.

## Current capabilities

- Browse eight starter SOPs, guides, checklists, templates, and playbooks.
- Search documents and filter them by a configurable category taxonomy.
- Read responsive documents with numbered topic navigation.
- Bookmark documents, track recent views, and mark documents complete.
- Create, rename, hide, reorder, delete, and recover library documents.
- Create, rename, hide, reorder, delete, and recover category options.
- Build documents from reusable content elements:
  - Topics
  - Centered statements
  - Blue callouts
  - Bullet and numbered text
  - Checklist bullets
  - Key insights
  - Editable tables with resizable columns
  - Repeatable dropdowns
  - Feature cards
  - Blue text blocks
  - Roadmaps
  - Diagnostic flows
- Attach a video tutorial link with a preview thumbnail and watch action.
- Persist reading and administration changes in versioned browser storage.

## Technology

- Next.js 16.2.10 App Router
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4 toolchain plus project CSS
- Vitest and Testing Library
- Repository-controlled Markdown parsed with `gray-matter` and `react-markdown`

## Requirements

- Node.js 20.9 or newer
- npm

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000/library](http://localhost:3000/library).

## Quality commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The last verified state passes all four commands with 30 tests.

## Project structure

```text
content/library/                 Starter Markdown documents
src/app/                         Next.js routes, layout, and global styling
src/components/                  Shared application shell
src/features/library/data/       Markdown repository adapter
src/features/library/domain/     Types, search, headings, and builder rules
src/features/library/state/      Versioned browser-storage adapters
src/features/library/ui/         Catalog, reader, admin, and builder UI
```

## Persistence and security

This version has no authentication, database, server-side authorization, or synchronization. Bookmarks, history, completion, document edits, category edits, video links, visibility, and recovery state are stored in the current browser only.

Do not treat the local admin interface as a security boundary. Authenticated server storage and authorization are required before using this as a shared multi-user back office.

## Documentation

- [Product specification](Product-Spec.md)
- [Architecture](Architecture.md)
- [Progress](Progress.md)
- [QA checklist](qa-checklist.md)
- [Deployment](deployment.md)
- [Data contract](data-contract.md)
- [Agent guidance](AGENTS.md)

## Deployment

The project can be deployed to Vercel without environment variables for the current milestone. See [deployment.md](deployment.md) for the complete checklist and local-storage limitations.
# Unified Glassco access

The Library is built with the `/ppc` base path and is mounted at `https://glasscopipeline.vercel.app/ppc/library`. Use the Product Pipeline/PPC Dashboard selector to switch the complete application shell. The old `glasscoppc.vercel.app` visitor URL redirects to the canonical Pipeline domain.

PPC reads the existing `launchflow.authSession.v1` Pipeline session. ADMIN users can edit library content; USER and VIEWER users receive the reader interface.

