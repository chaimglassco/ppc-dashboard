# Data Contract

## September 11 workspace control revision

No data shape changed. `glassco.ppcPerformanceNotes.v1` continues to accept `previousWeekResult` and `actions[].dueDate` for backward compatibility, but the revised dashboard renders the previous-week result as read-only and omits action date inputs. Target-first goal ordering, vertical outcome actions, the header Save/Refresh controls, and the daily-limit placement are presentation changes. Daily limit remains derived from and stored with the weekly budget through the existing normalization path.

## September 11 product ordering

No stored catalog fields changed. `glassco.ppcDashboardCatalog.v1.productOrderIds` remains the manual order source; the All Tags panel applies a stable display-only tag priority over that order. Tag filtering and its automatic first-product selection remain transient React state and are not persisted.

## Campaign week-over-week comparison

`GET /ppc/api/dashboard/campaign-comparison?asin=<ASIN>&country=<marketplace>&weekStart=<Wednesday>` accepts the same normalized ASIN, marketplace, and week-start rules as weekly performance. The server derives `currentStartDate`, an end date capped at yesterday UTC, `previousStartDate = currentStartDate - 7 days`, and a previous end date with the same inclusive day count. Future/no-completed-day weeks return no-store `404`. Pipeline authentication, stable-user Vercel Connect consent, HTTPS MCP transport, timeout, configuration, and bounded-error behavior match the weekly performance route.

Stage 1 success is `{ comparison }`, where `comparison` contains `{ asin, country, currency, dataState, previousPeriod, currentPeriod, freshness, campaigns, warnings }`. Each period is `{ startDate, endDate }`; `dataState` records whether the selected period is Partial or Final, while only the previous period is requested from Scale Insights. Freshness is `{ previousDataAsOf }`. Each campaign is `{ campaignId, sponsoredType, campaignName, previousSpend }`, with finite nonnegative Spend; `campaignId` and `sponsoredType` are nullable when omitted upstream. There is no current metric or delta in this staged contract; the browser displays Current Week Spend as a pending dash.

Provider campaign rows may be flat, nested under campaign/entity records, embedded as JSON text, or returned as an MCP text table alongside structured totals. Grouping choices may use `enum` or `const`; formatted Spend strings are normalized before validation. Duplicate previous-period rows merge by `sponsoredType:campaignId`. The API is read-only and no-store. The Client Component caches the validated baseline only in memory for its mounted page session. Neither raw MCP payloads nor baseline DTOs enter `glassco.ppcPerformanceNotes.v1`, `glassco.ppcPerformanceCache.v1`, `glassco.ppcDashboardCatalog.v1`, local storage, or session storage.

The adapter calls advertising performance only when the live input schema explicitly exposes a campaign grouping choice. Missing capability returns no-store `502 { error, code: "campaign_capability_missing", requestId }` without making an aggregate request. A positive campaign result that cannot be normalized returns the same shape with `code: "campaign_rows_unreadable"`. The request ID correlates the safe browser error with sanitized server structure logs; raw provider values and account/user identifiers are never returned or logged.

The verified September 10 production schema exposes `account_ref`, `ad_type`, `asin_list`, `count`, `country`, `days`, `end_date`, `mode`, `page`, `sort_by`, `sort_direction`, `start_date`, and `summary_only`. It has no campaign grouping property, and the connector advertises no campaign-reporting tool. Consequently, `campaign_capability_missing` is non-retryable until the provider contract changes; no campaign baseline DTO is created or cached.

## September 10 workspace presentation

The workspace redesign consumes the existing version-1 report and performance cache. Conversion Rate has no stored field and displays unavailable; do not derive it without an appropriate denominator. The second row uses the existing ACOS and TACOS calculated fields. The current-week summary underline control inserts literal <u> markers into the existing plain-text notes field, like the existing bold/list markers; notes are never rendered as arbitrary raw HTML.

## Product performance AI request

`POST /ppc/api/dashboard/ai-chat` accepts an authenticated transient request containing `question`, up to eight `{ role, text }` history items, and a selected-product context. Context includes bounded product identity, one active Wednesday, active-week planning fields, and up to sixty `{ weekStart, weekEnd, dataState, metrics }` summaries. ASIN is empty or exactly ten uppercase alphanumeric characters; dates must be real ISO dates; metrics are finite nonnegative numbers no greater than one billion; `dataState` is `Partial`, `Final`, or normalized to `Saved/manual`. The body is capped at 100 KB. Unknown fields are ignored and malformed scope returns `400`.

