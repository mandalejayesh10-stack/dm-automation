"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAppStore } from "@/lib/store";
import { getAuthBackendUrl, getMetaBackendUrl } from "@/lib/backend";

const API_URL = getAuthBackendUrl();
const META_API_URL = getMetaBackendUrl();

export type Brand = {
  id: string;
  name: string;
  slug: string;
  socialAccounts?: SocialAccount[];
  subscription?: { plan: string; status: string; usage?: unknown } | null;
};

export type SocialAccount = {
  id: string;
  brandId: string;
  provider: "INSTAGRAM" | "FACEBOOK";
  externalId: string;
  accountName?: string | null;
  username: string | null;
  profilePictureUrl?: string | null;
  pageId?: string | null;
  instagramBusinessId?: string | null;
  tokenExpiresAt?: string | null;
  webhookStatus?: string;
  isActive: boolean;
  permissions: string[];
};

export type Automation = {
  id: string;
  brandId: string;
  name: string;
  status: "DRAFT" | "LIVE" | "PAUSED" | "ARCHIVED";
  triggerType: string;
  triggerRules: Record<string, unknown>;
  triggerRuleRows?: Array<{
    id: string;
    type: string;
    operator: string;
    value: string | null;
    values: string[];
    caseSensitive: boolean;
    negated: boolean;
  }>;
  nodes?: Array<{ id: string; type: string; config: unknown; position: unknown; nextNodeIds: string[] }>;
};

export type Lead = {
  id: string;
  brandId: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  socialHandle: string | null;
  score: number;
  tags: string[];
  createdAt: string;
};

export type AnalyticsTotal = {
  type: string;
  value: string | number | null;
};

export type AnalyticsEvent = {
  id: string;
  brandId: string;
  type: string;
  value: string | number;
  occurredAt: string;
};

export type Template = {
  id: string;
  brandId: string;
  name: string;
  category: string;
  content: Record<string, unknown>;
  isPublic: boolean;
  updatedAt: string;
};

export type Message = {
  id: string;
  direction: string;
  senderId: string | null;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
};

export type Conversation = {
  id: string;
  brandId: string;
  externalId: string;
  status: string;
  labels: string[];
  messages: Message[];
  updatedAt: string;
};

