# QA Checklist

Use this checklist before merging or deploying changes.

## Automated gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 124 tests passing across 22 test files
- [x] `npm run build`

## Catalog and navigation

- [x] `/` redirects or opens the Library experience.
- [x] `/library` loads without a hydration error.
- [x] Glassco Back Office Library branding is visible.
- [x] Only the Category and Search filters are shown.
- [x] Search is case-insensitive and clears correctly.
- [x] Category filter combines with search.
- [x] Category arrow is inset from the right border.
- [x] View mode displays the Eye control.
- [x] Admin mode displays Pencil and Plus controls.
- [x] Plus remains visible in view mode and opens new-document creation.

## Document administration

- [x] Create a new document.
- [x] Edit and rename a document.
- [x] New-document editor shows title, description, and category without document type, tags, or Content Markdown fields.
- [x] New-document creation supplies the hidden type, tags, and legacy Markdown defaults.
- [x] Catalog admin cards do not show the removed Edit / Rename action.
- [x] Hide and show a document.
- [x] Move documents up and down.
- [x] Delete a document into recovery.
- [x] Deleted documents do not render as a recovery section below the catalog.
- [x] Admin toolbar recovery icon opens the deleted-document recovery dialog.
- [x] Recover a deleted document.
- [x] Hidden/deleted documents are unavailable in normal reader mode.
- [x] Refreshing the catalog shows skeletons until saved state resolves; deleted seed documents never flash in the active list.

## Category administration

- [x] Open Manage Categories from admin mode.
- [x] Category Plus beside the document selector creates and selects a category.
- [x] Category Pencil beside the document selector opens category management.
- [x] Create a category.
- [x] Rename a category and update assigned documents.
- [x] Hide/show a category option.
- [x] Reorder category options.
- [x] Delete a category into recovery.
- [x] Deleted categories remain hidden until the recovery icon opens the recovery dialog.
- [x] Recover a deleted category.
- [x] Duplicate category names are rejected.

## Reader and structured builder

- [x] Open a document and return to Library.
- [x] Topic links scroll to their content.
- [x] Topic numbers follow the main topic order.
- [x] Full-title tooltip appears only for truncated sidebar titles.
- [x] Enter edit mode and open the element menu.
- [x] Enter edit mode and edit the document title, description, and category directly in the blue header.
- [x] Save header metadata together with structured elements while preserving document ID, slug, type, tags, and legacy Markdown.
- [x] Element menu remains inside the viewport and scrolls when needed.
- [x] Add, edit, and delete each supported element type.
- [x] Add multiple dropdown entries in one dropdown block.
- [x] Dropdown line breaks remain after saving.
- [x] Add rows and columns to a table.
- [x] Resize table rows and columns.
- [x] Saved table widths render in view mode.
- [x] Add checklist bullets.
- [x] A single Key Insight element offers Green, Blue, and Red color tabs, previews the choice immediately, persists it after save, and keeps legacy insights Green.
- [x] Roadmap step-number position saves as Left number, Center number, or Right number.
- [x] Roadmap image uploads save to shared Blob storage, preview through the authenticated media route, reject unsupported images and files over 2 MB, and can be removed.
- [x] Roadmap subtext edits inline as Plain, Bullets, Checklist, or Numbered rows; Enter, multiline paste, and empty-row Backspace preserve newline storage.
- [x] Feature Card and Gallery images use authenticated shared uploads with progress, validation, preview, replacement, removal, and legacy URL compatibility.
- [x] Private shared-image previews send the Pipeline bearer token, resolve to browser object URLs, render actual images in edit/view/modal surfaces, and revoke temporary URLs during cleanup.
- [x] Gallery layout changes create minimum upload slots and immediately display the selected responsive editor grid without deleting extras.
- [x] Gallery tiles remain square in edit and view modes, show square/portrait/landscape sources without cropping, and open the full-image modal from the tile’s resolved source without issuing a second authenticated image request.
- [x] Standalone Buttons validate internal and HTTP(S) links, persist width/alignment, open safely in a new tab, and become full-width on mobile.
- [x] Center number layout centers the number, title, and subtext and uses the full available width for the image.
- [x] Save changes and return to view mode.

## Video tutorial

- [x] Add Video Link is hidden in document view mode.
- [x] Add/Pencil video controls appear in document edit mode.
- [x] Valid HTTPS, YouTube, and Google Drive links save.
- [x] YouTube and shared Google Drive links render a responsive 16:9 embedded player inside the blue document header’s right column; the Drive play control and playing content are centered in the visible frame.
- [x] Direct MP4/WebM/OGG links render native controls; other HTTPS links retain a safe open fallback.
- [x] No separate OPEN VIDEO text button renders; Google Drive retains a compact new-tab icon and generic links retain their safe fallback.
- [x] Video Pencil is hidden after returning to view mode.

