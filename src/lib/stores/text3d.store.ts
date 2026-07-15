// src/lib/stores/text3d.store.ts
// Professional 3D Text Store for Troika Three.js Text
//
// MULTI-INSTANCE (7-14-2026): the styling params live per-INSTANCE in `entries`
// (keyed by entryId). The flat fields remain the ControlsPanel's editing surface
// and always mirror the ACTIVE entry — every mutation through this store patches
// entries[activeEntryId] automatically. Timing/fades are NOT here: each instance
// has a timeline bar (mediaBin asset type 'text3d' → video-lane clip) and
// ThreeJsText reads visibility + fade from that clip.

import { writable } from 'svelte/store';

// Per-instance styling params — everything the accordion edits
export interface Text3DParams {
	// TEXT MODE: Troika (Google Fonts, SDF pseudo-3D) vs True 3D (TextGeometry, real geometry)
	textMode: 'troika' | 'true3d';
	true3dFontFile: string; // typeface.json filename from static/fonts/
	// VIDEO TEXTURE ON TEXT (INSANE FEATURE!)
	useVideoTexture: boolean;
	videoTextureScale: number; // How to scale/fit video on letters
	videoTextureOffset: { x: number; y: number }; // Position video on letters
	// Content
	text: string;
	fontFamily: string;
	fontUrl: string | null; // URL to the actual font file from Google Fonts API

	// Size & Scale
	fontSize: number; // Base font size (will be divided by 50 for Three.js units)
	scale3D: number; // Overall scale multiplier

	// Position (Three.js world coordinates)
	position3D: {
		x: number;
		y: number;
		z: number;
	};

	// Rotation (radians)
	rotation3D: {
		x: number;
		y: number;
		z: number;
	};
	// Advanced Text Features
	letterSpacing: number;
	curveRadius: number;

	// Color Animation
	colorCycling: boolean;
	colorCycleSpeed: number;

	// Material Properties
	materialType: 'standard' | 'phong' | 'basic' | 'normal';
	materialColor: string; // Hex color
	metalness: number; // 0-1
	roughness: number; // 0-1
	emissive: string; // Hex color
	emissiveIntensity: number; // 0-1
	wireframe: boolean;

	// 3D Effect Properties (simulated with Troika)
	extrudeDepth: number; // Simulated with stroke
	bevelEnabled: boolean; // Simulated with outline
	bevelThickness: number; // Outline width
	bevelSize: number; // Not used in Troika
	bevelSegments: number; // Not used in Troika
	curveSegments: number; // Not used in Troika

	// Animation
	autoRotate: boolean;
	autoRotateSpeed: number;
	animationType:
		| 'none'
		| 'spin'
		| 'wave'
		| 'float'
		| 'bounce'
		| 'pulse'
		| 'swing'
		| 'jitter'
		| 'spiral'
		| 'elastic'
		| 'glitch'
		| 'orbit'
		| 'wobble';
}

export interface Text3DState extends Text3DParams {
	// Enable/Disable (legacy single-text flag — instances render via entries)
	enabled: boolean;
	use3D: boolean; // Legacy - always true now, kept for compatibility

	// Fog Effect (scene-global, not per instance)
	fogEnabled: boolean;
	fogColor: string;
	fogNear: number;
	fogFar: number;

	// Timing & Fade — LEGACY single-text fields; instances take timing from
	// their timeline clip instead.
	textStartTime: number;
	textEndTime: number;
	textFadeIn: number;
	textFadeOut: number;

	// Multi-instance
	entries: Record<string, Text3DParams>;
	activeEntryId: string | null;
}

const PARAM_KEYS: (keyof Text3DParams)[] = [
	'textMode', 'true3dFontFile', 'useVideoTexture', 'videoTextureScale', 'videoTextureOffset',
	'text', 'fontFamily', 'fontUrl', 'fontSize', 'scale3D', 'position3D', 'rotation3D',
	'letterSpacing', 'curveRadius', 'colorCycling', 'colorCycleSpeed',
	'materialType', 'materialColor', 'metalness', 'roughness', 'emissive', 'emissiveIntensity', 'wireframe',
	'extrudeDepth', 'bevelEnabled', 'bevelThickness', 'bevelSize', 'bevelSegments', 'curveSegments',
	'autoRotate', 'autoRotateSpeed', 'animationType'
];

function pickParams(s: Text3DState): Text3DParams {
	const p = {} as Record<string, unknown>;
	for (const k of PARAM_KEYS) p[k] = s[k];
	return structuredClone(p) as unknown as Text3DParams;
}

