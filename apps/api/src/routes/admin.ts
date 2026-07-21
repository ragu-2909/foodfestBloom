import { Router } from "express";
import { audit, asyncHandler } from "../logger.js";
import { query } from "../db.js";
import { signAdminToken, requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  loginSchema,
  settingsSchema,
  votingStartSchema,
  colorSelectionStartSchema,
  teamColorAssignSchema,
  teamTableAssignSchema,
  colorSchema
} from "../validation.js";
import { getSettings, setSetting } from "../services/settings.js";
import { rebuildTally } from "../services/tally.js";
import { adminSetTeamColor } from "../services/colors.js";

export const adminRouter = Router();

adminRouter.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      await audit(req, "admin_login_validation_failed", 400, parsed.error.flatten());
      res.status(400).json({ message: "Username and password are required." });
      return;
    }

    if (parsed.data.username !== config.adminUsername || parsed.data.password !== config.adminPassword) {
      await audit(req, "admin_login_failed", 401, {}, parsed.data.username);
      res.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    await audit(req, "admin_login_success", 200, {}, parsed.data.username, parsed.data.username);
    res.json({ token: signAdminToken(), username: config.adminUsername });
  })
);

adminRouter.use("/admin", requireAdmin);

adminRouter.get(
  "/admin/dashboard",
  asyncHandler(async (_req, res) => {
    const [teams, votes, judgeEntries, recent, settings] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*) FROM teams"),
      query<{ count: string }>("SELECT COUNT(*) FROM votes"),
      query<{ count: string }>("SELECT COUNT(*) FROM judge_scores"),
      query(
        `SELECT action, performed_by AS "performedBy", email, request_status AS "status", created_at AS "createdAt"
         FROM audit_logs
         ORDER BY created_at DESC
         LIMIT 20`
      ),
      getSettings()
    ]);

    res.json({
      metrics: {
        teams: Number(teams.rows[0].count),
        votes: Number(votes.rows[0].count),
        judgeEntries: Number(judgeEntries.rows[0].count)
      },
      settings,
      results: await rebuildTally(),
      recentActivity: recent.rows
    });
  })
);

adminRouter.post(
  "/admin/startVoting",
  asyncHandler(async (req, res) => {
    const parsed = votingStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Duration must be between 1 and 240 minutes." });
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + parsed.data.durationMinutes * 60 * 1000);
    await Promise.all([
      setSetting("voting_open", true),
      setSetting("voting_start_time", start.toISOString()),
      setSetting("voting_end_time", end.toISOString())
    ]);
    await rebuildTally();
    await audit(req, "voting_started", 200, { start, end });
    res.json({ message: "Voting started.", startTime: start, endTime: end });
  })
);

adminRouter.post(
  "/admin/stopVoting",
  asyncHandler(async (req, res) => {
    const now = new Date();
    await Promise.all([
      setSetting("voting_open", false),
      setSetting("voting_end_time", now.toISOString())
    ]);
    await rebuildTally();
    await audit(req, "voting_stopped", 200, { end: now });
    res.json({ message: "Voting stopped.", endTime: now });
  })
);

adminRouter.post(
  "/admin/startColorSelection",
  asyncHandler(async (req, res) => {
    const parsed = colorSelectionStartSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ message: "Duration must be between 1 and 240 minutes." });
      return;
    }

    const start = new Date();
    const end = new Date(start.getTime() + parsed.data.durationMinutes * 60 * 1000);
    await Promise.all([
      setSetting("color_selection_open", true),
      setSetting("color_selection_start_time", start.toISOString()),
      setSetting("color_selection_end_time", end.toISOString())
    ]);
    await audit(req, "color_selection_started", 200, { start, end });
    res.json({ message: "Color selection opened.", startTime: start, endTime: end });
  })
);

adminRouter.post(
  "/admin/stopColorSelection",
  asyncHandler(async (req, res) => {
    const now = new Date();
    await Promise.all([
      setSetting("color_selection_open", false),
      setSetting("color_selection_end_time", now.toISOString())
    ]);
    await audit(req, "color_selection_stopped", 200, { end: now });
    res.json({ message: "Color selection closed." });
  })
);

