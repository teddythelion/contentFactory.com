// src/routes/api/google-fonts/+server.ts
import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const apiKey = env.GOOGLE_API_KEY;
		
		if (!apiKey) {
			console.error('❌ No API key found');
			return json({ success: false, fonts: [], error: 'No API key' });
		}

		const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
		const response = await fetch(url);
		console.log('🌐 Fetching Google Fonts from:', url);
		if (!response.ok) {
			console.error('❌ API error:', response.status);
			return json({ success: false, fonts: [], error: 'API error' });
		}

		const data = await response.json();
		console.log('📦 Data received from Google', data.length);
		// JUST PASS THROUGH THE DATA - DON'T TRANSFORM IT
		// Keep everything: family, variants, category, AND files
		const fonts = data.items || [];

		console.log(`✅ Fetched ${fonts.length} fonts`);
		console.log('First font has files?', !!fonts[0]?.files);

		return json({
			success: true,
			fonts: fonts,
			total: fonts.length
		});

	} catch (error) {
		console.error('❌ Error:', error);
		return json({ success: false, fonts: [], error: 'Failed to fetch' });
	}
};