<!-- src/lib/components/ThreeJsEnhancer/TimelineEditor.svelte -->
<!-- DAW-style multi-track timeline — dynamic tracks from timelineStore -->
<script lang="ts">
	import { audioStudioStore, type SfxInstance } from '$lib/stores/audioStudio.store';
	import { timelineStore, type TimelineTrack, type TimelineClip } from '$lib/stores/timeline.store';
	import { mediaBinStore } from '$lib/stores/mediaBin.store';
	import { videoState } from '$lib/stores/video.store';
	import { editHistory, editHistoryState } from '$lib/stores/editHistory.store';

	interface Props {
		videoElement?: HTMLVideoElement | null;
		secondaryVideoElements?: Map<string, HTMLVideoElement>;
		mainVideoAssetId?: string | null;
	}
	let { videoElement = null, secondaryVideoElements = new Map(), mainVideoAssetId = null }: Props = $props();

	let audioStudio  = $derived($audioStudioStore);
	let timeline     = $derived($timelineStore);
	let videoDuration = $derived($videoState.videoDuration || 30);
	// Playhead time — read directly off the video element every frame (rAF below).
	// The event/store path (timeupdate → videoState → here) misses several play and
	// seek paths, which left the playhead intermittently frozen.
	let liveTime = $state(0);
	let currentTime  = $derived(liveTime);
	let isPlaying    = $derived($videoState.isPlaying);

	// Manual cursor: lets the edit cursor go beyond video duration for audio-only regions or gaps.
	// Null = follow the video element. Set when user drags/clicks past video end or during gap traversal.
	let manualCursor    = $state<number | null>(null);
	let manualPlaying   = $state(false);   // rAF-driven play for audio-only region or gap
	let manualPlayMs    = $state(0);       // wall-clock ms when manual play started
	let manualPlayStart = $state(0);       // editTime value when manual play started

	// Secondary elements with a play() promise in flight — prevents the rAF tick
	// from firing overlapping play() calls while the browser is still starting one.
	const pendingPlay = new Set<HTMLVideoElement>();

	// Last drift-resync per element. A slow seek (proxy-backed clip) leaves the
	// element permanently ~seek-latency behind the timeline clock; without a
	// cooldown the tick reseeks every frame it sees >0.3s drift — a seek storm
	// that strobes the composite (every seek dips readyState).
	const lastDriftSeek = new WeakMap<HTMLVideoElement, number>();

	// Segment playback state — which clip is currently being played (used by playback engine only)
	let activeVideoClipId = $state<string | null>(null);
	let inVideoGap        = $state(false);   // true while traversing a gap between clips
	let gapNextClipId     = $state<string | null>(null); // clip to resume after gap

	// rAF poller feeding liveTime — runs while the editor is mounted, so the playhead
	// tracks every play/seek path (buttons, spacebar, capture, post-capture autoplay)
	// without depending on media events firing.
	$effect(() => {
		if (!videoElement) return;
		let raf = 0;
		const tick = () => {
			// While a seek is in flight the element can report its stale position —
			// don't sample it, and don't release a manual cursor against it.
			if (!videoElement!.seeking) liveTime = videoElement!.currentTime;
			// Everything below belongs to live preview — during capture the capture
			// loop owns the timeline clock and all secondary elements.
			if (!(window as any).__threeJsCapturing) {
				// Publish the timeline moment for the compositor — it needs to know
				// which tracks' clips cover "now" to pick the visible layers.
				(window as any).__timelineEditTime = editTime;
				const t = editTime;
				for (const [assetId, el] of secondaryVideoElements) {
					const tr = timeline.tracks.find(k => k.type === 'video' && k.assetId === assetId);
					if (!tr) continue;
					// Secondary clips play their own audio — track M / vol control it
					el.muted = tr.muted;
					const clip = tr.clips.find(c => t >= c.startTime && t < c.endTime);
					// Per-clip fade: match preview audio to the visual fade the compositor draws
					let fadeVol = 1;
					if (clip) {
						const fi = clip.fadeIn ?? 0, fo = clip.fadeOut ?? 0;
						if (fi > 0 && t < clip.startTime + fi) fadeVol = Math.max(0, (t - clip.startTime) / fi);
						if (fo > 0 && t > clip.endTime - fo) fadeVol = Math.min(fadeVol, Math.max(0, (clip.endTime - t) / fo));
					}
					el.volume = Math.min(1, Math.max(0, (tr.volume ?? 1) * fadeVol));
					if (clip && effectivePlaying) {
						const target = clip.sourceStart + (t - clip.startTime);
						// No readyState gate — play() buffers and starts on its own; gating on
						// readyState >= 2 left preload-stalled clips permanently unstarted
						// (picture via the reseek below, zero audio). pendingPlay stops the
						// tick from stacking a play() per frame while one is in flight.
						if (el.paused) {
							if (!pendingPlay.has(el)) {
								pendingPlay.add(el);
								if (el.readyState >= 1) el.currentTime = target;
								el.play()
									.then(() => pendingPlay.delete(el))
									.catch((err) => {
										pendingPlay.delete(el);
										console.warn(`🔇 Secondary clip "${tr.name}" play failed — no audio for this clip:`, err?.name, err?.message);
									});
							}
						} else if (!el.seeking && Math.abs(el.currentTime - target) > 0.3) {
							// Drifted — resync, but at most every 600ms per element so a
							// slow-seeking clip can't loop into a strobe (see lastDriftSeek).
							const nowMs = performance.now();
							if (nowMs - (lastDriftSeek.get(el) ?? 0) > 600) {
								lastDriftSeek.set(el, nowMs);
								console.warn(`🔁 Secondary clip "${tr.name}" drifted ${(el.currentTime - target).toFixed(2)}s from timeline (t=${t.toFixed(2)}s, readyState=${el.readyState}) — resyncing`);
								el.currentTime = target;
							}
						}
					} else if (!el.paused) {
						el.pause();
					}
				}
			}
			// A manual cursor left behind by a ruler click freezes the playhead once
			// real playback resumes — release it unless gap traversal owns it.
			if (manualCursor !== null && !manualPlaying && !inVideoGap && !videoElement!.paused && !videoElement!.seeking) {
				manualCursor = null;
			}
			// Frame-accurate clip-boundary stop — timeupdate only fires ~4×/s, which
			// would let up to ~250ms of audio leak past a trim cut.
			if (isPlaying && !inVideoGap && activeVideoClipId && !videoElement!.seeking) {
				const bc = getClipById(activeVideoClipId);
				if (bc && liveTime >= bc.sourceEnd - 1 / 60) handleClipEnd();
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => {
			cancelAnimationFrame(raf);
			(window as any).__timelineEditTime = null;
		};
	});

	// editTime: sourceToTimeline maps video.currentTime → correct timeline position for any
	// split/rearrange layout, since source ranges never overlap after a split.
	let editTime        = $derived(manualCursor !== null ? manualCursor : (sourceToTimeline(currentTime) ?? currentTime));
	let effectivePlaying = $derived(isPlaying || manualPlaying);

	// When video plays normally, exit manual/gap modes
	$effect(() => { if (isPlaying) { manualCursor = null; manualPlaying = false; } });

	// Sync gap state to video store so ThreeJsScene can show black overlay
	$effect(() => { videoState.setInVideoGap(inVideoGap); });

	// Pause all secondary videos whenever primary stops (or gap traversal stops)
	$effect(() => {
		if (!isPlaying && !manualPlaying) {
			for (const [, el] of secondaryVideoElements) el.pause();
		}
	});

	// Seek + optionally play every secondary video element to the correct source offset
	function syncSecondaries(play: boolean) {
		const t = editTime;
		for (const [assetId, el] of secondaryVideoElements) {
			const track = timeline.tracks.find(tr => tr.type === 'video' && tr.assetId === assetId);
			if (!track) continue;
			const clip = track.clips.find(c => t >= c.startTime && t < c.endTime);
			if (clip) {
				el.currentTime = clip.sourceStart + (t - clip.startTime);
				if (play) {
					el.play().catch((err) =>
						console.warn(`🔇 Secondary clip "${track.name}" play failed — no audio for this clip:`, err?.name, err?.message)
					);
				}
			} else {
				el.pause();
			}
		}
	}

	// ── SEGMENT PLAYBACK HELPERS ────────────────────────────────────

	// The transport drives the main video element, so the playback engine stays
	// bound to its track even when it's been demoted below other video tracks
	// (track order only changes compositing priority, not who owns playback).
	function getPrimaryVideoTrack(): TimelineTrack | null {
		return (
			timeline.tracks.find(tr => tr.type === 'video' && tr.assetId === mainVideoAssetId) ??
			timeline.tracks.find(tr => tr.type === 'video') ??
			null
		);
	}

	// Only primary-track clips — prevents secondary clips from interfering with the
	// primary playback engine (handleClipEnd, sourceToTimeline, etc.)
	function getVideoClipsSorted(): TimelineClip[] {
		const track = getPrimaryVideoTrack();
		if (!track) return [];
		return [...track.clips].sort((a, b) => a.startTime - b.startTime);
	}

	function getClipById(id: string): TimelineClip | null {
		for (const tr of timeline.tracks)
			for (const c of tr.clips)
				if (c.id === id) return c;
		return null;
	}

	function getNextVideoClip(clipId: string): TimelineClip | null {
		const clips = getVideoClipsSorted();
		const idx = clips.findIndex(c => c.id === clipId);
		return (idx >= 0 && idx < clips.length - 1) ? clips[idx + 1] : null;
	}

	// Looks at ALL tracks (video, music, sfx, secondary) so playback continues as long
	// as any media is active on the timeline.
	function getMaxTimelineEnd(): number {
		let m = 0;
		for (const tr of timeline.tracks) for (const c of tr.clips) m = Math.max(m, c.endTime);
		return m;
	}

	function handleClipEnd() {
		if (!activeVideoClipId || inVideoGap) return;
		const clip = getClipById(activeVideoClipId);
		if (!clip) return;
		const nextClip = getNextVideoClip(activeVideoClipId);
		if (nextClip) {
			const gap = nextClip.startTime - clip.endTime;
			if (gap > 0.08) {
				// Gap between clips — pause video and traverse with rAF
				if (videoElement && !videoElement.paused) videoElement.pause();
				inVideoGap = true;
				gapNextClipId = nextClip.id;
				manualCursor = clip.endTime;
				manualPlayStart = clip.endTime;
				manualPlayMs = Date.now();
				manualPlaying = true;
			} else {
				// Adjacent clips — jump directly to next source offset
				activeVideoClipId = nextClip.id;
				if (videoElement) videoElement.currentTime = nextClip.sourceStart;
			}
		} else {
			// Primary track finished — check if secondary / audio extends further
			const maxEnd = getMaxTimelineEnd();
			if (maxEnd > clip.endTime + 0.05) {
				// Pause primary so composite shows black in its slot
				if (videoElement && !videoElement.paused) videoElement.pause();
				activeVideoClipId = null;
				manualCursor = clip.endTime;
				manualPlayStart = clip.endTime;
				manualPlayMs = Date.now();
				manualPlaying = true;
				// Ensure secondaries are running — manualPlaying=true prevents the pause effect
				syncSecondaries(true);
			} else {
				// Nothing beyond this clip — stop here. A trimmed clip ends before the
				// element's natural end, so without this the element (and its audio)
				// keeps playing past the deleted region.
				if (videoElement && !videoElement.paused) videoElement.pause();
				manualCursor = clip.endTime;
				activeVideoClipId = null;
			}
		}
	}

	// rAF loop — advances manualCursor while manualPlaying is true (gaps + audio-only zones)
	$effect(() => {
		if (!manualPlaying) return;
		let rafId: number;
		const tick = () => {
			const next = manualPlayStart + (Date.now() - manualPlayMs) / 1000;
			manualCursor = next;

			// Gap traversal: when we've reached the next clip's start, resume video
			if (inVideoGap && videoElement && gapNextClipId) {
				const nextClip = getClipById(gapNextClipId);
				if (nextClip && next >= nextClip.startTime) {
					inVideoGap = false;
					activeVideoClipId = nextClip.id;
					gapNextClipId = null;
					manualCursor = null;
					manualPlaying = false;
					videoElement.currentTime = nextClip.sourceStart;
					videoElement.play().catch(() => {});
					return;
				}
			}

			if (next >= getMaxTimelineEnd()) { manualPlaying = false; return; }
			rafId = requestAnimationFrame(tick);
		};
		rafId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(rafId);
	});

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
		const onTime  = () => {
			// During capture the playhead is driven by ThreeJsScene's poller — bail so
			// the clip-boundary logic can't seek the video away from the capture loop.
			if ((window as any).__threeJsCapturing) return;
			const srcT = videoElement!.currentTime;
			videoState.setCurrentTime(srcT);
			// Detect when we've reached a clip's sourceEnd and need to jump to the next segment
			if (!isPlaying || inVideoGap) return;
			// Autoplay starts without an active clip — infer it from the source time
			// so trimmed-clip boundaries are still enforced.
			if (!activeVideoClipId) {
				activeVideoClipId = getVideoClipsSorted().find(
					c => srcT >= c.sourceStart && srcT < c.sourceEnd
				)?.id ?? null;
				if (!activeVideoClipId) return;
			}
			const clip = getClipById(activeVideoClipId);
			if (clip && srcT >= clip.sourceEnd - 0.05) handleClipEnd();
		};
		const onEnded = () => {
			if ((window as any).__threeJsCapturing) return;
			videoState.setIsPlaying(false);
			// Safety net: if onTime missed the boundary, handle it here
			handleClipEnd();
		};
		videoElement.addEventListener('play',       onPlay);
		videoElement.addEventListener('pause',      onPause);
		videoElement.addEventListener('timeupdate', onTime);
		videoElement.addEventListener('ended',      onEnded);
		videoState.setCurrentTime(videoElement.currentTime);
		videoState.setIsPlaying(!videoElement.paused);
		return () => {
			videoElement!.removeEventListener('play',       onPlay);
			videoElement!.removeEventListener('pause',      onPause);
			videoElement!.removeEventListener('timeupdate', onTime);
			videoElement!.removeEventListener('ended',      onEnded);
		};
	});

	// ── SPACEBAR PLAY/PAUSE + UNDO/REDO ─────────────────────────────
	$effect(() => {
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement | null;
			const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
			if ((window as any).__threeJsCapturing) return;
			// Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — timeline undo/redo
			if ((e.ctrlKey || e.metaKey) && !typing) {
				const k = e.key.toLowerCase();
				if (k === 'z' || k === 'y') {
					e.preventDefault();
					if (k === 'y' || e.shiftKey) editHistory.redo();
					else editHistory.undo();
					return;
				}
			}
			if (e.code !== 'Space') return;
			// Don't hijack space while typing or when a control would also react to it
			if (typing || (t && (t.tagName === 'SELECT' || t.tagName === 'BUTTON'))) return;
			e.preventDefault(); // stop the page from scrolling
			togglePlay();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	// ── AUDIO SYNC ──────────────────────────────────────────────────
	$effect(() => {
		const entries = audioStudio.musicEntries;
		if (Object.keys(entries).length === 0) return;
		audioStudioStore.syncMusicToVideo(editTime, effectivePlaying);
	});
	$effect(() => {
		if (!audioStudio.sfxSessionId) return;
		if (!audioStudio.sfxInstances) return;
		audioStudioStore.syncSfxToVideo(editTime, effectivePlaying);
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
		if (!scrollEl || !effectivePlaying) return;
		const playX = editTime * pixelsPerSecond;
		const w  = scrollEl.clientWidth;
		const sl = scrollEl.scrollLeft;
		if (playX > sl + w - 50 || playX < sl) {
			scrollEl.scrollLeft = Math.max(0, playX - 40);
		}
	});

	// ── CONTROLS ────────────────────────────────────────────────────
	function togglePlay() {
		if (manualPlaying) {
			manualPlaying = false;
			inVideoGap = false;
			return;
		}
		if (!videoElement) return;
		if (!videoElement.paused) { videoElement.pause(); return; }

		// Play pressed at/after the end of everything — wrap back to the start,
		// otherwise the manual rAF exits immediately and play does nothing.
		if (editTime >= getMaxTimelineEnd() - 0.05) seekTo(0);

		// Find which video clip covers the current editTime
		const clips = getVideoClipsSorted();
		const clipAtTime = clips.find(c => editTime >= c.startTime && editTime < c.endTime);

		if (clipAtTime) {
			// Start from the correct source offset within this clip
			activeVideoClipId = clipAtTime.id;
			videoElement.currentTime = clipAtTime.sourceStart + (editTime - clipAtTime.startTime);
			videoElement.play().catch(() => {});
			syncSecondaries(true);
		} else {
			const nextClip = clips.find(c => c.startTime > editTime);
			if (nextClip) {
				// Cursor is in a gap — traverse it with manual rAF
				inVideoGap = true;
				gapNextClipId = nextClip.id;
				manualCursor    = editTime;
				manualPlayStart = editTime;
				manualPlayMs    = Date.now();
				manualPlaying   = true;
				syncSecondaries(true);
			} else {
				// Past all primary clips — secondary/audio-only zone. Secondaries must
				// be started here or their video stays frozen while the cursor moves.
				manualPlayStart = editTime;
				manualPlayMs    = Date.now();
				manualPlaying   = true;
				syncSecondaries(true);
			}
		}
	}
	function zoomIn()  { pixelsPerSecond = Math.min(200, pixelsPerSecond * 1.4); }
	function zoomOut() { pixelsPerSecond = Math.max(15,  pixelsPerSecond / 1.4); }

	function getTrackVol(track: TimelineTrack): number {
		if (track.type === 'video') {
			// Main video volume lives in audioStudio; secondary clips carry their own
			return track.assetId === mainVideoAssetId ? audioStudio.originalVolume : (track.volume ?? 1);
		}
		if (track.type === 'music') return audioStudio.musicEntries[track.assetSessionId ?? '']?.volume ?? 0.3;
		if (track.type === 'sfx')   return audioStudio.sfxVolume;
		return 0.5;
	}
	function setTrackVol(track: TimelineTrack, pct: number) {
		const v = Math.max(0, Math.min(100, pct)) / 100;
		if (track.type === 'video') {
			if (track.assetId === mainVideoAssetId) audioStudioStore.setOriginalVolume(v);
			else timelineStore.setTrackVolume(track.id, v);
		}
		else if (track.type === 'music' && track.assetSessionId) audioStudioStore.updateMusicEntry(track.assetSessionId, { volume: v });
		else if (track.type === 'sfx') audioStudioStore.setSfxVolume(v);
	}

	// ── UNIFIED DRAG HELPER ─────────────────────────────────────────
	function attachDrag(onMove: (x: number, y: number) => void, onStop: () => void) {
		function mouseMove(e: MouseEvent) { onMove(e.clientX, e.clientY); }
		function touchMove(e: TouchEvent) {
			if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
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

	// mousedown fires for EVERY button — right-click must not start a drag (it
	// used to push a phantom undo checkpoint, making the menu's Undo a no-op).
	function notLeftButton(e: MouseEvent | TouchEvent): boolean {
		return 'button' in e && e.button !== 0;
	}

	// ── VIDEO CLIP TIME MAPPING ──────────────────────────────────────
	// Maps a timeline position → source video time (null = in a gap, no video).
	function timelineToSource(t: number): number | null {
		const track = getPrimaryVideoTrack();
		if (!track) return null;
		const clips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
		const clip = clips.find(c => t >= c.startTime && t < c.endTime);
		if (!clip) return null;
		return clip.sourceStart + (t - clip.startTime);
	}

	// Maps a source video time → timeline position (null = source time is trimmed out).
	function sourceToTimeline(s: number): number | null {
		const track = getPrimaryVideoTrack();
		if (!track) return null;
		// Prefer the clip the transport is actively playing — duplicated clips share
		// a source range, so a pure source→timeline lookup would always resolve to
		// the first copy and snap the timeline clock back to it.
		if (activeVideoClipId) {
			const active = track.clips.find(c => c.id === activeVideoClipId);
			if (active && s >= active.sourceStart - 0.05 && s < active.sourceEnd + 0.05) {
				return active.startTime + (s - active.sourceStart);
			}
		}
		const clips = [...track.clips].sort((a, b) => a.sourceStart - b.sourceStart);
		const clip = clips.find(c => s >= c.sourceStart && s < c.sourceEnd);
		if (!clip) return null;
		return clip.startTime + (s - clip.sourceStart);
	}

	// ── RULER SEEK ──────────────────────────────────────────────────
	function handleRulerClick(e: MouseEvent) {
		if (!scrollEl) return;
		const rect = scrollEl.getBoundingClientRect();
		const clickX = e.clientX - rect.left + scrollEl.scrollLeft;
		seekTo(Math.max(0, pt(clickX)));
	}

	function handleRulerKey(e: KeyboardEvent) {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		e.preventDefault();
		if (!scrollEl) return;
		seekTo(Math.max(0, pt(scrollEl.scrollLeft + scrollEl.clientWidth / 2)));
	}

	let seekToken = 0;
	function seekTo(t: number) {
		// Track which clip the seek lands in — duplicates share source ranges, so
		// editTime needs the clip identity to map source→timeline unambiguously.
		activeVideoClipId = getVideoClipsSorted().find(c => t >= c.startTime && t < c.endTime)?.id ?? null;
		inVideoGap = false;
		manualPlaying = false;
		// Own the playhead immediately — element seeks are async (and slow over the
		// proxy), so reading the position back mid-seek snaps the cursor to wherever
		// the element still is (it was getting pinned at the previous clip boundary).
		manualCursor = t;
		const token = ++seekToken;
		const srcT = timelineToSource(t);
		if (videoElement && srcT !== null) {
			videoElement.currentTime = srcT;
			videoState.setCurrentTime(srcT);
			// Hand the cursor back to element-tracking once this seek actually lands
			// (a newer seek/drag supersedes it via the token).
			videoElement.addEventListener('seeked', () => {
				if (token === seekToken && !manualPlaying && !inVideoGap) manualCursor = null;
			}, { once: true });
		}
		syncSecondaries(false);
	}

	// ── PLAYHEAD DRAG ───────────────────────────────────────────────
	function startPlayheadDrag(e: MouseEvent | TouchEvent) {
		if (!scrollEl) return;
		attachDrag(
			(x) => {
				const rectLeft = scrollEl.getBoundingClientRect().left;
				const t = Math.max(0, pt(x - rectLeft + scrollEl.scrollLeft));
				seekTo(t);
			},
			() => {}
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── TRACK DRAG REORDER (video layer priority) ───────────────────
	function startTrackDrag(e: MouseEvent | TouchEvent, track: TimelineTrack) {
		if (notLeftButton(e)) return;
		const y0 = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
		const origPos = timeline.tracks.filter(t => t.type === 'video').findIndex(t => t.id === track.id);
		if (origPos === -1) return;
		editHistory.beginGesture();
		timelineStore.setActiveTrack(track.id);
		attachDrag(
			(_x, y) => {
				// Live-reorder: target slot from vertical distance dragged. Anchored to
				// the original position so repeated moves stay idempotent mid-drag.
				timelineStore.moveVideoTrackTo(track.id, origPos + Math.round((y - y0) / TRACK_H));
			},
			() => editHistory.endGesture()
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── MUSIC CLIP DRAG ─────────────────────────────────────────────
	function startMusicDrag(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		if (track.assetSessionId) audioStudioStore.setActiveMusicSession(track.assetSessionId);
		editHistory.beginGesture();
		timelineStore.setActiveClip(track.id, clip.id);
		const x0     = cx(e);
		const start0 = clip.startTime;
		const dur    = clip.endTime - clip.startTime;
		const sid    = track.assetSessionId;
		attachDrag(
			(x) => {
				const s = Math.max(0, start0 + (x - x0) / pixelsPerSecond);
				// Move shifts timeline position only — sourceStart/sourceEnd stay fixed
				timelineStore.updateClip(track.id, clip.id, { startTime: s, endTime: s + dur });
				if (sid) audioStudioStore.updateMusicEntry(sid, { startTime: s, endTime: s + dur });
			},
			() => editHistory.endGesture()
		);
		e.preventDefault();
	}

	function startMusicResizeStart(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
		const x0          = cx(e);
		const start0      = clip.startTime;
		const sourceStart0 = clip.sourceStart;
		const sid         = track.assetSessionId;
		attachDrag(
			(x) => {
				const dt          = (x - x0) / pixelsPerSecond;
				const newStart    = Math.max(0, Math.min(clip.endTime - 0.5, start0 + dt));
				const newSrcStart = Math.max(0, sourceStart0 + (newStart - start0));
				timelineStore.updateClip(track.id, clip.id, { startTime: newStart, sourceStart: newSrcStart });
				if (sid) audioStudioStore.updateMusicEntry(sid, { startTime: newStart, trimStart: newSrcStart });
			},
			() => editHistory.endGesture()
		);
		e.stopPropagation(); e.preventDefault();
	}

	function startMusicResizeEnd(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
		const x0        = cx(e);
		const end0      = clip.endTime;
		const sourceEnd0 = clip.sourceEnd;
		const sid       = track.assetSessionId;
		attachDrag(
			(x) => {
				const newEnd    = Math.max(clip.startTime + 0.5, end0 + (x - x0) / pixelsPerSecond);
				const newSrcEnd = sourceEnd0 + (newEnd - end0);
				timelineStore.updateClip(track.id, clip.id, { endTime: newEnd, sourceEnd: newSrcEnd });
				if (sid) audioStudioStore.updateMusicEntry(sid, { endTime: newEnd });
			},
			() => editHistory.endGesture()
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── VIDEO CLIP DRAG / RESIZE ────────────────────────────────────
	function startVideoDrag(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
		timelineStore.setActiveClip(track.id, clip.id);
		const x0 = cx(e); const start0 = clip.startTime; const dur = clip.endTime - clip.startTime;
		const y0 = 'touches' in e ? (e.touches[0]?.clientY ?? 0) : e.clientY;
		const origPos = timeline.tracks.filter(t => t.type === 'video').findIndex(t => t.id === track.id);
		attachDrag(
			(x, y) => {
				const s = Math.max(0, start0 + (x - x0) / pixelsPerSecond);
				timelineStore.updateClip(track.id, clip.id, { startTime: s, endTime: s + dur });
				// Vertical drag across rows re-layers the track (standard NLE behavior).
				// Anchored to the original position so live reordering stays idempotent.
				if (origPos !== -1) {
					timelineStore.moveVideoTrackTo(track.id, origPos + Math.round((y - y0) / TRACK_H));
				}
			},
			() => editHistory.endGesture()
		);
		e.preventDefault();
	}

	function startVideoResizeStart(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
		const x0 = cx(e); const start0 = clip.startTime; const sourceStart0 = clip.sourceStart;
		attachDrag(
			(x) => {
				const dt = (x - x0) / pixelsPerSecond;
				const newStart    = Math.max(0, Math.min(clip.endTime - 0.1, start0 + dt));
				const newSrcStart = Math.max(0, sourceStart0 + (newStart - start0));
				timelineStore.updateClip(track.id, clip.id, { startTime: newStart, sourceStart: newSrcStart });
			},
			() => editHistory.endGesture()
		);
		e.stopPropagation(); e.preventDefault();
	}

	function startVideoResizeEnd(e: MouseEvent | TouchEvent, track: TimelineTrack, clip: TimelineClip) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
		const x0 = cx(e); const end0 = clip.endTime; const sourceEnd0 = clip.sourceEnd;
		// Clip length is bounded by its own source media, not the main video's
		// duration (export follows the timeline now). Images have no intrinsic
		// length — they extend freely.
		const asset = $mediaBinStore.assets.find(a => a.id === track.assetId);
		const isImage = asset?.type === 'image';
		const srcDuration = asset?.duration ?? videoDuration;
		attachDrag(
			(x) => {
				let newEnd    = Math.max(clip.startTime + 0.1, end0 + (x - x0) / pixelsPerSecond);
				let newSrcEnd = sourceEnd0 + (newEnd - end0);
				if (isImage) {
					newSrcEnd = newEnd - clip.startTime;
				} else if (newSrcEnd > srcDuration) {
					newEnd   -= newSrcEnd - srcDuration;
					newSrcEnd = srcDuration;
				}
				timelineStore.updateClip(track.id, clip.id, { endTime: newEnd, sourceEnd: newSrcEnd });
			},
			() => editHistory.endGesture()
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── ACTIVE CLIP TRACKING ────────────────────────────────────────
	// Focus lives in the store so the ControlsPanel's "Selected Clip" section
	// follows whichever bar is focused here.
	let activeClipId = $derived(timeline.activeClipId);

	function splitActiveClip() {
		if (!activeClipId || !timeline.activeTrackId) return;
		editHistory.checkpoint();
		timelineStore.splitClip(timeline.activeTrackId, activeClipId, editTime);
		timelineStore.setActiveClip(timeline.activeTrackId, null); // deselect after split
	}

	function duplicateMusicClip(track: TimelineTrack, clip: TimelineClip) {
		editHistory.checkpoint();
		timelineStore.duplicateClip(track.id, clip.id);
	}

	function deleteClip(track: TimelineTrack, clipId: string) {
		const isLast = track.clips.length === 1;
		editHistory.checkpoint();
		timelineStore.removeClip(track.id, clipId);
		// If last clip, auto-remove empties the track — clean up audio entry too
		if (isLast && track.assetSessionId) audioStudioStore.stopMusic(track.assetSessionId);
	}

	// ── PORTAL ACTION — escapes backdrop-filter / transform containers ──
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy() { node.remove(); } };
	}

	// ── CONTEXT MENU ────────────────────────────────────────────────
	interface CtxMenu { x: number; y: number; track: TimelineTrack; clip: TimelineClip; }
	interface ClipboardEntry { assetId: string; sourceStart: number; sourceEnd: number; }

	let ctxMenu = $state<CtxMenu | null>(null);
	let clipboardClip = $state<ClipboardEntry | null>(null);

	function openCtxMenu(e: MouseEvent, track: TimelineTrack, clip: TimelineClip) {
		e.preventDefault();
		// Right-click focuses the clip too (drag handlers ignore non-left buttons now)
		timelineStore.setActiveClip(track.id, clip.id);
		ctxMenu = { x: e.clientX, y: e.clientY, track, clip };
	}

	// Menu height estimate for flip-up positioning — the timeline sits at the
	// bottom of the screen, so opening downward almost always clipped the menu.
	const CTX_MENU_H = 280;
	function closeCtxMenu() { ctxMenu = null; }

	function ctxCopy() {
		if (!ctxMenu) return;
		const c = ctxMenu.clip;
		clipboardClip = { assetId: c.assetId, sourceStart: c.sourceStart, sourceEnd: c.sourceEnd };
		closeCtxMenu();
	}

	function ctxPaste() {
		if (!ctxMenu || !clipboardClip) return;
		editHistory.checkpoint();
		const dur = clipboardClip.sourceEnd - clipboardClip.sourceStart;
		timelineStore.insertClip(ctxMenu.track.id, {
			assetId: clipboardClip.assetId,
			startTime: editTime,
			endTime: editTime + dur,
			sourceStart: clipboardClip.sourceStart,
			sourceEnd: clipboardClip.sourceEnd
		});
		closeCtxMenu();
	}

	function ctxDuplicate() {
		if (!ctxMenu) return;
		duplicateMusicClip(ctxMenu.track, ctxMenu.clip);
		closeCtxMenu();
	}

	function ctxDelete() {
		if (!ctxMenu) return;
		deleteClip(ctxMenu.track, ctxMenu.clip.id);
		closeCtxMenu();
	}

	function ctxUndo() { editHistory.undo(); closeCtxMenu(); }
	function ctxRedo() { editHistory.redo(); closeCtxMenu(); }

	// ── SFX CLIP DRAG ───────────────────────────────────────────────
	let activeSfxId: string | null = null;

	function startSfxInteraction(
		e: MouseEvent | TouchEvent,
		inst: SfxInstance,
		mode: 'move' | 'resizeStart' | 'resizeEnd'
	) {
		if (notLeftButton(e)) return;
		editHistory.beginGesture();
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
			() => { activeSfxId = null; editHistory.endGesture(); }
		);
		e.stopPropagation(); e.preventDefault();
	}

	// ── CLIP PLACEMENT from armed bin asset ─────────────────────────
	function handleTrackClick(e: MouseEvent, track: TimelineTrack) {
		const armed = $mediaBinStore.armedAssetId;
		if (!armed) {
			// Click on empty track space with nothing armed = deselect the focused
			// clip (clip divs stop propagation, so this only fires off-clip).
			timelineStore.setActiveClip(timeline.activeTrackId, null);
			return;
		}
		if (!scrollEl) return;
		const asset = $mediaBinStore.assets.find((a) => a.id === armed);
		if (!asset) return;
		const rect = scrollEl.getBoundingClientRect();
		const dropTime = pt(e.clientX - rect.left + scrollEl.scrollLeft);
		editHistory.checkpoint();
		if (asset.id === track.assetId) {
			// Same asset — add another clip to this track at the click position
			timelineStore.insertClip(track.id, {
				assetId: asset.id,
				startTime: dropTime,
				endTime: dropTime + asset.duration,
				sourceStart: 0,
				sourceEnd: asset.duration
			});
		} else if (asset.type === 'video' || asset.type === 'image') {
			// Different asset — a track is bound to one source, so place on a new track
			timelineStore.addVideoTrack(asset.id, asset.name, asset.duration, dropTime);
		} else if (asset.type === 'music') {
			timelineStore.addMusicTrack(asset.id, asset.name, asset.sessionId ?? asset.id, dropTime, dropTime + asset.duration);
		} else if (asset.type === 'sfx') {
			timelineStore.addSfxTrack(asset.id, asset.name, asset.sessionId ?? asset.id, [
				{ id: crypto.randomUUID(), startTime: dropTime, endTime: dropTime + asset.duration }
			]);
		}
		mediaBinStore.disarm();
	}
</script>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { closeCtxMenu(); timelineStore.setActiveClip(timeline.activeTrackId, null); } }} />

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
				{fmt(editTime)} / {fmt(videoDuration)}
			</span>
			<button
				onclick={togglePlay}
				disabled={!videoElement && !manualPlaying}
				style="width:24px;height:24px;border-radius:50%;background:rgba(59,130,246,0.85);border:1px solid rgba(59,130,246,1);color:white;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
				title={effectivePlaying ? 'Pause' : 'Play'}
			>
				{#if effectivePlaying}
					<svg viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="currentColor" style="width:10px;height:10px;"><path d="M8 5v14l11-7z"/></svg>
				{/if}
			</button>
			<!-- Split at playhead (music only, when a clip is focused) -->
			{#if activeClipId && (timeline.tracks.find(t => t.id === timeline.activeTrackId)?.type === 'music' || timeline.tracks.find(t => t.id === timeline.activeTrackId)?.type === 'video')}
				<button
					onclick={splitActiveClip}
					style="height:20px;padding:0 7px;border-radius:4px;background:rgba(234,179,8,0.2);border:1px solid rgba(234,179,8,0.6);color:rgba(234,179,8,1);cursor:pointer;font-size:11px;white-space:nowrap;display:flex;align-items:center;gap:3px;"
					title="Split focused clip at playhead position"
				>✂ Split</button>
			{/if}
			<!-- Undo / Redo -->
			<div style="display:flex;align-items:center;gap:2px;">
				<button onclick={() => editHistory.undo()} disabled={!$editHistoryState.canUndo} style="width:20px;height:20px;border-radius:4px;background:rgba(55,65,81,0.8);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:{$editHistoryState.canUndo ? 1 : 0.35};" title="Undo (Ctrl+Z)">↶</button>
				<button onclick={() => editHistory.redo()} disabled={!$editHistoryState.canRedo} style="width:20px;height:20px;border-radius:4px;background:rgba(55,65,81,0.8);border:1px solid rgba(255,255,255,0.15);color:white;cursor:pointer;font-size:12px;line-height:1;display:flex;align-items:center;justify-content:center;opacity:{$editHistoryState.canRedo ? 1 : 0.35};" title="Redo (Ctrl+Y)">↷</button>
			</div>
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
					<div
						tabindex="0"
						role="button"
						onkeydown={() => {
							timelineStore.setActiveTrack(track.id === timeline.activeTrackId ? null : track.id);
							if (track.type === 'music' && track.assetSessionId) audioStudioStore.setActiveMusicSession(track.assetSessionId);
						}}
						onclick={() => {
							timelineStore.setActiveTrack(track.id === timeline.activeTrackId ? null : track.id);
							if (track.type === 'music' && track.assetSessionId) audioStudioStore.setActiveMusicSession(track.assetSessionId);
						}}
						style="height:{TRACK_H}px;display:flex;align-items:center;padding:0 5px;gap:3px;border-bottom:1px solid rgba(255,255,255,0.04);cursor:pointer;background:{track.id === timeline.activeTrackId ? 'rgba(59,130,246,0.12)' : 'transparent'};border-left:2px solid {track.id === timeline.activeTrackId ? 'rgba(59,130,246,0.8)' : 'transparent'};"
					>
						<!-- Track colour dot -->
						<div style="width:5px;height:5px;border-radius:50%;background:{track.color};flex-shrink:0;"></div>
						<!-- Drag to reorder video layer priority (top = primary, supersedes below) -->
						{#if track.type === 'video' && timeline.tracks.filter(t => t.type === 'video').length > 1}
							<button
								onmousedown={(e) => startTrackDrag(e, track)}
								ontouchstart={(e) => startTrackDrag(e, track)}
								onclick={(e) => e.stopPropagation()}
								title="Drag up/down to reorder layer (top = shown on top)"
								style="width:14px;height:22px;border-radius:3px;background:rgba(55,65,81,0.6);border:1px solid rgba(255,255,255,0.1);color:rgba(156,163,175,1);cursor:grab;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;"
							>≡</button>
						{/if}
						<!-- Volume spinner -->
						<div style="display:flex;flex-direction:column;align-items:center;gap:0px;flex:1;min-width:0;">
							<span style="font-size:7px;color:rgba(107,114,128,1);text-transform:uppercase;letter-spacing:0.04em;line-height:1;">vol</span>
							
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
								if (track.type === 'video' && track.assetId === mainVideoAssetId) audioStudioStore.setOriginalMuted(newMuted);
							}}
							style="width:16px;height:16px;border-radius:3px;background:{track.muted ? 'rgba(239,68,68,0.3)' : 'rgba(55,65,81,0.6)'};border:1px solid rgba(255,255,255,0.1);color:{track.muted ? 'rgba(239,68,68,1)' : 'rgba(156,163,175,1)'};cursor:pointer;font-size:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
							title={track.muted ? 'Unmute' : 'Mute'}
						>M</button>
						<!-- Remove: deletes focused clip if one is selected on this track, else removes whole track -->
						{#if track.type !== 'video' || timeline.tracks.filter(t => t.type === 'video').length > 1}
							{@const focusedClip = track.clips.find(c => c.id === activeClipId)}
							<button
								onclick={(e) => {
									e.stopPropagation();
									if (focusedClip) {
										deleteClip(track, focusedClip.id);
									} else {
										if (track.assetSessionId) audioStudioStore.stopMusic(track.assetSessionId);
										timelineStore.removeTrack(track.id);
									}
								}}
								style="width:14px;height:14px;border-radius:3px;background:{focusedClip ? 'rgba(239,68,68,0.35)' : 'rgba(55,65,81,0.6)'};border:1px solid rgba(255,255,255,0.1);color:{focusedClip ? 'rgba(239,68,68,1)' : 'rgba(156,163,175,1)'};cursor:pointer;font-size:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"
								title={focusedClip ? 'Delete focused clip' : 'Remove track'}
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
				
				<div
				tabindex="0"
				role="button"
					onkeydown={handleRulerKey}
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
				<div style="position:absolute;top:0;bottom:0;left:{tp(editTime)}px;width:2px;pointer-events:none;z-index:10;">
					<div style="width:2px;height:100%;background:#ef4444;box-shadow:0 0 4px rgba(239,68,68,0.7);"></div>					
					<div
						tabindex="0"
						role="button"						
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
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							onclick={(e) => handleTrackClick(e, track)}
							style="position:absolute;top:{RULER_H + i * TRACK_H}px;left:0;width:100%;height:{TRACK_H}px;border-bottom:1px solid rgba(255,255,255,0.04);background:{i % 2 === 0 ? 'rgba(255,255,255,0.008)' : 'transparent'};"
						>
							{#each track.clips as clip (clip.id)}
								{@const cw = Math.max(4, tp(clip.endTime - clip.startTime))}

								{#if track.type === 'video'}
									{@const isActive = clip.id === activeClipId}
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										onmousedown={(e) => startVideoDrag(e, track, clip)}
										ontouchstart={(e) => startVideoDrag(e, track, clip)}
										onclick={(e) => e.stopPropagation()}
										oncontextmenu={(e) => { e.preventDefault(); openCtxMenu(e, track, clip); }}
										style="position:absolute;top:5px;left:{tp(clip.startTime)}px;width:{cw}px;height:{TRACK_H-10}px;background:{track.color};border:2px solid {isActive ? 'rgba(250,204,21,1)' : 'rgba(107,114,128,0.5)'};border-radius:3px;cursor:move;overflow:hidden;user-select:none;{isActive ? 'box-shadow:0 0 0 1px rgba(250,204,21,0.4),0 0 8px rgba(250,204,21,0.25);' : ''}"
									>
										<!-- Left resize handle -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div onmousedown={(e) => startVideoResizeStart(e, track, clip)} ontouchstart={(e) => startVideoResizeStart(e, track, clip)} style="position:absolute;left:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
										{#if (clip.fadeIn ?? 0) > 0}
											<div style="position:absolute;left:0;top:0;bottom:0;width:{Math.min(tp(clip.fadeIn ?? 0), cw * 0.5)}px;background:linear-gradient(to right,rgba(0,0,0,0.65),transparent);pointer-events:none;z-index:1;"></div>
										{/if}
										{#if (clip.fadeOut ?? 0) > 0}
											<div style="position:absolute;right:0;top:0;bottom:0;width:{Math.min(tp(clip.fadeOut ?? 0), cw * 0.5)}px;background:linear-gradient(to left,rgba(0,0,0,0.65),transparent);pointer-events:none;z-index:1;"></div>
										{/if}
										{#if cw > 50}
											<div style="padding:2px 12px;pointer-events:none;position:relative;z-index:0;">
												<div style="font-size:9px;font-weight:600;color:rgba(209,213,219,0.9);white-space:nowrap;">🎬 {fmt(clip.endTime - clip.startTime)}</div>
												{#if cw > 100}
													<div style="font-size:8px;color:rgba(255,255,255,0.5);white-space:nowrap;">{clip.startTime.toFixed(1)}s – {clip.endTime.toFixed(1)}s</div>
												{/if}
											</div>
										{/if}
										<!-- Right resize handle -->
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div onmousedown={(e) => startVideoResizeEnd(e, track, clip)} ontouchstart={(e) => startVideoResizeEnd(e, track, clip)} style="position:absolute;right:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
									</div>

								{:else if track.type === 'music'}
									{@const mFadeIn   = audioStudio.musicEntries[track.assetSessionId ?? '']?.fadeIn  ?? 0}
									{@const mFadeOut  = audioStudio.musicEntries[track.assetSessionId ?? '']?.fadeOut ?? 0}
									{@const isActive  = clip.id === activeClipId}
									<!-- svelte_ignore a11y_no_static_element_interactions -->
									<div
										onmousedown={(e) => startMusicDrag(e, track, clip)}
										ontouchstart={(e) => startMusicDrag(e, track, clip)}
										onclick={(e) => e.stopPropagation()}
										oncontextmenu={(e) => { e.preventDefault(); openCtxMenu(e, track, clip); }}
										style="position:absolute;top:5px;left:{tp(clip.startTime)}px;width:{cw}px;height:{TRACK_H-10}px;background:{track.color};border:2px solid {isActive ? 'rgba(250,204,21,1)' : 'rgba(147,51,234,0.85)'};border-radius:3px;cursor:move;overflow:hidden;user-select:none;{isActive ? 'box-shadow:0 0 0 1px rgba(250,204,21,0.4),0 0 8px rgba(250,204,21,0.25);' : ''}"
									>
										<!-- svelte-ignore a11y_no_static_element_interactions -->
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
										<!-- Duplicate button (only on focused clip, only when wide enough) -->
										{#if isActive && cw > 60}
											<button
												onclick={(e) => { e.stopPropagation(); duplicateMusicClip(track, clip); }}
												style="position:absolute;top:3px;right:14px;width:16px;height:16px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.25);border-radius:3px;font-size:10px;cursor:pointer;color:white;display:flex;align-items:center;justify-content:center;z-index:3;"
												title="Duplicate clip"
											>⧉</button>
										{/if}
										{#if mFadeOut > 0}
											<div style="position:absolute;right:0;top:0;bottom:0;width:{Math.min(tp(mFadeOut), cw * 0.5)}px;background:linear-gradient(to left,rgba(0,0,0,0.65),transparent);pointer-events:none;z-index:1;"></div>
										{/if}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div onmousedown={(e) => startMusicResizeEnd(e, track, clip)} ontouchstart={(e) => startMusicResizeEnd(e, track, clip)} style="position:absolute;right:0;top:0;bottom:0;width:10px;cursor:ew-resize;background:rgba(255,255,255,0.18);z-index:2;"></div>
									</div>

								{:else if track.type === 'sfx'}
									{@const inst = audioStudio.sfxInstances.find((s) => s.id === clip.id)}
									{#if inst}
										<!-- svelte-ignore a11y_no_static_element_interactions -->
										<div
											onmousedown={(e) => startSfxInteraction(e, inst, 'move')}
											ontouchstart={(e) => startSfxInteraction(e, inst, 'move')}
											style="position:absolute;top:5px;left:{tp(inst.startTime)}px;width:{Math.max(4, tp(inst.endTime - inst.startTime))}px;height:{TRACK_H-10}px;background:{track.color};border:1px solid rgba(37,99,235,0.85);border-radius:3px;cursor:move;overflow:hidden;user-select:none;"
										>
											<!-- svelte-ignore a11y_no_static_element_interactions-->
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
											<!-- svelte-ignore a11y_no_static_element_interactions -->
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

	<!-- CLIP CONTEXT MENU — portalled to body to escape backdrop-filter ──── -->
	{#if ctxMenu}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions-->
		<div use:portal onclick={closeCtxMenu} oncontextmenu={(e) => { e.preventDefault(); closeCtxMenu(); }} style="position:fixed;inset:0;z-index:9998;"></div>
		<div use:portal style="position:fixed;left:{Math.min(ctxMenu.x, window.innerWidth - 160)}px;top:{ctxMenu.y + CTX_MENU_H > window.innerHeight ? Math.max(8, ctxMenu.y - CTX_MENU_H) : ctxMenu.y}px;z-index:9999;background:rgba(10,15,30,0.97);border:1px solid rgba(255,255,255,0.13);border-radius:8px;padding:4px 0;min-width:150px;box-shadow:0 8px 32px rgba(0,0,0,0.6);">
			<div style="padding:4px 10px 6px;font-size:9px;font-weight:700;color:rgba(255,255,255,0.35);letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.07);margin-bottom:3px;">Clip: {ctxMenu.track.name}</div>
			<button onclick={ctxUndo}      disabled={!$editHistoryState.canUndo} style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:{$editHistoryState.canUndo ? 'rgba(209,213,219,1)' : 'rgba(107,114,128,0.5)'};font-size:11px;cursor:{$editHistoryState.canUndo ? 'pointer' : 'default'};text-align:left;" onmouseenter={(e)=>{ if($editHistoryState.canUndo) e.currentTarget.style.background='rgba(59,130,246,0.18)'; }} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">↶</span> Undo <span style="margin-left:auto;font-size:9px;color:rgba(107,114,128,0.8);">Ctrl+Z</span></button>
			<button onclick={ctxRedo}      disabled={!$editHistoryState.canRedo} style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:{$editHistoryState.canRedo ? 'rgba(209,213,219,1)' : 'rgba(107,114,128,0.5)'};font-size:11px;cursor:{$editHistoryState.canRedo ? 'pointer' : 'default'};text-align:left;" onmouseenter={(e)=>{ if($editHistoryState.canRedo) e.currentTarget.style.background='rgba(59,130,246,0.18)'; }} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">↷</span> Redo <span style="margin-left:auto;font-size:9px;color:rgba(107,114,128,0.8);">Ctrl+Y</span></button>
			<div style="border-top:1px solid rgba(255,255,255,0.07);margin:3px 0;"></div>
			<button onclick={ctxCopy}      style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:rgba(209,213,219,1);font-size:11px;cursor:pointer;text-align:left;" onmouseenter={(e)=>(e.currentTarget.style.background='rgba(59,130,246,0.18)')} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">📋</span> Copy</button>
			<button onclick={ctxPaste}     disabled={!clipboardClip} style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:{clipboardClip ? 'rgba(209,213,219,1)' : 'rgba(107,114,128,0.5)'};font-size:11px;cursor:{clipboardClip ? 'pointer' : 'default'};text-align:left;" onmouseenter={(e)=>{ if(clipboardClip) e.currentTarget.style.background='rgba(59,130,246,0.18)'; }} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">📌</span> Paste at cursor</button>
			<button onclick={ctxDuplicate} style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:rgba(209,213,219,1);font-size:11px;cursor:pointer;text-align:left;" onmouseenter={(e)=>(e.currentTarget.style.background='rgba(59,130,246,0.18)')} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">⧉</span> Duplicate</button>
			<div style="border-top:1px solid rgba(255,255,255,0.07);margin:3px 0;"></div>
			<button onclick={ctxDelete}    style="display:flex;align-items:center;gap:7px;width:100%;padding:6px 12px;background:none;border:none;color:rgba(239,68,68,1);font-size:11px;cursor:pointer;text-align:left;" onmouseenter={(e)=>(e.currentTarget.style.background='rgba(239,68,68,0.15)')} onmouseleave={(e)=>(e.currentTarget.style.background='none')}><span style="font-size:13px;">🗑</span> Delete clip</button>
		</div>
	{/if}

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
