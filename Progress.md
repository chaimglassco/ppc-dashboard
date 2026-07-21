# Project Progress

Last updated: July 17, 2026

## Overall status

The Glassco Back Office Library UI milestone is complete and buildable. The product currently operates as an unauthenticated, browser-local MVP.

## Completed

### Application shell and catalog

- Glassco branding and Library-only navigation.
- Responsive desktop and mobile application shell.
- Glassco Back Office Library hero.
- Document search and configurable category filtering.
- Bookmark and recent-document entry points.
- Loading, empty, error, and not-found states.

### Reader experience

- Safe GFM Markdown rendering.
- Stable numbered topic navigation.
- Conditional full-title tooltips only for truncated topics.
- Bookmark, recent-view, and completion tracking.
- Responsive tables and document layouts.
- Hydration-safe browser reading state.

### Local library administration

- Eye control in view mode, Pencil control in admin mode, and an always-visible Plus control for creating documents.
- Create and edit documents.
- Rename, hide/show, reorder, delete, and recover documents.
- Create, rename, hide/show, reorder, delete, and recover category options.
- Category recovery moved behind a compact recovery icon and dedicated deleted-category dialog.
- Document recovery moved out of the catalog footer and behind an admin-toolbar recovery icon with a dedicated deleted-document dialog.
- Creation-only document form with document type, tags, and legacy Markdown removed from the visible form while their saved defaults remain preserved.
- Category Plus and Pencil controls beside the document Category field for quick creation and full category management.
- Removed the catalog-card Edit / Rename action; existing document title, description, and category now edit directly in the blue document header during builder edit mode.
- Device-local persistence and recovery.
- Refresh-safe catalog hydration keeps seed documents behind a skeleton until shared state or the cached fallback resolves, eliminating deleted-document flashes.

### Structured document builder

- View and edit modes.
- Responsive element picker that flips to available viewport space.
- Topic numbering and sidebar synchronization.
- Repeatable dropdown entries with multiline preservation.
- Editable tables with add-row, add-column, row-height, and column-width controls.
- One unified Bullets element with Bullets, Checklist, and Numbers tabs; previously saved standalone list types remain compatible.
- Diagnostic Flow steps support independent multiline rich-text descriptions while preserving connector labels and legacy saved nodes.
- Headline and Description elements provide Left, Center, and Right alignment; Headline is inline-format only and Description exposes the full composer toolbar.
- Highlighted text opens a matching viewport-aware selection toolbar, and all fixed/floating toolbar controls retain compact typography inside large-text elements.
- Editable Tables provide exact row and column deletion with one-row/one-column minimum safeguards and synchronized column widths.
- Centered statements, callouts, lists, color-configurable Key Insights, feature cards, text blocks, roadmaps, and diagnostic flows. Key Insights retain the existing Green default and provide persistent Green/Blue/Red tabs in edit mode.
- Roadmap step-number position controls for Left, Center, and Right layouts; Center stacks the step copy and displays images at full available width.
- Roadmap steps upload images to shared Blob storage and edit Plain/Bullets/Checklist/Numbered text directly inside the composer while remaining compatible with previously saved image URLs.
- Feature Cards and Galleries use the shared upload flow; Gallery layout selection immediately creates the minimum responsive upload slots. Saved and editor Gallery tiles are square, show the complete uncropped source image, and open full-image previews from the already-loaded tile source without a second request.
- Private shared images now display through authenticated object-URL previews instead of broken direct `<img>` requests to bearer-protected media routes.
- Standalone Button elements support validated links, four widths, three alignments, secure new-tab navigation, and mobile full-width rendering.
- Video tutorials now render as a large responsive player inside the blue document header’s right column; Google Drive’s fixed toolbar is cropped outside the visible frame so its play control and playing content stay centered, while a compact new-tab icon preserves external viewing. Direct files use native playback, generic HTTPS links retain a safe fallback, and the redundant OPEN VIDEO text button is removed.
- Video Add/Pencil controls restricted to document edit mode.

### Quality

- ESLint passes.
- Strict TypeScript check passes.
- Sixteen Vitest files and 94 tests pass.
- Production build passes and generates 15 routes/pages.
- Core desktop flows were visually verified in the local browser.
- Bookmark hydration mismatch was reproduced and fixed.

## Not implemented

- Authentication and administrator identity.
- Users, teams, organizations, workspaces, or roles.
- Server database or cross-device synchronization.
- Server-side authorization or row-level security.
- Amazon Ads API integration.
- Analytics, reporting automation, and PPC analyzers.
- Automated committed browser E2E suite.

## Recommended next milestone

1. Add authentication and a server-backed persistence adapter.
2. Migrate browser-local documents, categories, and reading state.
3. Add server-side authorization for every admin mutation.
4. Add Playwright coverage for catalog, builder, recovery, and persistence flows.
5. Add staging and production deployment environments.
# Unified Glassco integration

- Added `/ppc` base-path support for pages, assets, and APIs.
- Replaced the sidebar dropdown with global, responsive Product Pipeline/PPC Dashboard tabs in a reserved top bar while preserving remembered routes.
- Added Pipeline session verification and role-aware PPC administration.
- Protected shared-library reads with a verified session and writes with an ADMIN session.
- Added legacy `glasscoppc.vercel.app` canonical redirect handling.

# WYSIWYG Library composers

- Added Tiptap 3.28.0 rich-text editors and static React rendering for all supported element body fields.
- Added selection-aware inline styles, bullets, numbers, editable checklists, accessible toolbar state, keyboard shortcuts, and responsive controls.
- Preserved standalone list elements with inline-only row formatting.
- Added validated JSON persistence, synchronized legacy fallbacks, lazy legacy Markdown conversion, and malformed-JSON recovery.
- Expanded automated coverage to 94 tests, including conversion, validation, paste sanitization, fixed and selection-toolbar behavior, unified Bullets tabs, Diagnostic Flow descriptions, aligned text elements, exact table deletion, list semantics, ordered-list persistence, static rendering, and builder integration.
- Completed authenticated same-origin browser verification with the production build: ADMIN edit, selection-aware toolbar state, editable checked checklist state, save, disabled/static reader rendering, full refresh persistence, edit-mode rehydration, cleanup, and zero browser warnings or errors.
- Restored visible disc/decimal markers in both editor and reader modes, aligned task-list checkbox/text rows, and normalized Tiptap ordered-list JSON so numbered formatting survives save and reader rendering.
