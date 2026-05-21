"use client";

import { LayoutTemplate } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useTemplates } from "@/src/hooks/use-api";

export default function TemplatesPage() {
  const templates = useTemplates();

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <h1 className="text-4xl font-black">Templates</h1>

        {templates.error && <div className="mt-6"><PageError message={templates.error.message} /></div>}
        {templates.isLoading ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-44" />)}</div>
        ) : !templates.data?.length ? (
          <div className="mt-8"><EmptyState title="No templates yet" body="Save reusable DM, lead capture, and AI handoff templates for this brand." /></div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {templates.data.map((template) => (
              <div key={template.id} className="glass rounded-md p-5 transition hover:-translate-y-0.5 hover:border-signal/40">
                <LayoutTemplate className="h-5 w-5 text-signal" />
                <h2 className="mt-5 text-xl font-bold">{template.name}</h2>
                <p className="mt-2 text-sm font-semibold text-pulse">{template.category}</p>
                <p className="mt-3 line-clamp-3 text-sm text-white/55">{String(template.content.message ?? "Reusable automation template")}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
