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
	import { timelineStore, DEFAULT_CLIP_TRANSFORM, type TimelineClip } from '$lib/stores/timeline.store';
	import { clipTransitionState, computeTransitionFX } from '$lib/utils/clipTransitions';
	import { logoState } from '$lib/stores/logo.store';
	import { editHistory } from '$lib/stores/editHistory.store';
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

	// ── MULTI-CLIP COMPOSITING ────────────────────────────────────────
	// Off-screen canvas composites multiple video elements each frame.
	// THREE.CanvasTexture replaces VideoTexture so all shape/material effects are preserved.
	let compositeCanvas: HTMLCanvasElement | null = null;
	let compositeCtx: CanvasRenderingContext2D | null = null;
	let compositeTexture: THREE.CanvasTexture | null = null;
	// assetId → HTMLVideoElement for all secondary sources
	let secondaryVideoElements: Map<string, HTMLVideoElement> = new Map();
	// assetId → HTMLImageElement for static image clips (drawn like a frozen video)
	let imageElements: Map<string, HTMLImageElement> = new Map();
	// The main video's media-bin asset id — its track can be reordered below other
	// video tracks, so "primary element" and "first video track" are decoupled.
	let mainVideoAssetId: string | null = null;
	let compositeLayout: 'single' | 'split-h' | 'split-v' | 'pip-tr' | 'pip-bl' | 'grid' = 'single';

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
				// Drive the timeline playhead from here — it must not depend on the
				// editor's timeupdate listeners. While paused we stay silent so manual
				// playhead drags/seeks aren't stomped; during capture the video is
				// paused-but-seeking, so keep pushing progress.
				if (!vid.paused || (window as any).__threeJsCapturing) {
					videoState.setCurrentTime(vid.currentTime);
				}
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
			if (compositeTexture) { compositeTexture.dispose(); compositeTexture = null; }
			for (const [, el] of secondaryVideoElements) { el.pause(); el.src = ''; el.load(); }
			secondaryVideoElements.clear();
			imageElements.clear();

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
			(window as any).__threeJsDrawComposite = null;
			(window as any).__threeJsSeekSecondaries = null;
			(window as any).__threeJsMainVideoAssetId = null;
			(window as any).__threeJsVideoTexture = null;
			threeJsState.setSceneReady(false);

			if (canvas) {
				canvas.removeEventListener('mousedown', onMouseDown);
				canvas.removeEventListener('mousemove', onMouseMove);
				canvas.removeEventListener('mouseup', onMouseUp);
				canvas.removeEventListener('touchstart', onTouchStart);
				canvas.removeEventListener('touchmove', onTouchMove);
				canvas.removeEventListener('touchend', onTouchEnd);
				canvas.removeEventListener('webglcontextlost', onContextLost);
				canvas.removeEventListener('webglcontextrestored', onContextRestored);
			}
			window.removeEventListener('resize', handleResize);
		};
	});

	let contextRestoreTimer: ReturnType<typeof setTimeout> | null = null;

	function onContextLost(e: Event) {
		// Without preventDefault the browser never attempts a restore — the canvas
		// would stay dead (white) until a full page reload.
		e.preventDefault();
		console.warn('⚠️ WebGL context lost (GPU driver reset?) — waiting for browser restore...');
		contextRestoreTimer = setTimeout(() => {
			console.error('❌ WebGL context not restored after 10s — reload the page to recover the preview.');
		}, 10_000);
	}

	function onContextRestored() {
		if (contextRestoreTimer) { clearTimeout(contextRestoreTimer); contextRestoreTimer = null; }
		console.log('✅ WebGL context restored — recovering preview');
		try {
			// Three re-creates GPU buffers on the next render; CPU-side canvas/video
			// textures need an explicit dirty flag to re-upload their pixels.
			if (compositeTexture) compositeTexture.needsUpdate = true;
			if (videoTexture) videoTexture.needsUpdate = true;
			updateCompositeFrame();
			if (renderer && scene && camera) renderer.render(scene, camera);
		} catch (err) {
			console.error('WebGL restore recovery failed — reload the page:', err);
		}
	}

	function initThreeJS() {
		if (!videoUrl) { console.error('Cannot initialize Three.js: videoUrl is null'); return; }

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x1a1a1a);

		camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
		camera.position.z = cameraDistance;

		renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(canvas.clientWidth, canvas.clientHeight);

		// GPU driver resets (Windows TDR — monitor blinks, driver restarts) kill the
		// WebGL context and leave the canvas permanently white. preventDefault on
		// contextlost is what allows the browser to restore the context at all;
		// on restore, re-upload the CPU-side textures and render one frame so the
		// preview comes back without a page reload.
		canvas.addEventListener('webglcontextlost', onContextLost, false);
		canvas.addEventListener('webglcontextrestored', onContextRestored, false);

		(window as any).__threeJsCanvas = canvas;
		(window as any).__threeJsRenderer = renderer;
		(window as any).__threeJsScene = scene;
		(window as any).__threeJsCamera = camera;
		(window as any).__threeJsCapturing = false;

		// Capture needs to drive the composite draw itself — animate() no-ops while
		// __threeJsCapturing is set, so without this hook the composite canvas (and
		// therefore the main video) is never updated in exported frames.
		(window as any).__threeJsDrawComposite = updateCompositeFrame;

		// Seek all secondary clips to the given timeline time and resolve once their
		// frames are decoded — otherwise capture exports them frozen at whatever frame
		// they were paused on. Assigning an unchanged currentTime never fires 'seeked',
		// hence the diff check; the timeout covers stalled decodes so capture can't hang.
		(window as any).__threeJsSeekSecondaries = async (t: number) => {
			const tracks = $timelineStore.tracks.filter(
				(tr) => tr.type === 'video' && tr.assetId !== mainVideoAssetId
			);
			const waits: Promise<void>[] = [];
			for (const tr of tracks) {
				const el = secondaryVideoElements.get(tr.assetId ?? '');
				if (!el || el.readyState < 1) continue;
				if (!el.paused) el.pause();
				const clip = tr.clips.find((c) => t >= c.startTime && t < c.endTime);
				if (!clip) continue;
				const target = clip.sourceStart + (t - clip.startTime);
				if (Math.abs(el.currentTime - target) < 0.001) continue;
				waits.push(
					new Promise<void>((resolve) => {
						// Generous timeout — capture is offline, and a seek that isn't done
						// leaves readyState < 2, which drops the layer from the composite
						// for that frame (exported flicker/blanking).
						const timeout = setTimeout(() => {
							console.warn(`⚠️ Secondary clip seek to ${target.toFixed(2)}s timed out at t=${t.toFixed(2)}s — frame may render blank`);
							resolve();
						}, 5000);
						el.addEventListener(
							'seeked',
							() => { clearTimeout(timeout); resolve(); },
							{ once: true }
						);
					})
				);
				el.currentTime = target;
			}
			await Promise.all(waits);
		};

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
			// Build an off-screen composite canvas at source resolution
			compositeCanvas = document.createElement('canvas');
			compositeCanvas.width  = videoElement!.videoWidth  || 1920;
			compositeCanvas.height = videoElement!.videoHeight || 1080;
			compositeCtx = compositeCanvas.getContext('2d');
			compositeTexture = new THREE.CanvasTexture(compositeCanvas);
			compositeTexture.colorSpace = THREE.SRGBColorSpace;
			compositeTexture.minFilter = THREE.LinearFilter;
			compositeTexture.magFilter = THREE.LinearFilter;
			compositeTexture.generateMipmaps = false;
			// Keep legacy alias so export/capture code still works
			videoTexture = null;
			(window as any).__threeJsVideoTexture = compositeTexture;

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
			// Fresh session baseline: undo can't reach across videos, and the image
			// overlay window defaults to this video's full length instead of a stale 8s.
			editHistory.clear();
			logoState.updateProperty('endTime', vidDuration);
			const videoAssetId = mediaBinStore.addAsset({
				type: 'video',
				name: 'Main Video',
				sessionId: null,
				previewUrl: videoUrl,
				duration: vidDuration
			});
			mainVideoAssetId = videoAssetId;
			// Capture reads this to map timeline time → main-video source time
			(window as any).__threeJsMainVideoAssetId = videoAssetId;
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
			map: compositeTexture ?? videoTexture,
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

	// ── COMPOSITE FRAME ──────────────────────────────────────────────

	// Draws a video or image element letterboxed (contain-fit) into a canvas slot.
	function drawContain(src: HTMLVideoElement | HTMLImageElement, x: number, y: number, w: number, h: number) {
		const iw = (src instanceof HTMLVideoElement ? src.videoWidth : src.naturalWidth) || 1;
		const ih = (src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight) || 1;
		const scale = Math.min(w / iw, h / ih);
		const sw = iw * scale;
		const sh = ih * scale;
		compositeCtx!.drawImage(src, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
	}

	interface CompositeLayer {
		el: HTMLVideoElement | HTMLImageElement;
		clip: TimelineClip;
	}

	// Timeline moment of the frame being composited — set by updateCompositeFrame,
	// read by the layer draw functions to evaluate each clip's transition window.
	let compositeNow = 0;

	// Throttle for the layer-drop warning — once a second, not once a frame
	let lastDropLogMs = 0;

	// Reused offscreen canvas for the pixelize transition (downsample → upscale)
	let pixelizeCanvas: HTMLCanvasElement | null = null;

	function drawPixelized(el: HTMLVideoElement | HTMLImageElement, strength: number, x: number, y: number, w: number, h: number) {
		const block = 1 + strength * 40; // block size in composite px
		const tw = Math.max(2, Math.round(w / block));
		const th = Math.max(2, Math.round(h / block));
		if (!pixelizeCanvas) pixelizeCanvas = document.createElement('canvas');
		pixelizeCanvas.width = tw; // resizing also clears
		pixelizeCanvas.height = th;
		const tctx = pixelizeCanvas.getContext('2d');
		if (!tctx) return;
		const iw = (el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth) || 1;
		const ih = (el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight) || 1;
		const s = Math.min(tw / iw, th / ih);
		tctx.drawImage(el, (tw - iw * s) / 2, (th - ih * s) / 2, iw * s, ih * s);
		compositeCtx!.imageSmoothingEnabled = false; // hard block edges
		compositeCtx!.drawImage(pixelizeCanvas, x, y, w, h);
		compositeCtx!.imageSmoothingEnabled = true;
	}

	// Transition-aware contain draw for video layers. Inside the clip body this is
	// a plain contain draw; inside the fadeIn/fadeOut window it applies the clip's
	// chosen transition (clip path / slide offset / filter / alpha) from
	// clipTransitions.ts. Baked into the export identically — capture drives the
	// same draw path.
	function drawLayer(layer: CompositeLayer | undefined | null, x: number, y: number, w: number, h: number) {
		if (!layer) return;
		const { p, type, phase } = clipTransitionState(layer.clip, compositeNow);
		if (p <= 0.001) return;
		if (p >= 0.999) {
			drawContain(layer.el, x, y, w, h);
			return;
		}
		const ctx = compositeCtx!;
		const fx = computeTransitionFX(type, p, phase, x, y, w, h);
		ctx.save();
		if (fx.clipPath) ctx.clip(fx.clipPath, fx.clipRule);
		if (fx.dx || fx.dy) {
			// Sliding content must not spill outside its slot
			const slot = new Path2D();
			slot.rect(x, y, w, h);
			ctx.clip(slot);
			ctx.translate(fx.dx, fx.dy);
		}
		if (fx.filter) ctx.filter = fx.filter;
		ctx.globalAlpha = fx.alpha;
		if (fx.pixelize > 0) drawPixelized(layer.el, fx.pixelize, x, y, w, h);
		else drawContain(layer.el, x, y, w, h);
		if (fx.overlay) {
			ctx.filter = 'none';
			ctx.globalAlpha = fx.overlay.alpha;
			ctx.fillStyle = fx.overlay.color;
			ctx.fillRect(x, y, w, h);
		}
		ctx.restore();
	}

	// Image clips draw as positioned overlays on top of the video layers, using the
	// clip's transform (center %, scale relative to contain-fit, rotation, opacity).
	// Default transform = full-frame contain. Transitions apply here too (pixelize
	// falls back to fade — the transformed draw can't route through the downsampler).
	function drawImageClip(layer: CompositeLayer) {
		const img = layer.el as HTMLImageElement;
		const t = { ...DEFAULT_CLIP_TRANSFORM, ...(layer.clip.transform ?? {}) };
		const { p, type, phase } = clipTransitionState(layer.clip, compositeNow);
		if (p <= 0.001) return;
		const w = compositeCanvas!.width;
		const h = compositeCanvas!.height;
		const fx = computeTransitionFX(type, p, phase, 0, 0, w, h);
		const opacity = Math.min(1, Math.max(0, t.opacity * fx.alpha));
		if (opacity <= 0.001) return;
		const iw = img.naturalWidth || 1;
		const ih = img.naturalHeight || 1;
		const fit = Math.min(w / iw, h / ih) * t.scale;
		const dw = iw * fit;
		const dh = ih * fit;
		const ctx = compositeCtx!;
		ctx.save();
		if (fx.clipPath) ctx.clip(fx.clipPath, fx.clipRule);
		if (fx.filter) ctx.filter = fx.filter;
		ctx.globalAlpha = opacity;
		ctx.translate((t.x / 100) * w + fx.dx, (t.y / 100) * h + fx.dy);
		if (t.rotation) ctx.rotate(t.rotation);
		ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
		ctx.restore();
	}

	function updateCompositeFrame() {
		if (!compositeCtx || !compositeCanvas || !videoElement) return;
		const w = compositeCanvas.width;
		const h = compositeCanvas.height;
		// OPAQUE black base — NOT clearRect. Canvas→WebGL texture upload
		// UN-premultiplies alpha (and the mesh material is opaque, so alpha is
		// ignored): any pixel left with alpha < 1 comes back at full RGB
		// brightness with quantization noise ("pixelation"), which silently
		// destroyed per-clip fades. Over an opaque base, globalAlpha blends in
		// RGB inside the canvas, final alpha stays 1, and fades/crossfades
		// survive the upload — in preview and export alike.
		compositeCtx.globalAlpha = 1;
		compositeCtx.fillStyle = '#000';
		compositeCtx.fillRect(0, 0, w, h);

		// Timeline moment currently shown — published by TimelineEditor's rAF loop.
		// Falls back to the main element's own time (identity mapping) if no editor.
		const now: number = (window as any).__timelineEditTime ?? videoElement.currentTime;
		compositeNow = now; // draw functions evaluate transition windows against this

		// Track order defines layer priority: the first video track fills the primary
		// slot, so promoting/demoting tracks reorders what supersedes what. Selection
		// is time-aware — only tracks with a clip covering this moment are drawn; a
		// paused element holds its last decoded frame and would otherwise paint over
		// lower layers anywhere on the timeline. Main video maps to videoElement,
		// every other track via secondaryVideoElements; main is skipped once ended.
		// Image clips are pulled out of the slot order and drawn as overlays on top,
		// so they can be positioned/scaled/faded like the logo overlay.
		const videoLayers: CompositeLayer[] = [];
		const imageLayers: CompositeLayer[] = [];
		for (const tr of $timelineStore.tracks) {
			if (tr.type !== 'video') continue;
			// End tolerance is tight (0.001) on purpose: a clip that just finished must
			// not paint its stale last frame over the next clip's opening frames. The
			// old ±0.05 end overlap + the ended-element skip caused a hard black cut
			// at the main video's natural end instead of the clip's fade-out tail.
			const clip = tr.clips.find((c) => now >= c.startTime - 0.05 && now < c.endTime + 0.001);
			if (!clip) continue;
			const el: HTMLVideoElement | HTMLImageElement | null | undefined =
				tr.assetId === mainVideoAssetId
					? videoElement
					: secondaryVideoElements.get(tr.assetId ?? '') ?? imageElements.get(tr.assetId ?? '');
			if (!el) continue;
			const layer: CompositeLayer = { el, clip };
			if (el instanceof HTMLVideoElement) {
				// A mid-seek element (readyState dips below 2 during every seek) still
				// draws its LAST DECODED frame — dropping it painted a black frame and
				// strobed playthrough every time the tick reseeked a secondary clip.
				// Only skip elements that aren't seeking and have nothing decoded.
				if (el.readyState < 2 && !el.seeking) {
					const nowMs = performance.now();
					if (nowMs - lastDropLogMs > 1000) {
						lastDropLogMs = nowMs;
						console.warn(`🫥 Video layer "${tr.name}" dropped from composite (readyState=${el.readyState}, not seeking) at t=${now.toFixed(2)}s`);
					}
					continue;
				}
				videoLayers.push(layer);
			} else {
				if (!el.complete || !el.naturalWidth) continue;
				imageLayers.push(layer);
			}
		}
		const primary = videoLayers[0] ?? null;
		const secondaries = videoLayers.slice(1);

		switch (compositeLayout) {
			case 'single':
				// All covering layers stacked bottom-up (track order = priority, first
				// track on top). One opaque layer = old behavior; when the top layer
				// fades, the layer beneath shows through — overlapping clips on two
				// tracks crossfade instead of dipping to black.
				for (let i = videoLayers.length - 1; i >= 0; i--) drawLayer(videoLayers[i], 0, 0, w, h);
				break;
			case 'split-h':
				drawLayer(primary, 0, 0, w / 2, h);
				drawLayer(secondaries[0], w / 2, 0, w / 2, h);
				break;
			case 'split-v':
				drawLayer(primary, 0, 0, w, h / 2);
				drawLayer(secondaries[0], 0, h / 2, w, h / 2);
				break;
			case 'pip-tr':
				drawLayer(primary, 0, 0, w, h);
				if (secondaries[0]) { const pw = Math.round(w * 0.3), ph = Math.round(h * 0.3); drawLayer(secondaries[0], w - pw - 16, 16, pw, ph); }
				break;
			case 'pip-bl':
				drawLayer(primary, 0, 0, w, h);
				if (secondaries[0]) { const pw = Math.round(w * 0.3), ph = Math.round(h * 0.3); drawLayer(secondaries[0], 16, h - ph - 16, pw, ph); }
				break;
			case 'grid':
				drawLayer(primary, 0, 0, w / 2, h / 2);
				drawLayer(secondaries[0], w / 2, 0, w / 2, h / 2);
				drawLayer(secondaries[1], 0, h / 2, w / 2, h / 2);
				drawLayer(secondaries[2], w / 2, h / 2, w / 2, h / 2);
				break;
		}

		// Image overlays — track order still decides stacking among images
		for (const layer of imageLayers) drawImageClip(layer);

		if (compositeTexture) compositeTexture.needsUpdate = true;
	}

	// ── SECONDARY VIDEO MANAGEMENT ────────────────────────────────────
	function makeVideoElement(url: string, muted = true): HTMLVideoElement {
		const el = document.createElement('video');
		el.crossOrigin = '';
		el.loop = false;
		el.muted = muted;
		// Detached elements with the default preload=metadata can park at
		// readyState 1 forever — the timeline tick then never starts them, which
		// shows as a secondary clip with picture (per-tick reseek) but no audio.
		el.preload = 'auto';
		el.setAttribute('playsinline', '');
		el.setAttribute('webkit-playsinline', '');
		el.src = url.startsWith('https://storage.googleapis.com')
			? `/api/proxyVideo?url=${encodeURIComponent(url)}`
			: url;
		return el;
	}

	function addSecondaryClip() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'video/*,image/*';
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const url = URL.createObjectURL(file);
			const name = file.name.replace(/\.[^.]+$/, '');

			if (file.type.startsWith('image/')) {
				// Static image clip — default 4s, drag/resize on the timeline like any clip
				const img = new Image();
				img.onload = () => {
					const duration = 4;
					editHistory.checkpoint();
					const assetId = mediaBinStore.addAsset({ type: 'image', name, sessionId: null, previewUrl: url, duration });
					imageElements.set(assetId, img);
					imageElements = new Map(imageElements);
					const trackId = timelineStore.addVideoTrack(assetId, name, duration, 0);
					// Focus the new image clip so the ControlsPanel's Selected Clip
					// section opens on it immediately — it's editable from the start.
					const track = $timelineStore.tracks.find((t) => t.id === trackId);
					if (track?.clips[0]) timelineStore.setActiveClip(trackId, track.clips[0].id);
				};
				img.src = url;
				return;
			}

			const probe = document.createElement('video');
			probe.src = url;
			probe.onloadedmetadata = () => {
				const duration = probe.duration;
				editHistory.checkpoint();
				const assetId = mediaBinStore.addAsset({ type: 'video', name, sessionId: null, previewUrl: url, duration });
				const el = makeVideoElement(url, true);
				secondaryVideoElements.set(assetId, el);
				secondaryVideoElements = new Map(secondaryVideoElements);
				// Place clip at t=0 to overlay with primary for compositing
				timelineStore.addVideoTrack(assetId, name, duration, 0);
				// Extract the clip's audio server-side so export can mux it — the
				// asset's sessionId carries the audio session (null = clip is silent).
				const fd = new FormData();
				fd.append('videoFile', file);
				fetch('/api/extractAudio', { method: 'POST', body: fd })
					.then((r) => (r.ok ? r.json() : null))
					.then((d) => {
						if (d?.audioSessionId) mediaBinStore.updateAsset(assetId, { sessionId: d.audioSessionId });
						else console.warn(`🔇 Audio extraction returned no session for "${name}" — this clip will EXPORT silent (preview audio unaffected)`);
					})
					.catch((e) => console.warn(`🔇 Audio extraction failed for "${name}" — this clip will EXPORT silent (preview audio unaffected):`, e));
			};
		};
		input.click();
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
		updateCompositeFrame();
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

	$: if (mesh && (compositeTexture ?? videoTexture) && selectedShape) createMesh(selectedShape);
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

	<!-- Gap overlay removed — the time-aware compositor decides what's visible;
	     a primary-track gap can still have secondary/image clips playing. -->

	{#if videoElement && !(window as any).__threeJsCapturing}
		<!-- Composite layout controls + add-clip button -->
		<div style="position:absolute;top:6px;right:6px;z-index:20;display:flex;align-items:center;gap:4px;background:rgba(0,0,0,0.65);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:4px 6px;">
			{#each [['single','⬛'],['split-h','⬜⬜'],['split-v','🔲'],['pip-tr','📺'],['pip-bl','🎬'],['grid','▦']] as [mode, icon]}
				<button
					on:click={() => { compositeLayout = mode; }}
					title={mode}
					style="width:26px;height:26px;border-radius:4px;border:1px solid {compositeLayout===mode?'rgba(99,102,241,1)':'rgba(255,255,255,0.15)'};background:{compositeLayout===mode?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.06)'};color:white;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;"
				>{icon}</button>
			{/each}
			<div style="width:1px;height:20px;background:rgba(255,255,255,0.15);margin:0 2px;"></div>
			<button
				on:click={addSecondaryClip}
				title="Add video or image clip from file"
				style="height:26px;padding:0 8px;border-radius:4px;border:1px solid rgba(99,102,241,0.6);background:rgba(99,102,241,0.25);color:white;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;"
			>+ Clip</button>
		</div>

		<div class="absolute bottom-0 left-0 right-0 flex flex-col gap-1 bg-black/90 backdrop-blur-sm p-1">
			<MediaBin />
			<TimelineEditor {videoElement} {secondaryVideoElements} {mainVideoAssetId} />
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