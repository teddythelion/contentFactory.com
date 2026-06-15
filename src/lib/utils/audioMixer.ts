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
	musicVolume: number;
	musicStartTime: number;
	musicEndTime: number;
	musicTrimStart: number;  // seconds into the audio buffer to skip (silence clip)
	musicFadeIn: number;
	musicFadeOut: number;
}

class AudioMixer {
	// Original video audio
	private videoMediaSource: MediaElementAudioSourceNode | null = null;
	private videoGain: Tone.Volume | null = null;

	// SFX
	private sfxPlayer: Tone.Player | null = null;
	private sfxGain: Tone.Volume | null = null;
	private sfxLoopTimeout: ReturnType<typeof setTimeout> | null = null;

	// Music
	private musicPlayer: Tone.Player | null = null;
	private musicGain: Tone.Volume | null = null;
	private musicRawGain: GainNode | null = null;
	private musicStopTimeout: ReturnType<typeof setTimeout> | null = null;

	// Music playhead sync tracking
	private musicIsPlaying: boolean = false;
	private lastMusicVideoTime: number = -1;
	private lastMusicStartTime: number = -1;
	private lastMusicEndTime: number = -1;
	private lastMusicTrimStart: number = -1;

	private state: MixerState = {
		originalVolume: 1,
		originalMuted: false,
		sfxVolume: 0.4,
		sfxStartTime: 0,
		sfxEndTime: 8,
		sfxFadeIn: 0,
		sfxFadeOut: 0,
		sfxLoop: false,
		musicVolume: 0.3,
		musicStartTime: 0,
		musicEndTime: 16,
		musicTrimStart: 0,
		musicFadeIn: 0,
		musicFadeOut: 0
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

	private clearMusicTimer() {
		if (this.musicStopTimeout) {
			clearTimeout(this.musicStopTimeout);
			this.musicStopTimeout = null;
		}
	}

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


	// ── MUSIC ────────────────────────────────────────────────────────────────
	async loadMusic(previewUrl: string, onLoaded?: (durationSeconds: number) => void) {
		await this.ensureStarted();
		this.stopMusic();

		const s = this.state;
		const ctx = Tone.getContext().rawContext as AudioContext;

		this.musicRawGain = ctx.createGain();
		this.musicRawGain.gain.value = s.musicVolume;
		this.musicRawGain.connect(ctx.destination);

		this.musicPlayer = new Tone.Player({
			url: previewUrl,
			loop: false,
			onload: () => {
				const dur = this.musicPlayer!.buffer.duration;
				console.log(`🎵 AudioMixer: Music loaded (${dur.toFixed(2)}s) — awaiting playhead sync`);
				onLoaded?.(dur);
			}
		});

		// Connect player directly to raw GainNode — avoids Tone.Volume internal routing issues
		(this.musicPlayer as any).connect(this.musicRawGain);
	}

	// ── Playhead-driven music sync ────────────────────────────────────────────
	syncMusicToVideo(videoTime: number, isVideoPlaying: boolean) {
		if (!this.musicPlayer?.loaded) return;

		const s = this.state;
		const inRange = videoTime >= s.musicStartTime && videoTime < s.musicEndTime;
		const shouldPlay = isVideoPlaying && inRange;

		const timeDelta = Math.abs(videoTime - this.lastMusicVideoTime);
		const isSeeked = this.lastMusicVideoTime >= 0 && timeDelta > 0.35;
		this.lastMusicVideoTime = videoTime;

		const barMoved =
			s.musicStartTime !== this.lastMusicStartTime ||
			s.musicEndTime   !== this.lastMusicEndTime   ||
			s.musicTrimStart !== this.lastMusicTrimStart;
		this.lastMusicStartTime = s.musicStartTime;
		this.lastMusicEndTime   = s.musicEndTime;
		this.lastMusicTrimStart = s.musicTrimStart;

		if (shouldPlay) {
			if (!this.musicIsPlaying || isSeeked || barMoved) {
				const bufferOffset = s.musicTrimStart + Math.max(0, videoTime - s.musicStartTime);
				const remaining    = s.musicEndTime - videoTime;
				this._startMusicFrom(bufferOffset, remaining);
			}
		} else {
			if (this.musicIsPlaying) this._haltMusic();
		}
	}

	private _startMusicFrom(bufferOffset: number, duration: number) {
		if (!this.musicPlayer?.loaded || !this.musicRawGain) return;
		this.clearMusicTimer();

		const bufferDuration = this.musicPlayer.buffer.duration;
		const clampedOffset  = Math.min(bufferOffset, bufferDuration);
		const playDuration   = Math.min(duration, bufferDuration - clampedOffset);
		if (playDuration <= 0) return;

		try { this.musicPlayer.stop(); } catch { /* already stopped */ }

		const s   = this.state;
		const now = Tone.now(); // single reference for player + param scheduling

		// Player: Tone handles the buffer read — disable its own fades
		this.musicPlayer.fadeIn  = 0;
		this.musicPlayer.fadeOut = 0;
		this.musicPlayer.start(now, clampedOffset, playDuration);
		this.musicIsPlaying = true;

		if (!this.musicRawGain) return;
		const gainParam = this.musicRawGain.gain;
		const linearVol = s.musicVolume;

		gainParam.cancelScheduledValues(now);

		if (s.musicFadeIn > 0 && clampedOffset < s.musicFadeIn) {
			const progress = clampedOffset / s.musicFadeIn;
			gainParam.setValueAtTime(linearVol * progress, now);
			gainParam.linearRampToValueAtTime(linearVol, now + (s.musicFadeIn - clampedOffset));
		} else {
			gainParam.setValueAtTime(linearVol, now);
		}

		if (s.musicFadeOut > 0) {
			const fadeOutStart = now + playDuration - s.musicFadeOut;
			if (fadeOutStart > now) {
				gainParam.setValueAtTime(linearVol, fadeOutStart);
				gainParam.linearRampToValueAtTime(0, now + playDuration);
			}
		}

		console.log(`🎵 Music — offset:${clampedOffset.toFixed(2)}s play:${playDuration.toFixed(2)}s fadeIn:${s.musicFadeIn}s fadeOut:${s.musicFadeOut}s`);

		this.musicStopTimeout = setTimeout(() => {
			this._haltMusic();
		}, (playDuration + 0.15) * 1000);
	}

	private _haltMusic() {
		this.clearMusicTimer();
		if (this.musicPlayer) {
			try { this.musicPlayer.stop(); } catch { /* already stopped */ }
		}
		this.musicIsPlaying = false;
	}

	stopMusic() {
		this._haltMusic();
		if (this.musicPlayer) {
			this.musicPlayer.dispose();
			this.musicPlayer = null;
		}
		if (this.musicGain) {
			this.musicGain.dispose();
			this.musicGain = null;
		}
		if (this.musicRawGain) {
			this.musicRawGain.disconnect();
			this.musicRawGain = null;
		}
		this.lastMusicVideoTime = -1;
		this.lastMusicStartTime = -1;
		this.lastMusicEndTime   = -1;
		this.lastMusicTrimStart = -1;
	}

	setMusicVolume(volume: number) {
		this.state.musicVolume = volume;
		if (this.musicRawGain) {
			const ctx = Tone.getContext().rawContext as AudioContext;
			this.musicRawGain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
		}
	}

	setMusicFadeIn(v: number) {
		this.state.musicFadeIn = v;
		if (this.musicIsPlaying) {
			this._haltMusic();
			// Restart from current video position — barMoved will pick it up on next sync tick
			this.lastMusicStartTime = -1;
		}
	}

	setMusicFadeOut(v: number) {
		this.state.musicFadeOut = v;
		if (this.musicIsPlaying) {
			this._haltMusic();
			this.lastMusicStartTime = -1;
		}
	}

	setMusicStartTime(v: number) {
		this.state.musicStartTime = v;
		// barMoved detection in syncMusicToVideo will handle restart
	}

	setMusicEndTime(v: number) {
		this.state.musicEndTime = v;
		// barMoved detection in syncMusicToVideo will handle restart
	}

	setMusicTrimStart(v: number) {
		this.state.musicTrimStart = Math.max(0, v);
	}

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
