import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

type TokenPayload = { username: string; role: "admin" | "judge" };

export const signAdminToken = () =>
  jwt.sign({ username: config.adminUsername, role: "admin" }, config.jwtSecret, {
    expiresIn: "8h"
  });

export const signJudgeToken = (judgeName: string) =>
  jwt.sign({ username: judgeName, role: "judge" }, config.jwtSecret, {
    expiresIn: "18h"
  });

const verifyRole = (req: Request, res: Response, next: NextFunction, allowedRoles: TokenPayload["role"][]) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Login required." });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
    if (!allowedRoles.includes(payload.role)) {
      res.status(403).json({ message: "You don't have access to this." });
      return;
    }
    req.user = { username: payload.username, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Session expired. Please log in again." });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) =>
  verifyRole(req, res, next, ["admin"]);

/** Judges and admins (for testing) can both submit/view scores. */
export const requireJudge = (req: Request, res: Response, next: NextFunction) =>
  verifyRole(req, res, next, ["judge", "admin"]);
