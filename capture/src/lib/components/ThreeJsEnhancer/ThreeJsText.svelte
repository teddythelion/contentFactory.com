<!-- src/lib/components/ThreeJsEnhancer/ThreeJsText.svelte -->
<!-- 3D TEXT RENDERER - TROIKA VERSION - VIDEO TIME SYNCED -->

<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { Text } from 'troika-three-text';
	import { text3DState } from '$lib/stores/text3d.store';

	export let scene: THREE.Scene | undefined;
	let colorCycleFrame: number;
	let textMesh: any = null;
	let isInitialized = false;

	$: textState = $text3DState;

	// React to scene becoming available
	$: if (scene && !isInitialized) {
		createTextMesh();
		isInitialized = true;
	}

	// Watch specific properties that should trigger updates
	// This prevents infinite loops by not watching the entire state object
	$: if (isInitialized && textMesh) {
		// Only update when text is enabled
		if (textState.enabled) {
			updateTextProperties();
		} else {
			hideText();
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
			if (textMesh && scene) {
				scene.remove(textMesh);
				textMesh.dispose();
				textMesh = null;
			}
			isInitialized = false;
		};
	});

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
		// DEBUG: Expose for testing
		(window as any).__textMesh = textMesh;
		// Initial sync
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
	// ✅ FIXED: Export animation function that accepts animationTime parameter
	export function updateAnimation(animationTime: number) {
		if (!textMesh || !textState.enabled || !textMesh.visible) return;

		// Calculate base rotation (includes autoRotate)
		let rotX = textState.rotation3D.x;
		let rotY = textState.rotation3D.y;
		let rotZ = textState.rotation3D.z;

		if (textState.autoRotate) {
			rotY += animationTime * textState.autoRotateSpeed;
		}

		switch (textState.animationType) {
			case 'spin':
				rotY += animationTime * 0.02;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'wave':
				textMesh.position.y = textState.position3D.y + Math.sin(animationTime) * 0.5;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'float':
				textMesh.position.y = textState.position3D.y + Math.sin(animationTime * 2) * 0.3;
				rotY += animationTime * 0.005;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'bounce':
				const bounceHeight = Math.abs(Math.sin(animationTime * 3)) * 0.8;
				textMesh.position.y = textState.position3D.y + bounceHeight;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'pulse':
				const pulseScale = 1 + Math.sin(animationTime * 2) * 0.15;
				textMesh.scale.setScalar(textState.scale3D * pulseScale);
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'swing':
				textMesh.rotation.x = rotX;
				textMesh.rotation.y = rotY;
				textMesh.rotation.z = Math.sin(animationTime * 1.5) * 0.3;
				textMesh.sync();
				break;
			case 'jitter':
				const jitterX = (Math.random() - 0.5) * 0.05;
				const jitterY = (Math.random() - 0.5) * 0.05;
				textMesh.position.x = textState.position3D.x + jitterX;
				textMesh.position.y = textState.position3D.y + jitterY;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'spiral':
				rotY += animationTime * 0.03;
				textMesh.position.y = textState.position3D.y + Math.sin(animationTime * 2) * 0.6;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'elastic':
				const elasticScale =
					1 + Math.sin(animationTime * 4) * Math.exp(-animationTime * 0.001) * 0.3;
				textMesh.scale.setScalar(textState.scale3D * elasticScale);
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'glitch':
				if (Math.random() > 0.95) {
					const glitchX = (Math.random() - 0.5) * 0.2;
					const glitchY = (Math.random() - 0.5) * 0.2;
					textMesh.position.x = textState.position3D.x + glitchX;
					textMesh.position.y = textState.position3D.y + glitchY;
				} else {
					textMesh.position.x = textState.position3D.x;
					textMesh.position.y = textState.position3D.y;
				}
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'orbit':
				const orbitRadius = 0.5;
				textMesh.position.x = textState.position3D.x + Math.cos(animationTime) * orbitRadius;
				textMesh.position.z = textState.position3D.z + Math.sin(animationTime) * orbitRadius;
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
			case 'wobble':
				textMesh.rotation.x = Math.sin(animationTime * 3) * 0.1;
				textMesh.rotation.y = rotY;
				textMesh.rotation.z = Math.cos(animationTime * 3 * 1.3) * 0.1;
				textMesh.sync();
				break;
			case 'none':
			default:
				textMesh.rotation.set(rotX, rotY, rotZ);
				textMesh.sync();
				break;
		}
	}
</script>
