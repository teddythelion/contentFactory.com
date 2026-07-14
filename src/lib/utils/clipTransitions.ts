// src/lib/utils/clipTransitions.ts
// Per-clip transition catalog — xfade-style effects implemented as Canvas 2D
// draw state (clip paths, offsets, filters, alpha), NOT FFmpeg. The compositor
// applies them in updateCompositeFrame, so preview and export are pixel-identical
// (capture drives the same draw path) and the server never touches pixels.
//
// Semantics: each clip has an IN window (first fadeIn seconds) and an OUT window
// (last fadeOut seconds). p = visibility progress: 1 = fully shown, 0 = hidden.
// The IN window sweeps p 0→1, the OUT window sweeps p 1→0.

export type TransitionType =
	| 'fade'
	| 'fadewhite'
	| 'fadegrays'
	| 'hblur'
	| 'dissolve'
	| 'pixelize'
	| 'circleopen'
	| 'circleclose'
	| 'rectcrop'
	| 'radial'
	| 'diagtl'
	| 'wipeleft'
	| 'wiperight'
	| 'wipeup'
	| 'wipedown'
	| 'slideleft'
	| 'slideright'
	| 'slideup'
	| 'slidedown'
	| 'hlslice'
	| 'vdslice';

export type TransitionPhase = 'in' | 'out';

// Tile metadata for the picker UI — `tile` is a CSS background that sketches
// what the transition does (Ted's "representation, not a video thumbnail").
export interface TransitionMeta {
	id: TransitionType;
	label: string;
	tile: string;
	glyph?: string;
}

const Y = 'rgba(250,204,21,0.85)'; // yellow accent used across the tiles

export const TRANSITIONS: TransitionMeta[] = [
	{ id: 'fade',        label: 'Fade',        tile: `linear-gradient(to right, ${Y}, transparent)` },
	{ id: 'fadewhite',   label: 'Fade White',  tile: 'linear-gradient(to right, rgba(255,255,255,0.9), transparent)' },
	{ id: 'fadegrays',   label: 'Fade Gray',   tile: 'linear-gradient(to right, rgba(156,163,175,0.9), transparent)' },
	{ id: 'hblur',       label: 'Blur',        tile: `radial-gradient(ellipse at center, ${Y} 0%, transparent 75%)` },
	{ id: 'dissolve',    label: 'Dissolve',    tile: `radial-gradient(${Y} 30%, transparent 32%) 0 0 / 7px 7px` },
	{ id: 'pixelize',    label: 'Pixelize',    tile: `conic-gradient(${Y} 25%, transparent 0 50%, ${Y} 0 75%, transparent 0) 0 0 / 10px 10px` },
	{ id: 'circleopen',  label: 'Circle Open', tile: `radial-gradient(circle, ${Y} 42%, transparent 44%)` },
	{ id: 'circleclose', label: 'Circle Close',tile: `radial-gradient(circle, transparent 42%, ${Y} 44%)` },
	{ id: 'rectcrop',    label: 'Rect Crop',   tile: `linear-gradient(${Y}, ${Y}) center / 60% 60% no-repeat` },
	{ id: 'radial',      label: 'Clock Wipe',  tile: `conic-gradient(${Y} 0 30%, transparent 30%)` },
	{ id: 'diagtl',      label: 'Diagonal',    tile: `linear-gradient(135deg, ${Y} 50%, transparent 50%)` },
	{ id: 'wipeleft',    label: 'Wipe',        tile: `linear-gradient(to left, ${Y} 55%, transparent 55%)`,  glyph: '←' },
	{ id: 'wiperight',   label: 'Wipe',        tile: `linear-gradient(to right, ${Y} 55%, transparent 55%)`, glyph: '→' },
	{ id: 'wipeup',      label: 'Wipe',        tile: `linear-gradient(to top, ${Y} 55%, transparent 55%)`,   glyph: '↑' },
	{ id: 'wipedown',    label: 'Wipe',        tile: `linear-gradient(to bottom, ${Y} 55%, transparent 55%)`,glyph: '↓' },
	{ id: 'slideleft',   label: 'Slide',       tile: `linear-gradient(to left, ${Y}, transparent)`,  glyph: '←' },
	{ id: 'slideright',  label: 'Slide',       tile: `linear-gradient(to right, ${Y}, transparent)`, glyph: '→' },
	{ id: 'slideup',     label: 'Slide',       tile: `linear-gradient(to top, ${Y}, transparent)`,   glyph: '↑' },
	{ id: 'slidedown',   label: 'Slide',       tile: `linear-gradient(to bottom, ${Y}, transparent)`,glyph: '↓' },
	{ id: 'hlslice',     label: 'Slices',      tile: `repeating-linear-gradient(to right, ${Y} 0 5px, transparent 5px 10px)`,  glyph: '||' },
	{ id: 'vdslice',     label: 'Slices',      tile: `repeating-linear-gradient(to bottom, ${Y} 0 4px, transparent 4px 8px)`, glyph: '=' }
];

// Which phase of a clip covers `now`, and how far through it we are.
// Structurally typed so this module stays independent of the timeline store.
export function clipTransitionState(
	clip: { startTime: number; endTime: number; fadeIn?: number; fadeOut?: number; transitionIn?: TransitionType; transitionOut?: TransitionType },
	now: number
): { p: number; type: TransitionType; phase: TransitionPhase } {
	const fi = clip.fadeIn ?? 0;
	const fo = clip.fadeOut ?? 0;
	if (fi > 0 && now < clip.startTime + fi) {
		return { p: clamp01((now - clip.startTime) / fi), type: clip.transitionIn ?? 'fade', phase: 'in' };
	}
	if (fo > 0 && now > clip.endTime - fo) {
		return { p: clamp01((clip.endTime - now) / fo), type: clip.transitionOut ?? 'fade', phase: 'out' };
	}
	return { p: 1, type: 'fade', phase: 'in' };
}

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

