import compression from "compression";
import cors from "cors";
import type { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "../config/env.js";

export function applySecurity(app: Express) {
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.APP_URL,
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 180,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
}
