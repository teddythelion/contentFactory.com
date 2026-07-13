// src/lib/server/tempSweeper.ts
// Reaps orphaned capture/encode artifacts from the temp base. The success and
// error paths clean up after themselves, but a crashed encode, killed process,
// or interrupted upload leaves session dirs behind — and on the VPS the temp
// base is /dev/shm (RAM-backed, capped at ~50% of RAM), so a few multi-GB
// orphans fill it and every later capture dies with "no space left on device".

import { readdir, rm, stat } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const SESSION_MAX_AGE_MS = 6 * 60 * 60 * 1000; // frame dirs / stray mp4s: 6h
const AUDIO_MAX_AGE_MS = 24 * 60 * 60 * 1000; // audio sessions live across a long edit: 24h
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // hourly

function getTempBase(): string {
	return process.platform === 'linux'
		? '/dev/shm/contentfactory'
		: path.join(process.cwd(), 'temp');
}

// Transient artifacts written to the temp base root. Anything not matching
// (e.g. the audio dir, unknown user files) is left alone or handled separately.
const SWEEPABLE = /^(session-\d+|frames-[\w-]+|(silent|output|capture)-\d+\.mp4)$/;

async function sweepTempBase(): Promise<void> {
	const baseTemp = getTempBase();
	if (!existsSync(baseTemp)) return;

	const now = Date.now();
	let reclaimed = 0;
	let removed = 0;

	for (const entry of await readdir(baseTemp).catch(() => [] as string[])) {
		const full = path.join(baseTemp, entry);
		try {
			if (entry === 'audio') {
				for (const audioFile of await readdir(full).catch(() => [] as string[])) {
					const audioPath = path.join(full, audioFile);
					const s = await stat(audioPath);
					if (now - s.mtimeMs > AUDIO_MAX_AGE_MS) {
						reclaimed += s.size;
						await rm(audioPath, { force: true });
						removed++;
					}
				}
				continue;
			}

			if (!SWEEPABLE.test(entry)) continue;
			const s = await stat(full);
			if (now - s.mtimeMs <= SESSION_MAX_AGE_MS) continue;

			if (s.isDirectory()) {
				for (const f of await readdir(full).catch(() => [] as string[])) {
					const fs = await stat(path.join(full, f)).catch(() => null);
					if (fs) reclaimed += fs.size;
				}
			} else {
				reclaimed += s.size;
			}
			await rm(full, { recursive: true, force: true });
			removed++;
		} catch {
			// entry vanished mid-sweep (active encode cleaning up) — fine
		}
	}

	if (removed > 0) {
		console.log(
			`🧹 Temp sweep: removed ${removed} orphaned item(s), reclaimed ${(reclaimed / 1048576).toFixed(1)}MB from ${baseTemp}`
		);
	}
}

let sweeperStarted = false;

// Idempotent — hooks.server.ts may be re-evaluated in dev (HMR); only one
// interval must ever run per process.
export function startTempSweeper(): void {
	if (sweeperStarted) return;
	sweeperStarted = true;
	sweepTempBase().catch((e) => console.warn('Temp sweep failed:', e));
	const timer = setInterval(
		() => sweepTempBase().catch((e) => console.warn('Temp sweep failed:', e)),
		SWEEP_INTERVAL_MS
	);
	// Don't let the sweep timer keep the process alive on shutdown
	timer.unref?.();
}
