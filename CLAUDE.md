# Onboarding — read first

## Who you're working with

- **Ted De Leon**, solo founder of **Delion AI Labs**. Credit him as Ted De Leon.
- The account email (`jameshaas959@gmail.com`) belonged to Ted's late best friend.

## How Ted works (follow this exactly)

- **Terse, actionable only.** Code, technical steps, direct answers. No banter, no preamble, no recaps unless he asks (he will ask when confused). Cost-conscious.
- **Reference files by path / clickable links, never paste contents.** Screenshots and console dumps from him are expected — read them carefully, they usually contain the answer.
- When you act, act — don't re-ask things already decided.
- He uses talk-to-text; parse intent through the grammar.
- `bypassPermissions` is enabled in `.claude/settings.local.json` — you run without prompts. He keeps backups, but check before destructive ops anyway.
- **Debugging protocol that works with him:** when a bug is "recurring," suspect an invisible failure (swallowed `.catch()`, silent regex miss, silent fallback). Make failures loud first (console warnings with emoji markers: ⚠️ 🔇 ✅ — he watches the console), then fix. Never leave an empty `.catch(() => {})` in this codebase.

## Big picture

- **Pre-revenue, needs revenue urgently.** Speed-to-revenue is priority.
- **ailaboratory.site** — separate Next.js marketing repo, in good shape.
- **ContentFactory** (contentfactory.studio) — THIS project. Live AI content-creation platform.

---

# ContentFactory — technical handoff

## Stack

SvelteKit (Svelte 5 runes in newer components, legacy `$:` in older ones — both exist; ThreeJsScene.svelte is legacy mode, TimelineEditor.svelte is runes), TypeScript (no `any`), Tailwind + DaisyUI (Dracula), Three.js + Troika, Firebase/Firestore + GCS (permanent storage), server FFmpeg. AI: Veo 3.1 (video), Nano Banana (images), Claude (prompt engineer), ElevenLabs (audio). Don't read media files (`.mp3`, `.glb`…) — mock metadata/paths. Clean up Three.js geometries/textures/materials on destroy.

**Deploy flow:** build local → push GitHub → pull on VPS → `pnpm install` → pm2 (`ecosystem.config.cjs`, `BODY_SIZE_LIMIT=500MB`).

## Toolchain gotchas (each of these burned a session)

- **pnpm, NEVER npm.** `npm install` crashes on the pnpm-style `node_modules` (arborist "Cannot read properties of null"). Always `pnpm add`.
- **svelte-check has 10 pre-existing errors + ~75 warnings.** Known noise: Stripe `apiVersion` pins (3 files), `THREE.Font` (ThreeJSEnhancer.svelte), `ControlsPanel` `item.action` (×2), generateMusic `Readable.from`, ThreeJsScene `compositeLayout = mode`. Your work must add **zero new errors** — verify with `npx svelte-check --tsconfig ./tsconfig.json --threshold error` and compare against 10.
- **Local ffmpeg is FFmpeg 4.1 (2018)** from `@ffmpeg-installer`; the VPS has a newer one. Things can work on VPS and break locally (and vice versa). Never use post-4.1 filter options — `adelay=N:all=1` broke; use `aformat=channel_layouts=stereo` + `adelay=N|N`. Long-term fix: set `FFMPEG_PATH` env to a modern build.
- **Two enhancer stacks with confusable names:** `src/lib/components/ThreeJSEnhancer.svelte` (legacy, image enhancer) vs `src/lib/components/ThreeJsEnhancer/` folder (the video editor: ThreeJsEnhancer.svelte → ThreeJsScene.svelte + TimelineEditor.svelte + ControlsPanel.svelte + MediaBin.svelte). `/create` mounts them mutually exclusively. Stack traces tell you which fired.

## The capture/export pipeline (heart of the product — most-touched code)

**Client:** `src/lib/utils/videoCapture.ts`. Deterministic offline capture — simulation clock decoupled from wall clock: frame i rendered at `T = i/fps` (fps=30), per-frame seek of main + secondary videos, `__timelineEditTime` published, `drawComposite()`, `updateScene(T)`, render, `gl.finish()`. That loop (`prepareFrame`) is sink-agnostic — **do not touch it when changing how pixels leave the machine.**

Two pluggable sinks:

