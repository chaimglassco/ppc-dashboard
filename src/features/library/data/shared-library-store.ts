import { get, put } from "@vercel/blob";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseSharedLibraryState, type SharedLibraryState } from "../state/shared-library-state";

const BLOB_PATH = "glassco/library-state-v1.json";
const localDirectory = path.join(process.cwd(), ".data");
const localPath = path.join(localDirectory, "library-state-v1.json");

function hasBlobStore() {
  return process.env.VERCEL === "1" && Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readSharedLibraryStore(): Promise<SharedLibraryState | null> {
  try {
    if (hasBlobStore()) {
      const result = await get(BLOB_PATH, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return parseSharedLibraryState(await new Response(result.stream).json());
    }
    return parseSharedLibraryState(JSON.parse(await readFile(localPath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeSharedLibraryStore(state: SharedLibraryState) {
  const body = JSON.stringify(state);
  if (hasBlobStore()) {
    await put(BLOB_PATH, body, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
    return;
  }
  await mkdir(localDirectory, { recursive: true });
  const temporaryPath = `${localPath}.tmp`;
  await writeFile(temporaryPath, body, "utf8");
  await rename(temporaryPath, localPath);
}
