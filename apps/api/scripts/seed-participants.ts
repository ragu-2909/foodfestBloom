/**
 * One-time participant import from the Taste of Bloom Season 3 Excel export.
 * Run manually: `npm run seed:participants` (from apps/api).
 * Not invoked by the running server — teams no longer come from an in-app
 * upload flow, they come from this file.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as XLSX from "xlsx";
import { query, closePool } from "../src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHEET_PATH = path.resolve(__dirname, "../db/seed-data/taste-of-bloom-season3.xlsx");

const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const findValue = (row: Record<string, unknown>, candidates: string[]): string | undefined => {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const cleanCandidate = clean(candidate);
    for (const key of keys) {
      if (clean(key) === cleanCandidate) {
        const val = row[key];
        return val !== undefined && val !== null ? String(val).trim() : undefined;
      }
    }
  }
  return undefined;
};

/** Fallback for the long, punctuation-heavy survey-export headers: match by prefix. */
const findValueByPrefix = (row: Record<string, unknown>, prefix: string): string | undefined => {
  const cleanPrefix = clean(prefix);
  for (const key of Object.keys(row)) {
    if (clean(key).startsWith(cleanPrefix)) {
      const val = row[key];
      return val !== undefined && val !== null ? String(val).trim() : undefined;
    }
  }
  return undefined;
};

const upsertTeam = async (name: string, members: string, category: string, createdBy: string | null) => {
  await query(
    `INSERT INTO teams(name, description, members, category, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lower(name)) DO UPDATE SET
       members = EXCLUDED.members,
       category = EXCLUDED.category,
       updated_at = now()`,
    [name, `Team ${name}`, members, category, createdBy]
  );
};

const importFromSheet = async () => {
  const workbook = XLSX.read(fs.readFileSync(SHEET_PATH));
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  let imported = 0;
  for (const row of rows) {
    const teamName = findValue(row, ["teamname", "team"]);
    if (!teamName) continue;

    const leader = findValueByPrefix(row, "leader of the team") ?? findValue(row, ["leader", "name"]);
    const p1 = findValueByPrefix(row, "participant 1") ?? findValue(row, ["participant1"]);
    const p2 = findValueByPrefix(row, "participant 2") ?? findValue(row, ["participant2"]);

    const members = [leader, p1, p2].filter(Boolean).join(", ");
    await upsertTeam(teamName, members, "General", "seed:excel");
    imported += 1;
  }

  console.log(`Imported ${imported} teams from ${SHEET_PATH}`);
};

const seedDemoTeams = async () => {
  const demoTeams = [
    { name: "Demo Team Alpha", members: "Demo Lead A, Demo Member A2" },
    { name: "Demo Team Bravo", members: "Demo Lead B, Demo Member B2" },
    { name: "Demo Team Charlie", members: "Demo Lead C, Demo Member C2" }
  ];

  for (const team of demoTeams) {
    await upsertTeam(team.name, team.members, "Demo", "seed:demo");
  }
  console.log(`Seeded ${demoTeams.length} demo teams for rehearsing the color-selection flow.`);
};

const cleanupPlaceholderTeams = async () => {
  const result = await query(
    `DELETE FROM teams
     WHERE name IN ('Team Alpha', 'Team Bravo', 'Team Charlie')
       AND created_by IS NULL
       AND selection_completed = false
     RETURNING name`
  );
  if (result.rowCount) {
    console.log(`Removed ${result.rowCount} leftover placeholder team(s).`);
  }
};

const main = async () => {
  await importFromSheet();
  await seedDemoTeams();
  await cleanupPlaceholderTeams();
};

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
