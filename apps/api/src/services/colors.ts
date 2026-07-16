import { Response } from "express";
import { query } from "../db.js";

export interface Color {
  id: string;
  name: string;
  hexCode: string;
  status: "available" | "reserved" | "booked";
  reservedByTeamId: string | null;
  reservedByTeamName: string | null;
  bookedByTeamId: string | null;
  bookedByTeamName: string | null;
  reservationExpiresAt: string | null;
  remainingMs: number;
}

export interface OnlineTeam {
  teamId: string;
  teamName: string;
}

export interface ActivityLog {
  time: string;
  text: string;
}

// Active connections for the presence system
const activeClients = new Map<Response, OnlineTeam>();

// In-memory queue for recent activity logs (limit to last 20)
const activityLogs: ActivityLog[] = [];

const addActivityLog = (text: string) => {
  activityLogs.unshift({
    time: new Date().toISOString(),
    text
  });
  if (activityLogs.length > 20) {
    activityLogs.pop();
  }
};

// Send SSE payload to a specific client
const sendEvent = (res: Response, type: string, data: any) => {
  res.write(`event: color_event\n`);
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
};

// Broadcast an event to all connected clients
export const broadcastColorEvent = (type: string, data: any) => {
  const payload = `event: color_event\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  for (const [client] of activeClients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error("Failed to write to SSE client:", err);
    }
  }
};

// Compile list of unique online teams
export const getOnlineTeamsList = (): string[] => {
  const names = Array.from(activeClients.values()).map((t) => t.teamName);
  return Array.from(new Set(names)).sort();
};

// Fetch current color states with remaining durations calculated
export const getColorsState = async (): Promise<Color[]> => {
  const result = await query(
    `SELECT 
      c.id, 
      c.name, 
      c.hex_code AS "hexCode", 
      c.status,
      c.reserved_by_team_id AS "reservedByTeamId",
      tr.name AS "reservedByTeamName",
      c.booked_by_team_id AS "bookedByTeamId",
      tb.name AS "bookedByTeamName",
      c.reservation_expires_at AS "reservationExpiresAt"
     FROM colors c
     LEFT JOIN teams tr ON tr.id = c.reserved_by_team_id
     LEFT JOIN teams tb ON tb.id = c.booked_by_team_id
     ORDER BY c.name ASC`
  );

  const now = Date.now();
  return result.rows.map((row: any) => {
    let remainingMs = 0;
    if (row.status === "reserved" && row.reservationExpiresAt) {
      const expires = new Date(row.reservationExpiresAt).getTime();
      remainingMs = Math.max(0, expires - now);
    }

    return {
      id: row.id,
      name: row.name,
      hexCode: row.hexCode,
      status: row.status,
      reservedByTeamId: row.reservedByTeamId,
      reservedByTeamName: row.reservedByTeamName,
      bookedByTeamId: row.bookedByTeamId,
      bookedByTeamName: row.bookedByTeamName,
      reservationExpiresAt: row.reservationExpiresAt,
      remainingMs
    };
  });
};

// Register client connection and track presence
export const subscribeColors = async (res: Response, team: OnlineTeam) => {
  activeClients.set(res, team);

  // Broadcast join event
  addActivityLog(`Team ${team.teamName} joined the selection`);
  broadcastColorEvent("TEAM_JOINED", {
    teamName: team.teamName,
    onlineTeams: getOnlineTeamsList(),
    activityLogs
  });

  // Send initial load details directly to new client
  const colors = await getColorsState();
  sendEvent(res, "INITIAL_STATE", {
    colors,
    onlineTeams: getOnlineTeamsList(),
    activityLogs
  });
};

// Unregister client connection
export const unsubscribeColors = (res: Response) => {
  const team = activeClients.get(res);
  if (team) {
    activeClients.delete(res);
    addActivityLog(`Team ${team.teamName} left the selection`);
    broadcastColorEvent("TEAM_LEFT", {
      teamName: team.teamName,
      onlineTeams: getOnlineTeamsList(),
      activityLogs
    });
  }
};

// Token Validation returning team profile
export const validateInvitationToken = async (token: string) => {
  if (!token || typeof token !== "string" || token.trim() === "") {
    return null;
  }

  const result = await query(
    `SELECT 
      t.id, 
      t.name, 
      t.members, 
      t.selection_completed AS "selectionCompleted", 
      t.selection_completed_at AS "selectionCompletedAt",
      t.selected_color_id AS "selectedColorId",
      c.name AS "selectedColorName",
      c.hex_code AS "selectedColorHex"
     FROM teams t
     LEFT JOIN colors c ON c.id = t.selected_color_id
     WHERE t.invitation_token = $1`,
    [token.trim()]
  );

  return result.rows[0] || null;
};

// Atomic Color Reservation
export const reserveColor = async (teamId: string, teamName: string, colorId: string) => {
  // First, release any existing reservation by this team
  await query(
    `UPDATE colors
     SET status = 'available', reserved_by_team_id = null, reservation_expires_at = null, updated_at = now()
     WHERE reserved_by_team_id = $1 AND status = 'reserved'`,
    [teamId]
  );

  // Next, try to reserve the new color atomically
  const reserveResult = await query(
    `UPDATE colors
     SET 
       status = 'reserved', 
       reserved_by_team_id = $1, 
       reservation_expires_at = now() + interval '2 minutes', 
       updated_at = now()
     WHERE id = $2 
       AND status = 'available' 
       AND (reservation_expires_at IS NULL OR reservation_expires_at < now())
     RETURNING name`,
    [teamId, colorId]
  );

  if (reserveResult.rowCount === 0) {
    throw new Error("Color already reserved or booked. Please choose another.");
  }

  const colorName = reserveResult.rows[0].name;
  addActivityLog(`Team ${teamName} reserved ${colorName}`);

  // Broadcast status update
  const colors = await getColorsState();
  broadcastColorEvent("COLOR_RESERVED", {
    colors,
    activityLogs,
    teamId,
    colorId,
    colorName
  });

  return { colorName, expiresAt: new Date(Date.now() + 120000).toISOString() };
};

// Confirm Color Reservation (Book Permanent)
export const confirmColor = async (teamId: string, teamName: string, colorId: string) => {
  // 1. Mark color status as 'booked'
  const bookResult = await query(
    `UPDATE colors
     SET status = 'booked', booked_by_team_id = $1, reserved_by_team_id = null, reservation_expires_at = null, updated_at = now()
     WHERE id = $2 AND reserved_by_team_id = $1 AND status = 'reserved' AND reservation_expires_at > now()
     RETURNING name`,
    [teamId, colorId]
  );

  if (bookResult.rowCount === 0) {
    throw new Error("Your reservation has expired or is invalid. Please select the color again.");
  }

  const colorName = bookResult.rows[0].name;

  // 2. Mark selection completed in teams table
  await query(
    `UPDATE teams
     SET selected_color_id = $2, selection_completed = true, selection_completed_at = now()
     WHERE id = $1`,
    [teamId, colorId]
  );

  addActivityLog(`Team ${teamName} BOOKED ${colorName}`);

  // Broadcast status update
  const colors = await getColorsState();
  broadcastColorEvent("COLOR_BOOKED", {
    colors,
    activityLogs,
    teamId,
    colorId,
    colorName
  });

  return { colorName };
};

// Release active reservation manually (for cleanup or cancellation)
export const releaseTeamReservation = async (teamId: string, teamName: string) => {
  const result = await query(
    `UPDATE colors
     SET status = 'available', reserved_by_team_id = null, reservation_expires_at = null, updated_at = now()
     WHERE reserved_by_team_id = $1 AND status = 'reserved'
     RETURNING name, id`,
    [teamId]
  );

  if (result.rowCount && result.rowCount > 0) {
    const colorName = result.rows[0].name;
    const colorId = result.rows[0].id;
    addActivityLog(`Team ${teamName} released reservation for ${colorName}`);
    const colors = await getColorsState();
    broadcastColorEvent("COLOR_RELEASED", {
      colors,
      activityLogs,
      colorId,
      colorName
    });
  }
};

// Background scheduler running every second to release expired reservations
export const startExpirationScheduler = () => {
  setInterval(async () => {
    try {
      const expired = await query<{ id: string; name: string }>(
        `UPDATE colors
         SET status = 'available', reserved_by_team_id = null, reservation_expires_at = null, updated_at = now()
         WHERE status = 'reserved' AND reservation_expires_at < now()
         RETURNING id, name`
      );

      if (expired.rowCount && expired.rowCount > 0) {
        for (const row of expired.rows) {
          addActivityLog(`Reservation for ${row.name} expired`);
        }
        const colors = await getColorsState();
        broadcastColorEvent("TIMER_EXPIRED", {
          colors,
          activityLogs
        });
      }
    } catch (err) {
      console.error("Expired color cleanup failed:", err);
    }
  }, 1000);
};
