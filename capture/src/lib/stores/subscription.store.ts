// src/lib/stores/subscription.store.ts

import { writable, get } from 'svelte/store';
import type { PlanTier, UsageCheckResult } from '$lib/types/subscription';

interface SubscriptionState {
	plan: PlanTier;
	imagesUsed: number;
	videosUsed: number;
	imagesRemaining: number;
	videosRemaining: number;
	resetAt: string;
	period: 'daily' | 'monthly';
	loading: boolean;
	lastChecked: number | null;
}

const initialState: SubscriptionState = {
	plan: 'free',
	imagesUsed: 0,
	videosUsed: 0,
	imagesRemaining: 2,
	videosRemaining: 2,
	resetAt: 'midnight Pacific time',
	period: 'daily',
	loading: false,
	lastChecked: null
};

export const subscriptionStore = writable<SubscriptionState>(initialState);

/**
 * Check if user can generate content of a given type
 * Returns true if allowed, false if at limit
 * Updates the store with latest usage data
 */
export async function canGenerate(type: 'image' | 'video'): Promise<UsageCheckResult> {
	subscriptionStore.update(s => ({ ...s, loading: true }));

	try {
		const response = await fetch('/api/usage/check', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type })
		});

		if (!response.ok) {
			throw new Error('Failed to check usage');
		}

		const result: UsageCheckResult = await response.json();

		subscriptionStore.update(s => ({
			...s,
			plan: result.plan,
			imagesUsed: result.imagesUsed,
			videosUsed: result.videosUsed,
			imagesRemaining: result.imagesRemaining,
			videosRemaining: result.videosRemaining,
			resetAt: result.resetAt,
			period: result.period,
			loading: false,
			lastChecked: Date.now()
		}));

		return result;
	} catch (error) {
		console.error('Usage check failed:', error);
		subscriptionStore.update(s => ({ ...s, loading: false }));
		// Fail open — allow generation if check fails
		// Server will still enforce limits
		return {
			allowed: true,
			plan: 'free',
			imagesUsed: 0,
			videosUsed: 0,
			imagesRemaining: 2,
			videosRemaining: 2,
			resetAt: 'midnight Pacific time',
			period: 'daily'
		};
	}
}

/**
 * Increment usage after successful generation
 */
export async function recordGeneration(type: 'image' | 'video'): Promise<void> {
	try {
		await fetch('/api/usage/increment', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type })
		});

		// Update local store immediately
		subscriptionStore.update(s => {
			const newState = { ...s };
			if (type === 'image') {
				newState.imagesUsed += 1;
				if (newState.imagesRemaining > 0) newState.imagesRemaining -= 1;
			} else {
				newState.videosUsed += 1;
				if (newState.videosRemaining > 0) newState.videosRemaining -= 1;
			}
			return newState;
		});
	} catch (error) {
		console.error('Failed to record generation:', error);
	}
}

/**
 * Refresh usage data from server
 */
export async function refreshUsage(): Promise<void> {
	await canGenerate('image');
}