// src/lib/types/subscription.ts

import type { Timestamp } from 'firebase/firestore';

// ==================== PLAN TIERS ====================

export type PlanTier = 'free' | 'starter' | 'pro' | 'elite';

export type ImageSize = '1K' | '2K' | '4K';

export interface TierLimits {
	maxImages: number;           // -1 = unlimited
	maxVideos: number;           // fast-model generations; -1 = unlimited
	// PREMIUM CREDITS: a premium-quality generation OR an extend burns one.
	// Priced against real cost ($3.20/8s at $0.40/s) — this cap is what keeps
	// the tiers profitable at full utilization. 0 = no premium access.
	maxPremiumVideos: number;
	period: 'daily' | 'monthly';
	enhancerAccess: boolean;
	libraryAccess: boolean;
	storageLimit: number;        // bytes
	canExtend: boolean;          // video extension (consumes a premium credit)
	canUsePremiumQuality: boolean; // veo-3.1-generate-preview (consumes a premium credit)
	videoModel: string;          // default model for this tier
	maxImageVariants: number;    // parallel candidates per image prompt (each bills + counts)
	maxImageSize: ImageSize;     // generation size ceiling (1K/2K/4K)
	canUsePremiumImage: boolean; // gemini-3-pro-image toggle
	priceUsd: number;            // monthly price — keep in sync with Stripe products
}

const FREE_VIDEO_MODEL = 'veo-3.1-lite-generate-preview';

// Pricing model (7-16-2026): worst-case model cost + 15% peripheral overhead, ×2.
// Unit costs from GCP billing: fast video $0.80/8s, premium video $0.40/sec,
// pro image ~$0.13. Premium credits are the enforcement mechanism.
export const TIER_CONFIG: Record<PlanTier, TierLimits> = {
	free: {
		maxImages: 3,
		maxVideos: 2,
		maxPremiumVideos: 0,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: false,
		canUsePremiumQuality: false,
		videoModel: FREE_VIDEO_MODEL,
		maxImageVariants: 1,
		maxImageSize: '1K',
		canUsePremiumImage: false,
		priceUsd: 0
	},
	starter: {
		maxImages: 30,
		maxVideos: 10,
		maxPremiumVideos: 0,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: false,
		canUsePremiumQuality: false,
		videoModel: 'veo-3.1-fast-generate-preview',
		maxImageVariants: 2,
		maxImageSize: '2K',
		canUsePremiumImage: false,
		priceUsd: 29
	},
	pro: {
		maxImages: 60,
		maxVideos: 25,
		maxPremiumVideos: 4,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: true,
		canUsePremiumQuality: true,
		videoModel: 'veo-3.1-fast-generate-preview', // premium toggle upgrades to veo-3.1-generate-preview
		maxImageVariants: 4,
		maxImageSize: '4K',
		canUsePremiumImage: true,
		priceUsd: 99
	},
	elite: {
		maxImages: 100,
		maxVideos: 60,
		maxPremiumVideos: 15,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 10737418240, // 10 GB — top tier gets headroom
		canExtend: true,
		canUsePremiumQuality: true,
		videoModel: 'veo-3.1-fast-generate-preview',
		maxImageVariants: 4,
		maxImageSize: '4K',
		canUsePremiumImage: true,
		priceUsd: 256
	}
};

// ==================== USAGE TRACKING ====================

export interface UsageRecord {
	userId: string;
	date: string;                    // YYYY-MM-DD for daily, YYYY-MM for monthly
	imagesGenerated: number;
	videosGenerated: number;
	premiumVideosGenerated: number;  // premium-quality gens + extends
	lastGenerationAt: Timestamp | null;
}

export interface UsageCheckResult {
	allowed: boolean;
	plan: PlanTier;
	imagesUsed: number;
	videosUsed: number;
	premiumUsed: number;
	imagesRemaining: number;         // -1 = unlimited
	videosRemaining: number;         // -1 = unlimited
	premiumRemaining: number;        // premium credits left this period
	resetAt: string;                 // human-readable reset time
	period: 'daily' | 'monthly';
	canExtend: boolean;
	canUsePremiumQuality: boolean;
}

// ==================== STRIPE ====================

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | null;

export interface SubscriptionInfo {
	stripeCustomerId: string | null;
	stripeSubscriptionId: string | null;
	subscriptionStatus: SubscriptionStatus;
	subscriptionPeriodEnd: Timestamp | null;
	stripePriceId: string | null;
}

// ==================== GENERATION TYPES ====================

// 'premium_video' = premium-quality generation or extend — burns a premium credit
export type GenerationType = 'image' | 'video' | 'premium_video';