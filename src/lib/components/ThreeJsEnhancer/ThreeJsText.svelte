<!-- src/lib/components/ThreeJsEnhancer/ThreeJsText.svelte -->
<!-- 3D TEXT RENDERER - DUAL MODE: Troika (Google Fonts 2.5-D) + Three.js TextGeometry (True 3D) -->

<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { Text } from 'troika-three-text';
	import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
	import { FontLoader } from 'three/addons/loaders/FontLoader.js';
	import { text3DState } from '$lib/stores/text3d.store';

	export let scene: THREE.Scene | undefined;
	let colorCycleFrame: number;
	let textMesh: any = null;         // Troika Text mesh
	let trueTextMesh: THREE.Mesh | null = null; // True 3D TextGeometry mesh
	let isInitialized = false;
	let loadedFontFile = '';
	let loadedText = '';
	let loadedFontSize = 0;
	let loadedExtrudeDepth = -1;
	let loadedBevelEnabled = false;
	let loadedBevelThickness = -1;
	let loadedBevelSize = -1;
	let fontLoader = new FontLoader();
	let fontLoadToken = 0; // incremented each rebuild; stale callbacks check against this

	$: textState = $text3DState;

	// React to scene becoming available
	$: if (scene && !isInitialized) {
		createTextMesh();
		isInitialized = true;
	}

	// React to all text state changes — routes to the active renderer
	$: if (isInitialized && textState) {
		if (textState.textMode === 'troika') {
			// Ensure True 3D mesh is gone
			if (trueTextMesh) disposeTrueTextMesh();
			// Ensure Troika mesh exists
			if (!textMesh) createTextMesh();
			else if (textState.enabled) updateTextProperties();
			else hideText();
		} else {
			// Ensure Troika mesh is gone
			if (textMesh) disposeTroikaMesh();
			// Build or update True 3D mesh
			if (textState.enabled) createOrUpdateTrueTextMesh();
			else hideTrueText();
		}
	}
	onMount(() => {
		function animateColor() {
			if (textState.colorCycling && textMesh && !textState.useVideoTexture) {
				const time = Date.now() * 0.001 * textState.colorCycleSpeed;
				const r = Math.sin(time) * 0.5 + 0.5;
				const g = Math.sin(time + 2) * 0.5 + 0.5;
				const b = Math.sin(time + 4) * 0.5 + 0.5;
				textMesh.color = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
				textMesh.sync();
			}
			colorCycleFrame = requestAnimationFrame(animateColor);
		}
		animateColor();
		return () => {
			cancelAnimationFrame(colorCycleFrame);
			disposeTroikaMesh();
			disposeTrueTextMesh();
			isInitialized = false;
		};
	});

	function disposeTroikaMesh() {
		if (textMesh && scene) {
			scene.remove(textMesh);
			textMesh.dispose();
			textMesh = null;
		}
	}

	function disposeTrueTextMesh() {
		if (trueTextMesh && scene) {
			scene.remove(trueTextMesh);
			if (trueTextMesh.geometry) trueTextMesh.geometry.dispose();
			if ((trueTextMesh as any)._videoTexture) {
				(trueTextMesh as any)._videoTexture.dispose();
				(trueTextMesh as any)._videoTexture = null;
			}
			trueTextMesh = null;
			loadedFontFile = '';
			loadedText = '';
			loadedFontSize = 0;
			loadedExtrudeDepth = -1;
			loadedBevelEnabled = false;
			loadedBevelThickness = -1;
			loadedBevelSize = -1;
		}
	}

	function applyVideoTextureToMesh(mesh: THREE.Mesh) {
		const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;
		if (!videoElement) return;
		const { x, y } = textState.videoTextureOffset;
		const scale = textState.videoTextureScale;
		if (!(mesh as any)._videoTexture) {
			(mesh as any)._videoTexture = new THREE.VideoTexture(videoElement);
			(mesh as any)._videoTexture.colorSpace = THREE.SRGBColorSpace;
		}
		const vt = (mesh as any)._videoTexture;
		vt.repeat.set(scale, scale);
		vt.offset.set(x, y);
		vt.needsUpdate = true;
		mesh.material = new THREE.MeshStandardMaterial({
			map: vt,
			side: THREE.DoubleSide,
			metalness: textState.metalness,
			roughness: textState.roughness
		});
	}

	function applyStandardMaterialToMesh(mesh: THREE.Mesh) {
		if ((mesh as any)._videoTexture) {
			(mesh as any)._videoTexture.dispose();
			(mesh as any)._videoTexture = null;
		}
		mesh.material = new THREE.MeshStandardMaterial({
			color: new THREE.Color(textState.materialColor),
			metalness: textState.metalness,
			roughness: textState.roughness,
			emissive: new THREE.Color(textState.emissive),
			emissiveIntensity: textState.emissiveIntensity,
			side: THREE.DoubleSide
		});
	}

	function createOrUpdateTrueTextMesh() {
		if (!scene) return;
		const fontFile = textState.true3dFontFile;
		const currentText = textState.text || 'Sample Text';
		const fontUrl = `/fonts/${fontFile}`;
		const needsRebuild =
			!trueTextMesh ||
			fontFile !== loadedFontFile ||
			currentText !== loadedText ||
			textState.fontSize !== loadedFontSize ||
			textState.extrudeDepth !== loadedExtrudeDepth ||
			textState.bevelEnabled !== loadedBevelEnabled ||
			textState.bevelThickness !== loadedBevelThickness ||
			textState.bevelSize !== loadedBevelSize;

		if (needsRebuild) {
			disposeTrueTextMesh();
			loadedFontFile = fontFile;
			loadedText = currentText;
			loadedFontSize = textState.fontSize;
			loadedExtrudeDepth = textState.extrudeDepth;
			loadedBevelEnabled = textState.bevelEnabled;
			loadedBevelThickness = textState.bevelThickness;
			loadedBevelSize = textState.bevelSize;

			const token = ++fontLoadToken;
		fontLoader.load(fontUrl, (font) => {
				// Abort if a newer rebuild started while this was loading
				if (token !== fontLoadToken || !scene) return;

				// Remove any orphaned mesh from a previous in-flight load
				if (trueTextMesh) {
					scene.remove(trueTextMesh);
					if (trueTextMesh.geometry) trueTextMesh.geometry.dispose();
					trueTextMesh = null;
				}

				const geo = new TextGeometry(currentText, {
					font,
					size: textState.fontSize / 50,
					depth: textState.extrudeDepth,
					curveSegments: 6,
					bevelEnabled: textState.bevelEnabled,
					bevelThickness: textState.bevelThickness,
					bevelSize: textState.bevelSize * 0.5,
					bevelSegments: 3
				});
				geo.computeBoundingBox();
				geo.center();

				trueTextMesh = new THREE.Mesh(geo);
				if (textState.useVideoTexture) {
					applyVideoTextureToMesh(trueTextMesh);
				} else {
					applyStandardMaterialToMesh(trueTextMesh);
				}
				trueTextMesh.scale.setScalar(textState.scale3D);
				trueTextMesh.position.set(
					textState.position3D.x,
					textState.position3D.y,
					textState.position3D.z
				);
				trueTextMesh.rotation.set(
					textState.rotation3D.x,
					textState.rotation3D.y,
					textState.rotation3D.z
				);
				trueTextMesh.visible = textState.enabled;
				scene.add(trueTextMesh);
				(window as any).__textMesh = trueTextMesh;
			});
		} else if (trueTextMesh) {
			updateTrueTextProperties();
		}
	}

	function updateTrueTextProperties() {
		if (!trueTextMesh || !scene) return;
		if (textState.useVideoTexture) {
			applyVideoTextureToMesh(trueTextMesh);
		} else {
			applyStandardMaterialToMesh(trueTextMesh);
		}
		trueTextMesh.scale.setScalar(textState.scale3D);
		trueTextMesh.position.set(
			textState.position3D.x,
			textState.position3D.y,
			textState.position3D.z
		);
		trueTextMesh.rotation.set(
			textState.rotation3D.x,
			textState.rotation3D.y,
			textState.rotation3D.z
		);
		trueTextMesh.visible = textState.enabled;
	}

	function hideTrueText() {
		if (trueTextMesh) trueTextMesh.visible = false;
	}

	function createTextMesh() {
		if (!scene) {
			return;
		}
		textMesh = new Text();
		textMesh.text = textState.text || 'Sample Text';
		textMesh.fontSize = textState.fontSize / 50;
		textMesh.color = textState.materialColor;
		textMesh.anchorX = 'center';
		textMesh.anchorY = 'middle';
		textMesh.letterSpacing = textState.letterSpacing;
		textMesh.curveRadius = textState.curveRadius;
		// Use font URL with default Roboto .ttf fallback (Troika needs TTF, not WOFF2!)
		const defaultRobotoUrl =
			'https://fonts.gstatic.com/s/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTggvWl0Qn.ttf';
		textMesh.font = textState.fontUrl || defaultRobotoUrl;

		scene.add(textMesh);
		(window as any).__textMesh = textMesh;
		textMesh.sync();
	}
	function updateTextProperties() {
		if (!textMesh) return;
		// Text content
		const newText = textState.text || 'Sample Text';
		// Use font URL if available, otherwise use a default Roboto .ttf URL
		// CRITICAL: Troika needs TTF files, NOT woff2!
		const defaultRobotoUrl =
			'https://fonts.gstatic.com/s/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTggvWl0Qn.ttf';
		const newFont = textState.fontUrl || defaultRobotoUrl;
		// Check if font changed - if so, force full recreation
		const fontChanged = textMesh.font !== newFont;
		if (fontChanged) {
			// Dispose old text mesh
			if (scene) {
				scene.remove(textMesh);
			}
			textMesh.dispose();
			// Create new text mesh with new font
			textMesh = new Text();
			textMesh.font = newFont; // This is now a URL!
			textMesh.text = newText;
			textMesh.fontSize = textState.fontSize / 50;
			textMesh.anchorX = 'center';
			textMesh.anchorY = 'middle';
			if (scene) {
				scene.add(textMesh);
			}
		} else {
			// Font didn't change, just update text
			textMesh.text = newText;
		}
		// Set font URL
		textMesh.font = newFont;
		// Size and scale
		textMesh.fontSize = textState.fontSize / 50;
		textMesh.scale.setScalar(textState.scale3D);
		// VIDEO TEXTURE ON TEXT (INSANE FEATURE!)
		if (textState.useVideoTexture && (window as any).__threeJsVideo) {
			const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;
			const { x, y } = textState.videoTextureOffset;
			const scale = textState.videoTextureScale;

			// Create video texture if not exists
			if (!textMesh._videoTexture) {
				textMesh._videoTexture = new THREE.VideoTexture(videoElement);
				textMesh._videoTexture.colorSpace = THREE.SRGBColorSpace;
				textMesh._videoTexture.needsUpdate = true;
			}

			// Apply custom material with video texture
			textMesh.material = new THREE.MeshBasicMaterial({
				map: textMesh._videoTexture,
				side: THREE.DoubleSide,
				transparent: true
			});

			// Scale/offset video on letters
			textMesh._videoTexture.repeat.set(scale, scale);
			textMesh._videoTexture.offset.set(x, y);
			textMesh._videoTexture.needsUpdate = true; // ✅ HERE!
		} else {
			// ✅ ELSE block - when video texture is disabled
			textMesh.color = new THREE.Color(textState.materialColor);

			// Clean up video texture if it exists
			if (textMesh._videoTexture) {
				textMesh._videoTexture.dispose();
				textMesh._videoTexture = null;
			}
		}
		// Color
		textMesh.color = new THREE.Color(textState.materialColor);
		// Position
		textMesh.position.set(textState.position3D.x, textState.position3D.y, textState.position3D.z);
		// Rotation
		textMesh.rotation.set(textState.rotation3D.x, textState.rotation3D.y, textState.rotation3D.z);
		// Opacity
		textMesh.fillOpacity = 1.0;
		// Outline (bevel effect)
		if (textState.bevelEnabled) {
			textMesh.outlineWidth = textState.bevelThickness * 0.5;
			textMesh.outlineColor = new THREE.Color(textState.materialColor).multiplyScalar(0.5);
			textMesh.outlineOpacity = 1.0;
		} else {
			textMesh.outlineWidth = 0;
		}
		// Emissive glow
		if (textState.emissiveIntensity > 0) {
			textMesh.outlineWidth = 0.1;
			textMesh.outlineColor = new THREE.Color(textState.emissive);
			textMesh.outlineOpacity = textState.emissiveIntensity;
			textMesh.outlineBlur = 0.3;
		}
		// Stroke (depth effect)
		if (textState.extrudeDepth > 0) {
			textMesh.strokeWidth = textState.extrudeDepth * 0.15;
			textMesh.strokeColor = new THREE.Color(textState.materialColor).multiplyScalar(0.3);
			textMesh.strokeOpacity = 0.9;
		} else {
			textMesh.strokeWidth = 0;
		}
		// Metalness effect
		if (textState.metalness > 0.5) {
			textMesh.color = new THREE.Color(textState.materialColor).multiplyScalar(
				1 - textState.metalness * 0.3
			);
		}
		// Alignment
		textMesh.anchorX = 'center';
		textMesh.anchorY = 'middle';
		textMesh.textAlign = 'center';
		textMesh.maxWidth = 20;
		textMesh.whiteSpace = 'normal';
		textMesh.visible = true;
		// Sync to apply all changes
		textMesh.sync();
	}
	function hideText() {
		if (textMesh) {
			textMesh.visible = false;
			textMesh.sync();
		}
	}
	export function updateAnimation(animationTime: number, videoTime?: number) {
		const vt = videoTime ?? animationTime;
		const opacity = computeTextOpacity(vt);

		if (textState.textMode === 'true3d') {
			if (!trueTextMesh || !textState.enabled || !trueTextMesh.visible) return;
			applyTrueTextOpacity(trueTextMesh, opacity);
			if (opacity > 0) animateMesh(trueTextMesh, animationTime, false);
			return;
		}
		if (!textMesh || !textState.enabled || !textMesh.visible) return;
		textMesh.fillOpacity = opacity;
		if (textMesh.outlineOpacity !== undefined) textMesh.outlineOpacity = opacity;
		textMesh.sync?.();
		if (opacity > 0) animateMesh(textMesh, animationTime, true);
	}

	function computeTextOpacity(videoTime: number): number {
		const { textStartTime, textEndTime, textFadeIn, textFadeOut } = textState;
		if (videoTime < textStartTime || videoTime >= textEndTime) return 0;
		let opacity = 1;
		const sinceStart = videoTime - textStartTime;
		if (textFadeIn > 0 && sinceStart < textFadeIn) opacity = Math.min(opacity, sinceStart / textFadeIn);
		const untilEnd = textEndTime - videoTime;
		if (textFadeOut > 0 && untilEnd < textFadeOut) opacity = Math.min(opacity, untilEnd / textFadeOut);
		return Math.max(0, Math.min(1, opacity));
	}

	function applyTrueTextOpacity(mesh: THREE.Mesh, opacity: number) {
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			(mat as THREE.MeshStandardMaterial).transparent = true;
			(mat as THREE.MeshStandardMaterial).opacity = opacity;
		}
	}

	function animateMesh(mesh: any, animationTime: number, isTroika: boolean) {

		// Calculate base rotation (includes autoRotate)
		let rotX = textState.rotation3D.x;
		let rotY = textState.rotation3D.y;
		let rotZ = textState.rotation3D.z;

		if (textState.autoRotate) {
			rotY += animationTime * textState.autoRotateSpeed;
		}

		const sync = () => { if (isTroika && mesh.sync) mesh.sync(); };

		switch (textState.animationType) {
			case 'spin':
				rotY += animationTime * 0.02;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'wave':
				mesh.position.y = textState.position3D.y + Math.sin(animationTime) * 0.5;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'float':
				mesh.position.y = textState.position3D.y + Math.sin(animationTime * 2) * 0.3;
				rotY += animationTime * 0.005;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'bounce': {
				const bounceHeight = Math.abs(Math.sin(animationTime * 3)) * 0.8;
				mesh.position.y = textState.position3D.y + bounceHeight;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'pulse': {
				const pulseScale = 1 + Math.sin(animationTime * 2) * 0.15;
				mesh.scale.setScalar(textState.scale3D * pulseScale);
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'swing':
				mesh.rotation.x = rotX;
				mesh.rotation.y = rotY;
				mesh.rotation.z = Math.sin(animationTime * 1.5) * 0.3;
				sync();
				break;
			case 'jitter': {
				const jitterX = (Math.random() - 0.5) * 0.05;
				const jitterY = (Math.random() - 0.5) * 0.05;
				mesh.position.x = textState.position3D.x + jitterX;
				mesh.position.y = textState.position3D.y + jitterY;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'spiral':
				rotY += animationTime * 0.03;
				mesh.position.y = textState.position3D.y + Math.sin(animationTime * 2) * 0.6;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'elastic': {
				const elasticScale =
					1 + Math.sin(animationTime * 4) * Math.exp(-animationTime * 0.001) * 0.3;
				mesh.scale.setScalar(textState.scale3D * elasticScale);
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'glitch':
				if (Math.random() > 0.95) {
					mesh.position.x = textState.position3D.x + (Math.random() - 0.5) * 0.2;
					mesh.position.y = textState.position3D.y + (Math.random() - 0.5) * 0.2;
				} else {
					mesh.position.x = textState.position3D.x;
					mesh.position.y = textState.position3D.y;
				}
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'orbit': {
				const orbitRadius = 0.5;
				mesh.position.x = textState.position3D.x + Math.cos(animationTime) * orbitRadius;
				mesh.position.z = textState.position3D.z + Math.sin(animationTime) * orbitRadius;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'wobble':
				mesh.rotation.x = Math.sin(animationTime * 3) * 0.1;
				mesh.rotation.y = rotY;
				mesh.rotation.z = Math.cos(animationTime * 3 * 1.3) * 0.1;
				sync();
				break;
			case 'none':
			default:
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
		}
	}
</script>
