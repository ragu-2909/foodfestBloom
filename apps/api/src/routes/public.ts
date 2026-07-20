import { Router } from "express";
import rateLimit from "express-rate-limit";
import { audit, asyncHandler } from "../logger.js";
import { isUniqueViolation, query } from "../db.js";
import { voteSchema } from "../validation.js";
import { getSetting, getVotingState, getColorSelectionState } from "../services/settings.js";
import { getSnapshot, rebuildTally } from "../services/tally.js";

export const publicRouter = Router();

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a moment and try again." }
});

publicRouter.get(
  "/teams",
  asyncHandler(async (_req, res) => {
    const teams = await query(
      `SELECT id, name, description, image_url AS "imageUrl", members, category
       FROM teams
       ORDER BY name ASC`
    );
    res.json(teams.rows);
  })
);

publicRouter.get(
  "/settings/public",
  asyncHandler(async (_req, res) => {
    res.json({
      eventName: await getSetting<string>("event_name", "Taste of Bloom"),
      showLiveResults: await getSetting<boolean>("show_live_results", true),
      voting: await getVotingState(),
      colorSelection: await getColorSelectionState()
    });
  })
);

publicRouter.post(
  "/vote",
  writeLimiter,
  asyncHandler(async (req, res) => {
    const parsed = voteSchema.safeParse(req.body);
    if (!parsed.success) {
      await audit(req, "vote_validation_failed", 400, parsed.error.flatten());
      res.status(400).json({ message: "Please check your selection and try again." });
      return;
    }

    const voting = await getVotingState();
    if (!voting.hasStarted) {
      await audit(req, "vote_before_start", 403, { voting }, parsed.data.email);
      res.status(403).json({ message: "Voting has not started yet.", voting });
      return;
    }
    if (voting.hasEnded) {
      await audit(req, "vote_after_end", 403, { voting }, parsed.data.email);
      res.status(403).json({ message: "Voting has ended.", voting });
      return;
    }

    try {
      await query("INSERT INTO votes(email, team_id) VALUES ($1, $2)", [
        parsed.data.email,
        parsed.data.teamId
      ]);
      await rebuildTally();
      await audit(req, "vote_created", 201, { teamId: parsed.data.teamId }, parsed.data.email);
      res.status(201).json({ message: "Vote submitted successfully.", results: getSnapshot() });
    } catch (error) {
      if (isUniqueViolation(error)) {
        await audit(req, "vote_duplicate", 409, {}, parsed.data.email);
        res.status(409).json({ message: "You have already voted." });
        return;
      }
      throw error;
    }
  })
);

publicRouter.get(
  "/results",
  asyncHandler(async (_req, res) => {
    res.json(await rebuildTally());
  })
);

publicRouter.get(
  "/health",
  asyncHandler(async (_req, res) => {
    const dbStarted = Date.now();
    await query("SELECT 1");
    res.json({
      status: "ok",
      database: "ok",
      databaseLatencyMs: Date.now() - dbStarted,
      version: process.env.APP_VERSION ?? "0.1.0",
      serverTime: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime())
    });
  })
);
