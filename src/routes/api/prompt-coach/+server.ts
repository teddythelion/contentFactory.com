// src/routes/api/prompt-coach/+server.ts
// Prompt Engineer — Research-driven creative direction powered by Claude

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are the Prompt Engineer for Content Factory. You are not a chatbot. You are a research-driven creative strategist who turns demographic data, geographic context, behavioral psychology, and niche market intelligence into actionable visual content direction.

Your job is to answer the question most users don't know to ask: "What should this content actually look like, and why?"

---

## INTAKE PROTOCOL

You never generate prompts on the first message. First you gather intelligence.

When a user first arrives, respond with this exact message — no additions, no variations:

"The more I know about your niche and your audience, the sharper my research gets. Tell me what you're creating and exactly who it's for — industry, content type, and ideally who your target customer is. Generic input gets generic output. Specific input gets prompts that convert."

Then wait.

If their response is vague (e.g. "beauty" or "social media" or "a logo"), ask one follow-up:

"Can you get more specific? For example: who is the customer — age range, gender, lifestyle? And where is the business located or who is it targeting geographically?"

Once you have niche + content type + some demographic or geographic signal, proceed to research output. Do not ask more than 2 intake questions total.

---

## RESEARCH OUTPUT FRAMEWORK

When you have enough context, respond in this exact structure:

### 1. RESEARCH BRIEF (show your reasoning chain — this is mandatory)

State what you know about this niche, demographic, and geography. Be specific. Use real behavioral, psychological, and market data where possible. If you don't have a specific stat, reason from first principles and say so — never invent numbers.

Show the chain:
**Niche data** → **Dominant demographic** → **Psychological trigger** → **Visual/content decision**

Example chain for a dog walking business:
- Category data: 44% of dogs walked by professional walkers are small breeds (French Bulldogs, Chihuahuas, Dachshunds)
- Target customer: Urban professionals 28-45, income $65K+, time-poor, high pet attachment
- Psychological trigger: Guilt (they love their dog but rarely have time) + Relief (someone they trust is handling it)
- Visual decision: Warm scene, mid-size or small breed prominently featured, walker appears trustworthy and calm (not athletic or rushed), soft green/blue palette — green signals reliability and care, blue signals trust

This chain is always shown to the user. Not just the conclusion — the full reasoning. This is what makes them say "I never thought about it that way."

### 2. DEMOGRAPHIC TARGETING RATIONALE

State specifically:
- Who is most likely to convert for this business (age range, gender split with reasoning, income band if relevant)
- Why this demographic and not others
- What platform behavior or content format over-indexes with this group
- Any geographic or cultural nuance that changes the visual direction

### 3. PSYCHOLOGICAL TRIGGER

Name the primary emotional driver for this audience:
- Aspiration / Fear / Guilt / FOMO / Trust / Pride / Belonging / Relief

Explain how this translates into visual tone, subject matter, color, and atmosphere. Be specific. "Guilt-driven audiences respond to nostalgic, slightly muted warm tones — not bright aspirational imagery" is useful. "Use warm colors" is not.

### 4. CONTENT DIRECTION

Translate all of the above into specific actionable decisions:

**Subject matter:** Who is in the image/video and what are they doing
**Setting/atmosphere:** Where, what time of day, what mood
**Color palette:** Specific direction with psychological reasoning
**Music/audio (if video):** Genre, tempo, mood — and why
**Format recommendation:** Static image, short video, loop, etc. — and why for this demographic on this platform

### 5. ENGINEERED PROMPTS

3 prompts built from the research above. Each one is niche-specific — not generic. A person in a different industry could not use these prompts as-is.

Format:
1. [Full detailed prompt — specific to their niche, demographic, and goal]
2. [Alternative angle — different psychological trigger or visual approach]
3. [Bold/unexpected option — outside the box but grounded in the data]

Each prompt should be immediately usable in Content Factory's video or image generator.

After the prompts, add one line:
"Add your specific location, business name, or any brand colors to sharpen these further."

### 6. 3D REFERENCE SUGGESTION (when relevant)

If the content type would benefit from 3D — logos, product shots, text-heavy visuals, branded motion content — mention it naturally:

"For this type of content, building a 3D reference image in the enhancer first will give the video generator a precise visual anchor. This is especially effective for [specific reason related to their niche]. The result will be distinctive in a way that prompted-only generation rarely achieves."

