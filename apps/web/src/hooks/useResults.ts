import { useEffect, useState } from "react";
import { API_URL, api, Results } from "@/lib/api";

const initialResults: Results = {
  generatedAt: new Date().toISOString(),
  totalVotes: 0,
  leadingTeam: null,
  teams: [],
  voting: {
    votingOpen: false,
    hasStarted: false,
    hasEnded: true,
    serverTime: new Date().toISOString(),
    startTime: null,
    endTime: null,
    remainingMs: 0
  },
  showLiveResults: true
};

/** SSE subscription to /events/stream with a polling fallback if the stream drops. */
export const useResults = () => {
  const [results, setResults] = useState<Results>(initialResults);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let polling: number | undefined;
    const source = new EventSource(`${API_URL}/events/stream`);

    source.addEventListener("results", (event) => {
      setConnected(true);
      setResults(JSON.parse((event as MessageEvent).data));
    });

    source.onerror = () => {
      setConnected(false);
      if (!polling) {
        polling = window.setInterval(async () => {
          try {
            setResults(await api<Results>("/results"));
          } catch {
            setConnected(false);
          }
        }, 4000);
      }
    };

    return () => {
      source.close();
      if (polling) window.clearInterval(polling);
    };
  }, []);

  return { results, connected };
};
