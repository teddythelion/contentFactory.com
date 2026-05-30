// src/lib/utils/storeUtils.ts
// Utility to create stores that explicitly DON'T persist to localStorage

import { writable, type Writable } from 'svelte/store';

/**
 * Creates a writable store that will NOT be persisted to localStorage
 * even if there's a global localStorage persistence mechanism
 * 
 * Use this for stores with large data like videos, images, or binary data
 */
export function writableNoStorage<T>(initial: T): Writable<T> {
	const store = writable<T>(initial);
	
	// Mark this store as non-persistable
	(store as any).__noPersist = true;
	
	return store;
}

/**
 * Check if a store should be persisted to localStorage
 */
export function shouldPersistStore(store: any): boolean {
	return !store.__noPersist;
}

/**
 * Get the size of data in bytes
 */
export function getDataSize(data: any): number {
	try {
		return new Blob([JSON.stringify(data)]).size;
	} catch {
		return 0;
	}
}

/**
 * Check if data is too large for localStorage (>5MB)
 */
export function isTooLargeForStorage(data: any): boolean {
	const size = getDataSize(data);
	const maxSize = 5 * 1024 * 1024; // 5MB
	return size > maxSize;
}

/**
 * Safe localStorage setter that checks quota
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
	try {
		// Check size first
		if (value.length > 5 * 1024 * 1024) {
			console.warn(`⚠️ Data too large for localStorage (${key}): ${(value.length / 1024 / 1024).toFixed(2)}MB`);
			return false;
		}
		
		localStorage.setItem(key, value);
		return true;
	} catch (e) {
		if (e instanceof DOMException && e.name === 'QuotaExceededError') {
			console.error(`❌ localStorage quota exceeded for key: ${key}`);
			console.error(`Data size: ${(value.length / 1024 / 1024).toFixed(2)}MB`);
			
			// Try to free up space by removing old items
			const keysToTry = ['videoState', 'threeDVideoUrl', 'processedVideoUrl'];
			for (const k of keysToTry) {
				if (k !== key) {
					try {
						localStorage.removeItem(k);
						console.log(`🧹 Removed ${k} from localStorage to free space`);
					} catch (e){
                        console.error(`❌ Failed to remove ${k} from localStorage:`, e);    
                    }
				}
			}
		}
		return false;
	}
}