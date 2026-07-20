import { Router } from "express";
import { audit, asyncHandler } from "../logger.js";
import { query } from "../db.js";
import { signJudgeToken, requireJudge } from "../middleware/auth.js";
import { getSetting } from "../services/settings.js";
import { judgeLoginSchema, judgeScoreSchema } from "../validation.js";

export const judgeRouter = Router();

judgeRouter.post(
  "/judge/login",
  asyncHandler(async (req, res) => {
    const parsed = judgeLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please enter your name and the judging passcode." });
      return;
    }

    const judgePasscode = await getSetting<string>("judge_passcode", "2026");
    if (parsed.data.passcode !== judgePasscode) {
      await audit(req, "judge_login_failed", 401, {}, parsed.data.judgeName);
      res.status(401).json({ message: "Incorrect passcode. Check with the event organizers." });
      return;
    }

    await audit(req, "judge_login_success", 200, {}, parsed.data.judgeName, parsed.data.judgeName);
    res.json({ token: signJudgeToken(parsed.data.judgeName), judgeName: parsed.data.judgeName });
  })
);

judgeRouter.use("/judge", requireJudge);

judgeRouter.get(
  "/judge/teams/lookup",
  asyncHandler(async (req, res) => {
    const table = Number(req.query.table);
    if (!Number.isInteger(table) || table < 1) {
      res.status(400).json({ message: "Enter a valid table number." });
      return;
    }

    const result = await query<{ id: string; name: string; category: string; tableNumber: number }>(
      `SELECT id, name, category, table_number AS "tableNumber" FROM teams WHERE table_number = $1`,
      [table]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ message: `No team is assigned to table ${table} yet.` });
      return;
    }

    res.json(result.rows[0]);
  })
);

judgeRouter.get(
  "/judge/scores/existing",
  asyncHandler(async (req, res) => {
    const teamId = String(req.query.teamId || "");
    const judgeName = String(req.query.judgeName || "");
    if (!teamId || !judgeName) {
      res.json(null);
      return;
    }

    const result = await query(
      `SELECT hygiene, dress_code AS "dressCode", sweet, savoury, taste
       FROM judge_scores
       WHERE team_id = $1 AND lower(judge_name) = lower($2)`,
      [teamId, judgeName]
    );
    res.json(result.rows[0] ?? null);
  })
);

judgeRouter.post(
  "/judge/scores",
  asyncHandler(async (req, res) => {
    const parsed = judgeScoreSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Please give every category a score from 1 to 10." });
      return;
    }
    const { teamId, judgeName, hygiene, dressCode, sweet, savoury, taste } = parsed.data;

    const teamCheck = await query("SELECT id FROM teams WHERE id = $1", [teamId]);
    if (teamCheck.rowCount === 0) {
      res.status(404).json({ message: "That team no longer exists." });
      return;
    }

    await query(
      `INSERT INTO judge_scores(team_id, judge_name, hygiene, dress_code, sweet, savoury, taste)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (team_id, lower(judge_name)) DO UPDATE SET
         hygiene = EXCLUDED.hygiene,
         dress_code = EXCLUDED.dress_code,
         sweet = EXCLUDED.sweet,
         savoury = EXCLUDED.savoury,
         taste = EXCLUDED.taste,
         updated_at = now()`,
      [teamId, judgeName, hygiene, dressCode, sweet, savoury, taste]
    );

    await audit(req, "judge_score_submitted", 201, { teamId }, judgeName, judgeName);
    res.status(201).json({ message: "Score submitted." });
  })
);
