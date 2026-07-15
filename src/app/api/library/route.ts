import { loadAllDocuments } from "@/features/library/data/repository";
import { readSharedLibraryStore, writeSharedLibraryStore } from "@/features/library/data/shared-library-store";
import { mergeSharedLibraryState, parseSharedLibraryState } from "@/features/library/state/shared-library-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET() {
  try {
    const stored = await readSharedLibraryStore();
    const state = mergeSharedLibraryState(loadAllDocuments(), stored);
    return Response.json({ initialized: Boolean(stored), state }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "The shared library is temporarily unavailable." }, { status: 503, headers: noStoreHeaders });
  }
}

export async function PUT(request: Request) {
  try {
    const body: unknown = await request.json();
    const requested = body && typeof body === "object" ? parseSharedLibraryState((body as Record<string, unknown>).state) : null;
    if (!requested) return Response.json({ error: "Invalid shared library data." }, { status: 400, headers: noStoreHeaders });
    const state = mergeSharedLibraryState(loadAllDocuments(), requested);
    await writeSharedLibraryStore(state);
    return Response.json({ state }, { headers: noStoreHeaders });
  } catch {
    return Response.json({ error: "Unable to save the shared library." }, { status: 503, headers: noStoreHeaders });
  }
}
