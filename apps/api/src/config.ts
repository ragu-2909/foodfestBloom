import dotenv from "dotenv";

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
  adminEmail: required("ADMIN_EMAIL", "admin@company.com"),
  adminPassword: required("ADMIN_PASSWORD", "change-this-password"),
  jwtSecret: required("JWT_SECRET", "change-this-long-random-secret"),
  publicApiUrl: process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
};
