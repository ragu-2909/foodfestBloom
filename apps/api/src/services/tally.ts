import { Response } from "express";
import { query } from "../db.js";
import { getSetting, getVotingState } from "./settings.js";

export type TeamResult = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  votes: number;
};

export type ResultSnapshot = {
  generatedAt: string;
  totalVotes: number;
  leadingTeam: TeamResult | null;
  teams: TeamResult[];
  voting: Awaited<ReturnType<typeof getVotingState>>;
  showLiveResults: boolean;
};

let snapshot: ResultSnapshot = {
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

const clients = new Set<Response>();

export const rebuildTally = async () => {
  const [rows, voting, showLiveResults] = await Promise.all([
    query<TeamResult>(
      `SELECT
        t.id,
        t.name,
        t.description,
        t.image_url AS "imageUrl",
        t.category,
        COUNT(v.id)::int AS votes
       FROM teams t
       LEFT JOIN votes v ON v.team_id = t.id
       GROUP BY t.id
       ORDER BY votes DESC, t.name ASC`
    ),
    getVotingState(),
    getSetting<boolean>("show_live_results", true)
  ]);

  const teams = rows.rows;
  const totalVotes = teams.reduce((total, team) => total + team.votes, 0);

  snapshot = {
    generatedAt: new Date().toISOString(),
    totalVotes,
    leadingTeam: teams[0] && teams[0].votes > 0 ? teams[0] : null,
    teams,
    voting,
    showLiveResults
  };

  return snapshot;
};

export const getSnapshot = () => snapshot;

export const subscribe = (res: Response) => {
  clients.add(res);
  res.write(`event: results\n`);
  res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
};

export const unsubscribe = (res: Response) => {
  clients.delete(res);
};

export const startBroadcastLoop = () => {
  setInterval(async () => {
    try {
      await rebuildTally();
      const payload = `event: results\ndata: ${JSON.stringify(snapshot)}\n\n`;
      for (const client of clients) {
        client.write(payload);
      }
    } catch (error) {
      console.error("sse_broadcast_failed", error);
    }
  }, 750);
};
