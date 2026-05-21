import { Queue, Worker, JobsOptions, QueueEvents } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../config/env.js";
import {
  deliverMessageById,
  processIncomingWebhook,
  processWebhookEventById,
  refreshBrandAnalytics
} from "../services/automation-engine.service.js";

const connection = env.DISABLE_QUEUES ? null : new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

export type WebhookEventJob = {
  webhookEventId: string;
};

export type AutomationExecutionJob = {
  executionId: string;
};

export type MessageDeliveryJob = {
  deliveryId: string;
};

export type AnalyticsJob = {
  brandId: string;
};

const jobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: 1_000,
  removeOnFail: 5_000
};

export const webhookQueue = connection ? new Queue<WebhookEventJob>("webhook-events", { connection }) : null;
export const automationExecutionQueue = connection ? new Queue<AutomationExecutionJob>("automation-executions", { connection }) : null;
export const messageDeliveryQueue = connection ? new Queue<MessageDeliveryJob>("message-deliveries", { connection }) : null;
export const analyticsQueue = connection ? new Queue<AnalyticsJob>("analytics-updates", { connection }) : null;
export const deadLetterQueue = connection ? new Queue("automation-dead-letter", { connection }) : null;

export async function enqueueWebhookEvent(job: { brandId: string; provider: string; eventType: string; payload: unknown; socialAccountId?: string | null; externalConversationId?: string | null; externalId?: string | null; signature?: string | null; }) {
  const webhookEvent = await processIncomingWebhook(job);
  if (!webhookQueue) {
    await processWebhookEventById(webhookEvent.id);
    return webhookEvent;
  }

  await webhookQueue.add("process", { webhookEventId: webhookEvent.id }, jobOptions);
  return webhookEvent;
}

export async function enqueueAutomationExecution(executionId: string) {
  if (!automationExecutionQueue) {
    return null;
  }

  return automationExecutionQueue.add("execute", { executionId }, jobOptions);
}

export async function enqueueMessageDelivery(deliveryId: string) {
  if (!messageDeliveryQueue) {
    await deliverMessageById(deliveryId);
    return null;
  }

  return messageDeliveryQueue.add("deliver", { deliveryId }, jobOptions);
}

export async function enqueueAnalyticsUpdate(brandId: string) {
  if (!analyticsQueue) {
    await refreshBrandAnalytics(brandId);
    return null;
  }

  return analyticsQueue.add("refresh", { brandId }, jobOptions);
}

function trackQueueFailures(queueName: string, queueEvents: QueueEvents) {
  queueEvents.on("failed", async ({ jobId, failedReason }) => {
    if (deadLetterQueue) {
      await deadLetterQueue.add("failed", { queueName, jobId, failedReason, occurredAt: new Date().toISOString() }, { removeOnComplete: 500 });
    }
  });
}

export function startAutomationWorker() {
  if (!connection) {
    console.info("Automation queue disabled; processing webhook events inline.");
    return null;
  }

  const webhookWorker = new Worker<WebhookEventJob>(
    "webhook-events",
    async (job) => processWebhookEventById(job.data.webhookEventId),
    { connection, concurrency: 24 }
  );

  const executionWorker = new Worker<AutomationExecutionJob>(
    "automation-executions",
    async (job) => {
      // execution IDs are already handled in the webhook pipeline for now;
      // this queue keeps the architecture production-grade and ready for
      // split-step orchestration without duplicating writes.
      return job.data.executionId;
    },
    { connection, concurrency: 12 }
  );

  const deliveryWorker = new Worker<MessageDeliveryJob>(
    "message-deliveries",
    async (job) => deliverMessageById(job.data.deliveryId),
    { connection, concurrency: 12 }
  );

  const analyticsWorker = new Worker<AnalyticsJob>(
    "analytics-updates",
    async (job) => refreshBrandAnalytics(job.data.brandId),
    { connection, concurrency: 4 }
  );

  trackQueueFailures("webhook-events", new QueueEvents("webhook-events", { connection }));
  trackQueueFailures("automation-executions", new QueueEvents("automation-executions", { connection }));
  trackQueueFailures("message-deliveries", new QueueEvents("message-deliveries", { connection }));
  trackQueueFailures("analytics-updates", new QueueEvents("analytics-updates", { connection }));

  return { webhookWorker, executionWorker, deliveryWorker, analyticsWorker };
}
