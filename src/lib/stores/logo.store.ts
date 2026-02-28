// src/lib/stores/logo.store.ts
// Logo Overlay State Management with THREE.js Animations

import { writable } from 'svelte/store';

export interface LogoState {
	// Enable/Disable
	enabled: boolean;

	// Logo File
	logoDataUrl: string | null;
	logoFileName: string | null;

	// Position (percentage of video width/height)
	position: {
		x: number;
		y: number;
		z: number; // depth — 0 = default, positive = closer to camera
	};

	// Size & Appearance
	scale: number;
	opacity: number;

	// Timing (in seconds)
	startTime: number;
	endTime: number;
	fadeInDuration: number;
	fadeOutDuration: number;

	// Animation & Effects
	animationType: 'none' | 'spin' | 'pulse' | 'bounce' | 'explode' | 'warp' | 'glitch' | 'flip3d' | 'spiral' | 'shimmer' | 'particle-assemble';
	animationSpeed: number;
	rotation3D: {
		x: number;
		y: number;
		z: number;
	};
	autoRotate: boolean;
	autoRotateSpeed: number;
}

const initialState: LogoState = {
	enabled: false,
	logoDataUrl: null,
	logoFileName: null,

	position: {
		x: 54,
		y: 46,
		z: 0
	},

	scale: 0.3,
	opacity: 0.9,

	startTime: 0,
	endTime: 8,
	fadeInDuration: 0.5,
	fadeOutDuration: 0.5,

	animationType: 'none',
	animationSpeed: 1.0,
	rotation3D: {
		x: 0,
		y: 0,
		z: 0
	},
	autoRotate: false,
	autoRotateSpeed: 0.01
};

function createLogoStore() {
	const { subscribe, set, update } = writable<LogoState>(initialState);

	return {
		subscribe,
		set,
		update,

		setEnabled: (enabled: boolean) => {
			update(state => ({ ...state, enabled }));
		},

		uploadLogo: (file: File) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const dataUrl = e.target?.result as string;
				update(state => ({
					...state,
					logoDataUrl: dataUrl,
					logoFileName: file.name,
					enabled: true
				}));
			};
			reader.readAsDataURL(file);
		},

		setLogoDataUrl: (dataUrl: string, fileName: string = 'generated-logo.png') => {
			update(state => ({
				...state,
				logoDataUrl: dataUrl,
				logoFileName: fileName,
				enabled: true
			}));
		},

		clearLogo: () => {
			update(state => ({
				...state,
				logoDataUrl: null,
				logoFileName: null,
				enabled: false
			}));
		},

		// Updated to accept optional z
		setPosition: (x: number, y: number, z?: number) => {
			update(state => ({
				...state,
				position: { x, y, z: z ?? state.position.z }
			}));
		},

		setAnimation: (animationType: LogoState['animationType']) => {
			update(state => ({ ...state, animationType }));
		},

		setAnimationSpeed: (speed: number) => {
			update(state => ({ ...state, animationSpeed: speed }));
		},

		setRotation3D: (axis: 'x' | 'y' | 'z', value: number) => {
			update(state => ({
				...state,
				rotation3D: { ...state.rotation3D, [axis]: value }
			}));
		},

		toggleAutoRotate: () => {
			update(state => ({ ...state, autoRotate: !state.autoRotate }));
		},

		setAutoRotateSpeed: (speed: number) => {
			update(state => ({ ...state, autoRotateSpeed: speed }));
		},

		updateProperty: <K extends keyof LogoState>(key: K, value: LogoState[K]) => {
			update(state => ({ ...state, [key]: value }));
		},

		// Position presets — calibrated to your reference points:
		// top-left: x:54, y:46  |  bottom-right: x:53, y:54
		// derived center ~x:53.5, y:50 — spacing ~31 units horiz, ~8 units vert
		presets: {
			topLeft: () => {
				update(state => ({ ...state, position: { ...state.position, x: 54, y: 46 } }));
			},
			topRight: () => {
				update(state => ({ ...state, position: { ...state.position, x: 85, y: 46 } }));
			},
			bottomLeft: () => {
				update(state => ({ ...state, position: { ...state.position, x: 54, y: 54 } }));
			},
			bottomRight: () => {
				update(state => ({ ...state, position: { ...state.position, x: 85, y: 54 } }));
			},
			center: () => {
				update(state => ({ ...state, position: { ...state.position, x: 53, y: 50 } }));
			}
		},

		reset: () => {
			set(initialState);
		}
	};
}

export const logoState = createLogoStore();