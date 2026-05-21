import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

export function issueCsrfToken(_req: Request, res: Response) {
  const token = crypto.randomBytes(32).toString("base64url");
  res.cookie("csrf_token", token, { httpOnly: true, sameSite: "lax", secure: env.NODE_ENV === "production" });
  res.json({ csrfToken: token });
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.path.startsWith("/api/meta/webhook") || req.path.startsWith("/api/billing/stripe/webhook")) return next();
  const cookieToken = req.cookies?.csrf_token;
  const headerToken = req.header("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) return res.status(403).json({ error: "Invalid CSRF token" });
  return next();
}
