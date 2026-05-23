"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Facebook, Instagram, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { getMetaBackendOrigin } from "@/lib/backend";
import {
  startMetaOAuth,
  useAccounts,
  useActiveBrandId,
  useCompleteMetaOAuth,
  useDisconnectMetaAccount,
  useMetaOAuthSession,
  useReconnectMetaAccount
} from "@/src/hooks/use-api";

const BACKEND_ORIGIN = getMetaBackendOrigin();

export default function AccountsPage() {
  const accounts = useAccounts();
  const activeBrandId = useActiveBrandId();
  const queryClient = useQueryClient();
  const metaSession = useMetaOAuthSession();
  const completeMetaOAuth = useCompleteMetaOAuth();
  const disconnectMetaAccount = useDisconnectMetaAccount();
  const reconnectMetaAccount = useReconnectMetaAccount();
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [isOpeningPopup, setIsOpeningPopup] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const metaPages = metaSession.data?.pages ?? [];

  const tokenExpiryAlert = useMemo(() => {
    return accounts.data?.find((account) => {
      if (!account.tokenExpiresAt) return false;
      const expiry = new Date(account.tokenExpiresAt).getTime();
      return Number.isFinite(expiry) && expiry - Date.now() < 7 * 24 * 60 * 60 * 1000;
    });
  }, [accounts.data]);

  useEffect(() => {
    if (metaSession.data?.status === "ready" && metaPages.length && selectedPageIds.length === 0) {
      setSelectedPageIds(metaPages.map((page) => page.id));
    }
  }, [metaPages, metaSession.data?.status, selectedPageIds.length]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin && event.origin !== BACKEND_ORIGIN) return;
      if (event.data?.type !== "meta:oauth-complete") return;
      void Promise.all([
        metaSession.refetch(),
        accounts.refetch(),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["brands"] })
      ]);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [metaSession]);

  const handleConnectMeta = async () => {
      setActionError(null);
      setIsOpeningPopup(true);
      try {
      const { authUrl } = await startMetaOAuth(activeBrandId);
        const popup = window.open(authUrl, "meta_oauth", "width=620,height=820");
      if (!popup) {
        setActionError("Your browser blocked the Meta popup. Allow popups for this site or continue in this window.");
        window.location.assign(authUrl);
        return;
      }
      popup.focus();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Meta connection could not start. Check that META_APP_ID and META_APP_SECRET are set in the backend env."
      );
    } finally {
      setIsOpeningPopup(false);
    }
  };

  const handleSaveSelection = async () => {
    if (!activeBrandId) return;
    setActionError(null);
    try {
      await completeMetaOAuth.mutateAsync({ brandId: activeBrandId, selectedPageIds });
      setSelectedPageIds([]);
      await Promise.all([
        metaSession.refetch(),
        accounts.refetch(),
        queryClient.invalidateQueries({ queryKey: ["accounts"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["brands"] })
      ]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save selected Meta accounts");
    }
  };

  return (
    <DashboardShell>
      <div className="p-4 md:p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="font-semibold text-signal">ManyChat-style account management</p>
            <h1 className="mt-2 text-4xl font-black">Accounts</h1>
          </div>
          <button
            onClick={handleConnectMeta}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-black text-black transition hover:bg-white"
          >
            <Plus className="h-4 w-4" />
            {isOpeningPopup ? "Opening Meta..." : "Connect Instagram & Facebook"}
          </button>
        </div>

        <div className="mt-7 flex gap-2 overflow-x-auto border-b border-white/10">
          {["Accounts", "Templates", "API Settings", "Message Reports"].map((tab) => (
            <button key={tab} className="border-b-2 border-transparent px-4 py-3 text-sm font-semibold text-white/60 first:border-signal first:text-white">
              {tab}
            </button>
          ))}
        </div>

        {tokenExpiryAlert && (
          <div className="mt-6 rounded-md border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
            One connected account has a token expiry warning. Reconnect it soon to keep webhooks and inbox sync live.
          </div>
        )}

        {actionError && (
          <div className="mt-6 rounded-md border border-rose-400/25 bg-rose-400/10 p-4 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        {metaSession.data?.status === "ready" && metaPages.length > 0 && (
          <div className="glass mt-6 rounded-md p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold text-signal">Meta OAuth ready</p>
                <h2 className="mt-1 text-2xl font-black">Select the Pages and Instagram accounts to save</h2>
              </div>
              <div className="text-sm text-white/55">Permissions: {metaSession.data.permissions.join(", ")}</div>
            </div>

            <div className="mt-5 grid gap-4">
              {metaPages.map((page) => (
                <label
                  key={page.id}
                  className="flex cursor-pointer flex-col gap-4 rounded-md border border-white/10 bg-black/30 p-4 transition hover:border-signal/35 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedPageIds.includes(page.id)}
                      onChange={(event) => {
                        setSelectedPageIds((current) =>
                          event.target.checked ? [...current, page.id] : current.filter((id) => id !== page.id)
                        );
                      }}
                      className="h-4 w-4 accent-[#FFD600]"
                    />
                    {page.picture_url || page.instagram_business_account?.profile_picture_url ? (
                      <img
                        src={page.picture_url ?? page.instagram_business_account?.profile_picture_url ?? ""}
                        alt={page.name}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10 text-sm font-black text-signal">
                        {(page.name ?? "M")
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{page.name}</p>
                      <p className="text-sm text-white/50">
                        Facebook Page ·{" "}
                        {page.instagram_business_account
                          ? `Instagram @${page.instagram_business_account.username ?? "business"}`
                          : "No Instagram business account linked"}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-signal/12 px-3 py-1 text-xs font-bold text-signal">
                      <ShieldCheck className="h-3 w-3" />
                      {page.tasks?.length ? `${page.tasks.length} tasks` : "Ready"}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55">
                      {page.token_expires_at ? `Token exp. ${new Date(page.token_expires_at).toLocaleDateString()}` : "Token expiry not exposed"}
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
              <button
                onClick={handleSaveSelection}
                disabled={!selectedPageIds.length || completeMetaOAuth.isPending}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-signal px-5 py-3 text-sm font-black text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save selected accounts
              </button>
              <p className="text-sm text-white/50">
                Selected pages will be encrypted, saved in PostgreSQL, and subscribed to Meta webhooks immediately.
              </p>
            </div>
          </div>
        )}

        {accounts.error && (
          <div className="mt-6">
            <PageError message={accounts.error.message} />
          </div>
        )}

        {accounts.isLoading ? (
          <div className="mt-6 grid gap-4">{Array.from({ length: 3 }).map((_, index) => <SkeletonBlock key={index} className="h-24" />)}</div>
        ) : !accounts.data?.length ? (
          <div className="mt-6">
            <EmptyState
              title="No accounts connected"
              body="Connect an Instagram Business Account or Facebook Page to enable comment and message automation."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4">
            {accounts.data.map((account) => {
              const Icon = account.provider === "INSTAGRAM" ? Instagram : Facebook;
              const status = account.isActive ? "Connected" : "Needs reconnect";

              const handleDisconnect = async () => {
                await disconnectMetaAccount.mutateAsync(account.id);
                await accounts.refetch();
              };

              const handleReconnect = async () => {
                setActionError(null);
                try {
                  const { authUrl } = await reconnectMetaAccount.mutateAsync(account.id);
                  const popup = window.open(authUrl, "meta_oauth", "width=620,height=820");
                  if (!popup) {
                    setActionError("Your browser blocked the Meta popup. Allow popups for this site or continue in this window.");
                    window.location.assign(authUrl);
                    return;
                  }
                  popup.focus();
                } catch (error) {
                  setActionError(
                    error instanceof Error
                      ? error.message
                      : "Meta reconnect could not start. Check the backend Meta configuration."
                  );
                }
              };

              return (
                <div key={account.id} className="glass flex flex-col justify-between gap-4 rounded-md p-5 transition hover:border-signal/35 md:flex-row md:items-center">
                  <div className="flex items-center gap-4">
                    {account.profilePictureUrl ? (
                      <img
                        src={account.profilePictureUrl}
                        alt={account.accountName ?? account.username ?? account.externalId}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/8">
                        <Icon className="h-5 w-5 text-signal" />
                      </div>
                    )}
                    <div>
                      <p className="font-bold">{account.accountName ?? account.username ?? account.externalId}</p>
                      <p className="text-sm text-white/50">
                        {account.provider} · {account.username ?? account.externalId} · {account.webhookStatus ?? "pending"} ·{" "}
                        {account.tokenExpiresAt ? `expires ${new Date(account.tokenExpiresAt).toLocaleDateString()}` : "expiry not exposed"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full bg-signal/12 px-3 py-1 text-xs font-bold text-signal">
                      {!account.isActive && <AlertTriangle className="h-3 w-3" />}
                      {status}
                    </span>
                    <button onClick={handleReconnect} className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/8" aria-label="Reconnect">
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button onClick={handleDisconnect} className="rounded-md border border-white/10 p-2 text-white/70 hover:bg-white/8" aria-label="Disconnect">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
