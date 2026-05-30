<script lang="ts">
	// Cookie Policy — Content Factory
	// Svelte 5 runes mode
	import { resolve } from '$app/paths';
	const lastUpdated = 'March 2026';

	const cookieTypes = [
		{
			id: 'essential',
			type: 'Essential / Strictly Necessary',
			description:
				'These cookies are required for the Service to function. They cannot be disabled.',
			canDisable: false,
			examples: [
				{
					name: 'Firebase Auth Session',
					purpose: 'Maintains your authenticated session so you stay logged in',
					duration: 'Session / 1 year'
				},
				{
					name: 'CSRF Token',
					purpose: 'Protects against cross-site request forgery attacks',
					duration: 'Session'
				},
				{
					name: 'Session Storage',
					purpose:
						'Temporarily stores your work (current prompt, video state) within a browser session',
					duration: 'Session'
				}
			]
		},
		{
			id: 'functional',
			type: 'Functional',
			description:
				'These cookies remember your preferences and settings to improve your experience.',
			canDisable: true,
			examples: [
				{
					name: 'Theme Preference',
					purpose: 'Remembers your display preferences',
					duration: '1 year'
				},
				{
					name: 'Last Active Tool',
					purpose: 'Returns you to the tool you were last using',
					duration: '30 days'
				}
			]
		},
		{
			id: 'analytics',
			type: 'Analytics',
			description:
				'These cookies help us understand how users interact with the Service so we can improve it.',
			canDisable: true,
			examples: [
				{
					name: 'Firebase Analytics',
					purpose: 'Tracks feature usage, page views, and session data to improve the platform',
					duration: '2 years'
				},
				{
					name: 'Error Logging',
					purpose: 'Captures error events to help us identify and fix bugs',
					duration: '90 days'
				}
			]
		},
		{
			id: 'thirdparty',
			type: 'Third-Party',
			description: 'Cookies set by third-party services integrated into the platform.',
			canDisable: true,
			examples: [
				{
					name: 'Google APIs',
					purpose: 'Required for Google authentication and Google Cloud services',
					duration: 'Varies'
				},
				{
					name: 'Stripe',
					purpose: 'Used for secure payment processing on paid plans',
					duration: 'Session / 1 year'
				}
			]
		}
	];
</script>

