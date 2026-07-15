# Data Contract

## Scope

This document defines the repository content and browser-storage contracts used by the current Glassco Back Office Library MVP.

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
| `videoUrl` | `string?` | Normalized HTTP(S) tutorial link. |

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
```

Important structured fields:

| Field | Type | Used by |
| --- | --- | --- |
| `eyebrow`, `label`, `title`, `text` | `string` | Topics and text-based blocks |
| `body` | `string[]` | Topic paragraphs |
| `callout` | `string?` | Optional topic callout |
| `items` | `string[]` | Bullets, checklist, numbered text |
| `columns` | `string[]` | Table headings |
| `rows` | `string[][]` | Table cell data |
| `columnWidths` | `number[]?` | Saved table widths in pixels |
| `buttonText`, `imageUrl` | `string` | Feature card |
| `steps` | `{title,text}[]` | Roadmap |
| `nodes` | `{title,text}[]` | Diagnostic flow |
| `dropdowns` | `{title,text}[]?` | Repeatable dropdown entries |

Optional `columnWidths` and `dropdowns` preserve compatibility with content saved before those features existed.

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

### Document administration

Key: `glassco-library-admin-state`

Schema version: `1`

```ts
{
  version: 1;
  documents: Array<LibraryDocument & { deletedAt?: string }>;
}
```

### Category administration

Key: `glassco-library-category-state`

Schema version: `1`

```ts
{
  version: 1;
  categories: Array<{
    id: string;
    name: string;
    hidden: boolean;
    deletedAt?: string;
  }>;
}
```

## Validation and fallback rules

- Treat all browser-storage input as untrusted.
- Invalid or missing state falls back to seeded/default state.
- Storage write failures must not crash the UI.
- Deleted records use recoverable timestamps instead of destructive removal.
- Renaming a category updates locally managed documents assigned to the old name.
- Reading state stores references and timestamps, never document bodies.
- The server snapshot must remain deterministic; browser state is applied after hydration.

## Future server migration

A future database should preserve document IDs, slugs, topic IDs, element IDs, and category IDs. Add a schema version and migration path before changing any existing storage shape. Server-side validation and authorization must replace the current browser-only trust model.

