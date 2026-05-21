import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { generateAiReply } from "../services/ai.service.js";
import { loadReelDashboard, saveReelAutomationConfig } from "../services/reels.service.js";

export const appRouter = Router();

async function resolveBrandScope(req: Parameters<typeof requireAuth>[0], requestedBrandId?: string) {
  if (!req.user) return { user: null, brand: null };

  const user = req.user;
  const brands =
    user.brands ??
    (await prisma.brand.findMany({
      where: { ownerId: user.id },
      include: { socialAccounts: true, subscription: true },
      orderBy: { createdAt: "asc" }
    }));

  const brand = requestedBrandId ? brands.find((entry) => entry.id === requestedBrandId) : brands[0] ?? null;
  return { user: { ...user, brands }, brand };
}

appRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { user, brand } = await resolveBrandScope(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json({
      user: {
        id: user.id,
        authProviderId: user.authProviderId,
        email: user.email,
        name: user.name,
        imageUrl: user.imageUrl,
        onboardingComplete: user.onboardingComplete
      },
      brand,
      brands: user.brands ?? []
    });
  } catch (error) {
    next(error);
  }
});

appRouter.get("/plans", (_req, res) => {
  res.json([
    { id: "starter", name: "Starter", priceMonthly: 29, brands: 2, automations: 5 },
    { id: "pro", name: "Pro", priceMonthly: 79, brands: 10, automations: 50 },
    { id: "agency", name: "Agency", priceMonthly: 199, brands: -1, automations: -1 }
  ]);
});

appRouter.get("/brands", requireAuth, async (req, res, next) => {
  try {
    const { user } = await resolveBrandScope(req);
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    res.json(user.brands ?? []);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/dashboard", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);

    if (!brand) return res.json({ brand: null, stats: [], automations: [] });

    const [analytics, automations, leads, accounts] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["type"],
        where: { brandId: brand.id },
        _sum: { value: true }
      }),
      prisma.automation.findMany({ where: { brandId: brand.id }, orderBy: { updatedAt: "desc" }, take: 6 }),
      prisma.lead.count({ where: { brandId: brand.id } }),
      prisma.socialAccount.count({ where: { brandId: brand.id, isActive: true } })
    ]);

    res.json({
      brand,
      stats: analytics.map((item) => ({ type: item.type, value: item._sum.value })),
      leads,
      connectedAccounts: accounts,
      automations
    });
  } catch (error) {
    next(error);
  }
});

appRouter.get("/accounts", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const accounts = await prisma.socialAccount.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      orderBy: { createdAt: "asc" }
    });
    res.json(accounts);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/reels", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    if (!brand) return res.json({ brand: null, accounts: [], reels: [], syncErrors: [] });

    const reels = await loadReelDashboard(brand.id);
    res.json(reels);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/automations", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const automations = await prisma.automation.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      include: { nodes: true, triggerRuleRows: true },
      orderBy: { updatedAt: "desc" }
    });
    res.json(automations);
  } catch (error) {
    next(error);
  }
});

appRouter.post("/automations", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.body?.brandId ?? req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    if (!brand) return res.status(404).json({ error: "No workspace found" });

    const name = String(req.body?.name ?? "").trim();
    const keywordInput = String(req.body?.keyword ?? "").trim();
    const replyMessage = String(req.body?.replyMessage ?? "Check your inbox 👋").trim();
    const triggerType = String(req.body?.triggerType ?? "COMMENT_KEYWORD");
    const status = req.body?.status === "LIVE" ? "LIVE" : "DRAFT";

    if (!name) return res.status(400).json({ error: "Automation name is required" });
    if (!keywordInput) return res.status(400).json({ error: "Keyword is required" });

    const keywords = keywordInput
      .split(",")
      .map((value: string) => value.trim())
      .filter(Boolean);

    const automation = await prisma.automation.create({
      data: {
        brandId: brand.id,
        name,
        status,
        triggerType,
        triggerRules: {
          match: "contains",
          caseSensitive: false,
          keywords,
          message: replyMessage,
          platform: "instagram"
        } as never,
        nodes: {
          create: [
            {
              type: "COMMENT_TRIGGER",
              position: { x: 120, y: 120 } as never,
              config: {
                keywords,
                match: "contains",
                platform: "instagram"
              } as never,
              nextNodeIds: []
            },
            {
              type: "SEND_DM",
              position: { x: 420, y: 120 } as never,
              config: {
                message: replyMessage
              } as never,
              nextNodeIds: []
            }
          ]
        },
        triggerRuleRows: {
          create: keywords.map((value) => ({
            type: "keyword",
            operator: "contains",
            value,
            values: [value],
            caseSensitive: false,
            negated: false,
            config: {
              message: replyMessage
            } as never
          }))
        }
      },
      include: { nodes: true, triggerRuleRows: true }
    });

    res.status(201).json(automation);
  } catch (error) {
    next(error);
  }
});

