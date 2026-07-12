import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export const signAdminToken = () =>
  jwt.sign({ email: config.adminEmail, role: "admin" }, config.jwtSecret, {
    expiresIn: "8h"
  });

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const header = req.header("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ message: "Admin login required." });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { email: string; role: "admin" };
    req.user = { email: payload.email, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Session expired. Please log in again." });
  }
};
