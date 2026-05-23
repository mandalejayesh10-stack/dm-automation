import http from "node:http";
import express from "express";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import { Server } from "socket.io";
import { env } from "./config/env.js";
import { applySecurity } from "./middleware/security.js";
import { issueCsrfToken, requireCsrf } from "./middleware/csrf.js";
import { metaRouter, publicMetaWebhookRouter } from "./routes/meta.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { billingRouter } from "./routes/billing.routes.js";
import { appRouter } from "./routes/app.routes.js";
import { startAutomationWorker } from "./queues/automation.queue.js";
import { setRealtimeServer } from "./realtime.js";

if (env.SENTRY_DSN) {
  Sentry.init({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: env.APP_URL, credentials: true }
});

applySecurity(app);
app.use(cookieParser());
app.use(
  express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    }
  })
);

app.get("/health", (_req, res) => res.json({ ok: true, service: "aisma-api" }));
app.get("/", (_req, res) => res.status(200).json({ ok: true, service: "aisma-api", status: "running" }));
app.get("/api/csrf", issueCsrfToken);
app.use("/api/auth", authRouter);
app.use(requireCsrf);
app.use("/api", appRouter);
app.use("/api/meta", metaRouter);
app.use("/webhook", publicMetaWebhookRouter);
app.use("/api/billing", billingRouter);

io.on("connection", (socket) => {
  socket.emit("connected", { ok: true });
  socket.on("join:brand", (brandId: string) => socket.join(`brand:${brandId}`));
  socket.on("join:user", (userId: string) => socket.join(`user:${userId}`));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

startAutomationWorker();
setRealtimeServer(io);

server.listen(env.PORT, () => {
  console.info(`API listening on ${env.API_URL}`);
});