appRouter.post("/reels/:mediaId/config", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.body?.brandId ?? req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    if (!brand) return res.status(404).json({ error: "No workspace found" });

    const socialAccountId = String(req.body?.socialAccountId ?? "").trim();
    const mediaId = String(req.params.mediaId ?? "").trim();
    const keyword = String(req.body?.keyword ?? "").trim();
    const dmTemplate = String(req.body?.dmTemplate ?? "").trim();
    const commentReply = String(req.body?.commentReply ?? "").trim();
    const enabled = req.body?.enabled !== false;
    const contentUrl = typeof req.body?.contentUrl === "string" ? String(req.body.contentUrl).trim() : null;

    if (!socialAccountId) return res.status(400).json({ error: "Instagram account is required" });
    if (!mediaId) return res.status(400).json({ error: "Media ID is required" });
    if (!keyword) return res.status(400).json({ error: "Trigger keyword is required" });
    if (!dmTemplate) return res.status(400).json({ error: "DM template is required" });

    const config = await saveReelAutomationConfig({
      workspaceId: brand.id,
      reelId: mediaId,
      socialAccountId,
      mediaId,
      keyword,
      dmTemplate,
      commentReply,
      enabled,
      contentUrl
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
});

appRouter.post("/automations/reel", requireAuth, async (req, res, next) => {
  try {
    const workspaceId = String(req.body?.workspaceId ?? req.query.workspaceId ?? req.body?.brandId ?? req.query.brandId ?? "").trim();
    const reelId = String(req.body?.reelId ?? "").trim();
    const mediaId = String(req.body?.mediaId ?? "").trim();
    const socialAccountId = String(req.body?.socialAccountId ?? "").trim();
    const keyword = String(req.body?.keyword ?? "").trim();
    const dmTemplate = String(req.body?.dmTemplate ?? "").trim();
    const commentReply = String(req.body?.commentReply ?? "").trim();
    const enabled = req.body?.enabled !== false;
    const contentUrl = typeof req.body?.contentUrl === "string" ? String(req.body.contentUrl).trim() : null;

    if (!workspaceId) return res.status(400).json({ error: "Workspace ID is required" });
    if (!reelId) return res.status(400).json({ error: "Reel ID is required" });
    if (!mediaId) return res.status(400).json({ error: "Media ID is required" });
    if (!keyword) return res.status(400).json({ error: "Trigger keyword is required" });
    if (!dmTemplate) return res.status(400).json({ error: "DM template is required" });

    const config = await saveReelAutomationConfig({
      workspaceId,
      reelId,
      socialAccountId,
      mediaId,
      keyword,
      dmTemplate,
      commentReply,
      enabled,
      contentUrl
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/leads", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const leads = await prisma.lead.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      orderBy: [{ score: "desc" }, { createdAt: "desc" }]
    });
    res.json(leads);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/analytics", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const where = brand ? { brandId: brand.id } : brandId ? { brandId } : undefined;
    const [events, grouped] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where,
        orderBy: { occurredAt: "asc" },
        take: 120
      }),
      prisma.analyticsEvent.groupBy({
        by: ["type"],
        where,
        _sum: { value: true }
      })
    ]);

    res.json({
      events,
      totals: grouped.map((item) => ({ type: item.type, value: item._sum.value }))
    });
  } catch (error) {
    next(error);
  }
});

appRouter.get("/templates", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const templates = await prisma.template.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      orderBy: { updatedAt: "desc" }
    });
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/executions", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const executions = await prisma.automationExecution.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      include: {
        automation: true,
        workflowRun: { include: { logs: { orderBy: { createdAt: "asc" } } } },
        deliveries: true,
        logs: { orderBy: { createdAt: "asc" } }
      },
      orderBy: { startedAt: "desc" },
      take: 40
    });
    res.json(executions);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/webhooks", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const webhooks = await prisma.webhookEvent.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      include: { socialAccount: true },
      orderBy: { receivedAt: "desc" },
      take: 80
    });
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

appRouter.get("/inbox", requireAuth, async (req, res, next) => {
  try {
    const brandId = String(req.query.brandId ?? "");
    const { brand } = await resolveBrandScope(req, brandId || undefined);
    const conversations = await prisma.conversation.findMany({
      where: brand ? { brandId: brand.id } : brandId ? { brandId } : undefined,
      include: { messages: { orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" }
    });
    res.json(conversations);
  } catch (error) {
    next(error);
  }
});

appRouter.post("/ai/reply", async (req, res, next) => {
  try {
    const reply = await generateAiReply({
      brandName: String(req.body.brandName ?? "Glow Studio"),
      channel: req.body.channel === "facebook" ? "facebook" : "instagram",
      userMessage: String(req.body.userMessage ?? ""),
      leadName: req.body.leadName ? String(req.body.leadName) : undefined,
      offer: req.body.offer ? String(req.body.offer) : undefined
    });

    res.json(reply);
  } catch (error) {
    next(error);
  }
});
