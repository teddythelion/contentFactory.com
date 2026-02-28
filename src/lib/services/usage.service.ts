// src/lib/services/usage.service.ts

import { adminDb } from '$lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { TIER_CONFIG, type PlanTier, type UsageCheckResult, type GenerationType } from '$lib/types/subscription';

const USAGE_COLLECTION = 'usage_tracking';

// ==================== HELPERS ====================

function getDateKey(plan: PlanTier): string {
	const now = new Date();
	const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
	const year = pacific.getFullYear();
	const month = String(pacific.getMonth() + 1).padStart(2, '0');
	const day = String(pacific.getDate()).padStart(2, '0');

	if (TIER_CONFIG[plan].period === 'daily') {
		return `${year}-${month}-${day}`;
	}
	return `${year}-${month}`;
}

function getResetTime(plan: PlanTier): string {
	if (TIER_CONFIG[plan].period === 'daily') {
		return 'midnight Pacific time';
	}
	return 'your billing cycle renewal';
}

function getUsageDocId(userId: string, dateKey: string): string {
	return `${userId}_${dateKey}`;
}

// ==================== CORE FUNCTIONS ====================

async function getUserPlan(userId: string): Promise<PlanTier> {
	const userDoc = await adminDb.collection('users').doc(userId).get();
	if (!userDoc.exists) {
		return 'free';
	}
	const data = userDoc.data();
	return (data?.plan as PlanTier) || 'free';
}

async function getCurrentUsage(userId: string, plan: PlanTier): Promise<{ imagesGenerated: number; videosGenerated: number }> {
	const dateKey = getDateKey(plan);
	const docId = getUsageDocId(userId, dateKey);
	const usageDoc = await adminDb.collection(USAGE_COLLECTION).doc(docId).get();

	if (!usageDoc.exists) {
		return { imagesGenerated: 0, videosGenerated: 0 };
	}

	const data = usageDoc.data();
	return {
		imagesGenerated: data?.imagesGenerated || 0,
		videosGenerated: data?.videosGenerated || 0
	};
}

export async function checkUsage(userId: string, type: GenerationType): Promise<UsageCheckResult> {
	const plan = await getUserPlan(userId);
	const limits = TIER_CONFIG[plan];
	const usage = await getCurrentUsage(userId, plan);

	const maxForType = type === 'image' ? limits.maxImages : limits.maxVideos;
	const usedForType = type === 'image' ? usage.imagesGenerated : usage.videosGenerated;

	const allowed = maxForType === -1 || usedForType < maxForType;

	const imagesRemaining = limits.maxImages === -1 ? -1 : Math.max(0, limits.maxImages - usage.imagesGenerated);
	const videosRemaining = limits.maxVideos === -1 ? -1 : Math.max(0, limits.maxVideos - usage.videosGenerated);

	return {
		allowed,
		plan,
		imagesUsed: usage.imagesGenerated,
		videosUsed: usage.videosGenerated,
		imagesRemaining,
		videosRemaining,
		resetAt: getResetTime(plan),
		period: limits.period
	};
}

export async function incrementUsage(userId: string, type: GenerationType): Promise<void> {
	const plan = await getUserPlan(userId);
	const dateKey = getDateKey(plan);
	const docId = getUsageDocId(userId, dateKey);
	const usageRef = adminDb.collection(USAGE_COLLECTION).doc(docId);

	const usageDoc = await usageRef.get();

	if (!usageDoc.exists) {
		await usageRef.set({
			userId,
			date: dateKey,
			imagesGenerated: type === 'image' ? 1 : 0,
			videosGenerated: type === 'video' ? 1 : 0,
			lastGenerationAt: Timestamp.now()
		});
	} else {
		const field = type === 'image' ? 'imagesGenerated' : 'videosGenerated';
		await usageRef.update({
			[field]: FieldValue.increment(1),
			lastGenerationAt: Timestamp.now()
		});
	}
}

export async function getUsageSummary(userId: string): Promise<UsageCheckResult> {
	return checkUsage(userId, 'image');
}