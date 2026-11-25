import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

function unauthorized(res: Response): void {
  res.status(401).json({ error: "unauthorized" });
}

/**
 * Timing-safe comparison of two strings.
 * Returns false (not equal) when lengths differ — length is not secret here
 * because an attacker can distinguish length by HTTP status immediately anyway.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Validates:
 * 1. X-App-Key header matches APP_KEY env var (timing-safe).
 * 2. Authorization: Bearer <token> header is present and non-empty.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const appKey = process.env.APP_KEY ?? "";
  if (!appKey) {
    // Server misconfiguration — treat as locked down.
    unauthorized(res);
    return;
  }

  const receivedKey = (req.headers["x-app-key"] as string) ?? "";
  if (!receivedKey || !safeEqual(receivedKey, appKey)) {
    unauthorized(res);
    return;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    unauthorized(res);
    return;
  }

  next();
}
