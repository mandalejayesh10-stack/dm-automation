"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Bot, Clapperboard, CreditCard, Home, Inbox, KeyRound, LayoutTemplate, Menu, Network, Settings, Users, Workflow, X } from "lucide-react";
import { BrandSwitcher } from "@/components/brand-switcher";
import { getAuthBackendUrl } from "@/lib/backend";
import { getCsrfToken } from "@/lib/csrf";
import { useAppStore } from "@/lib/store";
import { useAccounts } from "@/src/hooks/use-api";

const nav = [
  ["Dashboard", Home, "/dashboard"],
  ["Automations", Bot, "/dashboard/automations"],
  ["Reels", Clapperboard, "/dashboard/reels"],
  ["Flow Builder", Workflow, "/flow-builder"],
  ["Inbox", Inbox, "/inbox"],
  ["Analytics", BarChart3, "/dashboard/analytics"],
  ["Leads", Users, "/dashboard/leads"],
  ["Templates", LayoutTemplate, "/dashboard/templates"],
  ["Accounts", Network, "/dashboard/accounts"],
  ["API Settings", KeyRound, "/dashboard/api"],
  ["Billing", CreditCard, "/dashboard/billing"],
  ["Settings", Settings, "/dashboard/settings"]
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);
  const authLoading = useAppStore((state) => state.authLoading);
  const authUser = useAppStore((state) => state.authUser);
  const accounts = useAccounts();
  const pathname = usePathname();
  const connectedCount = accounts.data?.filter((account) => account.isActive).length ?? 0;

  const handleLogout = async () => {
    const csrfToken = await getCsrfToken();
    await fetch(`${getAuthBackendUrl()}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "x-csrf-token": csrfToken }
    });
    window.location.href = "/";
  };

  const sidebar = (
    <aside className="h-full w-72 border-r border-white/10 bg-black/90 p-4 lg:bg-black/45">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-signal font-black text-black">AI</span>
        <span className="font-semibold">Social Automations</span>
      </Link>
      <nav className="space-y-1">
        {nav.map(([label, Icon, href]) => (
          <Link
            key={label}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
              pathname === href ? "bg-signal/15 text-signal" : "text-white/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );

  const initials = (authUser?.name ?? authUser?.email ?? "A")
    .split(" ")
    .map((value) => value[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <main className="flex min-h-screen bg-ink">
      <div className="hidden lg:block">{sidebar}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/60" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}
      <section className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-ink/85 px-4 py-3 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button className="rounded-md border border-white/10 p-2 text-white/75 lg:hidden" aria-label="Toggle sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <BrandSwitcher />
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden min-w-48 rounded-md border border-white/10 bg-white/7 px-3 py-2 text-sm text-white/45 md:block">Search conversations, leads, automations</div>
            <span className="hidden rounded-full border border-signal/25 bg-signal/10 px-3 py-1 text-xs font-semibold text-signal md:inline-flex">
              {connectedCount} accounts connected
            </span>
            <button className="hidden rounded-md bg-signal px-4 py-2 text-sm font-bold text-black hover:bg-white md:inline-flex">Upgrade plan</button>
            <button className="rounded-md border border-white/10 p-2 text-white/75 hover:bg-white/8" aria-label="Notifications">
              <Bell className="h-4 w-4" />
            </button>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md border border-white/10 bg-white/7 px-2 py-1.5 text-left outline-none transition hover:border-signal/35">
                {authUser?.imageUrl ? (
                  <img src={authUser.imageUrl} alt={authUser.name ?? authUser.email} className="h-8 w-8 rounded-md object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-signal to-pulse text-xs font-black text-black">{initials}</div>
                )}
                <div className="hidden min-w-0 flex-col md:flex">
                  <span className="truncate text-xs font-semibold text-white">{authUser?.name ?? "Account"}</span>
                  <span className="truncate text-[11px] text-white/45">{authUser?.email ?? "Signed in"}</span>
                </div>
              </summary>
              <div className="absolute right-0 mt-2 w-64 rounded-md border border-white/10 bg-black/95 p-2 shadow-2xl">
                <div className="rounded-md border border-white/10 bg-white/5 p-3">
                  <p className="text-sm font-semibold text-white">{authUser?.name ?? "Account"}</p>
                  <p className="mt-1 text-xs text-white/45">{authUser?.email ?? "Signed in"}</p>
                </div>
                <Link href="/dashboard/settings" className="mt-2 flex rounded-md px-3 py-2 text-sm text-white/75 hover:bg-white/8 hover:text-white">
                  Settings
                </Link>
                <button onClick={handleLogout} className="mt-1 flex w-full rounded-md px-3 py-2 text-sm text-left text-white/75 hover:bg-white/8 hover:text-white">
                  Sign out
                </button>
              </div>
            </details>
          </div>
        </header>
        {authLoading ? <div className="p-6">{children}</div> : children}
      </section>
    </main>
  );
}