export type ExecutionLog = {
  id: string;
  brandId: string;
  executionId: string | null;
  workflowRunId: string | null;
  nodeId: string | null;
  level: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

export type MessageDelivery = {
  id: string;
  brandId: string;
  executionId: string | null;
  workflowRunId: string | null;
  socialAccountId: string | null;
  conversationId: string | null;
  externalConversationId: string | null;
  direction: string;
  provider: string;
  status: string;
  providerMessageId: string | null;
  messageBody: string;
  metadata: unknown;
  errorReason: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
};

export type AutomationExecution = {
  id: string;
  brandId: string;
  automationId: string;
  webhookEventId: string | null;
  workflowRunId: string | null;
  triggerSource: string;
  triggerValue: string | null;
  status: string;
  currentNodeId: string | null;
  retryCount: number;
  failureReason: string | null;
  startedAt: string;
  completedAt: string | null;
  automation: Automation;
  workflowRun?: {
    id: string;
    status: string;
    triggerType: string;
    startedAt: string;
    completedAt: string | null;
    logs: ExecutionLog[];
  } | null;
  deliveries: MessageDelivery[];
  logs: ExecutionLog[];
};

export type WebhookEvent = {
  id: string;
  brandId: string;
  provider: string;
  eventType: string;
  socialAccountId: string | null;
  externalId: string | null;
  externalConversationId: string | null;
  rawPayload: unknown;
  signature: string | null;
  status: string;
  retryCount: number;
  failureReason: string | null;
  receivedAt: string;
  processedAt: string | null;
  socialAccount?: SocialAccount | null;
};

export type ReelAutomationConfig = {
  id: string;
  workspaceId: string;
  socialAccountId: string;
  reelId: string;
  mediaId: string;
  keyword: string;
  dmTemplate: string;
  commentReply: string | null;
  enabled: boolean;
  contentUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReelCard = {
  id: string;
  brandId: string;
  socialAccountId: string;
  provider: string;
  externalId: string;
  accountName: string | null;
  username: string | null;
  profilePictureUrl: string | null;
  instagramBusinessId: string | null;
  mediaId: string;
  mediaType: string;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  timestamp: string | null;
  likeCount: number | null;
  commentsCount: number | null;
  configured: boolean;
  config: ReelAutomationConfig | null;
  recentExecutions: Array<{
    id: string;
    status: string;
    triggerKeyword: string;
    commentText: string;
    commenterName: string | null;
    startedAt: string;
    completedAt: string | null;
    failureReason: string | null;
  }>;
};

export type ReelDashboard = {
  brandId: string;
  accounts: SocialAccount[];
  reels: ReelCard[];
  syncErrors: string[];
};

export type MetaPageConnection = {
  id: string;
  name: string;
  access_token: string;
  picture_url: string | null;
  token_expires_at: string | null;
  tasks: string[];
  instagram_business_account: {
    id: string;
    username: string | null;
    profile_picture_url: string | null;
  } | null;
};

export type MetaOAuthSession = {
  status: "pending" | "ready" | "expired" | "empty";
  permissions: string[];
  expiresAt: string | null;
  pages: MetaPageConnection[];
};

export type DashboardData = {
  brand: Brand | null;
  stats: AnalyticsTotal[];
  leads: number;
  connectedAccounts: number;
  automations: Automation[];
};

async function apiFetch<T>(path: string, baseUrl: string = API_URL): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown, baseUrl: string = API_URL): Promise<T> {
  const csrfResponse = await fetch(`${baseUrl}/api/csrf`, { credentials: "include" });
  const csrfJson = (await csrfResponse.json()) as { csrfToken: string };
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-csrf-token": csrfJson.csrfToken
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.clone().json();
      detail = typeof payload?.error === "string" ? ` - ${payload.error}` : "";
    } catch {
      try {
        const text = await response.text();
        detail = text ? ` - ${text}` : "";
      } catch {
        detail = "";
      }
    }
    throw new Error(`Request failed: ${response.status} ${response.statusText}${detail}`);
  }

  return response.json() as Promise<T>;
}