adminRouter.get(
  "/admin/teams",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT id, name, description, image_url AS "imageUrl", members, category, created_at AS "createdAt",
              invitation_token AS "invitationToken", selected_color_id AS "selectedColorId",
              selection_completed AS "selectionCompleted", table_number AS "tableNumber"
       FROM teams
       ORDER BY name ASC`
    );
    res.json(rows.rows);
  })
);

adminRouter.put(
  "/admin/teams/:id/table",
  asyncHandler(async (req, res) => {
    const parsed = teamTableAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Table number must be between 1 and 9999." });
      return;
    }

    try {
      await query("UPDATE teams SET table_number = $1, updated_at = now() WHERE id = $2", [
        parsed.data.tableNumber,
        req.params.id
      ]);
      await audit(req, "admin_team_table_updated", 200, { teamId: req.params.id, tableNumber: parsed.data.tableNumber });
      res.json({ message: "Table number updated." });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.status(409).json({ message: "That table number is already assigned to another team." });
        return;
      }
      throw err;
    }
  })
);

adminRouter.get(
  "/admin/judge-scores",
  asyncHandler(async (_req, res) => {
    const [summary, entries] = await Promise.all([
      query(
        `SELECT
          t.id AS "teamId",
          t.name AS "teamName",
          t.table_number AS "tableNumber",
          COUNT(js.id)::int AS "judgeCount",
          ROUND(AVG(js.hygiene)::numeric, 2) AS "avgHygiene",
          ROUND(AVG(js.dress_code)::numeric, 2) AS "avgDressCode",
          ROUND(AVG(js.sweet)::numeric, 2) AS "avgSweet",
          ROUND(AVG(js.savoury)::numeric, 2) AS "avgSavoury",
          ROUND(AVG(js.taste)::numeric, 2) AS "avgTaste",
          ROUND(AVG(js.hygiene + js.dress_code + js.sweet + js.savoury + js.taste)::numeric, 2) AS "avgTotal"
         FROM teams t
         LEFT JOIN judge_scores js ON js.team_id = t.id
         GROUP BY t.id
         ORDER BY "avgTotal" DESC NULLS LAST, t.name ASC`
      ),
      query(
        `SELECT
          js.id, t.name AS "teamName", t.table_number AS "tableNumber", js.judge_name AS "judgeName",
          js.hygiene, js.dress_code AS "dressCode", js.sweet, js.savoury, js.taste,
          (js.hygiene + js.dress_code + js.sweet + js.savoury + js.taste) AS total,
          js.created_at AS "createdAt"
         FROM judge_scores js
         JOIN teams t ON t.id = js.team_id
         ORDER BY js.created_at DESC`
      )
    ]);

    res.json({ summary: summary.rows, entries: entries.rows });
  })
);

adminRouter.put(
  "/admin/teams/:id/color",
  asyncHandler(async (req, res) => {
    const parsed = teamColorAssignSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid color selection." });
      return;
    }

    try {
      await adminSetTeamColor(String(req.params.id), parsed.data.colorId);
      await audit(req, "admin_team_color_updated", 200, { teamId: req.params.id, colorId: parsed.data.colorId });
      res.json({ message: parsed.data.colorId ? "Team color updated." : "Team color selection cleared." });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update team color." });
    }
  })
);

adminRouter.delete(
  "/admin/deleteTeam/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM teams WHERE id = $1", [req.params.id]);
    await rebuildTally();
    await audit(req, "team_deleted", 200, { id: req.params.id });
    res.json({ message: "Team deleted." });
  })
);

adminRouter.put(
  "/admin/settings",
  asyncHandler(async (req, res) => {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please check the settings and try again." });
      return;
    }

    if (parsed.data.showLiveResults !== undefined) {
      await setSetting("show_live_results", parsed.data.showLiveResults);
    }
    if (parsed.data.eventName !== undefined) {
      await setSetting("event_name", parsed.data.eventName);
    }
    if (parsed.data.colorSelectionOpen !== undefined) {
      await setSetting("color_selection_open", parsed.data.colorSelectionOpen);
    }
    if (parsed.data.judgePasscode !== undefined) {
      await setSetting("judge_passcode", parsed.data.judgePasscode);
    }

    await rebuildTally();
    await audit(req, "settings_updated", 200, parsed.data);
    res.json({ message: "Settings updated.", settings: await getSettings() });
  })
);

adminRouter.post(
  "/admin/resetEvent",
  asyncHandler(async (req, res) => {
    await query("TRUNCATE votes, judge_scores, audit_logs RESTART IDENTITY");
    await query(`
      DELETE FROM color_bookings;
      UPDATE teams SET selected_color_id = null, selection_completed = false, selection_completed_at = null;
    `);
    await Promise.all([
      setSetting("voting_open", false),
      setSetting("voting_start_time", null),
      setSetting("voting_end_time", null),
      setSetting("color_selection_open", false),
      setSetting("color_selection_start_time", null),
      setSetting("color_selection_end_time", null)
    ]);
    await rebuildTally();
    await audit(req, "event_reset", 200);
    res.json({ message: "Event reset complete." });
  })
);

adminRouter.post(
  "/admin/colors",
  asyncHandler(async (req, res) => {
    const parsed = colorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: parsed.error.errors[0]?.message ?? "Color name and hex code are required." });
      return;
    }
    const { name, hexCode } = parsed.data;

    try {
      await query(
        `INSERT INTO colors(name, hex_code, capacity)
         VALUES ($1, $2, 3)
         ON CONFLICT (name) DO UPDATE SET hex_code = EXCLUDED.hex_code, updated_at = now()`,
        [name, hexCode]
      );
      await audit(req, "color_added", 201, { name, hexCode });
      res.status(201).json({ message: `Color "${name}" added successfully.` });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to add color." });
    }
  })
);

adminRouter.delete(
  "/admin/colors/:id",
  asyncHandler(async (req, res) => {
    const result = await query(
      `DELETE FROM colors
       WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM color_bookings WHERE color_id = colors.id)
       RETURNING name`,
      [req.params.id]
    );
    if (result.rowCount === 0) {
      res.status(400).json({ message: "Only colors with no active reservations or bookings can be deleted." });
      return;
    }
    await audit(req, "color_deleted", 200, { id: req.params.id });
    res.json({ message: `Color "${result.rows[0].name}" deleted.` });
  })
);
