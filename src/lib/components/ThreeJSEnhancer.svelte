<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
	import { FontLoader } from 'three/addons/loaders/FontLoader.js';

	export let imageUrl: string = '';
	export let onClose: () => void;

	let canvas: HTMLCanvasElement;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let renderer: THREE.WebGLRenderer;
	let mesh: THREE.Mesh;
	let textMesh: THREE.Mesh | null = null;
	let animationId: number;
	let texture: THREE.Texture;
	let particleSystem: THREE.Points | null = null;

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
	let selected3DFont = 'helvetiker';
	let textExtrusionDepth = 0.5;
	let bevelEnabled = true;
	let bevelThickness = 0.05;
	let bevelSize = 0.02;
	let loadedFont: any = null;

	// ===== PARTICLES =====
	let particlesEnabled = false;
	let particleCount = 5000;
	let particleSize = 0.05;
	let particleSpeed = 0.5;
	let particleColor = '#ffffff';
	let particleOpacity = 0.6;
	let particleAnimation = 'none';
	let particleAnimationSpeed = 1;

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
		{ name: 'Helvetiker', value: 'helvetiker' },
		{ name: 'Optimer', value: 'optimer' },
		{ name: 'Gentilis', value: 'gentilis' },
		{ name: 'Droid Sans', value: 'droid_sans' }
	];

	let ambientLight: THREE.AmbientLight;
	let directionalLight: THREE.DirectionalLight;
	let fillLight: THREE.DirectionalLight;

	onMount(() => {
		if (!imageUrl) return;
		loadGoogleFonts();
		initThreeJS();
		return () => {
			if (animationId) cancelAnimationFrame(animationId);
			if (renderer) renderer.dispose();
			if (texture) texture.dispose();
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
		const fontPath = `https://threejs.org/examples/fonts/${fontName}_regular.typeface.json`;
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
			createMesh(selectedShape);
			animate();
		});

		window.addEventListener('resize', handleResize);
	}

	function createMesh(shape: string) {
		if (mesh) {
			scene.remove(mesh);
			mesh.geometry.dispose();
			if (Array.isArray(mesh.material)) {
				mesh.material.forEach((mat) => mat.dispose());
			} else {
				mesh.material.dispose();
			}
		}

		let geometry: THREE.BufferGeometry;

		switch (shape) {
			case 'sphere':
				geometry = new THREE.SphereGeometry(2, 64, 64);
				break;
			case 'cube':
				geometry = new THREE.BoxGeometry(3, 3, 3);
				break;
			case 'cylinder':
				geometry = new THREE.CylinderGeometry(2, 2, 3, 64);
				break;
			case 'pyramid':
				geometry = new THREE.ConeGeometry(2, 3, 4);
				break;
			case 'torus':
				geometry = new THREE.TorusGeometry(2, 0.8, 32, 100);
				break;
			case 'plane':
			default:
				const image = texture.image as HTMLImageElement;
				const aspectRatio = image.width / image.height;
				const planeWidth = 6;
				const planeHeight = planeWidth / aspectRatio;
				geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
				break;
		}

		const material =
			shape === 'plane'
				? new THREE.MeshBasicMaterial({
						map: texture,
						side: THREE.DoubleSide,
						transparent: true,
						alphaTest: 0.01
					})
				: new THREE.MeshStandardMaterial({
						map: texture,
						side: THREE.DoubleSide,
						transparent: true,
						alphaTest: 0.01,
						metalness: 0.1,
						roughness: 0.7,
						emissive: new THREE.Color(0x000000),
						emissiveIntensity: 0
					});

		mesh = new THREE.Mesh(geometry, material);
		mesh.scale.set(scale, scale, scale);
		scene.add(mesh);
	}

	function createParticleSystem() {
		if (particleSystem) {
			scene.remove(particleSystem);
			particleSystem.geometry.dispose();
			(particleSystem.material as THREE.Material).dispose();
			particleSystem = null;
		}

		if (!particlesEnabled) return;

		const positions = new Float32Array(particleCount * 3);
		for (let i = 0; i < particleCount * 3; i += 3) {
			positions[i] = (Math.random() - 0.5) * 20;
			positions[i + 1] = (Math.random() - 0.5) * 20;
			positions[i + 2] = (Math.random() - 0.5) * 20;
		}

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const color = new THREE.Color(particleColor);
		const material = new THREE.PointsMaterial({
			color: color,
			size: particleSize,
			opacity: particleOpacity,
			transparent: true,
			sizeAttenuation: true
		});

		particleSystem = new THREE.Points(geometry, material);
		scene.add(particleSystem);
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

			if (mesh.material instanceof THREE.MeshStandardMaterial) {
				const glowValue = Math.max(imageGlow, shapeGlow) * 0.5;
				if (glowValue > 0) {
					mesh.material.emissive.set(0xffffff);
					mesh.material.emissiveIntensity = glowValue;
				} else {
					mesh.material.emissive.set(0x000000);
					mesh.material.emissiveIntensity = 0;
				}
			} else if (mesh.material instanceof THREE.MeshBasicMaterial) {
				const glowValue = Math.max(imageGlow, shapeGlow);
				if (glowValue > 0) {
					const tint = Math.min(1.0 + glowValue * 0.3, 1.6);
					mesh.material.color.setRGB(tint, tint, tint);
				} else {
					mesh.material.color.setRGB(1, 1, 1);
				}
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

		if (particleSystem) {
			const positions = particleSystem.geometry.attributes.position.array as Float32Array;

			for (let i = 0; i < positions.length; i += 3) {
				if (particleAnimation === 'spiral') {
					positions[i] +=
						Math.cos(Date.now() * 0.001 * particleAnimationSpeed) * particleSpeed * 0.01;
					positions[i + 1] +=
						Math.sin(Date.now() * 0.001 * particleAnimationSpeed) * particleSpeed * 0.01;
				} else if (particleAnimation === 'wave') {
					positions[i + 1] +=
						Math.sin(i * 0.01 + Date.now() * 0.001 * particleAnimationSpeed) * particleSpeed * 0.01;
				} else if (particleAnimation === 'explosion') {
					const dist = Math.sqrt(Math.random()) * particleSpeed * 0.05;
					positions[i] += Math.random() * dist;
					positions[i + 1] += Math.random() * dist;
					positions[i + 2] += Math.random() * dist;
				}
			}

			particleSystem.geometry.attributes.position.needsUpdate = true;
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
		particlesEnabled = false;
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
		createMesh(selectedShape);
		createParticleSystem();
		createLogoMesh(logoUrl);
		create3DText();
	}

	function exportImage() {
		if (!renderer || !scene || !camera) return;

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				try {
					const canvas = renderer.domElement;
					canvas.toBlob(
						(blob) => {
							if (!blob) {
								alert('Export failed');
								return;
							}

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
				} catch (error) {
					console.error('Export error:', error);
					alert('Export failed');
				}
			});
		});
	}

	// FIX 1: Added selectedFont and textColor to reactive block so font changes trigger re-render
	$: if (mesh && selectedShape) createMesh(selectedShape);
	$: if (mesh) mesh.scale.set(scale, scale, scale);
	$: if (textContent !== undefined || textSize || textColor || selectedFont) create3DText();
	$: if (particlesEnabled) createParticleSystem();
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
									class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
								>
									{#each shapes as shape}
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
									{#each Object.keys(filterPresets) as preset}
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

				<!-- PARTICLES -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>✨ Particle System</span>
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
									<span class="text-sm font-semibold text-white">Enable Particles</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" bind:checked={particlesEnabled} class="peer sr-only" />
										<div
											class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>
							</div>

							{#if particlesEnabled}
								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Particle Count</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="1000"
											max="20000"
											step="1000"
											bind:value={particleCount}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={particleCount}
											min="1000"
											max="20000"
											step="1000"
											class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Particle Size</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0.01"
											max="0.5"
											step="0.01"
											bind:value={particleSize}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={particleSize}
											min="0.01"
											max="0.5"
											step="0.01"
											class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Particle Speed</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0.1"
											max="2"
											step="0.1"
											bind:value={particleSpeed}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={particleSpeed}
											min="0.1"
											max="2"
											step="0.1"
											class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Particle Color</label>
									<input
										type="color"
										bind:value={particleColor}
										class="mt-1 h-8 w-full cursor-pointer rounded border border-white/10"
									/>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Opacity</label>
									<div class="mt-1 flex gap-2">
										<input
											type="range"
											min="0"
											max="1"
											step="0.1"
											bind:value={particleOpacity}
											class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
										/>
										<input
											type="number"
											bind:value={particleOpacity}
											min="0"
											max="1"
											step="0.1"
											class="w-16 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
										/>
									</div>
								</div>

								<div class="rounded-lg p-3 hover:bg-white/5">
									<label class="text-sm font-semibold text-white">Animation</label>
									<select
										bind:value={particleAnimation}
										class="mt-1 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
									>
										<option value="none">None</option>
										<option value="spiral">🌀 Spiral</option>
										<option value="wave">🌊 Wave</option>
										<option value="explosion">💥 Explosion</option>
									</select>
								</div>

								{#if particleAnimation !== 'none'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<label class="text-sm font-semibold text-white">Animation Speed</label>
										<div class="mt-1 flex gap-2">
											<input
												type="range"
												min="0.1"
												max="5"
												step="0.1"
												bind:value={particleAnimationSpeed}
												class="h-2 flex-1 rounded-lg bg-gray-700 accent-blue-500"
											/>
											<input
												type="number"
												bind:value={particleAnimationSpeed}
												min="0.1"
												max="5"
												step="0.1"
												class="w-20 rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white"
											/>
										</div>
									</div>
								{/if}
							{/if}
						</div>
					</details>
				</div>

				<!-- LOGO OVERLAY -->
				<div class="rounded-lg border border-white/10 bg-gray-800/50">
					<details class="group">
						<summary
							class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5"
						>
							<span>🎨 Logo Overlay</span>
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
									<span class="text-sm font-semibold text-white">Enable Logo</span>
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
									<label class="block text-sm font-semibold text-white">Upload Logo</label>
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
										{#each googleFonts as font}
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
										{#each threejsFonts as font}
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