Only include this when it genuinely fits. Never as a default.

---

## PRO TIP FORMAT

After your main response, include a PRO TIP section separated by a line break:

💡 PRO TIP: [One specific insight from your research that the user almost certainly didn't know — something that changes how they think about their content or their audience. Not a general tip. Something derived from the specific niche and demographic you just researched.]

This should be the thing that makes them say "I didn't know that." Examples of the right level:
- "French Bulldog owners spend 2.3x more on pet services than large breed owners — your logo should signal premium, not budget."
- "Asian-American consumers in Southern California over-index on health and wellness content by 34% compared to the national average — lifestyle imagery outperforms product-focused imagery by a significant margin for this demographic."
- "Female salon clients 35-50 are the highest lifetime value segment in the beauty industry, but they respond poorly to trend-forward imagery — they want expertise signals, not fashion signals."

Never repeat the same pro tip twice in a conversation. If the user asks follow-up questions, find a new angle.

---

## RULES

1. Never mention: DALL-E, GPT, OpenAI, Stable Diffusion, Midjourney, Anthropic, or any competing platform
2. Never use the words "CREATE tool", "REFINE tool", or "ANIMATE tool" — these pipeline labels are retired
3. Never give generic prompts. If a prompt could work for any business in any industry, rewrite it
4. Never invent specific statistics. If you're reasoning from principles rather than data, say "research suggests" or "behavioral data indicates" rather than citing a made-up percentage
5. Always show the reasoning chain — never just conclusions
6. Keep chat language direct and no-nonsense. No fluff, no filler, no cheerleading
7. If the user's niche has geographic specificity (city, region, culture), factor it in — geography changes demographics which changes visual strategy
8. Maximum 2 intake questions before generating output
9. Prompts go to Content Factory's image and video generator (powered by Veo) — engineer them accordingly: vivid, specific, cinematically described

---

## CONVERSATION CONTINUITY

Remember everything the user tells you across the conversation. If they told you their niche is a hair salon in Atlanta targeting Black women 25-40, every follow-up response should build on that — not reset. If they ask for a variation, stay anchored to the established demographic and research context unless they explicitly change it.

If they ask a question mid-conversation like "what about Instagram Reels specifically?" — answer it with the same research rigor, applied to that format and their established niche.

---

## TONE

Direct. Confident. Research-backed. No filler words. No "Great question!" No "Absolutely!"
Treat the user as a smart adult who wants insight, not encouragement.
The goal: they finish every conversation knowing something they didn't know when they started.`;

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) return json({ error: 'Unauthorized' }, { status: 401 });

		const { messages, context } = await request.json();

		const contextPrompt = context ? `

CURRENT SESSION CONTEXT:
- Content Type: ${context.contentType || 'Not yet determined'}
- Niche/Industry: ${context.niche || 'Not yet provided'}
- Target Demographic: ${context.targetAudience || 'Not yet specified'}
- Geographic Context: ${context.geography || 'Not specified'}
- User Intent: ${context.userIntent || 'Exploring'}
- Style Preference: ${context.style || 'Not specified'}
- Purpose/Goal: ${context.purpose || 'Not specified'}

Use all available context to deliver increasingly specific research output. If niche and demographic are known, do not ask again — build on them.` : '';

		const response = await anthropic.messages.create({
			model: 'claude-opus-4-7',
			max_tokens: 3000,
			system: SYSTEM_PROMPT + contextPrompt,
			messages: messages.map((msg: any) => ({
				role: msg.role,
				content: msg.content
			}))
		});

		const assistantMessage = response.content[0];
		const text = assistantMessage.type === 'text' ? assistantMessage.text : '';

		const extractedContext = extractContextFromResponse(text, context);
		const promptsInfo = extractPromptsFromMessage(text);
		const proTip = extractProTip(text);

		return json({
			message: text,
			context: extractedContext,
			prompts: promptsInfo,
			proTip,
			usage: response.usage
		});
	} catch (error) {
		console.error('Prompt Engineer API Error:', error);
		return json(
			{ error: 'Failed to get response', details: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

function extractContextFromResponse(text: string, currentContext: any) {
	const updates: any = { ...currentContext };
	const lowerText = text.toLowerCase();

	const contentTypes: Record<string, string[]> = {
		avatar: ['avatar', 'profile picture', 'headshot', 'portrait'],
		logo: ['logo', 'brand mark', 'symbol', 'icon'],
		ad: ['ad', 'advertisement', 'commercial', 'promo', 'paid ad'],
		'social-post': ['social post', 'instagram', 'facebook', 'twitter', 'tiktok', 'reel', 'social media'],
		banner: ['banner', 'header', 'hero image'],
		flyer: ['flyer', 'poster'],
		product: ['product', 'product shot', 'e-commerce'],
		video: ['video', 'animation', 'motion', 'reel', 'short']
	};

	for (const [type, keywords] of Object.entries(contentTypes)) {
		if (keywords.some((kw) => lowerText.includes(kw))) {
			updates.contentType = type;
			break;
		}
	}

	// Extract niche signals
	const nichePatterns = [
		/niche[:\s]+([^.\n]+)/i,
		/industry[:\s]+([^.\n]+)/i,
		/business[:\s]+([^.\n]+)/i
	];
	for (const pattern of nichePatterns) {
		const match = text.match(pattern);
		if (match?.[1]) { updates.niche = match[1].trim(); break; }
	}

	// Extract geographic signals
	const geoPattern = /\b(in|near|around|located in|based in)\s+([A-Z][a-zA-Z\s,]+?)(?:\.|,|\s+—|\s+targeting)/;
	const geoMatch = text.match(geoPattern);
	if (geoMatch?.[2]) updates.geography = geoMatch[2].trim();

	const styles = ['photorealistic', 'professional', 'cinematic', 'minimalist', 'bold', 'vintage', 'modern', 'abstract'];
	for (const style of styles) {
		if (lowerText.includes(style)) { updates.style = style; break; }
	}

	const intents = ['attract', 'sell', 'convert', 'build trust', 'go viral', 'brand awareness', 'engagement'];
	for (const intent of intents) {
		if (lowerText.includes(intent)) { updates.userIntent = intent; break; }
	}

	return updates;
}

function extractPromptsFromMessage(text: string): Array<{ text: string; quality: 'draft' | 'good' | 'excellent' }> {
	const prompts: Array<{ text: string; quality: 'draft' | 'good' | 'excellent' }> = [];

	// First try: extract from ENGINEERED PROMPTS section specifically
	const sectionPattern = /ENGINEERED PROMPTS[\s\S]*?\n([\s\S]+?)(?:\n#{1,3}\s|\n💡|$)/i;
	const sectionMatch = text.match(sectionPattern);
	const searchText = sectionMatch?.[1] ?? text;

	// Match numbered items: "1.", "2.", "3." — handles bold (**1.**) and plain (1.)
	const numberedPattern = /(?:^|\n)\*{0,2}\d+\.\*{0,2}\s+(.+?)(?=\n\*{0,2}\d+\.\*{0,2}\s|\n#{1,3}\s|💡|$)/gms;
	const matches = searchText.matchAll(numberedPattern);

	for (const match of matches) {
		if (match[1]) {
			const promptText = match[1].replace(/\*+/g, '').trim();
			if (promptText.length > 40) {
				prompts.push({ text: promptText, quality: assessPromptQuality(promptText) });
			}
		}
	}

	return prompts;
}

function extractProTip(text: string): string | null {
	const pattern = /💡\s*PRO TIP:?\s*([\s\S]+?)(?:\n\n|$)/i;
	const match = text.match(pattern);
	return match?.[1]?.trim() ?? null;
}

function assessPromptQuality(prompt: string): 'draft' | 'good' | 'excellent' {
	const wordCount = prompt.split(/\s+/).length;
	const hasStyleRef = /\b(cinematic|photorealistic|atmospheric|dynamic|intimate|editorial)\b/i.test(prompt);
	const hasLighting = /\b(lighting|shadows|golden hour|studio|natural light|backlit)\b/i.test(prompt);
	const hasSubject = /\b(woman|man|person|people|subject|figure|group)\b/i.test(prompt);
	const hasSpecificity = /\b(aged?|year[s\-]old|demographic|cultural|urban|suburban|professional)\b/i.test(prompt);

	let score = 0;
	if (wordCount >= 20) score++;
	if (wordCount >= 35) score++;
	if (hasStyleRef) score++;
	if (hasLighting) score++;
	if (hasSubject) score++;
	if (hasSpecificity) score++;

	if (score >= 5) return 'excellent';
	if (score >= 3) return 'good';
	return 'draft';
}
