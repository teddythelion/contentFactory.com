<!-- src/lib/components/ThreeJsEnhancer/TimelineEditor.svelte -->
<!-- Visual timeline editor for precise audio/SFX positioning -->

<script lang="ts">
	import { audioStudioStore, type SfxInstance } from '$lib/stores/audioStudio.store';
	import { videoState } from '$lib/stores/video.store';

	// Props
	interface Props {
		videoElement?: HTMLVideoElement | null;
	}
	let { videoElement = null }: Props = $props();

	// Derived state from stores (single source of truth)
	let audioStudio = $derived($audioStudioStore);
	let videoDuration = $derived($videoState.videoDuration || 30);
	let currentTime = $derived($videoState.currentTime || 0);
	let isPlaying = $derived($videoState.isPlaying);

	// Update videoState when video element events fire
	$effect(() => {
		if (!videoElement) return;
		
		const handlePlay = () => { videoState.setIsPlaying(true); };
		const handlePause = () => { videoState.setIsPlaying(false); };
		const handleTimeUpdate = () => { videoState.setCurrentTime(videoElement.currentTime); };
		
		videoElement.addEventListener('play', handlePlay);
		videoElement.addEventListener('pause', handlePause);
		videoElement.addEventListener('timeupdate', handleTimeUpdate);
		
		// Initialize state from video element
		videoState.setCurrentTime(videoElement.currentTime);
		videoState.setIsPlaying(!videoElement.paused);
		
		return () => {
			videoElement.removeEventListener('play', handlePlay);
			videoElement.removeEventListener('pause', handlePause);
			videoElement.removeEventListener('timeupdate', handleTimeUpdate);
		};
	});

	// Timeline dimensions - extend to fit all audio
	const PIXELS_PER_SECOND = 80; // Zoom level
	const TRACK_HEIGHT = 60;
	let sfxMaxEnd = $derived(
		audioStudio.sfxInstances.length > 0
			? Math.max(...audioStudio.sfxInstances.map((i) => i.endTime))
			: 0
	);
	let timelineWidth = $derived(
		Math.max(videoDuration, audioStudio.musicEndTime || 0, sfxMaxEnd, 10) * PIXELS_PER_SECOND
	);
	let containerWidth = $state(0);
	let scrollContainer: HTMLDivElement;

	// Dragging state
	let draggingMusic = $state(false);
	let resizingMusicStart = $state(false);
	let resizingMusicEnd = $state(false);
	let dragStartX = $state(0);
	let dragStartValue = $state(0);
	let dragStartTrim = $state(0);

	// Convert time to pixels
	function timeToPixels(time: number): number {
		return time * PIXELS_PER_SECOND;
	}

	// Convert pixels to time
	function pixelsToTime(pixels: number): number {
		return Math.max(0, Math.min(videoDuration, pixels / PIXELS_PER_SECOND));
	}

	// Music block position/size
	let musicLeft = $derived(timeToPixels(audioStudio.musicStartTime));
	let musicWidth = $derived(timeToPixels(audioStudio.musicEndTime - audioStudio.musicStartTime));

	// SFX instances — computed per block
	function sfxInstanceLeft(inst: SfxInstance) { return timeToPixels(inst.startTime); }
	function sfxInstanceWidth(inst: SfxInstance) { return timeToPixels(inst.endTime - inst.startTime); }

	// Playhead position
	let playheadLeft = $derived(timeToPixels(currentTime));

	// ── MUSIC DRAGGING ──────────────────────────────────────────
	function startDragMusic(e: MouseEvent) {
		draggingMusic = true;
		dragStartX = e.clientX;
		dragStartValue = audioStudio.musicStartTime;
		document.addEventListener('mousemove', handleDragMusic);
		document.addEventListener('mouseup', stopDragMusic);
		e.preventDefault();
	}

	function handleDragMusic(e: MouseEvent) {
		if (!draggingMusic) return;
		const deltaX = e.clientX - dragStartX;
		const deltaTime = deltaX / PIXELS_PER_SECOND;
		const duration = audioStudio.musicEndTime - audioStudio.musicStartTime;
		// Allow positioning beyond video duration if music is longer
		const maxStart = Math.max(videoDuration, audioStudio.musicEndTime) + 30;
		const newStart = Math.max(0, Math.min(maxStart - duration, dragStartValue + deltaTime));
		audioStudioStore.setMusicStartTime(newStart);
		audioStudioStore.setMusicEndTime(newStart + duration);
	}

	function stopDragMusic() {
		draggingMusic = false;
		document.removeEventListener('mousemove', handleDragMusic);
		document.removeEventListener('mouseup', stopDragMusic);
	}

	// ── MUSIC RESIZE (START) ────────────────────────────────────
	function startResizeMusicStart(e: MouseEvent) {
		resizingMusicStart = true;
		dragStartX = e.clientX;
		dragStartValue = audioStudio.musicStartTime;
		dragStartTrim = audioStudio.musicTrimStart;
		document.addEventListener('mousemove', handleResizeMusicStart);
		document.addEventListener('mouseup', stopResizeMusicStart);
		e.stopPropagation();
		e.preventDefault();
	}

	function handleResizeMusicStart(e: MouseEvent) {
		if (!resizingMusicStart) return;
		const deltaX = e.clientX - dragStartX;
		const deltaTime = deltaX / PIXELS_PER_SECOND;
		const newStart = Math.max(0, Math.min(audioStudio.musicEndTime - 0.5, dragStartValue + deltaTime));
		// Trim tracks the same delta from its own origin — never accumulates per-move
		const newTrim = Math.max(0, dragStartTrim + (newStart - dragStartValue));
		audioStudioStore.setMusicStartTime(newStart);
		audioStudioStore.setMusicTrimStart(newTrim);
	}

	function stopResizeMusicStart() {
		resizingMusicStart = false;
		document.removeEventListener('mousemove', handleResizeMusicStart);
		document.removeEventListener('mouseup', stopResizeMusicStart);
	}

	// ── MUSIC RESIZE (END) ──────────────────────────────────────
	function startResizeMusicEnd(e: MouseEvent) {
		resizingMusicEnd = true;
		dragStartX = e.clientX;
		dragStartValue = audioStudio.musicEndTime;
		document.addEventListener('mousemove', handleResizeMusicEnd);
		document.addEventListener('mouseup', stopResizeMusicEnd);
		e.stopPropagation();
		e.preventDefault();
	}

	function handleResizeMusicEnd(e: MouseEvent) {
		if (!resizingMusicEnd) return;
		const deltaX = e.clientX - dragStartX;
		const deltaTime = deltaX / PIXELS_PER_SECOND;
		// Allow extending beyond video duration
		const maxEnd = Math.max(videoDuration + 60, audioStudio.musicEndTime + 10);
		const newEnd = Math.max(audioStudio.musicStartTime + 0.5, Math.min(maxEnd, dragStartValue + deltaTime));
		audioStudioStore.setMusicEndTime(newEnd);
	}

	function stopResizeMusicEnd() {
		resizingMusicEnd = false;
		document.removeEventListener('mousemove', handleResizeMusicEnd);
		document.removeEventListener('mouseup', stopResizeMusicEnd);
	}

	// ── SFX INSTANCE DRAG/RESIZE ────────────────────────────────
	let activeSfxId: string | null = null;
	let sfxDragMode: 'move' | 'resizeStart' | 'resizeEnd' | null = null;
	let sfxDragStartX = 0;
	let sfxDragStartValue = 0; // startTime at mousedown
	let sfxDragEndValue = 0;   // endTime at mousedown

	function startSfxInteraction(e: MouseEvent, inst: SfxInstance, mode: 'move' | 'resizeStart' | 'resizeEnd') {
		activeSfxId = inst.id;
		sfxDragMode = mode;
		sfxDragStartX = e.clientX;
		sfxDragStartValue = inst.startTime;
		sfxDragEndValue = inst.endTime;
		document.addEventListener('mousemove', handleSfxMove);
		document.addEventListener('mouseup', stopSfxInteraction);
		e.stopPropagation();
		e.preventDefault();
	}

	function handleSfxMove(e: MouseEvent) {
		if (!activeSfxId || !sfxDragMode) return;
		const inst = audioStudio.sfxInstances.find((i) => i.id === activeSfxId);
		if (!inst) return;
		const delta = (e.clientX - sfxDragStartX) / PIXELS_PER_SECOND;
		const duration = sfxDragEndValue - sfxDragStartValue;

		if (sfxDragMode === 'move') {
			const newStart = Math.max(0, sfxDragStartValue + delta);
			audioStudioStore.updateSfxInstance(activeSfxId, newStart, newStart + duration);
		} else if (sfxDragMode === 'resizeStart') {
			const newStart = Math.max(0, Math.min(sfxDragEndValue - 0.1, sfxDragStartValue + delta));
			audioStudioStore.updateSfxInstance(activeSfxId, newStart, sfxDragEndValue);
		} else if (sfxDragMode === 'resizeEnd') {
			const newEnd = Math.max(sfxDragStartValue + 0.1, sfxDragEndValue + delta);
			audioStudioStore.updateSfxInstance(activeSfxId, sfxDragStartValue, newEnd);
		}
	}

	function stopSfxInteraction() {
		activeSfxId = null;
		sfxDragMode = null;
		document.removeEventListener('mousemove', handleSfxMove);
		document.removeEventListener('mouseup', stopSfxInteraction);
	}

	// ── TIMELINE CLICK (jump to position) ──────────────────────
	function handleTimelineClick(e: MouseEvent) {
		if (!scrollContainer || !videoElement) return;
		const rect = scrollContainer.getBoundingClientRect();
		const clickX = e.clientX - rect.left + scrollContainer.scrollLeft;
		const clickTime = pixelsToTime(clickX);
		seekTo(clickTime);
	}

	// Seek video to specific time
	function seekTo(time: number) {
		if (!videoElement) return;
		videoElement.currentTime = Math.max(0, Math.min(videoDuration, time));
	}

	// Toggle play/pause
	function togglePlayPause() {
		if (!videoElement) return;
		if (videoElement.paused) {
			videoElement.play();
		} else {
			videoElement.pause();
		}
	}

	// Drive music playback from the playhead position.
	$effect(() => {
		if (!audioStudio.musicSessionId) return;
		const _start = audioStudio.musicStartTime;
		const _end   = audioStudio.musicEndTime;
		const _trim  = audioStudio.musicTrimStart;
		void _start; void _end; void _trim;
		audioStudioStore.syncMusicToVideo(currentTime, isPlaying);
	});

	// Drive SFX playback from the playhead position.
	$effect(() => {
		if (!audioStudio.sfxSessionId) return;
		const _instances = audioStudio.sfxInstances; // reactive dep
		void _instances;
		audioStudioStore.syncSfxToVideo(currentTime, isPlaying);
	});

	// Generate time markers
	function getTimeMarkers(): number[] {
		const maxTime = Math.max(videoDuration, audioStudio.musicEndTime || 0, sfxMaxEnd);
		const markers: number[] = [];
		const interval = maxTime > 60 ? 10 : maxTime > 30 ? 5 : 1;
		for (let i = 0; i <= maxTime; i += interval) {
			markers.push(i);
		}
		return markers;
	}

	// Format time display
	function formatTime(seconds: number): string {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}
