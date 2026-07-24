# Data Contract

## Scope

This document defines the repository bootstrap content, authoritative Pipeline Postgres state, scoped mutation protocol, private-media/legacy-migration storage, and browser-only reading-state contracts used by the Glassco Back Office Library.

The global application tabs continue to use `glassco.appRoutes.v1` as their new-browser-tab destinations; this navigation change does not alter the stored route schema.

## Library document

`LibraryDocument` is the primary content contract.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Stable unique identifier. Never derive mutable state from title. |
| `slug` | `string` | Unique reader URL segment. |
| `title` | `string` | Display title. |
| `description` | `string` | Catalog and header summary. |
| `category` | `string` | Category name; starter Markdown must use the seeded taxonomy. |
| `type` | `Guide \| SOP \| Checklist \| Template \| Playbook` | Fixed document type taxonomy. |
| `tags` | `string[]` | Search metadata. |
| `updatedAt` | `string` | ISO-compatible date/time string. |
| `status` | `published \| draft` | Reader repository exposes published records only. |
| `hidden` | `boolean` | Hidden records are excluded from normal reader access. |
| `readingMinutes` | `number` | Derived from content text. Minimum `1`. |
| `body` | `string` | Markdown source for repository/legacy documents. |
| `topics` | `Topic[]` | Derived navigation metadata. |
| `contentElements` | `LibraryContentElement[]?` | Structured builder representation. |
| `videoUrl` | `string?` | Normalized HTTP(S) tutorial link. Provider-specific embed/thumbnail URLs, centered Google Drive viewport treatment, and responsive header placement are derived at render time and are not persisted. |

The catalog document editor is creation-only and exposes `title`, `description`, and `category`. New documents receive the existing defaults for `type`, `tags`, and legacy `body`, then are authored further in the structured builder.

For existing documents, builder edit mode accepts a metadata draft containing only `title`, `description`, and `category`. It merges that draft with the existing document and current `contentElements`; stable `id` and `slug` values plus `type`, `tags`, and legacy `body` remain unchanged. Metadata and element changes are persisted in the same shared document update.

## Topic

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | Stable DOM/navigation target. |
| `title` | `string` | Sidebar label. |
| `level` | `number` | Main numbered topics use level `2`. |

## Structured content element

Every `LibraryContentElement` contains a stable `id`, a `type`, and shared fields. Unused shared fields remain present to keep serialization and editing predictable.

Supported `type` values:

```text
topic
statement
quote
bullets
checklist
numbered
insight
table
accordion
feature
code
timeline
flowchart
gallery
button
```

Important structured fields:

| Field | Type | Used by |
| --- | --- | --- |
| `eyebrow`, `label`, `title`, `text` | `string` | Topics and text-based blocks |
| `insightColor` | `"green" \| "blue" \| "red"` | Optional Key Insight presentation; defaults to `green` when absent |
| `body` | `string[]` | Topic paragraphs |
| `callout` | `string?` | Optional topic callout |
| `items` | `string[]` | Bullets, checklist, numbered text |
| `columns` | `string[]` | Table headings |
| `rows` | `string[][]` | Table cell data |
| `columnWidths` | `number[]?` | Saved table widths in pixels |
| `buttonText`, `imageUrl` | `string` | Feature card |
| `buttonUrl` | `string?` | Standalone Button internal or HTTP(S) destination |
| `buttonWidth` | `"full" \| "large" \| "medium" \| "small"` | Optional Button width; defaults to `medium` |
| `buttonAlignment` | `"left" \| "center" \| "right"` | Optional Button alignment; defaults to `center` |
| `steps` | `{title,text,imageUrl?,textStyle?}[]` | Roadmap steps with optional uploaded/legacy images and `plain`, `bullets`, `checklist`, or `numbered` subtext |
| `alignment` | `"left" \| "center" \| "right"` | Optional Roadmap placement; defaults to `left` |
| `numberPosition` | `"left" \| "center" \| "right"` | Optional Roadmap step-number position; defaults to `left` |
| `nodes` | `{title,text}[]` | Diagnostic flow |
| `dropdowns` | `{title,text}[]?` | Repeatable dropdown entries |
| `galleryColumns` | `1 \| 2 \| 3 \| 4` | Image Gallery column layout |
| `images` | `{url,alt}[]?` | Repeatable Image Gallery entries. Source dimensions remain unchanged; square-tile containment is presentation-only. |

