import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The single .env lives at the repo root, but this workspace package is
// often run with its own directory as cwd (e.g. `npm run dev --workspace
// apps/api`), which makes dotenv's default cwd-relative lookup miss it.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const required = (key: string, fallback?: string) => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  appVersion: process.env.APP_VERSION ?? "0.1.0",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "https://foodfest-bloom-web-qfuh.vercel.app",
  corsOrigins: process.env.CORS_ORIGINS,
  databaseUrl: required("DATABASE_URL", "postgres://foodfest:foodfest@localhost:5432/foodfest"),
  poolMax: Number(process.env.PG_POOL_MAX ?? 12),
  adminUsername: required("ADMIN_USERNAME", "admin"),
  adminPassword: required("ADMIN_PASSWORD", "change-this-password"),
  jwtSecret: required("JWT_SECRET", "change-this-long-random-secret"),
  publicApiUrl: process.env.PUBLIC_API_URL ?? `https://foodfest-bloom-web-qfuh.vercel.app:${process.env.PORT ?? 3000}`
};
