import { SocialProvider } from "@prisma/client";
import { prisma } from "../db.js";
import { decryptToken } from "../security/crypto.js";
import { fetchFacebookReels, fetchInstagramMedia, type MetaFacebookVideo, type MetaInstagramMedia } from "./meta.service.js";

export type ReelAutomationConfigRecord = {
  id: string;
  workspaceId: string;
  socialAccountId: string | null;
  reelId: string;
  mediaId: string;
  keyword: string;
  dmTemplate: string;
  commentReply: string | null;
  enabled: boolean;
  contentUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReelCardRecord = {
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
  config: ReelAutomationConfigRecord | null;
  recentExecutions: Array<{
    id: string;
    status: string;
    triggerKeyword: string;
    commentText: string;
    commenterName: string | null;
    startedAt: Date;
    completedAt: Date | null;
    failureReason: string | null;
  }>;
};

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function syncInstagramAccountMedia(args: {
  brandId: string;
  socialAccountId: string;
  instagramBusinessId: string;
  accessToken: string;
}) {
  const media = await fetchInstagramMedia({
    accessToken: args.accessToken,
    instagramBusinessId: args.instagramBusinessId,
    limit: 24
  });

  const synced = await Promise.all(
    media.map(async (item: MetaInstagramMedia) =>
      prisma.instagramMediaItem.upsert({
        where: {
          socialAccountId_mediaId: {
            socialAccountId: args.socialAccountId,
            mediaId: item.id
          }
        },
        update: {
          brandId: args.brandId,
          mediaType: item.media_type,
          caption: item.caption,
          permalink: item.permalink,
          thumbnailUrl: item.thumbnail_url,
          timestamp: item.timestamp ? new Date(item.timestamp) : null,
          likeCount: toNumber(item.like_count),
          commentsCount: toNumber(item.comments_count),
          rawPayload: item as never
        },
        create: {
          brandId: args.brandId,
          socialAccountId: args.socialAccountId,
          mediaId: item.id,
          mediaType: item.media_type,
          caption: item.caption,
          permalink: item.permalink,
          thumbnailUrl: item.thumbnail_url,
          timestamp: item.timestamp ? new Date(item.timestamp) : null,
          likeCount: toNumber(item.like_count),
          commentsCount: toNumber(item.comments_count),
          rawPayload: item as never
        }
      })
    )
  );

  return synced;
}

async function syncFacebookPageVideos(args: {
  brandId: string;
  socialAccountId: string;
  pageId: string;
  accessToken: string;
}) {
  const videos = await fetchFacebookReels({
    accessToken: args.accessToken,
    pageId: args.pageId,
    limit: 24
  });

  const synced = await Promise.all(
    videos.map(async (item: MetaFacebookVideo) =>
      prisma.instagramMediaItem.upsert({
        where: {
          socialAccountId_mediaId: {
            socialAccountId: args.socialAccountId,
            mediaId: item.id
          }
        },
        update: {
          brandId: args.brandId,
          mediaType: "FACEBOOK_REEL",
          caption: item.description,
          permalink: item.permalink_url,
          thumbnailUrl: item.picture,
          timestamp: item.created_time ? new Date(item.created_time) : null,
          likeCount: toNumber(item.views),
          commentsCount: null,
          rawPayload: item as never
        },
        create: {
          brandId: args.brandId,
          socialAccountId: args.socialAccountId,
          mediaId: item.id,
          mediaType: "FACEBOOK_REEL",
          caption: item.description,
          permalink: item.permalink_url,
          thumbnailUrl: item.picture,
          timestamp: item.created_time ? new Date(item.created_time) : null,
          likeCount: toNumber(item.views),
          commentsCount: null,
          rawPayload: item as never
        }
      })
    )
  );

  return synced;
}

export async function loadReelDashboard(brandId: string) {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      brandId,
      provider: { in: [SocialProvider.INSTAGRAM, SocialProvider.FACEBOOK] },
      isActive: true
    },
    orderBy: { createdAt: "asc" }
  });

  const syncResults = await Promise.allSettled(
    accounts.map(async (account) => {
      const token = decryptToken(account.encryptedAccessToken);
      if (account.provider === SocialProvider.INSTAGRAM) {
        const instagramBusinessId = account.instagramBusinessId ?? account.externalId;
        if (!instagramBusinessId) {
          return { account, synced: [] as MetaInstagramMedia[] };
        }
        const synced = await syncInstagramAccountMedia({
          brandId,
          socialAccountId: account.id,
          instagramBusinessId,
          accessToken: token
        });
        return { account, synced };
      }

      const pageId = account.pageId ?? account.externalId;
      if (!pageId) {
        return { account, synced: [] as MetaFacebookVideo[] };
      }
      const synced = await syncFacebookPageVideos({
        brandId,
        socialAccountId: account.id,
        pageId,
        accessToken: token
      });
      return { account, synced };
    })
  );

  const syncErrors = syncResults
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => (result.reason instanceof Error ? result.reason.message : "Failed to sync reel media"));

  const accountIds = accounts.map((account) => account.id);
  const mediaItems = accountIds.length
    ? await prisma.instagramMediaItem.findMany({
        where: { brandId, socialAccountId: { in: accountIds } },
        include: { socialAccount: true },
        orderBy: [{ timestamp: "desc" }, { createdAt: "desc" }],
        take: 48
      })
    : [];

  const configs = accountIds.length
    ? await prisma.reelAutomation.findMany({
        where: { workspaceId: brandId, socialAccountId: { in: accountIds } },
        include: {
          socialAccount: true
        }
      })
    : [];

  const configMap = new Map(configs.map((config) => [`${config.socialAccountId}:${config.mediaId}`, config]));

  const reels: ReelCardRecord[] = mediaItems.map((item) => {
    const config = configMap.get(`${item.socialAccountId}:${item.mediaId}`);
    return {
      id: item.id,
      brandId: item.brandId,
      socialAccountId: item.socialAccountId,
      provider: item.socialAccount.provider,
      externalId: item.mediaId,
      accountName: item.socialAccount.accountName,
      username: item.socialAccount.username,
      profilePictureUrl: item.thumbnailUrl ?? item.socialAccount.profilePictureUrl,
      instagramBusinessId: item.socialAccount.instagramBusinessId,
      mediaId: item.mediaId,
      mediaType: item.mediaType,
      caption: item.caption,
      permalink: item.permalink,
      thumbnailUrl: item.thumbnailUrl,
      timestamp: item.timestamp?.toISOString() ?? null,
      likeCount: item.likeCount,
      commentsCount: item.commentsCount,
      configured: Boolean(config),
      config: config
        ? {
            id: config.id,
            workspaceId: config.workspaceId,
            socialAccountId: config.socialAccountId,
            reelId: config.reelId,
            mediaId: config.mediaId,
            keyword: config.keyword,
            dmTemplate: config.dmTemplate,
            commentReply: config.commentReply,
            enabled: config.enabled,
            contentUrl: config.contentUrl,
            createdAt: config.createdAt,
            updatedAt: config.updatedAt
          }
        : null,
      recentExecutions: []
    };
  });

  return {
    brandId,
    accounts,
    reels,
    syncErrors
  };
}

