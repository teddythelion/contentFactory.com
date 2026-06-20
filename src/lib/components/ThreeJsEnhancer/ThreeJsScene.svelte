<!-- src/lib/components/ThreeJsEnhancer/ThreeJsScene.svelte -->
<!-- HANDLES ALL THREE.JS SCENE LOGIC WITH ENHANCED PARTICLES + LOGO -->

<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { videoState } from '$lib/stores/video.store';
	import { threeJsState } from '$lib/stores/threeJs.store';
	import ThreeJsText from './ThreeJsText.svelte';
	import ThreeJsLogo from './ThreeJsLogo.svelte';
	import { text3DState } from '$lib/stores/text3d.store';
	import { audioStudioStore } from '$lib/stores/audioStudio.store';
	import { mediaBinStore } from '$lib/stores/mediaBin.store';
	import { timelineStore } from '$lib/stores/timeline.store';
	import TimelineEditor from './TimelineEditor.svelte';
	import MediaBin from './MediaBin.svelte';

	let threeJsTextComponent: ThreeJsText;
	let threeJsLogoComponent: ThreeJsLogo;

	$: videoUrl = $videoState.videoUrl;

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer | null = null;
	let mesh: THREE.Mesh | null = null;
	let animationId: number | null = null;
	let destroyed = false;
	let videoTexture: THREE.VideoTexture | null = null;
	let videoElement: HTMLVideoElement | null = null;

	let ambientLight: THREE.AmbientLight | null = null;
	let directionalLight: THREE.DirectionalLight | null = null;
	let particleSystem: THREE.Points | null = null;
	let particleGeometry: THREE.BufferGeometry | null = null;
	let particleMaterial: THREE.PointsMaterial | THREE.ShaderMaterial | null = null;	

	$: selectedShape = $threeJsState.selectedShape;
	$: rotationX = $threeJsState.rotationX;
	$: rotationY = $threeJsState.rotationY;
	$: rotationZ = $threeJsState.rotationZ;
	$: autoRotate = $threeJsState.autoRotate;
	$: autoRotateSpeed = $threeJsState.autoRotateSpeed;
	$: cameraDistance = $threeJsState.cameraDistance;
	$: scale = $threeJsState.scale;
	$: ambientIntensity = $threeJsState.ambientIntensity;
	$: directionalIntensity = $threeJsState.directionalIntensity;
	$: videoGlow = $threeJsState.videoGlow;
	$: shapeGlow = $threeJsState.shapeGlow;
	$: videoPanX = $threeJsState.videoPanX;
	$: videoPanY = $threeJsState.videoPanY;
	$: particlesEnabled = $threeJsState.particlesEnabled;
	$: particleCount = $threeJsState.particleCount;
	$: particleSize = $threeJsState.particleSize;
	$: particleSpeed = $threeJsState.particleSpeed;
	$: particleSpread = $threeJsState.particleSpread;
	$: particleColor = $threeJsState.particleColor;
	$: particleOpacity = $threeJsState.particleOpacity;
	$: particleReactToVideo = $threeJsState.particleReactToVideo;
	$: fogEnabled = $text3DState.fogEnabled;
	$: fogColor = $text3DState.fogColor;
	$: fogNear = $text3DState.fogNear;
	$: fogFar = $text3DState.fogFar;
	$: particleShape = $threeJsState.particleShape;
	$: particleAnimation = $threeJsState.particleAnimation;
	$: particleAnimationSpeed = $threeJsState.particleAnimationSpeed;
	$: particleTrailEnabled = $threeJsState.particleTrailEnabled;
	$: particleGlow = $threeJsState.particleGlow;
	$: particleRotation = $threeJsState.particleRotation;
	$: particleColorMode = $threeJsState.particleColorMode;
	$: particleGradientColor = $threeJsState.particleGradientColor;
	$: videoFadeIn = $audioStudioStore.videoFadeIn;
	$: videoFadeOut = $audioStudioStore.videoFadeOut;
	let fadeOverlayOpacity = 0;

	let isDragging = false;
	let previousMousePosition = { x: 0, y: 0 };
	let isVideoPaused = false;	
	let videoDuration = 0;
	// ── Video player controls ──────────────────────────────────────────────
	let currentTime = 0;
	let duration = 0;
	let isScrubbing = false;
	let playerInterval: ReturnType<typeof setInterval> | null = null;

	$: if (scene) {
		if (fogEnabled) {
			scene.fog = new THREE.Fog(new THREE.Color(fogColor), fogNear, fogFar);
		} else {
			scene.fog = null;
		}
	}
			function startPlayerPolling() {
				playerInterval = setInterval(() => {
				const vid = (window as any).__threeJsVideo as HTMLVideoElement | null;
				if (!vid) return;
				if (!isScrubbing) currentTime = vid.currentTime;
				duration = vid.duration || 0;
						}, 100);
			}

			

			function formatTime(s: number): string {
				if (!isFinite(s)) return '0:00.0';
				const m = Math.floor(s / 60);
				const sec = (s % 60).toFixed(1).padStart(4, '0');
				return `${m}:${sec}`;
			}


