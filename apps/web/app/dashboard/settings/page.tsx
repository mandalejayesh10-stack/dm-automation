"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { useAppStore } from "@/lib/store";

function SettingsContent() {
  const authUser = useAppStore((state) => state.authUser);
  const activeBrand = useAppStore((state) => state.brands.find((brand) => brand.id === state.activeBrandId) ?? state.brands[0] ?? null);

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-4xl font-black">Settings</h1>
      <div className="mt-8 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="glass rounded-md p-5">
          <p className="text-sm font-semibold text-signal">Signed-in user</p>
          <div className="mt-4 space-y-3">
            <p className="text-2xl font-black">{authUser?.name ?? "Account"}</p>
            <p className="text-sm text-white/55">{authUser?.email ?? "No session loaded"}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">Auth provider: Google OAuth</p>
          </div>
        </div>
        <div className="glass rounded-md p-5">
          <p className="text-sm font-semibold text-signal">Active workspace</p>
          <div className="mt-4 space-y-3">
            <p className="text-2xl font-black">{activeBrand?.name ?? "No workspace selected"}</p>
            <p className="text-sm text-white/55">{activeBrand?.instagram ?? "Instagram not connected"}</p>
            <p className="text-xs uppercase tracking-[0.16em] text-white/40">{activeBrand?.facebook ?? "Facebook not connected"}</p>
          </div>
        </div>
      </div>
      <div className="glass mt-8 max-w-2xl rounded-md p-5">
        {["Workspace name", "Default timezone", "Lead notification email"].map((label) => (
          <label key={label} className="mb-4 block text-sm text-white/60">
            {label}
            <input className="mt-2 w-full rounded-md border border-white/10 bg-black/35 px-3 py-3 text-white outline-none focus:border-signal" />
          </label>
        ))}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <DashboardShell>
      <SettingsContent />
    </DashboardShell>
  );
}
