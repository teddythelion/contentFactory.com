// src/lib/utils/instancedParticles.ts
// Real-geometry (InstancedMesh) particle rendering + tracer trails — the
// "3D shapes" mode alongside the existing flat sprite (THREE.Points) system
// in ThreeJsScene.svelte. Benchmarked in src/routes/dev/particle-bench:
// 23k particles + 3 trail layers ran at ~29ms/frame on the target iGPU.
//
// Determinism: computePosition is a pure function of time — no accumulated
// state. Trail echoes are produced by re-evaluating this same function with
// a phase offset per layer, NOT by buffering past frames. That makes trail
// state correct under arbitrary seeks (capture's per-frame T, or future
// timeline scrubbing), not just forward playback. Do not swap this for a
// stateful rolling buffer — see the capture determinism notes in CLAUDE.md
// for why forward-only assumptions have bitten this codebase before.
//
// Trails are offset by PHASE, not by real time. particleSpeed defaults to
// 0.01 (tuned for the old sprite system's per-frame accumulation, a totally
// different scale than "wave cycles per second" here) — a fixed time offset
// at that speed barely moves the wave argument, so every trail echo lands
// on nearly the same position and only rotation still varies, producing a
// tight cluster of differently-rotated shapes instead of a spread-out trail
// (this is what "shattered glass" in a capture turned out to be). A phase
// offset sidesteps the scale mismatch entirely — it's speed-independent.

import * as THREE from 'three';

export type InstancedGeometryType = 'octahedron' | 'box' | 'tetrahedron' | 'icosahedron';

// Only motions that are pure functions of time are trail-safe (see above).
// Kept deliberately small for this pass — porting the sprite system's other
// (stateful) animation modes to trails is future work, not this one.
export type Instanced3dAnimation = 'bounce' | 'spiral' | 'orbit';

const TRAIL_PHASE_STEP = 0.35; // wave-argument units per trail layer — NOT seconds, speed-independent

function makeGeometry(type: InstancedGeometryType, size: number): THREE.BufferGeometry {
	switch (type) {
		case 'box': return new THREE.BoxGeometry(size, size, size);
		case 'tetrahedron': return new THREE.TetrahedronGeometry(size);
		case 'icosahedron': return new THREE.IcosahedronGeometry(size);
		case 'octahedron':
		default: return new THREE.OctahedronGeometry(size);
	}
}

function triangleWave(x: number): number {
	return Math.abs(((x % 2) + 2) % 2 - 1) * 2 - 1;
}

function computePosition(
	out: THREE.Vector3,
	animation: Instanced3dAnimation,
	index: number,
	count: number,
	t: number,
	spread: number,
	speed: number,
	phaseOffset: number
) {
	const phaseX = index * 0.31 + phaseOffset;
	const phaseY = index * 0.71 + phaseOffset;
	const phaseZ = index * 1.13 + phaseOffset;
	const perParticleSpeed = speed * (0.6 + (index % 7) * 0.05);
	const half = spread / 2;

	switch (animation) {
		case 'spiral': {
			const radius = half * 0.5 + Math.sin(t + phaseX) * (half * 0.2);
			const angle = t * 2 * speed + index * 0.1 + phaseOffset;
			out.set(Math.cos(angle) * radius, (index / count - 0.5) * spread, Math.sin(angle) * radius);
			break;
		}
		case 'orbit': {
			const radius = half * 0.5 + (index / count) * (half * 0.3);
			const orbitSpeed = t * (1 + index / count) * 0.5 * speed + phaseOffset;
			out.set(Math.cos(orbitSpeed) * radius, Math.sin(t * 2 + phaseY) * (half * 0.2), Math.sin(orbitSpeed) * radius);
			break;
		}
		case 'bounce':
		default:
			out.set(
				triangleWave(t * perParticleSpeed + phaseX) * half,
				triangleWave(t * perParticleSpeed * 0.8 + phaseY) * half,
				triangleWave(t * perParticleSpeed * 1.2 + phaseZ) * half
			);
	}
}

export interface InstancedParticleConfig {
	count: number;
	trailCount: number; // 0 = no trails, main layer only
	geometryType: InstancedGeometryType;
	size: number;
	animation: Instanced3dAnimation;
	spread: number;
	speed: number;
	color: string;
	colorMode: 'solid' | 'gradient' | 'rainbow' | 'video-reactive';
	gradientColor: string;
	opacity: number;
	glow: boolean;
}

export function disposeInstancedLayers(scene: THREE.Scene, layers: THREE.InstancedMesh[]) {
	for (const layer of layers) {
		scene.remove(layer);
		layer.geometry.dispose();
		(layer.material as THREE.Material).dispose();
	}
}

export function buildInstancedLayers(scene: THREE.Scene, config: InstancedParticleConfig): THREE.InstancedMesh[] {
	const geometry = makeGeometry(config.geometryType, config.size);
	const color = new THREE.Color();
	const gradientEnd = new THREE.Color(config.gradientColor);
	const layers: THREE.InstancedMesh[] = [];

	for (let k = 0; k <= config.trailCount; k++) {
		const layerOpacity = k === 0 ? config.opacity : config.opacity * Math.max(0.03, 1 - k / (config.trailCount + 1));
		const material = new THREE.MeshStandardMaterial({
			transparent: true,
			opacity: layerOpacity,
			depthWrite: k === 0,
			blending: config.glow ? THREE.AdditiveBlending : THREE.NormalBlending
		});
		const mesh = new THREE.InstancedMesh(geometry, material, config.count);
		mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(config.count * 3), 3);

		for (let i = 0; i < config.count; i++) {
			if (config.colorMode === 'rainbow') color.setHSL((i / config.count) % 1, 0.65, 0.55);
			else if (config.colorMode === 'gradient') color.copy(new THREE.Color(config.color)).lerp(gradientEnd, i / config.count);
			else color.set(config.color);
			mesh.setColorAt(i, color);
		}

		scene.add(mesh);
		layers.push(mesh);
	}

	return layers;
}

const _dummy = new THREE.Object3D();
const _pos = new THREE.Vector3();

export function updateInstancedLayers(layers: THREE.InstancedMesh[], config: InstancedParticleConfig, t: number) {
	for (let k = 0; k < layers.length; k++) {
		const layer = layers[k];
		const phaseOffset = -k * TRAIL_PHASE_STEP; // trailing layers sample "earlier" in the cycle
		for (let i = 0; i < config.count; i++) {
			computePosition(_pos, config.animation, i, config.count, t, config.spread, config.speed, phaseOffset);
			_dummy.position.copy(_pos);
			_dummy.rotation.set(t + i + phaseOffset, (t + phaseOffset) * 0.7 + i, 0);
			_dummy.updateMatrix();
			layer.setMatrixAt(i, _dummy.matrix);
		}
		layer.instanceMatrix.needsUpdate = true;
	}
}
