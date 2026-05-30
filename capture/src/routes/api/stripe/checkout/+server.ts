// src/routes/api/stripe/checkout/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import Stripe from 'stripe';

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });

const PRICE_MAP: Record<string, string> = {
	pro: env.STRIPE_PRO_PRICE_ID!,
	starter: env.STRIPE_SARTER_PRICE_ID!
};

export const POST: RequestHandler = async ({ request, locals, url }) => {
	try {
		const userId = locals.user?.uid;
		if (!userId) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { plan } = await request.json() as { plan: 'pro' | 'unlimited' };

		if (!plan || !PRICE_MAP[plan]) {
			return json({ error: 'Invalid plan' }, { status: 400 });
		}

		// Check if user already has a Stripe customer ID
		const userDoc = await adminDb.collection('users').doc(userId).get();
		const userData = userDoc.data();
		let customerId = userData?.stripeCustomerId;

		// Create Stripe customer if needed
		if (!customerId) {
			const customer = await stripe.customers.create({
				email: locals.user?.email || undefined,
				metadata: { firebaseUid: userId }
			});
			customerId = customer.id;

			// Save customer ID to user profile
			await adminDb.collection('users').doc(userId).update({
				stripeCustomerId: customerId
			});
		}

		// Create checkout session
		const session = await stripe.checkout.sessions.create({
			customer: customerId,
			mode: 'subscription',
			payment_method_types: ['card'],
			line_items: [
				{
					price: PRICE_MAP[plan],
					quantity: 1
				}
			],
			success_url: `${url.origin}/settings?upgraded=true`,
			cancel_url: `${url.origin}/settings?canceled=true`,
			metadata: {
				firebaseUid: userId,
				plan
			}
		});

		return json({ url: session.url });
	} catch (error: any) {
		console.error('Stripe checkout error:', error);
		return json({ error: error.message || 'Failed to create checkout' }, { status: 500 });
	}
};