function withBrand(path: string, brandId?: string | null) {
  if (!brandId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}brandId=${encodeURIComponent(brandId)}`;
}

export function useBrands() {
  const setBrands = useAppStore((state) => state.setBrands);
  return useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const brands = await apiFetch<Brand[]>("/api/brands");
      setBrands(
        brands.map((brand) => ({
          id: brand.id,
          name: brand.name,
          status: brand.socialAccounts?.some((account) => account.isActive) ? "connected" : "needs_reconnect",
          instagram: brand.socialAccounts?.find((account) => account.provider === "INSTAGRAM")?.username ?? "Instagram not connected",
          facebook: brand.socialAccounts?.find((account) => account.provider === "FACEBOOK")?.username ?? "Facebook not connected"
        }))
      );
      return brands;
    }
  });
}

export function useActiveBrandId() {
  const activeBrandId = useAppStore((state) => state.activeBrandId);
  const brandsQuery = useBrands();
  return activeBrandId ?? brandsQuery.data?.[0]?.id ?? null;
}

export function useDashboard() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["dashboard", brandId],
    queryFn: () => apiFetch<DashboardData>(withBrand("/api/dashboard", brandId)),
    enabled: brandId !== null
  });
}

export function useAccounts() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["accounts", brandId],
    queryFn: () => apiFetch<SocialAccount[]>(withBrand("/api/accounts", brandId)),
    enabled: brandId !== null
  });
}

export function useAutomations() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["automations", brandId],
    queryFn: () => apiFetch<Automation[]>(withBrand("/api/automations", brandId)),
    enabled: brandId !== null
  });
}

export function useCreateAutomation() {
  const brandId = useActiveBrandId();
  return useMutation({
    mutationFn: (body: { name: string; keyword: string; replyMessage?: string; status?: "DRAFT" | "LIVE" }) =>
      apiPost<Automation>("/api/automations", { ...body, brandId })
  });
}

export function useInbox() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["inbox", brandId],
    queryFn: () => apiFetch<Conversation[]>(withBrand("/api/inbox", brandId)),
    enabled: brandId !== null,
    refetchInterval: 15_000
  });
}

export function useLeads() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["leads", brandId],
    queryFn: () => apiFetch<Lead[]>(withBrand("/api/leads", brandId)),
    enabled: brandId !== null
  });
}

export function useAnalytics() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["analytics", brandId],
    queryFn: () => apiFetch<{ events: AnalyticsEvent[]; totals: AnalyticsTotal[] }>(withBrand("/api/analytics", brandId)),
    enabled: brandId !== null
  });
}

export function useTemplates() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["templates", brandId],
    queryFn: () => apiFetch<Template[]>(withBrand("/api/templates", brandId)),
    enabled: brandId !== null
  });
}

export function useExecutions() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["executions", brandId],
    queryFn: () => apiFetch<AutomationExecution[]>(withBrand("/api/executions", brandId)),
    enabled: brandId !== null,
    refetchInterval: 5000
  });
}

export function useWebhooks() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["webhooks", brandId],
    queryFn: () => apiFetch<WebhookEvent[]>(withBrand("/api/webhooks", brandId)),
    enabled: brandId !== null,
    refetchInterval: 5000
  });
}

export function useReels() {
  const brandId = useActiveBrandId();
  return useQuery({
    queryKey: ["reels", brandId],
    queryFn: () => apiFetch<ReelDashboard>(withBrand("/api/reels", brandId)),
    enabled: brandId !== null,
    refetchInterval: 20_000
  });
}

export function useSaveReelAutomation() {
  const brandId = useActiveBrandId();
  return useMutation({
    mutationFn: (body: {
      reelId: string;
      socialAccountId: string;
      mediaId: string;
      keyword: string;
      dmTemplate: string;
      commentReply: string;
      enabled: boolean;
      contentUrl?: string | null;
    }) => apiPost<ReelAutomationConfig>("/api/automations/reel", { ...body, workspaceId: brandId })
  });
}

export function useMetaOAuthSession() {
  return useQuery({
    queryKey: ["meta-oauth-session"],
    queryFn: () => apiFetch<MetaOAuthSession>("/api/meta/oauth/session", META_API_URL),
    refetchInterval: 5_000
  });
}

export async function startMetaOAuth(brandId?: string | null) {
  const url = new URL(`${META_API_URL}/api/meta/oauth/start`);
  if (brandId) url.searchParams.set("brandId", brandId);

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.clone().json();
      detail = typeof payload?.error === "string" ? ` - ${payload.error}` : "";
    } catch {
      try {
        const text = await response.text();
        detail = text ? ` - ${text}` : "";
      } catch {
        detail = "";
      }
    }
    throw new Error(`Request failed: ${response.status} ${response.statusText}${detail}`);
  }

  return response.json() as Promise<{ authUrl: string }>;
}

export function useCompleteMetaOAuth() {
  return useMutation({
    mutationFn: (body: { brandId: string; selectedPageIds: string[] }) =>
      apiPost<{ ok: boolean; connected: number; brandId: string }>("/api/meta/oauth/complete", body, META_API_URL)
  });
}

export function useDisconnectMetaAccount() {
  return useMutation({
    mutationFn: (accountId: string) => apiPost<{ ok: boolean }>(`/api/meta/accounts/${accountId}/disconnect`, undefined, META_API_URL)
  });
}

export function useReconnectMetaAccount() {
  return useMutation({
    mutationFn: (accountId: string) => apiPost<{ authUrl: string }>(`/api/meta/accounts/${accountId}/reconnect`, undefined, META_API_URL)
  });
}
