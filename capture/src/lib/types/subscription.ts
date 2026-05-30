// src/lib/types/subscription.ts

import type { Timestamp } from 'firebase/firestore';

// ==================== PLAN TIERS ====================

export type PlanTier = 'free' | 'starter' | 'pro';

export interface TierLimits {
	maxImages: number;       // -1 = unlimited
	maxVideos: number;       // -1 = unlimited
	period: 'daily' | 'monthly';
	enhancerAccess: boolean;
	libraryAccess: boolean;
	storageLimit: number;    // bytes
}

export const TIER_CONFIG: Record<PlanTier, TierLimits> = {
	free: {
		maxImages: 2,
		maxVideos: 2,
		period: 'daily',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120 // 5GB
	},
	starter: {
		maxImages: 20,
		maxVideos: 10,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120 // 5GB
	},
	pro: {
		maxImages: 100,
		maxVideos: 30,
		period: 'monthly',
		enhancerAccess: true,
		libraryAccess: true,
		storageLimit: 5368709120 // 5GB
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
	videosRemaining: number;         // -1 = usage.service.ts
	resetAt: string;                 // human-readable reset time
	period: 'daily' | 'monthly';
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