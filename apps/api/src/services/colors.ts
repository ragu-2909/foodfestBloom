import { Response } from "express";
import { pool, query } from "../db.js";
import { getColorSelectionWindow, setSetting } from "./settings.js";

export interface ColorBooking {
  teamId: string;
  teamName: string;
  status: "reserved" | "booked";
  reservationExpiresAt: string | null;
  remainingMs: number;
}

export interface Color {
  id: string;
  name: string;
  hexCode: string;
  capacity: number;
  remaining: number;
  bookings: ColorBooking[];
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

// Fetch current color states with remaining slot counts and per-team bookings
export const getColorsState = async (): Promise<Color[]> => {
  const result = await query(
    `SELECT
      c.id,
      c.name,
      c.hex_code AS "hexCode",
      c.capacity,
      cb.team_id AS "teamId",
      t.name AS "teamName",
      cb.status AS "bookingStatus",
      cb.reservation_expires_at AS "reservationExpiresAt"
     FROM colors c
     LEFT JOIN color_bookings cb ON cb.color_id = c.id
       AND (cb.status = 'booked' OR cb.reservation_expires_at > now())
     LEFT JOIN teams t ON t.id = cb.team_id
     ORDER BY c.name ASC, cb.created_at ASC NULLS LAST`
  );

  const now = Date.now();
  const byId = new Map<string, Color>();

  for (const row of result.rows as any[]) {
    let color = byId.get(row.id);
    if (!color) {
      color = { id: row.id, name: row.name, hexCode: row.hexCode, capacity: row.capacity, remaining: row.capacity, bookings: [] };
      byId.set(row.id, color);
    }

    if (row.teamId) {
      let remainingMs = 0;
      if (row.bookingStatus === "reserved" && row.reservationExpiresAt) {
        remainingMs = Math.max(0, new Date(row.reservationExpiresAt).getTime() - now);
      }
      color.bookings.push({
        teamId: row.teamId,
        teamName: row.teamName,
        status: row.bookingStatus,
        reservationExpiresAt: row.reservationExpiresAt,
        remainingMs
      });
      color.remaining -= 1;
    }
  }

  return Array.from(byId.values());
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

// Atomic Color Reservation — holds one of the color's remaining slots for 2 minutes
export const reserveColor = async (teamId: string, teamName: string, colorId: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Release any existing reservation held by this team (across any color)
    await client.query(`DELETE FROM color_bookings WHERE team_id = $1 AND status = 'reserved'`, [teamId]);

    // Best-effort cleanup of stale reservations before counting capacity
    await client.query(`DELETE FROM color_bookings WHERE status = 'reserved' AND reservation_expires_at < now()`);

    const colorResult = await client.query<{ name: string; capacity: number }>(
      `SELECT name, capacity FROM colors WHERE id = $1 FOR UPDATE`,
      [colorId]
    );
    const color = colorResult.rows[0];
    if (!color) {
      throw new Error("That color doesn't exist.");
    }

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) FROM color_bookings
       WHERE color_id = $1 AND (status = 'booked' OR (status = 'reserved' AND reservation_expires_at > now()))`,
      [colorId]
    );
    if (Number(countResult.rows[0].count) >= color.capacity) {
      throw new Error("That color is full. Please choose another.");
    }

    const expiresAt = new Date(Date.now() + 120000);
    await client.query(
      `INSERT INTO color_bookings (color_id, team_id, status, reservation_expires_at)
       VALUES ($1, $2, 'reserved', $3)`,
      [colorId, teamId, expiresAt]
    );

    await client.query("COMMIT");

    addActivityLog(`Team ${teamName} reserved ${color.name}`);

    const colors = await getColorsState();
    broadcastColorEvent("COLOR_RESERVED", {
      colors,
      activityLogs,
      teamId,
      colorId,
      colorName: color.name
    });

    return { colorName: color.name, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Confirm Color Reservation (Book Permanent)
export const confirmColor = async (teamId: string, teamName: string, colorId: string) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const bookResult = await client.query<{ name: string }>(
      `UPDATE color_bookings cb
       SET status = 'booked', reservation_expires_at = null
       FROM colors c
       WHERE cb.color_id = c.id
         AND cb.team_id = $1
         AND cb.color_id = $2
         AND cb.status = 'reserved'
         AND cb.reservation_expires_at > now()
       RETURNING c.name AS name`,
      [teamId, colorId]
    );

    if (bookResult.rowCount === 0) {
      throw new Error("Your reservation has expired or is invalid. Please select the color again.");
    }

    const colorName = bookResult.rows[0].name;

    await client.query(
      `UPDATE teams
       SET selected_color_id = $2, selection_completed = true, selection_completed_at = now()
       WHERE id = $1`,
      [teamId, colorId]
    );

    await client.query("COMMIT");

    addActivityLog(`Team ${teamName} BOOKED ${colorName}`);

    const colors = await getColorsState();
    broadcastColorEvent("COLOR_BOOKED", {
      colors,
      activityLogs,
      teamId,
      colorId,
      colorName
    });

    return { colorName };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Release active reservation manually (for cleanup or cancellation)
export const releaseTeamReservation = async (teamId: string, teamName: string) => {
  const result = await query<{ id: string; name: string }>(
    `WITH deleted AS (
       DELETE FROM color_bookings WHERE team_id = $1 AND status = 'reserved' RETURNING color_id
     )
     SELECT c.id, c.name FROM deleted d JOIN colors c ON c.id = d.color_id`,
    [teamId]
  );

  if (result.rowCount && result.rowCount > 0) {
    const { id: colorId, name: colorName } = result.rows[0];
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

// Admin override: reassign or clear a team's color selection
export const adminSetTeamColor = async (teamId: string, colorId: string | null) => {
  const teamResult = await query<{ id: string; name: string; selectedColorId: string | null }>(
    `SELECT id, name, selected_color_id AS "selectedColorId" FROM teams WHERE id = $1`,
    [teamId]
  );
  const team = teamResult.rows[0];
  if (!team) {
    throw new Error("Team not found.");
  }

  // Clear this team's existing booking/reservation, if any.
  await query(`DELETE FROM color_bookings WHERE team_id = $1`, [teamId]);

  if (colorId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const colorResult = await client.query<{ name: string; capacity: number }>(
        `SELECT name, capacity FROM colors WHERE id = $1 FOR UPDATE`,
        [colorId]
      );
      const color = colorResult.rows[0];
      if (!color) {
        throw new Error("That color is not available to assign right now.");
      }

      const countResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) FROM color_bookings WHERE color_id = $1 AND status = 'booked'`,
        [colorId]
      );
      if (Number(countResult.rows[0].count) >= color.capacity) {
        throw new Error("That color is already full.");
      }

