import crypto from "node:crypto";
import { env } from "../config/env.js";
import { prisma } from "../db.js";
import { encryptToken, decryptToken } from "../security/crypto.js";

const GRAPH_ROOT = `https://graph.facebook.com/${env.META_GRAPH_VERSION}`;
const AUTH_ROOT = `https://www.facebook.com/${env.META_GRAPH_VERSION}/dialog/oauth`;
const permissions = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "pages_read_engagement",
  "business_management"
];

type MetaLongLivedTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in?: number;
};

export type MetaPermission = {
  permission: string;
  status: "granted" | "declined" | "expired" | string;
};

export type MetaInstagramBusinessAccount = {
  id: string;
  username?: string | null;
  profile_picture_url?: string | null;
};

export type MetaPageConnection = {
  id: string;
  name: string;
  access_token: string;
  picture_url: string | null;
  token_expires_at: string | null;
  tasks: string[];
  instagram_business_account: MetaInstagramBusinessAccount | null;
};

export type MetaInstagramMedia = {
  id: string;
  media_type: string;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  comments_count: number | null;
  like_count: number | null;
  media_url?: string | null;
  children?: { data?: Array<Record<string, unknown>> } | null;
};

export type MetaFacebookVideo = {
  id: string;
  description: string | null;
  permalink_url: string | null;
  created_time: string | null;
  picture: string | null;
  length: number | null;
  views: number | null;
};

export type MetaOAuthBundle = {
  userToken: string;
  userTokenExpiresAt: string | null;
  permissions: string[];
  pages: MetaPageConnection[];
};

export const META_OAUTH_SESSION_COOKIE = "meta_oauth_state";

