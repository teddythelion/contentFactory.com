<!-- src/lib/components/ThreeJsEnhancer/ThreeJsText.svelte -->
<!-- 3D TEXT RENDERER - DUAL MODE: Troika (Google Fonts 2.5-D) + Three.js TextGeometry (True 3D) -->
<!-- MULTI-INSTANCE (7-14-2026): renders one mesh per text3DState.entries entry. -->
<!-- Each instance's visibility window + fade comes from ITS TIMELINE BAR (the -->
<!-- media-bin 'text3d' asset carrying the entry id) — not from store timing. -->

<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { get } from 'svelte/store';
	import { Text } from 'troika-three-text';
	import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
	import { FontLoader } from 'three/addons/loaders/FontLoader.js';
	import { text3DState, type Text3DParams } from '$lib/stores/text3d.store';
	import { timelineStore } from '$lib/stores/timeline.store';
	import { mediaBinStore } from '$lib/stores/mediaBin.store';
	import { clipTransitionState } from '$lib/utils/clipTransitions';

	export let scene: THREE.Scene | undefined;

	interface TextInstance {
		params: Text3DParams;
		lastSpec: string; // JSON of params — skip untouched instances on store churn
		troika: any | null;
		true3d: THREE.Mesh | null;
		fontLoadToken: number;
		// true3d rebuild cache
		loadedFontFile: string;
		loadedText: string;
		loadedFontSize: number;
		loadedExtrudeDepth: number;
		loadedBevelEnabled: boolean;
		loadedBevelThickness: number;
		loadedBevelSize: number;
	}

	const instances = new Map<string, TextInstance>();
	let colorCycleFrame: number;
	let isInitialized = false;
	const fontLoader = new FontLoader();

	const defaultRobotoUrl =
		'https://fonts.gstatic.com/s/roboto/v50/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMQXC89YmC2DPNWubEbWmTggvWl0Qn.ttf';

	$: textState = $text3DState;

	// React to scene becoming available
	$: if (scene && !isInitialized) {
		isInitialized = true;
	}

	// Rebuild/update meshes whenever entries change (only touched instances re-sync)
	$: if (isInitialized && textState) {
		syncInstances(textState.entries);
	}

	onMount(() => {
		function animateColor() {
			for (const inst of instances.values()) {
				if (inst.params.colorCycling && inst.troika && !inst.params.useVideoTexture) {
					const time = Date.now() * 0.001 * inst.params.colorCycleSpeed;
					const r = Math.sin(time) * 0.5 + 0.5;
					const g = Math.sin(time + 2) * 0.5 + 0.5;
					const b = Math.sin(time + 4) * 0.5 + 0.5;
					inst.troika.color = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
					inst.troika.sync();
				}
			}
			colorCycleFrame = requestAnimationFrame(animateColor);
		}
		animateColor();
		return () => {
			cancelAnimationFrame(colorCycleFrame);
			for (const inst of instances.values()) disposeInstance(inst);
			instances.clear();
			(window as any).__textMeshes = null;
			(window as any).__textMesh = null;
			isInitialized = false;
		};
	});

	function makeInstance(params: Text3DParams): TextInstance {
		return {
			params,
			lastSpec: '',
			troika: null,
			true3d: null,
			fontLoadToken: 0,
			loadedFontFile: '',
			loadedText: '',
			loadedFontSize: 0,
			loadedExtrudeDepth: -1,
			loadedBevelEnabled: false,
			loadedBevelThickness: -1,
			loadedBevelSize: -1
		};
	}

	function syncInstances(entries: Record<string, Text3DParams>) {
		if (!scene) return;
		// Dispose removed instances
		for (const [id, inst] of instances) {
			if (!entries[id]) {
				disposeInstance(inst);
				instances.delete(id);
			}
		}
		// Create/update the rest — only when their params actually changed
		for (const [id, params] of Object.entries(entries)) {
			let inst = instances.get(id);
			if (!inst) {
				inst = makeInstance(params);
				instances.set(id, inst);
			}
			const spec = JSON.stringify(params);
			if (inst.lastSpec === spec) continue;
			inst.lastSpec = spec;
			inst.params = params;
			if (params.textMode === 'troika') {
				if (inst.true3d) disposeTrueTextMesh(inst);
				if (!inst.troika) createTroikaMesh(inst);
				updateTroikaProperties(inst);
			} else {
				if (inst.troika) disposeTroikaMesh(inst);
				createOrUpdateTrueTextMesh(inst);
			}
		}
		publishTextMeshes();
	}

	// Capture pokes _videoTexture.needsUpdate on these each frame
	function publishTextMeshes() {
		const meshes: any[] = [];
		for (const inst of instances.values()) {
			const m = inst.params.textMode === 'troika' ? inst.troika : inst.true3d;
			if (m) meshes.push(m);
		}
		(window as any).__textMeshes = meshes;
		const activeId = get(text3DState).activeEntryId;
		const active = activeId ? instances.get(activeId) : null;
		(window as any).__textMesh = active
			? (active.params.textMode === 'troika' ? active.troika : active.true3d)
			: meshes[0] ?? null;
	}

	function disposeInstance(inst: TextInstance) {
		disposeTroikaMesh(inst);
		disposeTrueTextMesh(inst);
	}

	function disposeTroikaMesh(inst: TextInstance) {
		if (inst.troika && scene) {
			scene.remove(inst.troika);
			if (inst.troika._videoTexture) {
				inst.troika._videoTexture.dispose();
				inst.troika._videoTexture = null;
			}
			inst.troika.dispose();
			inst.troika = null;
		}
	}

	function disposeTrueTextMesh(inst: TextInstance) {
		if (inst.true3d && scene) {
			scene.remove(inst.true3d);
			if (inst.true3d.geometry) inst.true3d.geometry.dispose();
			if ((inst.true3d as any)._videoTexture) {
				(inst.true3d as any)._videoTexture.dispose();
				(inst.true3d as any)._videoTexture = null;
			}
			inst.true3d = null;
			inst.loadedFontFile = '';
			inst.loadedText = '';
			inst.loadedFontSize = 0;
			inst.loadedExtrudeDepth = -1;
			inst.loadedBevelEnabled = false;
			inst.loadedBevelThickness = -1;
			inst.loadedBevelSize = -1;
		}
	}

	function applyVideoTextureToMesh(mesh: THREE.Mesh, p: Text3DParams) {
		const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;
		if (!videoElement) return;
		const { x, y } = p.videoTextureOffset;
		const scale = p.videoTextureScale;
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
			metalness: p.metalness,
			roughness: p.roughness
		});
	}

	function applyStandardMaterialToMesh(mesh: THREE.Mesh, p: Text3DParams) {
		if ((mesh as any)._videoTexture) {
			(mesh as any)._videoTexture.dispose();
			(mesh as any)._videoTexture = null;
		}
		mesh.material = new THREE.MeshStandardMaterial({
			color: new THREE.Color(p.materialColor),
			metalness: p.metalness,
			roughness: p.roughness,
			emissive: new THREE.Color(p.emissive),
			emissiveIntensity: p.emissiveIntensity,
			side: THREE.DoubleSide
		});
	}

	function createOrUpdateTrueTextMesh(inst: TextInstance) {
		if (!scene) return;
		const p = inst.params;
		const fontFile = p.true3dFontFile;
		const currentText = p.text || 'Sample Text';
		const fontUrl = `/fonts/${fontFile}`;
		const needsRebuild =
			!inst.true3d ||
			fontFile !== inst.loadedFontFile ||
			currentText !== inst.loadedText ||
			p.fontSize !== inst.loadedFontSize ||
			p.extrudeDepth !== inst.loadedExtrudeDepth ||
			p.bevelEnabled !== inst.loadedBevelEnabled ||
			p.bevelThickness !== inst.loadedBevelThickness ||
			p.bevelSize !== inst.loadedBevelSize;

		if (needsRebuild) {
			disposeTrueTextMesh(inst);
			inst.loadedFontFile = fontFile;
			inst.loadedText = currentText;
			inst.loadedFontSize = p.fontSize;
			inst.loadedExtrudeDepth = p.extrudeDepth;
			inst.loadedBevelEnabled = p.bevelEnabled;
			inst.loadedBevelThickness = p.bevelThickness;
			inst.loadedBevelSize = p.bevelSize;

			const token = ++inst.fontLoadToken;
			fontLoader.load(fontUrl, (font) => {
				// Abort if a newer rebuild started while this was loading
				if (token !== inst.fontLoadToken || !scene) return;

				// Remove any orphaned mesh from a previous in-flight load
				if (inst.true3d) {
					scene.remove(inst.true3d);
					if (inst.true3d.geometry) inst.true3d.geometry.dispose();
					inst.true3d = null;
				}

				const geo = new TextGeometry(currentText, {
					font,
					size: p.fontSize / 50,
					depth: p.extrudeDepth,
					curveSegments: 6,
					bevelEnabled: p.bevelEnabled,
					bevelThickness: p.bevelThickness,
					bevelSize: p.bevelSize * 0.5,
					bevelSegments: 3
				});
				geo.computeBoundingBox();
				geo.center();

				const mesh = new THREE.Mesh(geo);
				if (p.useVideoTexture) applyVideoTextureToMesh(mesh, p);
				else applyStandardMaterialToMesh(mesh, p);
				mesh.scale.setScalar(p.scale3D);
				mesh.position.set(p.position3D.x, p.position3D.y, p.position3D.z);
				mesh.rotation.set(p.rotation3D.x, p.rotation3D.y, p.rotation3D.z);
				mesh.visible = false; // updateAnimation decides per frame
				inst.true3d = mesh;
				scene.add(mesh);
				publishTextMeshes();
			});
		} else if (inst.true3d) {
			updateTrueTextProperties(inst);
		}
	}

	function updateTrueTextProperties(inst: TextInstance) {
		const mesh = inst.true3d;
		if (!mesh || !scene) return;
		const p = inst.params;
		if (p.useVideoTexture) applyVideoTextureToMesh(mesh, p);
		else applyStandardMaterialToMesh(mesh, p);
		mesh.scale.setScalar(p.scale3D);
		mesh.position.set(p.position3D.x, p.position3D.y, p.position3D.z);
		mesh.rotation.set(p.rotation3D.x, p.rotation3D.y, p.rotation3D.z);
	}

	function createTroikaMesh(inst: TextInstance) {
		if (!scene) return;
		const p = inst.params;
		// Troika's typings miss several runtime props (curveRadius, fillOpacity…)
		const mesh: any = new Text();
		mesh.text = p.text || 'Sample Text';
		mesh.fontSize = p.fontSize / 50;
		mesh.color = p.materialColor;
		mesh.anchorX = 'center';
		mesh.anchorY = 'middle';
		mesh.letterSpacing = p.letterSpacing;
		mesh.curveRadius = p.curveRadius;
		// Use font URL with default Roboto .ttf fallback (Troika needs TTF, not WOFF2!)
		mesh.font = p.fontUrl || defaultRobotoUrl;
		mesh.visible = false;
		inst.troika = mesh;
		scene.add(mesh);
		mesh.sync();
	}

	function updateTroikaProperties(inst: TextInstance) {
		if (!inst.troika) return;
		const p = inst.params;
		const newText = p.text || 'Sample Text';
		// CRITICAL: Troika needs TTF files, NOT woff2!
		const newFont = p.fontUrl || defaultRobotoUrl;
		// Font change forces full recreation
		if (inst.troika.font !== newFont) {
			disposeTroikaMesh(inst);
			createTroikaMesh(inst);
		}
		const mesh = inst.troika;
		if (!mesh) return;
		mesh.text = newText;
		mesh.font = newFont;
		mesh.fontSize = p.fontSize / 50;
		mesh.scale.setScalar(p.scale3D);
		mesh.letterSpacing = p.letterSpacing;
		mesh.curveRadius = p.curveRadius;
		// VIDEO TEXTURE ON TEXT (INSANE FEATURE!)
		if (p.useVideoTexture && (window as any).__threeJsVideo) {
			const videoElement = (window as any).__threeJsVideo as HTMLVideoElement;
			if (!mesh._videoTexture) {
				mesh._videoTexture = new THREE.VideoTexture(videoElement);
				mesh._videoTexture.colorSpace = THREE.SRGBColorSpace;
				mesh._videoTexture.needsUpdate = true;
			}
			mesh.material = new THREE.MeshBasicMaterial({
				map: mesh._videoTexture,
				side: THREE.DoubleSide,
				transparent: true
			});
			mesh._videoTexture.repeat.set(p.videoTextureScale, p.videoTextureScale);
			mesh._videoTexture.offset.set(p.videoTextureOffset.x, p.videoTextureOffset.y);
			mesh._videoTexture.needsUpdate = true;
		} else {
			mesh.color = new THREE.Color(p.materialColor);
			if (mesh._videoTexture) {
				mesh._videoTexture.dispose();
				mesh._videoTexture = null;
			}
		}
		mesh.color = new THREE.Color(p.materialColor);
		mesh.position.set(p.position3D.x, p.position3D.y, p.position3D.z);
		mesh.rotation.set(p.rotation3D.x, p.rotation3D.y, p.rotation3D.z);
		mesh.fillOpacity = 1.0;
		// Outline (bevel effect)
		if (p.bevelEnabled) {
			mesh.outlineWidth = p.bevelThickness * 0.5;
			mesh.outlineColor = new THREE.Color(p.materialColor).multiplyScalar(0.5);
			mesh.outlineOpacity = 1.0;
		} else {
			mesh.outlineWidth = 0;
		}
		// Emissive glow
		if (p.emissiveIntensity > 0) {
			mesh.outlineWidth = 0.1;
			mesh.outlineColor = new THREE.Color(p.emissive);
			mesh.outlineOpacity = p.emissiveIntensity;
			mesh.outlineBlur = 0.3;
		}
		// Stroke (depth effect)
		if (p.extrudeDepth > 0) {
			mesh.strokeWidth = p.extrudeDepth * 0.15;
			mesh.strokeColor = new THREE.Color(p.materialColor).multiplyScalar(0.3);
			mesh.strokeOpacity = 0.9;
		} else {
			mesh.strokeWidth = 0;
		}
		// Metalness effect
		if (p.metalness > 0.5) {
			mesh.color = new THREE.Color(p.materialColor).multiplyScalar(1 - p.metalness * 0.3);
		}
		mesh.anchorX = 'center';
		mesh.anchorY = 'middle';
		mesh.textAlign = 'center';
		mesh.maxWidth = 20;
		mesh.whiteSpace = 'normal';
		mesh.sync();
	}

	// Per-frame: visibility + fade come from each instance's TIMELINE BAR.
	// Called by ThreeJsScene's animate() (live) and __threeJsUpdateScene (capture).
	export function updateAnimation(animationTime: number, videoTime?: number) {
		if (instances.size === 0) return;
		const now: number =
			(window as any).__timelineEditTime ?? videoTime ?? animationTime;
		// entryId lookup for clip assets — tiny maps, rebuilt per frame
		const assets = get(mediaBinStore).assets;
		const assetEntry = new Map<string, string>();
		for (const a of assets) if (a.text3dId) assetEntry.set(a.id, a.text3dId);
		const tl = get(timelineStore);

		for (const [id, inst] of instances) {
			const isTroika = inst.params.textMode === 'troika';
			const mesh = isTroika ? inst.troika : inst.true3d;
			if (!mesh) continue;
			// Find a covering clip for this instance on any video lane (an instance
			// can have several bars = same styled text at multiple intervals)
			let opacity = 0;
			outer: for (const tr of tl.tracks) {
				if (tr.type !== 'video') continue;
				for (const c of tr.clips) {
					if (assetEntry.get(c.assetId) !== id) continue;
					if (now >= c.startTime && now < c.endTime) {
						opacity = clipTransitionState(c, now).p; // fade alpha (3D text can't wipe)
						break outer;
					}
				}
			}
			if (opacity <= 0) {
				if (mesh.visible) {
					mesh.visible = false;
					if (isTroika) mesh.sync?.();
				}
				continue;
			}
			mesh.visible = true;
			if (isTroika) {
				mesh.fillOpacity = opacity;
				mesh.outlineOpacity = opacity;
				if ('strokeOpacity' in mesh) (mesh as Record<string, unknown>).strokeOpacity = opacity;
				mesh.sync?.();
			} else {
				applyTrueTextOpacity(mesh, opacity);
			}
			animateMesh(mesh, animationTime, inst.params, isTroika);
		}
	}

	function applyTrueTextOpacity(mesh: THREE.Mesh, opacity: number) {
		const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const mat of mats) {
			(mat as THREE.MeshStandardMaterial).transparent = true;
			(mat as THREE.MeshStandardMaterial).opacity = opacity;
		}
	}

	function animateMesh(mesh: any, animationTime: number, p: Text3DParams, isTroika: boolean) {
		// Calculate base rotation (includes autoRotate)
		let rotX = p.rotation3D.x;
		let rotY = p.rotation3D.y;
		let rotZ = p.rotation3D.z;

		if (p.autoRotate) {
			rotY += animationTime * p.autoRotateSpeed;
		}

		const sync = () => { if (isTroika && mesh.sync) mesh.sync(); };

		switch (p.animationType) {
			case 'spin':
				rotY += animationTime * 0.02;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'wave':
				mesh.position.y = p.position3D.y + Math.sin(animationTime) * 0.5;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'float':
				mesh.position.y = p.position3D.y + Math.sin(animationTime * 2) * 0.3;
				rotY += animationTime * 0.005;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'bounce': {
				const bounceHeight = Math.abs(Math.sin(animationTime * 3)) * 0.8;
				mesh.position.y = p.position3D.y + bounceHeight;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'pulse': {
				const pulseScale = 1 + Math.sin(animationTime * 2) * 0.15;
				mesh.scale.setScalar(p.scale3D * pulseScale);
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
				mesh.position.x = p.position3D.x + jitterX;
				mesh.position.y = p.position3D.y + jitterY;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'spiral':
				rotY += animationTime * 0.03;
				mesh.position.y = p.position3D.y + Math.sin(animationTime * 2) * 0.6;
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'elastic': {
				const elasticScale =
					1 + Math.sin(animationTime * 4) * Math.exp(-animationTime * 0.001) * 0.3;
				mesh.scale.setScalar(p.scale3D * elasticScale);
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			}
			case 'glitch':
				if (Math.random() > 0.95) {
					mesh.position.x = p.position3D.x + (Math.random() - 0.5) * 0.2;
					mesh.position.y = p.position3D.y + (Math.random() - 0.5) * 0.2;
				} else {
					mesh.position.x = p.position3D.x;
					mesh.position.y = p.position3D.y;
				}
				mesh.rotation.set(rotX, rotY, rotZ);
				sync();
				break;
			case 'orbit': {
				const orbitRadius = 0.5;
				mesh.position.x = p.position3D.x + Math.cos(animationTime) * orbitRadius;
				mesh.position.z = p.position3D.z + Math.sin(animationTime) * orbitRadius;
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
