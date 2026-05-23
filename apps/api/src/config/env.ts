import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { z } from "zod";

function resolveDatabaseUrl() {
  const direct = process.env.DATABASE_URL ?? process.env.RAILWAY_DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_CONNECTION_STRING ?? process.env.DATABASE_PUBLIC_URL;
  if (direct && direct.trim().length > 0) return direct.trim();

  const host = process.env.PGHOST ?? process.env.POSTGRES_HOST ?? process.env.RAILWAY_POSTGRES_HOST;
  const port = process.env.PGPORT ?? process.env.POSTGRES_PORT ?? process.env.RAILWAY_POSTGRES_PORT ?? "5432";
  const user = process.env.PGUSER ?? process.env.POSTGRES_USER ?? process.env.RAILWAY_POSTGRES_USER;
  const password = process.env.PGPASSWORD ?? process.env.POSTGRES_PASSWORD ?? process.env.RAILWAY_POSTGRES_PASSWORD;
  const database = process.env.PGDATABASE ?? process.env.POSTGRES_DB ?? process.env.RAILWAY_POSTGRES_DB;

  if (host && user && password && database) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }

  return "";
}

const repoRoot = path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const dotenvCandidates = [
  path.join(repoRoot, ".env"),
  path.join(repoRoot, "apps/api/.env"),
  path.join(repoRoot, "apps/api/.env.local")
];

for (const candidate of dotenvCandidates) {
  loadDotenv({ path: candidate, override: false });
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) {
  const resolvedDatabaseUrl = resolveDatabaseUrl();
  if (resolvedDatabaseUrl) {
    process.env.DATABASE_URL = resolvedDatabaseUrl;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default("http://localhost:3000"),
  API_URL: z.string().url().default("http://localhost:4000"),
  BACKEND_URL: z.string().url().optional(),
  BACKEND_INTERNAL_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  DISABLE_QUEUES: z.coerce.boolean().default(false),
  TOKEN_ENCRYPTION_KEY: z.string().min(16),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.string().default("7d"),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_ACCOUNT_ID: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v21.0"),
  META_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WEBHOOK_URL: z.string().url().optional(),
  META_OAUTH_REDIRECT_URI: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.2"),
  GEMINI_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional()
});

export const env = envSchema.parse(process.env);
