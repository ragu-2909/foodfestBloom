import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { asyncHandler } from "../logger.js";
import { getSetting } from "../services/settings.js";
import {
  validateInvitationToken,
  getColorsState,
  reserveColor,
  confirmColor,
  subscribeColors,
  unsubscribeColors
} from "../services/colors.js";

export const colorsRouter = Router();

// Validate unique invitation token
colorsRouter.get(
  "/colors/validate-token",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    const colorSelectionOpen = await getSetting<boolean>("color_selection_open", false);
    
    const team = await validateInvitationToken(token);
    if (!team) {
      res.status(400).json({ valid: false, message: "Invalid invitation. Please contact event organizers." });
      return;
    }

    res.json({
      valid: true,
      team,
      colorSelectionOpen
    });
  })
);

// Fetch all colors state
colorsRouter.get(
  "/colors/state",
  asyncHandler(async (_req, res) => {
    const colors = await getColorsState();
    res.json(colors);
  })
);

// Atomic reservation
colorsRouter.post(
  "/colors/reserve",
  asyncHandler(async (req, res) => {
    const { token, colorId } = req.body;
    
    const colorSelectionOpen = await getSetting<boolean>("color_selection_open", false);
    if (!colorSelectionOpen) {
      res.status(403).json({ message: "Color selection is not currently open." });
      return;
    }

    const team = await validateInvitationToken(token);
    if (!team) {
      res.status(400).json({ message: "Invalid invitation." });
      return;
    }

    if (team.selectionCompleted) {
      res.status(400).json({ message: "You have already completed your color selection." });
      return;
    }

    try {
      const reservation = await reserveColor(team.id, team.name, colorId);
      res.json({
        message: "Color reserved successfully.",
        expiresAt: reservation.expiresAt
      });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to reserve color." });
    }
  })
);

// Permanent confirmation
colorsRouter.post(
  "/colors/confirm",
  asyncHandler(async (req, res) => {
    const { token, colorId } = req.body;

    const colorSelectionOpen = await getSetting<boolean>("color_selection_open", false);
    if (!colorSelectionOpen) {
      res.status(403).json({ message: "Color selection is not currently open." });
      return;
    }

    const team = await validateInvitationToken(token);
    if (!team) {
      res.status(400).json({ message: "Invalid invitation." });
      return;
    }

    if (team.selectionCompleted) {
      res.status(400).json({ message: "You have already completed your color selection." });
      return;
    }

    try {
      await confirmColor(team.id, team.name, colorId);
      res.json({ message: "Color selection confirmed successfully." });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to confirm color selection." });
    }
  })
);

// Real-time SSE synchronization & presence endpoint
colorsRouter.get(
  "/colors/stream",
  asyncHandler(async (req, res) => {
    const token = String(req.query.token || "");
    let team = await validateInvitationToken(token);
    let isAdminConnection = false;

    if (!team) {
      try {
        const payload = jwt.verify(token, config.jwtSecret) as { email: string; role: string };
        if (payload.role === "admin") {
          isAdminConnection = true;
          team = { id: "admin", name: "Admin Dashboard" } as any;
        }
      } catch {
        // Not valid admin token
      }
    }

    if (!team) {
      res.status(400).write("event: error\ndata: Invalid invitation token\n\n");
      res.end();
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    await subscribeColors(res, { teamId: team.id, teamName: team.name });

    req.on("close", () => {
      unsubscribeColors(res);
      res.end();
    });
  })
);
