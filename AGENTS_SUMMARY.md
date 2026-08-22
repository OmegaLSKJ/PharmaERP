## Objective
- Build a production-quality cinematic 3D immersive landing page (per the user's MASTER PROMPT) using React Three Fiber in `C:\Users\SCL\OneDrive\Documents\Default Project`, leveraging the established MCP/3D toolchain.

## Important Details
- Project root / working dir: `C:\Users\SCL\OneDrive\Documents\Default Project`. MCP config: `opencode.json` (all servers defined).
- Stack (neither Vite nor Next present → default **Vite + React 19 + TS**; R3F v9 requires React 19): three 0.185, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3, gsap, tailwindcss 3, zustand. shadcn already a devDep.
- **Hero asset is now real**: generated procedurally in Blender (Blender 5.2.0 LTS, MCP connected) — a displaced icosahedron "crystal" core + 3 orbiting accent rings + inner glow sphere — exported to `public/models/hero/hero.glb` (3 material groups, uncompressed glTF). Wired into `HeroModel.tsx` via `useGLTF('/models/hero/hero.glb')` with `useGLTF.preload`. No Hunyuan3D/Hyper3D API keys needed (pure Blender Python).
- `ChromaticAberration` dropped from PostProcessing — prop typings broken in `@react-three/postprocessing` v3.0.5.
- **Loader fix:** with no async assets drei `useProgress` never hits 100%; loader clears on `!active` (nothing loading) + 600ms minimum. The hero GLB now drives real progress (0→100) and the loader hides on completion. Title/sub/CTA reveal uses **CSS transitions** (masked slide-up + stagger), not GSAP, for reliability.
- Vercel MCP: `VERCEL_TOKEN` set via `setx` (persisted) and **verified connected** (HTTP 200). Config uses `Authorization: Bearer {env:VERCEL_TOKEN}`.
- Blender MCP: **connected and verified** (Blender 5.2.0, addon v1.5, protocol v4). Addon enabled; requires "Start MCP Server" (port 9876) to reconnect if Blender restarts.
- r3f MCP: enabled:true; stray `r3f-mcp-server` on port 3333 was killed (now free) — restart opencode to reconnect cleanly. r3f codegen tools only fire against a running R3F app on localhost:3333.
- `3D-TOOLCHAIN.md` is the user-curated reference (toolchain map, format rules, pipeline, texture formats, Poly Haven/Sketchfab, project structure, production guidelines, stack checklist, end-to-end flow).

## Work State
### Completed
- Full MCP setup (playwright, filesystem, github, vercel, netlify, replicate, threejs-devtools, r3f, context7, shadcn, blender).
- Vercel: `VERCEL_TOKEN` set + MCP connection verified.
- r3f: stray process on port 3333 killed; port free.
- Installed three.js stack + global `@gltf-transform/cli` v4.4.2.
- Saved `3D-TOOLCHAIN.md` (all user-provided diagrams/guidelines).
- **Phase 1 Foundation** built & verified: Vite/React/R3F scaffold, `npm run build` ✓, preview serves on :4173, page loads with 0 errors (only benign three.js deprecation/shader-precision warnings).
- **Phase 2 Cinematic Reveal** built & verified: loader clears (no-asset + real-GLB aware), `app--ready` applied, camera intro gated on `experienceReady`, hero model scale-in, masked title slide-up + stagger, subline/CTA/nav/scroll-indicator/sound-toggle staggered reveal.
- **Hero asset**: generated procedurally in Blender, exported `public/models/hero/hero.glb`, wired via `useGLTF` into `HeroModel.tsx` (placeholder replaced). Runtime verified: GLB fetched 200, no console errors, loader clears, reveal works.
- **Phase 3 Narrative + Interaction** built & verified: scrollable page (`.sections` normal flow, canvas fixed), 3 scroll-revealed narrative sections via IntersectionObserver; `useScrollProgress` writes `scrollProgress` to store + `--scroll` CSS var; **hero fade + scroll-indicator hide driven via React inline styles** (browser rejects `calc(var(--scroll)*N)` in plain CSS — verified at scrollY 600 → scroll 0.31, hero opacity 0, indicator 0); drei `Html` hotspots (3) with click-to-open info panels (store `activeHotspot`); functional Web Audio ambient drone toggled by `SoundToggle`; 3D scene reacts to scroll (camera recede + hero drift in `CameraRig`/`HeroModel`). Headless verify: 0 console errors, scrollable, 3 hotspots, panels open, sound toggles to "SOUND ON".

### Phase 4 — Solar System view
- **Dedicated view** reachable from the nav (nav button toggles `view` hero↔solar; `setView` also clears `activePlanet`/`activeHotspot`). User chose: dedicated view + realistic textures + clickable planets.
- **Textures** (realistic, downloaded to `public/textures/planets/`): sun, mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune. Sources: `hkevin01/gnc-space-sim` (GitHub raw, curl) for 9 bodies; Mars pulled from Wikimedia Commons `Special:FilePath` (the solarsystemscope 403s direct download). All validated as JPEG (FF D8 magic). Saturn rings are **procedural** (canvas radial-band alpha texture in `makeRingTexture`).
- **Scene** (`src/three/solar/SolarSystem.tsx`): emissive textured Sun (point light at center, `decay={0}` for even lighting), 8 orbiting/self-spinning planets (compressed, non-real scale for usability), Saturn rings, orbit guide rings, drei `Stars`, `OrbitControls` (no pan, damped), clickable planet meshes (`onClick`→`setActivePlanet`, hover scale + pointer cursor), drei `Html` name labels. `useTexture.preload` for all bodies so view-switch is instant (no loader flash).
- **Camera fly-to:** selecting a planet (chip or 3D mesh) smoothly flies the camera in (easeOutCubic intro ~0.9s to a distance scaled by planet radius, `Math.max(9, r*5+6)`) and then **follows** the orbiting planet by lerping `OrbitControls.target` to its live world position each frame (`Planet` writes its world pos into a shared ref each frame). Deselect / HOME eases the camera back to the overview (`[0,28,82]`, target origin). Entering solar view snaps camera to overview.
- **Overlay** (`src/components/SolarOverlay.tsx`): title + hint, 9 planet chips (Sun + 8) that open an info panel with facts (`PLANETS`/`SUN_FACTS` in `src/three/solar/data.ts`), texture credit line. `Navigation.tsx` repurposed: section links only in hero; menu button toggles SOLAR SYSTEM / HOME.
- **App/Experience wiring**: `App.tsx` switches Canvas scene + DOM overlay by `view`; `Experience.tsx` swaps hero scene↔`SolarSystem`, fog only in hero, camera `far` bumped to 2000, `CameraRig` only in hero.
- **Verified (headless)**: 0 console errors; nav switches to solar (`app--solar`, `.solar-ui` present, 9 chips, canvas renders); clicking Jupiter chip → panel "Jupiter"; Sun chip → "Sun"; HOME returns to hero (`app--hero`, no `.solar-ui`). Screenshot saved to `solar-system.png`.

### Active
- None pending. Phases 1–4 are complete and verified.

### Blocked
- (none critical) r3f codegen needs a running R3F app; Blender MCP needs "Start MCP Server" if Blender restarts.

## Next Move
1. Optional polish/extensions: mobile tuning, more hotspots, second hero variant, Draco compression (needs draco in `useGLTF`), real HDR environment, or deploy to Vercel.
2. Deploy: `vercel deploy` (token configured) when ready for production.

## Relevant Files
- `C:\Users\SCL\OneDrive\Documents\Default Project\opencode.json`: MCP server configuration.
- `C:\Users\SCL\OneDrive\Documents\Default Project\3D-TOOLCHAIN.md`: user-curated 3D pipeline/reference doc.
- `C:\Users\SCL\OneDrive\Documents\Default Project\package.json`: Vite/React/R3F dependency manifest + scripts (`dev`, `build`, `preview`).
- `C:\Users\SCL\OneDrive\Documents\Default Project\public\models\hero\hero.glb`: the generated hero model.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\Experience.tsx`: root R3F `<Canvas className="canvas-fixed">` (camera, quality, fog, composer, Hotspots).
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\camera\CameraRig.tsx`: intro + scroll-driven camera recede.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\models\HeroModel.tsx`: loads `hero.glb` via `useGLTF`; scroll drift + scale-in.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\Hotspots.tsx`: drei `<Html>` hotspots + info panels.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\Sections.tsx`: 3 scroll-revealed narrative sections.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\Loader.tsx`: no-asset / real-GLB aware load completion.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\HeroContent.tsx`: CSS-transition masked title reveal + React-driven scroll fade.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\ScrollIndicator.tsx`: React-driven hide on scroll.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\SoundToggle.tsx`: toggles `soundEnabled`.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\hooks\useScrollProgress.ts`: scroll → store + `--scroll` CSS var.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\hooks\useAmbientAudio.ts`: Web Audio ambient drone.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\index.css`: reveal/scroll/section/hotspot/vignette/solar styles.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\solar\SolarSystem.tsx`: sun, planets, rings, stars, OrbitControls, click.
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\three\solar\data.ts`: `PLANETS` + `SUN_FACTS` (radii/distances/speeds/textures/facts).
- `C:\Users\SCL\OneDrive\Documents\Default Project\src\components\SolarOverlay.tsx`: solar title/hint/chips/info panel/credit.
- `C:\Users\SCL\OneDrive\Documents\Default Project\public\textures\planets\*.jpg`: realistic planet/sun textures.