// Everything the compositor needs to set up before drawing the source.
export interface TransitionFX {
	alpha: number;
	dx: number;
	dy: number;
	filter: string | null;
	clipPath: Path2D | null;
	clipRule: CanvasFillRule;
	pixelize: number; // 0 = off, else 0..1 block strength (compositor downsamples)
	overlay: { color: string; alpha: number } | null; // drawn over the slot after the source
}

// Stable pseudo-random per dissolve cell — same pattern every frame/export
function cellRand(i: number): number {
	const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
	return s - Math.floor(s);
}

export function computeTransitionFX(
	type: TransitionType,
	p: number,
	phase: TransitionPhase,
	x: number,
	y: number,
	w: number,
	h: number
): TransitionFX {
	const fx: TransitionFX = { alpha: 1, dx: 0, dy: 0, filter: null, clipPath: null, clipRule: 'nonzero', pixelize: 0, overlay: null };
	const q = 1 - p; // hidden fraction

	switch (type) {
		case 'fade':
			fx.alpha = p;
			break;
		case 'fadewhite':
			fx.alpha = p;
			fx.overlay = { color: '#ffffff', alpha: q };
			break;
		case 'fadegrays':
			fx.filter = `grayscale(${Math.round(q * 100)}%)`;
			fx.alpha = Math.min(1, p * 2); // gray first, fade in the last half
			break;
		case 'hblur':
			fx.filter = `blur(${(q * 16).toFixed(1)}px)`;
			fx.alpha = Math.min(1, p * 2);
			break;
		case 'pixelize':
			fx.pixelize = q;
			fx.alpha = Math.min(1, p * 3); // blocks carry most of the effect
			break;
		case 'dissolve': {
			// Random cells appear/disappear — a real dissolve, stable across frames
			const cols = 24, rows = 14;
			const cw = w / cols, ch = h / rows;
			const path = new Path2D();
			for (let i = 0; i < cols * rows; i++) {
				if (cellRand(i) < p) {
					path.rect(x + (i % cols) * cw, y + Math.floor(i / cols) * ch, cw + 0.5, ch + 0.5);
				}
			}
			fx.clipPath = path;
			break;
		}
		case 'circleopen': {
			const path = new Path2D();
			path.arc(x + w / 2, y + h / 2, Math.hypot(w, h) / 2 * p, 0, Math.PI * 2);
			fx.clipPath = path;
			break;
		}
		case 'circleclose': {
			// Visible OUTSIDE a growing center hole (iris)
			const path = new Path2D();
			path.rect(x, y, w, h);
			path.arc(x + w / 2, y + h / 2, Math.hypot(w, h) / 2 * q, 0, Math.PI * 2);
			fx.clipPath = path;
			fx.clipRule = 'evenodd';
			break;
		}
		case 'rectcrop': {
			const path = new Path2D();
			path.rect(x + (w - w * p) / 2, y + (h - h * p) / 2, w * p, h * p);
			fx.clipPath = path;
			break;
		}
		case 'radial': {
			// Clock wipe from 12 o'clock
			const path = new Path2D();
			const cx0 = x + w / 2, cy0 = y + h / 2;
			path.moveTo(cx0, cy0);
			path.arc(cx0, cy0, Math.hypot(w, h) / 2, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
			path.closePath();
			fx.clipPath = path;
			break;
		}
		case 'diagtl': {
			// Diagonal sweep anchored top-left
			const d = p * 2;
			const path = new Path2D();
			path.moveTo(x, y);
			path.lineTo(x + w * d, y);
			path.lineTo(x, y + h * d);
			path.closePath();
			fx.clipPath = path;
			break;
		}
		case 'wipeleft': {
			const path = new Path2D();
			path.rect(x + w * q, y, w * p, h); // edge sweeps leftward, anchored right
			fx.clipPath = path;
			break;
		}
		case 'wiperight': {
			const path = new Path2D();
			path.rect(x, y, w * p, h); // anchored left
			fx.clipPath = path;
			break;
		}
		case 'wipeup': {
			const path = new Path2D();
			path.rect(x, y + h * q, w, h * p); // anchored bottom
			fx.clipPath = path;
			break;
		}
		case 'wipedown': {
			const path = new Path2D();
			path.rect(x, y, w, h * p); // anchored top
			fx.clipPath = path;
			break;
		}
		// Slides: direction = where the content moves toward. IN enters from the
		// opposite edge; OUT exits toward the named edge.
		case 'slideleft':
			fx.dx = phase === 'in' ? w * q : -w * q;
			break;
		case 'slideright':
			fx.dx = phase === 'in' ? -w * q : w * q;
			break;
		case 'slideup':
			fx.dy = phase === 'in' ? h * q : -h * q;
			break;
		case 'slidedown':
			fx.dy = phase === 'in' ? -h * q : h * q;
			break;
		case 'hlslice': {
			// Vertical blinds, each slice fills left→right
			const n = 12, sw = w / n;
			const path = new Path2D();
			for (let i = 0; i < n; i++) path.rect(x + i * sw, y, sw * p + 0.5, h);
			fx.clipPath = path;
			break;
		}
		case 'vdslice': {
			// Horizontal blinds, each slice fills top→down
			const n = 8, sh = h / n;
			const path = new Path2D();
			for (let i = 0; i < n; i++) path.rect(x, y + i * sh, w, sh * p + 0.5);
			fx.clipPath = path;
			break;
		}
	}
	return fx;
}
