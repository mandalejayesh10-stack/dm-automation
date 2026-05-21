import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

const protectedRoutes = ["/dashboard", "/flow-builder", "/inbox", "/admin"];
const publicAuthRoutes = ["/", "/sign-in"];

async function verifySession(token?: string | null) {
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET), {
      algorithms: ["HS256"]
    });
    return payload;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySession(token);

  const isProtected = protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const isPublicAuth = publicAuthRoutes.includes(pathname);

  if (session && isPublicAuth) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (isProtected && !session) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"]
};
