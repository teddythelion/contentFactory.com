// src/lib/providers/google.provider.ts
//
// Google Veo adapter. This is a behavior-preserving extraction of the SDK calls
// that previously lived inline in the veo2-simple/* routes — nothing about the
// wire behavior changed, it just sits behind the VideoProvider interface now.

import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { GOOGLE_API_KEY } from '$env/static/private';
import type {
	VideoProvider,
	GenerateVideoParams,
	ExtendVideoParams,
	VideoOperation,
	VideoPollResult,
	ProviderOptions
} from './types';

export function createGoogleVideoProvider(opts: ProviderOptions = {}): VideoProvider {
	const ai = new GoogleGenAI({ apiKey: opts.apiKey || GOOGLE_API_KEY });

	return {
		name: 'google-veo',
		supportsExtend: true,

		async generateVideo(params: GenerateVideoParams): Promise<VideoOperation> {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const generateParams: any = {
				model: params.model,
				prompt: params.prompt,
				config: {
					numberOfVideos: 1,
					durationSeconds: params.durationSeconds,
					aspectRatio: params.aspectRatio,
					resolution: params.resolution ?? '720p',
					personGeneration: 'allow_all'
				}
			};

			// 1 image → first-frame animation
			// 2 images → interpolate start → end
			// 3 images → interpolate start → middle → end
			const imgs = params.images ?? [];
			if (imgs.length === 1) {
				generateParams.image = { imageBytes: imgs[0].imageBytes, mimeType: imgs[0].mimeType };
			} else if (imgs.length === 2) {
				generateParams.image = { imageBytes: imgs[0].imageBytes, mimeType: imgs[0].mimeType };
				generateParams.lastImage = { imageBytes: imgs[1].imageBytes, mimeType: imgs[1].mimeType };
			} else if (imgs.length >= 3) {
				generateParams.image = { imageBytes: imgs[0].imageBytes, mimeType: imgs[0].mimeType };
				generateParams.middleImage = { imageBytes: imgs[1].imageBytes, mimeType: imgs[1].mimeType };
				generateParams.lastImage = { imageBytes: imgs[2].imageBytes, mimeType: imgs[2].mimeType };
			}

			const operation = await ai.models.generateVideos(generateParams);
			return { id: operation.name as string };
		},

		async extendVideo(params: ExtendVideoParams): Promise<VideoOperation> {
			// Pass ONLY uri — the SDK maps mimeType → encoding on the wire, which the API rejects.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const operation = await (ai.models as any).generateVideos({
				model: params.model,
				prompt: params.prompt || '',
				video: { uri: params.videoUri },
				config: {
					numberOfVideos: 1,
					durationSeconds: params.durationSeconds ?? 8, // must be 8 for extension
					resolution: params.resolution ?? '720p' // must be 720p for extension
				}
			});
			return { id: operation.name as string };
		},

		async pollVideo(operationId: string): Promise<VideoPollResult> {
			// getVideosOperation requires a real GenerateVideosOperation instance (not a plain
			// object) because it calls operation._fromAPIResponse() internally. We create one
			// and stamp the name so the SDK can look it up and populate the result correctly.
			const opInstance = new GenerateVideosOperation();
			(opInstance as unknown as Record<string, unknown>).name = operationId;

			const operation = await ai.operations.getVideosOperation({ operation: opInstance });
			if (!operation.done) return { done: false };

			const generatedVideo = operation.response?.generatedVideos?.[0];
			const videoFile = generatedVideo?.video;
			const fileUri = videoFile?.uri;
			if (!fileUri) return { done: true, error: 'No video URI in response' };

			return {
				done: true,
				fileUri,
				videoObject: videoFile as unknown as VideoPollResult['videoObject']
			};
		}
	};
}
