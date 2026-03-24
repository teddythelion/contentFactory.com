<script lang="ts">
	// Terms of Use — Content Factory
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
			<h1 class="mb-4 text-4xl font-black text-white">Terms of Use</h1>
			<p class="text-sm text-white/40">Last updated: {lastUpdated}</p>
		</div>
	</div>

	<div class="mx-auto max-w-3xl px-6 py-16">
		<div class="space-y-12 text-sm leading-relaxed text-white/70">
			<!-- Intro -->
			<div>
				<p class="mb-4">
					Welcome to Content Factory. By accessing or using our platform at
					<span class="text-info">contentfactory.studio</span> (the "Service"), you agree to be bound
					by these Terms of Use ("Terms"). Please read them carefully. If you do not agree, do not use
					the Service.
				</p>
				<p>
					These Terms apply to all users of the Service, including visitors, registered users, and
					anyone who accesses or uses any part of the Service.
				</p>
			</div>

			<!-- Section 1 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">1. Acceptance of Terms</h2>
				<p class="mb-4">
					By creating an account or using any part of the Service, you confirm that you are at least
					18 years of age (or the age of majority in your jurisdiction), that you have read and
					understood these Terms, and that you agree to be legally bound by them.
				</p>
				<p>
					We reserve the right to update or modify these Terms at any time. Continued use of the
					Service after changes constitutes acceptance of the updated Terms. We will make reasonable
					efforts to notify users of material changes.
				</p>
			</div>

			<!-- Section 2 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">2. Description of Service</h2>
				<p class="mb-4">
					Content Factory is an AI-powered content creation platform that allows users to generate
					images, videos, audio, and enhanced media content using artificial intelligence models.
					The Service includes tools for image generation, video generation, 3D video enhancement,
					audio generation, image editing, and content library management.
				</p>
				<p>
					The Service is provided "as is" and we make no guarantees regarding uptime, availability,
					or the quality of AI-generated outputs.
				</p>
			</div>

			<!-- Section 3 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">3. User Accounts</h2>
				<p class="mb-4">
					To access certain features, you must create an account using Google authentication. You
					are responsible for maintaining the confidentiality of your account and for all activities
					that occur under your account.
				</p>
				<p class="mb-4">
					You agree to provide accurate and complete information when creating your account. You may
					not use another person's account without permission.
				</p>
				<p>
					We reserve the right to suspend or terminate accounts that violate these Terms or that we
					determine, in our sole discretion, are being used in a harmful, fraudulent, or abusive
					manner.
				</p>
			</div>

			<!-- Section 4 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">4. Acceptable Use</h2>
				<p class="mb-4">You agree not to use the Service to:</p>
				<ul class="mb-4 space-y-2 pl-4">
					{#each ['Generate content that is illegal, harmful, threatening, abusive, harassing, defamatory, or obscene', 'Create deepfakes or non-consensual synthetic media of real individuals', 'Generate content that infringes on the intellectual property rights of others', 'Produce content that promotes violence, discrimination, or hatred', 'Attempt to circumvent or disable any security features of the Service', 'Use automated tools, bots, or scripts to access the Service in an unauthorized manner', 'Resell, redistribute, or sublicense access to the Service without written permission', 'Generate content for the purpose of spam, phishing, or deceptive practices'] as item (item)}
						<li class="flex items-start gap-2">
							<span class="mt-0.5 text-red-400">✗</span>
							{item}
						</li>
					{/each}
				</ul>
				<p>
					We reserve the right to remove any content and suspend any account found to be in
					violation of these acceptable use guidelines, without prior notice.
				</p>
			</div>

			<!-- Section 5 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">
					5. Intellectual Property & Content Ownership
				</h2>
				<p class="mb-4">
					<span class="font-semibold text-white">Your Content:</span> You retain ownership of the content
					you upload to the Service (reference images, videos, logos, etc.). By uploading content, you
					grant us a limited license to process and store it solely for the purpose of providing the
					Service to you.
				</p>
				<p class="mb-4">
					<span class="font-semibold text-white">AI-Generated Content:</span> Content generated by the
					Service using AI models is provided to you for your personal or commercial use, subject to
					these Terms. You are responsible for ensuring that your use of AI-generated content complies
					with applicable laws and does not infringe third-party rights.
				</p>
				<p class="mb-4">
					<span class="font-semibold text-white">Platform IP:</span> All software, design, trademarks,
					and infrastructure underlying the Service are owned by Content Factory and protected by applicable
					intellectual property laws. You may not copy, modify, or reverse engineer any part of the platform.
				</p>
				<p>
					<span class="font-semibold text-white">Third-Party Models:</span> The Service uses AI models
					from third-party providers (including Google and ElevenLabs). Generated content is subject
					to the terms and acceptable use policies of those underlying model providers.
				</p>
			</div>

			<!-- Section 6 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">6. Free Plan & Paid Plans</h2>
				<p class="mb-4">
					The Service offers a free tier with usage limits, as well as paid subscription plans that
					provide expanded capabilities. Usage limits on the free tier are set at our discretion and
					may change at any time.
				</p>
				<p class="mb-4">
					Paid plans are billed as described at the time of purchase. All fees are non-refundable
					except where required by law or at our sole discretion. We reserve the right to modify
					pricing with reasonable advance notice.
				</p>
				<p>If you believe you have been charged in error, please contact us promptly.</p>
			</div>

			<!-- Section 7 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">7. Third-Party Services</h2>
				<p class="mb-4">
					The Service integrates with and depends on third-party services including Google
					(authentication, cloud storage, AI models), ElevenLabs (audio generation), Firebase
					(database and authentication), and others. Your use of the Service is also subject to the
					terms of these third-party providers.
				</p>
				<p>
					We are not responsible for the availability, performance, or content policies of
					third-party services. Interruptions to third-party services may affect the availability of
					features within Content Factory.
				</p>
			</div>

			<!-- Section 8 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">8. Disclaimers & Limitation of Liability</h2>
				<p class="mb-4">
					THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER
					EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING, WITHOUT LIMITATION, WARRANTIES
					OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
				</p>
				<p class="mb-4">
					We do not guarantee that AI-generated content will be accurate, appropriate, or suitable
					for any particular purpose. You use AI-generated content at your own risk.
				</p>
				<p>
					TO THE MAXIMUM EXTENT PERMITTED BY LAW, CONTENT FACTORY SHALL NOT BE LIABLE FOR ANY
					INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF
					THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
				</p>
			</div>

			<!-- Section 9 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">9. Indemnification</h2>
				<p>
					You agree to indemnify, defend, and hold harmless Content Factory and its officers,
					directors, employees, and agents from and against any claims, liabilities, damages,
					losses, and expenses (including legal fees) arising out of or in connection with your use
					of the Service, your violation of these Terms, or your violation of any rights of another
					party.
				</p>
			</div>

			<!-- Section 10 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">10. Termination</h2>
				<p class="mb-4">
					We may suspend or terminate your access to the Service at any time, with or without cause
					or notice, including for violations of these Terms. Upon termination, your right to use
					the Service ceases immediately.
				</p>
				<p>
					You may terminate your account at any time by contacting us or using account settings.
					Termination does not entitle you to a refund of any prepaid fees.
				</p>
			</div>

			<!-- Section 11 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">11. Governing Law</h2>
				<p>
					These Terms shall be governed by and construed in accordance with the laws of the United
					States, without regard to conflict of law principles. Any disputes arising under these
					Terms shall be subject to the exclusive jurisdiction of the courts located in the United
					States.
				</p>
			</div>

			<!-- Section 12 -->
			<div>
				<h2 class="mb-4 text-lg font-black text-white">12. Contact</h2>
				<p>
					If you have questions about these Terms, please contact us through the platform or at the
					contact information available on our website.
				</p>
			</div>

			<!-- Links to other policies -->
			<div class="rounded-xl border border-white/10 bg-base-200 p-6">
				<p class="mb-4 text-xs font-semibold tracking-widest text-white/40 uppercase">
					Related Policies
				</p>
				<div class="flex flex-wrap gap-4">
					<a href={resolve('/privacy')} class="text-sm text-info hover:underline">Privacy Policy</a>
					<a href={resolve('/cookies')} class="text-sm text-info hover:underline">Cookie Policy</a>
				</div>
			</div>
		</div>
	</div>
</div>
