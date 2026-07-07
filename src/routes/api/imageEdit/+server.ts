import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from '$env/static/private';
import sharp from 'sharp';
import { checkUsage, incrementUsage, getUserPlan } from '$lib/services/usage.service';
import { TIER_CONFIG, type ImageSize } from '$lib/types/subscription';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Nano Banana 2 family. Lite is fastest/cheapest but not optimized for reference
// images or sequential editing — only used for free-tier prompt-only generations.
const IMAGE_MODEL = 'gemini-3.1-flash-image';           // Nano Banana 2 — workhorse
const IMAGE_MODEL_LITE = 'gemini-3.1-flash-lite-image'; // Nano Banana 2 Lite — 1K only
const IMAGE_MODEL_PRO = 'gemini-3-pro-image';           // Nano Banana Pro — premium toggle

const VALID_ASPECT_RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
const SIZE_LADDER: ImageSize[] = ['1K', '2K', '4K'];

const VISION_MODEL = 'gemini-2.5-flash';

/* =========================================================
   SYSTEM PROMPTS
   ========================================================= */

const IDENTITY_LOCK_SYSTEM_PROMPT = `
You are operating in IDENTITY LOCK MODE.

The uploaded reference image contains a real human subject whose identity must be preserved with maximum fidelity.

ABSOLUTE CONSTRAINTS — DO NOT ALTER:
- Facial structure, skull shape, eye spacing, nose shape, jawline, cheekbones
- Lips, ears, hairline, asymmetries, age, or skin texture
- Body proportions or pose unless explicitly requested

DO NOT beautify, stylize, normalize, or reinterpret the face.
Do NOT apply cinematic lighting that reshapes facial geometry.

Lighting and rendering must adapt to the existing face — never reshape it.

You may ONLY modify what the user explicitly requests.
If a requested change conflicts with identity preservation, preserve identity first.

PRIORITY ORDER:
1) Identity and likeness
2) Pose and proportions
3) Lighting and color
4) All other aesthetics
`.trim();

const PHOTOREALISTIC_ENHANCEMENT_SYSTEM_PROMPT = `
You are an elite photorealistic image generation engine.

Your goal is to produce a visually striking, ultra-high-quality, photorealistic image
that appears indistinguishable from a real professional photograph.

CORE DIRECTIVES:
- Preserve real-world geometry, proportions, and structure
- Accurately reproduce materials, textures, reflections, and surface detail
- Apply physically plausible lighting and realistic depth of field
- Maintain coherent perspective and spatial relationships

AUTOMATIC ENHANCEMENTS:
- Professional photographic composition
- Realistic lighting and shadows
- High dynamic range with natural contrast
- Accurate color science and white balance
- Subtle imperfections that enhance realism (micro texture, wear, natural variation)

When the user prompt is vague, make intelligent, realistic choices that improve visual quality
without changing the subject's identity or function.

DO NOT stylize, cartoonize, exaggerate proportions, or introduce unrealistic artifacts.
`.trim();

/* =========================================================
   TYPES
   ========================================================= */

export interface ReferenceAnalysis {
	hasHumanFace: boolean;
	faceBoxes: { x: number; y: number; w: number; h: number }[];
	foregroundBoxes: { x: number; y: number; w: number; h: number }[];
	subjectType: 'person' | 'product' | 'place' | 'object' | 'animal' | 'unknown';
	width: number;
	height: number;
}

type SimilarityCheck = {
	similarityScore: number;
	notes: string;
};

type ImageOut = {
	b64: string;
	dataUrl: string;
	pngBuffer: Buffer;
};

/* =========================================================
   RESPONSE EXTRACTION — handles all SDK response shapes
   ========================================================= */

function getTextFromResult(result: any): string {
	// Walk every possible path the SDK might return text
	const paths = [
		() => result?.text,
		() => result?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text,
		() => (typeof result?.response?.text === 'function' ? result.response.text() : null),
		() => result?.response?.text,
		() => result?.response?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
	];
	for (const fn of paths) {
		try {
			const val = fn();
			if (typeof val === 'string' && val.length > 0) return val.trim();
		} catch {
			console.log('catch');
		}
	}
	return '';
}

