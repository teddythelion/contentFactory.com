// src/routes/api/stripe/portal/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });

export const POST: RequestHandler = async ({ locals, url }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Get user's Stripe customer ID
		const userDoc = await adminDb.collection('users').doc(userId).get();
		const userData = userDoc.data();

		if (!userData?.stripeCustomerId) {
			return json({ error: 'No subscription found' }, { status: 400 });
		}

		// Create portal session
		const session = await stripe.billingPortal.sessions.create({
			customer: userData.stripeCustomerId,
			return_url: `${url.origin}/settings`
		});

		return json({ url: session.url });
	} catch (error: any) {
		console.error('Stripe portal error:', error);
		return json({ error: error.message || 'Failed to create portal session' }, { status: 500 });
	}
};