const initialState: Text3DState = {
	// Enable/Disable
	enabled: false,
	use3D: true,
	textMode: 'troika',
	true3dFontFile: 'helvetiker_bold.typeface.json',
	// VIDEO TEXTURE
	useVideoTexture: false,
	videoTextureScale: 1.0,
	videoTextureOffset: { x: 0, y: 0 },
	// Content
	text: 'Sample Text',
	fontFamily: 'Roboto',
	fontUrl: null,

	// Size & Scale
	fontSize: 30,
	scale3D: 1.0,

	// Position
	position3D: { x: 0, y: 0, z: 4.1 },

	// Rotation
	rotation3D: {
		x: 0,
		y: 0,
		z: 0
	},
	// Timing & Fade
	textStartTime: 0,
	textEndTime: 9999,
	textFadeIn: 0,
	textFadeOut: 0,

	// Animation
	autoRotate: false,
	autoRotateSpeed: 0.01,
	animationType: 'none',
	letterSpacing: 0,
	curveRadius: 0,
	colorCycling: false,
	colorCycleSpeed: 0.5,
	fogEnabled: false,
	fogColor: '#888888',
	fogNear: 5,
	fogFar: 20,
	// Material
	materialType: 'standard',
	materialColor: '#ffffff',
	metalness: 0.5,
	roughness: 0.5,
	emissive: '#000000',
	emissiveIntensity: 0.0,
	wireframe: false,

	// 3D Effects
	extrudeDepth: 0.1, // ✅ Increased from 0.2 for better visibility
	bevelEnabled: true,
	bevelThickness: 0.05, // ✅ Increased from 0.03 for better visibility
	bevelSize: 0.05, // ✅ Increased from 0.02
	bevelSegments: 3,
	curveSegments: 12,

	// Multi-instance
	entries: {},
	activeEntryId: null
};