//need to remove this
	function togglePlayPause() {
		if (!videoElement) return;
		if (videoElement.paused) {
			videoElement.play().catch((err) => console.error('Play error:', err));
			isVideoPaused = false;
		} else {
			videoElement.pause();
			isVideoPaused = true;
		}
	}

	onMount(() => {
		if (!videoUrl) return;

		// Wait one rAF so the browser has finished painting the canvas container
		// and clientWidth/clientHeight are non-zero before we create the renderer.
		requestAnimationFrame(() => {
			initThreeJS();
		});

		canvas.addEventListener('mousedown', onMouseDown);
		canvas.addEventListener('mousemove', onMouseMove);
		canvas.addEventListener('mouseup', onMouseUp);
		canvas.addEventListener('touchstart', onTouchStart);
		canvas.addEventListener('touchmove', onTouchMove);
		canvas.addEventListener('touchend', onTouchEnd);

		// NOTE: animate() is called only once, from inside loadedmetadata,
		// AFTER the mesh and video texture exist. Do NOT call it here —
		// a second concurrent RAF loop causes 2x accumulation on += state
		// (auto-rotate, particle rotation) and leaks after unmount.

		return () => {
			destroyed = true; // stops the RAF loop regardless of animationId
			if (playerInterval) clearInterval(playerInterval);
			if (animationId) { cancelAnimationFrame(animationId); animationId = null; }
			audioStudioStore.stopAll();
			if (particleSystem) {
				scene.remove(particleSystem);
				if (particleGeometry) { particleGeometry.dispose(); particleGeometry = null; }
				if (particleMaterial) {
					if (particleMaterial instanceof THREE.ShaderMaterial || particleMaterial instanceof THREE.PointsMaterial) {
						particleMaterial.dispose();
					}
					particleMaterial = null;
				}
				particleSystem = null;
			}

			if (mesh) {
				scene.remove(mesh);
				if (mesh.geometry) mesh.geometry.dispose();
				if (mesh.material) {
					if (Array.isArray(mesh.material)) { mesh.material.forEach((m) => m.dispose()); }
					else { mesh.material.dispose(); }
				}
				mesh = null;
			}

			if (ambientLight) { scene.remove(ambientLight); ambientLight = null; }
			if (directionalLight) { scene.remove(directionalLight); directionalLight = null; }

			if (videoElement) { videoElement.pause(); videoElement.src = ''; videoElement.load(); videoElement = null; }
			if (videoTexture) { videoTexture.dispose(); videoTexture = null; }

			if (renderer) { renderer.dispose(); renderer.forceContextLoss(); renderer = null; }

			if (scene) {
				while (scene.children.length > 0) {
					const child = scene.children[0];
					scene.remove(child);
					if (child instanceof THREE.Mesh) {
						if (child.geometry) child.geometry.dispose();
						if (child.material) {
							if (Array.isArray(child.material)) { child.material.forEach((m) => m.dispose()); }
							else { child.material.dispose(); }
						}
					}
				}
			}

			(window as any).__threeJsCanvas = null;
			(window as any).__threeJsVideo = null;
			(window as any).__threeJsRenderer = null;
			(window as any).__threeJsScene = null;
			(window as any).__threeJsCamera = null;
			(window as any).__threeJsCapturing = false;
			(window as any).__threeJsUpdateScene = null;
			(window as any).__threeJsVideoTexture = null;
			threeJsState.setSceneReady(false);

			if (canvas) {
				canvas.removeEventListener('mousedown', onMouseDown);
				canvas.removeEventListener('mousemove', onMouseMove);
				canvas.removeEventListener('mouseup', onMouseUp);
				canvas.removeEventListener('touchstart', onTouchStart);
				canvas.removeEventListener('touchmove', onTouchMove);
				canvas.removeEventListener('touchend', onTouchEnd);
			}
			window.removeEventListener('resize', handleResize);
		};
	});

	function initThreeJS() {
		if (!videoUrl) { console.error('Cannot initialize Three.js: videoUrl is null'); return; }

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a1a);

		camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
		camera.position.z = cameraDistance;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);

		(window as any).__threeJsCanvas = canvas;
		(window as any).__threeJsRenderer = renderer;
		(window as any).__threeJsScene = scene;
		(window as any).__threeJsCamera = camera;
		(window as any).__threeJsCapturing = false;

		(window as any).__threeJsUpdateScene = (time: number) => {
			if (mesh) {
				mesh.rotation.x = rotationX;
				mesh.rotation.y = rotationY;
				mesh.rotation.z = rotationZ;
				if (autoRotate) mesh.rotation.y += autoRotateSpeed;
				mesh.position.x = videoPanX;
				mesh.position.y = videoPanY;
				if (mesh.material instanceof THREE.MeshStandardMaterial) {
					mesh.material.emissiveIntensity = videoGlow + shapeGlow;
				}
			}
			// During capture, time IS video time — pass as both args
			if (threeJsTextComponent) threeJsTextComponent.updateAnimation(time, time);
			if (threeJsLogoComponent) threeJsLogoComponent.updateAnimation(time);
			updateParticles(time);
			camera.position.z = cameraDistance;
			if (ambientLight) ambientLight.intensity = ambientIntensity;
			if (directionalLight) directionalLight.intensity = directionalIntensity;
		};

		ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
		scene.add(ambientLight);

		directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
		directionalLight.position.set(5, 5, 5);
		scene.add(directionalLight);

		threeJsState.updateMultiple({ ambientIntensity: 1.2, directionalIntensity: 1.5 });

		videoElement = document.createElement('video');
		videoElement.crossOrigin = 'anonymous';
		videoElement.loop = false;
		videoElement.muted = false;
		videoElement.setAttribute('playsinline', '');
		videoElement.setAttribute('webkit-playsinline', '');
		(window as any).__threeJsVideo = videoElement;

		if (videoUrl.startsWith('data:')) {
			videoElement.crossOrigin = '';
			videoElement.src = videoUrl;
		} else if (videoUrl.startsWith('https://storage.googleapis.com')) {
			videoElement.crossOrigin = '';
			const proxyUrl = `/api/proxyVideo?url=${encodeURIComponent(videoUrl)}`;
			videoElement.src = proxyUrl;
			console.log('🔄 Using proxy for GCS video:', proxyUrl);
		} else if (videoUrl.startsWith('blob:')) {
			videoElement.crossOrigin = '';
			videoElement.src = videoUrl;
		} else {
			videoElement.src = videoUrl;
		}

		videoElement.addEventListener('loadedmetadata', () => {
			videoTexture = new THREE.VideoTexture(videoElement!);
			videoTexture.colorSpace = THREE.SRGBColorSpace;
			videoTexture.minFilter = THREE.LinearFilter;
			videoTexture.magFilter = THREE.LinearFilter;
			videoTexture.generateMipmaps = false;
			(window as any).__threeJsVideoTexture = videoTexture;

			createMesh(selectedShape);
			videoElement!.play().catch((err) => console.error('Play error:', err));
			animate();
			window.dispatchEvent(new CustomEvent('threeJsSceneReady'));
			threeJsState.setSceneReady(true);
			startPlayerPolling();
			audioStudioStore.connectVideo(videoElement!);
			const vidDuration = videoElement!.duration;
			videoState.setVideoDimensions(videoElement!.videoWidth, videoElement!.videoHeight, vidDuration);
			// Register video in media bin + create a video track (replace on re-load)
			timelineStore.clearAll();
			mediaBinStore.clearAll();
			const videoAssetId = mediaBinStore.addAsset({
				type: 'video',
				name: 'Main Video',
				sessionId: null,
				previewUrl: videoUrl,
				duration: vidDuration
			});
			timelineStore.addVideoTrack(videoAssetId, 'Main Video', vidDuration);
		});

		window.addEventListener('resize', handleResize);
		createParticleSystem();
	}

	function createMesh(shape: string) {
		if (mesh) {
			scene.remove(mesh);
			mesh.geometry.dispose();
			if (Array.isArray(mesh.material)) { mesh.material.forEach((mat) => mat.dispose()); }
			else { mesh.material.dispose(); }
		}

		let geometry: THREE.BufferGeometry;
		let applyDiamondRotation = false;

		switch (shape) {
			// ── ORIGINAL ─────────────────────────────────────────────────
			case 'sphere':
				geometry = new THREE.SphereGeometry(2, 64, 64);
				break;
			case 'cube':
				geometry = new THREE.BoxGeometry(3, 3, 3);
				break;
			case 'cylinder':
				geometry = new THREE.CylinderGeometry(2, 2, 3, 64);
				break;
			case 'torus':
				geometry = new THREE.TorusGeometry(2, 0.8, 32, 100);
				break;
			case 'icosahedron':
				geometry = new THREE.IcosahedronGeometry(2, 4);
				break;

			// ── NEW 3D PRIMITIVES ─────────────────────────────────────────
			case 'cone':
				geometry = new THREE.ConeGeometry(2, 4, 64);
				break;
			case 'ring':
				// Thin torus — flat disc/ring shape
				geometry = new THREE.TorusGeometry(2, 0.2, 16, 100);
				break;
			case 'octahedron':
				geometry = new THREE.OctahedronGeometry(2, 2);
				break;
			case 'tetrahedron':
				geometry = new THREE.TetrahedronGeometry(2.5, 2);
				break;

			// ── FLAT SHAPES ───────────────────────────────────────────────
			case 'diamond': {
				// Aspect-correct plane rotated 45° — classic card/diamond orientation
				const aspect =
					videoElement && videoElement.videoWidth && videoElement.videoHeight
						? videoElement.videoWidth / videoElement.videoHeight
						: 16 / 9;
				geometry = new THREE.PlaneGeometry(4 * aspect, 4);
				applyDiamondRotation = true;
				break;
			}
			case 'hexagon': {
				// Custom 6-sided flat polygon fan-triangulated from center
				const r = 2.5;
				const verts: number[] = [];
				const uvs: number[] = [];
				for (let i = 0; i < 6; i++) {
					const a0 = (i / 6) * Math.PI * 2;
					const a1 = ((i + 1) / 6) * Math.PI * 2;
					verts.push(0, 0, 0);
					uvs.push(0.5, 0.5);
					verts.push(Math.cos(a0) * r, Math.sin(a0) * r, 0);
					uvs.push(0.5 + Math.cos(a0) * 0.5, 0.5 + Math.sin(a0) * 0.5);
					verts.push(Math.cos(a1) * r, Math.sin(a1) * r, 0);
					uvs.push(0.5 + Math.cos(a1) * 0.5, 0.5 + Math.sin(a1) * 0.5);
				}
				const hexGeo = new THREE.BufferGeometry();
				hexGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
				hexGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
				hexGeo.computeVertexNormals();
				geometry = hexGeo;
				break;
			}
			case 'cinematic': {
				// 2.39:1 ultra-wide Scope aspect — ignores video's native ratio intentionally
				geometry = new THREE.PlaneGeometry(4 * 2.39, 4);
				break;
			}

			// ── ORGANIC / ABSTRACT ────────────────────────────────────────
			case 'torusknot':
				geometry = new THREE.TorusKnotGeometry(1.8, 0.5, 200, 32, 2, 3);
				break;
			case 'twistedtorus':
				// Standard torus with low tubular segments for a faceted twisted look
				geometry = new THREE.TorusGeometry(2, 0.7, 8, 80);
				break;

			// ── DEFAULT ───────────────────────────────────────────────────
			case 'plane':
			default: {
				const aspect =
					videoElement && videoElement.videoWidth && videoElement.videoHeight
						? videoElement.videoWidth / videoElement.videoHeight
						: 16 / 9;
				geometry = new THREE.PlaneGeometry(4 * aspect, 4);
				break;
			}
		}

		const material = new THREE.MeshStandardMaterial({
			map: videoTexture,
			side: THREE.DoubleSide,
			metalness: 0.2,
			roughness: 0.6,
			emissive: new THREE.Color(0xffffff),
			emissiveIntensity: videoGlow
		});

		mesh = new THREE.Mesh(geometry, material);
		mesh.scale.set(scale, scale, scale);
		if (applyDiamondRotation) mesh.rotation.z = Math.PI / 4;
		scene.add(mesh);
	}

	function createParticleTexture(shape: string): THREE.CanvasTexture {
		const size = 128;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d')!;
		const center = size / 2;
		ctx.clearRect(0, 0, size, size);

		const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
		gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
		gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
		gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
		ctx.fillStyle = gradient;

		switch (shape) {
			case 'circle':
				ctx.beginPath();
				ctx.arc(center, center, center * 0.8, 0, Math.PI * 2);
				ctx.fill();
				break;
			case 'square':
				const squareSize = size * 0.7;
				const squareOffset = (size - squareSize) / 2;
				ctx.fillRect(squareOffset, squareOffset, squareSize, squareSize);
				break;
			case 'triangle':
				ctx.beginPath();
				ctx.moveTo(center, size * 0.1);
				ctx.lineTo(size * 0.1, size * 0.9);
				ctx.lineTo(size * 0.9, size * 0.9);
				ctx.closePath();
				ctx.fill();
				break;
			case 'star':
				drawStar(ctx, center, center, 5, center * 0.8, center * 0.4);
				ctx.fill();
				break;
			case 'heart':
				drawHeart(ctx, center, center, size * 0.4);
				ctx.fill();
				break;
			default:
				ctx.beginPath();
				ctx.arc(center, center, center * 0.8, 0, Math.PI * 2);
				ctx.fill();
		}

		return new THREE.CanvasTexture(canvas);
	}

	function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
		let rot = (Math.PI / 2) * 3;
		let x = cx; let y = cy;
		const step = Math.PI / spikes;
		ctx.beginPath();
		ctx.moveTo(cx, cy - outerRadius);
		for (let i = 0; i < spikes; i++) {
			x = cx + Math.cos(rot) * outerRadius; y = cy + Math.sin(rot) * outerRadius;
			ctx.lineTo(x, y); rot += step;
			x = cx + Math.cos(rot) * innerRadius; y = cy + Math.sin(rot) * innerRadius;
			ctx.lineTo(x, y); rot += step;
		}
		ctx.lineTo(cx, cy - outerRadius);
		ctx.closePath();
	}

	function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
		ctx.beginPath();
		const topCurveHeight = size * 0.3;
		ctx.moveTo(x, y + topCurveHeight);
		ctx.bezierCurveTo(x, y, x - size / 2, y, x - size / 2, y + topCurveHeight);
		ctx.bezierCurveTo(x - size / 2, y + (size + topCurveHeight) / 2, x, y + (size + topCurveHeight) / 2, x, y + size);
		ctx.bezierCurveTo(x, y + (size + topCurveHeight) / 2, x + size / 2, y + (size + topCurveHeight) / 2, x + size / 2, y + topCurveHeight);
		ctx.bezierCurveTo(x + size / 2, y, x, y, x, y + topCurveHeight);
		ctx.closePath();
	}

	function createParticleSystem() {
		if (particleSystem) {
			scene.remove(particleSystem);
			if (particleGeometry) particleGeometry.dispose();
			if (particleMaterial) particleMaterial.dispose();
		}

		particleGeometry = new THREE.BufferGeometry();
		const positions = new Float32Array(particleCount * 3);
		const velocities = new Float32Array(particleCount * 3);
		const phases = new Float32Array(particleCount);
		const colors = new Float32Array(particleCount * 3);
		const sizes = new Float32Array(particleCount);

		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			if (particleAnimation === 'fountain') {
				// Start all particles at the base of the fountain
				positions[i3] = (Math.random() - 0.5) * 2;
				positions[i3 + 1] = -particleSpread / 2;
				positions[i3 + 2] = (Math.random() - 0.5) * 2;
				// Stagger initial velocities so the fountain isn't a single burst on load
				velocities[i3] = (Math.random() - 0.5) * 0.05;
				velocities[i3 + 1] = (0.15 + Math.random() * 0.2) * particleAnimationSpeed;
				velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;
			} else {
				positions[i3] = (Math.random() - 0.5) * particleSpread;
				positions[i3 + 1] = (Math.random() - 0.5) * particleSpread;
				positions[i3 + 2] = (Math.random() - 0.5) * particleSpread;
				velocities[i3] = (Math.random() - 0.5) * particleSpeed * 0.1;
				velocities[i3 + 1] = (Math.random() - 0.5) * particleSpeed * 0.1;
				velocities[i3 + 2] = (Math.random() - 0.5) * particleSpeed * 0.1;
			}
			phases[i] = Math.random() * Math.PI * 2;
			sizes[i] = particleSize * (0.5 + Math.random());
			const hue = (i / particleCount) * 360;
			const rgb = hslToRgb(hue / 360, 1, 0.5);
			colors[i3] = rgb[0]; colors[i3 + 1] = rgb[1]; colors[i3 + 2] = rgb[2];
		}

		particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
		particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
		particleGeometry.userData.velocities = velocities;
		particleGeometry.userData.phases = phases;

		if (particleColorMode === 'rainbow' || particleColorMode === 'gradient') {
			particleMaterial = new THREE.PointsMaterial({
				size: particleSize, transparent: true, opacity: particleOpacity,
				blending: particleGlow ? THREE.AdditiveBlending : THREE.NormalBlending,
				depthWrite: false, vertexColors: true,
				map: createParticleTexture(particleShape), sizeAttenuation: true
			});
		} else {
			particleMaterial = new THREE.PointsMaterial({
				color: particleColor, size: particleSize, transparent: true, opacity: particleOpacity,
				blending: particleGlow ? THREE.AdditiveBlending : THREE.NormalBlending,
				depthWrite: false, map: createParticleTexture(particleShape), sizeAttenuation: true
			});
		}

		particleSystem = new THREE.Points(particleGeometry, particleMaterial);
		if (particlesEnabled) scene.add(particleSystem);
	}

	function hslToRgb(h: number, s: number, l: number): [number, number, number] {
		let r, g, b;
		if (s === 0) { r = g = b = l; } else {
			const hue2rgb = (p: number, q: number, t: number) => {
				if (t < 0) t += 1; if (t > 1) t -= 1;
				if (t < 1 / 6) return p + (q - p) * 6 * t;
				if (t < 1 / 2) return q;
				if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
				return p;
			};
			const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			const p = 2 * l - q;
			r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
		}
		return [r, g, b];
	}

	function updateParticles(animationTime: number) {
		if (!particleSystem || !particlesEnabled || !particleGeometry) return;

		const positions = particleGeometry.attributes.position.array as Float32Array;
		const velocities = particleGeometry.userData.velocities as Float32Array;
		const phases = particleGeometry.userData.phases as Float32Array;
		const sizes = particleGeometry.attributes.size?.array as Float32Array;
		const colors = particleGeometry.attributes.color?.array as Float32Array;

		for (let i = 0; i < particleCount; i++) {
			const i3 = i * 3;
			switch (particleAnimation) {
				case 'spiral': {
					const spiralRadius = 5 + Math.sin(animationTime + phases[i]) * 2;
					const spiralAngle = animationTime * 2 * particleAnimationSpeed + i * 0.1;
					positions[i3] = Math.cos(spiralAngle) * spiralRadius;
					positions[i3 + 1] = (i / particleCount - 0.5) * particleSpread;
					positions[i3 + 2] = Math.sin(spiralAngle) * spiralRadius;
					break;
				}
				case 'wave':
					positions[i3] += velocities[i3] * particleSpeed;
					positions[i3 + 1] = Math.sin(animationTime + phases[i] + positions[i3] * 0.5) * 3;
					positions[i3 + 2] += velocities[i3 + 2] * particleSpeed;
					break;
				case 'vortex':
					const vortexRadius = Math.sqrt(positions[i3] ** 2 + positions[i3 + 2] ** 2);
					const vortexAngle = Math.atan2(positions[i3 + 2], positions[i3]) + particleSpeed * 0.5;
					const vortexPull = vortexRadius > 0.1 ? -particleSpeed * 2 : 0;
					positions[i3] = Math.cos(vortexAngle) * (vortexRadius + vortexPull);
					positions[i3 + 2] = Math.sin(vortexAngle) * (vortexRadius + vortexPull);
					positions[i3 + 1] += velocities[i3 + 1] * particleSpeed;
					break;
				case 'explosion':
					const explosionPulse = Math.sin(animationTime * 2) * 0.5 + 0.5;
					positions[i3] += velocities[i3] * particleSpeed * 5 * explosionPulse;
					positions[i3 + 1] += velocities[i3 + 1] * particleSpeed * 5 * explosionPulse;
					positions[i3 + 2] += velocities[i3 + 2] * particleSpeed * 5 * explosionPulse;
					break;
				case 'orbit':
					const orbitRadius = 5 + (i / particleCount) * 3;
					const orbitSpeed = animationTime * (1 + i / particleCount) * 0.5;
					positions[i3] = Math.cos(orbitSpeed) * orbitRadius;
					positions[i3 + 1] = Math.sin(animationTime * 2 + phases[i]) * 2;
					positions[i3 + 2] = Math.sin(orbitSpeed) * orbitRadius;
					break;
				case 'fountain':
					// Use velocity directly (no particleSpeed multiplier) so the fountain
					// behaves consistently. particleAnimationSpeed controls the launch force.
					positions[i3] += velocities[i3];
					positions[i3 + 1] += velocities[i3 + 1];
					positions[i3 + 2] += velocities[i3 + 2];
					velocities[i3 + 1] -= 0.003; // gravity
					if (positions[i3 + 1] < -particleSpread / 2) {
						positions[i3] = (Math.random() - 0.5) * 2;
						positions[i3 + 1] = -particleSpread / 2;
						positions[i3 + 2] = (Math.random() - 0.5) * 2;
						velocities[i3] = (Math.random() - 0.5) * 0.05;
						velocities[i3 + 1] = (0.15 + Math.random() * 0.2) * particleAnimationSpeed;
						velocities[i3 + 2] = (Math.random() - 0.5) * 0.05;
					}
					break;
				case 'pulse':
					const pulseFactor = Math.sin(animationTime * 3 + phases[i]) * 0.3 + 1;
					if (sizes) sizes[i] = particleSize * pulseFactor;
					positions[i3] += velocities[i3] * particleSpeed;
					positions[i3 + 1] += velocities[i3 + 1] * particleSpeed;
					positions[i3 + 2] += velocities[i3 + 2] * particleSpeed;
					break;
				default:
					positions[i3] += velocities[i3] * particleSpeed;
					positions[i3 + 1] += velocities[i3 + 1] * particleSpeed;
					positions[i3 + 2] += velocities[i3 + 2] * particleSpeed;
			}

			if (!['spiral', 'orbit', 'fountain'].includes(particleAnimation)) {
				const boundary = particleSpread / 2;
				if (Math.abs(positions[i3]) > boundary) { positions[i3] = (Math.random() - 0.5) * particleSpread; velocities[i3] = (Math.random() - 0.5) * particleSpeed * 0.1; }
				if (Math.abs(positions[i3 + 1]) > boundary) { positions[i3 + 1] = (Math.random() - 0.5) * particleSpread; velocities[i3 + 1] = (Math.random() - 0.5) * particleSpeed * 0.1; }
				if (Math.abs(positions[i3 + 2]) > boundary) { positions[i3 + 2] = (Math.random() - 0.5) * particleSpread; velocities[i3 + 2] = (Math.random() - 0.5) * particleSpeed * 0.1; }
			}

			if (particleColorMode === 'gradient' && colors) {
				const gradientFactor = (positions[i3 + 1] + particleSpread / 2) / particleSpread;
				const color1 = new THREE.Color(particleColor);
				const color2 = new THREE.Color(particleGradientColor);
				const mixedColor = color1.clone().lerp(color2, gradientFactor);
				colors[i3] = mixedColor.r; colors[i3 + 1] = mixedColor.g; colors[i3 + 2] = mixedColor.b;
			}
		}

		particleGeometry.attributes.position.needsUpdate = true;
		if (sizes) particleGeometry.attributes.size.needsUpdate = true;
		if (colors && particleColorMode === 'gradient') particleGeometry.attributes.color.needsUpdate = true;
		if (particleRotation && particleSystem) particleSystem.rotation.y += 0.001 * particleAnimationSpeed;
	}

	function animate() {
		if (destroyed) return; // component unmounted — stop the loop permanently
		if ((window as any).__threeJsCapturing) { animationId = requestAnimationFrame(animate); return; }

		animationId = requestAnimationFrame(animate);
		// Use wall-clock time for live preview so particle/text animations always advance
		// regardless of whether the video is playing or paused.
		// During capture, __threeJsUpdateScene is called with videoElement.currentTime
		// directly, keeping frame-accurate rendering for the export.
		const animationTime = performance.now() * 0.001;

		if (mesh) {
			mesh.rotation.x = rotationX;
			mesh.rotation.y = rotationY;
			mesh.rotation.z = rotationZ;
			if (autoRotate) mesh.rotation.y += autoRotateSpeed;
			mesh.position.x = videoPanX;
			mesh.position.y = videoPanY;
			if (mesh.material instanceof THREE.MeshStandardMaterial) {
				mesh.material.emissiveIntensity = videoGlow + shapeGlow;
			}
		}

		const videoTime = videoElement?.currentTime ?? 0;
		if (threeJsTextComponent) threeJsTextComponent.updateAnimation(animationTime, videoTime);
		if (threeJsLogoComponent) threeJsLogoComponent.updateAnimation(animationTime);
		updateParticles(animationTime);

		camera.position.z = cameraDistance;
		if (ambientLight) ambientLight.intensity = ambientIntensity;
		if (directionalLight) directionalLight.intensity = directionalIntensity;
		if (renderer) renderer.render(scene, camera);

		// Live fade-to-black preview + original audio fade — mirrors FFmpeg filters at export time
		if (videoElement) {
			const t = videoElement.currentTime;
			const d = videoElement.duration || 0;
			let op = 0;
			if (videoFadeIn > 0 && t < videoFadeIn) op = Math.max(op, 1 - t / videoFadeIn);
			if (videoFadeOut > 0 && d > 0 && t > d - videoFadeOut) op = Math.max(op, 1 - (d - t) / videoFadeOut);
			fadeOverlayOpacity = Math.min(1, Math.max(0, op));
			audioStudioStore.syncOriginalFadeToVideo(t, d);
		}
	}

	function handleResize() {
		if (!canvas || !camera || !renderer) return;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);
	}

	function onMouseDown(event: MouseEvent) { isDragging = true; previousMousePosition = { x: event.clientX, y: event.clientY }; }
	function onMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		const deltaX = event.clientX - previousMousePosition.x;
		const deltaY = event.clientY - previousMousePosition.y;
		threeJsState.updateMultiple({ rotationY: rotationY + deltaX * 0.01, rotationX: rotationX + deltaY * 0.01 });
		previousMousePosition = { x: event.clientX, y: event.clientY };
	}
	function onMouseUp() { isDragging = false; }
	function onTouchStart(event: TouchEvent) { isDragging = true; previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }
	function onTouchMove(event: TouchEvent) {
		if (!isDragging) return;
		const deltaX = event.touches[0].clientX - previousMousePosition.x;
		const deltaY = event.touches[0].clientY - previousMousePosition.y;
		threeJsState.updateMultiple({ rotationY: rotationY + deltaX * 0.01, rotationX: rotationX + deltaY * 0.01 });
		previousMousePosition = { x: event.touches[0].clientX, y: event.touches[0].clientY };
	}
	function onTouchEnd() { isDragging = false; }

	$: if (mesh && videoTexture && selectedShape) createMesh(selectedShape);
	$: if (mesh) mesh.scale.set(scale, scale, scale);
	$: if (scene && (particleShape || particleColorMode || particleAnimation)) createParticleSystem();
	$: if (particleSystem && particleGeometry && particleMaterial) {
		if (particlesEnabled && !scene.children.includes(particleSystem)) { scene.add(particleSystem); }
		else if (!particlesEnabled && scene.children.includes(particleSystem)) { scene.remove(particleSystem); }
		if (particleMaterial instanceof THREE.PointsMaterial) {
			particleMaterial.size = particleSize;
			if (particleColorMode === 'solid') particleMaterial.color.set(particleColor);
			particleMaterial.opacity = particleOpacity;
			particleMaterial.blending = particleGlow ? THREE.AdditiveBlending : THREE.NormalBlending;
		}
	}

		
</script>

<div class="relative h-full w-full">
	<canvas bind:this={canvas} class="h-full w-full"></canvas>

	{#if fadeOverlayOpacity > 0 && !(window as any).__threeJsCapturing}
		<div class="pointer-events-none absolute inset-0 bg-black" style="opacity: {fadeOverlayOpacity};"></div>
	{/if}

	{#if videoElement && !(window as any).__threeJsCapturing}
		<div class="absolute bottom-0 left-0 right-0 flex flex-col gap-1 bg-black/90 backdrop-blur-sm p-1">
			<MediaBin />
			<TimelineEditor {videoElement} />
		</div>
	{/if}
</div>

<ThreeJsText {scene} bind:this={threeJsTextComponent} />
<ThreeJsLogo {scene} bind:this={threeJsLogoComponent} />

<style>
	.pause-btn {
		position: absolute;
		bottom: 12px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.5);
		border: 1px solid rgba(255, 255, 255, 0.2);
		color: white;
		cursor: pointer;
		opacity: 0.4;
		transition: opacity 0.2s ease, background 0.2s ease;
		backdrop-filter: blur(4px);
		z-index: 10;
	}
	.pause-btn:hover {
		opacity: 1;
		background: rgba(0, 0, 0, 0.75);
	}
</style>