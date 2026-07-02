# Onboarding — read first

## Who you're working with

- **Ted De Leon**, solo founder of **Delion AI Labs**. Credit him as Ted De Leon.
- The account email (`jameshaas959@gmail.com`) belonged to Ted's late best friend .

## How Ted works (follow this exactly)

- **Terse, actionable only.** Code, technical steps, and direct answers to explicit questions. No banter, no preamble, no "here's what I did" recaps, no explanations unless he asks (he will ask when confused). He's on Opus and cost-conscious — ~36% of past spend was banter/explanation he didn't want.
- **Reference files by path / clickable links, never paste contents** — pasting whole files burns his tokens. Ask for a path and read it with tools. Screenshots for visual/error context are fine and expected.
- When you act, act — don't re-ask things already decided.

## Big picture

- **Pre-revenue, needs revenue urgently.** Treat speed-to-revenue as the priority.
- Two products:
  - **ailaboratory.site** — Next.js marketing site / B2B funnel (separate repo, in good shape: hero converts, SEO infra, FAQ schema, live Resend lead capture). Transactional intent + E-E-A-T play; the 5-phase process is given away openly as the trust hook.
  - **ContentFactory** (contentfactory.studio) — THIS project. Live AI content-creation platform; both a revenue play and proof of what Ted ships.

## ContentFactory — what it is

### Project Guide: contentfactory.studio

### Stack & Tools

- **Frontend:** [SvelteKit](https://svelte.dev/docs/kit), TypeScript, Tailwind CSS
- **Graphics:** Three.js (WebGL, heavy asset management)
- **Backend/Storage:** [Google Cloud](https://cloud.google.com/), Firebase Firestore, Google Cloud Storage (GCS)
- **APIs:** Claude API, Gemini (Nano Banana, Veo 3.1 Fast/Lite/Generate), ElevenLabs (Voice/Music)

### Code Conventions

- Use Svelte 5 runes if applicable, otherwise strict Svelte script structures.
- TypeScript: No `any`. Explicit typing for all API payloads and Three.js vectors/scenes.
- Componentize Three.js logic to prevent massive file contexts. Keep shaders separate.
- Always clean up Three.js geometries, textures, and materials in `onDestroy` to prevent memory leaks.

### Optimization & Costs

- Do not read media files (`.mp3`, `.glb`, etc.). Mock their metadata or paths when writing logic.
- Keep system instructions brief. Rely on modular schema definitions for external AI endpoints.
- **SvelteKit** (App Router), JS, **DaisyUI (Dracula theme)**.
- AI media pipeline: **Genai/ Veo 3.1** (video), **Gemini Nano Banana**(images), **Anthropic Claude** (reasoning / prompt engineer), **ElevenLabs** (audio), **Three.js + Troika** (3D effects/text), **FFmpeg** (server-side video processing, WASM + Node).
- Routes: `/` (AI chat creative assistant), `/texttoimage`, `/imageedit` (3D enhancement), `/texttovideo`. State via Svelte stores (video, threeJs, text3d). Server endpoints under `/api`.
- There was a planned **workflow system** (prompt-coach component, `workflow.store.ts`, Create→Refine→Animate guidance, Anthropic-backed `/api/prompt-coach`) — confirm with Ted what landed before building on it.

## Current phase (why you're here)

Production readiness: **VPS prep, GCP + Firestore checks, copy.** Verify before touching code — actual state may differ from the above; read the repo.

## Anthropic API note

For anything calling Claude/Anthropic (model IDs, pricing, the prompt-coach, tool use), use the **claude-api skill** and latest models (e.g. `claude-opus-4-8`) — don't answer LLM questions from memory; APIs have drifted.
