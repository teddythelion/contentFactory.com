<!-- src/routes/dev/particle-bench/+page.svelte -->
<!-- Standalone benchmark — NOT wired into the real editor or particle store.
     Tests the actual cost driver for the "3D shapes + tracer trails" feature:
     InstancedMesh with real geometry (vs. the current flat Points sprites),
     at varying particle counts and trail lengths.

     Two separate numbers, because they answer different questions:
     - Live FPS: how it feels to scrub/preview in the editor.
     - Capture simulation: how long an actual export will take. Capture is
       offline (render → gl.finish() → read pixels per frame, from
       videoCapture.ts), so it doesn't need to hit 30fps live — what matters
       is total wall-clock time for N frames of footage.

     Determinism: trail echoes are NOT a rolling buffer of past frames.
     Each echo re-evaluates the exact same deterministic position function at
     T - k*dt. That means trail state is correct under arbitrary seeks, not
     just sequential playback — consistent with how the real capture loop
     (and any future timeline scrubbing) will call this. -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import * as THREE from 'three';

	let canvasEl: HTMLCanvasElement;
	let renderer: THREE.WebGLRenderer;
	let scene: THREE.Scene;
	let camera: THREE.PerspectiveCamera;
	let layers: THREE.InstancedMesh[] = [];
	let animationId: number;
	let destroyed = false;

	let particleCount = $state(5000);
	let trailCount = $state(4);
	let running = $state(true);

	let liveFps = $state(0);
	let frameTimes: number[] = [];

	interface CaptureResult {
		particleCount: number;
		trailCount: number;
		frames: number;
		footageSeconds: number;
		wallSeconds: number;
		avgMsPerFrame: number;
	}
	let results = $state<CaptureResult[]>([]);
	let capturing = $state(false);
	let capturePct = $state(0);

	const BOUND = 8; // half-extent of the bounce volume

	// Pure function of time — no accumulated state. This is what makes both
	// live playback and arbitrary-seek scrubbing produce identical output.
	function computePosition(out: THREE.Vector3, particleIndex: number, t: number) {
		const phaseX = particleIndex * 0.31;
		const phaseY = particleIndex * 0.71;
		const phaseZ = particleIndex * 1.13;
		const speed = 0.6 + (particleIndex % 7) * 0.05;
		// Triangle wave (closed-form bounce, no integration needed)
		const tri = (x: number) => Math.abs(((x % 2) + 2) % 2 - 1) * 2 - 1;
		out.set(
			tri(t * speed + phaseX) * BOUND,
			tri(t * speed * 0.8 + phaseY) * BOUND,
			tri(t * speed * 1.2 + phaseZ) * BOUND
		);
	}

	function buildLayers(count: number, trails: number) {
		for (const l of layers) {
			scene.remove(l);
			l.geometry.dispose();
			(l.material as THREE.Material).dispose();
		}
		layers = [];

		const geometry = new THREE.OctahedronGeometry(0.12);
		const dummy = new THREE.Object3D();
		const color = new THREE.Color();

		for (let k = 0; k <= trails; k++) {
			const opacity = k === 0 ? 1 : Math.max(0.03, 1 - k / (trails + 1));
			const material = new THREE.MeshStandardMaterial({
				transparent: true,
				opacity,
				depthWrite: k === 0
			});
			const mesh = new THREE.InstancedMesh(geometry, material, count);
			mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
			for (let i = 0; i < count; i++) {
				color.setHSL((i / count) % 1, 0.65, 0.55);
				mesh.setColorAt(i, color);
			}
			scene.add(mesh);
			layers.push(mesh);
		}
	}

	function updateLayers(t: number) {
		const dummy = new THREE.Object3D();
		const pos = new THREE.Vector3();
		const dt = 0.045; // spacing between echo samples, seconds

		for (let k = 0; k < layers.length; k++) {
			const layer = layers[k];
			const sampleT = t - k * dt;
			for (let i = 0; i < particleCount; i++) {
				computePosition(pos, i, sampleT);
				dummy.position.copy(pos);
				dummy.rotation.set(sampleT + i, sampleT * 0.7 + i, 0);
				dummy.updateMatrix();
				layer.setMatrixAt(i, dummy.matrix);
			}
			layer.instanceMatrix.needsUpdate = true;
		}
	}

	function animate() {
		if (destroyed) return;
		animationId = requestAnimationFrame(animate);
		if (!running) return;

		const now = performance.now();
		frameTimes.push(now);
		while (frameTimes.length > 60) frameTimes.shift();
		if (frameTimes.length > 1) {
			const dt = (frameTimes[frameTimes.length - 1] - frameTimes[0]) / (frameTimes.length - 1);
			liveFps = Math.round(1000 / dt);
		}

		updateLayers(now * 0.001);
		renderer.render(scene, camera);
	}

	async function runCaptureSimulation() {
		if (capturing) return;
		capturing = true;
		capturePct = 0;
		running = false; // pause live loop so it doesn't fight the timed loop

		const fps = 30;
		const footageSeconds = 10;
		const frames = fps * footageSeconds;
		const gl = renderer.getContext();

		const start = performance.now();
		for (let i = 0; i < frames; i++) {
			const T = i / fps;
			updateLayers(T);
			renderer.render(scene, camera);
			gl.finish(); // matches the real capture loop's per-frame GPU sync
			if (i % 10 === 0) {
				capturePct = Math.round((i / frames) * 100);
				await new Promise((r) => setTimeout(r, 0)); // yield so the UI can repaint
			}
		}
		const wallSeconds = (performance.now() - start) / 1000;

		results = [
			...results,
			{
				particleCount,
				trailCount,
				frames,
				footageSeconds,
				wallSeconds,
				avgMsPerFrame: (wallSeconds * 1000) / frames
			}
		];

		capturing = false;
		capturePct = 100;
		running = true;
	}

	onMount(() => {
		scene = new THREE.Scene();
		scene.background = new THREE.Color(0x0a0a0f);

		camera = new THREE.PerspectiveCamera(60, canvasEl.clientWidth / canvasEl.clientHeight, 0.1, 100);
		camera.position.set(0, 0, 22);

		renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, preserveDrawingBuffer: true });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);

		scene.add(new THREE.AmbientLight(0xffffff, 1.0));
		const dir = new THREE.DirectionalLight(0xffffff, 1.5);
		dir.position.set(5, 5, 5);
		scene.add(dir);

		buildLayers(particleCount, trailCount);
		animate();

		const onResize = () => {
			if (!canvasEl) return;
			camera.aspect = canvasEl.clientWidth / canvasEl.clientHeight;
			camera.updateProjectionMatrix();
			renderer.setSize(canvasEl.clientWidth, canvasEl.clientHeight, false);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	onDestroy(() => {
		destroyed = true;
		if (animationId) cancelAnimationFrame(animationId);
		for (const l of layers) {
			l.geometry.dispose();
			(l.material as THREE.Material).dispose();
		}
		renderer?.dispose();
	});

	function rebuild() {
		if (!scene) return;
		buildLayers(particleCount, trailCount);
	}
</script>

<svelte:head><title>Particle Bench (dev)</title></svelte:head>

<div class="relative h-screen w-screen overflow-hidden bg-black">
	<canvas bind:this={canvasEl} class="h-full w-full"></canvas>

	<div class="absolute left-4 top-4 flex w-80 flex-col gap-3 rounded-lg bg-black/70 p-4 text-sm text-white backdrop-blur">
		<h1 class="text-base font-bold">Particle Bench</h1>

		<label class="flex flex-col gap-1">
			Particle count: {particleCount.toLocaleString()}
			<input type="range" min="500" max="30000" step="500" bind:value={particleCount} onchange={rebuild} class="range range-xs" />
		</label>

		<label class="flex flex-col gap-1">
			Trail echoes: {trailCount}
			<input type="range" min="0" max="10" step="1" bind:value={trailCount} onchange={rebuild} class="range range-xs" />
		</label>

		<p class="opacity-70">Live FPS: <span class="font-mono font-bold">{liveFps}</span></p>

		<button class="btn btn-sm btn-primary" onclick={runCaptureSimulation} disabled={capturing}>
			{capturing ? `Simulating capture… ${capturePct}%` : 'Run capture simulation (10s @ 30fps)'}
		</button>

		{#if results.length > 0}
			<div class="mt-2 max-h-64 overflow-y-auto border-t border-white/20 pt-2">
				<p class="mb-1 font-bold">Results</p>
				{#each results as r, i (i)}
					<p class="font-mono text-xs opacity-80">
						{r.particleCount.toLocaleString()}p × {r.trailCount} trail —
						{r.wallSeconds.toFixed(2)}s wall / {r.footageSeconds}s footage
						({r.avgMsPerFrame.toFixed(1)}ms/frame)
					</p>
				{/each}
			</div>
		{/if}
	</div>
</div>
