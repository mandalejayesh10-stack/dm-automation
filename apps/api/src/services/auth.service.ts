import crypto from "node:crypto";
import { createRemoteJWKSet, SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

export const AUTH_COOKIE = "aisma_session";
export const OAUTH_STATE_COOKIE = "aisma_oauth_state";
export const OAUTH_VERIFIER_COOKIE = "aisma_oauth_verifier";
export const OAUTH_RETURN_TO_COOKIE = "aisma_oauth_return_to";

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
};

function parseJwtExpiry(expiry: string) {
  const match = /^(\d+)([smhd])$/.exec(expiry.trim());
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * (multipliers[unit] ?? multipliers.d);
}

export function createPkcePair() {
  const verifier = crypto.randomBytes(64).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  return { verifier, challenge, state };
}

export function buildGoogleAuthUrl(params: {
  state: string;
  challenge: string;
  returnTo: string;
}) {
  const callbackUrl = env.GOOGLE_CALLBACK_URL ?? `${env.API_URL}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env.GOOGLE_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "select_account");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("login_hint", "");
  return url.toString();
}

export function resolveSafeReturnTo(input: string | undefined) {
  const fallback = new URL("/dashboard", env.APP_URL).toString();
  if (!input) return fallback;

  try {
    const parsed = new URL(input, env.APP_URL);
    const appOrigin = new URL(env.APP_URL).origin;
    if (parsed.origin !== appOrigin) return fallback;
    return parsed.toString();
  } catch {
    return fallback;
  }
}

export async function exchangeGoogleCode(code: string, verifier: string) {
  const callbackUrl = env.GOOGLE_CALLBACK_URL ?? `${env.API_URL}/api/auth/google/callback`;
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID ?? "",
    client_secret: env.GOOGLE_CLIENT_SECRET ?? "",
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: callbackUrl
  });

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status}`);
  }

  return response.json() as Promise<{ id_token?: string; access_token?: string; refresh_token?: string }>;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: env.GOOGLE_CLIENT_ID
  });

  if (!payload.sub || !payload.email) {
    throw new Error("Google profile missing subject or email");
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email),
    name: payload.name ? String(payload.name) : null,
    picture: payload.picture ? String(payload.picture) : null
  };
}

export async function signSessionJwt(session: {
  userId: string;
  authProviderId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}) {
  const expiresIn = env.JWT_EXPIRY;
  return new SignJWT({
    uid: session.userId,
    email: session.email,
    name: session.name,
    imageUrl: session.imageUrl
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.authProviderId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(env.JWT_SECRET));
}

export async function verifySessionJwt(token: string) {
  return jwtVerify(token, new TextEncoder().encode(env.JWT_SECRET), {
    algorithms: ["HS256"]
  });
}

export function sessionCookieMaxAge() {
  return parseJwtExpiry(env.JWT_EXPIRY);
}
