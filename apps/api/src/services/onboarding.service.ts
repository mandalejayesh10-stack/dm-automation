import { prisma } from "../db.js";
import { Role, SocialProvider, SubscriptionStatus } from "@prisma/client";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueSlug(base: string) {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function ensureUserWorkspace(params: {
  authProvider: string;
  authProviderId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
}) {
  const user = await prisma.user.upsert({
    where: { authProviderId: params.authProviderId },
    update: {
      authProvider: params.authProvider,
      email: params.email,
      name: params.name ?? undefined,
      imageUrl: params.imageUrl ?? undefined,
      lastLoginAt: new Date(),
      onboardingComplete: true
    },
    create: {
      authProvider: params.authProvider,
      authProviderId: params.authProviderId,
      email: params.email,
      name: params.name ?? undefined,
      imageUrl: params.imageUrl ?? undefined,
      lastLoginAt: new Date(),
      onboardingComplete: true
    }
  });

  const existingBrand = await prisma.brand.findFirst({
    where: { ownerId: user.id },
    include: { socialAccounts: true }
  });

  if (existingBrand) {
    return { user, brand: existingBrand };
  }

  const baseSlug = slugify(params.name ?? params.email.split("@")[0] ?? "workspace");
  const brand = await prisma.brand.create({
    data: {
      ownerId: user.id,
      name: `${params.name ?? "My"} Workspace`,
      slug: uniqueSlug(baseSlug || "workspace")
    },
    include: { socialAccounts: true }
  });

  await prisma.teamMember.upsert({
    where: { brandId_userId: { brandId: brand.id, userId: user.id } },
    update: { role: Role.OWNER },
    create: { brandId: brand.id, userId: user.id, role: Role.OWNER }
  });

  await prisma.subscription.upsert({
    where: { brandId: brand.id },
    update: {},
    create: {
      brandId: brand.id,
      provider: "google",
      plan: "starter",
      status: SubscriptionStatus.TRIALING,
      usage: { dmLimit: 2500, dmsUsed: 0 }
    }
  });

  return { user, brand };
}

export async function seedDefaultSocialRows(brandId: string) {
  const existing = await prisma.socialAccount.count({ where: { brandId } });
  if (existing > 0) return;

  await prisma.socialAccount.createMany({
    data: [
      {
        brandId,
        provider: SocialProvider.INSTAGRAM,
        externalId: `ig_${brandId}`,
        accountName: "@newbrand",
        username: "@newbrand",
        profilePictureUrl: null,
        encryptedAccessToken: "pending-google-connect",
        permissions: ["instagram_manage_messages", "instagram_basic"],
        webhookStatus: "pending"
      },
      {
        brandId,
        provider: SocialProvider.FACEBOOK,
        externalId: `fb_${brandId}`,
        accountName: "Facebook Page",
        username: "Facebook Page",
        profilePictureUrl: null,
        encryptedAccessToken: "pending-google-connect",
        permissions: ["pages_manage_metadata", "pages_messaging", "pages_read_engagement"],
        webhookStatus: "pending"
      }
    ]
  });
}
