# AI Social Media Automation Platform

Premium fullstack SaaS inspired by ManyChat, Metricool, Linear, and Notion. It supports multi-brand Instagram/Facebook automation, AI conversations, unified inbox, analytics, teams, billing, and Meta webhook processing.

## Apps

- `apps/web` - Next.js App Router frontend with Tailwind, Zustand, Framer Motion, GSAP-ready animation structure, React Flow builder, Clerk auth hooks, and PostHog/Sentry wiring points.
- `apps/api` - Express TypeScript backend with Meta OAuth/webhooks, queue processing, security middleware, Socket.io realtime, billing routes, and service boundaries.
- `packages/database` - Prisma schema for users, brands, social accounts, automations, leads, analytics, templates, subscriptions, notifications, conversations, messages, and teams.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis, or run `docker compose up -d`.
3. Install dependencies with `npm install`.
4. Generate Prisma client with `npm run db:generate`.
5. Run migrations with `npm run db:migrate`.
6. Start development with `npm run dev`.

## Meta Setup Flow

1. Create a Meta app at [developers.facebook.com](https://developers.facebook.com/).
2. Publish the app and use the provided privacy policy:
   `https://docs.google.com/document/d/1P-eZsTmspgMsrIouSxPgCG5JkM_lgn3yT9ru9AKcGNc/edit?usp=sharing`
3. Get the Business Account ID from [business.facebook.com](https://business.facebook.com/).
4. Deploy backend to Railway and set the public webhook URL in Meta.
5. Deploy frontend to Vercel and set production OAuth redirect URLs.

## Deployment

- Frontend: Vercel from `apps/web`.
- Backend: Railway from `apps/api`.
- Database: Railway PostgreSQL or Supabase.
- Redis: Railway Redis or Upstash Redis.

The platform is intentionally environment-driven. Do not commit real Meta, Clerk, Stripe, Razorpay, OpenAI, Gemini, Sentry, Resend, or PostHog keys.