function getImageFromResult(result: any): ImageOut | null {
	const partArrays = [
		result?.candidates?.[0]?.content?.parts,
		result?.response?.candidates?.[0]?.content?.parts
	];
	for (const parts of partArrays) {
		if (!Array.isArray(parts)) continue;
		for (const p of parts) {
			if (p?.inlineData?.data) {
				const b64: string = p.inlineData.data;
				return {
					b64,
					dataUrl: `data:image/png;base64,${b64}`,
					pngBuffer: Buffer.from(b64, 'base64')
				};
			}
		}
	}
	return null;
}

/* =========================================================
   HELPERS
   ========================================================= */

function bufferToInlinePart(buffer: Buffer, mimeType = 'image/png') {
	return {
		inlineData: {
			mimeType,
			data: buffer.toString('base64')
		}
	};
}

function safeJsonParse(text: string): any {
	// Strip markdown fences, BOM, zero-width chars
	const s = text
		.replace(/```json\s*/gi, '')
		.replace(/```\s*/g, '')
		.replace(/^\uFEFF/, '')
		.replace(/[\u200B-\u200D\uFEFF]/g, '')
		.trim();

	// Direct parse
	try {
		return JSON.parse(s);
	} catch {
		console.log('catch');
	}

	// Extract between first { and last }
	const i = s.indexOf('{');
	const j = s.lastIndexOf('}');
	if (i !== -1 && j > i) {
		try {
			return JSON.parse(s.substring(i, j + 1));
		} catch {
			console.log('catch');
		}
	}

	throw new Error(`Cannot parse JSON from: ${s.slice(0, 200)}`);
}

/* =========================================================
   VISION ANALYSIS
   ========================================================= */

