export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type Team = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  members?: string | null;
  category: string;
  votes?: number;
};

export type Results = {
  generatedAt: string;
  totalVotes: number;
  leadingTeam: Team | null;
  teams: Team[];
  voting: {
    votingOpen: boolean;
    hasStarted: boolean;
    hasEnded: boolean;
    serverTime: string;
    startTime: string | null;
    endTime: string | null;
    remainingMs: number;
  };
  showLiveResults: boolean;
};

type RequestOptions = RequestInit & { token?: string | null };

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const api = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type") && !(options.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new ApiError(payload?.message ?? "Request failed.", response.status);
  }

  return payload as T;
};

export const downloadReport = async (path: string, token: string, filename: string) => {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new ApiError("Export failed.", response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};
