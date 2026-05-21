import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE, verifySessionJwt } from "../services/auth.service.js";
import { prisma } from "../db.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.replace("Bearer ", "") : null;
    const token = bearer ?? req.cookies?.[AUTH_COOKIE];
    if (!token) {
      return res.status(401).json({ error: "Missing session" });
    }

    const { payload } = await verifySessionJwt(token);
    const authProviderId = String(payload.sub ?? "");
    if (!authProviderId) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const user = await prisma.user.findUnique({
      where: { authProviderId },
      include: {
        brands: {
          include: { socialAccounts: true, subscription: true },
          orderBy: { createdAt: "asc" }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    req.user = {
      id: user.id,
      authProviderId: user.authProviderId,
      email: user.email,
      name: user.name,
      imageUrl: user.imageUrl,
      onboardingComplete: user.onboardingComplete,
      brands: user.brands
    };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        authProviderId: string;
        email: string;
        name: string | null;
        imageUrl: string | null;
        onboardingComplete: boolean;
        brands?: Array<{
          id: string;
          name: string;
          slug: string;
          socialAccounts: unknown[];
          subscription: unknown;
        }>;
      };
    }
  }
}
