import { useEffect, useState } from "react";
import { api, PublicSettings } from "@/lib/api";

/** Lightweight poll of /settings/public — used by the admin dashboard to show
 * live voting/color-selection countdowns without a dedicated SSE channel. */
export const usePublicSettings = (intervalMs = 3000) => {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await api<PublicSettings>("/settings/public");
        if (!cancelled) setSettings(data);
      } catch {
        // ignore transient failures, next tick retries
      }
    };
    load();
    const id = window.setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);

  return settings;
};