The success response is `{ answer: string }`; configuration and provider failures return bounded `{ error: string }` objects. When the verified Pipeline subject has no Scale Insights grant, the route returns `409` with `{ error, authorizationRequired: true, authorizationUrl }`; the URL is validated as Vercel-hosted before reaching the browser. All route responses are no-store. Neither request nor response is persisted by the application, and the widget keeps messages only in React memory keyed by product/week. The route does not change existing dashboard report, catalog, or performance-cache schemas. `AI_GATEWAY_API_KEY`, Vercel OIDC, Scale Insights access tokens, raw MCP/provider errors, tool schemas/results, and model metadata are server-only and excluded from this contract.

For a valid ten-character ASIN, the route discovers the connected Scale Insights MCP tools at request time. Only tool definitions with a top-level ASIN argument and explicit read-only/non-destructive annotation, or the fixed known reporting allowlist, are eligible; mutation-shaped names are rejected. Before every call, supported ASIN fields are replaced with the selected ASIN, marketplace fields with `US`, and date fields with the visible period range capped at yesterday. Tool output supplied to the model omits binary blocks and is capped at 50,000 characters per result.

The third-panel metrics-first order, compact monochrome cards, sales comparison bars, PPC/organic order donut, ACOS/TACOS radial gauges, Strategic Weekly Goals progress, and Budget Utilization burn-rate view are presentation-only. They add no fields to `glassco.ppcPerformanceNotes.v1`, the performance cache, or the dashboard catalog. Revenue, order share, goal progress, expected week pacing, budget usage, and overspend are derived from existing values during render.

The second-panel abbreviated ranges, Current/In Review cues, selected-card border, product-tag metadata, and Spend/Sales/Orders/ACoS labels are also presentation-only. Sales reads `ppcSales`, Orders reads `ppcOrders`, and ACoS reads the existing calculated `acos` value. The full week range remains the button accessible name. The panel does not add or rewrite fields in reports, performance snapshots, selected-month storage, or the catalog.

The first-panel title/count hierarchy, plus action menu, status dots, 36px thumbnails, neutral tag badges, and black selected-card treatment are presentation-only. The action menu is transient component state and continues to invoke the existing catalog mutations. No fields, limits, IDs, ordering rules, or validation in `glassco.ppcDashboardCatalog.v1` changed.

## Goal history and comparison presentation

The existing version-1 `glassco.ppcPerformanceNotes.v1` report accepts optional goal `metric` (`increaseSpend`, `decreaseSpend`, `ppcSales`, `totalSales`, `ppcOrders`, `organicOrders`, `totalOrders`, `acos`, or `tacos`) and `unit` (`currency`, `number`, or `percentage`). Unit is canonicalized by metric: Spend and Sales goals use currency, order goals use number, ACOS/TACOS use percentage, and Organic Order accepts number or percentage. Legacy stored `spend` maps to `increaseSpend` only when the title includes Increase and otherwise to `decreaseSpend`; legacy `sales` maps to `ppcSales`. Recognizable legacy titles infer a metric; unknown legacy goals remain valid without one. The active goal's stored `actual` remains compatibility data and is not used as an editable source. Target strings remain backward-compatible; two-decimal currency/percentage formatting is derived UI and is not required in storage.

The report accepts optional `goalHistory: Array<{ id, title, target, actual, status, resolvedAt, metric?, unit?, dataState? }>` per product/week. `status` must be `Achieved` or `Missed`; `resolvedAt` must be a valid timestamp normalized to ISO; `dataState`, when present, must be `Partial` or `Final`. Malformed entries are discarded, duplicate IDs within a report are removed, and at most 100 newest entries are retained. Older reports restore with an empty history. Legacy terminal entries found in `goals` migrate into history and use valid `updatedAt`, or the normalized reporting-week start when no valid update timestamp exists. Active goals retain only `On Track` and `At Risk` states.

Active Actual values are derived from the selected validated performance snapshot. Sales maps to `totalSales`; Organic Order percentage is `organicOrders / totalOrders * 100` with a zero-denominator result of zero. Partial means the snapshot ends before `weekStart + 6 days`; Final means it covers that full date. These derived active values are not persisted until goal resolution snapshots the formatted actual and optional completeness state into history.

Product-wide Goal History is a derived view over these per-week entries and creates no separate storage key. Small grouped metric cards, centered single-line titles and content-sized values, current-data availability gating for percentage-change badges, metric-specific favorable colors, centered `Prev. Week` footer values, ACOS target-gap copy, whole-number rounding, thousands separators, centered budget values, and the removed prior sales/TACOS line are presentation-only; exact report and performance-cache numbers remain unchanged.

