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
    const tableCheck = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT FROM pg_tables 
         WHERE schemaname = 'public' 
         AND tablename = 'settings'
       )`
    );

    if (!tableCheck.rows[0]?.exists) {
      console.log("Database tables do not exist. Running migrations...");
      // Try resolving migration file relative to this file
      const migrationFile = path.resolve(__dirname, "../db/migrations/001_init.sql");
      
      if (fs.existsSync(migrationFile)) {
        const sql = fs.readFileSync(migrationFile, "utf8");
        await query(sql);
        console.log("Database schema successfully initialized!");
      } else {
        // Fallback to checking root-relative path if we are in dist/
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
  } catch (error) {
    console.error("Database migration check failed:", error);
    throw error;
  }
};
