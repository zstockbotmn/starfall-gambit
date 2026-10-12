# M3 assets (milestone A)
Source of truth: `src/models.js` (8 ship builders + board), `src/materials.js` (runtime PBR per slot, procedural grime/marble/puddle/scan/nebula maps, backdrop painter).
Bake: `python3 -m http.server 8771 --bind 127.0.0.1` at repo root, then `node tools/bake.js` -> `assets/models/*.glb` (merged per material slot, meshopt via gltfpack `-cc`), `assets/sky.webp` (4096x2048), `assets/sky_low.webp` (2048x1024). Stats in `assets/bake-stats.json`.
Contact sheet: `node tools/contact.js` -> `screenshots/m3/assets/` (renders load the baked GLBs, not the builders).
Route: AI-assisted direction (Grok Imagine concept art in /workspace/starfall-m3-proposal/concept/) + procedural kitbash modelling. No paid image-to-3D service was used. Textures are generated on device (0 bytes download).