## Target ACOS and Scale Insights analysis URLs

The existing version-1 `glassco.ppcPerformanceNotes.v1` report accepts optional `targetAcos: number`. Missing, negative, non-finite, or malformed values normalize to `0`, meaning no warning threshold. A positive value is local product/week planning data and does not alter imported Scale Insights metrics.

Analysis URLs use the fixed `https://portal.scaleinsights.com` origin and allowlisted definitions for Campaigns, Keyword Targeting, Product Targeting, Search Terms, Match Types, Placements, Ad Types, Main Keywords, Daily Performance Trend, Weekly Performance Trend, and Monthly Performance Trend. `<ASIN>` must normalize to exactly ten uppercase alphanumeric characters, and supplied week dates must be ISO-shaped. Standard reports serialize only `asinList`, `from`, and `to`; all trend reports serialize `asinList`, fixed `cycles=7`, `to`, and fixed `daysPerCycle` values of `1`, `7`, or `30` respectively. Invalid input resolves to the Scale Insights Ads landing page; OAuth credentials and MCP tokens are never included.

## Budget history and reporting-period selection

The existing version-1 `glassco.ppcPerformanceNotes.v1` report accepts optional `budgetHistory: Array<{ id, changedAt, from, to }>` in newest-first order. Older reports restore with an empty array. Parsing rejects invalid dates, negative/non-finite values, and no-op changes, normalizes timestamps to ISO, limits IDs to 100 characters, and keeps at most 100 entries per product/week. Draft status values remain supported for backward compatibility even though Draft badges and the Save Draft action are no longer shown.

Selected reporting months are not persisted and do not change report or performance-cache keys. They only filter which existing weekly records are visible; overlap weeks remain represented by their stable Wednesday `weekStart`.

## Saved weekly performance and smaller tags

`glassco.ppcPerformanceCache.v1` stores `{ version: 1, entries: { ["US:<ASIN>:<Wednesday date>"]: performance } }` using the minimal performance DTO, never credentials or raw MCP payloads. Restoration validates exact ASIN, US marketplace, real bounded weekly dates, finite nonnegative source numbers and integer orders; it recalculates derived numbers and reconstructs keys. Snapshots include actual end date, freshness and warnings; genuine zero metrics remain valid cache entries. Existing report/catalog keys are unchanged. Visible weeks without valid entries are automatically backfilled, but saved entries have no automatic expiry or background refresh; Refresh replaces only the selected snapshot. Whole-number metric and timeline ACOS formatting plus upper-right week placement are presentation-only and do not change the stored DTO.

## Compact product cards

Portfolio cards display the image, product name, and tag without ASIN/SKU rows. View-mode cards use a compact 66px minimum height; edit mode retains room for Edit, Delete, and Reorder controls. ASIN/SKU remain in the selected-product header, edit form, search index, and existing storage; this is presentation-only with no data migration. Verify both identifier links remain in the detail header after selecting a product.

## Product portfolio ordering

The version-1 dashboard catalog accepts optional `productOrderIds: string[]` (validated unique IDs, capped at 2,000). Missing order uses the prior source order. Unknown or hidden IDs do not create records, and new products are prepended to the saved order. The ordering changes only local portfolio presentation, never product IDs or weekly-report keys.

## Automatic listing images

The authenticated `GET /ppc/api/dashboard/product-image?asin=...` response is `{ asin, imageDataUrl }` with `Cache-Control: no-store`. It accepts one ten-character ASIN, uses the US marketplace, and returns only a validated, bounded raster image. Automatic images use the existing `imageDataUrl` catalog field; no storage migration is needed.

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

For existing documents, builder edit mode accepts a metadata draft containing only `title`, `description`, and `category`. Entering edit mode and displaying the Pencil indicator are local UI transitions and do not mutate shared state. The explicit `Save changes` action merges the draft with the existing document and current `contentElements`; stable `id` and `slug` values plus `type`, `tags`, and legacy `body` remain unchanged. Metadata and element changes are persisted in the same shared document update.

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
    recordManifest: {
      documents: Array<{
        id: string;
        slug: string;
        recordVersion: number;
        lifecycleState: "active" | "deleted" | "archived";
        hidden: boolean;
        status: "published" | "draft";
      }>;
    };
    catalogCompleteness: {
      complete: true;
      scope: "catalog" | "document" | "recovery" | "archive" | "state";
      expectedDocumentCount: number;
      returnedDocumentCount: number;
      expectedCategoryCount: number;
      returnedCategoryCount: number;
      activeDocumentCount: number;
      manifestDocumentCount: number;
      checksum: string;
    };
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
- `document.update` with `documentId`, `expectedVersion`, `document`, and optional `updateScope: "content"`
- `document.delete` / `document.restore` with `documentId` and `expectedVersion`
- `document.purge` with `documentId` and `expectedVersion` (ADMIN only; target must already be deleted)
- `documents.restoreSystemDeleted` with unique `documentIds` and `expectedRevision` (ADMIN only)
- `documents.reorder` with all active `documentIds` and `expectedRevision`
- equivalent category create/update/delete/restore/reorder operations

