// src/lib/utils/textClipRender.ts
// Text clips are image clips: the text renders onto a transparent 1920×1080
// reference frame, becomes an <img> in ThreeJsScene's imageElements map, and
// inherits everything image clips already have — transform, fades, transitions,
// focus, undo, export baking. Editing the spec re-renders the image reactively.

export interface TextClipSpec {
	content: string;
	size: number;   // px against the 1920×1080 reference frame
	color: string;
	font: string;
	bold: boolean;
}

export const DEFAULT_TEXT_SPEC: TextClipSpec = {
	content: 'Your Text',
	size: 110,
	color: '#ffffff',
	font: 'Impact',
	bold: false
};

// Web-safe stacks only — no font loading, so the canvas render is synchronous
export const TEXT_FONTS = [
	'Impact',
	'Arial',
	'Verdana',
	'Georgia',
	'Times New Roman',
	'Courier New',
	'Trebuchet MS',
	'Comic Sans MS'
] as const;

export function renderTextClipImage(spec: TextClipSpec): string {
	const W = 1920;
	const H = 1080;
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.font = `${spec.bold ? 'bold ' : ''}${spec.size}px "${spec.font}"`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	// Soft drop shadow so light text survives light footage
	ctx.shadowColor = 'rgba(0,0,0,0.75)';
	ctx.shadowBlur = spec.size * 0.08;
	ctx.shadowOffsetY = spec.size * 0.03;
	ctx.fillStyle = spec.color;
	const lines = spec.content.split('\n');
	const lineH = spec.size * 1.2;
	const y0 = H / 2 - ((lines.length - 1) * lineH) / 2;
	lines.forEach((line, i) => ctx.fillText(line, W / 2, y0 + i * lineH));
	return canvas.toDataURL('image/png');
}
