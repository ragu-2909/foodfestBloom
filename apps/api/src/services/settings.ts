import { query } from "../db.js";

type SettingValue = string | number | boolean | null | Record<string, unknown>;

export const getSetting = async <T extends SettingValue>(key: string, fallback: T): Promise<T> => {
  const result = await query<{ value: T }>("SELECT value FROM settings WHERE key = $1", [key]);
  return result.rows[0]?.value ?? fallback;
};

export const setSetting = async (key: string, value: SettingValue) => {
  await query(
    `INSERT INTO settings(key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)]
  );
};

export const getSettings = async () => {
  const result = await query<{ key: string; value: SettingValue }>(
    "SELECT key, value FROM settings ORDER BY key"
  );
  return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
};

export const getVotingWindow = async () => {
  const [votingOpen, startTime, endTime] = await Promise.all([
    getSetting<boolean>("voting_open", false),
    getSetting<string | null>("voting_start_time", null),
    getSetting<string | null>("voting_end_time", null)
  ]);

  return {
    votingOpen,
    startTime: startTime ? new Date(startTime) : null,
    endTime: endTime ? new Date(endTime) : null
  };
};

export const getVotingState = async () => {
  const { votingOpen, startTime, endTime } = await getVotingWindow();
  const now = new Date();
  const hasStarted = Boolean(votingOpen && startTime && now >= startTime);
  const hasEnded = Boolean(!votingOpen || (endTime && now > endTime));
  const remainingMs = endTime ? Math.max(0, endTime.getTime() - now.getTime()) : 0;

  return {
    votingOpen,
    hasStarted,
    hasEnded,
    serverTime: now.toISOString(),
    startTime: startTime?.toISOString() ?? null,
    endTime: endTime?.toISOString() ?? null,
    remainingMs
  };
};
