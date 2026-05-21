ALTER TABLE "SocialAccount"
ADD COLUMN IF NOT EXISTS "accountName" TEXT,
ADD COLUMN IF NOT EXISTS "profilePictureUrl" TEXT,
ADD COLUMN IF NOT EXISTS "webhookStatus" TEXT NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "socialAccountId" TEXT,
    "externalId" TEXT,
    "externalConversationId" TEXT,
    "rawPayload" JSONB NOT NULL,
    "signature" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TriggerRule" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "value" TEXT,
    "values" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "negated" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TriggerRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowRun" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "executionId" TEXT,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AutomationExecution" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "webhookEventId" TEXT,
    "workflowRunId" TEXT,
    "triggerSource" TEXT NOT NULL,
    "triggerValue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "currentNodeId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ExecutionLog" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "executionId" TEXT,
    "workflowRunId" TEXT,
    "nodeId" TEXT,
    "level" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageDelivery" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "executionId" TEXT,
    "workflowRunId" TEXT,
    "socialAccountId" TEXT,
    "conversationId" TEXT,
    "externalConversationId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'outbound',
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "messageBody" TEXT NOT NULL,
    "metadata" JSONB,
    "errorReason" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadEvent" (
    "id" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "leadId" TEXT,
    "webhookEventId" TEXT,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WebhookEvent_brandId_provider_eventType_receivedAt_idx" ON "WebhookEvent"("brandId", "provider", "eventType", "receivedAt");
CREATE INDEX IF NOT EXISTS "WebhookEvent_socialAccountId_receivedAt_idx" ON "WebhookEvent"("socialAccountId", "receivedAt");
CREATE INDEX IF NOT EXISTS "TriggerRule_automationId_type_idx" ON "TriggerRule"("automationId", "type");
CREATE INDEX IF NOT EXISTS "WorkflowRun_brandId_automationId_status_startedAt_idx" ON "WorkflowRun"("brandId", "automationId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "AutomationExecution_brandId_automationId_status_startedAt_idx" ON "AutomationExecution"("brandId", "automationId", "status", "startedAt");
CREATE INDEX IF NOT EXISTS "ExecutionLog_brandId_createdAt_idx" ON "ExecutionLog"("brandId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageDelivery_brandId_status_sentAt_idx" ON "MessageDelivery"("brandId", "status", "sentAt");
CREATE INDEX IF NOT EXISTS "LeadEvent_brandId_source_eventType_createdAt_idx" ON "LeadEvent"("brandId", "source", "eventType", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEvent_brandId_fkey') THEN
        ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebhookEvent_socialAccountId_fkey') THEN
        ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TriggerRule_automationId_fkey') THEN
        ALTER TABLE "TriggerRule" ADD CONSTRAINT "TriggerRule_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowRun_brandId_fkey') THEN
        ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowRun_automationId_fkey') THEN
        ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowRun_webhookEventId_fkey') THEN
        ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowRun_executionId_fkey') THEN
        ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_brandId_fkey') THEN
        ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_automationId_fkey') THEN
        ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_webhookEventId_fkey') THEN
        ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AutomationExecution_workflowRunId_fkey') THEN
        ALTER TABLE "AutomationExecution" ADD CONSTRAINT "AutomationExecution_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExecutionLog_brandId_fkey') THEN
        ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExecutionLog_executionId_fkey') THEN
        ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ExecutionLog_workflowRunId_fkey') THEN
        ALTER TABLE "ExecutionLog" ADD CONSTRAINT "ExecutionLog_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_brandId_fkey') THEN
        ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_executionId_fkey') THEN
        ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AutomationExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_workflowRunId_fkey') THEN
        ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_socialAccountId_fkey') THEN
        ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadEvent_brandId_fkey') THEN
        ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadEvent_leadId_fkey') THEN
        ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadEvent_webhookEventId_fkey') THEN
        ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "WebhookEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
