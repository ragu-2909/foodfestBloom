import { Pool, QueryResult, QueryResultRow } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: config.poolMax,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> => pool.query<T>(text, params);

export const isUniqueViolation = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: string }).code === "23505";

export const closePool = () => pool.end();

export const runMigrations = async () => {
  try {
    const tableCheck = await query<{exists: boolean}>(
      `SELECT EXISTS (
         SELECT FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename = 'settings'
       )`
    );

    if (!tableCheck.rows[0]?.exists) {
      console.log("Database tables do not exist. Running migrations...");
      const migrationFile = path.resolve(__dirname, "../db/migrations/001_init.sql");
      
      if (fs.existsSync(migrationFile)) {
        const sql = fs.readFileSync(migrationFile, "utf8");
        await query(sql);
        console.log("Database schema successfully initialized!");
      } else {
        const fallbackFile = path.resolve(process.cwd(), "apps/api/db/migrations/001_init.sql");
        if (fs.existsSync(fallbackFile)) {
          const sql = fs.readFileSync(fallbackFile, "utf8");
          await query(sql);
          console.log("Database schema successfully initialized from fallback path!");
        } else {
          throw new Error(`Migration SQL file not found. Paths checked:\n- ${migrationFile}\n- ${fallbackFile}`);
        }
      }
    } else {
      console.log("Database schema is already initialized.");
    }

    // Colors table and teams extensions check
    const colorsCheck = await query<{exists: boolean}>(
      `SELECT EXISTS (
         SELECT FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename = 'colors'
       )`
    );

    if (!colorsCheck.rows[0]?.exists) {
      console.log("Colors table does not exist. Running color reservation schema migrations...");
      await query(`
        CREATE TABLE IF NOT EXISTS colors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL UNIQUE,
          hex_code TEXT NOT NULL,
          capacity INTEGER NOT NULL DEFAULT 3,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS color_bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK (status IN ('reserved', 'booked')),
          reservation_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS color_bookings_team_unique_idx ON color_bookings(team_id);

        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selected_color_id UUID REFERENCES colors(id) ON DELETE SET NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selection_completed BOOLEAN DEFAULT false;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selection_completed_at TIMESTAMPTZ;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;

        -- Unique index for token checks
        CREATE UNIQUE INDEX IF NOT EXISTS teams_invitation_token_idx ON teams(invitation_token) WHERE invitation_token IS NOT NULL;

        -- Populate tokens for existing teams
        UPDATE teams SET invitation_token = gen_random_uuid()::text WHERE invitation_token IS NULL;

        -- Final palette for Taste of Bloom Season 3: 6 colors, 3 team slots each
        INSERT INTO colors (name, hex_code, capacity)
        VALUES
          ('Orange', '#F97316', 3),
          ('Yellow', '#FACC15', 3),
          ('Green', '#16A34A', 3),
          ('Maroon', '#7F1D1D', 3),
          ('White', '#FFFFFF', 3),
          ('Purple', '#7C3AED', 3)
        ON CONFLICT (name) DO NOTHING;
      `);

      console.log("Color reservation migrations applied successfully!");
    }

    // Migrate legacy single-slot colors schema (status / reserved_by_team_id /
    // booked_by_team_id, one team per color) to the capacity-based
    // color_bookings model (multiple teams per color, up to `capacity`), and
    // reseed the final 6-color / 3-slot-each palette confirmed for the event.
    const capacityCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM information_schema.columns
         WHERE table_name = 'colors' AND column_name = 'capacity'
       )`
    );

    if (!capacityCheck.rows[0]?.exists) {
      console.log("Migrating colors to capacity-based booking model...");
      await query(`
        CREATE TABLE IF NOT EXISTS color_bookings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          color_id UUID NOT NULL REFERENCES colors(id) ON DELETE CASCADE,
          team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK (status IN ('reserved', 'booked')),
          reservation_expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS color_bookings_team_unique_idx ON color_bookings(team_id);

        ALTER TABLE colors DROP CONSTRAINT IF EXISTS fk_colors_reserved_by;
        ALTER TABLE colors DROP CONSTRAINT IF EXISTS fk_colors_booked_by;
        ALTER TABLE colors ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 3;
        ALTER TABLE colors DROP COLUMN IF EXISTS status;
        ALTER TABLE colors DROP COLUMN IF EXISTS reserved_by_team_id;
        ALTER TABLE colors DROP COLUMN IF EXISTS booked_by_team_id;
        ALTER TABLE colors DROP COLUMN IF EXISTS reservation_expires_at;

        -- This is the final confirmed palette for the event: reset any
        -- selections made under the old scheme and reseed exactly these 6
        -- colors with 3 slots each.
        UPDATE teams SET selected_color_id = null, selection_completed = false, selection_completed_at = null;
        DELETE FROM colors;

        INSERT INTO colors (name, hex_code, capacity) VALUES
          ('Orange', '#F97316', 3),
          ('Yellow', '#FACC15', 3),
          ('Green', '#16A34A', 3),
          ('Maroon', '#7F1D1D', 3),
          ('White', '#FFFFFF', 3),
          ('Purple', '#7C3AED', 3);
      `);
      console.log("Colors migrated to final 6-color / 3-slot palette.");
    }

    // Add color selection settings (open flag + timed window)
    await query(`
      INSERT INTO settings (key, value)
      VALUES
        ('color_selection_open', 'false'),
        ('color_selection_start_time', 'null'),
        ('color_selection_end_time', 'null')
      ON CONFLICT (key) DO NOTHING;
    `);

    // Ensure every team gets an invitation token automatically, not just the
    // ones that existed at the time of the original backfill.
    await query(`
      ALTER TABLE teams ALTER COLUMN invitation_token SET DEFAULT gen_random_uuid()::text;
      UPDATE teams SET invitation_token = gen_random_uuid()::text WHERE invitation_token IS NULL;
    `);

    // Remove the sample placeholder teams shipped by the initial migration —
    // real participant data now comes from the event's Excel export.
    await query(`
      DELETE FROM teams
      WHERE name IN ('Team Alpha', 'Team Bravo', 'Team Charlie')
        AND created_by IS NULL
        AND selection_completed = false;
    `);

    // Update event_name to Taste of Bloom if it is still Food Fest Live
    await query(`
      UPDATE settings
      SET value = '"Taste of Bloom"'
      WHERE key = 'event_name' AND (value = '"Food Fest Live"' OR value = '""');
    `);

    // Judge voting: table numbers (for QR / manual lookup) and score records.
    await query(`
      ALTER TABLE teams ADD COLUMN IF NOT EXISTS table_number INTEGER;
      CREATE UNIQUE INDEX IF NOT EXISTS teams_table_number_idx ON teams(table_number) WHERE table_number IS NOT NULL;

      CREATE TABLE IF NOT EXISTS judge_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
        judge_name TEXT NOT NULL,
        hygiene SMALLINT NOT NULL CHECK (hygiene BETWEEN 1 AND 10),
        dress_code SMALLINT NOT NULL CHECK (dress_code BETWEEN 1 AND 10),
        sweet SMALLINT NOT NULL CHECK (sweet BETWEEN 1 AND 10),
        savoury SMALLINT NOT NULL CHECK (savoury BETWEEN 1 AND 10),
        taste SMALLINT NOT NULL CHECK (taste BETWEEN 1 AND 10),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IF NOT EXISTS judge_scores_team_judge_idx ON judge_scores(team_id, lower(judge_name));
    `);

    await query(`
      INSERT INTO settings (key, value)
      VALUES ('judge_passcode', '"2026"')
      ON CONFLICT (key) DO NOTHING;
    `);

  } catch (error) {
    console.error("Database migration check failed:", error);
    throw error;
  }
};