export async function saveReelAutomationConfig(args: {
  workspaceId: string;
  reelId: string;
  socialAccountId: string;
  mediaId: string;
  keyword: string;
  dmTemplate: string;
  commentReply: string;
  enabled: boolean;
  contentUrl?: string | null;
}) {
  const media = await prisma.instagramMediaItem.findUnique({
    where: {
      socialAccountId_mediaId: {
        socialAccountId: args.socialAccountId,
        mediaId: args.mediaId
      }
    }
  });

  const contentUrl = args.contentUrl ?? media?.permalink ?? null;

  return prisma.$transaction(async (tx) => {
    const reelConfig = await tx.reelAutomation.upsert({
      where: {
        workspaceId_reelId: {
          workspaceId: args.workspaceId,
          reelId: args.reelId
        }
      },
      update: {
        workspaceId: args.workspaceId,
        reelId: args.reelId,
        keyword: args.keyword,
        dmTemplate: args.dmTemplate,
        commentReply: args.commentReply,
        enabled: args.enabled,
        contentUrl,
        socialAccountId: args.socialAccountId,
        mediaId: args.mediaId
      },
      create: {
        workspaceId: args.workspaceId,
        reelId: args.reelId,
        socialAccountId: args.socialAccountId,
        mediaId: args.mediaId,
        keyword: args.keyword,
        dmTemplate: args.dmTemplate,
        commentReply: args.commentReply,
        enabled: args.enabled,
        contentUrl
      }
    });

    // Keep the legacy reel executor in sync until the engine fully migrates.
    await tx.instagramMediaAutomation.upsert({
      where: {
        socialAccountId_mediaId: {
          socialAccountId: args.socialAccountId,
          mediaId: args.mediaId
        }
      },
      update: {
        brandId: args.workspaceId,
        socialAccountId: args.socialAccountId,
        mediaId: args.mediaId,
        keyword: args.keyword,
        dmTemplate: args.dmTemplate,
        commentReply: args.commentReply || null,
        enabled: args.enabled,
        matchMode: "contains",
        aiEnabled: false,
        delaySeconds: 0
      },
      create: {
        brandId: args.workspaceId,
        socialAccountId: args.socialAccountId,
        mediaId: args.mediaId,
        keyword: args.keyword,
        dmTemplate: args.dmTemplate,
        commentReply: args.commentReply || null,
        enabled: args.enabled,
        matchMode: "contains",
        aiEnabled: false,
        delaySeconds: 0
      }
    });

    return reelConfig;
  });
}

export async function listReelAutomationConfigs(brandId: string) {
  return prisma.reelAutomation.findMany({
    where: { workspaceId: brandId },
    include: {
      socialAccount: true
    },
    orderBy: { updatedAt: "desc" }
  });
}
