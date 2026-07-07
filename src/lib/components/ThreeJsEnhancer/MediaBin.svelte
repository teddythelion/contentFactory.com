<!-- src/lib/components/ThreeJsEnhancer/MediaBin.svelte -->
<!-- Holds all uploaded/generated assets. Tap a card to arm it, then tap the timeline to place it. -->
<script lang="ts">
	import { mediaBinStore, type MediaAsset } from '$lib/stores/mediaBin.store';
	import { timelineStore } from '$lib/stores/timeline.store';

	let bin    = $derived($mediaBinStore);
	let assets = $derived(bin.assets);
	let armedId = $derived(bin.armedAssetId);
	let armedAsset = $derived(assets.find((a) => a.id === armedId) ?? null);

	let collapsed = $state(false);

	const TYPE_ICON: Record<string, string> = {
		video: '🎬',
		image: '🖼️',
		music: '🎵',
		sfx:   '🔊',
		voice: '🎤'
	};
	const TYPE_COLOR: Record<string, string> = {
		video: 'rgba(75,85,99,0.7)',
		image: 'rgba(16,185,129,0.7)',
		music: 'rgba(147,51,234,0.7)',
		sfx:   'rgba(37,99,235,0.7)',
		voice: 'rgba(249,115,22,0.7)'
	};

	function fmt(s: number) {
		if (!s || !isFinite(s)) return '--:--';
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	}

	function placeOnNewTrack() {
		if (!armedAsset) return;
		const a = armedAsset;
		if (a.type === 'video' || a.type === 'image') {
			timelineStore.addVideoTrack(a.id, a.name, a.duration);
		} else if (a.type === 'music') {
			timelineStore.addMusicTrack(a.id, a.name, a.sessionId ?? a.id, 0, a.duration);
		} else if (a.type === 'sfx') {
			timelineStore.addSfxTrack(a.id, a.name, a.sessionId ?? a.id, [
				{ id: crypto.randomUUID(), startTime: 0, endTime: a.duration }
			]);
		}
		mediaBinStore.disarm();
	}
</script>

{#if assets.length > 0}
	<div style="display:flex;flex-direction:column;gap:4px;padding:6px 8px;background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.08);border-radius:6px;">

		<!-- Header -->
		<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
			<div style="display:flex;align-items:center;gap:6px;">
				<span style="font-size:10px;font-weight:700;color:rgba(209,213,219,1);">📂 Media Bin</span>
				<span style="font-size:9px;color:rgba(107,114,128,1);">{assets.length} clip{assets.length !== 1 ? 's' : ''}</span>
				{#if armedAsset}
					<span style="font-size:9px;font-weight:600;color:rgba(251,191,36,1);background:rgba(251,191,36,0.15);padding:1px 6px;border-radius:10px;border:1px solid rgba(251,191,36,0.3);" title="Ready to place — tap a track or New Track to drop it">
						⬇ Place: {TYPE_ICON[armedAsset.type]} {armedAsset.name}
					</span>
				{:else}
					<span style="font-size:8px;color:rgba(107,114,128,0.7);">tap a clip to stage it</span>
				{/if}
			</div>
			<div style="display:flex;align-items:center;gap:4px;">
				{#if armedAsset}
					<button
						onclick={placeOnNewTrack}
						style="font-size:9px;font-weight:700;padding:3px 8px;background:rgba(251,191,36,0.2);border:1px solid rgba(251,191,36,0.5);border-radius:4px;color:rgba(251,191,36,1);cursor:pointer;white-space:nowrap;"
					>+ New Track</button>
					<button
						onclick={() => mediaBinStore.disarm()}
						style="font-size:9px;padding:3px 6px;background:rgba(55,65,81,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:rgba(156,163,175,1);cursor:pointer;"
					>✕</button>
				{/if}
				<button
					onclick={() => collapsed = !collapsed}
					style="font-size:9px;padding:2px 6px;background:rgba(55,65,81,0.5);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:rgba(156,163,175,1);cursor:pointer;"
				>{collapsed ? '▲' : '▼'}</button>
			</div>
		</div>

		<!-- Asset cards (horizontal scroll row) -->
		{#if !collapsed}
			<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;">
				{#each assets as asset (asset.id)}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						onclick={() => mediaBinStore.toggleArm(asset.id)}
						style="flex-shrink:0;width:88px;padding:6px;border-radius:5px;cursor:pointer;user-select:none;border:2px solid {armedId === asset.id ? 'rgba(251,191,36,0.8)' : 'rgba(255,255,255,0.08)'};background:{armedId === asset.id ? 'rgba(251,191,36,0.08)' : 'rgba(31,41,55,0.7)'};transition:border-color 0.15s,background 0.15s;"
					>
						<!-- Type badge + icon -->
						<div style="display:flex;align-items:center;gap:4px;margin-bottom:4px;">
							<div style="width:20px;height:20px;border-radius:4px;background:{TYPE_COLOR[asset.type]};display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;">
								{TYPE_ICON[asset.type]}
							</div>
							<span style="font-size:8px;font-weight:700;color:rgba(156,163,175,1);text-transform:uppercase;letter-spacing:0.04em;">{asset.type}</span>
						</div>
						<!-- Name -->
						<div style="font-size:9px;font-weight:600;color:rgba(229,231,235,1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;" title={asset.name}>{asset.name}</div>
						<!-- Duration -->
						<div style="font-size:8px;color:rgba(107,114,128,1);">{fmt(asset.duration)}</div>
						<!-- Armed indicator -->
						{#if armedId === asset.id}
							<div style="margin-top:4px;font-size:8px;font-weight:700;color:rgba(251,191,36,1);text-align:center;">● armed</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if armedAsset}
				<div style="font-size:9px;color:rgba(107,114,128,1);text-align:center;padding:2px 0;">
					Tap <strong style="color:rgba(251,191,36,0.8);">+ New Track</strong> to place on the timeline, or tap a track to add a clip there
				</div>
			{/if}
		{/if}

	</div>
{/if}

<style>
	div::-webkit-scrollbar        { height: 3px; }
	div::-webkit-scrollbar-track  { background: rgba(255,255,255,0.03); }
	div::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.15); border-radius: 4px; }
</style>
