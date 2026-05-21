"use client";

import { BarChart3 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useAnalytics } from "@/src/hooks/use-api";

const labels: Record<string, string> = {
  comments: "Comments",
  dms_sent: "DM replies",
  leads_generated: "Leads",
  viral_reels: "Viral reels",
  conversion_rate: "Conversion",
  reply_rate: "Reply rate"
};

export default function AnalyticsPage() {
  const analytics = useAnalytics();
  const totals = analytics.data?.totals ?? [];

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <p className="font-semibold text-signal">Attribution</p>
        <h1 className="mt-2 text-4xl font-black">Analytics</h1>

        {analytics.error && <div className="mt-6"><PageError message={analytics.error.message} /></div>}
        {analytics.isLoading ? (
          <>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-32" />)}</div>
            <SkeletonBlock className="mt-5 h-96" />
          </>
        ) : totals.length === 0 ? (
          <div className="mt-8"><EmptyState title="No analytics yet" body="Analytics events will appear after comments, DMs, leads, and automation executions are processed." /></div>
        ) : (
          <>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {totals.slice(0, 4).map((metric) => (
                <div key={metric.type} className="glass rounded-md p-5 transition hover:border-signal/35">
                  <BarChart3 className="h-5 w-5 text-signal" />
                  <p className="mt-5 text-sm text-white/52">{labels[metric.type] ?? metric.type}</p>
                  <p className="mt-3 text-3xl font-black">{Number(metric.value ?? 0).toLocaleString()}</p>
                </div>
              ))}
            </div>
            <div className="glass mt-5 rounded-md p-5">
              <div className="flex h-96 items-end gap-2">
                {totals.map((metric) => {
                  const height = Math.max(28, Math.min(360, Number(metric.value ?? 0) / 420));
                  return <div key={metric.type} className="flex-1 rounded-t bg-gradient-to-t from-pulse to-signal transition-all" style={{ height }} title={metric.type} />;
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