Updates and lifecycle operations compare the target record version. Permanent deletion succeeds only for a tombstoned document and moves it into Pipeline's protected archive; physical table deletion is blocked. Reorders, initialization, and bulk system recovery compare the global revision. Bulk recovery succeeds only when every requested record is currently tombstoned and its latest deletion event is `system_migration`; otherwise it restores none. A mismatch or unavailable target returns HTTP `409`, `conflict: true`, and the current full shared response. Successful mutations increment the global revision, update record versions as applicable, and record actor/revision audit metadata.

`updateScope: "content"` is used for editor and formatting saves. Pipeline removes lifecycle timestamps, preserves the stored ID, slug, visibility, and publication status, validates/canonicalizes supported rich-text nodes and marks, and returns:

```ts
mutationResult: {
  operation: "document.update";
  documentId: string;
  document: ManagedLibraryDocument;
  recordVersion: number;
  lifecycleState: "active";
}
```

The returned document and lifecycle metadata come from the same successful database write as the version increment. Library must not apply or evict caches for a content save until this result matches the submitted ID/slug, remains active, advances the expected version, and contains parseable matching content.

The Library-side adapter forwards authenticated `document.delete` mutations even when the target is the final active document. An empty active catalog is valid, and the resulting tombstone remains available through normal Recovery. `/ppc/api/library/recovery/purged` is an ADMIN-only repair surface: GET returns metadata-only permanent-deletion history, while POST accepts one protected document ID and recreates only the exact approved bQool or Check Spend record from a trusted snapshot through the existing `document.create` contract. It never bulk-imports or silently restores purged records.

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

The value is the last schema-valid full shared response. A successful authoritative server fetch replaces it. Live fetches and mutations require a complete lifecycle manifest and matching response counts; malformed or incomplete HTTP 200 responses never replace this cache. If the server is unavailable or validation fails, the cache may be rendered only with mutations disabled. It is never treated as pending work and is never uploaded to Pipeline.

Legacy keys `glassco-library-admin-state` and `glassco-library-category-state` are ignored for shared hydration/migration. Their contents cannot merge with repository seeds or authoritative state.

### Scale Insights weekly performance response

For unfinished reporting weeks, the derived Tuesday end date is capped at yesterday (UTC) before the upstream request. The returned `endDate` is the effective requested date, not the nominal Tuesday; `warnings` explicitly labels partial-week coverage. Both source reports must match this effective scope exactly. Weeks with no completed days return a no-store `404` with an availability message, never estimated or zero-filled metrics. The existing report storage schema is unchanged.

Authenticated GET route: `/ppc/api/dashboard/performance?asin=<ASIN>&country=<marketplace>&weekStart=<YYYY-MM-DD>`

The route accepts a ten-character alphanumeric ASIN, an allowlisted marketplace, and a valid Wednesday week start. It derives the inclusive Tuesday end date and returns `Cache-Control: no-store`. The response contains the normalized scope, currency, five upstream source metrics (`spend`, `ppcSales`, `ppcOrders`, `totalSales`, `totalOrders`), four calculated metrics (`organicSales`, `organicOrders`, `acos`, `tacos`), freshness timestamps, and non-secret consistency warnings. Before consent, the authenticated route returns `409` with `{ error, authorizationRequired: true, authorizationUrl }`; `authorizationUrl` must be HTTPS on `vercel.com` or a `*.vercel.com` host and is the only authorization artifact exposed to the browser.

Advertising source metrics come from `get_ads_performance` totals. Total-sales metrics come from `get_sales_data` summary values. The server rejects malformed, negative, non-integer order, empty, or differently scoped data rather than estimating. Organic metrics are clamped at zero; ACOS and TACOS are zero when their sales denominator is zero and otherwise rounded to two decimal places. Vercel Connect keys the upstream OAuth grant to `{ type: "user", id: <verified Pipeline user ID>, issuer: <Pipeline origin> }`; Vercel OIDC authenticates the project. OIDC credentials, OAuth grants, Connect-issued access tokens, and raw MCP payloads are excluded from every response and storage contract.

### Weekly PPC performance drafts

