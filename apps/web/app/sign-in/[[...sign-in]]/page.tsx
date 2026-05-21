import { redirect } from "next/navigation";
import { GoogleLoginButton } from "@/components/auth/google-login-button";
import { getServerSessionClaims } from "@/lib/session";

export default async function SignInPage() {
  const session = await getServerSessionClaims();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-4 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-sm font-semibold text-signal">Welcome back</p>
          <h1 className="mt-2 text-3xl font-black">Continue with Google</h1>
          <p className="mt-2 text-sm text-white/55">Use your Google account to access the dashboard.</p>
        </div>
        <div className="glass rounded-md p-6">
          <GoogleLoginButton label="Continue with Google" returnTo="/dashboard" />
          <p className="mt-4 text-xs leading-6 text-white/45">You’ll be redirected to Google OAuth, then back into your workspace after the backend creates your account and default brand.</p>
        </div>
      </div>
    </main>
  );
}
