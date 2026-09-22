import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { parseDashboardDocument, type DashboardDocument, type DashboardStoreKey } from "../domain/shared-dashboard";

const pathFor = (key: DashboardStoreKey) => `glassco/ppc-team/v1/${key}.json`;
export class DashboardConflict extends Error {}
function requireStorage() {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) throw new Error("Shared dashboard storage is not configured.");
}
export async function readDashboardDocument(key: DashboardStoreKey) {
  requireStorage();
  const result = await get(pathFor(key), { access: "private", useCache: false });
  if (!result) return { document: null, etag: null };
  if (result.statusCode !== 200) throw new Error("Could not read current dashboard data.");
  return { document: parseDashboardDocument(await new Response(result.stream).json(), key), etag: result.blob.etag };
}

export async function saveDashboardDocument(document: DashboardDocument, expectedEtag: string | null) {
  requireStorage();
  const current = await readDashboardDocument(document.key);
  // A response can be lost after a successful write. Retrying the same operation is safe.
  if (current.document?.operationId === document.operationId && current.document.value === document.value) return current;
  if (current.etag !== expectedEtag) throw new DashboardConflict("Someone else updated this dataset. Download your pending changes, then reload the shared data.");
  if (current.document) {
    await put(`glassco/ppc-team-history/v1/${document.key}/${randomUUID()}.json`, JSON.stringify(current.document), {
      access: "private", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json",
    });
  }
  try {
    const result = await put(pathFor(document.key), JSON.stringify(document), {
      access: "private", addRandomSuffix: false, allowOverwrite: expectedEtag !== null,
      ...(expectedEtag ? { ifMatch: expectedEtag } : {}), contentType: "application/json", cacheControlMaxAge: 60,
    });
    return { document, etag: result.etag };
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new DashboardConflict("Someone else updated this dataset. Download your pending changes, then reload the shared data.");
    // Create-only races also remain conflicts; never retry by overwriting.
    if (expectedEtag === null && (await readDashboardDocument(document.key)).document) throw new DashboardConflict("Shared data was created in another session. Reload to use it; your local copy is unchanged.");
    throw error;
  }
}