      await client.query(
        `INSERT INTO color_bookings (color_id, team_id, status) VALUES ($1, $2, 'booked')`,
        [colorId, teamId]
      );
      await client.query(
        `UPDATE teams SET selected_color_id = $2, selection_completed = true, selection_completed_at = now() WHERE id = $1`,
        [teamId, colorId]
      );

      await client.query("COMMIT");
      addActivityLog(`Admin assigned ${color.name} to team ${team.name}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } else {
    await query(
      `UPDATE teams SET selected_color_id = null, selection_completed = false, selection_completed_at = null WHERE id = $1`,
      [teamId]
    );
    addActivityLog(`Admin cleared color selection for team ${team.name}`);
  }

  const colors = await getColorsState();
  broadcastColorEvent("ADMIN_UPDATED", { colors, activityLogs, teamId, colorId });
};

// Background scheduler running every second to release expired reservations
// and auto-close the color-selection window once its duration elapses.
export const startExpirationScheduler = () => {
  setInterval(async () => {
    try {
      const expired = await query<{ colorId: string; colorName: string }>(
        `WITH deleted AS (
           DELETE FROM color_bookings
           WHERE status = 'reserved' AND reservation_expires_at < now()
           RETURNING color_id
         )
         SELECT d.color_id AS "colorId", c.name AS "colorName"
         FROM deleted d JOIN colors c ON c.id = d.color_id`
      );

      if (expired.rowCount && expired.rowCount > 0) {
        for (const row of expired.rows) {
          addActivityLog(`Reservation for ${row.colorName} expired`);
        }
        const colors = await getColorsState();
        broadcastColorEvent("TIMER_EXPIRED", {
          colors,
          activityLogs
        });
      }

      const window = await getColorSelectionWindow();
      if (window.open && window.endTime && window.endTime.getTime() < Date.now()) {
        await setSetting("color_selection_open", false);
        addActivityLog("Color selection window closed automatically.");
        broadcastColorEvent("SELECTION_CLOSED", { activityLogs });
      }
    } catch (err) {
      console.error("Expired color cleanup failed:", err);
    }
  }, 1000);
};
