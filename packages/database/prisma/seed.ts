import { PrismaClient, Role, SocialProvider, AutomationStatus, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { authProviderId: "dev_user_owner" },
    update: {},
    create: {
      authProvider: "google",
      authProviderId: "dev_user_owner",
      email: "owner@example.com",
      name: "Demo Owner",
      onboardingComplete: true,
      lastLoginAt: new Date()
    }
  });

  const brand = await prisma.brand.upsert({
    where: { slug: "glow-studio" },
    update: {},
    create: {
      ownerId: user.id,
      name: "Glow Studio",
      slug: "glow-studio",
      logoUrl: null
    }
  });

  await prisma.teamMember.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    update: { role: Role.OWNER },
    create: { brandId: brand.id, userId: user.id, role: Role.OWNER }
  });

  await prisma.subscription.upsert({
    where: { brandId: brand.id },
    update: { status: SubscriptionStatus.ACTIVE, plan: "pro" },
    create: {
      brandId: brand.id,
      provider: "stripe",
      plan: "pro",
      status: SubscriptionStatus.ACTIVE,
      usage: { dmLimit: 50000, dmsUsed: 8921 }
    }
  });

  const accounts = [
    {
      provider: SocialProvider.INSTAGRAM,
      externalId: "ig_glowstudio",
      accountName: "@glowstudio",
      username: "@glowstudio",
      profilePictureUrl: null,
      instagramBusinessId: "17841400000000000",
      webhookStatus: "active"
    },
    {
      provider: SocialProvider.FACEBOOK,
      externalId: "fb_glowstudio",
      accountName: "Glow Studio",
      username: "Glow Studio",
      profilePictureUrl: null,
      pageId: "100000000000000",
      webhookStatus: "active"
    }
  ];

  for (const account of accounts) {
    await prisma.socialAccount.upsert({
      where: { provider_externalId: { provider: account.provider, externalId: account.externalId } },
      update: { isActive: true },
      create: {
        brandId: brand.id,
        provider: account.provider,
        externalId: account.externalId,
        accountName: account.accountName,
        username: account.username,
        profilePictureUrl: account.profilePictureUrl,
        pageId: "pageId" in account ? account.pageId : null,
        instagramBusinessId: "instagramBusinessId" in account ? account.instagramBusinessId : null,
        encryptedAccessToken: "dev-token-placeholder",
        permissions: ["instagram_manage_messages", "instagram_basic", "pages_manage_metadata", "pages_messaging", "pages_read_engagement"],
        webhookStatus: account.webhookStatus
      }
    });
  }

  const automation = await prisma.automation.upsert({
    where: { id: "auto_price_keyword" },
    update: { status: AutomationStatus.LIVE },
    create: {
      id: "auto_price_keyword",
      brandId: brand.id,
      name: "Price keyword DM",
      status: AutomationStatus.LIVE,
      triggerType: "comment_keyword",
      triggerRules: { keywords: ["price", "pricing", "cost"], platforms: ["instagram", "facebook"] }
    }
  });

  await prisma.automationNode.deleteMany({ where: { automationId: automation.id } });
  await prisma.automationNode.createMany({
    data: [
      { automationId: automation.id, type: "COMMENT_TRIGGER", position: { x: 60, y: 80 }, config: { keyword: "price" }, nextNodeIds: ["node_send_dm"] },
      { id: "node_send_dm", automationId: automation.id, type: "SEND_DM", position: { x: 360, y: 80 }, config: { template: "Hey {{first_name}}, here is the launch price." }, nextNodeIds: ["node_collect_email"] },
      { id: "node_collect_email", automationId: automation.id, type: "COLLECT_EMAIL", position: { x: 660, y: 80 }, config: { required: true }, nextNodeIds: [] }
    ]
  });

  await prisma.lead.deleteMany({
    where: {
      brandId: brand.id,
      email: { in: ["aisha@example.com", "rahul@example.com", "maya@example.com"] }
    }
  });
  await prisma.lead.createMany({
    data: [
      { brandId: brand.id, source: "instagram_comment", name: "Aisha Mehta", email: "aisha@example.com", socialHandle: "@aisha", score: 92, tags: ["Hot Lead"] },
      { brandId: brand.id, source: "facebook_message", name: "Rahul Shah", email: "rahul@example.com", socialHandle: "Rahul Shah", score: 76, tags: ["Course Interest"] },
      { brandId: brand.id, source: "instagram_dm", name: "Maya Iyer", email: "maya@example.com", socialHandle: "@maya", score: 84, tags: ["Offer Clicked"] }
    ],
    skipDuplicates: true
  });

  await prisma.template.deleteMany({
    where: {
      brandId: brand.id,
      name: { in: ["Product link DM", "Lead magnet capture", "AI support handoff"] }
    }
  });
  await prisma.template.createMany({
    data: [
      {
        brandId: brand.id,
        name: "Product link DM",
        category: "Sales",
        content: { message: "Hey {{first_name}}, here is the product link: {{link}}", cta: "Send link" }
      },
      {
        brandId: brand.id,
        name: "Lead magnet capture",
        category: "Lead generation",
        content: { message: "Want the free guide? Share your email and I will send it over.", fields: ["email"] }
      },
      {
        brandId: brand.id,
        name: "AI support handoff",
        category: "Support",
        content: { message: "I can help with that. Tell me what you are trying to do.", ai: true }
      }
    ],
    skipDuplicates: true
  });

  await prisma.analyticsEvent.deleteMany({
    where: {
      brandId: brand.id,
      metadata: { path: ["seeded"], equals: true }
    }
  });
  for (const [type, value] of [
    ["comments", 128402],
    ["dms_sent", 89210],
    ["reply_rate", 71],
    ["conversion_rate", 14.8],
    ["leads_generated", 12906],
    ["viral_reels", 37]
  ] as const) {
    await prisma.analyticsEvent.create({
      data: { brandId: brand.id, type, value, metadata: { seeded: true } }
    });
  }

  const conversation = await prisma.conversation.upsert({
    where: { brandId_externalId: { brandId: brand.id, externalId: "conv_ig_aisha" } },
    update: {},
    create: {
      brandId: brand.id,
      externalId: "conv_ig_aisha",
      labels: ["Hot Lead"]
    }
  });

  await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
  await prisma.message.createMany({
    data: [
      { conversationId: conversation.id, direction: "inbound", senderId: "ig_aisha", body: "Hi, I commented price on your reel." },
      { conversationId: conversation.id, direction: "outbound", senderId: "brand", body: "Thanks! I sent the launch price and bonus details here.", aiGenerated: true }
    ],
    skipDuplicates: true
  });

  console.log(`Seeded demo brand: ${brand.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
