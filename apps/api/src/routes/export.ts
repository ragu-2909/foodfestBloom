import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../logger.js";
import { query } from "../db.js";

export const exportRouter = Router();

exportRouter.use("/export", requireAdmin);

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n");
};

exportRouter.get(
  "/export/color-selection-csv",
  asyncHandler(async (_req, res) => {
    const rows = await query(
      `SELECT
        t.name AS "teamName",
        t.members,
        t.category,
        c.name AS "selectedColor",
        CASE WHEN t.selection_completed THEN 'Booked' ELSE 'Pending' END AS status,
        t.invitation_token AS "invitationToken"
       FROM teams t
       LEFT JOIN colors c ON c.id = t.selected_color_id
       ORDER BY t.name ASC`
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=taste-of-bloom-color-selection.csv");
    res.send(toCsv(rows.rows));
  })
);

exportRouter.get(
  "/export/judge-scores-csv",
  asyncHandler(async (_req, res) => {
    const [summary, entries] = await Promise.all([
      query(
        `SELECT
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
          t.name AS "teamName", t.table_number AS "tableNumber", js.judge_name AS "judgeName",
          js.hygiene, js.dress_code AS "dressCode", js.sweet, js.savoury, js.taste,
          (js.hygiene + js.dress_code + js.sweet + js.savoury + js.taste) AS total,
          js.created_at AS "submittedAt"
         FROM judge_scores js
         JOIN teams t ON t.id = js.team_id
         ORDER BY t.name ASC, js.judge_name ASC`
      )
    ]);

    const csv = ["Team Summary (Averages)", toCsv(summary.rows), "", "All Judge Entries", toCsv(entries.rows)].join(
      "\n"
    );

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=taste-of-bloom-judge-scores.csv");
    res.send(csv);
  })
);
