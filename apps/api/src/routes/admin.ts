import { Router } from "express";
import { audit, asyncHandler } from "../logger.js";
import { query } from "../db.js";
import { signAdminToken, requireAdmin } from "../middleware/auth.js";
import { config } from "../config.js";
import {
  loginSchema,
  settingsSchema,
  teamSchema,
  votingStartSchema
} from "../validation.js";
import { getSettings, setSetting } from "../services/settings.js";
import { rebuildTally } from "../services/tally.js";

export const adminRouter = Router();

adminRouter.post(
  "/admin/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      await audit(req, "admin_login_validation_failed", 400, parsed.error.flatten());
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    if (parsed.data.email !== config.adminEmail || parsed.data.password !== config.adminPassword) {
      await audit(req, "admin_login_failed", 401, {}, parsed.data.email);
      res.status(401).json({ message: "Invalid admin credentials." });
      return;
    }

    await audit(req, "admin_login_success", 200, {}, parsed.data.email, parsed.data.email);
    res.json({ token: signAdminToken(), email: config.adminEmail });
  })
);

adminRouter.use("/admin", requireAdmin);

adminRouter.get(
  "/admin/dashboard",
  asyncHandler(async (_req, res) => {
    const [registrations, votes, teams, recent, settings] = await Promise.all([
      query<{ count: string }>("SELECT COUNT(*) FROM registrations"),
      query<{ count: string }>("SELECT COUNT(*) FROM votes"),
      query<{ count: string }>("SELECT COUNT(*) FROM teams"),
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
        registrations: Number(registrations.rows[0].count),
        votes: Number(votes.rows[0].count),
        teams: Number(teams.rows[0].count)
      },
      settings,
      results: await rebuildTally(),
      recentActivity: recent.rows
    });
  })
);

adminRouter.get(
  "/admin/registrations",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT id, email, employee_name AS "employeeName", team_name AS "teamName",
        team_members AS "teamMembers", food_category AS "foodCategory",
        contact_number AS "contactNumber", description, status, created_at AS "createdAt"
       FROM registrations
       ORDER BY created_at DESC`
    );
    res.json(rows.rows);
  })
);

adminRouter.put(
  "/admin/registrations/:id",
  asyncHandler(async (req, res) => {
    const status = String(req.body.status ?? "active");
    const description = req.body.description === undefined ? null : String(req.body.description);
    await query(
      `UPDATE registrations
       SET status = $1, description = COALESCE($2, description), updated_at = now()
       WHERE id = $3`,
      [status, description, req.params.id]
    );
    await audit(req, "registration_updated", 200, { id: req.params.id, status });
    res.json({ message: "Registration updated." });
  })
);

adminRouter.delete(
  "/admin/registrations/:id",
  asyncHandler(async (req, res) => {
    await query("DELETE FROM registrations WHERE id = $1", [req.params.id]);
    await audit(req, "registration_deleted", 200, { id: req.params.id });
    res.json({ message: "Registration deleted." });
  })
);

adminRouter.post(
  "/admin/startRegistration",
  asyncHandler(async (req, res) => {
    await setSetting("registration_open", true);
    await audit(req, "registration_started", 200);
    res.json({ message: "Registration opened." });
  })
);

adminRouter.post(
  "/admin/stopRegistration",
  asyncHandler(async (req, res) => {
    await setSetting("registration_open", false);
    await audit(req, "registration_stopped", 200);
    res.json({ message: "Registration closed." });
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

adminRouter.get(
  "/admin/teams",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT id, name, description, image_url AS "imageUrl", members, category, created_at AS "createdAt"
       FROM teams
       ORDER BY name ASC`
    );
    res.json(rows.rows);
  })
);

adminRouter.post(
  "/admin/addTeam",
  asyncHandler(async (req, res) => {
    const parsed = teamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please check the team form and try again." });
      return;
    }

    const row = await query<{ id: string }>(
      `INSERT INTO teams(name, description, image_url, members, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        parsed.data.name,
        parsed.data.description ?? null,
        parsed.data.imageUrl || null,
        parsed.data.members ?? null,
        parsed.data.category,
        req.user?.email ?? null
      ]
    );
    await rebuildTally();
    await audit(req, "team_created", 201, { id: row.rows[0].id, name: parsed.data.name });
    res.status(201).json({ message: "Team added.", id: row.rows[0].id });
  })
);

adminRouter.put(
  "/admin/editTeam/:id",
  asyncHandler(async (req, res) => {
    const parsed = teamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please check the team form and try again." });
      return;
    }

    await query(
      `UPDATE teams
       SET name = $1, description = $2, image_url = $3, members = $4, category = $5, updated_at = now()
       WHERE id = $6`,
      [
        parsed.data.name,
        parsed.data.description ?? null,
        parsed.data.imageUrl || null,
        parsed.data.members ?? null,
        parsed.data.category,
        req.params.id
      ]
    );
    await rebuildTally();
    await audit(req, "team_updated", 200, { id: req.params.id, name: parsed.data.name });
    res.json({ message: "Team updated." });
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

    if (parsed.data.registrationOpen !== undefined) {
      await setSetting("registration_open", parsed.data.registrationOpen);
    }
    if (parsed.data.showLiveResults !== undefined) {
      await setSetting("show_live_results", parsed.data.showLiveResults);
    }
    if (parsed.data.eventName !== undefined) {
      await setSetting("event_name", parsed.data.eventName);
    }

    await rebuildTally();
    await audit(req, "settings_updated", 200, parsed.data);
    res.json({ message: "Settings updated.", settings: await getSettings() });
  })
);

adminRouter.post(
  "/admin/resetEvent",
  asyncHandler(async (req, res) => {
    await query("TRUNCATE votes, registrations, audit_logs RESTART IDENTITY");
    await Promise.all([
      setSetting("registration_open", true),
      setSetting("voting_open", false),
      setSetting("voting_start_time", null),
      setSetting("voting_end_time", null)
    ]);
    await rebuildTally();
    await audit(req, "event_reset", 200);
    res.json({ message: "Event reset complete." });
  })
);