Key: `glassco.ppcPerformanceNotes.v1`

Schema version: `1`

The record maps a stable `<productId>:<Wednesday ISO date>` key to one weekly report containing status, weekly/daily budgets, performance numbers, goals, prior-week result notes, weekly notes, action items, and `updatedAt`. Parsing is fail-closed per report; malformed records are discarded. Product names, ASINs, and SKUs are not duplicated into this store because `/ppc/api/dashboard/products` loads them from authoritative Pipeline workspace state. Validated Scale Insights metric values may be copied into the selected report, but credentials, tokens, and raw MCP payloads are never stored.

This record is a browser-local draft contract for the initial dashboard UI. It is not shared team state and must never be uploaded through the Library document API. A future shared reporting API requires a separate versioned server contract and migration plan.

### PPC dashboard catalog overlay

Key: `glassco.ppcDashboardCatalog.v1`

Schema version: `1`

The record contains `tags`, `customProducts`, `productOverrides`, and optional `hiddenPipelineProductIds`. Tags have stable IDs and case-insensitively unique names. Dashboard-only products retain their stable ID, name, optional ASIN/SKU, optional tag ID, and optional validated image data URL. Overrides key the same display fields by an authoritative Pipeline product ID. `hiddenPipelineProductIds` is a deduplicated list of stable Pipeline IDs removed only from this browser's PPC Weekly Goals portfolio. Images are restricted to supported image data URLs and the UI limits selected files to 900 KB.

Parsing is fail-closed: malformed records reset to an empty overlay; malformed and duplicate entries are discarded; missing tag references become untagged; unrecognized image values are removed. The overlay is browser-local, never mutates or deletes authoritative Pipeline products, and is not uploaded through either shared API. Removing any product from this portfolio does not delete its separately stored weekly reports; Pipeline-backed products remain intact in Product Pipeline.

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

Rich documents use a ProseMirror-style `{ "type": "doc", "content": [...] }` object. Allowed nodes are `doc`, `paragraph`, `text`, `hardBreak`, `bulletList`, `orderedList`, `listItem`, `taskList`, and `taskItem`. Allowed marks are `bold`, `italic`, `underline`, and `link`.

Persisted attributes are limited to `orderedList.start`, `taskItem.checked`, `paragraph.textAlign` (`left`, `center`, or `right`), and `link.href`. Link values accept validated HTTP(S), `mailto:`, or app-relative destinations; bare domains normalize to HTTPS and unsafe schemes are rejected. Reader links always render with `_blank` plus `noopener noreferrer`.

Searchable document links do not add a mark or document field. The editor resolves a selected active, published, visible catalog record to `/ppc/library/<encoded-slug>` and persists it through the same `link.href` contract. Picker options are presentation-only compact catalog data and are never copied into the edited document.

The corresponding legacy body/text fields remain required search and compatibility fallbacks and are updated with every edit. Legacy Headline and Description `textAlignment` remains accepted and is dual-written when alignment changes. Consumers prefer valid rich JSON and reconstruct it from fallback fields when JSON is absent or invalid.

## Library read-state metadata

Shared Library responses may include `snapshotAt`, `recoveryDocumentCount`, and `documentStatus`. `documentStatus.status` is `active`, `deleted`, `archived`, `purged`, or `not_found`; deleted responses may include record version and ADMIN-only deletion attribution.

`GET /ppc/api/library?summary=1` returns active catalog documents and the recoverable count without tombstone content. `recovery=1` explicitly includes recoverable tombstones and ADMIN deletion audit metadata. `slug=<slug>` returns the requested active document plus its structured status. `recordManifest` and `catalogCompleteness` are mandatory for live reads and mutation confirmations but optional when parsing an older confirmed cache. A missing record without an explicit deleted/archived/purged lifecycle is never interpreted as deletion.

## Weekly comparison projection

Current-versus-previous direction, display color, compact typography, and column labels are derived UI values and are not persisted. The selected report and immediately preceding weekly report continue to use the existing `WeeklyPpcReport` metric fields without contract changes. Removing “Trend” from performance-link labels does not change their Scale Insights routes, slugs, or query parameters.

Navigation column membership, Timeline PPC-only labels, percentage suffix spacing, and the five-row Budget History page are presentation rules only. Pagination does not truncate or rewrite the validated `budgetHistory` array, which retains its existing newest-first order and 100-entry cap.

`previousWeekResult` remains the existing string field. New weekly reports initialize it from the immediately preceding report when available; older blank reports may display that preceding value as a UI fallback. A non-empty value stored on the selected report always takes priority, and no new persistence field or version is introduced.
