import { createApp } from "./app.js";
import { config } from "./config.js";
import { closePool, runMigrations } from "./db.js";
import { rebuildTally, startBroadcastLoop } from "./services/tally.js";

const app = createApp();

// Run database migrations on start if tables are missing
try {
  await runMigrations();
} catch (error) {
  console.error("Database migration failed on startup:", error);
}

await rebuildTally().catch((error) => {
  console.error("initial_tally_failed", error);
});

startBroadcastLoop();

const server = app.listen(config.port, () => {
  console.log(`FoodFest API listening on port ${config.port}`);
});

const shutdown = async () => {
  console.log("Shutting down API");
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
