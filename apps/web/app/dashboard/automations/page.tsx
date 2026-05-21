"use client";

import { useMemo, useState } from "react";
import { Bot, CirclePlay, Clock3, Loader2, Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useAutomations, useCreateAutomation, useExecutions } from "@/src/hooks/use-api";

export default function AutomationsPage() {
  const automations = useAutomations();
  const executions = useExecutions();
  const createAutomation = useCreateAutomation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("Comment to DM");
  const [keyword, setKeyword] = useState("price");
  const [replyMessage, setReplyMessage] = useState("Check your inbox 👋");

  const summary = useMemo(() => {
    const total = executions.data?.length ?? 0;
    const completed = executions.data?.filter((execution) => execution.status === "completed").length ?? 0;
    const failed = executions.data?.filter((execution) => execution.status === "failed").length ?? 0;
    return { total, completed, failed };
  }, [executions.data]);

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-semibold text-signal">Automation engine</p>
            <h1 className="mt-2 text-4xl font-black">Automations</h1>
          </div>
          <Link href="/flow-builder" className="inline-flex items-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-black text-black transition hover:bg-white">
            <Plus className="h-4 w-4" /> New flow
          </Link>
        </div>

        <div className="glass mt-6 rounded-md p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-semibold text-signal">Quick create</p>
              <h2 className="mt-1 text-2xl font-black">Create a keyword automation</h2>
              <p className="mt-1 text-sm text-white/55">This saves a real keyword trigger, a DM reply, and the workflow nodes needed for the MVP.</p>
            </div>
            <button
              onClick={async () => {
                await createAutomation.mutateAsync({ name, keyword, replyMessage, status: "LIVE" });
                await Promise.all([
                  automations.refetch(),
                  executions.refetch(),
                  queryClient.invalidateQueries({ queryKey: ["dashboard"] })
                ]);
              }}
              disabled={createAutomation.isPending || !name.trim() || !keyword.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createAutomation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create automation
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-md border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-signal/40"
                placeholder="Comment to DM"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Keyword</span>
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                className="rounded-md border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-signal/40"
                placeholder="price, info, link"
              />
            </label>
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/45">DM reply</span>
              <input
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value)}
                className="rounded-md border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-white/30 focus:border-signal/40"
                placeholder="Check your inbox 👋"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Total executions</p>
            <p className="mt-2 text-3xl font-black text-white">{summary.total}</p>
          </div>
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Completed</p>
            <p className="mt-2 text-3xl font-black text-signal">{summary.completed}</p>
          </div>
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Failed</p>
            <p className="mt-2 text-3xl font-black text-pulse">{summary.failed}</p>
          </div>
        </div>

        {automations.error && <div className="mt-6"><PageError message={automations.error.message} /></div>}

        {automations.isLoading ? (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <SkeletonBlock key={index} className="h-48" />)}</div>
        ) : !automations.data?.length ? (
          <div className="mt-8">
            <EmptyState title="No automations yet" body="Create a comment trigger, AI reply, lead capture, or webhook flow to start automating conversations." />
          </div>
        ) : (
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {automations.data.map((automation) => {
              const relatedExecutions = executions.data?.filter((execution) => execution.automationId === automation.id) ?? [];
              const latestExecution = relatedExecutions[0];
              return (
                <article key={automation.id} className="glass rounded-md p-5 transition hover:-translate-y-0.5 hover:border-signal/40">
                  <div className="flex items-center justify-between">
                    <Bot className="h-5 w-5 text-signal" />
                    <span className="inline-flex rounded-full bg-signal/12 px-3 py-1 text-xs font-bold text-signal">{automation.status}</span>
                  </div>
                  <h2 className="mt-5 text-xl font-bold">{automation.name}</h2>
                  <p className="mt-2 text-sm text-white/55">
                    {automation.triggerType.replaceAll("_", " ")} with {automation.nodes?.length ?? 0} configured nodes.
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    Keywords: {(automation.triggerRules?.keywords as string[] | undefined)?.join(", ") ?? automation.triggerRuleRows?.map((rule) => rule.value).filter(Boolean).join(", ") ?? "n/a"}
                  </p>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-xs text-white/55">
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="font-semibold text-white">{relatedExecutions.length}</p>
                      <p className="mt-1">Runs</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="font-semibold text-white">{relatedExecutions.filter((item) => item.status === "completed").length}</p>
                      <p className="mt-1">Success</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3">
                      <p className="font-semibold text-white">{relatedExecutions.filter((item) => item.status === "failed").length}</p>
                      <p className="mt-1">Failed</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-white/45">
                    <span className="inline-flex items-center gap-1"><Workflow className="h-3.5 w-3.5" /> {Math.max(automation.nodes?.length ?? 1, 1)} nodes</span>
                    <span className="inline-flex items-center gap-1"><CirclePlay className="h-3.5 w-3.5" /> {latestExecution ? latestExecution.status : "idle"}</span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-signal">Execution history</p>
              <h2 className="mt-1 text-2xl font-black">Live workflow timeline</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-white/55">
              <Clock3 className="h-3.5 w-3.5" /> refreshed in real time
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {executions.isLoading ? (
              <SkeletonBlock className="h-36" />
            ) : executions.error ? (
              <PageError message={executions.error.message} />
            ) : !executions.data?.length ? (
              <EmptyState title="No executions yet" body="Webhook events will appear here once Meta sends a comment, DM, or Messenger payload." />
            ) : (
              executions.data.slice(0, 8).map((execution) => (
                <article key={execution.id} className="glass rounded-md p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-white">{execution.automation.name}</p>
                      <p className="text-sm text-white/50">
                        Triggered from {execution.triggerSource} · {execution.triggerValue ?? "n/a"} · started {new Date(execution.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                      execution.status === "completed"
                        ? "bg-emerald-400/15 text-emerald-300"
                        : execution.status === "failed"
                          ? "bg-pulse/15 text-pulse"
                          : "bg-signal/12 text-signal"
                    }`}>
                      {execution.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-md bg-white/5 p-3 text-sm text-white/55">
                      <p className="font-semibold text-white">Logs</p>
                      <p className="mt-1">{execution.logs.length} entries</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3 text-sm text-white/55">
                      <p className="font-semibold text-white">Deliveries</p>
                      <p className="mt-1">{execution.deliveries.length} outbound messages</p>
                    </div>
                    <div className="rounded-md bg-white/5 p-3 text-sm text-white/55">
                      <p className="font-semibold text-white">Failure reason</p>
                      <p className="mt-1">{execution.failureReason ?? "None"}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
