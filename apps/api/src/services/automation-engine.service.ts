import { AutomationStatus, ConversationStatus, SocialProvider } from "@prisma/client";
import { prisma } from "../db.js";
import { env } from "../config/env.js";
import { emitBrandEvent } from "../realtime.js";
import { decryptToken } from "../security/crypto.js";
import { generateAiReply } from "./ai.service.js";
import { sendMetaDirectMessage } from "./meta-delivery.service.js";

type WebhookEventRecord = {
  id: string;
  brandId: string;
  provider: string;
  eventType: string;
  socialAccountId: string | null;
  externalConversationId: string | null;
  rawPayload: unknown;
  retryCount: number;
  status: string;
};

type AutomationNodeLike = {
  id: string;
  type: string;
  config: unknown;
  nextNodeIds: string[];
  position: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function textFromPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.message,
    record.text,
    record.comment,
    record.message_text,
    (record.value as Record<string, unknown> | undefined)?.text,
    (record.value as Record<string, unknown> | undefined)?.message,
    (record.value as Record<string, unknown> | undefined)?.comment_text
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
}

function authorFromPayload(payload: unknown): { id: string | null; name: string | null; handle: string | null } {
  if (!payload || typeof payload !== "object") return { id: null, name: null, handle: null };
  const record = payload as Record<string, unknown>;
  const value = (record.value as Record<string, unknown> | undefined) ?? record;
  const sender = (record.sender as Record<string, unknown> | undefined) ?? (value.sender as Record<string, unknown> | undefined) ?? {};
  const from = (record.from as Record<string, unknown> | undefined) ?? (value.from as Record<string, unknown> | undefined) ?? {};
  const user = (record.user as Record<string, unknown> | undefined) ?? (value.user as Record<string, unknown> | undefined) ?? {};

  return {
    id: String(sender.id ?? from.id ?? user.id ?? record.user_id ?? record.sender_id ?? "") || null,
    name: String(sender.name ?? from.name ?? user.name ?? record.username ?? record.name ?? "") || null,
    handle: String(sender.username ?? from.username ?? user.username ?? record.handle ?? record.username ?? "") || null
  };
}

function extractMediaIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const media = record.media && typeof record.media === "object" ? (record.media as Record<string, unknown>) : null;
  const value = record.value && typeof record.value === "object" ? (record.value as Record<string, unknown>) : null;
  const valueMedia = value?.media && typeof value.media === "object" ? (value.media as Record<string, unknown>) : null;
  const candidates = [
    record.media_id,
    record.mediaId,
    media?.id,
    valueMedia?.id,
    value?.media_id,
    value?.mediaId,
    record.object === "instagram" ? valueMedia?.id : null
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

function extractCommentIdFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.comment_id,
    record.commentId,
    record.id,
    (record.value as Record<string, unknown> | undefined)?.comment_id,
    (record.value as Record<string, unknown> | undefined)?.commentId,
    (record.value as Record<string, unknown> | undefined)?.id
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function replyToMetaComment(args: {
  provider: string;
  accessToken: string;
  commentId: string;
  message: string;
}) {
  const path = args.provider === "facebook" ? `/${args.commentId}/comments` : `/${args.commentId}/replies`;
  const url = new URL(`https://graph.facebook.com/${env.META_GRAPH_VERSION}${path}`);
  url.searchParams.set("access_token", args.accessToken);

  const body = new URLSearchParams();
  body.set("message", args.message);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Meta comment reply failed: ${response.status} ${payload}`);
  }

  return response.json() as Promise<{ id?: string }>;
}

function externalConversationId(event: WebhookEventRecord) {
  const author = authorFromPayload(event.rawPayload);
  return event.externalConversationId ?? author.id ?? `${event.provider}:${event.eventType}:${event.id}`;
}

function normalizeAutomationRules(automation: {
  triggerType: string;
  triggerRules: unknown;
  triggerRuleRows?: Array<{ type: string; operator: string; value: string | null; values: string[]; caseSensitive: boolean; negated: boolean }>;
}) {
  const raw = typeof automation.triggerRules === "object" && automation.triggerRules ? (automation.triggerRules as Record<string, unknown>) : {};
  const values = Array.isArray(raw.keywords) ? raw.keywords.map((value) => String(value)) : [];
  const rows = automation.triggerRuleRows ?? [];
  const rowKeywords = rows.filter((row) => row.type === "keyword").flatMap((row) => (row.values.length ? row.values : row.value ? [row.value] : []));

  return {
    type: automation.triggerType,
    mode: String(raw.match ?? raw.mode ?? "contains"),
    caseSensitive: Boolean(raw.caseSensitive),
    keywords: [...values, ...rowKeywords].filter(Boolean),
    regex: typeof raw.pattern === "string" ? raw.pattern : typeof raw.regex === "string" ? raw.regex : null,
    multiMatch: String(raw.multiMatch ?? "any"),
    channel: String(raw.channel ?? raw.platform ?? "")
  };
}

function matchesRule(text: string, rule: ReturnType<typeof normalizeAutomationRules>) {
  if (!rule.keywords.length && !rule.regex) return true;
  const input = rule.caseSensitive ? text : text.toLowerCase();
  const keywords = rule.caseSensitive ? rule.keywords : rule.keywords.map((keyword) => keyword.toLowerCase());

  let matched = false;
  if (rule.regex) {
    try {
      const regex = new RegExp(rule.regex, rule.caseSensitive ? undefined : "i");
      matched = regex.test(text);
    } catch {
      matched = false;
    }
  } else if (rule.mode === "exact") {
    matched = keywords.some((keyword) => input === keyword);
  } else {
    matched = keywords.some((keyword) => input.includes(keyword));
  }

  if (rule.multiMatch === "all" && keywords.length > 1) {
    matched = keywords.every((keyword) => input.includes(keyword));
  }

  return matched;
}

function isCompatibleEvent(triggerType: string, eventType: string) {
  const type = triggerType.toLowerCase();
  const event = eventType.toLowerCase();
  if (type.includes("keyword")) return event === "comment" || event === "dm" || event === "messenger" || event === "story_reply";
  if (type.includes("comment")) return event === "comment";
  if (type.includes("story")) return event === "story_reply";
  if (type.includes("messenger")) return event === "messenger";
  if (type.includes("dm")) return event === "dm";
  return true;
}

async function logExecution(params: {
  brandId: string;
  executionId?: string;
  workflowRunId?: string;
  nodeId?: string | null;
  level?: string;
  message: string;
  payload?: unknown;
}) {
  const log = await prisma.executionLog.create({
    data: {
      brandId: params.brandId,
      executionId: params.executionId,
      workflowRunId: params.workflowRunId,
      nodeId: params.nodeId ?? undefined,
      level: params.level ?? "info",
      message: params.message,
      payload: params.payload as never
    }
  });

  emitBrandEvent(params.brandId, "execution:log", log);
  return log;
}

async function updateAnalytics(brandId: string, type: string, value = 1, metadata?: Record<string, unknown>) {
  const event = await prisma.analyticsEvent.create({
    data: {
      brandId,
      type,
      value,
      metadata: metadata as never
    }
  });
  emitBrandEvent(brandId, "analytics:updated", { type, value, event });
  return event;
}

async function ensureConversation(params: {
  brandId: string;
  socialAccountId?: string | null;
  externalId: string;
}) {
  return prisma.conversation.upsert({
    where: {
      brandId_externalId: {
        brandId: params.brandId,
        externalId: params.externalId
      }
    },
    update: {
      socialAccountId: params.socialAccountId ?? undefined
    },
    create: {
      brandId: params.brandId,
      socialAccountId: params.socialAccountId ?? null,
      externalId: params.externalId,
      labels: []
    },
    include: { messages: { orderBy: { createdAt: "asc" } }, socialAccount: true }
  });
}

async function ensureLead(params: {
  brandId: string;
  source: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  socialHandle?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const orConditions: Array<{ email?: string; phone?: string; socialHandle?: string }> = [];
  if (params.email) orConditions.push({ email: params.email });
  if (params.phone) orConditions.push({ phone: params.phone });
  if (params.socialHandle) orConditions.push({ socialHandle: params.socialHandle });

  const lead = await prisma.lead.findFirst({
    where: {
      brandId: params.brandId,
      OR: orConditions.length ? orConditions : undefined
    }
  });

  if (lead) {
    return prisma.lead.update({
      where: { id: lead.id },
      data: {
        name: params.name ?? lead.name ?? undefined,
        email: params.email ?? lead.email ?? undefined,
        phone: params.phone ?? lead.phone ?? undefined,
        socialHandle: params.socialHandle ?? lead.socialHandle ?? undefined,
        metadata: params.metadata as never
      }
    });
  }

  return prisma.lead.create({
    data: {
      brandId: params.brandId,
      source: params.source,
      name: params.name ?? null,
      email: params.email ?? null,
      phone: params.phone ?? null,
      socialHandle: params.socialHandle ?? null,
      metadata: params.metadata as never,
      tags: []
    }
  });
}

async function recordLeadEvent(params: {
  brandId: string;
  leadId?: string | null;
  webhookEventId?: string | null;
  source: string;
  eventType: string;
  payload?: unknown;
}) {
  return prisma.leadEvent.create({
    data: {
      brandId: params.brandId,
      leadId: params.leadId ?? undefined,
      webhookEventId: params.webhookEventId ?? undefined,
      source: params.source,
      eventType: params.eventType,
      payload: params.payload as never
    }
  });
}

async function processReelCommentAutomations(event: WebhookEventRecord, triggerText: string) {
  if (event.eventType !== "comment") return false;

  const mediaId = extractMediaIdFromPayload(event.rawPayload);
  if (!mediaId) return false;

  const author = authorFromPayload(event.rawPayload);
  const commentId = extractCommentIdFromPayload(event.rawPayload);
  const configs = await prisma.instagramMediaAutomation.findMany({
    where: {
      brandId: event.brandId,
      socialAccountId: event.socialAccountId ?? undefined,
      mediaId,
      enabled: true
    },
    include: { socialAccount: true }
  });

  const legacyReelConfigs = configs.length
    ? []
    : await prisma.reelAutomation.findMany({
        where: {
          workspaceId: event.brandId,
          socialAccountId: event.socialAccountId ?? undefined,
          mediaId,
          enabled: true
        },
        include: { socialAccount: true }
      });

  const effectiveConfigs =
    configs.length || !legacyReelConfigs.length
      ? configs
      : await Promise.all(
          legacyReelConfigs.map(async (legacyConfig) =>
            prisma.instagramMediaAutomation.upsert({
              where: {
                socialAccountId_mediaId: {
                  socialAccountId: legacyConfig.socialAccountId ?? event.socialAccountId ?? "",
                  mediaId: legacyConfig.mediaId
                }
              },
              update: {
                brandId: event.brandId,
                socialAccountId: legacyConfig.socialAccountId ?? event.socialAccountId ?? undefined,
                mediaId: legacyConfig.mediaId,
                keyword: legacyConfig.keyword,
                dmTemplate: legacyConfig.dmTemplate,
                commentReply: legacyConfig.commentReply,
                enabled: legacyConfig.enabled,
                matchMode: "contains",
                aiEnabled: false,
                delaySeconds: 0
              },
              create: {
                brandId: event.brandId,
                socialAccountId: legacyConfig.socialAccountId ?? event.socialAccountId ?? "",
                mediaId: legacyConfig.mediaId,
                keyword: legacyConfig.keyword,
                dmTemplate: legacyConfig.dmTemplate,
                commentReply: legacyConfig.commentReply,
                enabled: legacyConfig.enabled,
                matchMode: "contains",
                aiEnabled: false,
                delaySeconds: 0
              },
              include: { socialAccount: true }
            })
          )
        );

  const matchedConfigs = effectiveConfigs.filter((config) => {
    const keyword = config.keyword.trim();
    if (!keyword) return false;
    const source = config.matchMode === "exact" ? triggerText.toLowerCase().trim() : triggerText.toLowerCase();
    const expected = keyword.toLowerCase();
    return config.matchMode === "exact" ? source === expected : source.includes(expected);
  });

  if (!matchedConfigs.length) return false;

  const conversationId = `${event.provider}:${mediaId}:${author.id ?? author.handle ?? event.id}`;
  const conversation = await ensureConversation({
    brandId: event.brandId,
    socialAccountId: event.socialAccountId,
    externalId: conversationId
  });

  const lead = await ensureLead({
    brandId: event.brandId,
    source: `${event.provider}_reel_comment`,
    name: author.name,
    socialHandle: author.handle,
    metadata: {
      mediaId,
      eventId: event.id,
      triggerText,
      provider: event.provider
    }
  });

  await recordLeadEvent({
    brandId: event.brandId,
    leadId: lead.id,
    webhookEventId: event.id,
    source: `${event.provider}_reel_comment`,
    eventType: "trigger_received",
    payload: event.rawPayload
  });

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      senderId: author.id,
      body: triggerText || JSON.stringify(event.rawPayload),
      metadata: {
        eventId: event.id,
        mediaId,
        commentId
      } as never
    }
  });

  await updateAnalytics(event.brandId, "comments_received", 1, { eventId: event.id, mediaId });
  await updateAnalytics(event.brandId, "reel_automation_triggers", matchedConfigs.length, { eventId: event.id, mediaId });

  for (const config of matchedConfigs) {
    const execution = await prisma.reelAutomationExecution.create({
      data: {
        brandId: event.brandId,
        socialAccountId: config.socialAccountId,
        instagramMediaAutomationId: config.id,
        webhookEventId: event.id,
        leadId: lead.id,
        triggerKeyword: config.keyword,
        commentText: triggerText,
        commenterId: author.id,
        commenterName: author.name,
        commenterHandle: author.handle,
        status: "running"
      }
    });

    await logExecution({
      brandId: event.brandId,
      nodeId: config.id,
      message: `Reel automation matched for media ${config.mediaId}`,
      payload: {
        mediaId,
        keyword: config.keyword,
        aiEnabled: config.aiEnabled,
        delaySeconds: config.delaySeconds
      }
    });

    try {
      if (config.delaySeconds > 0) {
        await sleep(Math.min(config.delaySeconds * 1000, 15000));
      }

      let dmText = config.dmTemplate;
      if (config.aiEnabled) {
        const reply = await generateAiReply({
          brandName: event.brandId,
          channel: event.provider === "facebook" ? "facebook" : "instagram",
          userMessage: triggerText,
          leadName: lead.name ?? undefined,
          offer: config.dmTemplate
        });
        dmText = reply.text;
      }

      const accessToken = decryptToken(config.socialAccount.encryptedAccessToken);
      const messageDelivery = await prisma.messageDelivery.create({
        data: {
          brandId: event.brandId,
          workflowRunId: undefined,
          socialAccountId: config.socialAccountId,
          conversationId: conversation.id,
          externalConversationId: conversation.externalId,
          provider: config.socialAccount.provider === SocialProvider.FACEBOOK ? "facebook" : "instagram",
          messageBody: dmText,
          metadata: {
            mediaId,
            commentId,
            mode: config.aiEnabled ? "ai" : "template"
          } as never,
          status: "queued",
          direction: "outbound"
        }
      });

      try {
        const recipientId = author.id ?? conversation.externalId;
        const response = await sendMetaDirectMessage({
          accessToken,
          provider: config.socialAccount.provider === SocialProvider.FACEBOOK ? "facebook" : "instagram",
          pageId: config.socialAccount.pageId ?? config.socialAccount.externalId,
          instagramBusinessId: config.socialAccount.instagramBusinessId,
          recipientId,
          commentId,
          text: dmText,
          metadata: {
            mediaId,
            commentId,
            keyword: config.keyword,
            automationId: config.id
          }
        });

        await prisma.messageDelivery.update({
          where: { id: messageDelivery.id },
          data: {
            status: "sent",
            providerMessageId: response.message_id ?? null,
            sentAt: new Date(),
            deliveredAt: new Date()
          }
        });
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "outbound",
            senderId: "brand",
            body: dmText,
            aiGenerated: config.aiEnabled,
            metadata: {
              deliveryId: messageDelivery.id,
              providerMessageId: response.message_id,
              mediaId,
              automationId: config.id
            } as never
          }
        });
        await updateAnalytics(event.brandId, "dms_sent", 1, { mediaId, executionId: execution.id });

        if (config.commentReply && commentId) {
          try {
            await replyToMetaComment({
              provider: config.socialAccount.provider === SocialProvider.FACEBOOK ? "facebook" : "instagram",
              accessToken,
              commentId,
              message: config.commentReply
            });
          } catch (replyError) {
            await logExecution({
              brandId: event.brandId,
              message: "Comment reply failed",
              level: "error",
              payload: { reason: replyError instanceof Error ? replyError.message : "Unknown reply failure", commentId }
            });
          }
        }

        if (config.leadTag) {
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              tags: [...new Set([...(lead.tags ?? []), config.leadTag])]
            }
          });
        }

        await prisma.reelAutomationExecution.update({
          where: { id: execution.id },
          data: {
            messageDeliveryId: messageDelivery.id,
            completedAt: new Date(),
            status: "completed"
          }
        });
      } catch (deliveryError) {
        const reason = deliveryError instanceof Error ? deliveryError.message : "Unknown delivery failure";
        await prisma.reelAutomationExecution.update({
          where: { id: execution.id },
          data: {
            status: "failed",
            failureReason: reason,
            completedAt: new Date()
          }
        });
        await logExecution({
          brandId: event.brandId,
          message: "Reel DM delivery failed",
          level: "error",
          payload: { reason, mediaId, keyword: config.keyword }
        });
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown reel automation failure";
      await prisma.reelAutomationExecution.update({
        where: { id: execution.id },
        data: {
          status: "failed",
          failureReason: reason,
          completedAt: new Date()
        }
      });
      await logExecution({
        brandId: event.brandId,
        message: "Reel automation failed",
        level: "error",
        payload: { reason, mediaId, keyword: config.keyword }
      });
    }
  }

  emitBrandEvent(event.brandId, "reel:automation:matched", {
    eventId: event.id,
    mediaId,
    matched: matchedConfigs.length,
    leadId: lead.id,
    conversationId: conversation.id
  });

  return true;
}

async function createMessageDelivery(params: {
  brandId: string;
  executionId: string;
  workflowRunId: string;
  socialAccountId?: string | null;
  conversationId?: string | null;
  externalConversationId?: string | null;
  provider: string;
  messageBody: string;
  metadata?: Record<string, unknown>;
}) {
  const delivery = await prisma.messageDelivery.create({
    data: {
      brandId: params.brandId,
      executionId: params.executionId,
      workflowRunId: params.workflowRunId,
      socialAccountId: params.socialAccountId ?? undefined,
      conversationId: params.conversationId ?? undefined,
      externalConversationId: params.externalConversationId ?? undefined,
      provider: params.provider,
      messageBody: params.messageBody,
      metadata: params.metadata as never,
      status: "queued",
      direction: "outbound"
    }
  });
  emitBrandEvent(params.brandId, "inbox:delivery:queued", delivery);
  const queue = await import("../queues/automation.queue.js");
  if (queue.messageDeliveryQueue) {
    await queue.enqueueMessageDelivery(delivery.id);
  } else {
    await deliverMessageById(delivery.id);
  }
  return delivery;
}

async function executeNode(params: {
  automationId: string;
  brandId: string;
  executionId: string;
  workflowRunId: string;
  event: WebhookEventRecord;
  conversation: Awaited<ReturnType<typeof ensureConversation>>;
  lead?: { id: string; name: string | null; email: string | null; phone: string | null; socialHandle: string | null; tags: string[] } | null;
  node: AutomationNodeLike;
  visited: Set<string>;
  automationName: string;
}) {
  const { node } = params;
  if (params.visited.has(node.id)) return;
  params.visited.add(node.id);

  await logExecution({
    brandId: params.brandId,
    executionId: params.executionId,
    workflowRunId: params.workflowRunId,
    nodeId: node.id,
    message: `Executing node ${node.type}`,
    payload: node.config
  });

  switch (node.type) {
    case "DELAY": {
      const ms = Number((node.config as Record<string, unknown> | null)?.delayMs ?? (node.config as Record<string, unknown> | null)?.seconds ?? 0);
      if (Number.isFinite(ms) && ms > 0) {
        await sleep(Math.min(ms < 1000 ? ms * 1000 : ms, 15000));
      }
      break;
    }
    case "AI_REPLY": {
      const reply = await generateAiReply({
        brandName: params.automationName,
        channel: params.event.provider === "facebook" ? "facebook" : "instagram",
        userMessage: textFromPayload(params.event.rawPayload),
        leadName: params.lead?.name ?? undefined,
        offer: typeof (node.config as Record<string, unknown> | null)?.offer === "string" ? String((node.config as Record<string, unknown>).offer) : undefined
      });

      const delivery = await createMessageDelivery({
        brandId: params.brandId,
        executionId: params.executionId,
        workflowRunId: params.workflowRunId,
        socialAccountId: params.conversation.socialAccountId,
        conversationId: params.conversation.id,
        externalConversationId: params.conversation.externalId,
        provider: params.event.provider,
        messageBody: reply.text,
        metadata: { nodeId: node.id, mode: reply.mode }
      });
      await prisma.executionLog.create({
        data: {
          brandId: params.brandId,
          executionId: params.executionId,
          workflowRunId: params.workflowRunId,
          nodeId: node.id,
          message: "AI reply generated",
          payload: { reply } as never
        }
      });
      emitBrandEvent(params.brandId, "message:delivery:queued", delivery);
      break;
    }
    case "SEND_DM":
    case "SEND_OFFER": {
      const body = String((node.config as Record<string, unknown> | null)?.message ?? (node.config as Record<string, unknown> | null)?.template ?? "Thanks for reaching out. Check your inbox 👋");
      const delivery = await createMessageDelivery({
        brandId: params.brandId,
        executionId: params.executionId,
        workflowRunId: params.workflowRunId,
        socialAccountId: params.conversation.socialAccountId,
        conversationId: params.conversation.id,
        externalConversationId: params.conversation.externalId,
        provider: params.event.provider,
        messageBody: body,
        metadata: { nodeId: node.id, template: node.config }
      });
      emitBrandEvent(params.brandId, "message:delivery:queued", delivery);
      break;
    }
    case "TAG_LEAD":
    case "ASSIGN_LABEL": {
      const label = String((node.config as Record<string, unknown> | null)?.label ?? (node.config as Record<string, unknown> | null)?.tag ?? "Auto Tagged");
      const current = Array.isArray(params.conversation.labels) ? params.conversation.labels : [];
      if (!current.includes(label)) {
        await prisma.conversation.update({
          where: { id: params.conversation.id },
          data: { labels: [...current, label] }
        });
      }
      if (params.lead) {
        await prisma.lead.update({
          where: { id: params.lead.id },
          data: {
            tags: [...new Set([...(params.lead.tags ?? []), label])]
          }
        });
      }
      break;
    }
    case "COLLECT_EMAIL":
    case "SAVE_LEAD": {
      const lead = await ensureLead({
        brandId: params.brandId,
        source: params.event.provider === "facebook" ? "facebook_message" : "instagram_dm",
        name: params.lead?.name ?? authorFromPayload(params.event.rawPayload).name,
        email: typeof (node.config as Record<string, unknown> | null)?.email === "string" ? String((node.config as Record<string, unknown>).email) : params.lead?.email ?? null,
        phone: typeof (node.config as Record<string, unknown> | null)?.phone === "string" ? String((node.config as Record<string, unknown>).phone) : params.lead?.phone ?? null,
        socialHandle: params.lead?.socialHandle ?? authorFromPayload(params.event.rawPayload).handle,
        metadata: {
          collectedBy: node.id,
          sourceEventId: params.event.id
        }
      });
      await recordLeadEvent({
        brandId: params.brandId,
        leadId: lead.id,
        webhookEventId: params.event.id,
        source: params.event.provider,
        eventType: "lead_saved",
        payload: params.event.rawPayload
      });
      emitBrandEvent(params.brandId, "lead:updated", lead);
      break;
    }
    case "WEBHOOK": {
      const url = String((node.config as Record<string, unknown> | null)?.url ?? "");
      if (url) {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brandId: params.brandId,
            automationId: params.automationId,
            executionId: params.executionId,
            workflowRunId: params.workflowRunId,
            event: params.event.rawPayload
          })
        });
      }
      break;
    }
    case "CONDITION": {
      const condition = node.config as Record<string, unknown> | null;
      const sourceText = textFromPayload(params.event.rawPayload).toLowerCase();
      const expected = String(condition?.contains ?? condition?.equals ?? condition?.keyword ?? "").toLowerCase();
      const passed = !expected || sourceText.includes(expected);
      const branchNodes = passed
        ? Array.isArray(condition?.whenTrue)
          ? (condition?.whenTrue as string[])
          : []
        : Array.isArray(condition?.whenFalse)
          ? (condition?.whenFalse as string[])
          : [];
      for (const nextNodeId of branchNodes.length ? branchNodes : node.nextNodeIds) {
        const nextNode = await prisma.automationNode.findUnique({ where: { id: nextNodeId } });
        if (nextNode) {
          await executeNode({
            ...params,
            node: nextNode as AutomationNodeLike
          });
        }
      }
      return;
    }
    default:
      break;
  }

  for (const nextNodeId of node.nextNodeIds) {
    const nextNode = await prisma.automationNode.findUnique({ where: { id: nextNodeId } });
    if (nextNode) {
      await executeNode({
        ...params,
        node: nextNode as AutomationNodeLike
      });
    }
  }
}

export async function processWebhookEventById(webhookEventId: string) {
  const event = (await prisma.webhookEvent.findUnique({
    where: { id: webhookEventId },
    include: {
      socialAccount: true,
      brand: { include: { owner: true } }
    }
  })) as WebhookEventRecord & {
    brand: { id: string; name: string; ownerId: string };
    socialAccount: { id: string; provider: SocialProvider; encryptedAccessToken: string; pageId: string | null; instagramBusinessId: string | null } | null;
  } | null;

  if (!event || event.status === "processed") return;

  try {
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: { status: "processing", retryCount: { increment: 1 } }
    });

    const triggerText = textFromPayload(event.rawPayload);
    const reelHandled = await processReelCommentAutomations(event, triggerText);
    if (reelHandled) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "processed",
          processedAt: new Date(),
          failureReason: null
        }
      });
      emitBrandEvent(event.brandId, "webhook:processed", { webhookEventId: event.id, matched: 1, mode: "reel" });
      return;
    }

    const automationScope = await prisma.automation.findMany({
      where: {
        brandId: event.brandId,
        status: AutomationStatus.LIVE
      },
      include: {
        nodes: true,
        triggerRuleRows: true
      },
      orderBy: { updatedAt: "desc" }
    });

    const matchedAutomations = automationScope.filter((automation) => {
      const rules = normalizeAutomationRules(automation as never);
      if (!isCompatibleEvent(rules.type, event.eventType)) return false;
      return matchesRule(triggerText, rules);
    });

    if (!matchedAutomations.length) {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: "skipped",
          processedAt: new Date(),
          failureReason: "No matching automation"
        }
      });
      emitBrandEvent(event.brandId, "webhook:processed", { webhookEventId: event.id, matched: 0 });
      return;
    }

    for (const automation of matchedAutomations) {
    const execution = await prisma.automationExecution.create({
      data: {
        brandId: event.brandId,
        automationId: automation.id,
        webhookEventId: event.id,
        triggerSource: event.eventType,
        triggerValue: triggerText,
        status: "running"
      }
    });

    const workflowRun = await prisma.workflowRun.create({
      data: {
        brandId: event.brandId,
        automationId: automation.id,
        webhookEventId: event.id,
        executionId: execution.id,
        triggerType: event.eventType,
        status: "running"
      }
    });

    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: { workflowRunId: workflowRun.id }
    });

    await logExecution({
      brandId: event.brandId,
      executionId: execution.id,
      workflowRunId: workflowRun.id,
      message: `Matched automation ${automation.name}`,
      payload: { triggerText, eventType: event.eventType }
    });

    const brandConversationId = externalConversationId(event);
    const conversation = await ensureConversation({
      brandId: event.brandId,
      socialAccountId: event.socialAccountId,
      externalId: brandConversationId
    });

    const author = authorFromPayload(event.rawPayload);
    const lead = await ensureLead({
      brandId: event.brandId,
      source: `${event.provider}_${event.eventType}`,
      name: author.name,
      socialHandle: author.handle,
      metadata: {
        webhookEventId: event.id,
        provider: event.provider,
        eventType: event.eventType,
        externalConversationId: brandConversationId
      }
    });

    await recordLeadEvent({
      brandId: event.brandId,
      leadId: lead.id,
      webhookEventId: event.id,
      source: `${event.provider}_${event.eventType}`,
      eventType: "trigger_received",
      payload: event.rawPayload
    });

    if (event.eventType === "dm" || event.eventType === "messenger") {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "inbound",
          senderId: author.id,
          body: triggerText || JSON.stringify(event.rawPayload),
          metadata: event.rawPayload as never
        }
      });
      await updateAnalytics(event.brandId, "dms_received", 1, { eventId: event.id });
    } else if (event.eventType === "comment") {
      await updateAnalytics(event.brandId, "comments_received", 1, { eventId: event.id });
    } else if (event.eventType === "story_reply") {
      await updateAnalytics(event.brandId, "story_replies", 1, { eventId: event.id });
    }

    const startNodes = automation.nodes.filter((node) =>
      ["COMMENT_TRIGGER", "DM_TRIGGER", "STORY_REPLY_TRIGGER", "KEYWORD_TRIGGER"].includes(node.type)
    );
    const startNodeIds = startNodes.length ? startNodes.map((node) => node.id) : automation.nodes.length ? [automation.nodes[0].id] : [];
    const nodeMap = new Map(automation.nodes.map((node) => [node.id, node as AutomationNodeLike]));
    const visited = new Set<string>();

    for (const startNodeId of startNodeIds) {
      const startNode = nodeMap.get(startNodeId);
      if (!startNode) continue;
      await executeNode({
        automationId: automation.id,
        brandId: event.brandId,
        executionId: execution.id,
        workflowRunId: workflowRun.id,
        event,
        conversation,
        lead,
        node: startNode,
        visited,
        automationName: automation.name
      });
    }

    await prisma.automationExecution.update({
      where: { id: execution.id },
      data: {
        status: "completed",
        completedAt: new Date()
      }
    });

    await prisma.workflowRun.update({
      where: { id: workflowRun.id },
      data: {
        status: "completed",
        completedAt: new Date()
      }
    });

    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "processed",
        processedAt: new Date(),
        failureReason: null
      }
    });

      await updateAnalytics(event.brandId, "automation_executions", 1, {
        automationId: automation.id,
        executionId: execution.id
      });
      emitBrandEvent(event.brandId, "execution:completed", {
        executionId: execution.id,
        workflowRunId: workflowRun.id,
        automationId: automation.id,
        brandId: event.brandId
      });
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown webhook processing failure";
    await prisma.webhookEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        processedAt: new Date(),
        failureReason: reason
      }
    });
    await logExecution({
      brandId: event.brandId,
      message: "Webhook processing failed",
      level: "error",
      payload: { webhookEventId: event.id, reason }
    });
    emitBrandEvent(event.brandId, "webhook:failed", { webhookEventId: event.id, reason });
    throw error;
  }
}

export async function deliverMessageById(deliveryId: string) {
  const delivery = await prisma.messageDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      brand: true,
      socialAccount: true,
      execution: { include: { automation: true } },
      workflowRun: true
    }
  });

  if (!delivery || delivery.status === "sent") return;
  if (!delivery.socialAccount) {
    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: { status: "failed", errorReason: "Missing social account", sentAt: new Date() }
    });
    return;
  }

  try {
    const accessToken = decryptToken(delivery.socialAccount.encryptedAccessToken);
    const recipientId = delivery.externalConversationId ?? delivery.conversationId ?? delivery.socialAccount.externalId;
    const response = await sendMetaDirectMessage({
      accessToken,
      provider: delivery.provider,
      pageId: delivery.socialAccount.pageId ?? delivery.socialAccount.externalId,
      instagramBusinessId: delivery.socialAccount.instagramBusinessId,
      recipientId,
      text: delivery.messageBody,
      metadata: delivery.metadata as Record<string, unknown> | undefined
    });

    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "sent",
        providerMessageId: response.message_id ?? null,
        sentAt: new Date(),
        deliveredAt: new Date()
      }
    });

    if (delivery.conversationId) {
      await prisma.message.create({
        data: {
          conversationId: delivery.conversationId,
          direction: "outbound",
          senderId: "brand",
          body: delivery.messageBody,
          aiGenerated: Boolean((delivery.metadata as Record<string, unknown> | undefined)?.mode),
          metadata: {
            deliveryId: delivery.id,
            providerMessageId: response.message_id,
            provider: delivery.provider
          } as never
        }
      });
    }

    await updateAnalytics(delivery.brandId, "dms_sent", 1, {
      deliveryId: delivery.id,
      providerMessageId: response.message_id
    });
    emitBrandEvent(delivery.brandId, "inbox:message:sent", delivery);
    emitBrandEvent(delivery.brandId, "message:delivery:sent", delivery);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown delivery failure";
    await prisma.messageDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        errorReason: reason,
        sentAt: new Date()
      }
    });
    await logExecution({
      brandId: delivery.brandId,
      executionId: delivery.executionId ?? undefined,
      workflowRunId: delivery.workflowRunId ?? undefined,
      message: "Message delivery failed",
      level: "error",
      payload: { reason, deliveryId: delivery.id }
    });
    throw error;
  }
}

export async function processWebhookEventByData(args: { brandId: string; eventType: string; provider: string; payload: unknown; socialAccountId?: string | null; externalConversationId?: string | null; externalId?: string | null; signature?: string | null; }) {
  const record = await prisma.webhookEvent.create({
    data: {
      brandId: args.brandId,
      provider: args.provider,
      eventType: args.eventType,
      socialAccountId: args.socialAccountId ?? undefined,
      externalConversationId: args.externalConversationId ?? undefined,
      externalId: args.externalId ?? undefined,
      rawPayload: args.payload as never,
      signature: args.signature ?? undefined,
      status: "received"
    }
  });

  emitBrandEvent(args.brandId, "webhook:received", record);
  return record;
}

export async function refreshBrandAnalytics(brandId: string) {
  const totals = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { brandId },
    _sum: { value: true }
  });

  emitBrandEvent(brandId, "analytics:refreshed", totals);
  return totals;
}

export async function processIncomingWebhook(record: {
  brandId: string;
  provider: string;
  eventType: string;
  payload: unknown;
  socialAccountId?: string | null;
  externalConversationId?: string | null;
  externalId?: string | null;
  signature?: string | null;
}) {
  const webhookEvent = await processWebhookEventByData(record);
  await logExecution({
    brandId: record.brandId,
    message: "Webhook event received",
    payload: { webhookEventId: webhookEvent.id, provider: record.provider, eventType: record.eventType }
  });
  return webhookEvent;
}
