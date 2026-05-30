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
	private musicStopTimeout: ReturnType<typeof setTimeout> | null = null;

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
	async loadSfx(previewUrl: string) {
		await this.ensureStarted();
		this.stopSfx();

		const s = this.state;

		this.sfxGain = new Tone.Volume(this.toDb(s.sfxVolume)).toDestination();

		this.sfxPlayer = new Tone.Player({
			url: previewUrl,
			loop: false, // We handle looping manually to respect start/end trim window
			fadeIn: s.sfxFadeIn,
			fadeOut: s.sfxFadeOut,
			onload: () => {
				console.log(`🔊 AudioMixer: SFX loaded (${this.sfxPlayer!.buffer.duration.toFixed(2)}s)`);
				this.playSfx();
			}
		}).connect(this.sfxGain);
	}

	playSfx() {
		if (!this.sfxPlayer || !this.sfxPlayer.loaded) return;
		this.clearSfxTimer();

		const s = this.state;
		const bufferDuration = this.sfxPlayer.buffer.duration;
		const startOffset = Math.min(s.sfxStartTime, bufferDuration);
		const endTime = Math.min(s.sfxEndTime, bufferDuration);
		const duration = endTime - startOffset;
		if (duration <= 0) return;

		try {
			this.sfxPlayer.stop();
		} catch {
			/* already stopped */
		}

		// Always play with explicit duration to respect the trim window
		this.sfxPlayer.fadeOut = 0; // disable — we handle manually
		this.sfxPlayer.start(Tone.now(), startOffset, duration);

		// Manually schedule fade out via gain
		if (s.sfxFadeOut > 0 && this.sfxGain) {
			const now = Tone.now();
			const fadeStart = now + Math.max(0, duration - s.sfxFadeOut);
			if (fadeStart > now) {
				this.sfxGain.volume.setValueAtTime(this.toDb(s.sfxVolume), fadeStart);
				this.sfxGain.volume.linearRampToValueAtTime(-96, fadeStart + s.sfxFadeOut);
			}
		}

		console.log(
			`🔊 AudioMixer: SFX playing — offset:${startOffset}s duration:${duration.toFixed(2)}s loop:${s.sfxLoop}`
		);

		// Manual loop — reschedule playback after duration if loop is on
		if (s.sfxLoop) {
			this.sfxLoopTimeout = setTimeout(() => {
				// Only re-trigger if loop is still enabled and player still exists
				if (this.state.sfxLoop && this.sfxPlayer) {
					this.playSfx();
				}
			}, duration * 1000);
		}
	}

	stopSfx() {
		this.clearSfxTimer();
		if (this.sfxPlayer) {
			try {
				this.sfxPlayer.stop();
			} catch {
				/* already stopped */
			}
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
		// Replay to apply new loop setting immediately
		if (this.sfxPlayer?.loaded) this.playSfx();
	}

	setSfxFadeIn(v: number) {
		this.state.sfxFadeIn = v;
		if (this.sfxPlayer) {
			this.sfxPlayer.fadeIn = v;
			this.playSfx();
		}
	}

	setSfxFadeOut(v: number) {
		this.state.sfxFadeOut = v;
		if (this.sfxPlayer) {
			this.sfxPlayer.fadeOut = v;
			this.playSfx();
		}
	}

	setSfxStartTime(v: number) {
		this.state.sfxStartTime = v;
		if (this.sfxPlayer?.loaded) this.playSfx();
	}

	setSfxEndTime(v: number) {
		this.state.sfxEndTime = v;
		if (this.sfxPlayer?.loaded) this.playSfx();
	}

	// ── MUSIC ────────────────────────────────────────────────────────────────
	async loadMusic(previewUrl: string) {
		await this.ensureStarted();
		this.stopMusic();

		const s = this.state;

		this.musicGain = new Tone.Volume(this.toDb(s.musicVolume)).toDestination();

		this.musicPlayer = new Tone.Player({
			url: previewUrl,
			loop: false, // We handle stop at endTime manually
			fadeIn: s.musicFadeIn,
			fadeOut: s.musicFadeOut,
			onload: () => {
				console.log(
					`🎵 AudioMixer: Music loaded (${this.musicPlayer!.buffer.duration.toFixed(2)}s)`
				);
				this.playMusic();
			}
		}).connect(this.musicGain);
	}

	playMusic() {
		if (!this.musicPlayer || !this.musicPlayer.loaded) return;
		this.clearMusicTimer();

		const s = this.state;
		const bufferDuration = this.musicPlayer.buffer.duration;
		const startOffset = Math.min(s.musicStartTime, bufferDuration);

		// endTime of 999 means "play to end of buffer" — use bufferDuration as ceiling
		const rawEndTime = s.musicEndTime >= 999 ? bufferDuration : s.musicEndTime;
		const endTime = Math.min(rawEndTime, bufferDuration);
		const duration = endTime - startOffset;
		if (duration <= 0) return;

		try {
			this.musicPlayer.stop();
		} catch {
			/* already stopped */
		}

		// Pass explicit duration so music stops at endTime — not at buffer end
		this.musicPlayer.fadeOut = 0; // disable — we handle manually
		this.musicPlayer.start(Tone.now(), startOffset, duration);

		// Manually schedule fade out via gain
		if (s.musicFadeOut > 0 && this.musicGain) {
			const now = Tone.now();
			const fadeStart = now + duration - s.musicFadeOut;
			this.musicGain.volume.cancelScheduledValues(now);
			this.musicGain.volume.setValueAtTime(this.toDb(s.musicVolume), now);
			this.musicGain.volume.linearRampToValueAtTime(-96, fadeStart + s.musicFadeOut);
		}

		console.log(
			`🎵 AudioMixer: Music playing — offset:${startOffset}s duration:${duration.toFixed(2)}s`
		);

		// Schedule auto-stop at endTime in case Tone doesn't honor duration perfectly
		this.musicStopTimeout = setTimeout(
			() => {
				if (this.musicPlayer) {
					try {
						this.musicPlayer.stop();
					} catch {
						/* already stopped */
					}
				}
			},
			(duration + 0.2) * 1000
		);
	}

	stopMusic() {
		this.clearMusicTimer();
		if (this.musicPlayer) {
			try {
				this.musicPlayer.stop();
			} catch {
				/* already stopped */
			}
			this.musicPlayer.dispose();
			this.musicPlayer = null;
		}
		if (this.musicGain) {
			this.musicGain.dispose();
			this.musicGain = null;
		}
	}

	setMusicVolume(volume: number) {
		this.state.musicVolume = volume;
		if (this.musicGain) this.musicGain.volume.rampTo(this.toDb(volume), 0.05);
	}

	setMusicFadeIn(v: number) {
		this.state.musicFadeIn = v;
		if (this.musicPlayer) {
			this.musicPlayer.fadeIn = v;
			this.playMusic();
		}
	}

	setMusicFadeOut(v: number) {
		this.state.musicFadeOut = v;
		if (this.musicPlayer) {
			this.musicPlayer.fadeOut = v;
			this.playMusic();
		}
	}

	setMusicStartTime(v: number) {
		this.state.musicStartTime = v;
		if (this.musicPlayer?.loaded) this.playMusic();
	}

	setMusicEndTime(v: number) {
		this.state.musicEndTime = v;
		if (this.musicPlayer?.loaded) this.playMusic();
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
