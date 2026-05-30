// src/lib/types/troika-three-text.d.ts
// Type declarations for troika-three-text library

declare module 'troika-three-text' {
	import * as THREE from 'three';

	export class Text extends THREE.Object3D {
		constructor();

		// Text content
		text: string;
		
		// Font properties
		font: string | null;
		fontSize: number;
		fontWeight: number | 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
		fontStyle: 'normal' | 'italic';
		
		// Layout
		anchorX: number | 'left' | 'center' | 'right';
		anchorY: number | 'top' | 'top-baseline' | 'middle' | 'bottom-baseline' | 'bottom';
		textAlign: 'left' | 'right' | 'center' | 'justify';
		textIndent: number;
		lineHeight: number | 'normal';
		letterSpacing: number;
		maxWidth: number;
		overflowWrap: 'normal' | 'break-word';
		whiteSpace: 'normal' | 'nowrap';
		
		// Appearance
		color: THREE.ColorRepresentation;
		fillOpacity: number;
		
		// Outline
		outlineWidth: number | string;
		outlineColor: THREE.ColorRepresentation;
		outlineOpacity: number;
		outlineBlur: number | string;
		outlineOffsetX: number | string;
		outlineOffsetY: number | string;
		
		// Stroke
		strokeWidth: number | string;
		strokeColor: THREE.ColorRepresentation;
		strokeOpacity: number;
		
		// Effects
		depthOffset: number;
		clipRect: [number, number, number, number] | null;
		orientation: string;
		glyphGeometryDetail: number;
		sdfGlyphSize: number;
		gpuAccelerateSDF: boolean;
		
		// Rendering
		material: THREE.Material | null;
		
		// Methods
		sync(callback?: () => void): void;
		dispose(): void;
		
		// Read-only computed properties
		readonly textRenderInfo: {
			parameters: any;
			sdfTexture: THREE.Texture;
			blockBounds: [number, number, number, number];
			chunkedBounds: Array<[number, number, number, number]>;
			glyphBounds: Array<[number, number, number, number]>;
			glyphIndices: Uint16Array;
			glyphPositions: Float32Array;
			glyphData: any;
			caretPositions: Float32Array;
			caretHeight: number;
			ascender: number;
			descender: number;
			lineHeight: number;
			topBaseline: number;
		} | null;
	}

	export function preloadFont(
		options: {
			font: string;
			characters?: string;
			sdfGlyphSize?: number;
		},
		callback?: () => void
	): void;
}