# Deployment Guide

## Meta App

1. Create the app at `https://developers.facebook.com/`.
2. Add Instagram Messaging API, Messenger API, Graph API, and Webhooks.
3. Add required permissions:
   - `instagram_manage_messages`
   - `instagram_basic`
   - `pages_manage_metadata`
   - `pages_messaging`
   - `pages_read_engagement`
4. Publish the app after review approval.
5. Use the privacy policy URL:
   `https://docs.google.com/document/d/1P-eZsTmspgMsrIouSxPgCG5JkM_lgn3yT9ru9AKcGNc/edit?usp=sharing`
6. Get Business Account ID from `https://business.facebook.com/`.

## Railway Backend

1. Create Railway project.
2. Add PostgreSQL and Redis services.
3. Deploy from this repo with `railway.toml`.
4. Set all backend env vars from `.env.example`.
5. Configure Meta webhook URL:
   `https://your-railway-domain.up.railway.app/api/meta/webhook`

## Vercel Frontend

1. Create a Vercel project from the repo.
2. Set root/build settings to use `apps/web` via `vercel.json`.
3. Set frontend env vars:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_POSTHOG_KEY`
   - `NEXT_PUBLIC_POSTHOG_HOST`
   - `NEXT_PUBLIC_SENTRY_DSN`
4. Set production API URL in frontend runtime configuration as needed.

## Production Checklist

- Generate a strong `TOKEN_ENCRYPTION_KEY`.
- Configure Clerk Google OAuth and production callback URLs.
- Enable Sentry DSNs for frontend and backend.
- Configure Stripe products/prices and webhooks.
- Configure Razorpay plan IDs and webhook signature verification.
- Confirm Meta app review approval before public OAuth launch.
- Run Prisma migrations against production database.
