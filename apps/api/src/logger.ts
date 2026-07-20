import { Request, Response } from "express";
import morgan from "morgan";
import { query } from "./db.js";

export const requestLogger = morgan("combined");

export const audit = async (
  req: Request,
  action: string,
  status: number,
  details: Record<string, unknown> = {},
  email?: string,
  performedBy?: string
) => {
  try {
    await query(
      `INSERT INTO audit_logs(action, performed_by, ip_address, email, endpoint, request_status, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        action,
        performedBy ?? req.user?.username ?? null,
        req.ip,
        email ?? null,
        req.originalUrl,
        status,
        details
      ]
    );
  } catch (error) {
    console.error("audit_log_failed", error);
  }
};

export const asyncHandler =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response) => {
    handler(req, res).catch((error) => {
      console.error("request_failed", error);
      res.status(500).json({ message: "Something went wrong. Please try again." });
    });
  };