async function analyzeReferenceImage(
	imageBuffer: Buffer,
	width: number,
	height: number
): Promise<ReferenceAnalysis> {
	const result = await ai.models.generateContent({
		model: VISION_MODEL,
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `Is there a human face in this image? What is the subject?
Return ONLY this JSON, no markdown, no explanation:
{"hasHumanFace":true,"subjectType":"person"}
Valid subjectType values: person, product, place, object, animal, unknown`
					},
					bufferToInlinePart(imageBuffer)
				]
			}
		],
		config: {
			temperature: 0,
			maxOutputTokens: 1024
		}
	});

	const text = getTextFromResult(result);
	console.log('--- Vision text length:', text.length);
	console.log('--- Vision text:', text.slice(0, 400));

	// Try full JSON parse first
	try {
		const parsed = safeJsonParse(text);
		return {
			hasHumanFace: !!parsed.hasHumanFace,
			faceBoxes: [],
			foregroundBoxes: [],
			subjectType: parsed.subjectType ?? 'unknown',
			width,
			height
		};
	} catch {
		// Truncation fallback — extract what we can from partial JSON
		console.log('--- JSON parse failed, using fallback detection');

		const hasHumanFace =
			/hasHumanFace["'\s:]*true/i.test(text) || /subjectType["'\s:]*"?person/i.test(text);

		let subjectType: ReferenceAnalysis['subjectType'] = 'unknown';
		const typeMatch = text.match(
			/subjectType["'\s:]*"?(person|product|place|object|animal|unknown)/i
		);
		if (typeMatch) subjectType = typeMatch[1].toLowerCase() as ReferenceAnalysis['subjectType'];

		console.log(`--- Fallback result: hasHumanFace=${hasHumanFace}, subjectType=${subjectType}`);

		return {
			hasHumanFace,
			faceBoxes: [],
			foregroundBoxes: [],
			subjectType,
			width,
			height
		};
	}
}

/* =========================================================
   NANO BANANA PRO — IMAGE GENERATION
   ========================================================= */

async function editWithNanoBananaPro(params: {
	imageBuffers: Buffer[];
	prompt: string;
	model?: string;
	aspectRatio?: string;
	imageSize?: ImageSize;
}): Promise<ImageOut> {
	const parts: any[] = [{ text: params.prompt }];
	for (const buf of params.imageBuffers) {
		parts.push(bufferToInlinePart(buf));
	}

	const imageConfig: Record<string, string> = {};
	if (params.aspectRatio) imageConfig.aspectRatio = params.aspectRatio;
	if (params.imageSize) imageConfig.imageSize = params.imageSize;

	const result = await ai.models.generateContent({
		model: params.model ?? IMAGE_MODEL,
		contents: [{ role: 'user', parts }],
		config: {
			responseModalities: ['TEXT', 'IMAGE'],
			...(Object.keys(imageConfig).length > 0 ? { imageConfig } : {})
		}
	});

	const output = getImageFromResult(result);
	if (!output) {
		const errText = getTextFromResult(result);
		throw new Error(
			`Nano Banana Pro returned no image. ${errText ? errText.slice(0, 300) : 'Empty response.'}`
		);
	}

	return output;
}

/* =========================================================
   LIKENESS CHECK
   ========================================================= */

async function checkLikeness(params: {
	referenceBuffer: Buffer;
	candidateB64: string;
}): Promise<SimilarityCheck> {
	const result = await ai.models.generateContent({
		model: VISION_MODEL,
		contents: [
			{
				role: 'user',
				parts: [
					{
						text: `Identity similarity judge. Return ONLY JSON:
{"similarityScore":number,"notes":string}
90-100=same person, 75-89=drift, 0-74=different. Compare these two images.`
					},
					bufferToInlinePart(params.referenceBuffer),
					{ inlineData: { mimeType: 'image/png', data: params.candidateB64 } }
				]
			}
		],
		config: { temperature: 0, maxOutputTokens: 400 }
	});

	const text = getTextFromResult(result);
	if (!text) return { similarityScore: 0, notes: 'Empty response' };

	try {
		const j = safeJsonParse(text);
		return {
			similarityScore: typeof j.similarityScore === 'number' ? j.similarityScore : 0,
			notes: typeof j.notes === 'string' ? j.notes : ''
		};
	} catch {
		return { similarityScore: 0, notes: `Unparseable: ${text.slice(0, 120)}` };
	}
}

/* =========================================================
   MAIN HANDLER
   ========================================================= */

export async function POST({ request, locals }: { request: Request; locals: any }) {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		}

		const usageCheck = await checkUsage(userId, 'image');
		if (!usageCheck.allowed) {
			return new Response(JSON.stringify({ error: 'limit_reached', usage: usageCheck }), {
				status: 429
			});
		}

		const formData = await request.formData();
		const userPrompt = formData.get('prompt') as string | null;

		const imageFiles: File[] = [];
		for (const [key, value] of formData.entries()) {
			if (key === 'images' && value instanceof File) imageFiles.push(value);
		}

		if (!userPrompt && imageFiles.length === 0) {
			return new Response(JSON.stringify({ error: 'Missing prompt or images' }), {
				status: 400,
				headers: { 'Content-Type': 'application/json' }
			});
		}

		// ── Plan-gated generation options ────────────────────────────────
		const plan = await getUserPlan(userId);
		const tier = TIER_CONFIG[plan];

		const reqAspect = formData.get('aspectRatio') as string | null;
		const aspectRatio = reqAspect && VALID_ASPECT_RATIOS.includes(reqAspect) ? reqAspect : undefined;

		// Size: omitted = model default (pre-existing behavior). When requested,
		// clamp to the tier's ceiling — server enforces regardless of client UI.
		const reqSize = formData.get('imageSize') as string | null;
		let imageSize: ImageSize | undefined;
		if (reqSize && SIZE_LADDER.includes(reqSize as ImageSize)) {
			const tierMaxIdx = SIZE_LADDER.indexOf(tier.maxImageSize);
			const reqIdx = SIZE_LADDER.indexOf(reqSize as ImageSize);
			imageSize = SIZE_LADDER[Math.min(reqIdx, tierMaxIdx)];
		}

		// Model: premium toggle (pro plan) → Nano Banana Pro; free prompt-only → Lite
		// (Lite is not optimized for reference inputs); everything else → NB2 flash.
		const premium = formData.get('quality') === 'premium' && tier.canUsePremiumImage;
		const model = premium
			? IMAGE_MODEL_PRO
			: imageFiles.length === 0 && plan === 'free'
				? IMAGE_MODEL_LITE
				: IMAGE_MODEL;
		if (model === IMAGE_MODEL_LITE) imageSize = undefined; // Lite only does 1K — its default
		if (imageSize === '4K' && !premium) imageSize = '2K'; // 4K requires the premium model

		// Variants: parallel candidates — each is billed and counts against quota
		const reqVariants = parseInt((formData.get('variants') as string) || '1') || 1;
		let variants = Math.max(1, Math.min(reqVariants, tier.maxImageVariants));
		if (usageCheck.imagesRemaining >= 0) {
			variants = Math.min(variants, Math.max(1, usageCheck.imagesRemaining));
		}

		const genOpts = { model, aspectRatio, imageSize };
		console.log(`🖼️ ${model} | ${aspectRatio ?? 'auto'} @ ${imageSize ?? 'default'} ×${variants} | plan:${plan} | refs:${imageFiles.length}`);

		// 1) Normalize primary to PNG
		if (imageFiles.length === 0) {
			// Prompt-only generation — N parallel variants
			const outs = await Promise.all(
				Array.from({ length: variants }, () =>
					editWithNanoBananaPro({
						imageBuffers: [],
						prompt: `${PHOTOREALISTIC_ENHANCEMENT_SYSTEM_PROMPT}\n\nUSER REQUEST:\n${userPrompt}\n\nCommercial-grade realism. Crisp detail. Accurate materials. Plausible lighting.`,
						...genOpts
					})
				)
			);

			await incrementUsage(userId, 'image', outs.length);
			return new Response(
				JSON.stringify({
					success: true,
					imageUrl: outs[0].dataUrl,
					imageUrls: outs.map((o) => o.dataUrl),
					mode: 'prompt-only',
					model,
					imagesUsed: 0
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}
		// 1) Normalize primary to PNG — only reached if imageFiles.length > 0
		const primaryBuffer = await sharp(Buffer.from(await imageFiles[0].arrayBuffer()))
			.rotate()
			.png()
			.toBuffer();
		const meta = await sharp(primaryBuffer).metadata();
		const width = meta.width!;
		const height = meta.height!;

		// 2) Normalize all refs
		const allBuffers: Buffer[] = [primaryBuffer];
		for (let i = 1; i < imageFiles.length; i++) {
			const buf = await sharp(Buffer.from(await imageFiles[i].arrayBuffer()))
				.rotate()
				.png()
				.toBuffer();
			allBuffers.push(buf);
		}

		// 3) Analyze
		const analysis = await analyzeReferenceImage(primaryBuffer, width, height);
		const isHuman = analysis.hasHumanFace;

		console.log(
			`Mode: ${isHuman ? 'HUMAN' : 'NON-HUMAN'} | Subject: ${analysis.subjectType} | Refs: ${imageFiles.length}`
		);

		// 4) Multi-image compositing guidance
		let compositeGuidance = '';
		if (allBuffers.length > 1) {
			const parts: any[] = [
				{
					text: `User request: ${userPrompt}\n\nProvide concise compositing guidance for these ${allBuffers.length} images.`
				}
			];
			for (const buf of allBuffers) parts.push(bufferToInlinePart(buf));

			const gResult = await ai.models.generateContent({
				model: VISION_MODEL,
				contents: [{ role: 'user', parts }],
				config: { temperature: 0.2, maxOutputTokens: 800 }
			});
			compositeGuidance = getTextFromResult(gResult);
		}

		/* ---- HUMAN PIPELINE ---- */

		if (isHuman) {
			// Stabilization pass — once, shared across variants
			const stabilized = await editWithNanoBananaPro({
				imageBuffers: [primaryBuffer],
				prompt: `${IDENTITY_LOCK_SYSTEM_PROMPT}\n\nTASK: Faithfully reconstruct this reference image. Change nothing. No beautification, no stylization. Pixel-level identity fidelity.`,
				...genOpts
			});

			const stabSim = await checkLikeness({
				referenceBuffer: primaryBuffer,
				candidateB64: stabilized.b64
			});
			console.log('Stabilization:', stabSim.similarityScore, stabSim.notes);

			// Edit pass — each variant generated + likeness-checked (+ retried) independently
			const editPrompt = `${IDENTITY_LOCK_SYSTEM_PROMPT}\n\n${compositeGuidance ? `COMPOSITING:\n${compositeGuidance}\n\n` : ''}USER REQUEST:\n${userPrompt}\n\nFace is PROTECTED. Apply edits everywhere else. Maintain photorealism.`;

			const genVariant = async () => {
				let final = await editWithNanoBananaPro({ imageBuffers: allBuffers, prompt: editPrompt, ...genOpts });
				let sim = await checkLikeness({ referenceBuffer: primaryBuffer, candidateB64: final.b64 });

				// Retry if drifted
				if (sim.similarityScore < 85) {
					const retryPrompt = `${IDENTITY_LOCK_SYSTEM_PROMPT}\n\n${compositeGuidance ? `COMPOSITING:\n${compositeGuidance}\n\n` : ''}USER REQUEST:\n${userPrompt}\n\nCRITICAL RETRY: Previous attempt drifted. The person MUST be unmistakably identical. Be extremely conservative.`;

					final = await editWithNanoBananaPro({ imageBuffers: allBuffers, prompt: retryPrompt, ...genOpts });
					sim = await checkLikeness({ referenceBuffer: primaryBuffer, candidateB64: final.b64 });
				}
				return { final, sim };
			};

			const results = await Promise.all(Array.from({ length: variants }, genVariant));
			results.forEach((r, i) => console.log(`Variant ${i}:`, r.sim.similarityScore, r.sim.notes));

			await incrementUsage(userId, 'image', results.length);
			return new Response(
				JSON.stringify({
					success: true,
					imageUrl: results[0].final.dataUrl,
					imageUrls: results.map((r) => r.final.dataUrl),
					mode: 'identity-lock',
					model,
					imagesUsed: imageFiles.length,
					faceProtected: true,
					similarity: results[0].sim,
					similarities: results.map((r) => r.sim),
					stabilizationSimilarity: stabSim
				}),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}

		/* ---- NON-HUMAN PIPELINE ---- */

		const outs = await Promise.all(
			Array.from({ length: variants }, () =>
				editWithNanoBananaPro({
					imageBuffers: allBuffers,
					prompt: `${PHOTOREALISTIC_ENHANCEMENT_SYSTEM_PROMPT}\n\n${compositeGuidance ? `COMPOSITING:\n${compositeGuidance}\n\n` : ''}USER REQUEST:\n${userPrompt}\n\nCommercial-grade realism. Crisp detail. Accurate materials. Plausible lighting.`,
					...genOpts
				})
			)
		);

		await incrementUsage(userId, 'image', outs.length);
		return new Response(
			JSON.stringify({
				success: true,
				imageUrl: outs[0].dataUrl,
				imageUrls: outs.map((o) => o.dataUrl),
				mode: 'photorealistic',
				model,
				imagesUsed: imageFiles.length
			}),
			{ headers: { 'Content-Type': 'application/json' } }
		);
	} catch (err) {
		console.error('Image generation error:', err);
		return new Response(
			JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
}