Optional `insightColor`, `columnWidths`, `dropdowns`, Roadmap layout fields, step image/format fields, Gallery fields, and Button fields preserve compatibility with older content. Newly uploaded Roadmap, Feature Card, and Gallery images are stored in the shared private Blob store and referenced through the authenticated library-image route; existing data URLs and HTTP(S) values remain valid. Roadmap formatted rows remain newline-delimited in `steps[].text`.

Private library-image route values remain persisted as relative URLs. Client image surfaces retrieve those URLs with the Pipeline bearer token and render the returned bytes through temporary object URLs; Gallery modals may reuse the currently rendered temporary source to avoid a duplicate request. Temporary URLs are presentation-only and are never persisted.

## Repository Markdown front matter

Files under `content/library/*.md` require:

```yaml
id: stable-unique-id
slug: stable-url-slug
title: Human-readable title
description: Concise summary
category: One seeded category value
type: Guide | SOP | Checklist | Template | Playbook
tags:
  - example
updatedAt: YYYY-MM-DD
status: published | draft
hidden: false
```

Repository validation rejects duplicate IDs/slugs and invalid starter taxonomy values.

## Shared library storage

Pipeline Postgres is the only authoritative catalog store. Pipeline exposes `/api/library-state`; the Library's `/ppc/api/library` route forwards authenticated GET, PATCH, and POST requests to it and never maintains a second writable snapshot.

```ts
{
  state: {
    version: 1;
    documents: Array<LibraryDocument & { deletedAt?: string }>;
    categories: Array<{ id: string; name: string; hidden: boolean; deletedAt?: string }>;
  };
  revision: number;
    recordVersions: {
      documents: Record<string, number>;
      categories: Record<string, number>;
    };
    updatedAt: string | null;
    updatedBy: string | null;
    deletionAudit?: {
      documents: Record<string, {
        source: "user" | "system_migration" | "system_backup_restore" | "unknown";
        deletedAt: string;
        reason: string;
        actor: { name: string; email: string; role: "ADMIN" | "USER" | "VIEWER" } | null;
        initiatedBy: { name: string; email: string; role: "ADMIN" | "USER" | "VIEWER" } | null;
      }>;
    };
    restoredCount?: number;
  }
```

Pipeline tables separate catalog metadata, documents, categories, backups, and audit records. Stable document/category IDs remain primary keys; `deletedAt` is a recoverable tombstone and is cleared only by an explicit restore.

### Scoped mutation protocol

`PATCH /ppc/api/library` accepts one flat operation per request:

- `catalog.initialize` with `state` and `expectedRevision: 0`
- `document.create` with `document`
- `document.update` with `documentId`, `expectedVersion`, and `document`
- `document.delete` / `document.restore` with `documentId` and `expectedVersion`
- `documents.restoreSystemDeleted` with unique `documentIds` and `expectedRevision` (ADMIN only)
- `documents.reorder` with all active `documentIds` and `expectedRevision`
- equivalent category create/update/delete/restore/reorder operations

Updates, delete, and restore compare the target record version. Reorders, initialization, and bulk system recovery compare the global revision. Bulk recovery succeeds only when every requested record is currently tombstoned and its latest deletion event is `system_migration`; otherwise it restores none. A mismatch or unavailable target returns HTTP `409`, `conflict: true`, and the current full shared response. Successful mutations increment the global revision, update record versions as applicable, and record actor/revision audit metadata.

Pipeline reloads the caller from `launchflow_users` for every request. ADMIN may initialize, create/update/delete/restore/reorder documents, manage categories, and manage backups. USER may create documents and update active documents only. VIEWER is read-only.

## Browser-storage contracts

### Reading state

Key: `ppc-ops-reading-state`

Schema version: `1`

```ts
{
  version: 1;
  bookmarks: string[];
  recent: Array<{ id: string; viewedAt: number }>;
  lastTopic: Record<string, string>;
  completion: Record<string, boolean>;
}
```

### Confirmed shared-state cache

Key: `glassco-library-confirmed-cache-v2`

