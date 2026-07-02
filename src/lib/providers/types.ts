// src/lib/providers/types.ts
//
// Provider-agnostic media generation interfaces.
//
// Purpose: keep the video model swappable (Veo ↔ Sora ↔ Kling ↔ …) behind a
// single seam so that changing backends means writing ONE adapter, not touching
// every API route. Also leaves room for BYOK — every factory accepts an optional
// per-user `apiKey`, so a future "bring your own key" plan is a plumbing change,
// not a rewrite.

export type VideoQuality = 'lite' | 'fast' | 'premium';

export interface ImageRef {
	imageBytes: string; // base64, no `data:` prefix
	mimeType: string;
}

export interface GenerateVideoParams {
	model: string; // resolved provider model id (caller owns tier→model policy)
	prompt: string;
	durationSeconds: number;
	aspectRatio: string;
	resolution?: string;
	images?: ImageRef[]; // 0 = text→video, 1 = first-frame, 2 = start→end, 3 = start→mid→end
}

export interface ExtendVideoParams {
	model: string;
	prompt: string;
	videoUri: string; // uri of the clip to continue
	durationSeconds?: number;
	resolution?: string;
}

// Opaque handle to an async generation job, used for polling.
export interface VideoOperation {
	id: string; // operation name / job id
}

// Provider-specific reference to a finished video, passed back verbatim to
// extendVideo (e.g. Google returns { uri, mimeType }).
export interface VideoObject {
	uri: string;
	mimeType?: string;
	[k: string]: unknown;
}

export interface VideoPollResult {
	done: boolean;
	fileUri?: string; // remote URI of the finished video
	videoObject?: VideoObject; // passthrough so the clip can be extended
	error?: string;
}

export interface VideoProvider {
	readonly name: string;
	readonly supportsExtend: boolean; // not every backend can extend — gate on this
	generateVideo(params: GenerateVideoParams): Promise<VideoOperation>;
	extendVideo(params: ExtendVideoParams): Promise<VideoOperation>;
	pollVideo(operationId: string): Promise<VideoPollResult>;
}

export interface ProviderOptions {
	apiKey?: string; // BYOK hook — falls back to the server env key when omitted
}
