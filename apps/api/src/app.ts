import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config.js";
import { requestLogger } from "./logger.js";
import { publicRouter } from "./routes/public.js";
import { adminRouter } from "./routes/admin.js";
import { eventsRouter } from "./routes/events.js";
import { exportRouter } from "./routes/export.js";
import { colorsRouter } from "./routes/colors.js";

const getAllowedOrigins = () => {
  const configured = (config.corsOrigins ?? config.frontendOrigin)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (config.nodeEnv === "production") {
    return configured;
  }

  return [
    ...configured,
    "https://foodfest-bloom-web-vttq.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173"
    
  ];
};

export const createApp = () => {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        if (config.nodeEnv !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
          callback(null, true);
          return;
        }

        console.warn(`Blocked CORS origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use(publicRouter);
  app.use(eventsRouter);
  app.use(adminRouter);
  app.use(exportRouter);
  app.use(colorsRouter);

  app.use((_req, res) => {
    res.status(404).json({ message: "Route not found." });
  });

  return app;
};
