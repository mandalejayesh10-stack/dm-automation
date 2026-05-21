import { Router, type Request } from "express";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "../db.js";
import { requireCsrf } from "../middleware/csrf.js";
import { AUTH_COOKIE, verifySessionJwt } from "../services/auth.service.js";
import { encryptToken, decryptToken } from "../security/crypto.js";
import { env } from "../config/env.js";
import {
  buildMetaOAuthUrl,
  decryptMetaBundle,
  exchangeCodeForToken,
  exchangeLongLivedToken,
  fetchMetaPages,
  fetchMetaPermissions,
  getMetaOAuthSession,
  revokeMetaToken,
  encryptMetaBundle,
  subscribePageToWebhooks,
  verifyMetaSignature,
  META_OAUTH_SESSION_COOKIE,
  type MetaOAuthBundle,
  type MetaPageConnection
} from "../services/meta.service.js";
import { enqueueWebhookEvent } from "../queues/automation.queue.js";

export const metaRouter = Router();

type AuthedUser = {
  id: string;
  authProviderId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  onboardingComplete: boolean;
};

async function resolveAuthedUser(req: Request): Promise<AuthedUser | null> {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) return null;

  try {
    const { payload } = await verifySessionJwt(token);
    const authProviderId = String(payload.sub ?? "");
    if (!authProviderId) return null;

    const user = await prisma.user.findUnique({
      where: { authProviderId },
      select: {
        id: true,
        authProviderId: true,
        email: true,
        name: true,
        imageUrl: true,
        onboardingComplete: true
      }
    });

    return user ? (user as AuthedUser) : null;
  } catch {
    return null;
  }
}

async function resolveOwnedBrand(userId: string, brandId?: string) {
  const brands = await prisma.brand.findMany({
    where: {
      OR: [{ ownerId: userId }, { teamMembers: { some: { userId } } }]
    },
    orderBy: { createdAt: "asc" }
  });

  if (!brands.length) {
    return null;
  }

  if (brandId) {
    return brands.find((brand) => brand.id === brandId) ?? brands[0] ?? null;
  }

  return brands[0] ?? null;
}

async function resolveMetaOAuthContext(state: string) {
  const session = await prisma.metaOAuthSession.findUnique({
    where: { state }
  });

  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      authProviderId: true,
      email: true,
      name: true,
      imageUrl: true,
      onboardingComplete: true
    }
  });

  return user ? { session, user: user as AuthedUser } : null;
}

function metaStateCookie(state: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 15 * 60 * 1000
  };
}

function renderPopupHtml(message: string, redirectTo?: string) {
  const origin = new URL(env.APP_URL).origin;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Meta connection</title>
  <style>
    body{margin:0;background:#0b0b0b;color:#fff;font-family:Inter,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh}
    .card{max-width:520px;padding:32px;border:1px solid rgba(255,255,255,.12);border-radius:16px;background:rgba(255,255,255,.05)}
    .muted{color:rgba(255,255,255,.68)}
  </style>
</head>
<body>
  <div class="card">
    <h1 style="margin:0 0 12px;font-size:24px">Meta account connected</h1>
    <p class="muted" style="line-height:1.6">${message}</p>
    <p class="muted" style="margin-top:16px">You can close this window now.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'meta:oauth-complete', redirectTo: ${JSON.stringify(redirectTo ?? `${env.APP_URL}/dashboard/accounts?meta=ready`)} }, ${JSON.stringify(origin)});
      }
    } finally {
      window.close();
      setTimeout(() => { window.location.href = ${JSON.stringify(redirectTo ?? `${env.APP_URL}/dashboard/accounts?meta=ready`)}; }, 300);
    }
  </script>
