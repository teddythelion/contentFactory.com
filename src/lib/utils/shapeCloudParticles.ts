// src/lib/utils/shapeCloudParticles.ts
// GPU-blended point-cloud "shape" particles — a coherent aggregate shape
// (points sampled across a primitive's surface) that travels through space
// as one unit and leaves trailing echoes of itself.
//
// Deliberately a SEPARATE system from instancedParticles.ts, not a mode on
// it — that system computes N independent per-particle positions in JS
// every frame (real CPU cost, that's what we benchmarked). This one uploads
// a fixed point cloud to the GPU once; moving the whole shape every frame is
// a single uniform write (uOrigin), not a per-particle loop. The rendering
// technique (position + shader-driven per-point glow) is also fundamentally
// different from InstancedMesh's real lit geometry. Different cost profile,
// different visual, not worth forcing into one architecture.
//
// Determinism: uOrigin is a pure function of time — no accumulated state.
// Trail layers are phase-offset copies of the same function, not a history
// buffer (see instancedParticles.ts for why that matters — the same mistake
// was made and fixed there first).

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export type ShapeCloudPrimitive = 'pyramid' | 'sphere' | 'cube' | 'torus';

// Tighter than instancedParticles' 0.35 — echoes hug the shape's path so a
// long trail reads as a comet tail, not disconnected copies.
const TRAIL_PHASE_STEP = 0.12;

// Map the shared particleSpeed slider (0.1–2, store default 0.01) onto a
// wide expressive range: floor keeps the default from reading as frozen,
// the power curve makes the bottom of the slider glacial and the top brisk.
function effectiveSpeed(sliderSpeed: number): number {
	return 0.15 + Math.pow(Math.max(sliderSpeed, 0), 1.5) * 4;
}

function makePrimitiveGeometry(type: ShapeCloudPrimitive, size: number): THREE.BufferGeometry {
	switch (type) {
		case 'sphere': return new THREE.SphereGeometry(size * 0.6, 32, 32);
		case 'cube': return new THREE.BoxGeometry(size, size, size);
		case 'torus': return new THREE.TorusGeometry(size * 0.5, size * 0.2, 16, 48);
		case 'pyramid':
		default: return new THREE.ConeGeometry(size * 0.6, size, 4);
	}
}

function samplePoints(geometry: THREE.BufferGeometry, count: number): Float32Array {
	const mesh = new THREE.Mesh(geometry);
	const sampler = new MeshSurfaceSampler(mesh).build();
	const positions = new Float32Array(count * 3);
	const tmp = new THREE.Vector3();
	for (let i = 0; i < count; i++) {
		sampler.sample(tmp);
		positions[i * 3] = tmp.x;
		positions[i * 3 + 1] = tmp.y;
		positions[i * 3 + 2] = tmp.z;
	}
	return positions;
}

const VERTEX_SHADER = `
	attribute vec3 aColor;
	uniform vec3 uOrigin;
	uniform mat3 uRot;
	uniform float uSize;
	varying vec3 vColor;

	void main() {
		// Rotate around the shape's own center BEFORE the travel offset —
		// spin-in-place like a planet. Rotating the Points object instead
		// would rotate uOrigin too, turning spin into an orbit.
		vec3 p = uRot * position;
		vec4 mvPosition = modelViewMatrix * vec4(p + uOrigin, 1.0);
		gl_Position = projectionMatrix * mvPosition;
		gl_PointSize = uSize * (300.0 / -mvPosition.z);
		vColor = aColor;
	}
`;

const FRAGMENT_SHADER = `
	uniform float uOpacity;
	varying vec3 vColor;

	void main() {
		float strength = distance(gl_PointCoord, vec2(0.5));
		strength = 1.0 - smoothstep(0.0, 0.5, strength);
		if (strength < 0.01) discard;
		gl_FragColor = vec4(vColor, strength * uOpacity);
	}
`;

export interface ShapeCloudConfig {
	count: number;
	trailCount: number;
	primitive: ShapeCloudPrimitive;
	shapeScale: number;
	pointSize: number; // pre-scaled to pixel-ish units by the caller
	spread: number;
	speed: number;
	color: string;
	colorMode: 'solid' | 'gradient' | 'rainbow' | 'video-reactive';
	gradientColor: string;
	opacity: number;
	glow: boolean;
}

export interface ShapeCloudLayer {
	points: THREE.Points;
	material: THREE.ShaderMaterial;
}

export interface ShapeCloudSystem {
	layers: ShapeCloudLayer[];
	geometry: THREE.BufferGeometry;
}

