// src/routes/api/stripe/webhook/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { adminDb } from '$lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import type { PlanTier } from '$lib/types/subscription';

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2024-12-18.acacia' });

/**
 * Map Stripe price ID to plan tier
 */
function getPlanFromPriceId(priceId: string): PlanTier {
	if (priceId === env.STRIPE_PRO_PRICE_ID) return 'pro';
	if (priceId === env.STRIPE_STARTER_PRICE_ID) return 'starter';
	return 'free';
}

/**
 * Update user's subscription in Firestore
 */
async function updateUserSubscription(
	customerId: string,
	updates: {
		plan: PlanTier;
		stripeSubscriptionId: string | null;
		subscriptionStatus: string | null;
		subscriptionPeriodEnd: Timestamp | null;
		stripePriceId: string | null;
	}
) {
	// Find user by Stripe customer ID
	const usersQuery = await adminDb
		.collection('users')
		.where('stripeCustomerId', '==', customerId)
		.limit(1)
		.get();

	if (usersQuery.empty) {
		console.error('No user found for Stripe customer:', customerId);
		return;
	}

	const userDoc = usersQuery.docs[0];
	await userDoc.ref.update(updates);
	console.log(`Updated subscription for user ${userDoc.id}: plan=${updates.plan}, status=${updates.subscriptionStatus}`);
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.text();
		const signature = request.headers.get('stripe-signature');

		if (!signature) {
			return json({ error: 'No signature' }, { status: 400 });
		}

		// Verify webhook signature
		let event: Stripe.Event;
		try {
			event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET!);
		} catch (err: any) {
			console.error('Webhook signature verification failed:', err.message);
			return json({ error: 'Invalid signature' }, { status: 400 });
		}

		// Handle events
		switch (event.type) {
			case 'checkout.session.completed': {
				const session = event.data.object as Stripe.Checkout.Session;
				if (session.subscription && session.customer) {
					const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
					const priceId = subscription.items.data[0]?.price.id;
					const plan = getPlanFromPriceId(priceId);

					await updateUserSubscription(session.customer as string, {
						plan,
						stripeSubscriptionId: subscription.id,
						subscriptionStatus: subscription.status,
						subscriptionPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
						stripePriceId: priceId
					});
				}
				break;
			}

			case 'customer.subscription.updated': {
				const subscription = event.data.object as Stripe.Subscription;
				const priceId = subscription.items.data[0]?.price.id;
				const plan = getPlanFromPriceId(priceId);

				await updateUserSubscription(subscription.customer as string, {
					plan: subscription.status === 'active' ? plan : 'free',
					stripeSubscriptionId: subscription.id,
					subscriptionStatus: subscription.status,
					subscriptionPeriodEnd: Timestamp.fromMillis(subscription.current_period_end * 1000),
					stripePriceId: priceId
				});
				break;
			}

			case 'customer.subscription.deleted': {
				const subscription = event.data.object as Stripe.Subscription;

				await updateUserSubscription(subscription.customer as string, {
					plan: 'free',
					stripeSubscriptionId: null,
					subscriptionStatus: 'canceled',
					subscriptionPeriodEnd: null,
					stripePriceId: null
				});
				break;
			}

			case 'invoice.payment_failed': {
				const invoice = event.data.object as Stripe.Invoice;
				if (invoice.customer) {
					// Don't downgrade immediately — Stripe retries
					// Just mark as past_due
					const usersQuery = await adminDb
						.collection('users')
						.where('stripeCustomerId', '==', invoice.customer as string)
						.limit(1)
						.get();

					if (!usersQuery.empty) {
						await usersQuery.docs[0].ref.update({
							subscriptionStatus: 'past_due'
						});
					}
				}
				break;
			}

			default:
				console.log(`Unhandled Stripe event: ${event.type}`);
		}

		return json({ received: true });
	} catch (error: any) {
		console.error('Webhook error:', error);
		return json({ error: error.message }, { status: 500 });
	}
};