</body>
</html>`;
}

async function persistMetaConnections(args: {
  userId: string;
  brandId: string;
  bundle: MetaOAuthBundle;
  selectedPageIds: string[];
}, tx: Prisma.TransactionClient) {
  const selectedPages = args.bundle.pages.filter((page) => args.selectedPageIds.includes(page.id));
  const savedAccounts: Array<Record<string, unknown>> = [];

  for (const page of selectedPages) {
    const webhook = await subscribePageToWebhooks(page.id, page.access_token);
    console.info("[meta/oauth/persist] page subscription result", {
      userId: args.userId,
      brandId: args.brandId,
      pageId: page.id,
      pageName: page.name,
      ok: webhook.ok,
      error: webhook.ok ? null : webhook.error
    });
    const tokenExpiresAt = args.bundle.userTokenExpiresAt ? new Date(args.bundle.userTokenExpiresAt) : null;
    const sharedData = {
      brandId: args.brandId,
      externalId: page.id,
      accountName: page.name,
      username: page.name,
      profilePictureUrl: page.picture_url,
      pageId: page.id,
      encryptedAccessToken: encryptToken(page.access_token),
      tokenExpiresAt,
      permissions: args.bundle.permissions,
      webhookStatus: webhook.ok ? "active" : "needs_attention",
      isActive: true
    };

    const facebook = await tx.socialAccount.upsert({
      where: { provider_externalId: { provider: "FACEBOOK", externalId: page.id } },
      update: sharedData,
      create: {
        ...sharedData,
        provider: "FACEBOOK"
      }
    });
    savedAccounts.push(facebook);

    if (page.instagram_business_account?.id) {
      const instagram = await tx.socialAccount.upsert({
        where: { provider_externalId: { provider: "INSTAGRAM", externalId: page.instagram_business_account.id } },
        update: {
          ...sharedData,
          externalId: page.instagram_business_account.id,
          provider: "INSTAGRAM",
          accountName: page.instagram_business_account.username ?? page.name,
          username: page.instagram_business_account.username ?? page.name,
          profilePictureUrl: page.instagram_business_account.profile_picture_url ?? page.picture_url,
          instagramBusinessId: page.instagram_business_account.id
        },
        create: {
          ...sharedData,
          provider: "INSTAGRAM",
          externalId: page.instagram_business_account.id,
          accountName: page.instagram_business_account.username ?? page.name,
          username: page.instagram_business_account.username ?? page.name,
          profilePictureUrl: page.instagram_business_account.profile_picture_url ?? page.picture_url,
          instagramBusinessId: page.instagram_business_account.id
        }
      });
      savedAccounts.push(instagram);
    }
  }

  await tx.notification.create({
    data: {
      userId: args.userId,
      title: "Meta accounts connected",
      body: `${selectedPages.length} Facebook Pages and Instagram accounts are now live.`
    }
  });

  return savedAccounts;
}

metaRouter.get("/oauth/start", async (req, res) => {
  const user = await resolveAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  if (!env.META_APP_ID || !env.META_APP_SECRET) {
    return res.status(503).json({ error: "Meta OAuth is not configured: missing META_APP_ID or META_APP_SECRET" });
  }
  if (!env.API_URL && !env.BACKEND_INTERNAL_URL) {
    return res.status(503).json({ error: "Meta OAuth is not configured: missing API_URL or BACKEND_INTERNAL_URL" });
  }

  const requestedBrandId = typeof req.query.brandId === "string" ? req.query.brandId : undefined;
  const brand = await resolveOwnedBrand(user.id, requestedBrandId);
  if (!brand) return res.status(404).json({ error: "No workspace found" });

  const state = crypto.randomBytes(24).toString("base64url");
  res.cookie(META_OAUTH_SESSION_COOKIE, state, metaStateCookie(state));
  await prisma.metaOAuthSession.create({
    data: {
      userId: user.id,
      brandId: brand.id,
      state,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  res.json({ authUrl: buildMetaOAuthUrl(state) });
});

metaRouter.get("/oauth/callback", async (req, res) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const state = typeof req.query.state === "string" ? req.query.state : null;
    if (!code || !state) {
      return res.status(400).send(renderPopupHtml("The Meta connection could not be validated. Please try again."));
    }

    const oauthContext = await resolveMetaOAuthContext(state);
    if (!oauthContext) {
      console.error("[meta/oauth/callback] Missing oauth context for state", { state });
      return res.status(401).send(renderPopupHtml("Your session expired before Meta finished connecting. Please try again.", `${env.APP_URL}/dashboard/accounts`));
    }

    const { user, session } = oauthContext;

    console.info("[meta/oauth/callback] authenticated context", {
      userId: user.id,
      brandId: session.brandId,
      state
    });

    if (!env.META_APP_ID || !env.META_APP_SECRET) {
      return res.status(503).send(renderPopupHtml("Meta OAuth is not configured in this environment. Missing META_APP_ID or META_APP_SECRET."));
    }

    const shortToken = await exchangeCodeForToken(code);
    const longToken = await exchangeLongLivedToken(shortToken.access_token);
    const permissions = await fetchMetaPermissions(longToken.access_token);
    const pages = await fetchMetaPages(longToken.access_token);
    console.info("[meta/oauth/callback] /me/accounts returned", {
      userId: user.id,
      brandId: session.brandId,
      pageCount: pages.length,
      pages: pages.map((page) => ({
        id: page.id,
        name: page.name,
        instagramBusinessId: page.instagram_business_account?.id ?? null
      }))
    });
    if (!pages.length) {
      console.error("[meta/oauth/callback] No Facebook Pages returned from /me/accounts", {
        userId: user.id,
        permissions: permissions.filter((item) => item.status === "granted").map((item) => item.permission)
      });
      return res.status(500).send(renderPopupHtml("Meta did not return any Facebook Pages for this account. Check Page permissions and Business connection."));
    }
    const bundle: MetaOAuthBundle = {
      userToken: longToken.access_token,
      userTokenExpiresAt: longToken.expires_in ? new Date(Date.now() + longToken.expires_in * 1000).toISOString() : null,
      permissions: permissions.filter((item) => item.status === "granted").map((item) => item.permission),
      pages
    };

    const brand = session.brandId ? await resolveOwnedBrand(user.id, session.brandId) : await resolveOwnedBrand(user.id);
    if (!brand) {
      return res.status(404).send(renderPopupHtml("No workspace found for this account. Please create a brand first."));
    }

    await prisma.$transaction(async (tx) => {
      await tx.metaOAuthSession.upsert({
        where: { state },
        update: {
          status: "ready",
          brandId: brand.id,
          encryptedPayload: encryptMetaBundle(bundle),
          userId: user.id,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        },
        create: {
          userId: user.id,
          brandId: brand.id,
          state,
          status: "ready",
          encryptedPayload: encryptMetaBundle(bundle),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000)
        }
      });

      await persistMetaConnections({ userId: user.id, brandId: brand.id, bundle, selectedPageIds: pages.map((page) => page.id) }, tx);
    });

    const savedRows = await prisma.socialAccount.findMany({
      where: { brandId: brand.id },
      orderBy: { createdAt: "desc" }
    });

    console.info("[meta/oauth/callback] saved social rows", {
      userId: user.id,
      brandId: brand.id,
      savedCount: savedRows.length,
      rows: savedRows.map((row) => ({
        id: row.id,
        provider: row.provider,
        externalId: row.externalId,
        username: row.username,
        pageId: row.pageId,
        instagramBusinessId: row.instagramBusinessId,
        isActive: row.isActive
      }))
    });

    res.cookie(META_OAUTH_SESSION_COOKIE, state, metaStateCookie(state));
    return res.status(200).send(renderPopupHtml("Your Meta Pages and Instagram business accounts are now connected.", `${env.APP_URL}/dashboard/accounts?meta=ready`));
  } catch (error) {
    console.error(error);
    return res.status(500).send(renderPopupHtml("Meta connection failed. Please try again."));
  }
});

metaRouter.get("/oauth/session", async (req, res) => {
  const user = await resolveAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const session = await getMetaOAuthSession(user.id);
  if (!session) {
    return res.json({ status: "empty", pages: [], permissions: [], expiresAt: null });
  }

  return res.json({
    status: session.status,
    brandId: session.brandId ?? null,
    pages: session.bundle.pages,
    permissions: session.bundle.permissions,
    expiresAt: session.bundle.userTokenExpiresAt
  });
});

metaRouter.post("/oauth/complete", requireCsrf, async (req, res) => {
  try {
    const user = await resolveAuthedUser(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    const state = req.cookies?.[META_OAUTH_SESSION_COOKIE];
    if (!state) return res.status(400).json({ error: "Missing Meta session" });

    const session = await prisma.metaOAuthSession.findUnique({ where: { state } });
    if (!session?.encryptedPayload) return res.status(404).json({ error: "Meta draft session not found" });

    const bundle = decryptMetaBundle(session.encryptedPayload);
    const selectedPageIds = Array.isArray(req.body?.selectedPageIds) ? req.body.selectedPageIds.map((value: unknown) => String(value)) : [];
    const brandId = String(req.body?.brandId ?? "");
    const brand = await resolveOwnedBrand(user.id, brandId || session.brandId || undefined);
    if (!brand) return res.status(404).json({ error: "No workspace found" });

    if (!selectedPageIds.length) {
      return res.status(400).json({ error: "Select at least one Page or Instagram account" });
    }

    const saved = await prisma.$transaction(async (tx) => {
      const result = await persistMetaConnections({ userId: user.id, brandId: brand.id, bundle, selectedPageIds }, tx);
      await tx.metaOAuthSession.deleteMany({ where: { state } });
      return result;
    });

    res.clearCookie(META_OAUTH_SESSION_COOKIE, { path: "/" });

    return res.json({
      ok: true,
      connected: saved.length,
      brandId: brand.id
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Meta connection failed";
    return res.status(500).json({ error: message });
  }
});

metaRouter.post("/accounts/:accountId/disconnect", requireCsrf, async (req, res) => {
  const user = await resolveAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: String(req.params.accountId),
      brand: { OR: [{ ownerId: user.id }, { teamMembers: { some: { userId: user.id } } }] }
    }
  });

  if (!account) return res.status(404).json({ error: "Account not found" });

  try {
    await revokeMetaToken(decryptToken(account.encryptedAccessToken));
  } catch {
    // best effort
  }

  await prisma.socialAccount.update({
    where: { id: account.id },
    data: { isActive: false, webhookStatus: "disconnected" }
  });

  return res.json({ ok: true });
});

metaRouter.post("/accounts/:accountId/reconnect", requireCsrf, async (req, res) => {
  const user = await resolveAuthedUser(req);
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: String(req.params.accountId),
      brand: { OR: [{ ownerId: user.id }, { teamMembers: { some: { userId: user.id } } }] }
    }
  });

  if (!account) return res.status(404).json({ error: "Account not found" });

  const state = crypto.randomBytes(24).toString("base64url");
  res.cookie(META_OAUTH_SESSION_COOKIE, state, metaStateCookie(state));
  await prisma.metaOAuthSession.create({
    data: {
      userId: user.id,
      state,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  return res.json({ authUrl: buildMetaOAuthUrl(state) });
});

metaRouter.post("/webhook", async (req, res, next) => {
  try {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = req.header("x-hub-signature-256") ?? undefined;
    if (!rawBody || !signature || !verifyMetaSignature(rawBody, signature)) {
      return res.sendStatus(403);
    }

    if (!env.META_APP_SECRET) {
      return res.sendStatus(503);
    }

    const expected = crypto.createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");
    const received = signature.replace("sha256=", "");
    if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) {
      return res.sendStatus(403);
    }

    const body = req.body;
    const entries = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      const pageId = String(entry.id ?? "");
      const account = await prisma.socialAccount.findFirst({
        where: {
          OR: [
            { provider: "FACEBOOK", pageId },
            { provider: "FACEBOOK", externalId: pageId },
            { provider: "INSTAGRAM", instagramBusinessId: pageId }
          ]
        }
      });

      if (!account) continue;

      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const field = String(change.field ?? "");
        const payload = change.value ?? change;
        const eventType = field.includes("message") ? "dm" : field.includes("comments") || field.includes("feed") ? "comment" : "comment";
        await enqueueWebhookEvent({
          brandId: account.brandId,
          provider: field.includes("instagram") ? "instagram" : "facebook",
          eventType,
          payload,
          socialAccountId: account.id,
          externalId: String(change.id ?? change.value?.id ?? pageId),
          signature
        });
      }

      const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];
      for (const message of messaging) {
        await enqueueWebhookEvent({
          brandId: account.brandId,
          provider: "facebook",
          eventType: "messenger",
          externalConversationId: String(message.sender?.id ?? message.recipient?.id ?? message.mid ?? pageId),
          payload: message,
          socialAccountId: account.id,
          externalId: String(message.mid ?? message.message_id ?? pageId),
          signature
        });
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

metaRouter.get("/webhook", (req, res) => {
  const mode = typeof req.query["hub.mode"] === "string" ? req.query["hub.mode"] : null;
  const token = typeof req.query["hub.verify_token"] === "string" ? req.query["hub.verify_token"] : null;
  const challenge = typeof req.query["hub.challenge"] === "string" ? req.query["hub.challenge"] : null;

  if (mode === "subscribe" && token && env.META_VERIFY_TOKEN && token === env.META_VERIFY_TOKEN && challenge) {
    return res.status(200).send(challenge);
  }

  if (!mode && !token && !challenge) {
    return res.status(200).send("Meta webhook endpoint is ready");
  }

  return res.sendStatus(403);
});
