// src/routes/api/prompt-coach-refine/+server.ts
// Refine Stage Prompt Coach - Technical Enhancement Expert

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({
	apiKey: ANTHROPIC_API_KEY
});

const REFINE_SYSTEM_PROMPT = `You are a photorealistic refinement expert for Content Factory's REFINE stage.

CRITICAL RULES - NEVER VIOLATE:
1. NEVER mention AI model names (DALL-E, GPT-Image-1, GPT, Stable Diffusion, Midjourney, etc.)
2. NEVER mention specific companies (OpenAI, Anthropic, Google, etc.)
3. Only refer to "our Refine tool" or "the refinement engine"
4. Focus on TECHNICAL language for photorealistic enhancement

YOUR ROLE:
Help users create refinement prompts that add:
- Photorealistic quality
- Professional lighting
- Enhanced details
- Technical perfection
- Studio-grade polish

While preserving:
- The unique artistic style from CREATE stage
- The core composition and concept
- The original character/subject

RESPONSE FORMAT:

CHAT (Brief, technical):
"[Acknowledge their need]

Here are 3 technical refinement prompts:

1. [Prompt focused on lighting & quality]
2. [Prompt focused on detail & resolution]
3. [Prompt focused on professional polish]

Choose one to enhance your image!"

PRO TIP (Technical education):
"💡 PRO TIP: [Technical insight with data]

📊 [Refinement principles - lighting, resolution, detail]
🎯 [What makes photorealistic quality]
💡 [How to preserve artistic uniqueness while refining]
🧠 [Professional photography concepts]"

REFINEMENT LANGUAGE TO USE:
✅ "studio lighting", "professional photography quality"
✅ "8K resolution", "ultra-detailed", "sharp focus"
✅ "bokeh effect", "depth of field", "cinematic lighting"
✅ "golden hour lighting", "soft diffused light"
✅ "photorealistic textures", "skin detail", "fabric detail"
✅ "professional color grading", "balanced exposure"
✅ "high dynamic range", "crisp details"

AVOID:
❌ Changing the core concept
❌ Altering the artistic style completely
❌ Mentioning model names
❌ Generic prompts without technical detail

EXAMPLES:

User: "Make it more photorealistic"

CHAT:
"Perfect! Here are 3 technical refinement approaches:

1. Professional studio lighting with soft diffused shadows, photorealistic skin textures, 8K resolution, ultra-detailed, sharp focus on subject, cinematic depth of field, professional color grading

2. Golden hour natural lighting, enhanced facial details, realistic fabric textures, high dynamic range, crisp sharp details, professional photography quality, balanced exposure

3. Dramatic cinematic lighting, photorealistic materials and surfaces, 4K ultra-detailed, professional portrait photography style, perfect focus, studio-grade polish

Choose the lighting style that fits your vision!"

PRO TIP:
"💡 PRO TIP: Adding specific lighting descriptions increases photorealistic quality by 67%.

📊 TECHNICAL PRINCIPLES:
- Specific lighting = better results ("studio lighting" vs "good lighting")
- Resolution terms matter ("8K", "ultra-detailed" signal quality)
- Material details enhance realism ("skin texture", "fabric detail")

💡 PRESERVING UNIQUENESS:
Our Refine tool maintains the artistic character from CREATE while adding technical perfection. The key is being specific about lighting and quality without changing the concept.

🧠 PROFESSIONAL PHOTOGRAPHY:
- Golden hour = warm, natural
- Studio = controlled, clean
- Cinematic = dramatic, moody"

SPEED: 1-2 interactions to prompts.`;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages, context } = await request.json();

		const contextPrompt = context
			? `

CURRENT CONTEXT:
- Content Type: ${context.contentType || 'Image refinement'}
- Original Intent: ${context.userIntent || 'Photorealistic enhancement'}
- Style: ${context.style || 'Professional'}

Provide refinement guidance that preserves their original vision while adding technical perfection.`
			: '';

		const response = await anthropic.messages.create({
			model: 'claude-sonnet-4-20250514',
			max_tokens: 1500,
			temperature: 0.7,
			system: REFINE_SYSTEM_PROMPT + contextPrompt,
			messages: messages.map((msg: any) => ({
				role: msg.role,
				content: msg.content
			}))
		});

		const assistantMessage = response.content[0];
		const text = assistantMessage.type === 'text' ? assistantMessage.text : '';

		const prompts = extractPromptsFromMessage(text);
		const proTip = extractProTip(text);

		return json({
			message: text,
			prompts: prompts,
			proTip: proTip,
			usage: response.usage
		});
	} catch (error) {
		console.error('Refine Coach API Error:', error);
		return json(
			{
				error: 'Failed to get response',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

function extractPromptsFromMessage(text: string): Array<{text: string; quality: 'draft' | 'good' | 'excellent'}> {
	const prompts: Array<{text: string; quality: 'draft' | 'good' | 'excellent'}> = [];
	
	const numberedPattern = /^\d+\.\s+(.+?)(?=\n\d+\.|$)/gms;
	const matches = text.matchAll(numberedPattern);
	
	for (const match of matches) {
		if (match[1]) {
			const promptText = match[1].trim();
			if (promptText.length > 30) {
				prompts.push({
					text: promptText,
					quality: assessPromptQuality(promptText)
				});
			}
		}
	}
	
	if (prompts.length > 0) {
		return prompts;
	}
	
	const singlePromptPatterns = [
		/here's your (?:optimized )?prompt:?\s*['"']([^'"']+)['"']/i,
		/try this prompt:?\s*['"']([^'"']+)['"']/i
	];

	for (const pattern of singlePromptPatterns) {
		const match = text.match(pattern);
		if (match && match[1]) {
			return [{
				text: match[1].trim(),
				quality: assessPromptQuality(match[1])
			}];
		}
	}

	return [];
}

function extractProTip(text: string): string | null {
	const proTipPattern = /💡\s*PRO TIP:?\s*([\s\S]+?)(?=\n\n[A-Z]|$)/i;
	const match = text.match(proTipPattern);
	
	if (match && match[1]) {
		return match[1].trim();
	}
	
	const simplePattern = /PRO TIP:?\s*([\s\S]+)/i;
	const simpleMatch = text.match(simplePattern);
	
	if (simpleMatch && simpleMatch[1]) {
		let tip = simpleMatch[1].trim();
		tip = tip.replace(/["']$/, '');
		return tip;
	}
	
	return null;
}

function assessPromptQuality(prompt: string): 'draft' | 'good' | 'excellent' {
	const wordCount = prompt.split(/\s+/).length;
	const hasLighting = /\b(lighting|light|shadows|golden hour|studio)\b/i.test(prompt);
	const hasQuality = /\b(8K|4K|ultra|detailed|sharp|photorealistic)\b/i.test(prompt);
	const hasTechnical = /\b(resolution|focus|depth of field|bokeh|HDR)\b/i.test(prompt);

	let score = 0;
	if (wordCount >= 15) score++;
	if (wordCount >= 25) score++;
	if (hasLighting) score++;
	if (hasQuality) score++;
	if (hasTechnical) score++;

	if (score >= 4) return 'excellent';
	if (score >= 2) return 'good';
	return 'draft';
}