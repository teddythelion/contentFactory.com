<!-- src/lib/components/TextOverlay/GoogleFonts.svelte -->
<!-- GOOGLE FONTS FETCHER & SELECTOR - Uses server-side API -->

<script lang="ts">
	import { onMount } from 'svelte';

	export let selectedFont: string = 'Arial';
	export let onFontSelect: (fontFamily: string, fontUrl: string) => void = () => {};

	interface GoogleFont {
		family: string;
		variants: string[];
		category: string;
		files?: {
			regular?: string;
			[key: string]: string | undefined;
		};
	}

	let fonts: GoogleFont[] = [];
	let filteredFonts: GoogleFont[] = [];
	let isLoading = true;
	let searchQuery = '';
	let showDropdown = false;
	let fontLoadErrors: Set<string> = new Set();

	onMount(async () => {
		await fetchGoogleFonts();
	});

	async function fetchGoogleFonts() {
		isLoading = true;
		try {
			// Call our server-side API endpoint
			const response = await fetch('/api/google-fonts');

			if (!response.ok) {
				throw new Error(`Server error: ${response.status}`);
			}

			const data = await response.json();

			if (data.success && data.fonts) {
				fonts = data.fonts;
				filteredFonts = fonts;
				console.log(`✅ Loaded ${fonts.length} Google Fonts`);

				// Preload top 20 most popular fonts
				loadFontVariants(fonts.slice(0, 20));
			} else {
				throw new Error(data.error || 'Failed to load fonts');
			}
		} catch (err) {
			console.error('❌ Failed to fetch Google Fonts:', err);

			// Fallback to basic list
			fonts = [
				{ family: 'Roboto', variants: ['regular'], category: 'sans-serif' },
				{ family: 'Open Sans', variants: ['regular'], category: 'sans-serif' },
				{ family: 'Lato', variants: ['regular'], category: 'sans-serif' },
				{ family: 'Montserrat', variants: ['regular'], category: 'sans-serif' },
				{ family: 'Playfair Display', variants: ['regular'], category: 'serif' },
				{ family: 'Poppins', variants: ['regular'], category: 'sans-serif' }
			];
			filteredFonts = fonts;

			// Load fallback fonts
			loadFontVariants(fonts);
		} finally {
			isLoading = false;
		}
	}

	function loadFontVariants(fontsToLoad: GoogleFont[]) {
		fontsToLoad.forEach((font) => {
			if (fontLoadErrors.has(font.family)) return;

			const link = document.createElement('link');
			link.href = `https://fonts.googleapis.com/css2?family=${font.family.replace(/ /g, '+')}&display=swap`;
			link.rel = 'stylesheet';

			link.onerror = () => {
				console.warn(`Failed to load font: ${font.family}`);
				fontLoadErrors.add(font.family);
			};

			link.onload = () => {};

			document.head.appendChild(link);
		});
	}

	function handleSearch(query: string) {
		searchQuery = query.toLowerCase();
		showDropdown = true;

		if (searchQuery.length === 0) {
			filteredFonts = fonts;
		} else {
			filteredFonts = fonts.filter((font) => font.family.toLowerCase().includes(searchQuery));
		}
	}

	function selectFont(font: GoogleFont) {
		selectedFont = font.family;

		// Get the regular font file URL
		const fontUrl = font.files?.regular || '';

		// Pass both family name and URL to callback
		onFontSelect(font.family, fontUrl);

		showDropdown = false;
		searchQuery = '';

		// Load this font via CSS if not already loaded
		if (!fontLoadErrors.has(font.family)) {
			loadFontVariants([font]);
		}
	}

	function handleClickOutside(e: Event) {
		const target = e.target as HTMLElement;
		if (!target.closest('.google-fonts-container')) {
			showDropdown = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<!-- Google Fonts Selector -->
<div class="google-fonts-container rounded-lg p-3 hover:bg-white/5">
	<div class="mb-2 block text-sm font-semibold text-white">Google Font</div>

	<div class="relative">
		<!-- Search Input -->
		<div class="relative">
			<input
				type="text"
				placeholder="Search fonts... (e.g., 'Roboto', 'Playfair')"
				value={searchQuery || selectedFont}
				on:input={(e) => handleSearch(e.currentTarget.value)}
				on:focus={() => (showDropdown = true)}
				class="w-full rounded border border-white/10 bg-gray-700 px-2 py-2 text-sm text-white outline-none focus:border-white/20"
			/>
			<span class="absolute top-2 right-2 text-xs text-gray-400">
				{isLoading ? '⏳' : '🔍'}
			</span>
		</div>

		<!-- Dropdown Menu -->
		{#if showDropdown && !isLoading}
			<div
				class="absolute top-full z-50 mt-1 max-h-64 w-full overflow-y-auto rounded border border-white/10 bg-gray-900 shadow-lg"
			>
				{#if filteredFonts.length > 0}
					<div class="sticky top-0 bg-gray-800 px-2 py-1 text-xs text-gray-400">
						Showing {filteredFonts.length} of {fonts.length} fonts
					</div>
					{#each filteredFonts as font (font.family)}
						<button
							on:click={() => selectFont(font)}
							class="flex w-full items-center justify-between border-b border-white/5 px-3 py-2 text-left hover:bg-white/10"
						>
							<div>
								<div
									class="text-sm font-medium text-white"
									style="font-family: '{font.family}', sans-serif;"
								>
									{font.family}
								</div>
								<div class="text-xs text-gray-500">{font.category}</div>
							</div>
							{#if selectedFont === font.family}
								<span class="text-green-400">✓</span>
							{/if}
						</button>
					{/each}
				{:else}
					<div class="px-3 py-4 text-center text-sm text-gray-400">
						No fonts found matching "{searchQuery}"
					</div>
				{/if}
			</div>
		{/if}

		<!-- Loading State -->
		{#if isLoading}
			<div class="mt-2 text-center text-xs text-gray-400">⏳ Loading Google Fonts...</div>
		{/if}
	</div>

	<!-- Font Info -->
	{#if selectedFont && !isLoading}
		<div class="mt-2 rounded bg-gray-800/50 px-2 py-1 text-xs">
			<span class="text-gray-400">Selected:</span>
			<span class="ml-1 text-white" style="font-family: '{selectedFont}', sans-serif;">
				{selectedFont}
			</span>
		</div>
	{/if}

	<!-- Error State -->
	{#if !isLoading && fonts.length <= 6}
		<div class="mt-2 rounded bg-yellow-900/20 px-2 py-1 text-xs text-yellow-400">
			⚠️ Using fallback fonts. Check server logs.
		</div>
	{/if}
</div>

<style>
	::-webkit-scrollbar {
		width: 6px;
	}

	::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
	}

	::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 3px;
	}

	::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>
