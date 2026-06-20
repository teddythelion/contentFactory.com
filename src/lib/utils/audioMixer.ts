// src/lib/utils/audioMixer.ts
// Web Audio mixer powered by Tone.js
// Same public API as before — drop-in replacement, nothing else changes.

import * as Tone from 'tone';

interface MixerState {
	originalVolume: number;
	originalMuted: boolean;
	sfxVolume: number;
	sfxStartTime: number;
	sfxEndTime: number;
	sfxFadeIn: number;
	sfxFadeOut: number;
	sfxLoop: boolean;
}

// Per-music-track state passed in from the store on each sync
export interface MusicTrackState {
	sessionId: string;
	volume: number;
	startTime: number;
	endTime: number;
	trimStart: number;
	fadeIn: number;
	fadeOut: number;
}

// Internal per-player object
interface MusicTrackEntry {
	player: Tone.Player;
	rawGain: GainNode;
	stopTimeout: ReturnType<typeof setTimeout> | null;
	isPlaying: boolean;
	lastVideoTime: number;
	lastStartTime: number;
	lastEndTime: number;
	lastTrimStart: number;
}

class AudioMixer {
	// Original video audio
	private videoMediaSource: MediaElementAudioSourceNode | null = null;
	private videoGain: Tone.Volume | null = null;

	// SFX
	private sfxPlayer: Tone.Player | null = null;
	private sfxGain: Tone.Volume | null = null;
	private sfxLoopTimeout: ReturnType<typeof setTimeout> | null = null;

	// Music — one player per session, all play simultaneously
	private musicTracks: Map<string, MusicTrackEntry> = new Map();

	private originalFadeIn: number = 0;
	private originalFadeOut: number = 0;

	private state: MixerState = {
		originalVolume: 1,
		originalMuted: false,
		sfxVolume: 0.4,
		sfxStartTime: 0,
		sfxEndTime: 8,
		sfxFadeIn: 0,
		sfxFadeOut: 0,
		sfxLoop: false
	};

	// ── Helpers ─────────────────────────────────────────────────────────────
	private toDb(linear: number): number {
		if (linear <= 0) return -Infinity;
		return 20 * Math.log10(linear);
	}

	private async ensureStarted() {
		if (Tone.getContext().state !== 'running') {
			await Tone.start();
		}
	}

	// Clear any pending loop/stop timers
	private clearSfxTimer() {
		if (this.sfxLoopTimeout) {
			clearTimeout(this.sfxLoopTimeout);
			this.sfxLoopTimeout = null;
		}
	}

	// (music timers are now per-entry in MusicTrackEntry.stopTimeout)

	// ── Video connection ─────────────────────────────────────────────────────
	connectVideo(videoElement: HTMLVideoElement) {
		if (this.videoMediaSource) {
			this.applyOriginalGain();
			return;
		}

		this.ensureStarted();

		const ctx = Tone.getContext().rawContext as AudioContext;
		const gainNode = ctx.createGain();
		gainNode.gain.value = this.state.originalMuted ? 0 : this.state.originalVolume;
		gainNode.connect(ctx.destination);

		this.videoMediaSource = ctx.createMediaElementSource(videoElement);
		this.videoMediaSource.connect(gainNode);

		(this as any)._rawVideoGain = gainNode;

		console.log('🎙️ AudioMixer: video connected via raw Web Audio');
	}

	disconnectVideo() {
		if (this.videoMediaSource) {
			this.videoMediaSource.disconnect();
			this.videoMediaSource = null;
		}
		const gainNode = (this as any)._rawVideoGain as GainNode | null;
		if (gainNode) {
			gainNode.disconnect();
			(this as any)._rawVideoGain = null;
		}
		if (this.videoGain) {
			this.videoGain.dispose();
			this.videoGain = null;
		}
	}

	// ── Original audio ───────────────────────────────────────────────────────
	setOriginalVolume(volume: number) {
		this.state.originalVolume = volume;
		this.applyOriginalGain();
	}

	setOriginalMuted(muted: boolean) {
		this.state.originalMuted = muted;
		this.applyOriginalGain();
	}

