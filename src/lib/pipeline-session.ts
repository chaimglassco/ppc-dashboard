export const PIPELINE_SESSION_STORAGE_KEY = "launchflow.authSession.v1";

export type PipelineRole = "ADMIN" | "USER" | "VIEWER";

export type PipelineUser = {
  id?: string;
  email: string;
  name: string;
  role: PipelineRole;
};

type StoredPipelineSession = PipelineUser & { token: string };

function normalizeRole(value: unknown): PipelineRole {
  const role = String(value ?? "").toUpperCase();
  if (role === "ADMIN" || role === "VIEWER") return role;
  return "USER";
}

export function parseStoredPipelineSession(value: string | null): StoredPipelineSession | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as Record<string, unknown>;
    if (typeof candidate.token !== "string" || !candidate.token || typeof candidate.email !== "string" || !candidate.email) return null;
    return {
      token: candidate.token,
      email: candidate.email,
      name: typeof candidate.name === "string" && candidate.name ? candidate.name : candidate.email,
      role: normalizeRole(candidate.role),
    };
  } catch {
    return null;
  }
}

export function readStoredPipelineSession(): StoredPipelineSession | null {
  if (typeof window === "undefined") return null;
  return parseStoredPipelineSession(window.localStorage.getItem(PIPELINE_SESSION_STORAGE_KEY))
    ?? parseStoredPipelineSession(window.sessionStorage.getItem(PIPELINE_SESSION_STORAGE_KEY));
}

export function getPipelineAuthorizationHeader(): Record<string, string> {
  const session = readStoredPipelineSession();
  return session ? { Authorization: `Bearer ${session.token}` } : {};
}
