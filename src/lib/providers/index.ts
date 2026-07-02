// src/lib/providers/index.ts
//
// Provider registry. This is the ONE place you change to swap the app's video
// backend. Adding a new backend (Sora, Kling, Runway, a self-hosted model) means:
//   1. write an adapter that implements VideoProvider (see google.provider.ts)
//   2. add a case below
//   3. flip ACTIVE_VIDEO_PROVIDER (or drive it from env)
// No API route needs to change.

import type { VideoProvider, ProviderOptions } from './types';
import { createGoogleVideoProvider } from './google.provider';

export type VideoProviderName = 'google-veo';

// Swap here to change the whole app's video backend.
const ACTIVE_VIDEO_PROVIDER: VideoProviderName = 'google-veo';

export function getVideoProvider(opts: ProviderOptions = {}): VideoProvider {
	switch (ACTIVE_VIDEO_PROVIDER) {
		case 'google-veo':
		default:
			return createGoogleVideoProvider(opts);
	}
}

export * from './types';
