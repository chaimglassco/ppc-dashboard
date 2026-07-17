# QA Checklist

Use this checklist before merging or deploying changes.

## Automated gates

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm test` — 46 tests passing
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

## Document administration

- [x] Create a new document.
- [x] Edit and rename a document.
- [x] Document editor shows title, description, and category without document type, tags, or Content Markdown fields.
- [x] Saving document metadata preserves the hidden type, tags, and legacy Markdown values.
- [x] Hide and show a document.
- [x] Move documents up and down.
- [x] Delete a document into recovery.
- [x] Recover a deleted document.
- [x] Hidden/deleted documents are unavailable in normal reader mode.

## Category administration

- [x] Open Manage Categories from admin mode.
- [x] Category Plus beside the document selector creates and selects a category.
- [x] Category Pencil beside the document selector opens category management.
- [x] Create a category.
- [x] Rename a category and update assigned documents.
- [x] Hide/show a category option.
- [x] Reorder category options.
- [x] Delete a category into recovery.
- [x] Recover a deleted category.
- [x] Duplicate category names are rejected.

## Reader and structured builder

- [x] Open a document and return to Library.
- [x] Topic links scroll to their content.
- [x] Topic numbers follow the main topic order.
- [x] Full-title tooltip appears only for truncated sidebar titles.
- [x] Enter edit mode and open the element menu.
- [x] Element menu remains inside the viewport and scrolls when needed.
- [x] Add, edit, and delete each supported element type.
- [x] Add multiple dropdown entries in one dropdown block.
- [x] Dropdown line breaks remain after saving.
- [x] Add rows and columns to a table.
- [x] Resize table rows and columns.
- [x] Saved table widths render in view mode.
- [x] Add checklist bullets.
- [x] Save changes and return to view mode.

## Video tutorial

- [x] Add Video Link is hidden in document view mode.
- [x] Add/Pencil video controls appear in document edit mode.
- [x] Valid HTTPS and YouTube links save.
- [x] YouTube thumbnail renders when an ID is available.
- [x] WATCH THE VIDEO opens the saved URL in a new tab.
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

## Security checks for a shared deployment

- [ ] Authentication implemented.
- [ ] Server-side authorization implemented.
- [ ] Admin mutations moved off browser-only storage.
- [ ] Database backup and restore tested.
- [ ] Audit logging implemented.

These security items are intentionally incomplete in the local MVP.