function parseExpiry(expiresIn?: number) {
  if (!expiresIn || Number.isNaN(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function metaRedirectUri() {
  return env.META_OAUTH_REDIRECT_URI ?? `${env.BACKEND_URL ?? env.BACKEND_INTERNAL_URL ?? env.API_URL}/api/meta/oauth/callback`;
}

async function graphGet(path: string, token: string) {
  const url = new URL(path.startsWith("http") ? path : `${GRAPH_ROOT}${path}`);
  if (!url.searchParams.get("access_token")) {
    url.searchParams.set("access_token", token);
  }
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Meta Graph GET failed for ${path}: ${response.status}`);
  }
  return response.json();
}

async function graphPost(path: string, token: string, body?: URLSearchParams) {
  const url = path.startsWith("http") ? new URL(path) : new URL(`${GRAPH_ROOT}${path}`);
  if (!url.searchParams.get("access_token")) {
    url.searchParams.set("access_token", token);
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!response.ok) {
    throw new Error(`Meta Graph POST failed for ${path}: ${response.status}`);
  }
  return response.json();
}

async function graphDelete(path: string, token: string) {
  const url = path.startsWith("http") ? new URL(path) : new URL(`${GRAPH_ROOT}${path}`);
  if (!url.searchParams.get("access_token")) {
    url.searchParams.set("access_token", token);
  }
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Meta Graph DELETE failed for ${path}: ${response.status}`);
  }
  return response.json();
}

export function buildMetaOAuthUrl(state: string) {
  const url = new URL(AUTH_ROOT);
  url.searchParams.set("client_id", env.META_APP_ID ?? "");
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("scope", permissions.join(","));
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

export function verifyMetaSignature(rawBody: Buffer, signature?: string) {
  if (!env.META_APP_SECRET || !signature?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", env.META_APP_SECRET).update(rawBody).digest("hex");
  const received = signature.slice(7);
  if (received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

export async function exchangeCodeForToken(code: string) {
  const url = new URL(`${GRAPH_ROOT}/oauth/access_token`);
  url.searchParams.set("client_id", env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", env.META_APP_SECRET ?? "");
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("code", code);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta token exchange failed: ${response.status}`);
  return response.json() as Promise<{ access_token: string; token_type: string; expires_in?: number }>;
}

export async function exchangeLongLivedToken(shortLivedToken: string) {
  const url = new URL(`${GRAPH_ROOT}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.META_APP_ID ?? "");
  url.searchParams.set("client_secret", env.META_APP_SECRET ?? "");
  url.searchParams.set("fb_exchange_token", shortLivedToken);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Meta long-lived token exchange failed: ${response.status}`);
  return response.json() as Promise<MetaLongLivedTokenResponse>;
}

export async function fetchMetaPermissions(accessToken: string) {
  const response = await graphGet(`/me/permissions`, accessToken);
  return (response.data ?? []) as MetaPermission[];
}

export async function fetchMetaPages(accessToken: string) {
  const response = await graphGet(
    `/me/accounts?fields=id,name,access_token,tasks,picture.type(large){url},instagram_business_account{id,username,profile_picture_url}`,
    accessToken
  );

  return ((response.data ?? []) as Array<Record<string, unknown>>).map((page) => ({
    id: String(page.id),
    name: String(page.name ?? ""),
    access_token: String(page.access_token ?? ""),
    picture_url: page.picture && typeof page.picture === "object" && "data" in (page.picture as Record<string, unknown>)
      ? String(((page.picture as { data?: { url?: string } }).data?.url) ?? "")
      : null,
    token_expires_at: parseExpiry(Number(page.expires_in ?? NaN)),
    tasks: Array.isArray(page.tasks) ? page.tasks.map((task) => String(task)) : [],
    instagram_business_account:
      page.instagram_business_account && typeof page.instagram_business_account === "object"
        ? {
            id: String((page.instagram_business_account as { id?: string }).id ?? ""),
            username: (page.instagram_business_account as { username?: string | null }).username ?? null,
            profile_picture_url:
              (page.instagram_business_account as { profile_picture_url?: string | null }).profile_picture_url ?? null
          }
        : null
  })) as MetaPageConnection[];
}

export async function fetchInstagramMedia(args: { accessToken: string; instagramBusinessId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(args.limit ?? 24, 50));
  const response = await graphGet(
    `/${args.instagramBusinessId}/media?fields=id,media_type,caption,permalink,thumbnail_url,timestamp,comments_count,like_count,media_url&limit=${limit}`,
    args.accessToken
  );

  return ((response.data ?? []) as Array<Record<string, unknown>>).map((media) => ({
    id: String(media.id),
    media_type: String(media.media_type ?? ""),
    caption: typeof media.caption === "string" ? media.caption : null,
    permalink: typeof media.permalink === "string" ? media.permalink : null,
    thumbnail_url:
      typeof media.thumbnail_url === "string"
        ? media.thumbnail_url
        : typeof media.media_url === "string"
          ? media.media_url
          : null,
    timestamp: typeof media.timestamp === "string" ? media.timestamp : null,
    comments_count: typeof media.comments_count === "number" ? media.comments_count : Number(media.comments_count ?? 0) || null,
    like_count: typeof media.like_count === "number" ? media.like_count : Number(media.like_count ?? 0) || null,
    media_url: typeof media.media_url === "string" ? media.media_url : null
  })) as MetaInstagramMedia[];
}

export async function fetchFacebookReels(args: { accessToken: string; pageId: string; limit?: number }) {
  const limit = Math.max(1, Math.min(args.limit ?? 24, 50));
  const response = await graphGet(
    `/${args.pageId}/videos?fields=id,description,permalink_url,created_time,picture,length,views&limit=${limit}`,
    args.accessToken
  );

  return ((response.data ?? []) as Array<Record<string, unknown>>).map((video) => {
    return {
      id: String(video.id),
      description: typeof video.description === "string" ? video.description : null,
      permalink_url: typeof video.permalink_url === "string" ? video.permalink_url : null,
      created_time: typeof video.created_time === "string" ? video.created_time : null,
      picture: typeof video.picture === "string" ? video.picture : null,
      length: typeof video.length === "number" ? video.length : Number(video.length ?? 0) || null,
      views: typeof video.views === "number" ? video.views : Number(video.views ?? 0) || null
    } satisfies MetaFacebookVideo;
  });
}

export async function subscribePageToWebhooks(pageId: string, pageAccessToken: string) {
  // Meta Page subscriptions do not accept "comments" here.
  // Comment events arrive through "feed", which our webhook parser already handles.
  const fields = ["feed", "messages", "messaging_postbacks"];
  try {
    const result = await graphPost(
      `/${pageId}/subscribed_apps`,
      pageAccessToken,
      new URLSearchParams({ subscribed_fields: fields.join(",") })
    );
    return { ok: true, result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Webhook subscription failed" };
  }
}

export async function revokeMetaToken(accessToken: string) {
  try {
    await graphDelete(`/me/permissions`, accessToken);
  } catch {
    // best effort
  }
}

export function encryptMetaBundle(bundle: MetaOAuthBundle) {
  return encryptToken(JSON.stringify(bundle));
}

export function decryptMetaBundle(payload: string) {
  return JSON.parse(decryptToken(payload)) as MetaOAuthBundle;
}

export async function saveMetaOAuthSession(args: {
  userId: string;
  state: string;
  bundle: MetaOAuthBundle;
}) {
  return prisma.metaOAuthSession.upsert({
    where: { state: args.state },
    update: {
      status: "ready",
      encryptedPayload: encryptMetaBundle(args.bundle),
      userId: args.userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    },
    create: {
      userId: args.userId,
      state: args.state,
      status: "ready",
      encryptedPayload: encryptMetaBundle(args.bundle),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });
}

export async function getMetaOAuthSession(userId: string) {
  const session = await prisma.metaOAuthSession.findFirst({
    where: {
      userId,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!session?.encryptedPayload) return null;
  return { ...session, bundle: decryptMetaBundle(session.encryptedPayload) };
}

export async function clearMetaOAuthSession(state: string) {
  await prisma.metaOAuthSession.deleteMany({ where: { state } });
}

export function sessionExpiryIso(expiresAt?: string | null) {
  return expiresAt ?? null;
}
