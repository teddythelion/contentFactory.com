// src/lib/types/subscription.ts

import type { Timestamp } from 'firebase/firestore';

// ==================== PLAN TIERS ====================

export type PlanTier = 'free' | 'starter' | 'pro';

export type ImageSize = '1K' | '2K' | '4K';

export interface TierLimits {
	maxImages: number;           // -1 = unlimited
	maxVideos: number;           // -1 = unlimited
	period: 'daily' | 'monthly';
	enhancerAccess: boolean;
	libraryAccess: boolean;
	storageLimit: number;        // bytes
	canExtend: boolean;          // video extension (pro only)
	canUsePremiumQuality: boolean; // veo-3.1-generate-preview (pro only)
	videoModel: string;          // default model for this tier
	maxImageVariants: number;    // parallel candidates per image prompt (each bills + counts)
	maxImageSize: ImageSize;     // generation size ceiling (1K/2K/4K)
	canUsePremiumImage: boolean; // gemini-3-pro-image toggle (pro only)
}

const FREE_VIDEO_MODEL = 'veo-3.1-lite-generate-preview';

export const TIER_CONFIG: Record<PlanTier, TierLimits> = {
	free: {
		maxImages: 3,
		maxVideos: 2,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: false,
		canUsePremiumQuality: false,
		videoModel: FREE_VIDEO_MODEL,
		maxImageVariants: 1,
		maxImageSize: '1K',
		canUsePremiumImage: false
	},
	starter: {
		maxImages: 20,
		maxVideos: 10,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: false,
		canUsePremiumQuality: false,
		videoModel: 'veo-3.1-fast-generate-preview',
		maxImageVariants: 2,
		maxImageSize: '2K',
		canUsePremiumImage: false
	},
	pro: {
		maxImages: 100,
		maxVideos: 30,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120,
		canExtend: true,
		canUsePremiumQuality: true,
		videoModel: 'veo-3.1-fast-generate-preview', // premium toggle upgrades to veo-3.1-generate-preview
		maxImageVariants: 4,
		maxImageSize: '4K',
		canUsePremiumImage: true
	}
};

// ==================== USAGE TRACKING ====================

export interface UsageRecord {
	userId: string;
	date: string;                    // YYYY-MM-DD for daily, YYYY-MM for monthly
	imagesGenerated: number;
	videosGenerated: number;
	lastGenerationAt: Timestamp | null;
}

export interface UsageCheckResult {
	allowed: boolean;
	plan: PlanTier;
	imagesUsed: number;
	videosUsed: number;
	imagesRemaining: number;         // -1 = unlimited
	videosRemaining: number;         // -1 = unlimited
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

export type GenerationType = 'image' | 'video';