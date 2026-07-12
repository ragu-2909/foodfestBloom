import { Router } from "express";
import { subscribe, unsubscribe } from "../services/tally.js";

export const eventsRouter = Router();

eventsRouter.get("/events/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  subscribe(res);

  req.on("close", () => {
    unsubscribe(res);
    res.end();
  });
});
