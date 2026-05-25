import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth-constants";

function safeReturnTo(input: string | null) {
  if (!input) return "/dashboard";
  try {
    if (input.startsWith("/")) return input;
    const url = new URL(input);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/dashboard";
  }
}

export async function GET(req: NextRequest) {
  const session = req.nextUrl.searchParams.get("session");
  const returnTo = safeReturnTo(req.nextUrl.searchParams.get("returnTo"));

  if (!session) {
    return NextResponse.redirect(new URL("/sign-in?error=bridge_missing", req.url));
  }

  const response = NextResponse.redirect(new URL(returnTo, req.url));
  response.cookies.set(AUTH_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });

  return response;
}
