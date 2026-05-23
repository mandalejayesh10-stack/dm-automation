import { Router, type Response } from "express";
import { prisma } from "../db.js";
import { ensureUserWorkspace } from "../services/onboarding.service.js";
import {
  AUTH_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
  OAUTH_STATE_COOKIE,
  OAUTH_VERIFIER_COOKIE,
  buildGoogleAuthUrl,
  createPkcePair,
  exchangeGoogleCode,
  resolveSafeReturnTo,
  sessionCookieMaxAge,
  signSessionJwt,
  verifyGoogleIdToken
} from "../services/auth.service.js";
import { requireAuth } from "../middleware/auth.js";
import { env } from "../config/env.js";

export const authRouter = Router();

function clearOauthCookies(res: Response) {
  return res
    .clearCookie(OAUTH_STATE_COOKIE, { path: "/" })
    .clearCookie(OAUTH_VERIFIER_COOKIE, { path: "/" })
    .clearCookie(OAUTH_RETURN_TO_COOKIE, { path: "/" });
}

function authCookieOptions() {
  const sameSite: "none" | "lax" = env.NODE_ENV === "production" ? "none" : "lax";
  return {
    httpOnly: true,
    sameSite,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionCookieMaxAge(),
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {})
  };
}

function authCookieClearOptions() {
  return {
    path: "/",
    ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {})
  };
}

authRouter.get("/google", (req, res) => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: "Google OAuth is not configured" });
  }

  const { verifier, challenge, state } = createPkcePair();
  const returnTo = resolveSafeReturnTo(typeof req.query.returnTo === "string" ? req.query.returnTo : undefined);

  res
    .cookie(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60 * 1000
    })
    .cookie(OAUTH_VERIFIER_COOKIE, verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60 * 1000
    })
    .cookie(OAUTH_RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60 * 1000
    })
    .redirect(buildGoogleAuthUrl({ state, challenge, returnTo }));
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return res.redirect(`${env.APP_URL}/sign-in?error=oauth_not_configured`);
    }

    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    const stateCookie = req.cookies?.[OAUTH_STATE_COOKIE];
    const verifier = req.cookies?.[OAUTH_VERIFIER_COOKIE];
    const returnToCookie = req.cookies?.[OAUTH_RETURN_TO_COOKIE];

    if (!code || !state || !stateCookie || !verifier || state !== stateCookie) {
      clearOauthCookies(res);
      return res.redirect(`${env.APP_URL}/sign-in?error=oauth_state`);
    }

    const tokenResponse = await exchangeGoogleCode(code, verifier);
    if (!tokenResponse.id_token) {
      clearOauthCookies(res);
      return res.redirect(`${env.APP_URL}/sign-in?error=oauth_token`);
    }

    const profile = await verifyGoogleIdToken(tokenResponse.id_token);
    const onboarding = await ensureUserWorkspace({
      authProvider: "google",
      authProviderId: profile.sub,
      email: profile.email,
      name: profile.name,
      imageUrl: profile.picture
    });

    await prisma.user.update({
      where: { id: onboarding.user.id },
      data: { lastLoginAt: new Date(), onboardingComplete: true }
    });

    const session = await signSessionJwt({
      userId: onboarding.user.id,
      authProviderId: onboarding.user.authProviderId,
      email: onboarding.user.email,
      name: onboarding.user.name,
      imageUrl: onboarding.user.imageUrl
    });

    clearOauthCookies(res);
    return res
      .cookie(AUTH_COOKIE, session, authCookieOptions())
      .redirect(returnToCookie ?? `${env.APP_URL}/dashboard`);
  } catch (error) {
    console.error(error);
    clearOauthCookies(res);
    return res.redirect(`${env.APP_URL}/sign-in?error=oauth_failed`);
  }
});

authRouter.get("/session", requireAuth, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });

  const brands = await prisma.brand.findMany({
    where: { ownerId: req.user.id },
    include: {
      socialAccounts: true,
      subscription: true,
      teamMembers: true
    },
    orderBy: { createdAt: "asc" }
  });

  res.json({
    user: req.user,
    brands,
    activeBrandId: brands[0]?.id ?? null
  });
});

authRouter.post("/logout", requireAuth, async (_req, res) => {
  res
    .clearCookie(AUTH_COOKIE, authCookieClearOptions())
    .clearCookie(OAUTH_STATE_COOKIE, { path: "/" })
    .clearCookie(OAUTH_VERIFIER_COOKIE, { path: "/" })
    .clearCookie(OAUTH_RETURN_TO_COOKIE, { path: "/" })
    .json({ ok: true });
});
