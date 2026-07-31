# Glassco PPC Dashboard Handoff

Last updated: July 21, 2026

## Start here

The unified Glassco application milestone is implemented, deployed, committed, and pushed. Do not rebuild the integration from scratch.

Canonical production URLs:

- Product Pipeline: <https://glasscopipeline.vercel.app/>
- PPC Library: <https://glasscopipeline.vercel.app/ppc/library>
- Legacy PPC URL: <https://glasscoppc.vercel.app/> redirects to the canonical PPC Library URL.

Local repositories:

- Team SOP Library: `C:\Users\HomePC\Documents\GitHub\library`
- Product Pipeline: `C:\Users\HomePC\Documents\GitHub\pipeline`

Current production commits:

- PPC Dashboard: `d792d4c` — latest synchronized Gallery and catalog-hydration update
- Product Pipeline: `c507888` — current synchronized gateway repository state

The PPC Dashboard checkout contains an unreleased video-header placement update. Pipeline remains synchronized with `origin/main`.

## Unreleased local work

- Video playback now sits in a large responsive right-hand section inside the blue header. Google Drive’s fixed toolbar is cropped outside the visible frame so its play control and playing content remain centered; a compact new-tab overlay remains and the redundant OPEN VIDEO text button is removed.
- Gallery full-image previews now reuse each tile’s already-resolved image source, so opening the modal does not trigger another authenticated media download.
- Key Insight remains one builder element and now includes persistent Green, Blue, and Red color tabs; missing legacy `insightColor` values render Green.
- Bullet Text, Checklist Bullets, and Numbered Text are consolidated into one **Bullets** picker item with Bullets, Checklist, and Numbers tabs. Existing saved list types remain compatible.
- Diagnostic Flow steps now include independent multiline rich-text descriptions above their connector labels; legacy nodes hydrate with empty descriptions.
- Text selections open a viewport-aware formatting Bubble Menu while the fixed composer toolbar remains available, and large-text elements no longer enlarge toolbar controls.
- Both rich-text toolbars now include a Document link icon beside the URL-link icon. It preserves the selection, lazily searches one shared authoritative catalog of other published visible documents, and saves the chosen target through the existing protected `link.href` route.
- Editable Tables can delete exact rows and columns while retaining at least one of each. Standalone Headline and Description elements provide Left/Center/Right alignment with inline-only and full formatting respectively.
- The square Gallery presentation, catalog hydration fix, and Google Drive `/preview` URL support are already included in synchronized commit `d792d4c`.

## What is implemented

- PPC production deployment `dpl_6xM9bVCRqW8dLUqGL8GXtymQRR1V` is READY and aliased to `glasscoppc.vercel.app`. `/ppc/dashboard` is already available through the canonical Pipeline gateway; deploy Pipeline only after explicit production approval.
- Pipeline remains the default application at `/`.
- PPC is mounted behind the Pipeline domain at `/ppc` using a Vercel external rewrite. Team SOP Library remains at `/ppc/library/*`; `/ppc/dashboard` is the authenticated coming-soon page.
- Both application shells include separate Product Pipeline, Team SOP Library, and PPC Dashboard cards.
- Each application card opens its last validated route from the backward-compatible `glassco.appRoutes.v1` record in a new browser tab, including the active app, while leaving the source page unchanged.
- PPC uses `basePath: "/ppc"`; pages, assets, client API calls, and nested routes respect it.
- PPC reads the existing Pipeline session from `launchflow.authSession.v1` and verifies it through Pipeline `/api/auth/session` before showing the application. A session-only source tab uses a 30-second target-scoped one-use `glassco.authHandoff.v1`; missing/expired sessions return through validated `returnTo` login behavior.
- ADMIN users receive document, category, Recovery Center, reorder, snapshot, version, protected-archive, integrity-incident, and builder controls.
- USER users can create documents and edit active document content/metadata. VIEWER users are read-only; bookmarks and completion controls remain available to all roles.
- `/ppc/api/library` requires a verified Pipeline session and proxies scoped requests to Pipeline's authoritative Postgres `/api/library-state` endpoint. Pipeline enforces permissions against the current active user record.
- Direct visitors to the old PPC domain are redirected to the canonical Pipeline domain.
- Shared PPC documents, categories, append-only full-content versions, audit attribution, integrity incidents, and snapshots live in Pipeline Postgres. Private Blob stores authenticated images plus immutable daily offsite Library snapshots.
- Bookmarks, recent history, completion, and remembered app routes remain browser-local on the unified Pipeline origin.
- The Library refreshes shared state every five seconds while visible and on tab focus. A validated confirmed cache is read-only during outages and cannot be uploaded back to the server.
- Normal deletion creates a recoverable tombstone. “Delete forever” was replaced by protected archival: content is removed from normal Recovery but remains retained indefinitely. The Recovery Center can restore tombstones, archived documents, prior versions, selected snapshot records, and acknowledge automatic repair incidents.
- The Library Vercel cron runs `/ppc/api/library/maintenance` at 16:30 UTC daily. Set the same value for Pipeline `LIBRARY_BACKUP_SECRET`, Library `LIBRARY_BACKUP_SECRET`, and Library `CRON_SECRET`, and keep the private Blob connection available.