1. **WebCodecs (primary):** hardware H.264 in-browser (`VideoEncoder` + `mp4-muxer`), downscale to CSS resolution and video fade-in/out **baked client-side**, one mp4 upload to `/api/uploadCapturedVideo` → `capture-{sessionId}.mp4`. Encode request carries `preEncoded: true` → server skips Pass 1 entirely, does `-c:v copy` + audio mux only (seconds, not minutes). This exists because the VPS is weak and can't be upgraded — **never move pixel work back to the server.**
2. **JPEG batches (fallback):** auto-used if WebCodecs is unsupported or errors (the whole capture reruns on this path). Uploads are **sequential await-per-batch on purpose** — a parallelized version + server frame-gap check caused a cascade and was rolled back (that version survives on branch `pre-rollback-snapshot-2026-07-07` and a patch in `Documents\dev\_patches\`).

**Server:** `src/routes/api/encodeFromBatches/+server.ts`. Pass 1 (x264 from JPEGs — skipped when preEncoded) → Pass 2 audio mux → GCS upload → Firestore `content` doc → temp cleanup. Job status via in-memory `jobStore`; client polls.

**Audio mux inputs (Pass 2)** — all optional, mixed with `amix`:

- `audioSessionId` — legacy whole-file original audio (only for the trivial single-untrimmed-clip layout)
- `clipAudios[]` — per-clip original/secondary audio windows (`audio-{id}.aac`): aformat→atrim→asetpts→volume→afades→adelay
- `musicClips[]` — **every** timeline music track incl. voiceover (`music-{id}.mp3`), same chain. When present the client nulls legacy `musicSessionId` (else double-mux). Added because the legacy single `musicSessionId` silently dropped every music track except the active one (the "missing voiceover" bug).
- `sfxInstances` + `sfxSessionId`, per-instance adelay.

**Capture gotchas already solved — don't reintroduce:**

- The compositor (`updateCompositeFrame` in ThreeJsScene) draws a mid-seek video layer's **last decoded frame** (seeks dip `readyState` below 2 — dropping the layer painted black and strobed playthrough/export). It only drops elements that aren't seeking AND have nothing decoded (🫥 warning, throttled 1/s). The ended main element is no longer special-cased — time-aware clip coverage (end tolerance 0.001s) decides visibility, so a clip's fade-out tail draws to its final frame and a finished clip can't stomp the next one. The tick's drift-resync (>0.3s) has a 600ms/element cooldown (🔁 warning) — without it a proxy-backed clip whose seeks are slower than the drift threshold reseeks every frame = seek storm. Capture seek timeouts are 5s (main in videoCapture, secondaries in `__threeJsSeekSecondaries`) with ⚠️ warnings; a timed-out capture seek now exports a stale frame instead of a blank one. The WebCodecs encoder **competes with video decode on Ted's iGPU** — that contention is why seeks got slow.
- `preserveDrawingBuffer: true` on the renderer is load-bearing for both sinks.
- **The composite canvas must be filled OPAQUE BLACK each frame, never clearRect-only.** Canvas→WebGL texture upload un-premultiplies alpha and the mesh material is opaque (alpha ignored): any final pixel with alpha < 1 uploads at full RGB brightness + quantization noise. This silently killed per-clip fades once (fade looked like "pixelation" while scrubbing, abrupt cut on playthrough). globalAlpha fades only work because they blend against the opaque base inside the canvas.
- H.264 needs even dimensions — `outWidth/outHeight` are floored to even.
- The mp4 from mp4-muxer shows `handler_name: mp4-muxer-hdlr` in ffmpeg logs — that's how you confirm the WebCodecs path actually ran.

## Timeline editor / preview audio (recurring-bug minefield)

- Secondary videos are detached `<video>` elements in the `secondaryVideoElements` map (ThreeJsScene), created **muted** with `preload='auto'`; TimelineEditor's rAF tick unmutes/volumes them per track (M/vol buttons) and starts/reseeks/pauses them against `editTime`. The tick has a `pendingPlay` guard and **no readyState gate** — the gate caused the "secondary clips randomly silent" bug five times (a detached element can park at readyState 1 forever). Play failures log `🔇`; if silence recurs the console now names the cause. Do NOT re-add silent catches.
- `/api/extractAudio` at clip-add time decides **export** audio for secondaries (asset.sessionId); its failure logs 🔇 and the clip exports silent. Preview audio is the element itself — the two are independent systems.
- Playback engine: the main video element owns the transport; `editTime` = manualCursor ?? sourceToTimeline(currentTime); gaps traversed by manual rAF. `__threeJsCapturing` disables all preview logic during capture — the capture loop owns everything.
- ~~Known unfixed bug: armed-asset placement silent no-op~~ **Fixed 7-13-2026:** `handleTrackClick` insertClips for the same asset / creates a new track at the drop position otherwise. Clicking empty track space with nothing armed now deselects the focused clip.
- **Per-clip editing (added 7-13-2026):** clip focus lives in `timelineStore.activeClipId` (set on clip mousedown; cleared by Escape / empty-row click / delete). ControlsPanel's "Selected Clip" panel edits the focused clip only: `fadeIn/fadeOut` on any video/image clip, plus `transform` (x/y %, scale, rotation, opacity) on image clips. The compositor applies fade alpha per layer and draws image clips as positioned **overlays** (they no longer fill layout slots) — both bake into export through the shared draw path; export audio fades ride `clipAudios[].fadeIn/fadeOut` (a faded single main clip is no longer "trivial"). In `single` layout, covering layers stack bottom-up → overlapping clips on two tracks **crossfade**.
- **Undo/redo:** `src/lib/stores/editHistory.store.ts` — Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z, context menu, header ↶↷. 50 snapshots of {tracks, musicEntries, sfxInstances}. Drags use `beginGesture()`/`endGesture()` (commit only if state changed — a plain click must NOT become an undo step); instantaneous ops (delete/split/paste/place) use `checkpoint()`. Drag starters ignore non-left mouse buttons (right-click used to push a phantom checkpoint that made menu-Undo a no-op). History clears per new main video.
- **Transitions (added 7-14-2026):** `src/lib/utils/clipTransitions.ts` — 21 xfade-style effects (wipes, slides, circle open/close, clock wipe, dissolve, pixelize, blur, fade white/gray…) implemented as Canvas 2D draw state (Path2D clips, offsets, ctx.filter, alpha), applied by the compositor's `drawLayer`/`drawImageClip`. Per clip: `fadeIn/fadeOut` = duration, `transitionIn/transitionOut` = style (default 'fade'). **No FFmpeg xfade anywhere** — server-side xfade would need separate input files, load the weak VPS, and desync preview from export; the compositor path bakes transitions into both automatically. Export audio still fades linearly over the same window via `clipAudios`.
- **Stale-defaults fix:** `logoState` (was never reset — the "old image still there" bug) and `audioStudioStore` fully reset when the editor unmounts (ThreeJsEnhancer cleanup). Time-based control maxes (logo start/end, text appear/disappear, music start/end) are dynamic from actual timeline length — the 600s sliders are gone.
- Multiple music tracks live in `audioStudio.musicEntries` (keyed by sessionId) + timeline tracks carrying `assetSessionId`; the flat `musicSessionId/musicVolume/...` fields are the _active_ entry only. Preview mixing is Tone.js (`audioMixer.ts`).

## Ted's machine (affects debugging judgment)

Intel UHD 630 iGPU, driver frozen on Intel's legacy branch (31.0.101.2141 is the ceiling), 2×1080p monitors. Chrome applies `exit_on_context_lost` — a GPU hiccup **kills the whole GPU process** (monitor blink, white canvases everywhere, endless "SharedImageManager non-existent mailbox" console spam). That's the machine, not the app. ThreeJsScene has `webglcontextlost/restored` handlers (preventDefault + texture re-upload + 10s "reload the page" warning). If he reports whole-screen blinking: driver/TDR — check Event Viewer 4101 before hunting app code.

## Prompt Engineer (`/api/prompt-coach`)

Uses **structured outputs** (`output_config.format` json_schema, `@anthropic-ai/sdk` ≥0.111) — the response is schema-constrained JSON `{message, prompts[], proTip, reference3d}`. This replaced regex-scraping the model's prose, which broke ~5 times from format drift. **Never parse model prose with regex in this codebase** — the legacy extractors remain only as a truncation fallback (fires with ⚠️). UI: PromptCoach.svelte renders `prompts[]` as the green boxes. For any Anthropic work: use the **claude-api skill**; model `claude-opus-4-8`; don't answer LLM/API questions from memory.

## temp storage

`temp/` locally, `/dev/shm/contentfactory` on VPS (**that's RAM**). All transient: `session-{id}/` frame dirs, `capture-{id}.mp4`, `silent-/output-{id}.mp4`, and `audio/` (extracted `audio-*.aac`, `sfx-*.mp3`, `music-*.mp3` for the _current_ editing session — deleting `audio/` silences the next export until media is re-added). Failed captures orphan session dirs — they accumulated 13GB locally and eat RAM on the VPS. Safe to delete when idle. A startup/daily sweep for stale `session-*` dirs was agreed on but **not implemented** (an untracked `src/lib/server/tempSweeper.ts` stub may exist from an old session — verify before assuming).

## Git / recovery state

- `main` @ 67ddb4a is current and clean; everything above is committed.
- Branch `pre-rollback-snapshot-2026-07-07` + `Documents\dev\_patches\0001-*.patch` hold a superseded snapshot: parallel JPEG uploads, server frame-gap check, armed-placement fix. Cherry-pick pieces deliberately; never merge wholesale.
- Ted restores backups by copying folders — after a restore, check for `src/src/` nesting (happened once; fix is moving the contents up one level).
- History note: a VS Code freeze once ate a session's work; commit messages sometimes describe more than the commit contains — `git show --stat` before trusting one.

## Current state / next likely work

- Capture pipeline: WebCodecs + multi-music export + flicker fix are in, but **the 15s extended-timeline export needs re-verification by Ted** (expect: voiceover present, both music tracks, no flicker; watch console for ⚠️ seek-timeout warnings — if they appear, the next step is pre-buffering secondaries rather than longer waits).--fixed just now 7-13-2026 12:15pm
- Phase: production readiness — VPS deploy of all this (`pnpm install` required: mp4-muxer + SDK 0.111 are new deps), GCP/Firestore checks, copy. A GCP migration to the James Haas account is pending new credentials (see auto-memory).--done
- Planned: Audio tab in the library — save generated audio only, not user uploads (see auto-memory).--done
  ted will do commits and pushes --github and vps he handles with occasional assitance for obscure or cryptic console commands.
