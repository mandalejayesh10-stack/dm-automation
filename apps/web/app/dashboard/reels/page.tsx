"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  BadgeCheck,
  Facebook,
  Loader2,
  MessageCircle,
  Palette,
  PencilLine,
  Link2,
  Sparkles,
  Tag,
  ToggleLeft
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { useActiveBrandId, useReels, useSaveReelAutomation } from "@/src/hooks/use-api";

type ReelFormState = {
  reelId: string;
  mediaId: string;
  socialAccountId: string;
  keyword: string;
  dmTemplate: string;
  commentReply: string;
  contentUrl: string;
  enabled: boolean;
};

const defaultForm: ReelFormState = {
  reelId: "",
  mediaId: "",
  socialAccountId: "",
  keyword: "price",
  dmTemplate: "Check your inbox. We sent the details over 👋",
  commentReply: "Sent you a DM with the details.",
  contentUrl: "",
  enabled: true
};

function safeSnippet(text: string | null | undefined, length = 120) {
  if (!text) return "No caption provided on this reel.";
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > length ? `${normalized.slice(0, length)}...` : normalized;
}

export default function ReelAutomationPage() {
  const reelsQuery = useReels();
  const activeBrandId = useActiveBrandId();
  const queryClient = useQueryClient();
  const saveConfig = useSaveReelAutomation();
  const [selected, setSelected] = useState<(ReelFormState & { title: string; thumbnailUrl: string | null; provider: string }) | null>(null);
  const [form, setForm] = useState<ReelFormState>(defaultForm);
  const [savingError, setSavingError] = useState<string | null>(null);

  const reels = reelsQuery.data?.reels ?? [];
  const configuredCount = useMemo(() => reels.filter((reel) => reel.config?.enabled).length, [reels]);
  const liveAccounts = reelsQuery.data?.accounts.filter((account) => account.isActive).length ?? 0;

  useEffect(() => {
    if (!selected) return;
    const existing = reels.find((reel) => reel.mediaId === selected.mediaId && reel.socialAccountId === selected.socialAccountId);
    if (!existing) return;

    setForm({
      reelId: existing.id,
      mediaId: existing.mediaId,
      socialAccountId: existing.socialAccountId,
      keyword: existing.config?.keyword ?? defaultForm.keyword,
      dmTemplate: existing.config?.dmTemplate ?? defaultForm.dmTemplate,
      commentReply: existing.config?.commentReply ?? defaultForm.commentReply,
      contentUrl: existing.config?.contentUrl ?? existing.permalink ?? defaultForm.contentUrl,
      enabled: existing.config?.enabled ?? defaultForm.enabled
    });
  }, [reels, selected]);

  const openEditor = (reel: (typeof reels)[number]) => {
    setSavingError(null);
    const nextForm = {
      reelId: reel.id,
      mediaId: reel.mediaId,
      socialAccountId: reel.socialAccountId,
      keyword: reel.config?.keyword ?? defaultForm.keyword,
      dmTemplate: reel.config?.dmTemplate ?? defaultForm.dmTemplate,
      commentReply: reel.config?.commentReply ?? defaultForm.commentReply,
      contentUrl: reel.config?.contentUrl ?? reel.permalink ?? defaultForm.contentUrl,
      enabled: reel.config?.enabled ?? defaultForm.enabled
    };
    setForm(nextForm);
    setSelected({
      ...nextForm,
      title: reel.accountName ?? reel.username ?? reel.mediaId,
      thumbnailUrl: reel.thumbnailUrl,
      provider: reel.provider
    });
  };

  const closeEditor = () => {
    setSelected(null);
    setSavingError(null);
  };

  const handleSave = async () => {
    if (!selected || !activeBrandId) return;
    setSavingError(null);
    try {
      await saveConfig.mutateAsync({
        reelId: form.reelId,
        socialAccountId: form.socialAccountId,
        mediaId: form.mediaId,
        keyword: form.keyword,
        dmTemplate: form.dmTemplate,
        commentReply: form.commentReply,
        enabled: form.enabled,
        contentUrl: form.contentUrl.trim() || null
      });
      await Promise.all([reelsQuery.refetch(), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
      closeEditor();
    } catch (error) {
      setSavingError(error instanceof Error ? error.message : "Failed to save reel automation");
    }
  };

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-semibold text-signal">Real Meta media sync</p>
            <h1 className="mt-2 text-4xl font-black">Reel Automation Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Live Instagram media from Meta Graph API. Configure comment-trigger automations directly on each reel card, then save the workflow
              into PostgreSQL.
            </p>
          </div>
          <button
            onClick={() => reelsQuery.refetch()}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:border-signal/35 hover:bg-white/10"
          >
            <Loader2 className={`h-4 w-4 ${reelsQuery.isFetching ? "animate-spin" : ""}`} />
            Sync live reels
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Connected social accounts</p>
            <p className="mt-2 text-3xl font-black text-white">{liveAccounts}</p>
          </div>
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Reels cached from Graph</p>
            <p className="mt-2 text-3xl font-black text-signal">{reels.length}</p>
          </div>
          <div className="glass rounded-md p-5">
            <p className="text-sm text-white/50">Configured automations</p>
            <p className="mt-2 text-3xl font-black text-pulse">{configuredCount}</p>
          </div>
        </div>

        {reelsQuery.error && (
          <div className="mt-6">
            <PageError message={reelsQuery.error.message} />
          </div>
        )}

        {reelsQuery.data?.syncErrors?.length ? (
          <div className="mt-6 rounded-md border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Live sync warning: {reelsQuery.data.syncErrors[0]}
          </div>
        ) : null}

        {reelsQuery.isLoading ? (
          <div className="mt-8 columns-1 gap-4 md:columns-2 xl:columns-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <div key={index} className="mb-4 break-inside-avoid">
                <SkeletonBlock className="h-[440px]" />
              </div>
            ))}
          </div>
        ) : !reels.length ? (
          <div className="mt-8">
            <EmptyState
              title="No Instagram reels found"
              body="Connect an Instagram Business account in the Accounts page, then return here to fetch real media cards from Meta Graph API."
            />
          </div>
        ) : (
          <div className="mt-8 columns-1 gap-4 md:columns-2 xl:columns-3">
            {reels.map((reel) => (
              <article
                key={`${reel.socialAccountId}:${reel.mediaId}`}
                onClick={() => openEditor(reel)}
                className="group mb-4 break-inside-avoid cursor-pointer rounded-md border border-white/10 bg-white/[0.03] p-3 shadow-xl backdrop-blur transition hover:-translate-y-0.5 hover:border-signal/35"
              >
                <div className="relative overflow-hidden rounded-md border border-white/10 bg-black/45">
                  {reel.thumbnailUrl ? (
                    <img src={reel.thumbnailUrl} alt={reel.caption ?? reel.mediaId} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="grid h-72 place-items-center bg-gradient-to-br from-signal/20 via-black to-pulse/20">
                      <Palette className="h-10 w-10 text-signal" />
                    </div>
                  )}
                  <div className="absolute left-3 top-3 flex gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      reel.config?.enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/75"
                    }`}>
                      <BadgeCheck className="h-3.5 w-3.5" />
                      {reel.config?.enabled ? "Automation enabled" : "Automation off"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white/85">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {reel.config?.enabled ? "DM enabled" : "DM off"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-3 py-1 text-xs font-semibold text-white/85">
                      <Facebook className="h-3.5 w-3.5" />
                      {reel.provider === "FACEBOOK" ? "Facebook Reel" : "Instagram Reel"}
                    </span>
                  </div>
                  <div className="absolute right-3 top-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white/80">
                    {reel.commentsCount ?? 0} comments
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      openEditor(reel);
                    }}
                    className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-2 text-xs font-bold text-white/90 opacity-100 transition hover:border-signal/40 hover:bg-signal hover:text-black md:opacity-0 md:group-hover:opacity-100"
                  >
                    <PencilLine className="h-3.5 w-3.5" />
                    Edit
                  </button>
                </div>

                <div className="p-4">
                  <p className="line-clamp-3 text-sm leading-6 text-white/75">{safeSnippet(reel.caption)}</p>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-md bg-white/[0.04] p-3">
                      <p className="text-xs text-white/45">{reel.provider === "FACEBOOK" ? "Views" : "Likes"}</p>
                      <p className="mt-1 text-lg font-black">{(reel.likeCount ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-white/[0.04] p-3">
                      <p className="text-xs text-white/45">Comments</p>
                      <p className="mt-1 text-lg font-black">{(reel.commentsCount ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-white/[0.04] p-3">
                      <p className="text-xs text-white/45">DM</p>
                      <p className="mt-1 text-lg font-black">{reel.config?.enabled ? "On" : "Off"}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/60">
                    <p className="flex items-center gap-2 font-semibold text-white/80">
                      <Tag className="h-3.5 w-3.5 text-signal" />
                      Trigger keyword
                    </p>
                    <p className="mt-1">{reel.config?.keyword ?? "Not configured yet"}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <a
                      href={reel.permalink ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-2 text-sm font-semibold text-white/70 transition hover:text-white"
                    >
                      Open reel
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditor(reel);
                      }}
                      className="inline-flex items-center gap-2 rounded-md bg-signal px-4 py-2 text-sm font-black text-black transition hover:bg-white"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 px-4 py-8 backdrop-blur">
          <button className="absolute inset-0" aria-label="Close reel configuration" onClick={closeEditor} />
          <div className="relative z-10 max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                {selected.thumbnailUrl ? (
                  <img src={selected.thumbnailUrl} alt={selected.title} className="h-20 w-20 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-20 w-20 place-items-center rounded-xl bg-white/8">
                    <Sparkles className="h-6 w-6 text-signal" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-signal">Edit Reel Configuration</p>
                  <h2 className="mt-1 text-2xl font-black">{selected.title}</h2>
                  <p className="mt-1 text-sm text-white/55">
                    This saves the live automation config for the selected reel in PostgreSQL.
                  </p>
                </div>
              </div>
              <button onClick={closeEditor} className="rounded-md border border-white/10 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/8">
                Close
              </button>
            </div>

            {savingError && (
              <div className="mt-4 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
                {savingError}
              </div>
            )}

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Trigger keyword</span>
                <input
                  value={form.keyword}
                  onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))}
                  className="rounded-md border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-signal/40"
                  placeholder="price"
                />
              </label>

              <div className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Automation note</span>
                <div className="rounded-md border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/50">
                  Saved directly to this reel card. No Flow Builder required.
                </div>
              </div>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/45">DM message</span>
                <textarea
                  rows={4}
                  value={form.dmTemplate}
                  onChange={(event) => setForm((current) => ({ ...current, dmTemplate: event.target.value }))}
                  className="rounded-md border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-signal/40"
                  placeholder="Check your inbox. We sent the details over."
                />
              </label>

              <label className="grid gap-2 md:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Comment reply</span>
                <textarea
                  rows={3}
                  value={form.commentReply}
                  onChange={(event) => setForm((current) => ({ ...current, commentReply: event.target.value }))}
                  className="rounded-md border border-white/10 bg-black/45 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-signal/40"
                  placeholder="Sent you a DM with the details."
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-white/45">Content URL (optional)</span>
                <div className="flex items-center gap-3 rounded-md border border-white/10 bg-black/45 px-4 py-3">
                  <Link2 className="h-4 w-4 text-signal" />
                  <input
                    value={form.contentUrl}
                    onChange={(event) => setForm((current) => ({ ...current, contentUrl: event.target.value }))}
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                    placeholder="https://www.instagram.com/reel/..."
                  />
                </div>
              </label>

              <div className="grid gap-4">
                <label className="inline-flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/80">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))}
                    className="h-4 w-4 accent-[#FFD600]"
                  />
                  <span className="inline-flex items-center gap-2">
                    <ToggleLeft className="h-4 w-4 text-signal" />
                    Enable automation
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-white/10 bg-black/35 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-white/80">
                <MessageCircle className="h-4 w-4 text-signal" />
                Real execution behavior
              </p>
              <p className="mt-2 text-sm leading-6 text-white/55">
                When Meta sends a comment webhook for this reel, the backend matches the keyword and media ID, sends a DM, saves the lead,
                and updates inbox plus analytics in PostgreSQL.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
              <button onClick={closeEditor} className="rounded-md border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/8">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.keyword.trim() || !form.dmTemplate.trim() || saveConfig.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Save configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