<div class="min-h-screen bg-base-100">
	<!-- Header -->
	<div class="border-b border-white/5 bg-base-200 px-6 py-16 text-center">
		<div class="mx-auto max-w-3xl">
			<div
				class="mb-4 inline-block rounded-full border border-info/30 bg-info/10 px-4 py-1.5 text-xs font-semibold tracking-widest text-info uppercase"
			>
				Legal
			</div>
			<h1 class="mb-4 text-4xl font-black text-white">Cookie Policy</h1>
			<p class="text-sm text-white/40">Last updated: {lastUpdated}</p>
		</div>
	</div>

	<div class="mx-auto max-w-3xl px-6 py-16">
		<div class="space-y-12 text-sm leading-relaxed text-white/70">
			<!-- Intro -->
			<div>
				<p class="mb-4">
					This Cookie Policy explains how Content Factory ("we", "us", or "our") uses cookies and
					similar tracking technologies when you use our platform at
					<span class="text-info">contentfactory.studio</span> (the "Service").
				</p>
				<p>
					By using the Service, you consent to our use of cookies as described in this policy. You
					can manage your cookie preferences at any time as described in Section 4 below.
				</p>
			</div>

			<!-- Section 1 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">1. What Are Cookies?</h2>
				<p class="mb-4">
					Cookies are small text files that are placed on your device (computer, tablet, or mobile)
					when you visit a website. They are widely used to make websites work efficiently, provide
					a better user experience, and give website owners information about how their site is
					being used.
				</p>
				<p class="mb-4">
					In addition to traditional cookies, we may also use similar technologies such as:
				</p>
				<ul class="space-y-2 pl-4">
					{#each ['Local Storage: browser storage that persists beyond a single session', 'Session Storage: temporary browser storage cleared when you close your browser', 'Web Beacons: small images embedded in pages that track interactions', 'Fingerprinting: device characteristics used to identify returning users'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Section 2 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">2. Types of Cookies We Use</h2>
				<p class="mb-8">
					We use the following categories of cookies. Each is described in detail below.
				</p>

				<div class="space-y-8">
					{#each cookieTypes as category (category.id)}
						<div class="rounded-2xl border border-white/10 bg-base-200 p-6">
							<div class="mb-4 flex items-start justify-between gap-4">
								<div>
									<h3 class="mb-1 font-bold text-white">{category.type}</h3>
									<p class="text-xs text-white/50">{category.description}</p>
								</div>
								<span
									class="shrink-0 rounded-full px-3 py-1 text-xs font-semibold {category.canDisable
										? 'bg-yellow-500/10 text-yellow-400'
										: 'bg-red-500/10 text-red-400'}"
								>
									{category.canDisable ? 'Optional' : 'Required'}
								</span>
							</div>

							<div class="overflow-hidden rounded-xl border border-white/10">
								<table class="w-full text-xs">
									<thead>
										<tr class="border-b border-white/10 bg-base-300">
											<th class="px-4 py-3 text-left font-semibold text-white/60">Cookie Name</th>
											<th class="px-4 py-3 text-left font-semibold text-white/60">Purpose</th>
											<th class="px-4 py-3 text-left font-semibold text-white/60">Duration</th>
										</tr>
									</thead>
									<tbody>
										{#each category.examples as ex, i (ex.name)}
											<tr class="border-b border-white/5 {i % 2 === 0 ? 'bg-base-300/50' : ''}">
												<td class="px-4 py-3 font-medium text-white">{ex.name}</td>
												<td class="px-4 py-3 text-white/50">{ex.purpose}</td>
												<td class="px-4 py-3 text-white/40">{ex.duration}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Section 3 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">3. Why We Use Cookies</h2>
				<p class="mb-4">We use cookies for the following purposes:</p>
				<ul class="space-y-3 pl-4">
					{#each [{ purpose: 'Authentication', desc: 'To keep you logged in securely across pages and sessions' }, { purpose: 'State Preservation', desc: "To remember your work in progress so you don't lose it if you navigate away" }, { purpose: 'Security', desc: 'To protect your account and the Service from unauthorized access and attacks' }, { purpose: 'Performance', desc: 'To understand how the Service performs and where improvements are needed' }, { purpose: 'Analytics', desc: 'To understand which features are used most and how we can improve the platform' }, { purpose: 'Preferences', desc: 'To remember your settings and preferences between visits' }] as item (item.purpose)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							<span><span class="font-semibold text-white">{item.purpose}:</span> {item.desc}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- Section 4 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">4. Managing Your Cookie Preferences</h2>
				<p class="mb-4">You have several options for managing cookies:</p>

				<h3 class="mb-2 font-bold text-white/90">Browser Settings</h3>
				<p class="mb-4">
					Most browsers allow you to control cookies through their settings. You can typically:
				</p>
				<ul class="mb-6 space-y-2 pl-4">
					{#each ['Block all cookies (note: this will prevent you from logging in)', 'Block third-party cookies only', 'Delete existing cookies', 'Set your browser to notify you when cookies are set'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>

				<div class="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
					<p class="text-xs text-yellow-400">
						⚠️ Important: Disabling essential cookies will prevent you from signing in and using the
						Service. We recommend only disabling optional analytics and functional cookies if you
						have privacy concerns.
					</p>
				</div>

				<h3 class="mb-2 font-bold text-white/90">Opt-Out Links</h3>
				<p class="mb-4">You can opt out of specific third-party tracking:</p>
				<ul class="space-y-2 pl-4">
					{#each ['Google Analytics: Visit Google Analytics Opt-out at tools.google.com/dlpage/gaoptout', 'Google Ads: Visit Google Ad Settings at adssettings.google.com'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Section 5 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">5. Do Not Track</h2>
				<p>
					Some browsers have a "Do Not Track" feature that signals to websites that you do not want
					your online activity tracked. Currently, there is no industry standard for how websites
					should respond to these signals. Our Service does not currently respond to Do Not Track
					signals, but we will update this policy if that changes.
				</p>
			</div>

			<!-- Section 6 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">6. Cookies and Minors</h2>
				<p>
					Our Service is not directed to children under 13. We do not knowingly use cookies to track
					children. If you believe a child has provided us with personal information through the use
					of cookies, please contact us.
				</p>
			</div>

			<!-- Section 7 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">7. Changes to This Policy</h2>
				<p>
					We may update this Cookie Policy from time to time to reflect changes in technology, law,
					or our practices. When we make significant changes, we will update the "Last updated" date
					at the top of this page. We encourage you to review this policy periodically.
				</p>
			</div>

			<!-- Section 8 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">8. Contact Us</h2>
				<p>
					If you have questions about our use of cookies or this Cookie Policy, please contact us
					through the platform or at the contact information available on our website.
				</p>
			</div>

			<!-- Links -->
			<div class="rounded-xl border border-white/10 bg-base-200 p-6">
				<p class="mb-4 text-xs font-semibold tracking-widest text-white/40 uppercase">
					Related Policies
				</p>
				<div class="flex flex-wrap gap-4">
					<a href={resolve('/terms')} class="text-sm text-info hover:underline">Terms of Use</a>
					<a href={resolve('/privacy')} class="text-sm text-info hover:underline">Privacy Policy</a>
				</div>
			</div>
		</div>
	</div>
</div>