	private applyOriginalGain() {
		const gainNode = (this as any)._rawVideoGain as GainNode | null;
		if (!gainNode) return;
		const ctx = Tone.getContext().rawContext as AudioContext;
		const targetGain = this.state.originalMuted ? 0 : this.state.originalVolume;
		gainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.05);
	}

	setOriginalFadeIn(v: number) { this.originalFadeIn = v; }
	setOriginalFadeOut(v: number) { this.originalFadeOut = v; }

	// Called each animation frame — smoothly tracks gain based on fade progress
	syncOriginalFadeToVideo(videoTime: number, duration: number) {
		const gainNode = (this as any)._rawVideoGain as GainNode | null;
		if (!gainNode || this.state.originalMuted) return;
		const ctx = Tone.getContext().rawContext as AudioContext;
		const baseGain = this.state.originalVolume;
		let targetGain = baseGain;
		if (this.originalFadeIn > 0 && videoTime < this.originalFadeIn) {
			targetGain = baseGain * (videoTime / this.originalFadeIn);
		}
		if (this.originalFadeOut > 0 && duration > 0 && videoTime > duration - this.originalFadeOut) {
			const remaining = duration - videoTime;
			targetGain = Math.min(targetGain, baseGain * (remaining / this.originalFadeOut));
		}
		gainNode.gain.setTargetAtTime(Math.max(0, targetGain), ctx.currentTime, 0.02);
	}

	// ── SFX ──────────────────────────────────────────────────────────────────
	private sfxPlayingInstanceId: string | null = null;

	async loadSfx(previewUrl: string, onLoaded?: (durationSeconds: number) => void) {
		await this.ensureStarted();
		this.stopSfx();

		const s = this.state;
		this.sfxGain = new Tone.Volume(this.toDb(s.sfxVolume)).toDestination();

		this.sfxPlayer = new Tone.Player({
			url: previewUrl,
			loop: false,
			onload: () => {
				const dur = this.sfxPlayer!.buffer.duration;
				console.log(`🔊 AudioMixer: SFX loaded (${dur.toFixed(2)}s)`);
				onLoaded?.(dur);
			}
		}).connect(this.sfxGain);
	}

	// Play SFX from a specific buffer offset for a given duration
	private _playSfxFrom(bufferOffset: number, duration: number) {
		if (!this.sfxPlayer?.loaded || !this.sfxGain) return;
		this.clearSfxTimer();

		const s = this.state;
		const bufferDuration = this.sfxPlayer.buffer.duration;
		const clampedOffset = Math.min(bufferOffset, bufferDuration);
		const playDuration = Math.min(duration, bufferDuration - clampedOffset);
		if (playDuration <= 0) return;

		try { this.sfxPlayer.stop(); } catch { /* already stopped */ }

		this.sfxPlayer.fadeIn = 0;
		this.sfxPlayer.fadeOut = 0;
		this.sfxPlayer.start(Tone.now(), clampedOffset, playDuration);

		// Schedule fade out via gain
		if (s.sfxFadeOut > 0) {
			const now = Tone.now();
			const fadeStart = now + Math.max(0, playDuration - s.sfxFadeOut);
			if (fadeStart > now) {
				this.sfxGain.volume.setValueAtTime(this.toDb(s.sfxVolume), fadeStart);
				this.sfxGain.volume.linearRampToValueAtTime(-96, fadeStart + s.sfxFadeOut);
			}
		}

		this.sfxLoopTimeout = setTimeout(() => {
			this.sfxPlayingInstanceId = null;
		}, playDuration * 1000 + 100);
	}

	// Playhead-driven SFX sync — mirrors syncMusicToVideo logic
	syncSfxToVideo(videoTime: number, isPlaying: boolean, instances: Array<{id: string; startTime: number; endTime: number}>) {
		if (!this.sfxPlayer?.loaded) return;

		const active = instances.find(
			(inst) => videoTime >= inst.startTime && videoTime < inst.endTime
		);

		if (active && isPlaying) {
			if (this.sfxPlayingInstanceId !== active.id) {
				this.sfxPlayingInstanceId = active.id;
				const bufferOffset = videoTime - active.startTime;
				const remaining = active.endTime - videoTime;
				this._playSfxFrom(bufferOffset, remaining);
				console.log(`🔊 SFX instance ${active.id} — offset:${bufferOffset.toFixed(2)}s remaining:${remaining.toFixed(2)}s`);
			}
		} else {
			if (this.sfxPlayingInstanceId !== null) {
				this.sfxPlayingInstanceId = null;
				try { this.sfxPlayer?.stop(); } catch { /* already stopped */ }
				this.clearSfxTimer();
			}
		}
	}

	stopSfx() {
		this.clearSfxTimer();
		this.sfxPlayingInstanceId = null;
		if (this.sfxPlayer) {
			try { this.sfxPlayer.stop(); } catch { /* already stopped */ }
			this.sfxPlayer.dispose();
			this.sfxPlayer = null;
		}
		if (this.sfxGain) {
			this.sfxGain.dispose();
			this.sfxGain = null;
		}
	}

	setSfxVolume(volume: number) {
		this.state.sfxVolume = volume;
		if (this.sfxGain) this.sfxGain.volume.rampTo(this.toDb(volume), 0.05);
	}

	setSfxLoop(loop: boolean) {
		this.state.sfxLoop = loop;
		// State update only — syncSfxToVideo picks up the change on the next video tick
	}

	setSfxFadeIn(v: number) {
		this.state.sfxFadeIn = v;
	}

	setSfxFadeOut(v: number) {
		this.state.sfxFadeOut = v;
	}


	// ── MUSIC (multi-track) ──────────────────────────────────────────────────
	async loadMusic(sessionId: string, previewUrl: string, onLoaded?: (durationSeconds: number) => void) {
		await this.ensureStarted();
		this.stopMusic(sessionId);

		const ctx = Tone.getContext().rawContext as AudioContext;
		const rawGain = ctx.createGain();
		rawGain.gain.value = 0.3;
		rawGain.connect(ctx.destination);

		const player = new Tone.Player({ url: previewUrl, loop: false });
		(player as any).connect(rawGain);

		const entry: MusicTrackEntry = {
			player, rawGain,
			stopTimeout: null,
			isPlaying: false,
			lastVideoTime: -1,
			lastStartTime: -1,
			lastEndTime: -1,
			lastTrimStart: -1
		};

		player.load(previewUrl).then(() => {
			const dur = player.buffer.duration;
			console.log(`🎵 Music [${sessionId.slice(0,6)}] loaded (${dur.toFixed(2)}s)`);
			onLoaded?.(dur);
		}).catch(() => {
			const dur = player.buffer?.duration ?? 0;
			if (dur > 0) onLoaded?.(dur);
		});

		this.musicTracks.set(sessionId, entry);
	}

	syncMusicToVideo(videoTime: number, isVideoPlaying: boolean, trackStates: MusicTrackState[]) {
		for (const ts of trackStates) {
			const entry = this.musicTracks.get(ts.sessionId);
			if (!entry?.player.loaded) continue;
			this._syncOneTrack(entry, ts, videoTime, isVideoPlaying);
		}
	}

	private _syncOneTrack(entry: MusicTrackEntry, ts: MusicTrackState, videoTime: number, isVideoPlaying: boolean) {
		const inRange    = videoTime >= ts.startTime && videoTime < ts.endTime;
		const shouldPlay = isVideoPlaying && inRange;

		const isSeeked  = entry.lastVideoTime >= 0 && Math.abs(videoTime - entry.lastVideoTime) > 0.35;
		entry.lastVideoTime = videoTime;

		const barMoved =
			ts.startTime !== entry.lastStartTime ||
			ts.endTime   !== entry.lastEndTime   ||
			ts.trimStart !== entry.lastTrimStart;
		entry.lastStartTime = ts.startTime;
		entry.lastEndTime   = ts.endTime;
		entry.lastTrimStart = ts.trimStart;

		if (shouldPlay) {
			if (!entry.isPlaying || isSeeked || barMoved) {
				const bufferOffset = ts.trimStart + Math.max(0, videoTime - ts.startTime);
				this._startTrackFrom(entry, ts, bufferOffset, ts.endTime - videoTime);
			} else {
				const ctx = Tone.getContext().rawContext as AudioContext;
				entry.rawGain.gain.setTargetAtTime(ts.volume, ctx.currentTime, 0.05);
			}
		} else if (entry.isPlaying) {
			this._haltTrack(entry);
		}
	}

	private _startTrackFrom(entry: MusicTrackEntry, ts: MusicTrackState, bufferOffset: number, duration: number) {
		if (!entry.player.loaded) return;
		if (entry.stopTimeout) { clearTimeout(entry.stopTimeout); entry.stopTimeout = null; }

		const bufDur        = entry.player.buffer.duration;
		const clampedOffset = Math.min(bufferOffset, bufDur);
		const playDuration  = Math.min(duration, bufDur - clampedOffset);
		if (playDuration <= 0) return;

		try { entry.player.stop(); } catch { /* already stopped */ }

		const now = Tone.now();
		entry.player.fadeIn  = 0;
		entry.player.fadeOut = 0;
		entry.player.start(now, clampedOffset, playDuration);
		entry.isPlaying = true;

		const gp  = entry.rawGain.gain;
		const vol = ts.volume;
		gp.cancelScheduledValues(now);

		if (ts.fadeIn > 0 && clampedOffset < ts.fadeIn) {
			gp.setValueAtTime(vol * (clampedOffset / ts.fadeIn), now);
			gp.linearRampToValueAtTime(vol, now + (ts.fadeIn - clampedOffset));
		} else {
			gp.setValueAtTime(vol, now);
		}

		if (ts.fadeOut > 0) {
			const fadeOutStart = now + playDuration - ts.fadeOut;
			if (fadeOutStart > now) {
				gp.setValueAtTime(vol, fadeOutStart);
				gp.linearRampToValueAtTime(0, now + playDuration);
			}
		}

		entry.stopTimeout = setTimeout(() => { entry.isPlaying = false; }, (playDuration + 0.15) * 1000);
		console.log(`🎵 [${ts.sessionId.slice(0,6)}] offset:${clampedOffset.toFixed(2)}s dur:${playDuration.toFixed(2)}s`);
	}

	private _haltTrack(entry: MusicTrackEntry) {
		if (entry.stopTimeout) { clearTimeout(entry.stopTimeout); entry.stopTimeout = null; }
		try { entry.player.stop(); } catch { /* already stopped */ }
		entry.isPlaying = false;
	}

	stopMusic(sessionId?: string) {
		if (sessionId) {
			const entry = this.musicTracks.get(sessionId);
			if (entry) {
				this._haltTrack(entry);
				entry.player.dispose();
				entry.rawGain.disconnect();
				this.musicTracks.delete(sessionId);
			}
		} else {
			for (const entry of this.musicTracks.values()) {
				this._haltTrack(entry);
				entry.player.dispose();
				entry.rawGain.disconnect();
			}
			this.musicTracks.clear();
		}
	}

	setMusicVolume(_v: number)    { /* handled per-track via syncMusicToVideo trackStates */ }
	setMusicFadeIn(sessionId: string)    {
		const e = this.musicTracks.get(sessionId);
		if (e) { if (e.isPlaying) this._haltTrack(e); e.lastStartTime = -1; }
	}
	setMusicFadeOut(sessionId: string)   {
		const e = this.musicTracks.get(sessionId);
		if (e) { if (e.isPlaying) this._haltTrack(e); e.lastStartTime = -1; }
	}
	setMusicStartTime(_v: number) { /* barMoved detection handles restart */ }
	setMusicEndTime(_v: number)   { /* barMoved detection handles restart */ }
	setMusicTrimStart(_v: number) { /* barMoved detection handles restart */ }

	// ── Cleanup ──────────────────────────────────────────────────────────────
	stopAll() {
		this.stopSfx();
		this.stopMusic();
		this.disconnectVideo();
	}

	destroy() {
		this.stopAll();
		Tone.getTransport().stop();
	}
}

export const audioMixer = new AudioMixer();