## Reading state

- [x] Bookmark toggles and persists after refresh.
- [x] Recent documents are deduplicated and ordered newest first.
- [x] Completion state is independent from view history.
- [x] Malformed or unavailable storage falls back safely.
- [x] Server and client bookmark markup hydrate consistently.

## Accessibility and responsive checks

- [x] Icon-only controls have accessible names.
- [x] Keyboard focus is visible.
- [x] Buttons expose pressed/disabled state where appropriate.
- [x] Reduced-motion preference is respected.
- [x] Desktop layout has no page-level horizontal overflow.
- [ ] Re-run physical iOS Safari verification before a public release.
- [ ] Re-run physical Android Chrome verification before a public release.
- [ ] Complete an external WCAG audit before a public release.

## Shared persistence and authorization

- [x] Library reads require a verified Pipeline session.
- [x] Pipeline Postgres is the authoritative document/category store; `/ppc/api/library` is an adapter only.
- [x] Server authorization permits ADMIN full access, USER document create/update, and VIEWER read-only access.
- [x] Scoped mutations use global/record versions and return current state on `409` conflicts.
- [x] Deleted records remain tombstoned until explicit ADMIN restore.
- [x] Repository Markdown is not merged after initialization; legacy local admin/category snapshots are ignored and never uploaded.
- [x] Successful responses update a validated confirmed cache; outage fallback is read-only and disables mutations.
- [x] Visible tabs poll every five seconds and refresh immediately on focus.
- [x] Pipeline audit and backup/restore contracts are covered by automated tests.
- [ ] Complete production backup/restore verification after deploying Pipeline and before catalog initialization.
- [ ] Complete authenticated multi-account browser verification with dedicated ADMIN, USER, and VIEWER accounts.
- [ ] Move bearer authentication to secure same-origin cookies before treating returned HTML as access-controlled.
# Unified application checks

- [ ] `/ppc/library`, nested documents, recent, and bookmarks load directly and after refresh.
- [ ] `/ppc/dashboard` loads inside the authenticated shared shell and shows only the centered coming-soon placeholder.
- [ ] Missing and expired Pipeline sessions redirect to Pipeline with a validated requested PPC `returnTo`; temporary server failures remain on a retry gate.
- [ ] ADMIN sees full catalog/category controls and can save shared changes.
- [ ] USER can create/edit active documents but cannot delete, restore, reorder, or manage categories; forbidden direct `PATCH /ppc/api/library` returns `403`.
- [ ] VIEWER sees no mutation controls and direct `PATCH /ppc/api/library` returns `403`.
- [ ] All three application cards open their remembered routes in new browser tabs, including the active card, while the source page remains unchanged.
- [ ] Team SOP Library and PPC Dashboard active states follow `/ppc/library/*` and `/ppc/dashboard` independently.
- [ ] Legacy `{ pipeline, ppc }` route memory receives the dashboard fallback without losing its saved routes.
- [ ] Session-only handoff is consumed once into destination session storage and removed; malformed, expired, and wrong-target values are rejected; “Remember me” remains persistent.
- [ ] External, malformed, and unsupported `returnTo` destinations are rejected; successful login restores valid library and dashboard requests.
- [ ] The application cards remain keyboard accessible on desktop and mobile, preserve hover/focus states, scroll horizontally when needed, and do not overlap account controls.
- [ ] `glasscoppc.vercel.app` redirects to the equivalent canonical `/ppc` route without a loop.
- [ ] No hydration or browser-console errors appear.

## Rich-text composer

- [x] Every supported body field shows the full formatting toolbar in edit mode; excluded title, metadata, table, code, button, and flow fields remain plain.
- [x] Selecting text and applying Normal, Bold, Italic, or Underlined updates only the selection and matches reader typography after save.
- [x] Bullets, Numbers, and Checklists can be toggled or converted, and toolbar `aria-pressed` states follow the cursor or selection.
- [x] Checklist state survives save and refresh; reader checkboxes are checked correctly and disabled.
- [x] Standalone Bullet Text, Checklist Bullets, and Numbered Text rows show only the four inline-style controls.
- [x] Pasting from Google Docs, Word, and webpages keeps supported formatting and removes links, media, colors, fonts, headings, and unsupported HTML.
- [x] Existing Markdown formatting appears correctly when first opened in structured edit mode.
- [x] Malformed rich JSON falls back to legacy text without removing the document.
- [x] Desktop and mobile toolbars remain keyboard accessible and do not create horizontal page overflow.
