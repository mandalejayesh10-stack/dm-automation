"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Bot, Search, Send, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/shell";
import { EmptyState, PageError, SkeletonBlock } from "@/components/dashboard/data-states";
import { getBackendUrl } from "@/lib/backend";
import { useActiveBrandId, useInbox } from "@/src/hooks/use-api";

const SOCKET_URL = getBackendUrl();

export default function InboxPage() {
  const inbox = useInbox();
  const queryClient = useQueryClient();
  const activeBrandId = useActiveBrandId();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const client = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"]
    });

    setSocket(client);
    client.on("connected", () => {
      if (activeBrandId) client.emit("join:brand", activeBrandId);
    });
    client.on("execution:completed", () => queryClient.invalidateQueries({ queryKey: ["inbox", activeBrandId] }));
    client.on("message:delivery:sent", () => queryClient.invalidateQueries({ queryKey: ["inbox", activeBrandId] }));
    client.on("inbox:message:sent", () => queryClient.invalidateQueries({ queryKey: ["inbox", activeBrandId] }));
    client.on("webhook:processed", () => queryClient.invalidateQueries({ queryKey: ["inbox", activeBrandId] }));

    return () => {
      client.disconnect();
      setSocket(null);
    };
  }, [activeBrandId, queryClient]);

  useEffect(() => {
    if (socket && activeBrandId) {
      socket.emit("join:brand", activeBrandId);
    }
  }, [activeBrandId, socket]);

  const conversations = inbox.data ?? [];
  const activeConversation = conversations[0];

  const unreadCount = useMemo(() => conversations.filter((conversation) => conversation.status !== "CLOSED").length, [conversations]);

  return (
    <DashboardShell>
      <div className="grid h-[calc(100vh-65px)] grid-cols-1 md:grid-cols-[310px_1fr]">
        <aside className="border-r border-white/10 bg-black/25 p-4">
          <div className="flex items-center gap-2 rounded-md border border-white/10 bg-white/7 px-3 py-2">
            <Search className="h-4 w-4 text-white/45" />
            <input className="w-full bg-transparent text-sm outline-none" placeholder="Search messages" />
          </div>
          <div className="mt-3 rounded-md border border-signal/20 bg-signal/10 px-3 py-2 text-xs font-semibold text-signal">
            {unreadCount} active conversations
          </div>
          {inbox.isLoading ? (
            <div className="mt-4 space-y-2">{Array.from({ length: 4 }).map((_, index) => <SkeletonBlock key={index} className="h-20" />)}</div>
          ) : conversations.length === 0 ? (
            <div className="mt-4 text-sm text-white/50">No conversations yet.</div>
          ) : (
            <div className="mt-4 space-y-2">
              {conversations.map((conversation) => {
                const lastMessage = conversation.messages.at(-1);
                return (
                  <button key={conversation.id} className="w-full rounded-md border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-signal/35">
                    <p className="font-semibold">{conversation.externalId}</p>
                    <p className="mt-1 truncate text-sm text-white/50">{lastMessage?.body ?? "No messages"}</p>
                    <p className="mt-2 text-xs text-white/35">
                      {conversation.labels.join(", ") || "No labels"} · {conversation.status}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </aside>
        <section className="flex min-h-0 flex-col">
          <header className="border-b border-white/10 p-4">
            <h1 className="text-xl font-black">Unified inbox</h1>
            <p className="text-sm text-white/50">Instagram DMs and Messenger messages with realtime AI suggestions.</p>
          </header>
          {inbox.error ? (
            <div className="p-4"><PageError message={inbox.error.message} /></div>
          ) : inbox.isLoading ? (
            <div className="space-y-4 p-4">
              <SkeletonBlock className="h-16 max-w-md" />
              <SkeletonBlock className="ml-auto h-16 max-w-md" />
              <SkeletonBlock className="h-28 max-w-lg" />
            </div>
          ) : !activeConversation ? (
            <div className="p-4"><EmptyState title="No inbox messages" body="New Instagram and Facebook messages will appear here as webhooks arrive." /></div>
          ) : (
            <>
              <div className="flex-1 space-y-4 overflow-auto p-4">
                {activeConversation.messages.map((message) => (
                  <div key={message.id} className={`max-w-md rounded-md p-3 ${message.direction === "outbound" ? "ml-auto bg-pulse" : "bg-white/10"}`}>
                    <p className="text-sm font-semibold text-white/70">{message.direction === "outbound" ? "Outgoing" : "Incoming"}</p>
                    <p className="mt-1">{message.body}</p>
                  </div>
                ))}
                <div className="max-w-lg rounded-md border border-signal/20 bg-signal/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-signal"><Bot className="h-4 w-4" /> AI suggestion</p>
                  <p className="mt-2 text-sm text-white/72">Continue the thread, score the lead, and send the next template only if intent stays high.</p>
                </div>
                <div className="flex w-28 gap-1 rounded-md bg-white/8 p-3">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:120ms]" />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-white/70 [animation-delay:240ms]" />
                </div>
              </div>
              <footer className="border-t border-white/10 p-4">
                <div className="flex gap-3 rounded-md border border-white/10 bg-white/[0.04] p-2">
                  <div className="flex items-center gap-2 px-2 text-signal">
                    <Sparkles className="h-4 w-4" />
                    AI ready
                  </div>
                  <input className="min-w-0 flex-1 bg-transparent px-2 outline-none" placeholder="Reply with template or AI..." />
                  <button className="rounded-md bg-signal p-3 text-black" aria-label="Send message"><Send className="h-4 w-4" /></button>
                </div>
              </footer>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
