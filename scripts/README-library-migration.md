# Library legacy migration safeguards

Do not initialize the Postgres Library from repository Markdown or `.data/library-state-v1.json`. Those sources do not contain the two production custom documents.

The protected `/ppc/api/library/migration` route is available only to a verified Pipeline `ADMIN`:

- `GET` downloads the exact validated legacy private-Blob snapshot without exposing Blob credentials.
- `POST` with an empty body or `{ "action": "create-backup" }` creates an immutable, content-addressed private-Blob backup. Repeating it for unchanged content returns the existing backup.
- `POST` with `{ "action": "initialize-clean-catalog" }` first ensures that immutable backup, then initializes an empty Pipeline Library database with only these documents active:
  - `Sample Document with all the elements`
  - `Checking Spenders with No Sales`

Initialization requires exactly one record with each exact title. It preserves their IDs, slugs, content, rich text, images, and other fields, removes their `deletedAt` tombstones, and tombstones every other document. Categories are preserved. The Pipeline operation uses the flat mutation contract `{ "operation": "catalog.initialize", "state": ..., "expectedRevision": 0 }`, so an initialized/non-empty database returns `409` and is never overwritten.

## Required production order

1. Deploy and verify the Pipeline database API and the Library client protections that prohibit seed merging and browser-to-server migration.
2. Deploy this protected migration route.
3. As an authenticated ADMIN, run the backup-only action and retain its checksum/path response.
4. Optionally download a separate exact snapshot using `GET` and verify its SHA-256 digest.
5. Run `initialize-clean-catalog` once.
6. Verify the returned state has exactly two active documents and inspect both documents before allowing normal edits.

Do not run initialization before the server/client protections are live. Do not use the old whole-snapshot `PUT` endpoint for cleanup.

## Offline review tool

An exported snapshot can be reviewed without network or production writes:

```powershell
node .\scripts\prepare-library-cleanup.mjs --input .\path\to\exported-snapshot.json
```

The command writes an exact byte-for-byte backup, a separate cleanup candidate, and a checksum/report under `.data/library-migrations` by default. It has no production apply mode and fails before writing any output if either exact target title is missing or duplicated.
