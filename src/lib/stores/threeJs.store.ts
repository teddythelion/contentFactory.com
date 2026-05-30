// src/lib/stores/threeJs.store.ts
import { writable } from 'svelte/store';

export type ParticleShape = 'circle' | 'square' | 'triangle' | 'star' | 'heart' | 'custom';
export type ParticleAnimation =
	| 'none'
	| 'spiral'
	| 'wave'
	| 'vortex'
	| 'explosion'
	| 'orbit'
	| 'pulse'
	| 'fountain';

interface ThreeJsState {
	selectedShape: string;
	rotationX: number;
	rotationY: number;
	rotationZ: number;
	autoRotate: boolean;
	autoRotateSpeed: number;
	cameraDistance: number;
	scale: number;
	ambientIntensity: number;
	directionalIntensity: number;
	videoGlow: number;
	shapeGlow: number;

	// Particle system
	particlesEnabled: boolean;
	particleCount: number;
	particleSize: number;
	particleSpeed: number;
	particleSpread: number;
	particleColor: string;
	particleOpacity: number;
	particleReactToVideo: boolean;

	// NEW: Particle shapes and animations
	particleShape: ParticleShape;
	particleAnimation: ParticleAnimation;
	particleAnimationSpeed: number;
	particleTrailEnabled: boolean;
	particleGlow: boolean;
	particleRotation: boolean;
	particleColorMode: 'solid' | 'gradient' | 'rainbow' | 'video-reactive';
	particleGradientColor: string;

	// Capture state
	isCapturing: boolean;
	isSceneReady: boolean;
}

const initialState: ThreeJsState = {
	selectedShape: 'plane',
	rotationX: 0,
	rotationY: 0,
	rotationZ: 0,
	autoRotate: false,
	autoRotateSpeed: 0.01,
	cameraDistance: 6,
	scale: 1.8,
	ambientIntensity: 0.5,
	directionalIntensity: 0.8,
	videoGlow: 0,
	shapeGlow: 0,

	particlesEnabled: false,
	particleCount: 1000,
	particleSize: 0.05,
	particleSpeed: 0.01,
	particleSpread: 20,
	particleColor: '#ffffff',
	particleOpacity: 0.8,
	particleReactToVideo: false,

	// NEW defaults
	particleShape: 'circle',
	particleAnimation: 'none',
	particleAnimationSpeed: 1.0,
	particleTrailEnabled: false,
	particleGlow: true,
	particleRotation: false,
	particleColorMode: 'solid',
	particleGradientColor: '#00ffff',

	isCapturing: false,
	isSceneReady: false
};

function createThreeJsStore() {
	const { subscribe, set, update } = writable<ThreeJsState>(initialState);

	return {
		subscribe,
		set,
		updateProperty: (key: keyof ThreeJsState, value: any) => {
			update((state) => ({ ...state, [key]: value }));
		},
		updateMultiple: (updates: Partial<ThreeJsState>) => {
			update((state) => ({ ...state, ...updates }));
		},
		reset: () => set(initialState),
		resetVisuals: () => {
			update((state) => ({
				...state,
				rotationX: initialState.rotationX,
				rotationY: initialState.rotationY,
				rotationZ: initialState.rotationZ,
				autoRotate: initialState.autoRotate,
				scale: initialState.scale,
				cameraDistance: initialState.cameraDistance,
				ambientIntensity: initialState.ambientIntensity,
				directionalIntensity: initialState.directionalIntensity,
				videoGlow: initialState.videoGlow,
				shapeGlow: initialState.shapeGlow
			}));
		},
		resetParticles: () => {
			update((state) => ({
				...state,
				particlesEnabled: initialState.particlesEnabled,
				particleCount: initialState.particleCount,
				particleSize: initialState.particleSize,
				particleSpeed: initialState.particleSpeed,
				particleSpread: initialState.particleSpread,
				particleColor: initialState.particleColor,
				particleOpacity: initialState.particleOpacity,
				particleShape: initialState.particleShape,
				particleAnimation: initialState.particleAnimation,
				particleAnimationSpeed: initialState.particleAnimationSpeed,
				particleTrailEnabled: initialState.particleTrailEnabled,
				particleGlow: initialState.particleGlow,
				particleRotation: initialState.particleRotation,
				particleColorMode: initialState.particleColorMode,
				particleGradientColor: initialState.particleGradientColor
			}));
		},
		resetRotation: () => {
			update((state) => ({
				...state,
				rotationX: 0,
				rotationY: 0,
				rotationZ: 0
			}));
		},
		setShape: (shape: string) => {
			update((state) => ({ ...state, selectedShape: shape }));
		},
		setCapturing: (isCapturing: boolean) => {
			update((state) => ({ ...state, isCapturing }));
		},
		setSceneReady: (isSceneReady: boolean) => {
			update((state) => ({ ...state, isSceneReady }));
		}
	};
}

export const threeJsState = createThreeJsStore();
