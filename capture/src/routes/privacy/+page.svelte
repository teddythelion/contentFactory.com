<script lang="ts">
	// Privacy Policy — Content Factory
	// Svelte 5 runes mode
	import { resolve } from '$app/paths';
	const lastUpdated = 'March 2026';
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
			<h1 class="mb-4 text-4xl font-black text-white">Privacy Policy</h1>
			<p class="text-sm text-white/40">Last updated: {lastUpdated}</p>
		</div>
	</div>

	<div class="mx-auto max-w-3xl px-6 py-16">
		<div class="space-y-12 text-sm leading-relaxed text-white/70">
			<!-- Intro -->
			<div>
				<p class="mb-4">
					Content Factory ("we", "us", or "our") is committed to protecting your privacy. This
					Privacy Policy explains how we collect, use, disclose, and safeguard your information when
					you use our platform at <span class="text-info">contentfactory.studio</span> (the "Service").
				</p>
				<p>
					By using the Service, you consent to the practices described in this Privacy Policy. If
					you do not agree, please do not use the Service.
				</p>
			</div>

			<!-- Section 1 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">1. Information We Collect</h2>

				<h3 class="mb-2 font-bold text-white/90">1.1 Information You Provide</h3>
				<ul class="mb-6 space-y-2 pl-4">
					{#each ['Account information: name, email address, and profile photo provided via Google Sign-In', 'Content you upload: images, videos, logos, and reference files you submit to the Service', 'Prompts and text inputs you enter to generate content', 'Communications: messages you send to us for support or feedback'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>

				<h3 class="mb-2 font-bold text-white/90">1.2 Information Collected Automatically</h3>
				<ul class="mb-6 space-y-2 pl-4">
					{#each ['Usage data: features used, pages visited, actions taken within the Service', 'Device information: browser type, operating system, device type', 'IP address and approximate geographic location', 'Session data: time spent, frequency of use, error logs', 'Cookies and similar tracking technologies (see our Cookie Policy)'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>

				<h3 class="mb-2 font-bold text-white/90">1.3 Information from Third Parties</h3>
				<p>
					When you sign in with Google, we receive basic profile information (name, email, profile
					photo) from Google as permitted by your Google account settings. We do not receive your
					Google password.
				</p>
			</div>

			<!-- Section 2 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">2. How We Use Your Information</h2>
				<p class="mb-4">We use the information we collect to:</p>
				<ul class="space-y-2 pl-4">
					{#each ['Provide, operate, and maintain the Service', 'Process your content generation requests using AI models', 'Store your generated content in your personal Content Library', 'Authenticate your identity and manage your account', 'Monitor and analyze usage patterns to improve the Service', 'Enforce our Terms of Use and prevent abuse', 'Send service-related communications (account updates, security alerts)', 'Comply with legal obligations', 'Respond to your inquiries and provide customer support'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">✓</span>
							{item}
						</li>
					{/each}
				</ul>
			</div>

			<!-- Section 3 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">3. How We Share Your Information</h2>
				<p class="mb-4">
					We do not sell your personal information. We may share your information in the following
					circumstances:
				</p>

				<h3 class="mb-2 font-bold text-white/90">3.1 Third-Party Service Providers</h3>
				<p class="mb-4">
					We share information with third-party providers necessary to operate the Service:
				</p>
				<ul class="mb-6 space-y-3 pl-4">
					{#each [{ provider: 'Google (Firebase, Cloud Storage, AI Models)', use: 'Authentication, database, file storage, and AI content generation' }, { provider: 'ElevenLabs', use: 'AI audio and music generation' }, { provider: 'Stripe', use: 'Payment processing for paid plans' }] as item (item.provider)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							<span><span class="font-semibold text-white">{item.provider}:</span> {item.use}</span>
						</li>
					{/each}
				</ul>
				<p class="mb-4">
					These providers are permitted to use your information only as necessary to provide
					services to us and are bound by their own privacy policies.
				</p>

				<h3 class="mb-2 font-bold text-white/90">3.2 Legal Requirements</h3>
				<p class="mb-4">
					We may disclose your information if required by law, court order, or government authority,
					or if we believe disclosure is necessary to protect the rights, property, or safety of
					Content Factory, our users, or others.
				</p>

				<h3 class="mb-2 font-bold text-white/90">3.3 Business Transfers</h3>
				<p>
					If Content Factory is involved in a merger, acquisition, or sale of assets, your
					information may be transferred as part of that transaction. We will notify you via email
					or prominent notice on the Service before your information is transferred.
				</p>
			</div>

			<!-- Section 4 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">4. Data Retention</h2>
				<p class="mb-4">
					We retain your account information and generated content for as long as your account is
					active or as needed to provide the Service. You can delete content from your Content
					Library at any time.
				</p>
				<p class="mb-4">
					Temporary processing files (raw video frames, audio session files) used during content
					generation are automatically deleted from our servers after processing is complete,
					typically within 24 hours.
				</p>
				<p>
					If you delete your account, we will delete or anonymize your personal information within a
					reasonable period, subject to legal retention requirements.
				</p>
			</div>

			<!-- Section 5 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">5. Data Security</h2>
				<p class="mb-4">
					We implement industry-standard security measures to protect your information, including:
				</p>
				<ul class="mb-4 space-y-2 pl-4">
					{#each ['Encrypted data transmission via HTTPS/TLS', 'Secure cloud storage with Google Cloud Platform', 'Firebase Authentication for secure account management', 'Access controls limiting employee access to user data'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">✓</span>
							{item}
						</li>
					{/each}
				</ul>
				<p>
					No security system is impenetrable. We cannot guarantee absolute security of your
					information and are not liable for unauthorized access beyond our reasonable control.
				</p>
			</div>

			<!-- Section 6 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">6. Your Rights & Choices</h2>
				<p class="mb-4">Depending on your location, you may have the following rights:</p>
				<ul class="mb-4 space-y-2 pl-4">
					{#each ['Access: Request a copy of the personal information we hold about you', 'Correction: Request correction of inaccurate personal information', 'Deletion: Request deletion of your personal information', 'Portability: Request your data in a portable format', 'Objection: Object to certain processing of your information', 'Withdrawal of consent: Withdraw consent where processing is based on consent'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-info">→</span>
							{item}
						</li>
					{/each}
				</ul>
				<p>
					To exercise any of these rights, please contact us through the platform. We will respond
					within a reasonable timeframe and in accordance with applicable law.
				</p>
			</div>

			<!-- Section 7 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">7. Children's Privacy</h2>
				<p>
					The Service is not directed to children under the age of 13 (or 16 in the European Union).
					We do not knowingly collect personal information from children. If you believe we have
					inadvertently collected information from a child, please contact us and we will delete it
					promptly.
				</p>
			</div>

			<!-- Section 8 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">8. International Data Transfers</h2>
				<p>
					The Service is operated from the United States. If you are accessing the Service from
					outside the United States, your information may be transferred to and processed in the
					United States or other countries where our service providers operate. By using the
					Service, you consent to this transfer.
				</p>
			</div>

			<!-- Section 9 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">9. AI-Generated Content & Your Uploads</h2>
				<p class="mb-4">
					Files you upload (images, videos, logos) are processed solely for the purpose of
					generating your requested content. We do not use your uploaded files or generated content
					to train AI models.
				</p>
				<p>
					Your prompts and generated content are stored in your account and are not shared with
					other users. You maintain control over your content library and can delete items at any
					time.
				</p>
			</div>

			<!-- Section 10 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">10. Changes to This Policy</h2>
				<p>
					We may update this Privacy Policy from time to time. We will notify you of significant
					changes by posting the new policy on this page with an updated date, and where
					appropriate, by sending you an email notification. Your continued use of the Service after
					changes constitutes acceptance of the updated policy.
				</p>
			</div>

			<!-- Section 11 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">11. Contact Us</h2>
				<p>
					If you have questions, concerns, or requests regarding this Privacy Policy or our data
					practices, please contact us through the platform or at the contact information available
					on our website.
				</p>
			</div>

			<!-- Links -->
			<div class="rounded-xl border border-white/10 bg-base-200 p-6">
				<p class="mb-4 text-xs font-semibold tracking-widest text-white/40 uppercase">
					Related Policies
				</p>
				<div class="flex flex-wrap gap-4">
					<a href={resolve('/terms')} class="text-sm text-info hover:underline">Terms of Use</a>
					<a href={resolve('/cookies')} class="text-sm text-info hover:underline">Cookie Policy</a>
				</div>
			</div>
		</div>
	</div>
</div>
