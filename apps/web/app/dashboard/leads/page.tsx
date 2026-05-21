"use client";

import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useLeads } from "@/src/hooks/use-api";

export default function LeadsPage() {
  const leads = useLeads();

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <h1 className="text-4xl font-black">Leads</h1>

        {leads.error && <div className="mt-6"><PageError message={leads.error.message} /></div>}
        {leads.isLoading ? (
          <div className="mt-6 space-y-3">{Array.from({ length: 5 }).map((_, index) => <SkeletonBlock key={index} className="h-16" />)}</div>
        ) : !leads.data?.length ? (
          <div className="mt-6"><EmptyState title="No leads captured" body="Leads will appear here when automations collect email, phone, tags, and conversion signals." /></div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-md border border-white/10">
            {leads.data.map((lead) => (
              <div key={lead.id} className="grid gap-3 border-b border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06] last:border-b-0 md:grid-cols-[1.2fr_1.4fr_1fr_0.7fr]">
                <strong>{lead.name ?? lead.socialHandle ?? "Unknown lead"}</strong>
                <span className="text-white/62">{lead.email ?? lead.phone ?? "No contact yet"}</span>
                <span className="text-signal">{lead.tags.join(", ") || lead.source}</span>
                <span className="text-white/62">Score {lead.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
