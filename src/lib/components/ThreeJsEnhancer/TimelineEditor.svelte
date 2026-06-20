<!-- src/lib/components/ThreeJsEnhancer/TimelineEditor.svelte -->
<!-- DAW-style multi-track timeline — dynamic tracks from timelineStore -->
<script lang="ts">
	import { audioStudioStore, type SfxInstance } from '$lib/stores/audioStudio.store';
	import { timelineStore, type TimelineTrack, type TimelineClip } from '$lib/stores/timeline.store';
	import { mediaBinStore } from '$lib/stores/mediaBin.store';
	import { videoState } from '$lib/stores/video.store';

	interface Props {
		videoElement?: HTMLVideoElement | null;
	}
	let { videoElement = null }: Props = $props();

	let audioStudio  = $derived($audioStudioStore);
	let timeline     = $derived($timelineStore);
	let videoDuration = $derived($videoState.videoDuration || 30);
	let currentTime  = $derived($videoState.currentTime  || 0);
	let isPlaying    = $derived($videoState.isPlaying);

	// ── ZOOM ────────────────────────────────────────────────────────
	let pixelsPerSecond = $state(60);
	const TRACK_H = 40;
	const RULER_H = 20;
	const LABEL_W = 110;

	let totalDuration = $derived(() => {
		let max = videoDuration;
		for (const t of timeline.tracks) {
			for (const c of t.clips) max = Math.max(max, c.endTime);
		}
		return Math.max(max, 10);
	});
	let timelineWidth = $derived(totalDuration() * pixelsPerSecond + 80);
	let canvasHeight  = $derived(RULER_H + Math.max(1, timeline.tracks.length) * TRACK_H);

	function tp(t: number)  { return t * pixelsPerSecond; }
	function pt(px: number) { return Math.max(0, px / pixelsPerSecond); }
	function fmt(s: number) {
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
	}
	function getMarkers() {
		const d  = totalDuration();
		const iv = d > 120 ? 30 : d > 60 ? 10 : d > 30 ? 5 : 2;
		const out: number[] = [];
		for (let t = 0; t <= d + iv; t += iv) out.push(t);
		return out;
	}

	let scrollEl: HTMLDivElement;

	// ── VIDEO EVENTS ────────────────────────────────────────────────
	$effect(() => {
		if (!videoElement) return;
		const onPlay  = () => videoState.setIsPlaying(true);
		const onPause = () => videoState.setIsPlaying(false);
		const onTime  = () => videoState.setCurrentTime(videoElement!.currentTime);
		videoElement.addEventListener('play',       onPlay);
		videoElement.addEventListener('pause',      onPause);
		videoElement.addEventListener('timeupdate', onTime);
		videoState.setCurrentTime(videoElement.currentTime);
		videoState.setIsPlaying(!videoElement.paused);
		return () => {
			videoElement!.removeEventListener('play',       onPlay);
			videoElement!.removeEventListener('pause',      onPause);
			videoElement!.removeEventListener('timeupdate', onTime);
		};
	});

	// ── AUDIO SYNC ──────────────────────────────────────────────────
	$effect(() => {
		const entries = audioStudio.musicEntries;
		if (Object.keys(entries).length === 0) return;
		void currentTime; void isPlaying;
		audioStudioStore.syncMusicToVideo(currentTime, isPlaying);
	});
	$effect(() => {
		if (!audioStudio.sfxSessionId) return;
		void audioStudio.sfxInstances;
		audioStudioStore.syncSfxToVideo(currentTime, isPlaying);
	});

	// Keep sfx track clips in sync with audioStudio instances
	$effect(() => {
		const instances = audioStudio.sfxInstances;
		if (!audioStudio.sfxSessionId || instances.length === 0) return;
		const track = timelineStore.findBySession(audioStudio.sfxSessionId);
		if (track) {
			timelineStore.syncSfxClips(track.id, instances, track.assetId);
		}
	});

	// ── AUTO-SCROLL PLAYHEAD ─────────────────────────────────────────
	$effect(() => {
		if (!scrollEl || !isPlaying) return;
		const playX = currentTime * pixelsPerSecond;
		const w  = scrollEl.clientWidth;
		const sl = scrollEl.scrollLeft;
		if (playX > sl + w - 50 || playX < sl) {
			scrollEl.scrollLeft = Math.max(0, playX - 40);
		}
	});

	// ── CONTROLS ────────────────────────────────────────────────────
	function togglePlay() {
		if (!videoElement) return;
		videoElement.paused ? videoElement.play() : videoElement.pause();
	}
	function zoomIn()  { pixelsPerSecond = Math.min(200, pixelsPerSecond * 1.4); }
	function zoomOut() { pixelsPerSecond = Math.max(15,  pixelsPerSecond / 1.4); }

	function getTrackVol(track: TimelineTrack): number {
		if (track.type === 'video') return audioStudio.originalVolume;
		if (track.type === 'music') return audioStudio.musicEntries[track.assetSessionId ?? '']?.volume ?? 0.3;
		if (track.type === 'sfx')   return audioStudio.sfxVolume;
		return 0.5;
	}
	function setTrackVol(track: TimelineTrack, pct: number) {
		const v = Math.max(0, Math.min(100, pct)) / 100;
		if (track.type === 'video') audioStudioStore.setOriginalVolume(v);
		else if (track.type === 'music' && track.assetSessionId) audioStudioStore.updateMusicEntry(track.assetSessionId, { volume: v });
		else if (track.type === 'sfx') audioStudioStore.setSfxVolume(v);
	}

	// ── UNIFIED DRAG HELPER ─────────────────────────────────────────
	function attachDrag(onMove: (x: number) => void, onStop: () => void) {
		function mouseMove(e: MouseEvent) { onMove(e.clientX); }
		function touchMove(e: TouchEvent) {
			if (e.touches[0]) onMove(e.touches[0].clientX);
			e.preventDefault();
		}
		function stop() { onStop(); cleanup(); }
		function cleanup() {
			document.removeEventListener('mousemove', mouseMove);
			document.removeEventListener('mouseup',   stop);
			document.removeEventListener('touchmove', touchMove);
			document.removeEventListener('touchend',  stop);
		}
		document.addEventListener('mousemove', mouseMove);
		document.addEventListener('mouseup',   stop);
		document.addEventListener('touchmove', touchMove, { passive: false });
		document.addEventListener('touchend',  stop);
	}

	function cx(e: MouseEvent | TouchEvent) {
		return 'touches' in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
	}

	// ── RULER SEEK ──────────────────────────────────────────────────
	function handleRulerClick(e: MouseEvent) {
		if (!videoElement || !scrollEl) return;
		const rect = scrollEl.getBoundingClientRect();
		videoElement.currentTime = Math.min(videoDuration, pt(e.clientX - rect.left + scrollEl.scrollLeft));
	}

	// ── PLAYHEAD DRAG ───────────────────────────────────────────────
	function startPlayheadDrag(e: MouseEvent | TouchEvent) {
		if (!scrollEl || !videoElement) return;
		const rectLeft = scrollEl.getBoundingClientRect().left;
		attachDrag(
			(x) => { videoElement!.currentTime = Math.min(videoDuration, Math.max(0, pt(x - rectLeft + scrollEl.scrollLeft))); },
			() => {}
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── MUSIC CLIP DRAG ─────────────────────────────────────────────
	function startMusicDrag(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (track.assetSessionId) audioStudioStore.setActiveMusicSession(track.assetSessionId);
		const x0     = cx(e);
		const start0 = clip.startTime;
		const dur    = clip.endTime - clip.startTime;
		const sid    = track.assetSessionId;
		attachDrag(
			(x) => {
				const s = Math.max(0, start0 + (x - x0) / pixelsPerSecond);
				timelineStore.updateClip(track.id, clip.id, { startTime: s, endTime: s + dur });
				if (sid) audioStudioStore.updateMusicEntry(sid, { startTime: s, endTime: s + dur });
			},
			() => {}
		);
		e.preventDefault();
	}

	function startMusicResizeStart(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		const x0     = cx(e);
		const start0 = clip.startTime;
		const sid    = track.assetSessionId;
		const trim0  = sid ? (audioStudio.musicEntries[sid]?.trimStart ?? 0) : 0;
		attachDrag(
			(x) => {
				const dt = (x - x0) / pixelsPerSecond;
				const s  = Math.max(0, Math.min(clip.endTime - 0.5, start0 + dt));
				timelineStore.updateClip(track.id, clip.id, { startTime: s });
				if (sid) audioStudioStore.updateMusicEntry(sid, { startTime: s, trimStart: Math.max(0, trim0 + (s - start0)) });
			},
			() => {}
		);
		e.stopPropagation(); e.preventDefault();
	}

	function startMusicResizeEnd(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		const x0   = cx(e);
		const end0 = clip.endTime;
		const sid  = track.assetSessionId;
		attachDrag(
			(x) => {
				const newEnd = Math.max(clip.startTime + 0.5, end0 + (x - x0) / pixelsPerSecond);
				timelineStore.updateClip(track.id, clip.id, { endTime: newEnd });
				if (sid) audioStudioStore.updateMusicEntry(sid, { endTime: newEnd });
			},
			() => {}
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── SFX CLIP DRAG ───────────────────────────────────────────────
	let activeSfxId: string | null = null;

	function startSfxInteraction(
		e: MouseEvent | TouchEvent,
		inst: SfxInstance,
		mode: 'move' | 'resizeStart' | 'resizeEnd'
	) {
		activeSfxId = inst.id;
		const x0  = cx(e);
		const s0  = inst.startTime;
		const e0  = inst.endTime;
		const dur = e0 - s0;
		attachDrag(
			(x) => {
				if (!activeSfxId) return;
				const dx = (x - x0) / pixelsPerSecond;
				if (mode === 'move') {
					const s = Math.max(0, s0 + dx);
					audioStudioStore.updateSfxInstance(activeSfxId, s, s + dur);
				} else if (mode === 'resizeStart') {
					audioStudioStore.updateSfxInstance(activeSfxId, Math.max(0, Math.min(e0 - 0.1, s0 + dx)), e0);
				} else {
					audioStudioStore.updateSfxInstance(activeSfxId, s0, Math.max(s0 + 0.1, e0 + dx));
				}
			},
			() => { activeSfxId = null; }
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── CLIP PLACEMENT from armed bin asset ─────────────────────────
	function handleTrackClick(e: MouseEvent, track: TimelineTrack) {
		const armed = $mediaBinStore.armedAssetId;
		if (!armed || !scrollEl) return;
		const asset = $mediaBinStore.assets.find((a) => a.id === armed);
		if (!asset || asset.type !== track.type) return;
		const rect = scrollEl.getBoundingClientRect();
		const dropTime = pt(e.clientX - rect.left + scrollEl.scrollLeft);
		// Add clip to this track
		timelineStore.updateClip(track.id, '', {
			startTime: dropTime,
			endTime: dropTime + asset.duration
		});
		mediaBinStore.disarm();
	}
</script>

<!-- ── OUTER SHELL ─────────────────────────────────────────────────── -->
<div style="display:flex;flex-direction:column;gap:6px;padding:8px;background:rgba(17,24,39,0.65);border:1px solid rgba(255,255,255,0.1);border-radius:8px;">

	<!-- HEADER ──────────────────────────────────────────────────────── -->
	<div style="display:flex;align-items:center;justify-content:space-between;gap:6px;flex-wrap:wrap;">
		<div>
			<div style="font-size:11px;font-weight:700;color:white;">🎬 Timeline</div>
			<div style="font-size:9px;color:rgba(156,163,175,1);">Drag clips · Resize edges · Tap ruler to seek</div>
		</div>
		<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
			<span style="font-size:10px;font-weight:600;color:white;font-variant-numeric:tabular-nums;white-space:nowrap;">
				{fmt(currentTime)} / {fmt(videoDuration)}
			</span>
			<button
				onclick={togglePlay}
				disabled={!videoElement}
				style="width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.85);border:1px solid rgba(59,130,246,1);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
				title={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}
					<svg viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;"><path d="M8 5v14l11-7z"/></svg>
				{/if}
			</button>
			<!-- Zoom -->
			<div style="display:flex;align-items:center;gap:2px;">
				<button onclick={zoomOut} style="width:20px;height:20px;border-radius:4px;background:rgba(55,65,81,0.8);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;" title="Zoom out">−</button>
				<span style="font-size:9px;color:rgba(156,163,175,1);min-width:30px;text-align:center;">{Math.round(pixelsPerSecond)}px/s</span>
				<button onclick={zoomIn} style="width:20px;height:20px;border-radius:4px;background:rgba(55,65,81,0.8);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;font-size:14px;line-height:1;display:flex;align-items:center;justify-content:center;" title="Zoom in">+</button>
			</div>
		</div>
	</div>

	<!-- TRACKS AREA ─────────────────────────────────────────────────── -->
	<div style="display:flex;border-radius:4px;overflow:hidden;border:1px solid rgba(255,255,255,0.07);">

		<!-- LABEL COLUMN ────────────────────────────────────────────── -->
		<div style="width:{LABEL_W}px;flex-shrink:0;background:#0f172a;border-right:1px solid rgba(255,255,255,0.08);z-index:5;">
			<!-- ruler spacer -->
			<div style="height:{RULER_H}px;border-bottom:1px solid rgba(255,255,255,0.06);"></div>
			{#if timeline.tracks.length === 0}
				<div style="height:{TRACK_H}px;display:flex;align-items:center;padding:0 8px;">
					<span style="font-size:9px;color:rgba(255,255,255,0.2);font-style:italic;">No tracks yet</span>
				</div>
			{:else}
				{#each timeline.tracks as track (track.id)}
					<!-- svelte-ignore a11y-click-events-have-key-events -->
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						onclick={() => {
							timelineStore.setActiveTrack(track.id === timeline.activeTrackId ? null : track.id);
							if (track.type === 'music' && track.assetSessionId) audioStudioStore.setActiveMusicSession(track.assetSessionId);
						}}
						style="height:{TRACK_H}px;display:flex;align-items:center;padding:0 5px;gap:3px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;background:{track.id === timeline.activeTrackId ? 'rgba(59,130,246,0.12)' : 'transparent'};border-left:2px solid {track.id === timeline.activeTrackId ? 'rgba(59,130,246,0.8)' : 'transparent'};"
					>
						<!-- Track colour dot -->
						<div style="width:5px;height:5px;border-radius:50%;background:{track.color};flex-shrink:0;"></div>
						<!-- Volume spinner -->
						<div style="display:flex;flex-direction:column;align-items:center;gap:0px;flex:1;min-width:0;">
							<span style="font-size:7px;color:rgba(107,114,128,1);text-transform:uppercase;letter-spacing:0.04em;line-height:1;">vol</span>
							<!-- svelte-ignore a11y-click-events-have-key-events -->
							<input
								type="number" min="0" max="100" step="1"
								value={Math.round(getTrackVol(track) * 100)}
								onclick={(e) => e.stopPropagation()}
								oninput={(e) => setTrackVol(track, parseFloat(e.currentTarget.value || '0'))}
								style="width:100%;background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.12);border-radius:3px;color:rgba(209,213,219,1);font-size:10px;font-weight:600;text-align:center;padding:1px 0;outline:none;-moz-appearance:textfield;"
							/>
						</div>
						<!-- Mute -->
						<button
							onclick={(e) => {
								e.stopPropagation();
								const newMuted = !track.muted;
								timelineStore.muteTrack(track.id, newMuted);
								if (track.type === 'video') audioStudioStore.setOriginalMuted(newMuted);
							}}
							style="width:16px;height:16px;border-radius:3px;background:{track.muted ? 'rgba(239,68,68,0.3)' : 'rgba(55,65,81,0.6)'};border:1px solid rgba(255,255,255,0.1);color:{track.muted ? 'rgba(239,68,68,1)' : 'rgba(156,163,175,1)'};cursor:pointer;font-size:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
							title={track.muted ? 'Unmute' : 'Mute'}
						>M</button>
						<!-- Remove (not for sole video track) -->
						{#if track.type !== 'video' || timeline.tracks.filter(t => t.type === 'video').length > 1}
							<button
								onclick={(e) => { e.stopPropagation(); timelineStore.removeTrack(track.id); }}
								style="width:14px;height:14px;border-radius:3px;background:rgba(55,65,81,0.6);border:1px solid rgba(255,255,255,0.1);color:rgba(156,163,175,1);cursor:pointer;font-size:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
								title="Remove track"
							>×</button>
						{/if}
					</div>
				{/each}
			{/if}
		</div>

		<!-- SCROLLABLE CANVAS ───────────────────────────────────────── -->
		<div bind:this={scrollEl} style="flex:1;overflow-x:auto;overflow-y:hidden;background:#0a0f1a;">
			<div style="width:{timelineWidth}px;height:{canvasHeight}px;position:relative;">

				<!-- RULER -->
				<!-- svelte-ignore a11y-click-events-have-key-events -->
				<!-- svelte-ignore a11y-no-static-element-interactions -->
				<div
					onclick={handleRulerClick}
					style="position:absolute;top:0;left:0;width:100%;height:{RULER_H}px;background:#0f172a;border-bottom:1px solid rgba(255,255,255,0.08);cursor:pointer;z-index:4;"
				>
					{#each getMarkers() as t (t)}
						{#if tp(t) <= timelineWidth}
							<div style="position:absolute;left:{tp(t)}px;top:0;">
								<div style="width:1px;height:5px;background:rgba(255,255,255,0.25);"></div>
								<span style="position:absolute;top:5px;left:3px;font-size:8px;color:rgba(255,255,255,0.4);white-space:nowrap;">{fmt(t)}</span>
							</div>
						{/if}
					{/each}
				</div>

				<!-- VIDEO-END MARKER -->
				<div style="position:absolute;top:0;bottom:0;left:{tp(videoDuration)}px;width:2px;background:rgba(251,191,36,0.3);pointer-events:none;z-index:3;">
					<span style="position:absolute;top:2px;left:3px;font-size:8px;font-weight:700;color:rgba(251,191,36,0.8);background:rgba(0,0,0,0.7);padding:1px 3px;border-radius:2px;white-space:nowrap;">End</span>
				</div>

				<!-- PLAYHEAD -->
				<div style="position:absolute;top:0;bottom:0;left:{tp(currentTime)}px;width:2px;pointer-events:none;z-index:10;">
					<div style="width:2px;height:100%;background:#ef4444;box-shadow:0 0 4px rgba(239,68,68,0.7);"></div>
					<!-- svelte-ignore a11y-no-static-element-interactions -->
					<div
						onmousedown={startPlayheadDrag}
						ontouchstart={startPlayheadDrag}
						style="position:absolute;top:0;left:-6px;width:14px;height:18px;cursor:col-resize;pointer-events:auto;z-index:11;display:flex;justify-content:center;"
					>
						<div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:9px solid #ef4444;margin-top:1px;"></div>
					</div>
					<div style="position:absolute;top:20px;left:4px;font-size:8px;font-weight:700;color:#ef4444;background:rgba(0,0,0,0.8);padding:1px 3px;border-radius:2px;white-space:nowrap;pointer-events:none;">{fmt(currentTime)}</div>
				</div>

				<!-- TRACK ROWS ────────────────────────────────────────── -->
				{#if timeline.tracks.length === 0}
					<div style="position:absolute;top:{RULER_H}px;left:0;right:0;height:{TRACK_H}px;display:flex;align-items:center;justify-content:center;">
						<span style="font-size:10px;color:rgba(255,255,255,0.15);font-style:italic;">Upload a video to get started</span>
					</div>
				{:else}
					{#each timeline.tracks as track, i (track.id)}
						<!-- svelte-ignore a11y-click-events-have-key-events -->
						<!-- svelte-ignore a11y-no-static-element-interactions -->
						<div
							onclick={(e) => handleTrackClick(e, track)}
							style="position:absolute;top:{RULER_H + i * TRACK_H}px;left:0;width:100%;height:{TRACK_H}px;border-bottom:1px solid rgba(255,255,255,0.04);background:{i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent'};"
						>
							{#each track.clips as clip (clip.id)}
								{@const cw = Math.max(4, tp(clip.endTime - clip.startTime))}

								{#if track.type === 'video'}
									<!-- Non-interactive video clip -->
									<div style="position:absolute;top:5px;left:{tp(clip.startTime)}px;width:{cw}px;height:{TRACK_H-10}px;background:{track.color};border:1px solid rgba(107,114,128,0.5);border-radius:3px;display:flex;align-items:center;padding:0 8px;pointer-events:none;overflow:hidden;">
										{#if cw > 50}
											<span style="font-size:9px;font-weight:600;color:rgba(209,213,219,0.9);white-space:nowrap;">🎬 {fmt(clip.endTime - clip.startTime)}</span>
										{/if}
									</div>

								{:else if track.type === 'music'}
									{@const mFadeIn  = audioStudio.musicFadeIn}
									{@const mFadeOut = audioStudio.musicFadeOut}
									{@const isActive = track.assetSessionId === audioStudio.activeMusicSessionId}
									<!-- svelte-ignore a11y-no-static-element-interactions -->
									<div
										onmousedown={(e) => startMusicDrag(e, track, clip)}
										ontouchstart={(e) => startMusicDrag(e, track, clip)}
										style="position:absolute;top:5px;left:{tp(clip.startTime)}px;width:{cw}px;height:{TRACK_H-10}px;background:{track.color};border:2px solid {isActive ? 'rgba(250,204,21,1)' : 'rgba(147,51,234,0.85)'};border-radius:3px;cursor:move;overflow:hidden;user-select:none;{isActive ? 'box-shadow:0 0 0 1px rgba(250,204,21,0.4),0 0 8px rgba(250,204,21,0.25);' : ''}"
									>
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div onmousedown={(e) => startMusicResizeStart(e, track, clip)} ontouchstart={(e) => startMusicResizeStart(e, track, clip)} style="position:absolute;left:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
										{#if mFadeIn > 0}
											<div style="position:absolute;left:0;top:0;bottom:0;width:{Math.min(tp(mFadeIn), cw * 0.5)}px;background:linear-gradient(to right,rgba(0,0,0,0.65),transparent);pointer-events:none;z-index:1;"></div>
										{/if}
										{#if cw > 50}
											<div style="padding:2px 12px;pointer-events:none;position:relative;z-index:0;">
												<div style="font-size:9px;font-weight:700;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.6);white-space:nowrap;">🎵 {track.name}</div>
												{#if cw > 90}
													<div style="font-size:8px;color:rgba(255,255,255,0.7);white-space:nowrap;">{clip.startTime.toFixed(1)}s – {clip.endTime.toFixed(1)}s</div>
												{/if}
											</div>
										{/if}
										{#if mFadeOut > 0}
											<div style="position:absolute;right:0;top:0;bottom:0;width:{Math.min(tp(mFadeOut), cw * 0.5)}px;background:linear-gradient(to left,rgba(0,0,0,0.65),transparent);pointer-events:none;z-index:1;"></div>
										{/if}
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div onmousedown={(e) => startMusicResizeEnd(e, track, clip)} ontouchstart={(e) => startMusicResizeEnd(e, track, clip)} style="position:absolute;right:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
									</div>

								{:else if track.type === 'sfx'}
									{@const inst = audioStudio.sfxInstances.find((s) => s.id === clip.id)}
									{#if inst}
										<!-- svelte-ignore a11y-no-static-element-interactions -->
										<div
											onmousedown={(e) => startSfxInteraction(e, inst, 'move')}
											ontouchstart={(e) => startSfxInteraction(e, inst, 'move')}
											style="position:absolute;top:5px;left:{tp(inst.startTime)}px;width:{Math.max(4, tp(inst.endTime - inst.startTime))}px;height:{TRACK_H-10}px;background:{track.color};border:1px solid rgba(37,99,235,0.85);border-radius:3px;cursor:move;overflow:hidden;user-select:none;"
										>
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<div onmousedown={(e) => startSfxInteraction(e, inst, 'resizeStart')} ontouchstart={(e) => startSfxInteraction(e, inst, 'resizeStart')} style="position:absolute;left:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
											{#if tp(inst.endTime - inst.startTime) > 40}
												<div style="padding:2px 12px;pointer-events:none;">
													<div style="font-size:9px;font-weight:700;color:white;text-shadow:0 1px 2px rgba(0,0,0,0.6);">🔊 {track.name}</div>
												</div>
											{/if}
											<div style="position:absolute;top:2px;right:12px;display:flex;gap:2px;z-index:3;">
												<button onclick={() => audioStudioStore.duplicateSfxInstance(inst.id)} style="width:14px;height:14px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);border-radius:2px;font-size:9px;cursor:pointer;color:white;display:flex;align-items:center;justify-content:center;" title="Duplicate">+</button>
												<button onclick={() => audioStudioStore.removeSfxInstance(inst.id)} style="width:14px;height:14px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.2);border-radius:2px;font-size:9px;cursor:pointer;color:white;display:flex;align-items:center;justify-content:center;" title="Remove">×</button>
											</div>
											<!-- svelte-ignore a11y-no-static-element-interactions -->
											<div onmousedown={(e) => startSfxInteraction(e, inst, 'resizeEnd')} ontouchstart={(e) => startSfxInteraction(e, inst, 'resizeEnd')} style="position:absolute;right:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
										</div>
									{/if}
								{/if}
							{/each}

							<!-- Empty track hint -->
							{#if track.clips.length === 0}
								<div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 12px;">
									<span style="font-size:9px;color:rgba(255,255,255,0.15);font-style:italic;">Empty — tap armed clip to place</span>
								</div>
							{/if}
						</div>
					{/each}
				{/if}

			</div>
		</div>
	</div>

	<!-- NUMERIC FINE-TUNE (music only) ─────────────────────────────── -->
	{#if audioStudio.musicSessionId}
		<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
			<div style="display:flex;flex-direction:column;gap:2px;">
				<label style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.55);">Music Start (s)</label>
				<input
					type="number" min="0" step="0.1"
					value={audioStudio.musicStartTime}
					oninput={(e) => audioStudioStore.setMusicStartTime(parseFloat(e.currentTarget.value))}
					style="padding:3px 6px;background:rgba(31,41,55,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:white;font-size:11px;outline:none;"
				/>
			</div>
			<div style="display:flex;flex-direction:column;gap:2px;">
				<label style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.55);">Music End (s)</label>
				<input
					type="number" min="0" step="0.1"
					value={audioStudio.musicEndTime}
					oninput={(e) => audioStudioStore.setMusicEndTime(parseFloat(e.currentTarget.value))}
					style="padding:3px 6px;background:rgba(31,41,55,0.8);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:white;font-size:11px;outline:none;"
				/>
			</div>
		</div>
	{/if}

</div>

<style>
	div::-webkit-scrollbar        { width: 4px; height: 4px; }
	div::-webkit-scrollbar-track  { background: rgba(255,255,255,0.03); }
	div::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.18); border-radius: 4px; }
	div::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
	div::-webkit-scrollbar-corner { background: transparent; }
	input[type=number]::-webkit-inner-spin-button,
	input[type=number]::-webkit-outer-spin-button { opacity: 1; height: 14px; }
</style>
