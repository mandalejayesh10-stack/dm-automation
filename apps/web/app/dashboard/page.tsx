"use client";

import { Activity, Bot, MessageCircle, TrendingUp, Users, Workflow } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useAccounts, useAnalytics, useAutomations, useDashboard } from "@/src/hooks/use-api";

const metricLabels: Record<string, string> = {
  comments: "Total comments",
  dms_sent: "DMs sent",
  reply_rate: "Reply rate",
  conversion_rate: "Conversion",
  leads_generated: "Leads generated",
  viral_reels: "Viral reels"
};

const metricIcons = [Activity, MessageCircle, Bot, TrendingUp, Users];

function formatMetric(type: string, value: string | number | null) {
  const numeric = Number(value ?? 0);
  if (type.includes("rate")) return `${numeric.toLocaleString()}%`;
  return numeric.toLocaleString();
}

export default function DashboardPage() {
  const dashboard = useDashboard();
  const accounts = useAccounts();
  const automations = useAutomations();
  const analytics = useAnalytics();

  const isLoading = dashboard.isLoading || accounts.isLoading || automations.isLoading;
  const error = dashboard.error ?? accounts.error ?? automations.error ?? analytics.error;

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="font-semibold text-signal">Command center</p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">Growth dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/reels" className="rounded-md border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-signal/35 hover:bg-white/10">
              Reel dashboard
            </Link>
            <button className="rounded-md bg-signal px-5 py-3 text-sm font-bold text-black transition hover:bg-white">Create automation</button>
          </div>
        </div>

        {error && <div className="mt-6"><PageError message={error.message} /></div>}

        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-36" />)}
          </div>
        ) : !dashboard.data?.brand ? (
          <div className="mt-8"><EmptyState title="No brand connected" body="Connect a Meta account to start seeing comments, DMs, automations, leads, and analytics." /></div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {dashboard.data.stats.slice(0, 5).map((stat, index) => {
                const Icon = metricIcons[index] ?? Activity;
                return (
                  <div key={stat.type} className="glass rounded-md p-5 transition hover:border-signal/40">
                    <Icon className="h-5 w-5 text-signal" />
                    <p className="mt-5 text-sm text-white/52">{metricLabels[stat.type] ?? stat.type}</p>
                    <p className="mt-1 text-3xl font-black">{formatMetric(stat.type, stat.value)}</p>
                    <p className="mt-2 text-xs font-semibold text-signal">Live from PostgreSQL</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <div className="glass rounded-md p-5">
                <p className="text-sm text-white/52">Connected accounts</p>
                <p className="mt-2 text-3xl font-black">{accounts.data?.filter((account) => account.isActive).length ?? dashboard.data.connectedAccounts}</p>
              </div>
              <div className="glass rounded-md p-5">
                <p className="text-sm text-white/52">Automation count</p>
                <p className="mt-2 text-3xl font-black">{automations.data?.length ?? dashboard.data.automations.length}</p>
              </div>
              <div className="glass rounded-md p-5">
                <p className="text-sm text-white/52">Lead records</p>
                <p className="mt-2 text-3xl font-black">{dashboard.data.leads.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <section className="glass rounded-md p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">Live analytics</h2>
                  <span className="text-sm text-white/45">Current brand</span>
                </div>
                <div className="mt-8 flex h-72 items-end gap-2">
                  {(analytics.data?.totals.length ? analytics.data.totals : dashboard.data.stats).map((stat) => {
                    const height = Math.max(24, Math.min(260, Number(stat.value ?? 0) / 520));
                    return (
                      <div key={stat.type} className="flex flex-1 flex-col justify-end rounded-t bg-signal/18">
                        <div className="rounded-t bg-gradient-to-t from-pulse to-signal transition-all" style={{ height }} />
                      </div>
                    );
                  })}
                </div>
              </section>
              <section className="glass rounded-md p-5">
                <h2 className="text-xl font-bold">Recent activity</h2>
                <div className="mt-5 space-y-3">
                  {(automations.data ?? dashboard.data.automations).map((automation) => (
                    <div key={automation.id} className="rounded-md border border-white/10 bg-black/35 p-4 transition hover:border-signal/35">
                      <div className="flex items-center justify-between">
                        <p className="flex items-center gap-2 font-semibold"><Workflow className="h-4 w-4 text-signal" />{automation.name}</p>
                        <span className="rounded-full bg-signal/15 px-2 py-1 text-xs font-bold text-signal">{automation.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-white/50">{automation.triggerType.replaceAll("_", " ")} workflow is synced from the backend.</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
