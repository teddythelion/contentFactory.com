<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
	import { FontLoader } from 'three/addons/loaders/FontLoader.js';

	export let imageUrl: string = '';
	export let onClose: () => void;
	export let onSendToVideoRefs: ((dataUrl: string) => void) | null = null;

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let mesh: THREE.Mesh;
	let textMesh: THREE.Mesh | null = null;
	let animationId: number;
	let texture: THREE.Texture;

	// Control states
	let rotationX = 0;
	let rotationY = 0;
	let rotationZ = 0;
	let autoRotate = false;
	let autoRotateSpeed = 0.01;
	let cameraDistance = 5;
	let scale = 1;

	// Shape selection
	let selectedShape = 'plane';
	const shapes = ['plane', 'sphere', 'cube', 'cylinder', 'pyramid', 'torus'];

	// Lighting controls
	let ambientIntensity = 1.0;
	let directionalIntensity = 0.4;

	// Effects
	let imageGlow = 0;
	let shapeGlow = 0;

	// TEXT CONTROLS
	let textContent = '';
	let textSize = 1;
	let textColor = '#ffffff';
	let textOpacity = 1;
	let textGlow = 0;
	let textRotationX = 0;
	let textRotationY = 0;
	let textRotationZ = 0;
	let textPositionX = 0;
	let textPositionY = 0;
	let textPositionZ = 2;
	let textAutoRotate = false;
	let textAutoRotateSpeed = 0.01;
	let selectedFont = 'Roboto';
	let textMode = '2d';
	let selected3DFont = 'helvetiker_regular';
	let textExtrusionDepth = 0.5;
	let bevelEnabled = true;
	let bevelThickness = 0.05;
	let bevelSize = 0.02;
	let loadedFont: any = null;

	// ===== CROP & STRAIGHTEN =====
	let cropLeft = 0;
	let cropRight = 0;
	let cropTop = 0;
	let cropBottom = 0;
	let straighten = 0; // degrees -45 to 45
	let blur = 0;       // 0 to 1

	// ===== LOGO OVERLAY =====
	let logoEnabled = false;
	let logoUrl = '';
	let logoScale = 1;
	let logoOpacity = 1;
	let logoRotationX = 0;
	let logoRotationY = 0;
	let logoRotationZ = 0;
	let logoPositionX = 0;
	let logoPositionY = 0;
	let logoPositionZ = 3;
	let logoAutoRotate = false;
	let logoAutoRotateSpeed = 0.01;
	let logoMesh: THREE.Mesh | null = null;

	// ===== LOGO ANIMATIONS =====
	let logoAnimation = 'none';
	let logoAnimationSpeed = 1;
	let logoAnimationIntensity = 0.5;
	let logoAnimationTime = 0;

	// ===== IMAGE ADJUSTMENTS =====
	let brightness = 0;       // -0.5 to 0.5
	let contrast = 0;         // -0.5 to 0.5
	let saturation = 0;       // -1 to 1
	let hue = 0;              // -180 to 180
	let temperature = 0;      // -1 to 1 (cool → warm)
	let vignetteStrength = 0; // 0 to 1
	let shadows = 0;          // -0.5 to 0.5
	let mids = 0;
	let highlights = 0;

	// ===== COLOR OVERLAY =====
	let colorOverlayEnabled = false;
	let colorOverlayColor = '#3b82f6';
	let colorOverlayOpacity = 0.3;
	let colorOverlayBlendMode = 'screen'; // none, multiply, screen, overlay

	// ===== GRADIENT OVERLAY =====
	let gradientEnabled = false;
	let gradientColor = '#000000';
	let gradientOpacity = 0.5;
	let gradientType = 'linear'; // linear, radial

	// ===== WATERMARK =====
	let watermarkEnabled = false;
	let watermarkUrl = '';
	let watermarkCorner = 'BR'; // TL, TR, BL, BR
	let watermarkScale = 0.5;
	let watermarkOpacity = 0.7;
	let watermarkMesh: THREE.Mesh | null = null;
	let watermarkTexture: THREE.Texture | null = null;
	let watermarkLoadId = 0; // cancel stale async loads

	// ===== DRAG STATE =====
	const raycaster = new THREE.Raycaster();
	let dragTarget: THREE.Mesh | null = null;
	const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1));
	const dragOffset = new THREE.Vector3();
	const dragIntersect = new THREE.Vector3();
	let watermarkManualX: number | null = null;
	let watermarkManualY: number | null = null;
	// Shape rotation drag
	let isRotating = false;
	let prevDragPos = { x: 0, y: 0 };

	// ===== AI RE-EDIT =====
	let aiPrompt = '';
	let isRegenerating = false;

	// Shader uniform reference for real-time updates
	let meshShaderRef: { uniforms: Record<string, { value: any }> } | null = null;

	// ===== FILTER PRESETS =====
	const filterPresets: Record<
		string,
		{
			imageGlow: number;
			shapeGlow: number;
			ambientIntensity: number;
			directionalIntensity: number;
			textGlow: number;
		}
	> = {
		cinematic: {
			imageGlow: 0.2,
			shapeGlow: 0.3,
			ambientIntensity: 0.8,
			directionalIntensity: 0.6,
			textGlow: 0.3
		},
		neon: {
			imageGlow: 0.8,
			shapeGlow: 0.9,
			ambientIntensity: 0.6,
			directionalIntensity: 0.3,
			textGlow: 0.8
		},
		gold: {
			imageGlow: 0.4,
			shapeGlow: 0.2,
			ambientIntensity: 1.0,
			directionalIntensity: 0.5,
			textGlow: 0.4
		},
		dark: {
			imageGlow: 0,
			shapeGlow: 0,
			ambientIntensity: 0.5,
			directionalIntensity: 0.6,
			textGlow: 0.1
		},
		bright: {
			imageGlow: 0.6,
			shapeGlow: 0.3,
			ambientIntensity: 1.4,
			directionalIntensity: 0.5,
			textGlow: 0.6
		}
	};

	const googleFonts = [
		'Roboto',
		'Open Sans',
		'Lato',
		'Montserrat',
		'Oswald',
		'Raleway',
		'Poppins',
		'Merriweather',
		'Playfair Display',
		'Bebas Neue'
	];
	const threejsFonts = [
		{ name: 'Helvetiker', value: 'helvetiker_regular' },
		{ name: 'Helvetiker Bold', value: 'helvetiker_bold' },
		{ name: 'Optimer', value: 'optimer_regular' },
		{ name: 'Optimer Bold', value: 'optimer_bold' },
		{ name: 'Gentilis', value: 'gentilis_regular' },
		{ name: 'Gentilis Bold', value: 'gentilis_bold' },
		{ name: 'Droid Sans', value: 'droid_sans_regular' },
		{ name: 'Droid Sans Bold', value: 'droid_sans_bold' },
		{ name: 'Droid Sans Mono', value: 'droid_sans_mono_regular' },
		{ name: 'Droid Serif', value: 'droid_serif_regular' },
		{ name: 'Droid Serif Bold', value: 'droid_serif_bold' }
	];

	let ambientLight: THREE.AmbientLight;
	let directionalLight: THREE.DirectionalLight;
	let fillLight: THREE.DirectionalLight;

	onMount(() => {
		if (!imageUrl) return;
		loadGoogleFonts();
		initThreeJS();
		// Add drag listeners here (after initThreeJS) so all handler functions are in scope
		canvas.addEventListener('mousedown', onCanvasMouseDown);
		canvas.addEventListener('mousemove', onCanvasMouseMove);
		canvas.addEventListener('mouseup', onCanvasPointerUp);
		canvas.addEventListener('mouseleave', onCanvasPointerUp);
		canvas.addEventListener('touchstart', onCanvasTouchStart, { passive: false });
		canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
		canvas.addEventListener('touchend', onCanvasPointerUp);
		return () => {
			if (animationId) cancelAnimationFrame(animationId);
			if (renderer) renderer.dispose();
			if (texture) texture.dispose();
			canvas.removeEventListener('mousedown', onCanvasMouseDown);
			canvas.removeEventListener('mousemove', onCanvasMouseMove);
			canvas.removeEventListener('mouseup', onCanvasPointerUp);
			canvas.removeEventListener('mouseleave', onCanvasPointerUp);
			canvas.removeEventListener('touchstart', onCanvasTouchStart);
			canvas.removeEventListener('touchmove', onCanvasTouchMove);
			canvas.removeEventListener('touchend', onCanvasPointerUp);
			window.removeEventListener('resize', handleResize);
		};
	});

	function loadGoogleFonts() {
		const link = document.createElement('link');
		link.href = `https://fonts.googleapis.com/css2?${googleFonts.map((font) => `family=${font.replace(/ /g, '+')}`).join('&')}&display=swap`;
		link.rel = 'stylesheet';
		document.head.appendChild(link);
	}

	function load3DFont(fontName: string) {
		const loader = new FontLoader();
		const fontPath = `/fonts/${fontName}.typeface.json`;
		loader.load(
			fontPath,
			(font) => {
				loadedFont = font;
				if (textMode === '3d') create3DText();
			},
			undefined,
			(error) => console.error('Error loading font:', error)
		);
	}

	function initThreeJS() {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a1a);

		camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
		camera.position.z = cameraDistance;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

		ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
		scene.add(ambientLight);

		directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
		directionalLight.position.set(5, 5, 5);
		scene.add(directionalLight);

		fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
		fillLight.position.set(-5, -3, -5);
		scene.add(fillLight);

		const textureLoader = new THREE.TextureLoader();
		textureLoader.load(imageUrl, (loadedTexture) => {
			texture = loadedTexture;
			applyShapeDefaults(selectedShape);
			createMesh(selectedShape);
			animate();
			canvas.style.cursor = selectedShape !== 'plane' ? 'grab' : 'default';
		});

		window.addEventListener('resize', handleResize);
	}

	const IMAGE_VERT = `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
	`;

	const IMAGE_FRAG = `
		uniform sampler2D map;
		uniform float uBrightness;
		uniform float uContrast;
		uniform float uSaturation;
		uniform float uHue;
		uniform float uTemperature;
		uniform float uVignette;
		uniform float uShadows;
		uniform float uMids;
		uniform float uHighlights;
		uniform float uOverlayOpacity;
		uniform vec3  uOverlayColor;
		uniform float uOverlayMode;
		uniform float uGradientOpacity;
		uniform vec3  uGradientColor;
		uniform float uGradientType;
		uniform float uGlow;
		uniform float uOpacity;
		uniform float uBlur;
		uniform float uCropLeft;
		uniform float uCropRight;
		uniform float uCropTop;
		uniform float uCropBottom;
		uniform float uStraighten;
		varying vec2 vUv;

		vec3 rgb2hsl(vec3 c) {
			float mx = max(c.r, max(c.g, c.b));
			float mn = min(c.r, min(c.g, c.b));
			float h = 0.0, s = 0.0, l = (mx + mn) / 2.0;
			if (mx != mn) {
				float d = mx - mn;
				s = l > 0.5 ? d / (2.0 - mx - mn) : d / (mx + mn);
				if (mx == c.r)      h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
				else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
				else                h = (c.r - c.g) / d + 4.0;
				h /= 6.0;
			}
			return vec3(h, s, l);
		}
		float hue2rgb(float p, float q, float t) {
			if (t < 0.0) t += 1.0;
			if (t > 1.0) t -= 1.0;
			if (t < 1.0/6.0) return p + (q-p)*6.0*t;
			if (t < 1.0/2.0) return q;
			if (t < 2.0/3.0) return p + (q-p)*(2.0/3.0-t)*6.0;
			return p;
		}
		vec3 hsl2rgb(vec3 c) {
			if (c.y == 0.0) return vec3(c.z);
			float q = c.z < 0.5 ? c.z*(1.0+c.y) : c.z+c.y-c.z*c.y;
			float p = 2.0*c.z - q;
			return vec3(hue2rgb(p,q,c.x+1.0/3.0), hue2rgb(p,q,c.x), hue2rgb(p,q,c.x-1.0/3.0));
		}

		void main() {
			// Straighten — rotate UV around center
			vec2 uv = vUv;
			if (uStraighten != 0.0) {
				float ang = uStraighten * 3.14159265 / 180.0;
				float s = sin(ang); float c = cos(ang);
				vec2 centered = uv - 0.5;
				uv = vec2(c*centered.x - s*centered.y, s*centered.x + c*centered.y) + 0.5;
			}
			// Crop — remap UV into crop window
			uv.x = uCropLeft + uv.x * (1.0 - uCropLeft - uCropRight);
			uv.y = uCropBottom + uv.y * (1.0 - uCropTop - uCropBottom);

			// Blur — 5×5 box blur
			vec4 tex;
			if (uBlur > 0.001) {
				float step = uBlur * 0.012;
				tex = vec4(0.0);
				for (int xi = -2; xi <= 2; xi++) {
					for (int yi = -2; yi <= 2; yi++) {
						tex += texture2D(map, uv + vec2(float(xi), float(yi)) * step);
					}
				}
				tex /= 25.0;
			} else {
				tex = texture2D(map, uv);
			}
			vec3 col = tex.rgb;

			// Brightness & contrast
			col += uBrightness;
			col = (col - 0.5) * (1.0 + uContrast) + 0.5;

			// Saturation & hue
			vec3 hsl = rgb2hsl(col);
			hsl.y = clamp(hsl.y * (1.0 + uSaturation), 0.0, 1.0);
			hsl.x = mod(hsl.x + uHue / 360.0, 1.0);
			col = hsl2rgb(hsl);

			// Temperature
			col.r = clamp(col.r + uTemperature * 0.12, 0.0, 1.0);
			col.b = clamp(col.b - uTemperature * 0.12, 0.0, 1.0);

			// Shadows / mids / highlights
			float luma = dot(col, vec3(0.299, 0.587, 0.114));
			float shadowMask    = clamp(1.0 - luma * 3.0, 0.0, 1.0);
			float highlightMask = clamp((luma - 0.67) * 3.0, 0.0, 1.0);
			float midMask       = 1.0 - shadowMask - highlightMask;
			col += uShadows    * shadowMask    * 0.4;
			col += uMids       * midMask       * 0.4;
			col += uHighlights * highlightMask * 0.4;

			// Vignette
			if (uVignette > 0.0) {
				vec2 uv2 = vUv - 0.5;
				float v = 1.0 - dot(uv2, uv2) * uVignette * 4.5;
				col *= clamp(v, 0.0, 1.0);
			}

			// Color overlay
			if (uOverlayOpacity > 0.0) {
				vec3 blend = col;
				if      (uOverlayMode < 0.5) blend = uOverlayColor;
				else if (uOverlayMode < 1.5) blend = col * uOverlayColor;
				else if (uOverlayMode < 2.5) blend = 1.0 - (1.0-col)*(1.0-uOverlayColor);
				else                          blend = mix(2.0*col*uOverlayColor, 1.0-2.0*(1.0-col)*(1.0-uOverlayColor), step(0.5, luma));
				col = mix(col, blend, uOverlayOpacity);
			}

			// Gradient overlay
			if (uGradientOpacity > 0.0) {
				float ga;
				if (uGradientType > 1.5) { vec2 c2 = vUv-0.5; ga = clamp(length(c2)*2.0,0.0,1.0); }
				else                      { ga = vUv.y; }
				col = mix(col, uGradientColor, ga * uGradientOpacity);
			}

			// Glow / brightness boost
			col = clamp(col * (1.0 + uGlow * 0.6), 0.0, 1.0);

			col = clamp(col, 0.0, 1.0);
			gl_FragColor = vec4(col, tex.a * uOpacity);
		}
	`;

	function buildAdjustUniforms() {
		// Use zero/neutral initial values — do NOT read Svelte slider state here.
		// Reading slider vars here would add them as reactive deps of the createMesh $: block,
		// causing a full mesh rebuild on every slider move which thrashes meshShaderRef.
		// animate() pushes all slider values to uniforms every frame, so initials don't matter.
		return {
			map:             { value: texture },
			uBrightness:     { value: 0 },
			uContrast:       { value: 0 },
			uSaturation:     { value: 0 },
			uHue:            { value: 0 },
			uTemperature:    { value: 0 },
			uVignette:       { value: 0 },
			uShadows:        { value: 0 },
			uMids:           { value: 0 },
			uHighlights:     { value: 0 },
			uOverlayOpacity: { value: 0 },
			uOverlayColor:   { value: new THREE.Color(0x000000) },
			uOverlayMode:    { value: 0.0 },
			uGradientOpacity:{ value: 0 },
			uGradientColor:  { value: new THREE.Color(0x000000) },
			uGradientType:   { value: 1.0 },
			uOpacity:        { value: 1 },
			uGlow:           { value: 0 },
			uBlur:           { value: 0 },
			uCropLeft:       { value: 0 },
			uCropRight:      { value: 0 },
			uCropTop:        { value: 0 },
			uCropBottom:     { value: 0 },
			uStraighten:     { value: 0 }
		};
	}

	const SHAPE_DEFAULTS: Record<string, { x: number; y: number; z: number }> = {
		cube:     { x: 0.4,  y: 0.6,  z: 0 },
		sphere:   { x: 0,    y: 0,    z: 0 },
		cylinder: { x: 0.15, y: 0.4,  z: 0 },
		pyramid:  { x: 0.15, y: 0.35, z: 0 },
		torus:    { x: 0.3,  y: 0.5,  z: 0 },
		plane:    { x: 0,    y: 0,    z: 0 }
	};

	function applyShapeDefaults(shape: string) {
		const d = SHAPE_DEFAULTS[shape];
		if (d) { rotationX = d.x; rotationY = d.y; rotationZ = d.z; }
	}

	function onShapeChange() {
		applyShapeDefaults(selectedShape);
		canvas.style.cursor = selectedShape !== 'plane' ? 'grab' : 'default';
	}

	function createMesh(shape: string) {
		if (mesh) {
			scene.remove(mesh);
			mesh.geometry.dispose();
			if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
			else mesh.material.dispose();
		}
		meshShaderRef = null;

		let geometry: THREE.BufferGeometry;
		switch (shape) {
			case 'sphere':   geometry = new THREE.SphereGeometry(2, 64, 64); break;
			case 'cube':     geometry = new THREE.BoxGeometry(3, 3, 3); break;
			case 'cylinder': geometry = new THREE.CylinderGeometry(2, 2, 3, 64); break;
			case 'pyramid':  geometry = new THREE.ConeGeometry(2, 3, 4); break;
			case 'torus':    geometry = new THREE.TorusGeometry(2, 0.8, 32, 100); break;
			case 'plane':
			default: {
				const img = texture.image as HTMLImageElement;
				const ar = img.width / img.height;
				geometry = new THREE.PlaneGeometry(6, 6 / ar);
				break;
			}
		}

		let material: THREE.Material;

		if (shape === 'plane') {
			const uniforms = buildAdjustUniforms();
			const mat = new THREE.ShaderMaterial({
				uniforms,
				vertexShader: IMAGE_VERT,
				fragmentShader: IMAGE_FRAG,
				transparent: true,
				side: THREE.DoubleSide,
				depthWrite: false
			});
			meshShaderRef = mat as any;
			material = mat;
		} else {
			// 3D shapes — inject adjustments via onBeforeCompile
			const stdMat = new THREE.MeshStandardMaterial({
				map: texture,
				side: THREE.DoubleSide,
				transparent: true,
				alphaTest: 0.01,
				metalness: 0.1,
				roughness: 0.7
			});
			const extraUniforms = buildAdjustUniforms();
			stdMat.onBeforeCompile = (shader) => {
				Object.assign(shader.uniforms, extraUniforms);
				shader.fragmentShader = shader.fragmentShader.replace(
					'#include <map_fragment>',
					`
					#include <map_fragment>
					// ── Image adjustments injected ──
					vec3 _col = diffuseColor.rgb;
					_col += ${brightness.toFixed(4)};
					_col = (_col - 0.5) * (1.0 + ${contrast.toFixed(4)}) + 0.5;
					float _luma = dot(_col, vec3(0.299,0.587,0.114));
					_col.r = clamp(_col.r + ${temperature.toFixed(4)}*0.12,0.0,1.0);
					_col.b = clamp(_col.b - ${temperature.toFixed(4)}*0.12,0.0,1.0);
					float _sm = clamp(1.0 - _luma*3.0,0.0,1.0);
					float _hm = clamp((_luma-0.67)*3.0,0.0,1.0);
					_col += ${shadows.toFixed(4)}*_sm*0.4 + ${mids.toFixed(4)}*(1.0-_sm-_hm)*0.4 + ${highlights.toFixed(4)}*_hm*0.4;
					diffuseColor.rgb = clamp(_col, 0.0, 1.0);
					`
				);
				meshShaderRef = shader as any;
			};
			material = stdMat;
		}

		mesh = new THREE.Mesh(geometry, material);
		mesh.scale.set(scale, scale, scale);
		scene.add(mesh);
	}

	function clearLogo() {
		logoUrl = '';
		if (logoMesh) {
			scene.remove(logoMesh);
			logoMesh.geometry.dispose();
			(logoMesh.material as THREE.Material).dispose();
			logoMesh = null;
		}
	}

	function createLogoMesh(logoImageUrl: string) {
		if (logoMesh) {
			scene.remove(logoMesh);
			logoMesh.geometry.dispose();
			(logoMesh.material as THREE.Material).dispose();
		}

		if (!logoEnabled || !logoImageUrl) return;

		const textureLoader = new THREE.TextureLoader();
		textureLoader.load(logoImageUrl, (logoTexture) => {
			const geometry = new THREE.PlaneGeometry(2, 2);
			const material = new THREE.MeshStandardMaterial({
				map: logoTexture,
				transparent: true,
				opacity: logoOpacity,
				side: THREE.DoubleSide
			});

			logoMesh = new THREE.Mesh(geometry, material);
			logoMesh.position.set(logoPositionX, logoPositionY, logoPositionZ);
			logoMesh.scale.set(logoScale, logoScale, logoScale);
			scene.add(logoMesh);
		});
	}

	function create3DText() {
		if (!textContent.trim()) {
			if (textMesh) {
				scene.remove(textMesh);
				textMesh.geometry.dispose();
				(textMesh.material as THREE.Material).dispose();
				textMesh = null;
			}
			return;
		}

		if (textMesh) {
			scene.remove(textMesh);
			textMesh.geometry.dispose();
			(textMesh.material as THREE.Material).dispose();
		}

		if (textMode === '2d') {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d')!;
			canvas.width = 512;
			canvas.height = 256;

			ctx.font = `bold ${80}px "${selectedFont}", sans-serif`;
			ctx.fillStyle = textColor;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';

			if (textGlow > 0) {
				ctx.shadowColor = textColor;
				ctx.shadowBlur = textGlow * 20;
			}

			ctx.fillText(textContent, canvas.width / 2, canvas.height / 2);

			const textTexture = new THREE.CanvasTexture(canvas);
			const textGeometry = new THREE.PlaneGeometry(4, 2);
			const textMaterial = new THREE.MeshStandardMaterial({
				map: textTexture,
				transparent: true,
				opacity: textOpacity,
				side: THREE.DoubleSide,
				emissive: new THREE.Color(textColor),
				emissiveIntensity: textGlow
			});

			textMesh = new THREE.Mesh(textGeometry, textMaterial);
			textMesh.position.set(textPositionX, textPositionY, textPositionZ);
			textMesh.scale.set(textSize, textSize, textSize);
			scene.add(textMesh);
		} else if (textMode === '3d' && loadedFont) {
			const textGeometry = new TextGeometry(textContent, {
				font: loadedFont,
				size: 0.5,
				depth: textExtrusionDepth,
				curveSegments: 12,
				bevelEnabled: bevelEnabled,
				bevelThickness: bevelThickness,
				bevelSize: bevelSize,
				bevelSegments: 5
			});

			textGeometry.computeBoundingBox();
			const centerOffset =
				-0.5 * (textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x);
			textGeometry.translate(centerOffset, 0, 0);

			const textMaterial = new THREE.MeshStandardMaterial({
				color: new THREE.Color(textColor),
				transparent: true,
				opacity: textOpacity,
				emissive: new THREE.Color(textColor),
				emissiveIntensity: textGlow,
				metalness: 0.3,
				roughness: 0.4
			});

			textMesh = new THREE.Mesh(textGeometry, textMaterial);
			textMesh.position.set(textPositionX, textPositionY, textPositionZ);
			textMesh.scale.set(textSize, textSize, textSize);
			scene.add(textMesh);
		}
	}

	function applyFilterPreset(presetName: string) {
		const preset = filterPresets[presetName];
		if (preset) {
			imageGlow = preset.imageGlow;
			shapeGlow = preset.shapeGlow;
			ambientIntensity = preset.ambientIntensity;
			directionalIntensity = preset.directionalIntensity;
			textGlow = preset.textGlow;
		}
	}

	function switchTextMode(mode: '2d' | '3d') {
		textMode = mode;
		if (mode === '3d' && !loadedFont) {
			load3DFont(selected3DFont);
		} else {
			create3DText();
		}
	}

	function animate() {
		animationId = requestAnimationFrame(animate);

		if (mesh) {
			mesh.rotation.x = rotationX;
			mesh.rotation.y = rotationY;
			mesh.rotation.z = rotationZ;

			if (autoRotate) mesh.rotation.y += autoRotateSpeed;

			// Glow for 3D shapes (MeshStandardMaterial only — plane uses shader uniform)
			if (mesh.material instanceof THREE.MeshStandardMaterial) {
				const glowValue = Math.max(imageGlow, shapeGlow) * 0.5;
				mesh.material.emissive.set(glowValue > 0 ? 0xffffff : 0x000000);
				mesh.material.emissiveIntensity = glowValue;
			}
		}

		if (textMesh) {
			textMesh.rotation.x = textRotationX;
			textMesh.rotation.y = textRotationY;
			textMesh.rotation.z = textRotationZ;

			if (textAutoRotate) textMesh.rotation.y += textAutoRotateSpeed;

			textMesh.position.set(textPositionX, textPositionY, textPositionZ);
			textMesh.scale.set(textSize, textSize, textSize);

			if (textMesh.material instanceof THREE.MeshStandardMaterial) {
				textMesh.material.opacity = textOpacity;
				textMesh.material.emissiveIntensity = textGlow;
			}
		}

		if (logoMesh) {
			logoAnimationTime += 0.016 * logoAnimationSpeed;

			const baseX = logoPositionX;
			const baseY = logoPositionY;
			const baseZ = logoPositionZ;

			logoMesh.rotation.x = logoRotationX;
			logoMesh.rotation.y = logoRotationY;
			logoMesh.rotation.z = logoRotationZ;

			if (logoAutoRotate) logoMesh.rotation.y += logoAutoRotateSpeed;

			logoMesh.position.set(baseX, baseY, baseZ);
			logoMesh.scale.set(logoScale, logoScale, logoScale);

			switch (logoAnimation) {
				case 'spin':
					logoMesh.rotation.z += logoAnimationTime * 2;
					break;

				case 'pulse': {
					const pulseScale = 1 + Math.sin(logoAnimationTime * 3) * 0.2 * logoAnimationIntensity;
					logoMesh.scale.set(
						logoScale * pulseScale,
						logoScale * pulseScale,
						logoScale * pulseScale
					);
					break;
				}

				case 'bounce': {
					const bounceOffset =
						Math.abs(Math.sin(logoAnimationTime * 3)) * 1.5 * logoAnimationIntensity;
					logoMesh.position.y = baseY + bounceOffset;
					break;
				}

				case 'explode': {
					const explodePhase = (Math.sin(logoAnimationTime * 0.5) + 1) / 2;
					const explodeScale = 1 + explodePhase * 2 * logoAnimationIntensity;
					logoMesh.scale.set(
						logoScale * explodeScale,
						logoScale * explodeScale,
						logoScale * explodeScale
					);
					logoMesh.rotation.z += logoAnimationTime * 3;
					if (logoMesh.material instanceof THREE.MeshStandardMaterial) {
						logoMesh.material.opacity = logoOpacity * (1 - explodePhase * 0.5);
					}
					break;
				}

				case 'warp': {
					const warpX = Math.sin(logoAnimationTime * 2) * logoAnimationIntensity;
					const warpY = Math.cos(logoAnimationTime * 1.5) * logoAnimationIntensity;
					logoMesh.position.x = baseX + warpX;
					logoMesh.position.y = baseY + warpY;
					const warpScale = 1 + Math.sin(logoAnimationTime * 4) * 0.15 * logoAnimationIntensity;
					logoMesh.scale.set(logoScale * warpScale, logoScale * (2 - warpScale), logoScale);
					break;
				}

				case 'glitch': {
					if (Math.random() > 0.85) {
						logoMesh.position.x = baseX + (Math.random() - 0.5) * logoAnimationIntensity * 2;
						logoMesh.position.y = baseY + (Math.random() - 0.5) * logoAnimationIntensity * 2;
					}
					if (Math.random() > 0.9) {
						logoMesh.rotation.z = (Math.random() - 0.5) * 0.5 * logoAnimationIntensity;
					}
					break;
				}

				case 'flip3d':
					logoMesh.rotation.y += logoAnimationTime * 2;
					logoMesh.rotation.x = Math.sin(logoAnimationTime) * 0.3 * logoAnimationIntensity;
					break;

				case 'spiral': {
					const spiralRadius = Math.sin(logoAnimationTime) * 2 * logoAnimationIntensity;
					const spiralAngle = logoAnimationTime * 2;
					logoMesh.position.x = baseX + Math.cos(spiralAngle) * spiralRadius;
					logoMesh.position.y = baseY + Math.sin(spiralAngle) * spiralRadius;
					logoMesh.rotation.z = spiralAngle;
					break;
				}

				case 'shimmer': {
					const shimmerOpacity = logoOpacity * (0.7 + Math.sin(logoAnimationTime * 5) * 0.3);
					if (logoMesh.material instanceof THREE.MeshStandardMaterial) {
						logoMesh.material.opacity = shimmerOpacity;
					}
					const shimmerScale = 1 + Math.sin(logoAnimationTime * 3) * 0.1 * logoAnimationIntensity;
					logoMesh.scale.set(logoScale * shimmerScale, logoScale * shimmerScale, logoScale);
					break;
				}

				case 'none':
				default:
					break;
			}

			if (logoAnimation !== 'explode' && logoAnimation !== 'shimmer') {
				if (logoMesh.material instanceof THREE.MeshStandardMaterial) {
					logoMesh.material.opacity = logoOpacity;
				}
			}
		}

		camera.position.z = cameraDistance;

		if (ambientLight) ambientLight.intensity = ambientIntensity;
		if (directionalLight) directionalLight.intensity = directionalIntensity;

		// Push image-adjustment uniforms to shader (plane mode only)
		if (meshShaderRef && selectedShape === 'plane') {
			const u = meshShaderRef.uniforms;
			u.uBrightness.value  = brightness;
			u.uContrast.value    = contrast;
			u.uSaturation.value  = saturation;
			u.uHue.value         = hue;
			u.uTemperature.value = temperature;
			u.uVignette.value    = vignetteStrength;
			u.uShadows.value     = shadows;
			u.uMids.value        = mids;
			u.uHighlights.value  = highlights;
			// Glow (from presets / effects panel)
			u.uGlow.value = Math.max(imageGlow, shapeGlow);
			// Color overlay
			const ovMode = colorOverlayEnabled
				? ({ none: 0, multiply: 1, screen: 2, overlay: 3 } as Record<string,number>)[colorOverlayBlendMode] ?? 0
				: 0;
			u.uOverlayOpacity.value = colorOverlayEnabled ? colorOverlayOpacity : 0;
			(u.uOverlayColor.value as THREE.Color).set(colorOverlayColor);
			u.uOverlayMode.value    = ovMode;
			// Gradient
			u.uGradientOpacity.value = gradientEnabled ? gradientOpacity : 0;
			(u.uGradientColor.value as THREE.Color).set(gradientColor);
			u.uGradientType.value    = gradientType === 'radial' ? 2.0 : 1.0;
			// Crop, straighten, blur
			u.uBlur.value      = blur;
			u.uCropLeft.value  = cropLeft;
			u.uCropRight.value = cropRight;
			u.uCropTop.value   = cropTop;
			u.uCropBottom.value = cropBottom;
			u.uStraighten.value = straighten;
		}

		renderer.render(scene, camera);
	}

	function handleResize() {
		if (!canvas || !camera || !renderer) return;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
	}

	function resetAll() {
		rotationX = 0;
		rotationY = 0;
		rotationZ = 0;
		cameraDistance = 5;
		scale = 1;
		autoRotate = false;
		imageGlow = 0;
		shapeGlow = 0;
		ambientIntensity = 1.0;
		directionalIntensity = 0.4;
		textContent = '';
		logoEnabled = false;
		logoAnimation = 'none';
		logoAnimationSpeed = 1;
		logoAnimationIntensity = 0.5;
		logoAnimationTime = 0;
		logoPositionX = 0;
		logoPositionY = 0;
		logoPositionZ = 3;
		logoRotationX = 0;
		logoRotationY = 0;
		logoRotationZ = 0;
		brightness = 0; contrast = 0; saturation = 0; hue = 0;
		temperature = 0; vignetteStrength = 0;
		shadows = 0; mids = 0; highlights = 0;
		colorOverlayEnabled = false; colorOverlayOpacity = 0.3;
		gradientEnabled = false; gradientOpacity = 0.5;
		watermarkEnabled = false;
		watermarkUrl = '';
		watermarkManualX = null;
		watermarkManualY = null;
		if (watermarkTexture) { watermarkTexture.dispose(); watermarkTexture = null; }
		blur = 0; cropLeft = 0; cropRight = 0; cropTop = 0; cropBottom = 0; straighten = 0;
		dragTarget = null;
		isRotating = false;
		createMesh(selectedShape);
		createLogoMesh(logoUrl);
		create3DText();
		removeWatermarkMesh();
	}

	// ── Watermark ─────────────────────────────────────────────────────────────
	function removeWatermarkMesh() {
		if (watermarkMesh) {
			scene.remove(watermarkMesh);
			watermarkMesh.geometry.dispose();
			(watermarkMesh.material as THREE.Material).dispose();
			watermarkMesh = null;
		}
	}

	// Sync — places mesh using already-loaded texture. Safe to call on every slider change.
	function placeWatermarkMesh() {
		removeWatermarkMesh();
		if (!watermarkEnabled || !watermarkTexture || !texture?.image) return;

		const img = texture.image as HTMLImageElement;
		const ar = img.width / img.height;
		const planeW = 6;
		const planeH = planeW / ar;
		const wSize = watermarkScale * 1.5;
		const pad = 0.15;

		let px = 0, py = 0;
		if (watermarkManualX !== null && watermarkManualY !== null) {
			px = watermarkManualX;
			py = watermarkManualY;
		} else {
			switch (watermarkCorner) {
				case 'TL': px = -planeW/2 + wSize/2 + pad; py =  planeH/2 - wSize/2 - pad; break;
				case 'TR': px =  planeW/2 - wSize/2 - pad; py =  planeH/2 - wSize/2 - pad; break;
				case 'BL': px = -planeW/2 + wSize/2 + pad; py = -planeH/2 + wSize/2 + pad; break;
				default:   px =  planeW/2 - wSize/2 - pad; py = -planeH/2 + wSize/2 + pad; break;
			}
		}

		const geo = new THREE.PlaneGeometry(wSize, wSize);
		const mat = new THREE.MeshBasicMaterial({
			map: watermarkTexture, transparent: true, opacity: watermarkOpacity,
			side: THREE.DoubleSide, depthTest: false
		});
		watermarkMesh = new THREE.Mesh(geo, mat);
		watermarkMesh.position.set(px, py, 0.05);
		scene.add(watermarkMesh);
	}

	// Async — only called when the URL changes. Cancels stale loads.
	function loadWatermark(url: string) {
		const id = ++watermarkLoadId;
		new THREE.TextureLoader().load(url, (tex) => {
			if (id !== watermarkLoadId) return; // superseded
			if (watermarkTexture) watermarkTexture.dispose();
			watermarkTexture = tex;
			placeWatermarkMesh();
		});
	}

	function createWatermarkMesh() {
		if (!watermarkEnabled) { removeWatermarkMesh(); return; }
		if (!watermarkUrl) return;
		if (watermarkTexture) {
			placeWatermarkMesh(); // texture already loaded — instant
		} else {
			loadWatermark(watermarkUrl);
		}
	}

	// Only reload texture when URL changes; update position/scale/opacity instantly
	$: if (watermarkUrl && scene) loadWatermark(watermarkUrl);
	$: if (scene) placeWatermarkMesh();
	// Opacity-only change — update material directly without recreating mesh
	$: if (watermarkMesh && watermarkMesh.material instanceof THREE.MeshBasicMaterial) {
		watermarkMesh.material.opacity = watermarkOpacity;
	}

	// ── AI Re-edit ────────────────────────────────────────────────────────────
	async function aiRegenerate() {
		if (!aiPrompt.trim() || isRegenerating) return;
		isRegenerating = true;
		try {
			const exportBlob = await new Promise<Blob | null>((res) =>
				renderer.domElement.toBlob((b) => res(b), 'image/png', 1.0)
			);
			if (!exportBlob) throw new Error('Canvas export failed');
			const fd = new FormData();
			fd.append('prompt', aiPrompt);
			fd.append('images', new File([exportBlob], 'current.png', { type: 'image/png' }));
			const resp = await fetch('/api/imageEdit', { method: 'POST', body: fd });
			const data = await resp.json();
			if (!data.success) throw new Error(data.error || 'Generation failed');
			// Reload texture from new image
			const loader = new THREE.TextureLoader();
			loader.load(data.imageUrl, (newTex) => {
				texture = newTex;
				createMesh(selectedShape);
			});
			aiPrompt = '';
		} catch (e) {
			console.error('AI re-edit failed:', e);
		} finally {
			isRegenerating = false;
		}
	}

	// ── Send to video refs ────────────────────────────────────────────────────
	function sendToVideoRefs() {
		if (!renderer || !scene || !camera || !onSendToVideoRefs) return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				renderer.domElement.toBlob((blob) => {
					if (!blob) return;
					const url = URL.createObjectURL(blob);
					onSendToVideoRefs!(url);
				}, 'image/png', 1.0);
			});
		});
	}

	// ── Drag-to-position ────────────────────────────────────────────────────
	function getPointerNDC(clientX: number, clientY: number): THREE.Vector2 {
		const rect = canvas.getBoundingClientRect();
		return new THREE.Vector2(
			((clientX - rect.left) / rect.width) * 2 - 1,
			-((clientY - rect.top) / rect.height) * 2 + 1
		);
	}

	function getDraggableTargets(): THREE.Mesh[] {
		return [logoMesh, watermarkMesh].filter((m): m is THREE.Mesh => m !== null);
	}

	function beginOverlayDrag(e: MouseEvent | TouchEvent, clientX: number, clientY: number) {
		const ndc = getPointerNDC(clientX, clientY);
		raycaster.setFromCamera(ndc, camera);
		const hits = raycaster.intersectObjects(getDraggableTargets());
		if (hits.length > 0) {
			e.preventDefault();
			dragTarget = hits[0].object as THREE.Mesh;
			dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1), dragTarget.position);
			raycaster.ray.intersectPlane(dragPlane, dragIntersect);
			dragOffset.subVectors(dragTarget.position, dragIntersect);
			canvas.style.cursor = 'grabbing';
			return true;
		}
		return false;
	}

	function applyOverlayDrag(clientX: number, clientY: number) {
		const ndc = getPointerNDC(clientX, clientY);
		raycaster.setFromCamera(ndc, camera);
		if (!raycaster.ray.intersectPlane(dragPlane, dragIntersect)) return;
		const nx = dragIntersect.x + dragOffset.x;
		const ny = dragIntersect.y + dragOffset.y;
		// Move the Three.js object directly — do NOT write watermarkManualX/Y here
		// because that triggers a Svelte reactive which destroys+recreates the mesh,
		// making dragTarget point to a disposed (invisible) object from then on.
		dragTarget!.position.set(nx, ny, dragTarget!.position.z);
		if (dragTarget === logoMesh) {
			// Logo position is read by animate() each frame, so state write is safe here
			logoPositionX = nx;
			logoPositionY = ny;
		}
	}

	function commitDrag() {
		// If watermark was dragged, persist its final position to state ONCE (single reactive fire)
		const ended = dragTarget;
		if (ended && ended === watermarkMesh) {
			watermarkManualX = ended.position.x;
			watermarkManualY = ended.position.y;
		}
		dragTarget = null;
		isRotating = false;
		if (canvas) canvas.style.cursor = selectedShape !== 'plane' ? 'grab' : 'default';
	}

	function onCanvasMouseDown(e: MouseEvent) {
		if (!beginOverlayDrag(e, e.clientX, e.clientY) && selectedShape !== 'plane') {
			isRotating = true;
			prevDragPos = { x: e.clientX, y: e.clientY };
			canvas.style.cursor = 'grabbing';
		}
	}

	function onCanvasMouseMove(e: MouseEvent) {
		if (dragTarget) {
			e.preventDefault();
			applyOverlayDrag(e.clientX, e.clientY);
		} else if (isRotating) {
			rotationY += (e.clientX - prevDragPos.x) * 0.01;
			rotationX += (e.clientY - prevDragPos.y) * 0.01;
			prevDragPos = { x: e.clientX, y: e.clientY };
		} else {
			const ndc = getPointerNDC(e.clientX, e.clientY);
			raycaster.setFromCamera(ndc, camera);
			const hits = raycaster.intersectObjects(getDraggableTargets());
			canvas.style.cursor = hits.length > 0 || selectedShape !== 'plane' ? 'grab' : 'default';
		}
	}

	function onCanvasPointerUp() { commitDrag(); }

	function onCanvasTouchStart(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		const t = e.touches[0];
		if (!beginOverlayDrag(e, t.clientX, t.clientY) && selectedShape !== 'plane') {
			e.preventDefault();
			isRotating = true;
			prevDragPos = { x: t.clientX, y: t.clientY };
		}
	}

	function onCanvasTouchMove(e: TouchEvent) {
		if (e.touches.length !== 1) return;
		const t = e.touches[0];
		if (dragTarget) {
			e.preventDefault();
			applyOverlayDrag(t.clientX, t.clientY);
		} else if (isRotating) {
			e.preventDefault();
			rotationY += (t.clientX - prevDragPos.x) * 0.01;
			rotationX += (t.clientY - prevDragPos.y) * 0.01;
			prevDragPos = { x: t.clientX, y: t.clientY };
		}
	}

	function exportImage() {
		if (!renderer || !scene || !camera) return;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				try {
					renderer.domElement.toBlob(
						(blob) => {
							if (!blob) { alert('Export failed'); return; }
							const url = URL.createObjectURL(blob);
							const link = document.createElement('a');
							link.download = `enhanced-image-${Date.now()}.png`;
							link.href = url;
							document.body.appendChild(link);
							link.click();
							document.body.removeChild(link);
							setTimeout(() => URL.revokeObjectURL(url), 1000);
						},
						'image/png',
						1.0
					);
				} catch (err) {
					console.error('Export error:', err);
					alert('Export failed');
				}
			});
		});
	}

	// FIX 1: Added selectedFont and textColor to reactive block so font changes trigger re-render
	$: if (mesh && selectedShape) createMesh(selectedShape);
	$: if (mesh) mesh.scale.set(scale, scale, scale);
	$: if (textContent !== undefined || textSize || textColor || selectedFont) create3DText();
	$: if (logoEnabled && logoUrl) createLogoMesh(logoUrl);
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/90 p-4">
	<div class="flex h-full w-full max-w-7xl flex-col gap-4 lg:flex-row">
		<!-- Canvas -->
		<div class="flex flex-1 flex-col gap-4">
			<div class="flex items-center justify-between">
				<h2 class="text-2xl font-bold text-white">3D Image Enhancement</h2>
				<button on:click={onClose} class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					✕
				</button>
			</div>
			<div class="relative flex-1 overflow-hidden rounded-lg bg-base-300">
				<canvas bind:this={canvas} class="h-full w-full"></canvas>
			</div>
		</div>

		<!-- Controls Panel -->
		<div class="flex w-full flex-col gap-3 overflow-y-auto lg:w-96">
			<div
				class="flex flex-col gap-2 overflow-y-auto pr-2"
				style="max-height: calc(100vh - 200px);"
			>
				<!-- SHAPE & TRANSFORM -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group" open>
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>Shape & Transform</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">3D Shape</label>
								<select
									bind:value={selectedShape}
									on:change={onShapeChange}
									class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
								>
									{#each shapes as shape (shape)}
										<option value={shape}>{shape.charAt(0).toUpperCase() + shape.slice(1)}</option>
									{/each}
								</select>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Camera Distance</span>
								</div>
								<div class="flex gap-2">
									<input
										type="range"
										min="2"
										max="15"
										step="0.1"
										bind:value={cameraDistance}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={cameraDistance}
										min="2"
										max="15"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Scale</span>
								</div>
								<div class="flex gap-2">
									<input
										type="range"
										min="0.5"
										max="3"
										step="0.1"
										bind:value={scale}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={scale}
										min="0.5"
										max="3"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>
						</div>
					</details>
				</div>

				<!-- ROTATION -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>Rotation</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">X Rotation</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="-3.14"
										max="3.14"
										step="0.01"
										bind:value={rotationX}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={rotationX}
										min="-3.14"
										max="3.14"
										step="0.01"
										class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Y Rotation</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="-3.14"
										max="3.14"
										step="0.01"
										bind:value={rotationY}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={rotationY}
										min="-3.14"
										max="3.14"
										step="0.01"
										class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Z Rotation</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="-3.14"
										max="3.14"
										step="0.01"
										bind:value={rotationZ}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={rotationZ}
										min="-3.14"
										max="3.14"
										step="0.01"
										class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Auto Rotate</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={autoRotate} class="peer sr-only" />
										<div
											class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>
							</div>

							{#if autoRotate}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Auto Rotate Speed</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0.001"
											max="0.05"
											step="0.001"
											bind:value={autoRotateSpeed}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={autoRotateSpeed}
											min="0.001"
											max="0.05"
											step="0.001"
											class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>
							{/if}
						</div>
					</details>
				</div>

				<!-- LIGHTING -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>Lighting</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Ambient</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="0"
										max="2"
										step="0.1"
										bind:value={ambientIntensity}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={ambientIntensity}
										min="0"
										max="2"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Directional</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="0"
										max="2"
										step="0.1"
										bind:value={directionalIntensity}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={directionalIntensity}
										min="0"
										max="2"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>
						</div>
					</details>
				</div>

				<!-- EFFECTS -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>Effects</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Image Glow</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="0"
										max="2"
										step="0.1"
										bind:value={imageGlow}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={imageGlow}
										min="0"
										max="2"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Shape Glow</label>
								<div class="mt-1 flex gap-2">
									<input
										type="range"
										min="0"
										max="2"
										step="0.1"
										bind:value={shapeGlow}
										class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
									/>
									<input
										type="number"
										bind:value={shapeGlow}
										min="0"
										max="2"
										step="0.1"
										class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									/>
								</div>
							</div>

							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="mb-2 block text-sm font-semibold text-white">Quick Presets</label>
								<div class="grid grid-cols-2 gap-2">
									{#each Object.keys(filterPresets) as preset (preset)}
										<button
											on:click={() => applyFilterPreset(preset)}
											class="btn capitalize btn-ghost btn-xs"
										>
											{preset}
										</button>
									{/each}
								</div>
							</div>
						</div>
					</details>
				</div>

				<!-- IMAGE ADJUST -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>🎨 Image Adjust</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							{#each [['Brightness', brightness, -0.5, 0.5, 0.01], ['Contrast', contrast, -0.5, 0.5, 0.01], ['Saturation', saturation, -1, 1, 0.01], ['Hue', hue, -180, 180, 1], ['Blur', blur, 0, 1, 0.01]] as [label, , mn, mx, step] (label)}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">{label}</label>
									<div class="mt-1 flex gap-2">
										{#if label === 'Brightness'}
											<input type="range" min={mn} max={mx} {step} bind:value={brightness} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
											<input type="number" min={mn} max={mx} {step} bind:value={brightness} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
										{:else if label === 'Contrast'}
											<input type="range" min={mn} max={mx} {step} bind:value={contrast} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
											<input type="number" min={mn} max={mx} {step} bind:value={contrast} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
										{:else if label === 'Saturation'}
											<input type="range" min={mn} max={mx} {step} bind:value={saturation} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
											<input type="number" min={mn} max={mx} {step} bind:value={saturation} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
										{:else if label === 'Hue'}
											<input type="range" min={mn} max={mx} {step} bind:value={hue} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
											<input type="number" min={mn} max={mx} {step} bind:value={hue} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
										{:else}
											<input type="range" min={mn} max={mx} {step} bind:value={blur} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
											<input type="number" min={mn} max={mx} {step} bind:value={blur} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</details>
				</div>

				<!-- COLOR GRADE -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>🌡️ Color Grade</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Temperature</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-1" max="1" step="0.01" bind:value={temperature} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="-1" max="1" step="0.01" bind:value={temperature} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
								<div class="mt-1 flex justify-between text-xs text-gray-500"><span>Cool</span><span>Warm</span></div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Shadows</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-0.5" max="0.5" step="0.01" bind:value={shadows} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="-0.5" max="0.5" step="0.01" bind:value={shadows} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Midtones</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-0.5" max="0.5" step="0.01" bind:value={mids} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="-0.5" max="0.5" step="0.01" bind:value={mids} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Highlights</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-0.5" max="0.5" step="0.01" bind:value={highlights} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="-0.5" max="0.5" step="0.01" bind:value={highlights} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Vignette</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="1" step="0.01" bind:value={vignetteStrength} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="0" max="1" step="0.01" bind:value={vignetteStrength} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
						</div>
					</details>
				</div>

				<!-- CROP & STRAIGHTEN -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>✂️ Crop & Straighten</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Straighten</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-45" max="45" step="0.5" bind:value={straighten} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="-45" max="45" step="0.5" bind:value={straighten} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
								<div class="mt-1 flex justify-between text-xs text-gray-500"><span>-45°</span><span>+45°</span></div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Crop Left</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="0.49" step="0.01" bind:value={cropLeft} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="0" max="0.49" step="0.01" bind:value={cropLeft} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Crop Right</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="0.49" step="0.01" bind:value={cropRight} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="0" max="0.49" step="0.01" bind:value={cropRight} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Crop Top</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="0.49" step="0.01" bind:value={cropTop} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="0" max="0.49" step="0.01" bind:value={cropTop} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Crop Bottom</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="0.49" step="0.01" bind:value={cropBottom} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
									<input type="number" min="0" max="0.49" step="0.01" bind:value={cropBottom} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<button on:click={() => { cropLeft=0; cropRight=0; cropTop=0; cropBottom=0; straighten=0; }} class="btn btn-ghost btn-xs w-full">Reset Crop</button>
							</div>
						</div>
					</details>
				</div>

				<!-- OVERLAY -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>🎭 Overlay</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Color Overlay</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={colorOverlayEnabled} class="peer sr-only"/>
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
							</div>
							{#if colorOverlayEnabled}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Color</label>
									<input type="color" bind:value={colorOverlayColor} class="mt-1 h-8 w-full cursor-pointer rounded border border-white/10"/>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Blend Mode</label>
									<select bind:value={colorOverlayBlendMode} class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white">
										<option value="none">Solid</option>
										<option value="multiply">Multiply</option>
										<option value="screen">Screen</option>
										<option value="overlay">Overlay</option>
									</select>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Opacity</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="0" max="1" step="0.01" bind:value={colorOverlayOpacity} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
										<input type="number" min="0" max="1" step="0.01" bind:value={colorOverlayOpacity} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
									</div>
								</div>
							{/if}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Gradient Overlay</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={gradientEnabled} class="peer sr-only"/>
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
							</div>
							{#if gradientEnabled}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Color</label>
									<input type="color" bind:value={gradientColor} class="mt-1 h-8 w-full cursor-pointer rounded border border-white/10"/>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Type</label>
									<select bind:value={gradientType} class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white">
										<option value="linear">Linear (top → bottom)</option>
										<option value="radial">Radial (center → edge)</option>
									</select>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Opacity</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="0" max="1" step="0.01" bind:value={gradientOpacity} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
										<input type="number" min="0" max="1" step="0.01" bind:value={gradientOpacity} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
									</div>
								</div>
							{/if}
						</div>
					</details>
				</div>

				<!-- WATERMARK -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>🖼️ Watermark</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Enable</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={watermarkEnabled} class="peer sr-only"/>
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
							</div>
							{#if watermarkEnabled}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="block text-sm font-semibold text-white">Upload Image</label>
									<input type="file" accept="image/*" class="mt-1 w-full text-xs text-gray-400 file:mr-2 file:rounded file:border-0 file:bg-gray-700 file:px-2 file:py-1 file:text-xs file:text-white"
										on:change={(e) => {
											const f = (e.target as HTMLInputElement).files?.[0];
											if (f) { watermarkUrl = URL.createObjectURL(f); createWatermarkMesh(); }
										}}
									/>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Corner</label>
									<div class="mt-1 grid grid-cols-2 gap-1">
										{#each ['TL','TR','BL','BR'] as c (c)}
											<button on:click={() => { watermarkCorner = c; watermarkManualX = null; watermarkManualY = null; createWatermarkMesh(); }}
												class="btn btn-xs {watermarkCorner === c ? 'btn-primary' : 'btn-ghost'}">
												{c === 'TL' ? '↖ Top Left' : c === 'TR' ? '↗ Top Right' : c === 'BL' ? '↙ Bot Left' : '↘ Bot Right'}
											</button>
										{/each}
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Scale</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="0.1" max="1" step="0.05" bind:value={watermarkScale} on:input={createWatermarkMesh} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
										<input type="number" min="0.1" max="1" step="0.05" bind:value={watermarkScale} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Opacity</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="0" max="1" step="0.05" bind:value={watermarkOpacity} on:input={() => { if (watermarkMesh && watermarkMesh.material instanceof THREE.MeshBasicMaterial) watermarkMesh.material.opacity = watermarkOpacity; }} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"/>
										<input type="number" min="0" max="1" step="0.05" bind:value={watermarkOpacity} class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"/>
									</div>
								</div>
							{/if}
						</div>
					</details>
				</div>

				<!-- AI RE-EDIT -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
							<span>🤖 AI Re-edit</span>
							<svg viewBox="0 0 20 20" fill="currentColor" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"><path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"/></svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Describe your change</label>
								<textarea bind:value={aiPrompt} placeholder="e.g. make the background sunset orange, add a dramatic shadow..." rows="3" class="mt-1 w-full resize-none rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white placeholder-gray-500"></textarea>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<button on:click={aiRegenerate} disabled={isRegenerating || !aiPrompt.trim()} class="btn btn-primary btn-sm w-full">
									{isRegenerating ? '⏳ Regenerating...' : '✨ Regenerate with AI'}
								</button>
								<p class="mt-1 text-xs text-gray-500">Exports current canvas → sends to Nano Banana → reloads as new texture</p>
							</div>
						</div>
					</details>
				</div>

				<!-- LOGO OVERLAY -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>🖼️ Image Overlay</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2">
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Enable Overlay</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={logoEnabled} class="peer sr-only" />
										<div
											class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>
							</div>

							{#if logoEnabled}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="block text-sm font-semibold text-white">Upload Image</label>
									<input
										type="file"
										accept="image/*"
										on:change={(e) => {
											const input = e.target as HTMLInputElement;
											const file = input.files?.[0];
											if (file) {
												const reader = new FileReader();
												reader.onload = (event) => {
													logoUrl = (event.target as FileReader)?.result as string;
												};
												reader.readAsDataURL(file);
											}
										}}
										class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white file:mr-2 file:cursor-pointer file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white hover:file:bg-blue-700"
									/>
									{#if logoUrl}
										<div class="mt-2 flex items-center justify-between">
											<p class="text-xs text-green-400">✅ Logo loaded</p>
											<button
												on:click={clearLogo}
												class="btn btn-xs btn-error btn-outline"
											>🗑 Remove</button>
										</div>
									{/if}
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Scale</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0.1"
											max="3"
											step="0.1"
											bind:value={logoScale}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={logoScale}
											min="0.1"
											max="3"
											step="0.1"
											class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Opacity</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0"
											max="1"
											step="0.1"
											bind:value={logoOpacity}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={logoOpacity}
											min="0"
											max="1"
											step="0.1"
											class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<div class="flex items-center justify-between">
										<span class="text-sm font-semibold text-white">Auto Rotate</span>
										<label class="relative inline-flex cursor-pointer items-center">
											<input type="checkbox" bind:checked={logoAutoRotate} class="peer sr-only" />
											<div
												class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
											></div>
										</label>
									</div>
								</div>

								{#if logoAutoRotate}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<label class="text-sm font-semibold text-white">Rotation Speed</label>
										<div class="mt-1 flex gap-2">
											<input
												type="range"
												min="0.001"
												max="0.1"
												step="0.001"
												bind:value={logoAutoRotateSpeed}
												class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
											/>
											<input
												type="number"
												bind:value={logoAutoRotateSpeed}
												min="0.001"
												max="0.1"
												step="0.001"
												class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
											/>
										</div>
									</div>
								{/if}

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Position X</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-10" max="10" step="0.1" bind:value={logoPositionX} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoPositionX} min="-10" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Position Y</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-10" max="10" step="0.1" bind:value={logoPositionY} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoPositionY} min="-10" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Position Z</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-5" max="10" step="0.1" bind:value={logoPositionZ} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoPositionZ} min="-5" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Rotation X</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={logoRotationX} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoRotationX} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Rotation Y</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={logoRotationY} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoRotationY} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Rotation Z</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={logoRotationZ} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={logoRotationZ} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Animation</label>
									<select bind:value={logoAnimation} class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white">
										<option value="none">None</option>
										<option value="spin">🔄 Spin</option>
										<option value="pulse">💓 Pulse</option>
										<option value="bounce">🏀 Bounce</option>
										<option value="explode">💥 Explode</option>
										<option value="warp">🌀 Warp</option>
										<option value="glitch">📺 Glitch</option>
										<option value="flip3d">🎪 Flip 3D</option>
										<option value="spiral">🌪️ Spiral</option>
										<option value="shimmer">✨ Shimmer</option>
									</select>
								</div>

								{#if logoAnimation !== 'none'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<label class="text-sm font-semibold text-white">Animation Speed</label>
										<div class="mt-1 flex gap-2">
											<input type="range" min="0.1" max="5" step="0.1" bind:value={logoAnimationSpeed} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
											<input type="number" bind:value={logoAnimationSpeed} min="0.1" max="5" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
										</div>
									</div>
									<div class="rounded-lg p-3 hover:bg-white/5">
										<label class="text-sm font-semibold text-white">Animation Intensity</label>
										<div class="mt-1 flex gap-2">
											<input type="range" min="0.1" max="2" step="0.1" bind:value={logoAnimationIntensity} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
											<input type="number" bind:value={logoAnimationIntensity} min="0.1" max="2" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</details>
				</div>

				<!-- TEXT -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>✨ Text</span>
							<svg
								viewBox="0 0 20 20"
								fill="currentColor"
								class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180"
							>
								<path
									d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
								/>
							</svg>
						</summary>
						<div class="px-2 pb-2" style="max-height: 500px; overflow-y: auto;">
							<!-- 2D / 3D Mode Toggle -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex gap-2">
									<button
										on:click={() => switchTextMode('2d')}
										class="btn flex-1 btn-xs {textMode === '2d' ? 'btn-primary' : 'btn-ghost'}"
										>2D</button
									>
									<button
										on:click={() => switchTextMode('3d')}
										class="btn flex-1 btn-xs {textMode === '3d' ? 'btn-primary' : 'btn-ghost'}"
										>3D</button
									>
								</div>
							</div>

							<!-- Font selector — different per mode -->
							{#if textMode === '2d'}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Font</label>
									<select
										bind:value={selectedFont}
										on:change={create3DText}
										class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									>
										{#each googleFonts as font (font)}
											<option value={font}>{font}</option>
										{/each}
									</select>
								</div>
							{:else}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Font</label>
									<select
										bind:value={selected3DFont}
										on:change={() => load3DFont(selected3DFont)}
										class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									>
										{#each threejsFonts as font (font.value)}
											<option value={font.value}>{font.name}</option>
										{/each}
									</select>
								</div>
							{/if}

							<!-- Text input -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<input
									type="text"
									bind:value={textContent}
									placeholder="Enter text..."
									class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
								/>
							</div>

							<!-- Size -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Size</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0.5" max="3" step="0.1" bind:value={textSize} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textSize} min="0.5" max="3" step="0.1" class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>

							<!-- Color -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Color</label>
								<input type="color" bind:value={textColor} on:input={create3DText} class="mt-1 h-8 w-full cursor-pointer rounded border border-white/10" />
							</div>

							<!-- Glow -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Glow</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="2" step="0.1" bind:value={textGlow} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textGlow} min="0" max="2" step="0.1" class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>

							<!-- Opacity -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Opacity</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="0" max="1" step="0.1" bind:value={textOpacity} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textOpacity} min="0" max="1" step="0.1" class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>

							<!-- FIX 2: 3D-only bevel/extrusion controls — only show in 3D mode -->
							{#if textMode === '3d'}
								<div class="mt-1 rounded-lg border border-blue-500/30 bg-blue-900/20 p-2">
									<p class="mb-2 text-xs font-semibold text-blue-300">3D Geometry</p>

									<div class="rounded-lg p-3 hover:bg-white/5">
										<label class="text-sm font-semibold text-white">Extrusion Depth</label>
										<div class="mt-1 flex gap-2">
											<input
												type="range"
												min="0.05"
												max="2"
												step="0.05"
												bind:value={textExtrusionDepth}
												on:input={create3DText}
												class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
											/>
											<input
												type="number"
												bind:value={textExtrusionDepth}
												min="0.05"
												max="2"
												step="0.05"
												on:change={create3DText}
												class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
											/>
										</div>
									</div>

									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="flex items-center justify-between">
											<span class="text-sm font-semibold text-white">Bevel Enabled</span>
											<label class="relative inline-flex cursor-pointer items-center">
												<input
													type="checkbox"
													bind:checked={bevelEnabled}
													on:change={create3DText}
													class="peer sr-only"
												/>
												<div
													class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
												></div>
											</label>
										</div>
									</div>

									{#if bevelEnabled}
										<div class="rounded-lg p-3 hover:bg-white/5">
											<label class="text-sm font-semibold text-white">Bevel Thickness</label>
											<div class="mt-1 flex gap-2">
												<input
													type="range"
													min="0.01"
													max="0.3"
													step="0.01"
													bind:value={bevelThickness}
													on:input={create3DText}
													class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
												/>
												<input
													type="number"
													bind:value={bevelThickness}
													min="0.01"
													max="0.3"
													step="0.01"
													on:change={create3DText}
													class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
												/>
											</div>
										</div>

										<div class="rounded-lg p-3 hover:bg-white/5">
											<label class="text-sm font-semibold text-white">Bevel Size</label>
											<div class="mt-1 flex gap-2">
												<input
													type="range"
													min="0.01"
													max="0.2"
													step="0.01"
													bind:value={bevelSize}
													on:input={create3DText}
													class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
												/>
												<input
													type="number"
													bind:value={bevelSize}
													min="0.01"
													max="0.2"
													step="0.01"
													on:change={create3DText}
													class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
												/>
											</div>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Position X/Y/Z -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Position X</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-10" max="10" step="0.1" bind:value={textPositionX} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textPositionX} min="-10" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Position Y</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-10" max="10" step="0.1" bind:value={textPositionY} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textPositionY} min="-10" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Position Z</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-5" max="10" step="0.1" bind:value={textPositionZ} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textPositionZ} min="-5" max="10" step="0.1" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>

							<!-- Rotation X/Y/Z -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Rotation X</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={textRotationX} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textRotationX} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Rotation Y</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={textRotationY} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textRotationY} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>
							<div class="rounded-lg p-3 hover:bg-white/5">
								<label class="text-sm font-semibold text-white">Rotation Z</label>
								<div class="mt-1 flex gap-2">
									<input type="range" min="-3.14" max="3.14" step="0.01" bind:value={textRotationZ} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
									<input type="number" bind:value={textRotationZ} min="-3.14" max="3.14" step="0.01" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
								</div>
							</div>

							<!-- Auto Rotate -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">Auto Rotate</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={textAutoRotate} class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
							</div>

							{#if textAutoRotate}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Rotate Speed</label>
									<div class="mt-1 flex gap-2">
										<input type="range" min="0.001" max="0.1" step="0.001" bind:value={textAutoRotateSpeed} class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" bind:value={textAutoRotateSpeed} min="0.001" max="0.1" step="0.001" class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white" />
									</div>
								</div>
							{/if}
						</div>
					</details>
				</div>
			</div>

			<!-- ACTION BUTTONS -->
			<div class="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
				<button on:click={resetAll} class="btn btn-ghost btn-sm">🔄 Reset All</button>
				{#if onSendToVideoRefs}
					<button on:click={sendToVideoRefs} class="btn btn-sm btn-secondary">🎬 Send to Video Refs</button>
				{/if}
				<button on:click={exportImage} class="btn btn-sm btn-primary">⬇️ Export Image</button>
			</div>
		</div>
	</div>
</div>

<style>
	::-webkit-scrollbar {
		width: 8px;
	}
	::-webkit-scrollbar-track {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 4px;
	}
	::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.2);
		border-radius: 4px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.3);
	}
	summary::-webkit-details-marker {
		display: none;
	}
</style>