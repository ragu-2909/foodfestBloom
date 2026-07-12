import { Router } from "express";
import PDFDocument from "pdfkit";
import { requireAdmin } from "../middleware/auth.js";
import { asyncHandler } from "../logger.js";
import { query } from "../db.js";

export const exportRouter = Router();

exportRouter.use("/export", requireAdmin);

const getReportRows = async () => {
  const registrations = await query(
    `SELECT email, employee_name AS "employeeName", team_name AS "teamName",
      food_category AS "foodCategory", contact_number AS "contactNumber",
      created_at AS "createdAt"
     FROM registrations
     ORDER BY created_at DESC`
  );

  const votes = await query(
    `SELECT v.email, t.name AS "teamName", v.created_at AS "createdAt"
     FROM votes v
     JOIN teams t ON t.id = v.team_id
     ORDER BY v.created_at DESC`
  );

  const leaderboard = await query(
    `SELECT t.name AS "teamName", COUNT(v.id)::int AS votes
     FROM teams t
     LEFT JOIN votes v ON v.team_id = t.id
     GROUP BY t.id
     ORDER BY votes DESC, t.name ASC`
  );

  return { registrations: registrations.rows, votes: votes.rows, leaderboard: leaderboard.rows };
};

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

const xmlEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const worksheetXml = (name: string, rows: Record<string, unknown>[]) => {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["empty"];
  const rowXml = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header]))
  ]
    .map(
      (row) =>
        `<Row>${row
          .map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`)
          .join("")}</Row>`
    )
    .join("");

  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table>${rowXml}</Table></Worksheet>`;
};

exportRouter.get(
  "/export/csv",
  asyncHandler(async (_req, res) => {
    const rows = await getReportRows();
    const csv = [
      "Registrations",
      toCsv(rows.registrations),
      "",
      "Votes",
      toCsv(rows.votes),
      "",
      "Leaderboard",
      toCsv(rows.leaderboard)
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=foodfest-report.csv");
    res.send(csv);
  })
);

exportRouter.get(
  "/export/excel",
  asyncHandler(async (_req, res) => {
    const rows = await getReportRows();
    const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${worksheetXml("registrations", rows.registrations)}
  ${worksheetXml("votes", rows.votes)}
  ${worksheetXml("leaderboard", rows.leaderboard)}
</Workbook>`;

    res.setHeader("Content-Type", "application/vnd.ms-excel");
    res.setHeader("Content-Disposition", "attachment; filename=foodfest-report.xls");
    res.send(workbook);
  })
);

exportRouter.get(
  "/export/pdf",
  asyncHandler(async (_req, res) => {
    const rows = await getReportRows();
    const doc = new PDFDocument({ margin: 40 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=foodfest-report.pdf");
    doc.pipe(res);

    doc.fontSize(20).text("FoodFest Event Report");
    doc.moveDown();
    doc.fontSize(14).text("Leaderboard");
    rows.leaderboard.forEach((row) => {
      doc.fontSize(11).text(`${row.teamName}: ${row.votes} votes`);
    });
    doc.moveDown();
    doc.fontSize(14).text("Summary");
    doc.fontSize(11).text(`Registrations: ${rows.registrations.length}`);
    doc.fontSize(11).text(`Votes: ${rows.votes.length}`);
    doc.fontSize(11).text(`Generated: ${new Date().toISOString()}`);

    doc.end();
  })
);