export function disposeShapeCloud(scene: THREE.Scene, system: ShapeCloudSystem | null) {
	if (!system) return;
	for (const layer of system.layers) {
		scene.remove(layer.points);
		layer.material.dispose();
	}
	system.geometry.dispose();
}

export function buildShapeCloud(scene: THREE.Scene, config: ShapeCloudConfig): ShapeCloudSystem {
	const primitiveGeometry = makePrimitiveGeometry(config.primitive, config.shapeScale);
	const positions = samplePoints(primitiveGeometry, config.count);
	primitiveGeometry.dispose();

	const colors = new Float32Array(config.count * 3);
	const color = new THREE.Color();
	const gradientEnd = new THREE.Color(config.gradientColor);
	for (let i = 0; i < config.count; i++) {
		if (config.colorMode === 'rainbow') color.setHSL((i / config.count) % 1, 0.65, 0.6);
		else if (config.colorMode === 'gradient') color.copy(new THREE.Color(config.color)).lerp(gradientEnd, i / config.count);
		else color.set(config.color);
		colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
	}

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));

	const layers: ShapeCloudLayer[] = [];
	for (let k = 0; k <= config.trailCount; k++) {
		const layerOpacity = k === 0 ? config.opacity : config.opacity * Math.max(0.03, 1 - k / (config.trailCount + 1));
		const material = new THREE.ShaderMaterial({
			vertexShader: VERTEX_SHADER,
			fragmentShader: FRAGMENT_SHADER,
			transparent: true,
			depthWrite: false,
			blending: config.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
			uniforms: {
				uOrigin: { value: new THREE.Vector3() },
				uRot: { value: new THREE.Matrix3() },
				uSize: { value: config.pointSize },
				uOpacity: { value: layerOpacity }
			}
		});
		const points = new THREE.Points(geometry, material);
		scene.add(points);
		layers.push({ points, material });
	}

	return { layers, geometry };
}

function triangleWave(x: number): number {
	return Math.abs(((x % 2) + 2) % 2 - 1) * 2 - 1;
}

const _origin = new THREE.Vector3();
const _rotM4 = new THREE.Matrix4();
const _tiltM4 = new THREE.Matrix4();
const AXIAL_TILT = 0.41; // ~23.5° — earth-like lean so the spin axis reads in 3D

export function updateShapeCloud(system: ShapeCloudSystem, config: ShapeCloudConfig, t: number) {
	// Travel bounds are much tighter than the raw spread slider: the visible
	// frustum half-height at the editor's camera distance (~6) is only ~3.5
	// world units, while spread defaults to 20. Using spread/2 sent the shape
	// off-screen most of the time — scale so default spread ≈ ±4.
	const half = config.spread * 0.2;
	const speed = effectiveSpeed(config.speed);
	const spinRate = speed * 0.7; // spin tracks travel speed so slow = stately, fast = tumbling

	for (let k = 0; k < system.layers.length; k++) {
		const phaseOffset = -k * TRAIL_PHASE_STEP;
		const layer = system.layers[k];

		_origin.set(
			triangleWave(t * speed + phaseOffset) * half,
			triangleWave(t * speed * 0.8 + phaseOffset * 1.3) * half,
			triangleWave(t * speed * 1.2 + phaseOffset * 0.7) * half
		);
		layer.material.uniforms.uOrigin.value.copy(_origin);

		// Spin-in-place around a tilted axis; echoes lag in rotation too, so a
		// trailing copy shows where the shape WAS in its spin, not a frozen pose.
		_rotM4.makeRotationY(t * spinRate + phaseOffset);
		_tiltM4.makeRotationZ(AXIAL_TILT);
		_rotM4.premultiply(_tiltM4);
		layer.material.uniforms.uRot.value.setFromMatrix4(_rotM4);

		// Size/opacity are live uniforms — slider changes apply without a rebuild.
		layer.material.uniforms.uSize.value = config.pointSize;
		const layerOpacity = k === 0 ? config.opacity : config.opacity * Math.max(0.03, 1 - k / (config.trailCount + 1));
		layer.material.uniforms.uOpacity.value = layerOpacity;
	}
}

export function setShapeCloudVisible(scene: THREE.Scene, system: ShapeCloudSystem, visible: boolean) {
	const isShown = scene.children.includes(system.layers[0]?.points);
	if (visible && !isShown) { for (const l of system.layers) scene.add(l.points); }
	else if (!visible && isShown) { for (const l of system.layers) scene.remove(l.points); }
}
