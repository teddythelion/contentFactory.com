<!-- src/lib/components/ThreeJsEnhancer/ControlsPanel.svelte -->
<!-- CLEANED: Removed social posting, focused on core workflow -->

<script lang="ts">	
	import { enhancedContentState } from '$lib/stores/enhancedContent.store';
	import { threeJsState } from '$lib/stores/threeJs.store';
	import { videoState } from '$lib/stores/video.store';
	import { text3DState } from '$lib/stores/text3d.store';
	import { captureThreeJsVideo } from '$lib/utils/videoCapture';
	import CaptureProgressOverlay from './CaptureProgressOverlay.svelte';
	import GoogleFonts from '$lib/components/textOverlay/GoogleFonts.svelte';
	import LogoUpload from './LogoUpload.svelte';
	import { logoState } from '$lib/stores/logo.store';
	import { audioStudioStore } from '$lib/stores/audioStudio.store';
	
	function resetAll() {
		(window as any).__threeJsVideo?.pause();
		videoState.setIsPlaying(false);
		threeJsState.reset();
		text3DState.reset();
		logoState.reset();
		audioStudioStore.reset();
	}

	// Capture progress state
	let captureProgress = $state(0);
	let captureMessage = $state('');
	let showCaptureProgress = $state(false);

	// Music-ready toast
	let showMusicToast = $state(false);
	let musicToastTimer: ReturnType<typeof setTimeout> | null = null;

	// Mobile tab state — tracks which group is active on mobile
	let activeMobileTab = 'shape';

	//$: logoValues = $logoState;
	//$: textValues = $text3DState;
	//$: shapeValues = $threeJsState;
	//$: isSavingEnhanced = $enhancedContentState.isSaving;
	let audioStudio = $derived($audioStudioStore);
	let videoDuration = $derived($videoState.videoDuration || 8);
