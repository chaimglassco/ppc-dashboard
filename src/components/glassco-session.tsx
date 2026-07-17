"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { PIPELINE_HOME, withPpcBasePath } from "@/lib/glassco-apps";
import { readStoredPipelineSession, type PipelineUser } from "@/lib/pipeline-session";

type GlasscoSessionContextValue = { user: PipelineUser; canAdmin: boolean };
const GlasscoSessionContext = createContext<GlasscoSessionContextValue | null>(null);

export function GlasscoSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PipelineUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const stored = readStoredPipelineSession();
    if (!stored) {
      window.location.replace(PIPELINE_HOME);
      return;
    }

    void fetch(withPpcBasePath("/api/pipeline-session"), {
      headers: { Authorization: `Bearer ${stored.token}` },
      cache: "no-store",
    }).then(async response => {
      const value: unknown = await response.json();
      if (!response.ok || !value || typeof value !== "object") throw new Error("Session verification failed");
      const verified = (value as Record<string, unknown>).user;
      if (!verified || typeof verified !== "object") throw new Error("Session verification failed");
      const candidate = verified as PipelineUser;
      if (!cancelled) setUser(candidate);
    }).catch(() => {
      if (!cancelled) window.location.replace(PIPELINE_HOME);
    });

    return () => { cancelled = true; };
  }, []);

  const value = useMemo(() => user ? { user, canAdmin: user.role === "ADMIN" } : null, [user]);
  if (!value) return <div className="session-gate" role="status" aria-live="polite"><span>Glassco</span><p>Verifying your Pipeline session…</p></div>;
  return <GlasscoSessionContext.Provider value={value}>{children}</GlasscoSessionContext.Provider>;
}

export function useGlasscoSession() {
  const value = useContext(GlasscoSessionContext);
  if (!value && process.env.NODE_ENV === "test") return { user: { email: "admin@glassco.test", name: "Test admin", role: "ADMIN" as const }, canAdmin: true };
  if (!value) throw new Error("useGlasscoSession must be used inside GlasscoSessionProvider");
  return value;
}