function createText3DStore() {
	const { subscribe, set, update: rawUpdate } = writable<Text3DState>(initialState);

	// Every flat-field mutation mirrors into the active entry, so the accordion
	// always edits "the focused instance" without any call-site changes.
	function update(fn: (s: Text3DState) => Text3DState) {
		rawUpdate((s) => {
			const next = fn(s);
			if (!next.activeEntryId || !next.entries[next.activeEntryId]) return next;
			return {
				...next,
				entries: { ...next.entries, [next.activeEntryId]: pickParams(next) }
			};
		});
	}

	return {
		subscribe,
		set,
		update,

		// ── MULTI-INSTANCE ───────────────────────────────────────────────
		// New instance = snapshot of the CURRENT flat params (style once, stamp many)
		addEntry: (id: string) => {
			rawUpdate((s) => ({
				...s,
				entries: { ...s.entries, [id]: pickParams(s) },
				activeEntryId: id
			}));
		},

		// Load an entry into the flat editing surface and make it active
		setActiveEntry: (id: string | null) => {
			rawUpdate((s) => {
				if (!id) return { ...s, activeEntryId: null };
				const entry = s.entries[id];
				if (!entry) return { ...s, activeEntryId: id };
				return { ...s, ...structuredClone(entry), activeEntryId: id };
			});
		},

		removeEntry: (id: string) => {
			rawUpdate((s) => {
				const entries = { ...s.entries };
				delete entries[id];
				return { ...s, entries, activeEntryId: s.activeEntryId === id ? null : s.activeEntryId };
			});
		},

		// Update any property dynamically (for generic control panel use)
		updateProperty: <K extends keyof Text3DState>(key: K, value: Text3DState[K]) => {
			update((state) => ({ ...state, [key]: value }));
		},

		setTextStartTime: (v: number) => update((s) => ({ ...s, textStartTime: v })),
		setTextEndTime: (v: number) => update((s) => ({ ...s, textEndTime: v })),
		setTextFadeIn: (v: number) => update((s) => ({ ...s, textFadeIn: v })),
		setTextFadeOut: (v: number) => update((s) => ({ ...s, textFadeOut: v })),

		// Toggle 3D text on/off
		toggle: () => {
			update((state) => ({ ...state, enabled: !state.enabled }));
		},

		// Enable 3D text
		enable: () => {
			update((state) => ({ ...state, enabled: true }));
		},

		// Disable 3D text
		disable: () => {
			update((state) => ({ ...state, enabled: false }));
		},

		// Update text content
		setText: (text: string) => {
			update((state) => ({ ...state, text }));
		},

		// Update font family
		setFont: (fontFamily: string) => {
			update((state) => ({ ...state, fontFamily }));
		},

		// Update font family and URL together
		setFontWithUrl: (fontFamily: string, fontUrl: string | null) => {
			update((state) => ({ ...state, fontFamily, fontUrl }));
		},

		// Update font size
		setFontSize: (fontSize: number) => {
			update((state) => ({ ...state, fontSize }));
		},

		// Update position
		setPosition: (x: number, y: number, z: number) => {
			update((state) => ({
				...state,
				position3D: { x, y, z }
			}));
		},

		// Update position property (for individual axis updates)
		updatePosition3D: (axis: 'x' | 'y' | 'z', value: number) => {
			update((state) => ({
				...state,
				position3D: { ...state.position3D, [axis]: value }
			}));
		},

		// Update rotation
		setRotation: (x: number, y: number, z: number) => {
			update((state) => ({
				...state,
				rotation3D: { x, y, z }
			}));
		},

		// Update rotation property (for individual axis updates)
		updateRotation3D: (axis: 'x' | 'y' | 'z', value: number) => {
			update((state) => ({
				...state,
				rotation3D: { ...state.rotation3D, [axis]: value }
			}));
		},

		// Update scale
		setScale: (scale: number) => {
			update((state) => ({ ...state, scale3D: scale }));
		},

		// Update color
		setColor: (color: string) => {
			update((state) => ({ ...state, materialColor: color }));
		},

		// Update material properties
		setMaterial: (
			props: Partial<
				Pick<Text3DState, 'metalness' | 'roughness' | 'emissive' | 'emissiveIntensity'>
			>
		) => {
			update((state) => ({ ...state, ...props }));
		},

		// Update 3D effect properties
		set3DEffects: (
			props: Partial<Pick<Text3DState, 'extrudeDepth' | 'bevelEnabled' | 'bevelThickness'>>
		) => {
			update((state) => ({ ...state, ...props }));
		},

		// Set animation type
		setAnimation: (animationType: Text3DState['animationType']) => {
			update((state) => ({ ...state, animationType }));
		},

		// Set text mode (troika = Google Fonts 2.5-D, true3d = TextGeometry)
		setTextMode: (mode: 'troika' | 'true3d') => {
			update((state) => ({ ...state, textMode: mode }));
		},

		// Set True 3D font file
		setTrue3dFont: (fontFile: string) => {
			update((state) => ({ ...state, true3dFontFile: fontFile }));
		},

		// Toggle auto-rotate
		toggleAutoRotate: () => {
			update((state) => ({ ...state, autoRotate: !state.autoRotate }));
		},

		// Set auto-rotate speed
		setAutoRotateSpeed: (speed: number) => {
			update((state) => ({ ...state, autoRotateSpeed: speed }));
		},

		// Reset to defaults
		reset: () => {
			set(initialState);
		},

		// Reset just position and rotation
		resetTransform: () => {
			update((state) => ({
				...state,
				position3D: initialState.position3D,
				rotation3D: initialState.rotation3D,
				scale3D: initialState.scale3D
			}));
		},

		// Preset configurations
		presets: {
			// Bold title preset
			title: () => {
				update((state) => ({
					...state,
					fontSize: 120,
					bevelEnabled: true,
					bevelThickness: 0.05,
					extrudeDepth: 0.3,
					materialColor: '#ffffff',
					metalness: 0.8,
					roughness: 0.2
				}));
			},

			// Subtle subtitle preset
			subtitle: () => {
				update((state) => ({
					...state,
					fontSize: 60,
					bevelEnabled: false,
					extrudeDepth: 0.1,
					materialColor: '#cccccc',
					metalness: 0.3,
					roughness: 0.7
				}));
			},

			// Neon glow preset
			neon: () => {
				update((state) => ({
					...state,
					fontSize: 100,
					bevelEnabled: true,
					bevelThickness: 0.08,
					materialColor: '#00ffff',
					emissive: '#00ffff',
					emissiveIntensity: 0.8,
					metalness: 0.9,
					roughness: 0.1
				}));
			},

			// Classic gold preset
			gold: () => {
				update((state) => ({
					...state,
					fontSize: 100,
					bevelEnabled: true,
					bevelThickness: 0.05,
					extrudeDepth: 0.25,
					materialColor: '#ffd700',
					emissive: '#ff8800',
					emissiveIntensity: 0.2,
					metalness: 0.9,
					roughness: 0.3
				}));
			}
		}
	};
}

export const text3DState = createText3DStore();