let musicMaxTime = $derived(videoDuration);

	// // Sync original video volume/mute to the canvas video element
	// $effect(() => {		
	// 	if (typeof window !== 'undefined') {
	// 	const vid = (window as any).__threeJsVideo as HTMLVideoElement | null;
	// 	if (vid) {
	// 		vid.muted = audioStudio.originalMuted;
	// 		vid.volume = audioStudio.originalVolume;
	// 		}
	// 	}
	// });	

	function handleFontSelection(fontFamily: string, fontUrl: string) {
		text3DState.setFontWithUrl(fontFamily, fontUrl);
	}

	// ── SFX ────────────────────────────────────────────────────
	async function handleUploadSfx(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const objectUrl = URL.createObjectURL(file);

		const formData = new FormData();
		formData.append('file', file);
		let sessionId = 'local';
		try {
			const res = await fetch('/api/saveSfxFile', { method: 'POST', body: formData });
			if (res.ok) {
				const data = await res.json();
				sessionId = data.sessionId;
			}
		} catch {
			console.warn('SFX upload to server failed — export will have no SFX track');
		}

		audioStudioStore.setLocalSfxFile(file.name, objectUrl, sessionId);
	}

	async function handleGenerateSfx() {
		const prompt = $audioStudioStore.sfxPrompt.trim();
		if (!prompt) return;
		audioStudioStore.setSfxGenerating(true);
		try {
			const res = await fetch('/api/generateSfx', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt, durationSeconds: 5 })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'SFX generation failed');
			audioStudioStore.setSfxResult(data.sfxSessionId, data.previewUrl);
		} catch (err) {
			audioStudioStore.setSfxError(err instanceof Error ? err.message : 'SFX generation failed');
		}
	}

	// ── MUSIC ───────────────────────────────────────────────────
	async function handleUploadMusic(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		const objectUrl = URL.createObjectURL(file);

		// Upload to server so it can be muxed into the exported video
		const formData = new FormData();
		formData.append('file', file);
		let sessionId = 'local';
		try {
			const res = await fetch('/api/saveMusicFile', { method: 'POST', body: formData });
			if (res.ok) {
				const data = await res.json();
				sessionId = data.sessionId;
			}
		} catch {
			console.warn('Music upload to server failed — export will have no music track');
		}

		audioStudioStore.setLocalMusicFile(file.name, objectUrl, sessionId);
		if (musicToastTimer) clearTimeout(musicToastTimer);
		showMusicToast = true;
		musicToastTimer = setTimeout(() => { showMusicToast = false; }, 6000);
	}

	async function handleGenerateMusic() {
	const prompt = $audioStudioStore.musicPrompt.trim();
	if (!prompt) return;
	audioStudioStore.setMusicGenerating(true);
	try {
		//const video = (window as any).__threeJsVideo as HTMLVideoElement;
		const durationMs = $audioStudioStore.musicDuration
    	? $audioStudioStore.musicDuration * 1000
    	: 30000;
		const res = await fetch('/api/generateMusic', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ prompt, durationMs })
		});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Music generation failed');
			audioStudioStore.setMusicResult(data.musicSessionId, data.previewUrl);
			// Show toast — music doesn't auto-play; user needs to hit play
			if (musicToastTimer) clearTimeout(musicToastTimer);
			showMusicToast = true;
			musicToastTimer = setTimeout(() => { showMusicToast = false; }, 6000);
		} catch (err) {
			audioStudioStore.setMusicError(err instanceof Error ? err.message : 'Music generation failed');
		}
	}

	let controlGroups = $derived.by(() => [	
		{
			id: 'shape',
			title: 'Shape & Transform',
			items: [
				{
					label: 'Shape',
					type: 'select',
					options: [
						{ value: 'plane',        label: 'Plane' },
						{ value: 'sphere',       label: 'Sphere' },
						{ value: 'cube',         label: 'Cube' },
						{ value: 'cylinder',     label: 'Cylinder' },
						{ value: 'torus',        label: 'Torus' },
						{ value: 'icosahedron',  label: 'Icosahedron' },
						{ value: 'cone',         label: 'Cone' },
						{ value: 'ring',         label: 'Ring' },
						{ value: 'octahedron',   label: 'Octahedron' },
						{ value: 'tetrahedron',  label: 'Tetrahedron' },						
						{ value: 'hexagon',      label: '⬡ Hexagon' },
						{ value: 'cinematic',    label: 'Cinematic' },
						{ value: 'torusknot',    label: 'Torus Knot' },
						{ value: 'twistedtorus', label: 'Twisted Torus' },
					]
				},
				{ label: 'Camera Distance', type: 'range', min: 2, max: 15, step: 0.1 },
				{ label: 'Scale', type: 'range', min: 0.5, max: 3, step: 0.1 }
			]
		},
		{
			id: 'rotation',
			title: 'Rotation',
			items: [
				{ label: 'X Rotation', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Y Rotation', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Z Rotation', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Auto Rotate', type: 'toggle' },
				{ label: 'Auto Rotate Speed', type: 'range', min: 0.001, max: 0.9, step: 0.001 },
				{ label: 'Reset Rotation', type: 'button', action: () => threeJsState.resetRotation() }
			]
		},
		{
			id: 'lighting',
			title: 'Lighting',
			items: [
				{ label: 'Ambient', type: 'range', min: 0.3, max: 2.5, step: 0.01 },
				{ label: 'Directional', type: 'range', min: 0.2, max: 2.5, step: 0.01 }
			]
		},
		{
			id: 'effects',
			title: 'Video Effects',
			items: [
				{ label: 'Video Glow', type: 'range', min: 0, max: 1, step: 0.01 },
				{ label: 'Shape Glow', type: 'range', min: 0, max: 1, step: 0.01 }
			]
		},
		{
			id: 'particles',
			title: 'Particle System',
			items: [
				{ label: 'Enable Particles', type: 'toggle' },
				{ label: 'Particle Count', type: 'range', min: 1000, max: 20000, step: 1000 },
				{ label: 'Particle Size', type: 'range', min: 0.01, max: 0.2, step: 0.01 },
				{ label: 'Particle Speed', type: 'range', min: 0.1, max: 2, step: 0.1 },
				{ label: 'Particle Spread', type: 'range', min: 5, max: 20, step: 1 },
				{ label: 'Particle Color', type: 'color' },
				{ label: 'Particle Opacity', type: 'range', min: 0, max: 1, step: 0.1 },
				{
					label: 'Particle Shape',
					type: 'select',
					options: [
						{ value: 'circle',   label: '⚪ Circle' },
						{ value: 'square',   label: '⬜ Square' },
						{ value: 'triangle', label: '🔺 Triangle' },
						{ value: 'star',     label: '⭐ Star' },
						{ value: 'heart',    label: '❤️ Heart' }
					]
				},
				{
					label: 'Animation',
					type: 'select',
					options: [
						{ value: 'none',      label: 'None' },
						{ value: 'spiral',    label: '🌀 Spiral' },
						{ value: 'wave',      label: '🌊 Wave' },
						{ value: 'vortex',    label: '🌪️ Vortex' },
						{ value: 'explosion', label: '💥 Explosion' },
						{ value: 'orbit',     label: '🪐 Orbit' },
						{ value: 'pulse',     label: '💓 Pulse' },
						{ value: 'fountain',  label: '⛲ Fountain' }
					]
				},
				{ label: 'Animation Speed', type: 'range', min: 0.1, max: 5, step: 0.1 },
				{
					label: 'Color Mode',
					type: 'select',
					options: [
						{ value: 'solid',    label: '🎨 Solid Color' },
						{ value: 'gradient', label: '🌈 Gradient' },
						{ value: 'rainbow',  label: '🌈 Rainbow' }
					]
				},
				{ label: 'Gradient Color 2', type: 'color' },
				{ label: 'Glow Effect', type: 'toggle' },
				{ label: 'Particle Rotation', type: 'toggle' }
			]
		},
		{
			id: 'text3d',
			title: '✨ 3D Text & Typography',
			items: [
				{ label: 'Enable 3D Text', type: 'toggle' },
				{ label: 'Text Content', type: 'text' },
				{ label: 'Text Mode', type: 'text-mode-toggle' },
				...($text3DState.textMode === 'troika' ? [
					{
						label: 'Font Family',
						type: 'component' as const,
						component: GoogleFonts,
						componentProps: { selectedFont: $text3DState.fontFamily, onFontSelect: handleFontSelection }
					}
				] : [
					{
						label: 'True 3D Font',
						type: 'select' as const,
						options: [
							{ value: 'helvetiker_bold.typeface.json',    label: 'Helvetiker Bold' },
							{ value: 'helvetiker_regular.typeface.json', label: 'Helvetiker Regular' },
							{ value: 'droid_sans_bold.typeface.json',    label: 'Droid Sans Bold' },
							{ value: 'droid_sans_regular.typeface.json', label: 'Droid Sans Regular' },
							{ value: 'droid_sans_mono_regular.typeface.json', label: 'Droid Sans Mono' },
							{ value: 'droid_serif_bold.typeface.json',   label: 'Droid Serif Bold' },
							{ value: 'droid_serif_regular.typeface.json',label: 'Droid Serif Regular' },
							{ value: 'gentilis_bold.typeface.json',      label: 'Gentilis Bold' },
							{ value: 'gentilis_regular.typeface.json',   label: 'Gentilis Regular' },
							{ value: 'optimer_bold.typeface.json',       label: 'Optimer Bold' },
							{ value: 'optimer_regular.typeface.json',    label: 'Optimer Regular' }
						]
					}
				]),
				{ label: 'Font Size', type: 'range', min: 20, max: 200, step: 5 },
				{ label: 'Text Scale', type: 'range', min: 0.1, max: 3, step: 0.1 },
				{ label: 'Extrude Depth', type: 'range', min: 0, max: 2, step: 0.01 },
				{ label: 'Bevel Enabled', type: 'toggle' },
				{ label: 'Bevel Thickness', type: 'range', min: 0, max: 0.5, step: 0.05 },
				{ label: 'Position X', type: 'range', min: -10, max: 10, step: 0.1 },
				{ label: 'Position Y', type: 'range', min: -10, max: 10, step: 0.1 },
				{ label: 'Position Z', type: 'range', min: -10, max: 10, step: 0.1 },
				{ label: 'Rotation X', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Rotation Y', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Rotation Z', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Material Color', type: 'color' },
				{ label: 'Metalness', type: 'range', min: 0, max: 1, step: 0.1 },
				{ label: 'Roughness', type: 'range', min: 0, max: 1, step: 0.1 },
				{ label: 'Emissive Color', type: 'color' },
				{ label: 'Emissive Intensity', type: 'range', min: 0, max: 2, step: 0.1 },
				{ label: 'Auto Rotate Text', type: 'toggle' },
				{ label: 'Auto Rotate Speed', type: 'range', min: 0.001, max: 0.1, step: 0.001 },
				{
					label: 'Text Animation',
					type: 'select',
					options: [
						{ value: 'none',    label: 'None' },
						{ value: 'spin',    label: '🔄 Spin' },
						{ value: 'wave',    label: '🌊 Wave' },
						{ value: 'float',   label: '☁️ Float' },
						{ value: 'bounce',  label: '🏀 Bounce' },
						{ value: 'pulse',   label: '💓 Pulse' },
						{ value: 'swing',   label: '⚖️ Swing' },
						{ value: 'jitter',  label: '⚡ Jitter' },
						{ value: 'spiral',  label: '🌀 Spiral' },
						{ value: 'elastic', label: '🎯 Elastic' },
						{ value: 'glitch',  label: '📺 Glitch' },
						{ value: 'orbit',   label: '🪐 Orbit' },
						{ value: 'wobble',  label: '🎲 Wobble' }
					]
				},
				{ label: '🎬 Video Texture', type: 'section' },
				{ label: 'Use Video Texture', type: 'toggle' },
				{ label: 'Video Texture Scale', type: 'range', min: 0.1, max: 5, step: 0.1 },
				{ label: 'Video Texture Position X', type: 'range', min: -2, max: 2, step: 0.1 },
				{ label: 'Video Texture Position Y', type: 'range', min: -2, max: 2, step: 0.1 },
				{ label: '💡 Bold Title Preset', type: 'button', action: () => text3DState.presets.title() },
				{ label: '✨ Subtle Subtitle Preset', type: 'button', action: () => text3DState.presets.subtitle() },
				{ label: '🌟 Neon Glow Preset', type: 'button', action: () => text3DState.presets.neon() },
				{ label: '🏆 Gold Classic Preset', type: 'button', action: () => text3DState.presets.gold() },
				{ label: '🔄 Reset Text Transform', type: 'button', action: () => text3DState.resetTransform() }
			]
		},
		{
			id: 'logo',
			title: '🎨 Image Overlay',
			items: [
				{ label: 'Enable Image', type: 'toggle' },
				{ label: 'Upload Image', type: 'component', component: LogoUpload, componentProps: {} },
				{ label: 'Scale', type: 'range', min: 0.05, max: 4, step: 0.01 },
				{ label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
				{ label: 'Position X', type: 'range', min: 0, max: 100, step: 1 },
				{ label: 'Position Y', type: 'range', min: 0, max: 100, step: 1 },
				{ label: 'Position Z', type: 'range', min: -10, max: 10, step: 0.1 },
				{ label: 'Rotation X', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Rotation Y', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Rotation Z', type: 'range', min: -3.14, max: 3.14, step: 0.01 },
				{ label: 'Auto Rotate Logo', type: 'toggle' },
				{ label: 'Auto Rotate Speed', type: 'range', min: 0.001, max: 0.1, step: 0.001 },
				{ label: 'Start Time', type: 'range', min: 0, max: 8, step: 0.1 },
				{ label: 'End Time', type: 'range', min: 0, max: 8, step: 0.1 },
				{ label: 'Fade In Duration', type: 'range', min: 0, max: 2, step: 0.1 },
				{ label: 'Fade Out Duration', type: 'range', min: 0, max: 2, step: 0.1 },
				{
					label: 'Image Animation',
					type: 'select',
					options: [
						{ value: 'none',               label: 'None' },
						{ value: 'spin',               label: '🔄 Spin' },
						{ value: 'pulse',              label: '💓 Pulse' },
						{ value: 'bounce',             label: '🏀 Bounce' },
						{ value: 'explode',            label: '💥 Explode' },
						{ value: 'warp',               label: '🌀 Warp' },
						{ value: 'glitch',             label: '📺 Glitch' },
						{ value: 'flip3d',             label: '🎪 Flip 3D' },
						{ value: 'spiral',             label: '🌪️ Spiral' },
						{ value: 'shimmer',            label: '✨ Shimmer' },
						{ value: 'particle-assemble',  label: '⚛️ Particle Assemble' }
					]
				},
				{ label: 'Animation Speed', type: 'range', min: 0.1, max: 5, step: 0.1 }
			]
		},
		// ── AUDIO STUDIO groups — custom template rendering below ──
		{ id: 'sfx',   title: '🔊 Sound FX & Original Audio', items: [] },
		{ id: 'music', title: '🎵 Music',          items: [] }	
	]);

	function getControlValue(groupId: string, label: string): number | string | boolean {
		if (groupId === 'text3d') {
			switch (label) {
				case 'Enable 3D Text': return $text3DState.enabled;
				case 'Text Content': return $text3DState.text;
				case 'Font Size': return $text3DState.fontSize;
				case 'Text Scale': return $text3DState.scale3D;
				case 'Extrude Depth': return $text3DState.extrudeDepth;
				case 'Bevel Enabled': return $text3DState.bevelEnabled;
				case 'Bevel Thickness': return $text3DState.bevelThickness;
				case 'Position X': return $text3DState.position3D.x;
				case 'Position Y': return $text3DState.position3D.y;
				case 'Position Z': return $text3DState.position3D.z;
				case 'Rotation X': return $text3DState.rotation3D.x;
				case 'Rotation Y': return $text3DState.rotation3D.y;
				case 'Rotation Z': return $text3DState.rotation3D.z;
				case 'Material Color': return $text3DState.materialColor;
				case 'Metalness': return $text3DState.metalness;
				case 'Roughness': return $text3DState.roughness;
				case 'Emissive Color': return $text3DState.emissive;
				case 'Emissive Intensity': return $text3DState.emissiveIntensity;
				case 'Auto Rotate Text': return $text3DState.autoRotate;
				case 'Auto Rotate Speed': return $text3DState.autoRotateSpeed;
				case 'Text Animation': return $text3DState.animationType;
				case 'Use Video Texture': return $text3DState.useVideoTexture;
				case 'Video Texture Scale': return $text3DState.videoTextureScale;
				case 'Video Texture Position X': return $text3DState.videoTextureOffset.x;
				case 'Video Texture Position Y': return $text3DState.videoTextureOffset.y;
				case 'True 3D Font': return $text3DState.true3dFontFile;
			}
		}
		if (groupId === 'logo') {
			switch (label) {
				case 'Enable Image': return $logoState.enabled;
				case 'Position X': return $logoState.position.x;
				case 'Position Y': return $logoState.position.y;
				case 'Position Z': return $logoState.position.z;
				case 'Scale': return $logoState.scale;
				case 'Opacity': return $logoState.opacity;
				case 'Start Time': return $logoState.startTime;
				case 'End Time': return $logoState.endTime;
				case 'Fade In Duration': return $logoState.fadeInDuration;
				case 'Fade Out Duration': return $logoState.fadeOutDuration;
				case 'Image Animation': return $logoState.animationType;
				case 'Animation Speed': return $logoState.animationSpeed;
				case 'Rotation X': return $logoState.rotation3D.x;
				case 'Rotation Y': return $logoState.rotation3D.y;
				case 'Rotation Z': return $logoState.rotation3D.z;
				case 'Auto Rotate Logo': return $logoState.autoRotate;
				case 'Auto Rotate Speed': return $logoState.autoRotateSpeed;
			}
		}
		switch (label) {
			case 'Shape': return $threeJsState.selectedShape;
			case 'Camera Distance': return $threeJsState.cameraDistance;
			case 'Scale': return $threeJsState.scale;
			case 'X Rotation': return $threeJsState.rotationX;
			case 'Y Rotation': return $threeJsState.rotationY;
			case 'Z Rotation': return $threeJsState.rotationZ;
			case 'Auto Rotate': return $threeJsState.autoRotate;
			case 'Auto Rotate Speed': return $threeJsState.autoRotateSpeed;
			case 'Ambient': return $threeJsState.ambientIntensity;
			case 'Directional': return $threeJsState.directionalIntensity;
			case 'Video Glow': return $threeJsState.videoGlow;
			case 'Shape Glow': return $threeJsState.shapeGlow;
			case 'Enable Particles': return $threeJsState.particlesEnabled;
			case 'Particle Count': return $threeJsState.particleCount;
			case 'Particle Size': return $threeJsState.particleSize;
			case 'Particle Speed': return $threeJsState.particleSpeed;
			case 'Particle Spread': return $threeJsState.particleSpread;
			case 'Particle Color': return $threeJsState.particleColor;
			case 'Particle Opacity': return $threeJsState.particleOpacity;
			case 'Particle Shape': return $threeJsState.particleShape;
			case 'Animation': return $threeJsState.particleAnimation;
			case 'Animation Speed': return $threeJsState.particleAnimationSpeed;
			case 'Color Mode': return $threeJsState.particleColorMode;
			case 'Gradient Color 2': return $threeJsState.particleGradientColor;
			case 'Glow Effect': return $threeJsState.particleGlow;
			case 'Particle Rotation': return $threeJsState.particleRotation;
			default: return 0;
		}
	}

	function getNumberValue(groupId: string, label: string): number {
		const val = getControlValue(groupId, label);
		return typeof val === 'number' ? val : 0;
	}

	function getBooleanValue(groupId: string, label: string): boolean {
		const val = getControlValue(groupId, label);
		return typeof val === 'boolean' ? val : false;
	}

	function setControlValue(groupId: string, label: string, value: any) {
		if (groupId === 'logo') {
			const currentState = $logoState;
			switch (label) {
				case 'Enable Image': logoState.setEnabled(value); break;
				case 'Position X': logoState.setPosition(value, currentState.position.y, currentState.position.z); break;
				case 'Position Y': logoState.setPosition(currentState.position.x, value, currentState.position.z); break;
				case 'Position Z': logoState.setPosition(currentState.position.x, currentState.position.y, value); break;
				case 'Scale': logoState.updateProperty('scale', value); break;
				case 'Opacity': logoState.updateProperty('opacity', value); break;
				case 'Start Time': logoState.updateProperty('startTime', value); break;
				case 'End Time': logoState.updateProperty('endTime', value); break;
				case 'Fade In Duration': logoState.updateProperty('fadeInDuration', value); break;
				case 'Fade Out Duration': logoState.updateProperty('fadeOutDuration', value); break;
				case 'Image Animation': logoState.setAnimation(value); break;
				case 'Animation Speed': logoState.setAnimationSpeed(value); break;
				case 'Rotation X': logoState.setRotation3D('x', value); break;
				case 'Rotation Y': logoState.setRotation3D('y', value); break;
				case 'Rotation Z': logoState.setRotation3D('z', value); break;
				case 'Auto Rotate Logo': logoState.toggleAutoRotate(); break;
				case 'Auto Rotate Speed': logoState.setAutoRotateSpeed(value); break;
			}
			return;
		}
		if (groupId === 'text3d') {
			switch (label) {
				case 'Enable 3D Text': text3DState.updateProperty('enabled', value); break;
				case 'Text Content': text3DState.setText(value); break;
				case 'Font Size': text3DState.setFontSize(value); break;
				case 'Text Scale': text3DState.setScale(value); break;
				case 'Extrude Depth': text3DState.updateProperty('extrudeDepth', value); break;
				case 'Bevel Enabled': text3DState.updateProperty('bevelEnabled', value); break;
				case 'Bevel Thickness': text3DState.updateProperty('bevelThickness', value); break;
				case 'Position X': text3DState.updatePosition3D('x', value); break;
				case 'Position Y': text3DState.updatePosition3D('y', value); break;
				case 'Position Z': text3DState.updatePosition3D('z', value); break;
				case 'Rotation X': text3DState.updateRotation3D('x', value); break;
				case 'Rotation Y': text3DState.updateRotation3D('y', value); break;
				case 'Rotation Z': text3DState.updateRotation3D('z', value); break;
				case 'Material Color': text3DState.setColor(value); break;
				case 'Metalness': text3DState.updateProperty('metalness', value); break;
				case 'Roughness': text3DState.updateProperty('roughness', value); break;
				case 'Emissive Color': text3DState.updateProperty('emissive', value); break;
				case 'Emissive Intensity': text3DState.updateProperty('emissiveIntensity', value); break;
				case 'Auto Rotate Text': text3DState.toggleAutoRotate(); break;
				case 'Auto Rotate Speed': text3DState.setAutoRotateSpeed(value); break;
				case 'Text Animation': text3DState.setAnimation(value); break;
				case 'Use Video Texture': text3DState.updateProperty('useVideoTexture', value); break;
				case 'Video Texture Scale': text3DState.updateProperty('videoTextureScale', value); break;
				case 'Video Texture Position X': text3DState.updateProperty('videoTextureOffset', { ...$text3DState.videoTextureOffset, x: value }); break;
				case 'Video Texture Position Y': text3DState.updateProperty('videoTextureOffset', { ...$text3DState.videoTextureOffset, y: value }); break;
				case 'True 3D Font': text3DState.setTrue3dFont(value as string); break;
			}
			return;
		}
		switch (label) {
			case 'Shape': threeJsState.setShape(value); break;
			case 'Camera Distance': threeJsState.updateProperty('cameraDistance', value); break;
			case 'Scale': threeJsState.updateProperty('scale', value); break;
			case 'X Rotation': threeJsState.updateProperty('rotationX', value); break;
			case 'Y Rotation': threeJsState.updateProperty('rotationY', value); break;
			case 'Z Rotation': threeJsState.updateProperty('rotationZ', value); break;
			case 'Auto Rotate': threeJsState.updateProperty('autoRotate', value); break;
			case 'Auto Rotate Speed': threeJsState.updateProperty('autoRotateSpeed', value); break;
			case 'Ambient': threeJsState.updateProperty('ambientIntensity', value); break;
			case 'Directional': threeJsState.updateProperty('directionalIntensity', value); break;
			case 'Video Glow': threeJsState.updateProperty('videoGlow', value); break;
			case 'Shape Glow': threeJsState.updateProperty('shapeGlow', value); break;
			case 'Enable Particles': threeJsState.updateProperty('particlesEnabled', value); break;
			case 'Particle Count': threeJsState.updateProperty('particleCount', value); break;
			case 'Particle Size': threeJsState.updateProperty('particleSize', value); break;
			case 'Particle Speed': threeJsState.updateProperty('particleSpeed', value); break;
			case 'Particle Spread': threeJsState.updateProperty('particleSpread', value); break;
			case 'Particle Color': threeJsState.updateProperty('particleColor', value); break;
			case 'Particle Opacity': threeJsState.updateProperty('particleOpacity', value); break;
			case 'Particle Shape': threeJsState.updateProperty('particleShape', value); break;
			case 'Animation': threeJsState.updateProperty('particleAnimation', value); break;
			case 'Animation Speed': threeJsState.updateProperty('particleAnimationSpeed', value); break;
			case 'Color Mode': threeJsState.updateProperty('particleColorMode', value); break;
			case 'Gradient Color 2': threeJsState.updateProperty('particleGradientColor', value); break;
			case 'Glow Effect': threeJsState.updateProperty('particleGlow', value); break;
			case 'Particle Rotation': threeJsState.updateProperty('particleRotation', value); break;
		}
	}

	function getUnit(label: string): string {
		if (label.includes('Glow') || label.includes('Intensity')) return '';
		if (label.includes('Distance')) return 'm';
		return '';
	}

	async function handleCapture() {
		if (!$videoState.videoUrl || !$threeJsState.isSceneReady) return;
		threeJsState.setCapturing(true);
		showCaptureProgress = true;
		captureProgress = 0;
		captureMessage = 'Initializing...';
		try {
			await captureThreeJsVideo((progress, message) => {
				captureProgress = progress;
				captureMessage = message;
			});
			captureMessage = '🎬 Encoding in background! You can navigate away freely.';
			setTimeout(() => { showCaptureProgress = false; }, 4000);
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Unknown error';
			alert(`Failed to capture video: ${errorMsg}`);
			showCaptureProgress = false;
		} finally {
			threeJsState.setCapturing(false);
		}
	}

	// Short display labels for mobile pill tabs
	const mobileTabLabels: Record<string, string> = {
		shape:     'Shape',
		rotation:  'Rotate',
		lighting:  'Light',
		effects:   'FX',
		particles: 'Particles',
		text3d:    '3D Text',
		logo:      'Image',
		sfx:       'SFX',
		music:     'Music'
	};
</script>

<CaptureProgressOverlay
	isVisible={showCaptureProgress}
	progress={captureProgress}
	message={captureMessage}
/>

<!-- ╔══════════════════════════════════════════════════════════╗ -->
<!-- ║  MOBILE LAYOUT — pill tabs + single-panel content       ║ -->
<!-- ╚══════════════════════════════════════════════════════════╝ -->
<div class="flex h-full flex-col lg:hidden">

	<!-- Horizontal scrollable pill tab row -->
	<div class="shrink-0 overflow-x-auto border-b border-white/10 bg-gray-900/80 px-2 py-2">
		<div class="flex gap-1.5" style="width: max-content;">
			{#each controlGroups as group (group.id)}
				<button
					onclick={() => activeMobileTab = group.id}
					class="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors {activeMobileTab === group.id ? 'bg-blue-600 text-white' : 'bg-gray-700/80 text-gray-300 hover:bg-gray-600'}"
				>
					{mobileTabLabels[group.id] ?? group.title}
				</button>
			{/each}
		</div>
	</div>

	<!-- Active group content — scrolls independently -->
	<div class="min-h-0 flex-1 overflow-y-auto px-3 py-2">
		{#each controlGroups as group (group.id)}
			{#if group.id === activeMobileTab}

				{#if group.id === 'sfx'}
					<!-- ── SOUND EFFECTS (mobile) ── -->
					<div class="flex flex-col gap-3">
						<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
							<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Original Audio</p>
							<div class="mb-2 flex items-center justify-between">
								<span class="text-sm text-white">Mute Original</span>
								<label class="relative inline-flex cursor-pointer items-center">
									<input type="checkbox" checked={audioStudio.originalMuted}
										onchange={(e) => audioStudioStore.setOriginalMuted(e.currentTarget.checked)}
										class="peer sr-only" />
									<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
								</label>
							</div>
							<div class="mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Volume</span>
								<span class="text-xs text-gray-400">{Math.round(audioStudio.originalVolume * 100)}%</span>
							</div>
							<input type="range" min="0" max="1" step="0.01"
								value={audioStudio.originalVolume}
								oninput={(e) => audioStudioStore.setOriginalVolume(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
						</div>
						<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
							<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Generate SFX</p>
							<textarea
								value={audioStudio.sfxPrompt}
								oninput={(e) => audioStudioStore.setSfxPrompt(e.currentTarget.value)}
								placeholder="e.g. deep cinematic space rumble with low frequency boom"
								rows="2"
								class="w-full resize-none rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
							></textarea>
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">SFX Volume</span>
								<span class="text-xs text-gray-400">{Math.round(audioStudio.sfxVolume * 100)}%</span>
							</div>
							<input type="range" min="0" max="1" step="0.01"
								value={audioStudio.sfxVolume}
								oninput={(e) => audioStudioStore.setSfxVolume(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
							<p class="mt-2 text-xs text-gray-500">Position SFX blocks on the timeline below ↓</p>
								<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Duration</span>
								<span class="text-xs text-gray-400">{audioStudio.musicDuration ?? 30}s</span>
							</div>
							<input type="range" min="5" max="300" step="5"
								value={audioStudio.musicDuration ?? 30}
								oninput={(e) => audioStudioStore.setMusicDuration(parseInt(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Fade In</span>
								<span class="text-xs text-gray-400">{audioStudio.sfxFadeIn.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max="6" step="0.1"
								value={audioStudio.sfxFadeIn}
								oninput={(e) => audioStudioStore.setSfxFadeIn(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Fade Out</span>
								<span class="text-xs text-gray-400">{audioStudio.sfxFadeOut.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max="6" step="0.1"
								value={audioStudio.sfxFadeOut}
								oninput={(e) => audioStudioStore.setSfxFadeOut(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
							<div class="mt-3 mb-3 flex items-center justify-between">
								<span class="text-sm text-white">Loop</span>
								<label class="relative inline-flex cursor-pointer items-center">
									<input type="checkbox" checked={audioStudio.sfxLoop}
										onchange={(e) => audioStudioStore.setSfxLoop(e.currentTarget.checked)}
										class="peer sr-only" />
									<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
								</label>
							</div>
							<div class="mb-3 flex items-center justify-between">
								<span class="text-sm text-white">Suppress Original Audio</span>
								<label class="relative inline-flex cursor-pointer items-center">
									<input type="checkbox" checked={audioStudio.sfxSuppressOriginal}
										onchange={(e) => audioStudioStore.setSfxSuppressOriginal(e.currentTarget.checked)}
										class="peer sr-only" />
									<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-red-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
								</label>
							</div>
							{#if audioStudio.sfxError}
								<p class="mb-2 text-xs text-red-400">{audioStudio.sfxError}</p>
							{/if}
							<div class="flex gap-2">
								<button onclick={handleGenerateSfx}
									disabled={audioStudio.sfxGenerating || !audioStudio.sfxPrompt.trim()}
									class="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
									{audioStudio.sfxGenerating ? '⏳ Generating...' : '🔊 Generate & Preview'}
								</button>
								{#if audioStudio.sfxSessionId}
									<button onclick={() => audioStudioStore.regenerateSfx(handleGenerateSfx)} title="Regenerate" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">🔄</button>
									<button onclick={() => audioStudioStore.downloadSfx()} title="Download" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">⬇️</button>
									<button onclick={() => audioStudioStore.stopSfx()} title="Remove" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">✕</button>
								{:else if audioStudio.sfxGenerating}
									<button onclick={() => audioStudioStore.stopSfx()} title="Cancel" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">✕</button>
								{/if}
							</div>
							<label class="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-gray-700/40 px-3 py-2 text-sm text-gray-300 hover:border-white/40 hover:text-white">
								📁 {audioStudio.sfxFileName ?? 'Upload SFX File'}
								<input type="file" accept="audio/*" class="hidden" onchange={handleUploadSfx} />
							</label>
							{#if audioStudio.sfxSessionId}
								<p class="mt-2 text-xs text-green-400">✅ {audioStudio.sfxFileName ?? 'SFX active'} — will be baked into export</p>
							{/if}
						</div>
					</div>

				{:else if group.id === 'music'}
					<!-- ── MUSIC (mobile) ── -->
					<div class="flex flex-col gap-3">
						<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
							<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Generate Music</p>
							<textarea
								value={audioStudio.musicPrompt}
								oninput={(e) => audioStudioStore.setMusicPrompt(e.currentTarget.value)}
								placeholder="e.g. epic orchestral cinematic space adventure, sweeping strings"
								rows="2"
								class="w-full resize-none rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
							></textarea>
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Music Volume</span>
								<span class="text-xs text-gray-400">{Math.round(audioStudio.musicVolume * 100)}%</span>
							</div>
							<input type="range" min="0" max="1" step="0.01"
								value={audioStudio.musicVolume}
								oninput={(e) => audioStudioStore.setMusicVolume(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Start Time</span>
								<span class="text-xs text-gray-400">{audioStudio.musicStartTime.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max={musicMaxTime} step="0.1"
								value={audioStudio.musicStartTime}
								oninput={(e) => audioStudioStore.setMusicStartTime(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">End Time</span>
								<span class="text-xs text-gray-400">{audioStudio.musicEndTime.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max={musicMaxTime} step="0.1"
								value={audioStudio.musicEndTime}
								oninput={(e) => audioStudioStore.setMusicEndTime(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
								<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Duration</span>
								<span class="text-xs text-gray-400">{audioStudio.musicDuration ?? 30}s</span>
							</div>
							<input type="range" min="5" max="300" step="5"
								value={audioStudio.musicDuration ?? 30}
								oninput={(e) => audioStudioStore.setMusicDuration(parseInt(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Fade In</span>
								<span class="text-xs text-gray-400">{audioStudio.musicFadeIn.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max="6" step="0.1"
								value={audioStudio.musicFadeIn}
								oninput={(e) => audioStudioStore.setMusicFadeIn(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Fade Out</span>
								<span class="text-xs text-gray-400">{audioStudio.musicFadeOut.toFixed(1)}s</span>
							</div>
							<input type="range" min="0" max="6" step="0.1"
								value={audioStudio.musicFadeOut}
								oninput={(e) => audioStudioStore.setMusicFadeOut(parseFloat(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
							<div class="mt-3 mb-3 flex items-center justify-between">
								<span class="text-sm text-white">Suppress Original Audio</span>
								<label class="relative inline-flex cursor-pointer items-center">
									<input type="checkbox" checked={audioStudio.musicSuppressOriginal}
										onchange={(e) => audioStudioStore.setMusicSuppressOriginal(e.currentTarget.checked)}
										class="peer sr-only" />
									<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-red-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
								</label>
							</div>
							
							{#if audioStudio.musicError}
								<p class="mb-2 mt-3 text-xs text-red-400">{audioStudio.musicError}</p>
							{/if}
							<!-- Upload local audio file -->
							<div class="mt-3">
								<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
									📁 {audioStudio.musicFileName ?? 'Upload Audio File'}
									<input type="file" accept="audio/*" onchange={handleUploadMusic} class="hidden" />
								</label>
							</div>
							<div class="my-2 flex items-center gap-2">
								<div class="flex-1 border-t border-white/10"></div>
								<span class="text-xs text-gray-500">or generate</span>
								<div class="flex-1 border-t border-white/10"></div>
							</div>
							<div class="flex gap-2">
								<button onclick={handleGenerateMusic}
									disabled={audioStudio.musicGenerating || !audioStudio.musicPrompt.trim()}
									class="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
									{audioStudio.musicGenerating ? '⏳ Generating...' : '🎵 Generate & Preview'}
								</button>
								{#if audioStudio.musicSessionId}
									<button onclick={() => audioStudioStore.regenerateMusic(handleGenerateMusic)} title="Regenerate" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">🔄</button>
									<button onclick={() => audioStudioStore.downloadMusic()} title="Download" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">⬇️</button>
									<button onclick={() => audioStudioStore.stopMusic()} title="Remove" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">✕</button>
								{:else if audioStudio.musicGenerating}
									<button onclick={() => audioStudioStore.stopMusic()} title="Cancel" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">✕</button>
								{/if}
							</div>
							{#if audioStudio.musicSessionId}
								<p class="mt-2 text-xs text-green-400">✅ {audioStudio.musicFileName ?? 'Music active'} — will be baked into export</p>
							{/if}
						</div>
					</div>

				{:else}
					<!-- ── STANDARD CONTROLS (mobile) ── -->
					{#each group.items as item (item.label)}
						{#if item.type === 'text-mode-toggle'}
							<div class="rounded-lg p-3">
								<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Text Mode</p>
								<div class="flex gap-2">
									<button
										onclick={() => text3DState.setTextMode('troika')}
										class="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors {$text3DState.textMode === 'troika' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
									>Google Fonts / 2.5-D</button>
									<button
										onclick={() => text3DState.setTextMode('true3d')}
										class="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors {$text3DState.textMode === 'true3d' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
									>True 3D</button>
								</div>
							</div>
						{:else if item.type === 'component'}
							<div class="rounded-lg p-3 hover:bg-white/5">
							{#if item.component}										
								<item.component {...(item.componentProps as any)} />
							{/if}
								
							</div>
						{:else if item.type === 'select'}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">{item.label}</span>
								</div>
								<select
									value={getControlValue(group.id, item.label)}
									onchange={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
									class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20"
								>
									{#each item.options || [] as option (typeof option === 'string' ? option : option.value)}
										{#if typeof option === 'string'}
											<option value={option}>{(option as string).charAt(0).toUpperCase() + (option as string).slice(1)}</option>
										{:else}
											<option value={option.value}>{option.label}</option>
										{/if}
									{/each}
								</select>
							</div>
						{:else if item.type === 'toggle'}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold text-white">{item.label}</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox"
											checked={getBooleanValue(group.id, item.label)}
											onchange={(e) => setControlValue(group.id, item.label, e.currentTarget.checked)}
											class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
							</div>
						{:else if item.type === 'button'}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<button onclick={item.action}
									class="w-full rounded-lg border border-white/10 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600">
									{item.label}
								</button>
							</div>
						{:else if item.type === 'color'}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">{item.label}</span>
								</div>
								<input type="color"
									value={getControlValue(group.id, item.label)}
									oninput={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
									class="h-8 w-full cursor-pointer rounded border border-white/10" />
							</div>
						{:else if item.type === 'text'}
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">{item.label}</span>
								</div>
								<textarea
									value={String(getControlValue(group.id, item.label))}
									oninput={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
									class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
									placeholder="Enter text..."
								></textarea>
							</div>
						{:else if item.type === 'range'}
							<!-- Mobile range: no number input box, saves vertical space -->
							<div class="rounded-lg p-3 hover:bg-white/5">
								<div class="mb-2 flex items-center justify-between">
									<span class="text-sm font-semibold text-white">{item.label}</span>
									<span class="text-xs text-gray-400">
										{getNumberValue(group.id, item.label).toFixed(item.step && item.step < 0.01 ? 3 : 2)}{getUnit(item.label)}
									</span>
								</div>
								<input type="range" min={item.min} max={item.max} step={item.step}
									value={getNumberValue(group.id, item.label)}
									oninput={(e) => setControlValue(group.id, item.label, parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
							</div>
						{/if}
					{/each}
				{/if}

			{/if}
		{/each}
	</div>

	<!-- Mobile action buttons — pinned to bottom -->
	<div class="shrink-0 flex flex-col gap-2 border-t border-white/10 bg-gray-900/80 px-3 py-3">
		<div class="flex gap-2">
			<button onclick={resetAll}
				class="flex-1 rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700/50 disabled:opacity-50"
				disabled={$threeJsState.isCapturing}>
				🔄 Reset All
			</button>
			<div class="tooltip" data-tip="Professional 3D encoding takes 10-15 min but saves you HOURS of manual work">
			<button onclick={handleCapture}
				class="flex-1 rounded-lg border border-white/10 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
				disabled={$threeJsState.isCapturing || !$videoState.isVideoLoaded}>
				{#if $threeJsState.isCapturing}
					🎥 Capturing...
				{:else}
					🎬 Capture & Download
				{/if}
			</button>
			</div>
		</div>
		{#if $enhancedContentState.saveStatus}
			<div class="alert py-2 alert-success"><p class="text-sm">{$enhancedContentState.saveStatus}</p></div>
		{/if}
		{#if $enhancedContentState.saveError}
			<div class="alert py-2 alert-error"><p class="text-sm">{$enhancedContentState.saveError}</p></div>
		{/if}
	</div>
</div>


<!-- ╔══════════════════════════════════════════════════════════╗ -->
<!-- ║  DESKTOP LAYOUT — original accordions, untouched        ║ -->
<!-- ╚══════════════════════════════════════════════════════════╝ -->
<div class="hidden lg:flex w-full flex-col gap-3 overflow-y-auto lg:w-96">
	<div class="flex flex-col gap-2 overflow-y-auto pr-2" style="max-height: calc(100vh - 200px);">
		{#each controlGroups as group (group.id)}
			<div class="rounded-lg border border-white/10 bg-gray-800/50">
				<details class="group">
					<summary class="flex cursor-pointer items-center justify-between rounded-lg px-4 py-3 text-sm font-semibold text-white hover:bg-white/5">
						<span>{group.title}</span>
						<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" class="size-5 flex-none text-gray-500 transition-transform group-open:rotate-180">
							<path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" fill-rule="evenodd" />
						</svg>
					</summary>

					<div class="px-2 pb-2">

					{#if group.id === 'sfx'}
						<!-- ── SOUND EFFECTS ─────────────────────────────── -->
						<div class="flex flex-col gap-3 p-3">

							<!-- Original audio controls -->
							<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
								<p class="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Original Audio</p>
								<div class="flex items-center justify-between mb-2">
									<span class="text-sm text-white">Mute Original</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" checked={audioStudio.originalMuted}
											onchange={(e) => audioStudioStore.setOriginalMuted(e.currentTarget.checked)}
											class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
								<div class="flex items-center justify-between mb-1">
									<span class="text-sm text-white">Volume</span>
									<span class="text-xs text-gray-400">{Math.round(audioStudio.originalVolume * 100)}%</span>
								</div>
								<input type="range" min="0" max="1" step="0.01"
									value={audioStudio.originalVolume}
									oninput={(e) => audioStudioStore.setOriginalVolume(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
							</div>

							<!-- SFX prompt + controls -->
							<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
								<p class="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Generate SFX</p>
								<textarea
									value={audioStudio.sfxPrompt}
									oninput={(e) => audioStudioStore.setSfxPrompt(e.currentTarget.value)}
									placeholder="e.g. deep cinematic space rumble with low frequency boom"
									rows="2"
									class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20 resize-none"
								></textarea>

								<!-- Volume -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">SFX Volume</span>
									<span class="text-xs text-gray-400">{Math.round(audioStudio.sfxVolume * 100)}%</span>
								</div>
								<input type="range" min="0" max="1" step="0.01"
									value={audioStudio.sfxVolume}
									oninput={(e) => audioStudioStore.setSfxVolume(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />

								<p class="mt-2 text-xs text-gray-500">Position SFX blocks on the timeline below ↓</p>
								<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Duration</span>
								<span class="text-xs text-gray-400">{audioStudio.musicDuration ?? 30}s</span>
							</div>
							<input type="range" min="5" max="300" step="5"
								value={audioStudio.musicDuration ?? 30}
								oninput={(e) => audioStudioStore.setMusicDuration(parseInt(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
								<!-- Fade In -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Fade In</span>
									<span class="text-xs text-gray-400">{audioStudio.sfxFadeIn.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max="6" step="0.1"
									value={audioStudio.sfxFadeIn}
									oninput={(e) => audioStudioStore.setSfxFadeIn(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />

								<!-- Fade Out -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Fade Out</span>
									<span class="text-xs text-gray-400">{audioStudio.sfxFadeOut.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max="6" step="0.1"
									value={audioStudio.sfxFadeOut}
									oninput={(e) => audioStudioStore.setSfxFadeOut(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />

								<!-- Loop -->
								<div class="mt-3 flex items-center justify-between mb-3">
									<span class="text-sm text-white">Loop</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" checked={audioStudio.sfxLoop}
											onchange={(e) => audioStudioStore.setSfxLoop(e.currentTarget.checked)}
											class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
								<div class="flex items-center justify-between mb-3">
									<span class="text-sm text-white">Suppress Original Audio</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" checked={audioStudio.sfxSuppressOriginal}
											onchange={(e) => audioStudioStore.setSfxSuppressOriginal(e.currentTarget.checked)}
											class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-red-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>
								{#if audioStudio.sfxError}
									<p class="text-xs text-red-400 mb-2">{audioStudio.sfxError}</p>
								{/if}

								<!-- Action buttons -->
								<div class="flex gap-2">
									<button onclick={handleGenerateSfx}
										disabled={audioStudio.sfxGenerating || !audioStudio.sfxPrompt.trim()}
										class="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
										{audioStudio.sfxGenerating ? '⏳ Generating...' : '🔊 Generate & Preview'}
									</button>
									{#if audioStudio.sfxSessionId}
										<button onclick={() => audioStudioStore.regenerateSfx(handleGenerateSfx)}
											title="Regenerate" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											🔄
										</button>
										<button onclick={() => audioStudioStore.downloadSfx()}
											title="Download" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											⬇️
										</button>
										<button onclick={() => audioStudioStore.stopSfx()}
											title="Remove" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											✕
										</button>
									{:else if audioStudio.sfxGenerating}
										<button onclick={() => audioStudioStore.stopSfx()}
											title="Cancel" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											✕
										</button>
									{/if}
								</div>
								<label class="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-gray-700/40 px-3 py-2 text-sm text-gray-300 hover:border-white/40 hover:text-white">
									📁 {audioStudio.sfxFileName ?? 'Upload SFX File'}
									<input type="file" accept="audio/*" class="hidden" onchange={handleUploadSfx} />
								</label>
								{#if audioStudio.sfxSessionId}
									<p class="mt-2 text-xs text-green-400">✅ {audioStudio.sfxFileName ?? 'SFX active'} — will be baked into export</p>
								{/if}
							</div>
						</div>

					{:else if group.id === 'music'}
						<!-- ── MUSIC ──────────────────────────────────────── -->
						<div class="flex flex-col gap-3 p-3">
							<div class="rounded-lg border border-white/10 bg-gray-700/50 p-3">
								<p class="mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Generate Music</p>
								<textarea
									value={audioStudio.musicPrompt}
									oninput={(e) => audioStudioStore.setMusicPrompt(e.currentTarget.value)}
									placeholder="e.g. epic orchestral cinematic space adventure, sweeping strings"
									rows="2"
									class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20 resize-none"
								></textarea>

								<!-- Volume -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Music Volume</span>
									<span class="text-xs text-gray-400">{Math.round(audioStudio.musicVolume * 100)}%</span>
								</div>
								<input type="range" min="0" max="1" step="0.01"
									value={audioStudio.musicVolume}
									oninput={(e) => audioStudioStore.setMusicVolume(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />

								<!-- Start Time -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Start Time</span>
									<span class="text-xs text-gray-400">{audioStudio.musicStartTime.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max={musicMaxTime} step="0.1"
									value={audioStudio.musicStartTime}
									oninput={(e) => audioStudioStore.setMusicStartTime(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />

								<!-- End Time -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">End Time</span>
									<span class="text-xs text-gray-400">{audioStudio.musicEndTime.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max={musicMaxTime} step="0.1"
									value={audioStudio.musicEndTime}
									oninput={(e) => audioStudioStore.setMusicEndTime(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
								<div class="mt-3 mb-1 flex items-center justify-between">
								<span class="text-sm text-white">Duration</span>
								<span class="text-xs text-gray-400">{audioStudio.musicDuration ?? 30}s</span>
							</div>
							<input type="range" min="5" max="300" step="5"
								value={audioStudio.musicDuration ?? 30}
								oninput={(e) => audioStudioStore.setMusicDuration(parseInt(e.currentTarget.value))}
								class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />
								<!-- Fade In -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Fade In</span>
									<span class="text-xs text-gray-400">{audioStudio.musicFadeIn.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max="6" step="0.1"
									value={audioStudio.musicFadeIn}
									oninput={(e) => audioStudioStore.setMusicFadeIn(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />

								<!-- Fade Out -->
								<div class="mt-3 flex items-center justify-between mb-1">
									<span class="text-sm text-white">Fade Out</span>
									<span class="text-xs text-gray-400">{audioStudio.musicFadeOut.toFixed(1)}s</span>
								</div>
								<input type="range" min="0" max="6" step="0.1"
									value={audioStudio.musicFadeOut}
									oninput={(e) => audioStudioStore.setMusicFadeOut(parseFloat(e.currentTarget.value))}
									class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-purple-500" />

									<div class="flex items-center justify-between mb-3 mt-3">
									<span class="text-sm text-white">Suppress Original Audio</span>
									<label class="relative inline-flex cursor-pointer items-center">
										<input type="checkbox" checked={audioStudio.musicSuppressOriginal}
											onchange={(e) => audioStudioStore.setMusicSuppressOriginal(e.currentTarget.checked)}
											class="peer sr-only" />
										<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-red-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
									</label>
								</div>

								{#if audioStudio.musicError}
									<p class="text-xs text-red-400 mb-2 mt-3">{audioStudio.musicError}</p>
								{/if}

								<!-- Upload local audio file -->
								<div class="mt-3">
									<label class="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
										📁 {audioStudio.musicFileName ?? 'Upload Audio File'}
										<input type="file" accept="audio/*" onchange={handleUploadMusic} class="hidden" />
									</label>
								</div>
								<div class="my-2 flex items-center gap-2">
									<div class="flex-1 border-t border-white/10"></div>
									<span class="text-xs text-gray-500">or generate</span>
									<div class="flex-1 border-t border-white/10"></div>
								</div>

								<!-- Action buttons -->
								<div class="flex gap-2">
									<button onclick={handleGenerateMusic}
										disabled={audioStudio.musicGenerating || !audioStudio.musicPrompt.trim()}
										class="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50">
										{audioStudio.musicGenerating ? '⏳ Generating...' : '🎵 Generate & Preview'}
									</button>
									{#if audioStudio.musicSessionId}
										<button onclick={() => audioStudioStore.regenerateMusic(handleGenerateMusic)}
											title="Regenerate" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											🔄
										</button>
										<button onclick={() => audioStudioStore.downloadMusic()}
											title="Download" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											⬇️
										</button>
										<button onclick={() => audioStudioStore.stopMusic()}
											title="Remove" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											✕
										</button>
									{:else if audioStudio.musicGenerating}
										<button onclick={() => audioStudioStore.stopMusic()}
											title="Cancel" class="rounded-lg border border-white/10 bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600">
											✕
										</button>
									{/if}
								</div>

								{#if audioStudio.musicSessionId}
									<p class="mt-2 text-xs text-green-400">✅ {audioStudio.musicFileName ?? 'Music active'} — will be baked into export</p>
								{/if}
							</div>
						</div>

						{:else}
							<!-- ── STANDARD CONTROLS ──────────────────────────── -->
							{#each group.items as item (item.label)}
								{#if item.type === 'text-mode-toggle'}
									<div class="rounded-lg p-3">
										<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Text Mode</p>
										<div class="flex gap-2">
											<button
												onclick={() => text3DState.setTextMode('troika')}
												class="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors {$text3DState.textMode === 'troika' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
											>Google Fonts / 2.5-D</button>
											<button
												onclick={() => text3DState.setTextMode('true3d')}
												class="flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors {$text3DState.textMode === 'true3d' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}"
											>True 3D</button>
										</div>
									</div>
								{:else if item.type === 'component'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										{#if item.component}
											<item.component {...(item.componentProps as any)} />
										{/if}
									</div>
								{:else if item.type === 'select'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm font-semibold text-white">{item.label}</span>
										</div>
										<select
											value={getControlValue(group.id, item.label)}
											onchange={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
											class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20"
										>
											{#each item.options || [] as option (typeof option === 'string' ? option : option.value)}
												{#if typeof option === 'string'}
													<option value={option}>{(option as string).charAt(0).toUpperCase() + (option as string).slice(1)}</option>
												{:else}
													<option value={option.value}>{option.label}</option>
												{/if}
											{/each}
										</select>
									</div>
								{:else if item.type === 'toggle'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="flex items-center justify-between">
											<span class="text-sm font-semibold text-white">{item.label}</span>
											<label class="relative inline-flex cursor-pointer items-center">
												<input type="checkbox"
													checked={getBooleanValue(group.id, item.label)}
													onchange={(e) => setControlValue(group.id, item.label, e.currentTarget.checked)}
													class="peer sr-only" />
												<div class="peer h-6 w-11 rounded-full bg-gray-700 peer-checked:bg-blue-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
											</label>
										</div>
									</div>
								{:else if item.type === 'button'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<button onclick={item.action}
											class="w-full rounded-lg border border-white/10 bg-gray-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-600">
											{item.label}
										</button>
									</div>
								{:else if item.type === 'color'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm font-semibold text-white">{item.label}</span>
										</div>
										<input type="color"
											value={getControlValue(group.id, item.label)}
											oninput={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
											class="h-8 w-full cursor-pointer rounded border border-white/10" />
									</div>
								{:else if item.type === 'text'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm font-semibold text-white">{item.label}</span>
										</div>
										<textarea
											value={String(getControlValue(group.id, item.label))}
											oninput={(e) => setControlValue(group.id, item.label, e.currentTarget.value)}
											class="w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-sm text-white outline-none focus:border-white/20"
											placeholder="Enter text..."
										></textarea>
									</div>
								{:else if item.type === 'range'}
									<div class="rounded-lg p-3 hover:bg-white/5">
										<div class="mb-2 flex items-center justify-between">
											<span class="text-sm font-semibold text-white">{item.label}</span>
											<span class="text-xs text-gray-400">
												{getNumberValue(group.id, item.label).toFixed(item.step && item.step < 0.01 ? 3 : 2)}{getUnit(item.label)}
											</span>
										</div>
										<input type="range" min={item.min} max={item.max} step={item.step}
											value={getNumberValue(group.id, item.label)}
											oninput={(e) => setControlValue(group.id, item.label, parseFloat(e.currentTarget.value))}
											class="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-blue-500" />
										<input type="number" min={item.min} max={item.max} step={item.step}
											value={getNumberValue(group.id, item.label)}
											onchange={(e) => setControlValue(group.id, item.label, parseFloat(e.currentTarget.value))}
											class="mt-2 w-full rounded border border-white/10 bg-gray-700 px-2 py-1 text-xs text-white outline-none focus:border-white/20" />
									</div>
								{/if}
							{/each}
						{/if}

					</div>
				</details>
			</div>
		{/each}
	</div>

	<!-- ACTION BUTTONS (desktop) -->
	<div class="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4">
		<button onclick={resetAll}
			class="rounded-lg border border-white/10 bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700/50 disabled:opacity-50"
			disabled={$threeJsState.isCapturing}>
			🔄 Reset All
		</button>
		<div class="tooltip rounded-lg w-full" data-tip="Professional 3D encoding takes 10-15 min but saves you HOURS of manual work">
		<button onclick={handleCapture}
			class="rounded-lg w-full border border-white/10 bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
			disabled={$threeJsState.isCapturing || !$videoState.isVideoLoaded}>
			{#if $threeJsState.isCapturing}
				🎥 Capturing...
			{:else}
				🎬 Capture & Download
			{/if}
		</button>
		</div>
		{#if $enhancedContentState.saveStatus}
			<div class="alert py-2 alert-success"><p class="text-sm">{$enhancedContentState.saveStatus}</p></div>
		{/if}
		{#if $enhancedContentState.saveError}
			<div class="alert py-2 alert-error"><p class="text-sm">{$enhancedContentState.saveError}</p></div>
		{/if}
	</div>
</div>

<!-- Music-ready toast — fixed to bottom-center, auto-dismisses after 6s -->
{#if showMusicToast}
	<div class="toast toast-bottom toast-center z-[200]">
		<div class="alert alert-info shadow-lg flex items-center gap-3">
			<span class="text-xl">🎵</span>
			<div>
				<p class="font-semibold text-sm">Music is ready!</p>
				<p class="text-xs opacity-80">Hit play on the video to hear it in sync.</p>
			</div>
			<button
				onclick={() => { showMusicToast = false; }}
				class="btn btn-xs btn-ghost ml-2"
				aria-label="Dismiss"
			>✕</button>
		</div>
	</div>
{/if}

<style>
	::-webkit-scrollbar { width: 8px; }
	::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); border-radius: 4px; }
	::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 4px; }
	::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
	summary::-webkit-details-marker { display: none; }
</style>
