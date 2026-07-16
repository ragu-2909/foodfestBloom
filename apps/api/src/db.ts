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
          status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'booked')),
          reserved_by_team_id UUID,
          booked_by_team_id UUID,
          reservation_expires_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selected_color_id UUID REFERENCES colors(id) ON DELETE SET NULL;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selection_completed BOOLEAN DEFAULT false;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS selection_completed_at TIMESTAMPTZ;
        ALTER TABLE teams ADD COLUMN IF NOT EXISTS invitation_token TEXT UNIQUE;

        -- Unique index for token checks
        CREATE UNIQUE INDEX IF NOT EXISTS teams_invitation_token_idx ON teams(invitation_token) WHERE invitation_token IS NOT NULL;

        -- Populate tokens for existing teams
        UPDATE teams SET invitation_token = gen_random_uuid()::text WHERE invitation_token IS NULL;

        -- Insert default colors
        INSERT INTO colors (name, hex_code)
        VALUES
          ('Crimson Red', '#EF4444'),
          ('Emerald Green', '#10B981'),
          ('Royal Blue', '#3B82F6'),
          ('Amber Yellow', '#F59E0B'),
          ('Grape Purple', '#8B5CF6'),
          ('Hot Pink', '#EC4899'),
          ('Sunset Orange', '#F97316'),
          ('Teal Aqua', '#06B6D4'),
          ('Mint Green', '#34D399'),
          ('Indigo Violet', '#6366F1'),
          ('Slate Gray', '#64748B'),
          ('Rose Gold', '#FDA4AF')
        ON CONFLICT (name) DO NOTHING;
      `);

      // Add constraints
      try {
        await query(`
          ALTER TABLE colors ADD CONSTRAINT fk_colors_reserved_by FOREIGN KEY (reserved_by_team_id) REFERENCES teams(id) ON DELETE SET NULL;
          ALTER TABLE colors ADD CONSTRAINT fk_colors_booked_by FOREIGN KEY (booked_by_team_id) REFERENCES teams(id) ON DELETE SET NULL;
        `);
      } catch (err) {
        // Constraints might already exist
      }

      console.log("Color reservation migrations applied successfully!");
    }

    // Add color selection open configuration
    await query(`
      INSERT INTO settings (key, value)
      VALUES ('color_selection_open', 'false')
      ON CONFLICT (key) DO NOTHING;
    `);

  } catch (error) {
    console.error("Database migration check failed:", error);
    throw error;
  }
};
