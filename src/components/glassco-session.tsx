"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getPipelineLoginUrl, withPpcBasePath } from "@/lib/glassco-apps";
import { clearStoredPipelineSession, readStoredPipelineSession, type PipelineUser } from "@/lib/pipeline-session";

type GlasscoSessionContextValue = { user: PipelineUser; canAdmin: boolean; canEdit: boolean };
const GlasscoSessionContext = createContext<GlasscoSessionContextValue | null>(null);

function currentPpcRoute() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function redirectToPipelineLogin() {
  window.location.replace(getPipelineLoginUrl(currentPpcRoute()));
}

export function GlasscoSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PipelineUser | null>(null);
  const [verificationFailed, setVerificationFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredPipelineSession();
    if (!stored) {
      redirectToPipelineLogin();
      return;
    }

    void fetch(withPpcBasePath("/api/pipeline-session"), {
      headers: { Authorization: `Bearer ${stored.token}` },
      cache: "no-store",
    }).then(async response => {
      if (response.status === 401) {
        clearStoredPipelineSession();
        if (!cancelled) redirectToPipelineLogin();
        return;
      }
      if (!response.ok) throw new Error(`Session verification failed (${response.status})`);
      const value: unknown = await response.json();
      if (!value || typeof value !== "object") throw new Error("Session verification failed");
      const verified = (value as Record<string, unknown>).user;
      if (!verified || typeof verified !== "object") throw new Error("Session verification failed");
      if (!cancelled) setUser(verified as PipelineUser);
    }).catch(() => {
      if (!cancelled) setVerificationFailed(true);
    });

    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => user ? { user, canAdmin: user.role === "ADMIN", canEdit: user.role === "ADMIN" || user.role === "USER" } : null, [user]);
  if (verificationFailed) return <div className="session-gate" role="alert"><span>Glassco</span><p>We could not verify your session right now.</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div>;
  if (!value) return <div className="session-gate" role="status" aria-live="polite"><span>Glassco</span><p>Verifying your Pipeline session…</p></div>;
  return <GlasscoSessionContext.Provider value={value}>{children}</GlasscoSessionContext.Provider>;
}

export function useGlasscoSession() {
  const value = useContext(GlasscoSessionContext);
  if (!value && process.env.NODE_ENV === "test") return { user: { email: "admin@glassco.test", name: "Test admin", role: "ADMIN" as const }, canAdmin: true, canEdit: true };
  if (!value) throw new Error("useGlasscoSession must be used inside GlasscoSessionProvider");
  return value;
}
