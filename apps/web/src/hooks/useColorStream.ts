import { useEffect, useState } from "react";
import { API_URL, ActivityLogEntry, ColorOption } from "@/lib/api";

type ColorEventPayload = {
  type: string;
  colors?: ColorOption[];
  onlineTeams?: string[];
  activityLogs?: ActivityLogEntry[];
};

/** SSE subscription to /colors/stream, shared by the admin dashboard and the
 * participant color-selection flow. `token` is either a team invitation
 * token or an admin JWT — the API distinguishes them server-side. */
export const useColorStream = (token: string | null) => {
  const [colors, setColors] = useState<ColorOption[]>([]);
  const [onlineTeams, setOnlineTeams] = useState<string[]>([]);
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [closed, setClosed] = useState(false);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    const source = new EventSource(`${API_URL}/colors/stream?token=${encodeURIComponent(token)}`);

    source.addEventListener("open", () => setConnected(true));

    source.addEventListener("color_event", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as ColorEventPayload;
      if (payload.colors) setColors(payload.colors);
      if (payload.activityLogs) setLogs(payload.activityLogs);
      if (payload.onlineTeams) setOnlineTeams(payload.onlineTeams);
      if (payload.type === "SELECTION_CLOSED") setClosed(true);
    });

    source.onerror = () => setConnected(false);

    return () => {
      source.close();
    };
  }, [token]);

  return { colors, onlineTeams, logs, closed, connected };
};