The value is the last schema-valid full shared response. A successful server fetch replaces it. If the server is unavailable, it may be rendered only with mutations disabled. It is never treated as pending work and is never uploaded to Pipeline.

Legacy keys `glassco-library-admin-state` and `glassco-library-category-state` are ignored for shared hydration/migration. Their contents cannot merge with repository seeds or authoritative state.

## Validation and fallback rules

- Treat all browser-storage input as untrusted.
- Invalid or missing authoritative state does not fall back to writable seed state. A validated confirmed cache may be shown read-only; otherwise the error state remains visible.
- Storage write failures must not crash the UI.
- Deleted records use recoverable timestamps instead of destructive removal.
- Recovery dialogs are presentation-only views over records carrying `deletedAt`; moving recovery lists behind toolbar icons does not change the storage schema.
- Catalog hydration is presentation-only: seed documents remain behind a loading skeleton until the shared snapshot or validated local fallback resolves, and no persistence fields change.
- Renaming a category updates assigned active documents in the authoritative mutation.
- Quick category creation uses the existing category schema, generates a stable category ID, and selects the new name in the open document draft without changing the storage version.
- Reading state stores references and timestamps, never document bodies.
- Server state remains authoritative; browser catalog data is never applied after hydration.

## Legacy Blob migration and backups

Private Blob object `glassco/library-state-v1.json` is the legacy source only. The ADMIN-protected `/ppc/api/library/migration` route validates it, supports authenticated download, and creates an immutable checksum-addressed copy under `glassco/library-backups/`. `initialize-catalog` first ensures that backup, preserves the complete document/category catalog exactly—including pre-existing tombstones—and submits `catalog.initialize` to an empty revision-zero Pipeline catalog. The legacy `initialize-clean-catalog` action remains accepted as a compatibility alias but now performs the same safe complete import.

Pipeline backup operations use POST `/api/library-state` with `create-backup` or `restore-backup`; list/detail are ADMIN-only GET queries. Restore requires `expectedRevision`, automatically creates a before-restore backup, preserves records absent from the backup, preserves newer active documents, and never changes an active record into a tombstone. Private Blob continues to store authenticated uploaded images and the legacy migration artifact, not current catalog state.
# Unified session and route contracts

The PPC application reads the existing Pipeline session from local or session storage key `launchflow.authSession.v1`. Required fields are `token` and `email`; `name` and `role` are normalized after server verification. Roles normalize to `ADMIN`, `USER`, or `VIEWER`.

Remembered application routes use `glassco.appRoutes.v1`:

```json
{ "pipeline": "/", "ppc": "/ppc/library", "ppcDashboard": "/ppc/dashboard" }
```

The `ppcDashboard` property is optional on read so legacy `{ pipeline, ppc }` values remain valid. Pipeline accepts only safe non-`/ppc` paths, `ppc` accepts `/ppc/library` and descendants, and `ppcDashboard` accepts `/ppc/dashboard`.

For a session stored only in the source tab, `glassco.authHandoff.v1` temporarily stores `{ version: 1, targetApp, expiresAt, session }` in same-origin local storage. It expires after 30 seconds, can only be consumed by its `pipeline` or `ppc` target, is copied to the destination tab's `launchflow.authSession.v1` session storage, and is immediately removed. Malformed and expired values are deleted; a valid value still requires server verification. Persistent “Remember me” sessions do not use this record.

This integration does not change library document, category, topic, content-element, bookmark, history, or completion schemas.

## Optional rich-text fields

Content elements now accept `richText` on supported primary bodies, `calloutRichText` on topics, `itemRichText[]` aligned with standalone `items[]`, and `richText` on roadmap steps and dropdown entries.

Rich documents use a ProseMirror-style `{ "type": "doc", "content": [...] }` object. Allowed nodes are `doc`, `paragraph`, `text`, `hardBreak`, `bulletList`, `orderedList`, `listItem`, `taskList`, and `taskItem`. Allowed marks are `bold`, `italic`, and `underline`; persisted attributes are limited to `orderedList.start` and `taskItem.checked`.

The corresponding legacy body/text fields remain required search and compatibility fallbacks and are updated with every edit. Consumers prefer valid rich JSON and reconstruct it from those fields when JSON is absent or invalid.
