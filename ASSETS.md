# M3 assets (milestone A)
Source of truth: `src/models.js` (8 ship builders + board), `src/materials.js` (runtime PBR per slot, procedural grime/marble/puddle/scan/nebula maps, backdrop painter).
Bake: `python3 -m http.server 8771 --bind 127.0.0.1` at repo root, then `node tools/bake.js` -> `assets/models/*.glb` (merged per material slot, meshopt via gltfpack `-cc`), `assets/sky.webp` (4096x2048), `assets/sky_low.webp` (2048x1024). Stats in `assets/bake-stats.json`.
Contact sheet: `node tools/contact.js` -> `screenshots/m3/assets/` (renders load the baked GLBs, not the builders).
Route: AI-assisted direction (Grok Imagine concept art in /workspace/starfall-m3-proposal/concept/) + procedural kitbash modelling. No paid image-to-3D service was used. Textures are generated on device (0 bytes download).

## M3 milestone B additions
- **From AI images (Grok Imagine, supplied in `assets/src-ai/`):** `assets/tex/blue-hull.webp` + `blue-hull-emissive.webp` (from `blue-hull.jpg`), `assets/tex/red-hull.webp` + `red-hull-emissive.webp` (from `red-hull.jpg`). Pipeline: `python3 tools/ai-textures.py` (centre square crop of the 16:9 image, half-offset + feathered cross blend to tile, 512 px webp; emissive = neon pixels only). Used as base colour + emissive maps on the Blue `ceramic` and Red `plate` hull slots. Tiling proofs: `screenshots/m3/assets/*-hull-tiled-2x2.png`. `concept-blue.jpg` / `concept-red.jpg` are reference only (not shipped).
- **Code-modelled (not AI):** all ship/board meshes (`src/models.js`), explosion fragments `assets/models/*_frac.glb` (k-means split of LOD1 into ~10 chunks, `tools/bake.html`), backdrop `sky*.webp`, procedural grime/marble/glyph textures.