</script>

<div class="timeline-editor">
	<!-- Header with play/pause controls -->
	<div class="timeline-header">
		<div class="timeline-header-left">
			<h3 class="text-sm font-semibold text-white">🎵 Audio Timeline</h3>
			<p class="text-xs text-gray-400">Drag blocks • Resize edges • Click to seek</p>
		</div>
		<div class="timeline-controls-row">
			<span class="time-display">{formatTime(currentTime)} / {formatTime(videoDuration)}</span>
			<button 
				onclick={togglePlayPause}
				disabled={!videoElement}
				class="play-pause-btn"
				title={isPlaying ? 'Pause' : 'Play'}
			>
				{#if isPlaying}
					<!-- Pause icon -->
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
						<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
					</svg>
				{:else}
					<!-- Play icon -->
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
						<path d="M8 5v14l11-7z"/>
					</svg>
				{/if}
			</button>
		</div>
	</div>

	<!-- Scrollable timeline container -->
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div 
		bind:this={scrollContainer} 
		bind:clientWidth={containerWidth} 
		class="timeline-scroll"
		onclick={handleTimelineClick}
	>
		<div class="timeline-canvas" style="width: {timelineWidth}px;">
			
			<!-- Time ruler -->
			<div class="time-ruler">
				{#each getTimeMarkers() as time (time)}
					<div class="time-marker" style="left: {timeToPixels(time)}px;">
						<div class="time-tick"></div>
						<span class="time-label">{formatTime(time)}</span>
					</div>
				{/each}
				
				<!-- Video duration marker -->
				<div class="video-end-marker" style="left: {timeToPixels(videoDuration)}px;" title="Video ends here">
					<div class="video-end-line"></div>
					<span class="video-end-label">Video End</span>
				</div>
			</div>

			<!-- Playhead - always visible, shows current position -->
			<div class="playhead" style="left: {playheadLeft}px;">
				<div class="playhead-line"></div>
				<div class="playhead-handle"></div>
				<div class="playhead-time">{formatTime(currentTime)}</div>
			</div>

			<!-- Music Track -->
			<div class="track music-track" style="height: {TRACK_HEIGHT}px;">
				<div class="track-label">🎵 Music</div>
				{#if audioStudio.musicSessionId}
					<div
						class="audio-block music-block"
						style="left: {musicLeft}px; width: {musicWidth}px;"
						onmousedown={startDragMusic}
					>
						<!-- Resize handle (start) -->
						<div class="resize-handle resize-start" onmousedown={startResizeMusicStart}></div>

						<!-- Fade-in overlay: darkens the left edge to show crescendo ramp -->
						{#if audioStudio.musicFadeIn > 0}
							<div
								class="fade-overlay fade-in-overlay"
								style="width: {Math.min(timeToPixels(audioStudio.musicFadeIn), musicWidth * 0.5)}px;"
							></div>
						{/if}

						<!-- Fade-out overlay: darkens the right edge to show decrescendo ramp -->
						{#if audioStudio.musicFadeOut > 0}
							<div
								class="fade-overlay fade-out-overlay"
								style="width: {Math.min(timeToPixels(audioStudio.musicFadeOut), musicWidth * 0.5)}px;"
							></div>
						{/if}

						<!-- Block content -->
						<div class="block-content">
							<div class="block-title">Music</div>
							<div class="block-times">
								{audioStudio.musicStartTime.toFixed(1)}s – {audioStudio.musicEndTime.toFixed(1)}s
							</div>
						</div>

						<!-- Resize handle (end) -->
						<div class="resize-handle resize-end" onmousedown={startResizeMusicEnd}></div>
					</div>
				{:else}
					<div class="track-placeholder">Generate music to see it here</div>
				{/if}
			</div>

			<!-- SFX Track -->
			<div class="track sfx-track" style="height: {TRACK_HEIGHT}px;">
				<div class="track-label">🔊 SFX</div>
				{#if audioStudio.sfxSessionId}
					{#each audioStudio.sfxInstances as inst (inst.id)}
						<div
							class="audio-block sfx-block"
							style="left: {sfxInstanceLeft(inst)}px; width: {sfxInstanceWidth(inst)}px;"
							onmousedown={(e) => startSfxInteraction(e, inst, 'move')}
						>
							<div class="resize-handle resize-start" onmousedown={(e) => startSfxInteraction(e, inst, 'resizeStart')}></div>

							<div class="block-content">
								<div class="block-title">SFX</div>
								<div class="block-times">{inst.startTime.toFixed(1)}s – {inst.endTime.toFixed(1)}s</div>
							</div>

							<div class="resize-handle resize-end" onmousedown={(e) => startSfxInteraction(e, inst, 'resizeEnd')}></div>

							<div class="block-actions">
								<button onclick={() => audioStudioStore.duplicateSfxInstance(inst.id)} class="block-action-btn" title="Duplicate">➕</button>
								<button onclick={() => audioStudioStore.removeSfxInstance(inst.id)} class="block-action-btn" title="Remove">✕</button>
							</div>
						</div>
					{/each}
				{:else}
					<div class="track-placeholder">Generate or upload SFX to see it here</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- Fine-tune controls -->
	<div class="timeline-controls">
		<div class="control-group">
			<label class="control-label">Music Start</label>
			<input 
				type="number" 
				min="0" 
				max={Math.max(videoDuration, audioStudio.musicEndTime + 10)} 
				step="0.1"
				value={audioStudio.musicStartTime}
				oninput={(e) => audioStudioStore.setMusicStartTime(parseFloat(e.currentTarget.value))}
				class="control-input"
			/>
		</div>
		<div class="control-group">
			<label class="control-label">Music End</label>
			<input 
				type="number" 
				min="0" 
				max={Math.max(videoDuration + 30, audioStudio.musicEndTime + 10)} 
				step="0.1"
				value={audioStudio.musicEndTime}
				oninput={(e) => audioStudioStore.setMusicEndTime(parseFloat(e.currentTarget.value))}
				class="control-input"
			/>
		</div>
	</div>
</div>

<style>
	.timeline-editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
		background: rgba(17, 24, 39, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 8px;
	}

	.timeline-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.timeline-header-left {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.timeline-controls-row {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.time-display {
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.play-pause-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(59, 130, 246, 0.8);
		border: 1px solid rgba(59, 130, 246, 1);
		color: white;
		cursor: pointer;
		transition: all 0.2s;
	}

	.play-pause-btn:hover:not(:disabled) {
		background: rgba(59, 130, 246, 1);
		box-shadow: 0 0 12px rgba(59, 130, 246, 0.5);
	}

	.play-pause-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.timeline-scroll {
		overflow-x: auto;
		overflow-y: hidden;
		background: #1a1a1a;
		border-radius: 4px;
		padding: 8px 0;
	}

	.timeline-canvas {
		position: relative;
		min-height: 180px;
	}

	/* Time Ruler */
	.time-ruler {
		position: relative;
		height: 24px;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		margin-bottom: 8px;
	}

	.time-marker {
		position: absolute;
		top: 0;
	}

	.time-tick {
		width: 1px;
		height: 8px;
		background: rgba(255, 255, 255, 0.3);
	}

	.time-label {
		position: absolute;
		top: 10px;
		left: 4px;
		font-size: 10px;
		color: rgba(255, 255, 255, 0.5);
		white-space: nowrap;
	}

	/* Video End Marker */
	.video-end-marker {
		position: absolute;
		top: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 5;
	}

	.video-end-line {
		width: 2px;
		height: 100%;
		background: rgba(251, 191, 36, 0.6);
		box-shadow: 0 0 4px rgba(251, 191, 36, 0.4);
	}

	.video-end-label {
		position: absolute;
		top: -2px;
		left: 4px;
		font-size: 9px;
		font-weight: 700;
		color: rgba(251, 191, 36, 0.9);
		background: rgba(0, 0, 0, 0.7);
		padding: 2px 4px;
		border-radius: 2px;
		white-space: nowrap;
	}

	/* Playhead */
	.playhead {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		pointer-events: none;
		z-index: 10;
	}

	.playhead-line {
		width: 2px;
		height: 100%;
		background: #ef4444;
		box-shadow: 0 0 4px rgba(239, 68, 68, 0.8);
	}

	.playhead-handle {
		position: absolute;
		top: 0;
		left: -4px;
		width: 10px;
		height: 10px;
		background: #ef4444;
		border-radius: 50%;
	}

	.playhead-time {
		position: absolute;
		top: 12px;
		left: 6px;
		font-size: 9px;
		font-weight: 700;
		color: #ef4444;
		background: rgba(0, 0, 0, 0.8);
		padding: 2px 4px;
		border-radius: 2px;
		white-space: nowrap;
	}

	/* Tracks */
	.track {
		position: relative;
		margin-bottom: 8px;
		background: rgba(255, 255, 255, 0.03);
		border-radius: 4px;
		border: 1px solid rgba(255, 255, 255, 0.05);
	}

	.track-label {
		position: absolute;
		left: 8px;
		top: 50%;
		transform: translateY(-50%);
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.4);
		pointer-events: none;
		z-index: 1;
	}

	.track-placeholder {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		font-size: 11px;
		color: rgba(255, 255, 255, 0.3);
		font-style: italic;
	}

	/* Audio Blocks */
	.audio-block {
		position: absolute;
		top: 8px;
		height: calc(100% - 16px);
		border-radius: 4px;
		cursor: move;
		user-select: none;
		overflow: hidden;
		transition: box-shadow 0.2s;
	}

	.audio-block:hover {
		box-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
	}

	.music-block {
		background: linear-gradient(135deg, rgba(147, 51, 234, 0.6), rgba(126, 34, 206, 0.6));
		border: 2px solid rgba(147, 51, 234, 0.8);
	}

	.sfx-block {
		background: linear-gradient(135deg, rgba(37, 99, 235, 0.6), rgba(29, 78, 216, 0.6));
		border: 2px solid rgba(37, 99, 235, 0.8);
	}

	.block-content {
		padding: 8px;
		pointer-events: none;
	}

	.block-title {
		font-size: 11px;
		font-weight: 700;
		color: white;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
	}

	.block-times {
		font-size: 9px;
		color: rgba(255, 255, 255, 0.8);
		margin-top: 2px;
	}

	/* Fade overlays — show crescendo/decrescendo shape on music block ends */
	.fade-overlay {
		position: absolute;
		top: 0;
		bottom: 0;
		pointer-events: none;
		z-index: 2;
	}

	.fade-in-overlay {
		left: 0;
		background: linear-gradient(to right, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%);
	}

	.fade-out-overlay {
		right: 0;
		background: linear-gradient(to left, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.3) 60%, transparent 100%);
	}

	/* Resize Handles */
	.resize-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: ew-resize;
		background: rgba(255, 255, 255, 0.2);
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 3;
	}

	.audio-block:hover .resize-handle {
		opacity: 1;
	}

	.resize-start {
		left: 0;
		border-top-left-radius: 4px;
		border-bottom-left-radius: 4px;
	}

	.resize-end {
		right: 0;
		border-top-right-radius: 4px;
		border-bottom-right-radius: 4px;
	}

	/* Block Actions */
	.block-actions {
		position: absolute;
		top: 4px;
		right: 4px;
		display: flex;
		gap: 4px;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.audio-block:hover .block-actions {
		opacity: 1;
	}

	.block-action-btn {
		width: 20px;
		height: 20px;
		background: rgba(0, 0, 0, 0.6);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 3px;
		font-size: 12px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.block-action-btn:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	/* Fine-tune Controls */
	.timeline-controls {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 8px;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.control-label {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.7);
	}

	.control-input {
		padding: 6px 8px;
		background: rgba(31, 41, 55, 0.8);
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 4px;
		color: white;
		font-size: 12px;
		outline: none;
		transition: border-color 0.2s;
	}

	.control-input:focus {
		border-color: rgba(59, 130, 246, 0.5);
	}

	/* Scrollbar */
	.timeline-scroll::-webkit-scrollbar {
		height: 8px;
	}

	.timeline-scroll::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}

	.timeline-scroll::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}

	.timeline-scroll::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
</style>