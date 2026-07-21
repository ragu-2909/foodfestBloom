/** Same-origin by default: the app is served behind a reverse proxy that
 * forwards /api to the backend, so no external host is ever contacted. */
export const API_URL = import.meta.env.PUBLIC_API_URL ?? "/api";

export type Team = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  members?: string | null;
  category: string;
  votes?: number;
  invitationToken?: string;
  selectedColorId?: string | null;
  selectionCompleted?: boolean;
  tableNumber?: number | null;
};

export type VotingState = {
  votingOpen: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  serverTime: string;
  startTime: string | null;
  endTime: string | null;
  remainingMs: number;
};

export type ColorSelectionState = {
  open: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  serverTime: string;
  startTime: string | null;
  endTime: string | null;
  remainingMs: number;
};

export type Results = {
  generatedAt: string;
  totalVotes: number;
  leadingTeam: Team | null;
  teams: Team[];
  voting: VotingState;
  showLiveResults: boolean;
};

export type PublicSettings = {
  eventName: string;
  showLiveResults: boolean;
  voting: VotingState;
  colorSelection: ColorSelectionState;
};

export type ColorBooking = {
  teamId: string;
  teamName: string;
  status: "reserved" | "booked";
  reservationExpiresAt: string | null;
  remainingMs: number;
};

export type ColorOption = {
  id: string;
  name: string;
  hexCode: string;
  capacity: number;
  remaining: number;
  bookings: ColorBooking[];
};

export type ActivityLogEntry = { time: string; text: string };

export type AdminDashboard = {
  metrics: { teams: number; votes: number; judgeEntries: number };
  settings: Record<string, unknown>;
  recentActivity: {
    action: string;
    performedBy: string | null;
    email: string | null;
    status: number;
    createdAt: string;
  }[];
};

export type TeamInvite = {
  id: string;
  name: string;
  members: string | null;
  selectionCompleted: boolean;
  selectionCompletedAt: string | null;
  selectedColorId: string | null;
  selectedColorName: string | null;
  selectedColorHex: string | null;
};

export type JudgeTeam = { id: string; name: string; category: string; tableNumber: number };

export type ScoreCategories = {
  hygiene: number;
  dressCode: number;
  sweet: number;
  savoury: number;
  taste: number;
};

export type JudgeScoreSummaryRow = {
  teamId: string;
  teamName: string;
  tableNumber: number | null;
  judgeCount: number;
  avgHygiene: string | null;
  avgDressCode: string | null;
  avgSweet: string | null;
  avgSavoury: string | null;
  avgTaste: string | null;
  avgTotal: string | null;
};

export type JudgeScoreEntryRow = ScoreCategories & {
  id: string;
  teamName: string;
  tableNumber: number | null;
  judgeName: string;
  total: number;
  createdAt: string;
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

const VOTER_ID_KEY = "foodfest_voter_id";

/** A silent per-device identifier, never shown to the user, that satisfies
 * the backend's unique-index-based vote dedup without a visible email field. */
export const getOrCreateVoterId = (): string => {
  let id = localStorage.getItem(VOTER_ID_KEY);
  if (!id) {
    id = `voter-${crypto.randomUUID()}@device.local`;
    localStorage.setItem(VOTER_ID_KEY, id);
  }
  return id;
};
