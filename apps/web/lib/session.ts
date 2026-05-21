import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { AUTH_COOKIE } from "@/lib/auth-constants";

export type SessionClaims = {
  uid: string;
  email?: string;
  name?: string | null;
  imageUrl?: string | null;
  onboardingComplete?: boolean;
};

export async function getServerSessionClaims() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), {
      algorithms: ["HS256"]
    });

    return payload as SessionClaims & { sub: string };
  } catch {
    return null;
  }
}