## Important boundaries

- This is a unified-domain microfrontend integration, not a monorepo conversion.
- Pipeline and PPC remain separate repositories and Vercel projects with independent rollback.
- Deploy PPC first so `/ppc/dashboard` and handoff consumption exist before the updated Pipeline cards are released.
- Pipeline authentication still originates from a browser-stored bearer token. The PPC browser gate improves the user flow, but it is not the final server-rendered page security boundary.
- PPC shared API reads and mutations are authenticated. ADMIN has full mutation access, USER has document create/update access, and VIEWER is read-only; these rules are server-enforced.
- Repository Markdown and legacy browser administration keys must never be merged into an initialized catalog. Deleted records remain tombstoned until an explicit ADMIN restore.
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

All passed with 22 test files and 124 tests.

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
cd "C:\Users\HomePC\Documents\GitHub\library"
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

## Persistence rollout still required

Do not initialize or clean production data until this order is followed:

1. Deploy Pipeline's Postgres `/api/library-state` endpoint and verify authenticated GET, scoped PATCH, conflict, audit, and backup behavior.
2. Deploy the Library adapter/client so stale local data cannot write, failed saves cannot remain local-only, and cache fallback is read-only.
3. As ADMIN, call the protected `/ppc/api/library/migration` backup action and retain the returned checksum/path (or download the legacy snapshot with authenticated GET).
4. Call `initialize-clean-catalog` only while Pipeline revision is `0`. It preserves the existing IDs/content of **Sample Document with all the elements** and **Checking Spenders with No Sales**, tombstones every other legacy document, and reports the retained records.
5. Verify two active documents across ADMIN, USER, and VIEWER accounts before allowing normal edits.

After this rollout, move Pipeline authentication to secure same-origin cookies and add browser E2E coverage using dedicated role accounts.

## July 21, 2026 — WYSIWYG Library composers

- Tiptap 3.28.0 powers supported body composers with Normal, Bold, Italic, Underlined, Bullets, Checklist, and Numbers controls.
- Reader content uses static React rendering; checklist state persists and reader checkboxes are disabled.
- Optional JSON fields coexist with synchronized legacy strings. Legacy Markdown converts lazily, and malformed rich JSON falls back to saved text.
- Standalone list rows intentionally expose inline formatting only.
- Automated status at handoff: lint, typecheck, all 212 passing tests across 33 files (6 skipped), and the production build (including `/dashboard`) pass. Rerun all four gates after any further changes.
- Reader mode controls now show Eye in view mode and a non-submitting Pencil indicator in edit mode. Edit mode exposes a separate `Save changes` button; successful saves return to view mode, while rejected saves retain the editor and unsaved draft.
- Authenticated browser verification covers the new selection toolbar, Headline/Description picker and alignment controls, Diagnostic Flow descriptions, exact table deletion safeguards, compact 11px/32px toolbar controls, desktop layout, and a 390px viewport. All verification edits were discarded without saving and produced no browser warnings or errors.
- Authenticated browser verification now passes through a temporary local same-origin gateway that mirrors the production Pipeline `/ppc/*` rewrite: real Pipeline ADMIN login, PPC session verification, selection-aware Bold/Underline/Checklist editing, checked checklist persistence, save, reader rendering, full refresh, return to edit mode, and cleanup were verified against the production PPC build with no browser warnings or errors. The gateway and test content were removed afterward; no authentication bypass was added.
- The searchable Document link flow was verified through the same authenticated local gateway: fixed and selection toolbars exposed the new control, the authoritative catalog excluded the current document, search narrowed to `TEST 1`, save/refresh preserved `/ppc/library/test-1-ee68c9a2` with protected new-tab attributes, and the target reader loaded successfully. `TEST 3` was restored to its original text and external `here` link afterward.
- Rich-text list presentation explicitly restores disc and decimal markers removed by the Tailwind reset. Task-list items use the actual editor/reader DOM contract so checkbox and copy remain in one aligned row. Ordered-list editor JSON drops Tiptap's unsupported `type: null` attribute before strict validation, allowing numbered formatting to persist after save.
