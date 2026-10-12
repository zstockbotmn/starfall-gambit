// Starfall Gambit M3 — 3D view layer (Three.js / WebGL2). The game logic (engine.js, ai.js, game.js) is unchanged in spirit:
// game.js keeps the DOM grid of 36 .cell buttons (hit-testing, ARIA, the M1.4–M2.1 tap state machine, the M2.1 marker CSS).
// This module renders the board/ships/VFX on a canvas behind the DOM and maps the DOM grid onto the projected 3D board with a
// CSS homography (matrix3d), so every tap lands on exactly the tile drawn under the finger at any viewport.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makeTextures, makeMaterials, makeEnvironment, canvasTex, loadHullTextures, applyHullTextures } from './materials.js';

const TILT = 62, FOV = 26, SHIP_Y = .2, SHIP_SCALE = 1.22;
const TIERS = { high: { dpr: 2, shadow: 2048, bloom: true, msaa: 4, rain: true }, medium: { dpr: 1.5, shadow: 1024, bloom: true, msaa: 0, rain: true }, low: { dpr: 1, shadow: 0, bloom: false, msaa: 0, rain: false } };
const BATTLE_MS = { full: 1300, fast: 500, reduced: 300, off: 0 }, FINALE_MS = { full: 2500, fast: 900, reduced: 300, off: 0 };
const cellPos = i => new THREE.Vector3((i % 6) - 2.5, 0, Math.floor(i / 6) - 2.5);   // row 0 = Red back row (far)
const LS = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
const now = () => performance.now();

export async function start(opts = {}) {
  const base = opts.base || new URL('../assets/', import.meta.url).href;
  const Q = location.search, qTier = (Q.match(/tier=(high|medium|low)/) || [])[1];
  const boardEl = document.getElementById('board'), cells = [...boardEl.querySelectorAll('.cell')];
  const canvas = document.createElement('canvas'); canvas.id = 'gl3d'; canvas.setAttribute('aria-hidden', 'true'); document.body.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: /debug/.test(Q) });
  if (!renderer.capabilities.isWebGL2) { canvas.remove(); throw new Error('no WebGL2'); }
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown', software = /swiftshader|llvmpipe|software/i.test(gpu);
  const pref = LS('sg_quality', 'auto');
  let tier = qTier || (pref !== 'auto' ? pref : software ? 'low' : 'high'); const autoTier = !qTier && pref === 'auto';
  renderer.info.autoReset = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9; renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  const T = makeTextures(tier); let M = makeMaterials(T, tier);
  // ---------- assets ----------
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const bind = root => { root.traverse(o => { if (o.isMesh) { const n = o.material.userData.slot || o.material.name; o.material = M[n] || M.ceramic; o.material.userData.slot = n;
    o.castShadow = /^(ceramic|plate)$/.test(n); /* hull slots only: ~1 shadow call per ship */ o.receiveShadow = !/Glow|neon|holo|energy/.test(n); } }); return root; };
  const load = f => loader.loadAsync(base + 'models/' + f + '.glb').then(g => bind(g.scene));
  const IDS = ['bF', 'bD', 'bL', 'bS', 'rF', 'rD', 'rL', 'rS'], proto = {}, frac = {};
  const skyP = new THREE.TextureLoader().loadAsync(base + (tier === 'low' ? 'sky_low' : 'sky') + '.webp');
  await Promise.all([...IDS.map(async id => { proto[id] = await load(id + '_lod1'); }), load('board_lod1').then(b => proto.board = b)]);
  const fracP = Promise.all(IDS.map(async id => { frac[id] = await load(id + '_frac'); })).catch(() => {});      // explosion pieces stream in after first paint
  applyHullTextures(M, await loadHullTextures(base));
  const sky = await skyP; sky.colorSpace = THREE.SRGBColorSpace; sky.mapping = THREE.EquirectangularReflectionMapping;

  // ---------- scene ----------
  const scene = new THREE.Scene(); scene.background = sky; scene.backgroundIntensity = .9; scene.backgroundRotation.set(-.85, 2.35, 0);   // tilt the backdrop so the nebula shows behind the 62° play view
  scene.environment = makeEnvironment(renderer, sky); scene.environmentIntensity = .75;
  const key = new THREE.DirectionalLight(0xfff1dd, 2); key.position.set(-5, 10, 6); key.castShadow = true;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 30 }); key.shadow.bias = -.0005; scene.add(key);
  scene.add(new THREE.HemisphereLight(0x9fdcff, 0x200818, .35));
  const rimM = new THREE.DirectionalLight(0xff3ad8, .9); rimM.position.set(3, 1.2, -8); scene.add(rimM);
  const rimC = new THREE.DirectionalLight(0x30f0ff, 1.1); rimC.position.set(-6, 1.5, -6); scene.add(rimC);
  for (const [c, x, z] of [[0xff2bd6, -2, -2.2], [0x19f0ff, 1.8, -1.6], [0xff2bd6, 1, -3.4]]) { const p = new THREE.PointLight(c, 2.5, 4.5, 2); p.position.set(x, 1.1, z); scene.add(p); }
  const impactLight = new THREE.PointLight(0xffffff, 0, 4, 2); scene.add(impactLight);
  scene.add(proto.board);
  // tiles: one InstancedMesh per material (5 draw calls for 36 tiles)
  const tileGeo = new RoundedBoxGeometry(.94, .12, .94, 3, .035), TILE_MATS = ['tileB0', 'tileB1', 'tileR0', 'tileR1', 'nebula'], tileIM = {};
  for (const k of TILE_MATS) { const im = new THREE.InstancedMesh(tileGeo, M[k], 36); im.receiveShadow = true; im.frustumCulled = false; im.count = 0; im.material.userData.slot = k; scene.add(im); tileIM[k] = im; }
  let nebKey = null; const haze = [];
  const hazeMat = c => new THREE.SpriteMaterial({ map: T.softDot, color: c, transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false });
  function setTiles(neb) { const k = neb.join(','); if (k === nebKey) return; nebKey = k; const per = {}; TILE_MATS.forEach(m => per[m] = []);
    for (let i = 0; i < 36; i++) { const r = Math.floor(i / 6), c = i % 6, alt = (r + c) % 2; per[neb.includes(i) ? 'nebula' : (r < 3 ? 'tileR' : 'tileB') + alt].push(i); }
    const m4 = new THREE.Matrix4(); for (const [k, list] of Object.entries(per)) { const im = tileIM[k]; list.forEach((i, n) => { const p = cellPos(i); m4.makeTranslation(p.x, -.06, p.z); im.setMatrixAt(n, m4); }); im.count = list.length; im.instanceMatrix.needsUpdate = true; }
    haze.splice(0).forEach(s => scene.remove(s));
    for (const i of neb) { const p = cellPos(i); [0x9a5cff, 0xff4fd8, 0x4fd8ff].forEach((c, k) => { const s = new THREE.Sprite(hazeMat(c)); s.position.set(p.x + (k - 1) * .15, .25 + k * .07, p.z + ((k * 7) % 3 - 1) * .12); s.scale.setScalar(.85 + k * .1); s.userData.cell = i; s.renderOrder = 2; scene.add(s); haze.push(s); }); } }
  // in-scene tile FX: danger hatching (fixed colour, not tone-mapped, under ships) + selection frame
  const hatchTex = canvasTex(256, 256, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#e5452e'; g.lineWidth = 26; for (let k = -w; k < 2 * w; k += 64) { g.beginPath(); g.moveTo(k, h); g.lineTo(k + h, 0); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 5; for (let k = -w; k < 2 * w; k += 64) for (const o of [-15, 15]) { g.beginPath(); g.moveTo(k + o, h); g.lineTo(k + o + h, 0); g.stroke(); } });
  const hatchMat = new THREE.MeshBasicMaterial({ map: hatchTex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const hatchIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(.92, .92).rotateX(-Math.PI / 2), hatchMat, 36); hatchIM.count = 0; hatchIM.frustumCulled = false; hatchIM.renderOrder = 1; scene.add(hatchIM);
  const frameGeo = (() => { const s = new THREE.Shape(); s.moveTo(-.46, -.46); s.lineTo(.46, -.46); s.lineTo(.46, .46); s.lineTo(-.46, .46); const h = new THREE.Path(); h.moveTo(-.38, -.38); h.lineTo(-.38, .38); h.lineTo(.38, .38); h.lineTo(.38, -.38); s.holes.push(h); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); })();
  const frameIn = (() => { const s = new THREE.Shape(); s.moveTo(-.41, -.41); s.lineTo(.41, -.41); s.lineTo(.41, .41); s.lineTo(-.41, .41); const h = new THREE.Path(); h.moveTo(-.36, -.36); h.lineTo(-.36, .36); h.lineTo(.36, .36); h.lineTo(.36, -.36); s.holes.push(h); return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2); })();
  const selG = new THREE.Group(), selMat = new THREE.MeshBasicMaterial({ color: 0x5cffc8, toneMapped: false, depthWrite: false });
  selG.add(new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .75, depthWrite: false })), new THREE.Mesh(frameIn, selMat)); selG.children[1].position.y = .002;
  selG.visible = false; selG.renderOrder = 3; selG.traverse(o => o.renderOrder = 3); scene.add(selG);
  // rain over the Red half
  const rain = (() => { const pts = []; let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 420; k++) { const x = r() * 7 - 3.5, z = -r() * 3.6 - .1, y = r() * 3 + .1, l = .18 + r() * .2; pts.push(x, y, z, x - .03, y - l, z + .02); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: .13, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(o); return o; })();

  // ---------- camera fit + DOM homography ----------
  const camera = new THREE.PerspectiveCamera(FOV, 1, .1, 200);
  let view = { W: 1, H: 1, ox: 0, oy: 0 }, shake = 0, shakeT0 = 0;
  const project = (v) => { const p = v.clone().project(camera); return [(p.x + 1) / 2 * view.W, (1 - p.y) / 2 * view.H]; };
  function slotRect() { const t = boardEl.style.transform; boardEl.style.transform = 'none'; const r = boardEl.getBoundingClientRect(); boardEl.style.transform = t; return r; }
  function homography(w, h, P) {   // maps (0,0),(w,0),(0,h),(w,h) -> P[0..3]; returns CSS matrix3d
    const src = [[0, 0], [w, 0], [0, h], [w, h]], A = [], b = [];
    for (let k = 0; k < 4; k++) { const [x, y] = src[k], [u, v] = P[k]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (let i = 0; i < 8; i++) { let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
      for (let r = 0; r < 8; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; b[r] -= f * b[i]; } }
    const H = b.map((v, i) => v / A[i][i]); // h0..h7, h8 = 1
    return `matrix3d(${H[0]},${H[3]},0,${H[6]},${H[1]},${H[4]},0,${H[7]},0,0,1,0,${H[2]},${H[5]},0,1)`; }
  let fitInfo = {};
  function fit() {
    const W = innerWidth, H = innerHeight; view.W = W; view.H = H;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, TIERS[tier].dpr)); renderer.setSize(W, H, false); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    composer && composer.setSize(W, H); composer && composer.setPixelRatio(renderer.getPixelRatio());
    camera.aspect = W / H; camera.clearViewOffset(); const r = slotRect(), t = TILT * Math.PI / 180, dir = new THREE.Vector3(0, Math.sin(t), Math.cos(t));
    const C = [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([x, z]) => new THREE.Vector3(x, 0, z)), E = [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const set = d => { camera.position.copy(dir).multiplyScalar(d); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); };
    let lo = 5, hi = 200; for (let k = 0; k < 40; k++) { const d = (lo + hi) / 2; set(d); const p = E.map(project), w = Math.max(p[1][0], p[3][0]) - Math.min(p[0][0], p[2][0]), h = Math.max(p[2][1], p[3][1]) - Math.min(p[0][1], p[1][1]);
      if (w > r.width * 1.02 || h > r.height * 1.02) lo = d; else hi = d; }
    set(hi); const p = C.map(project), cx = (p[0][0] + p[1][0] + p[2][0] + p[3][0]) / 4, cy = (Math.min(p[0][1], p[1][1]) + Math.max(p[2][1], p[3][1])) / 2;
    view.ox = cx - (r.left + r.width / 2); view.oy = cy - (r.top + r.height / 2); applyOffset(0, 0);
    const q = C.map(project).map(([x, y]) => [x - r.left, y - r.top]);
    boardEl.style.transformOrigin = '0 0'; boardEl.style.transform = homography(r.width, r.height, q);
    fitInfo = { distance: +hi.toFixed(2), slot: [Math.round(r.width), Math.round(r.height)], quad: q.map(a => a.map(Math.round)) }; dirty = true; }
  function applyOffset(dx, dy) { camera.setViewOffset(view.W, view.H, view.ox + dx, view.oy + dy, view.W, view.H); camera.updateProjectionMatrix(); }

  // ---------- post / tiers ----------
  let composer = null, bloom = null;
  function applyTier() { const cfg = TIERS[tier];
    renderer.shadowMap.enabled = !!cfg.shadow; key.castShadow = !!cfg.shadow; if (cfg.shadow) { key.shadow.mapSize.set(cfg.shadow, cfg.shadow); key.shadow.map && key.shadow.map.dispose(); key.shadow.map = null; }
    rain.visible = cfg.rain;
    if (composer) composer.dispose();
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: cfg.msaa });
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
    bloom = cfg.bloom ? new UnrealBloomPass(new THREE.Vector2(256, 256), .28, .18, .92) : null; if (bloom) composer.addPass(bloom);
    composer.addPass(new OutputPass()); scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); document.body.dataset.tier = tier; fit(); }

  // ---------- ships ----------
  const shown = {};   // cell -> { id, obj }
  const root = new THREE.Group(); scene.add(root);
  // Batching: every (ship type, material slot) is ONE InstancedMesh; a ship on the board is an empty Object3D whose matrix feeds the instances.
  const batch = {}, m4b = new THREE.Matrix4();
  // play view: every ship stays inside its own square - clamp its footprint (max |x|, |z|) to FIT_HALF of a cell after SHIP_SCALE
  const FIT_HALF = .45, shipFit = {}; for (const id of IDS) { const bb = new THREE.Box3().setFromObject(proto[id]), h = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z) * SHIP_SCALE; shipFit[id] = Math.min(1, FIT_HALF / h); proto[id].scale.setScalar(shipFit[id]); }
  // play view only: Red reads from the back row - brighter glossy reflections + a neon rim (back-face shell) around each hull
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xff3ad8, side: THREE.BackSide, toneMapped: false }); rimMat.userData.slot = 'rimR'; M.rimR = rimMat;
  for (const k of ['redSkin', 'rGun', 'rPlate']) if (M[k]) { M[k].envMapIntensity = 3.6; M[k].color.multiplyScalar(1.5); }
  for (const id of IDS) if (id[0] === 'r') { const hull = []; proto[id].traverse(m => { if (m.isMesh && m.material.name === 'redSkin') hull.push(m); });
    for (const m of hull) { const r = new THREE.Mesh(m.geometry, rimMat); r.castShadow = false; m.updateMatrix(); r.matrix.copy(m.matrix); r.matrixAutoUpdate = false; const sh = new THREE.Group(); if (tier === 'low') sh.scale.set(1.12, 1.2, 1.09); else sh.scale.set(1.07, 1.12, 1.05); /* thicker rim on Low (DPR 1, no MSAA/bloom) */ sh.add(r); m.parent.add(sh); } }
  for (const id of IDS) { proto[id].updateMatrixWorld(true); batch[id] = []; proto[id].traverse(m => { if (!m.isMesh) return; const im = new THREE.InstancedMesh(m.geometry, m.material, 4);
    im.count = 0; im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow; im.frustumCulled = false; scene.add(im); batch[id].push({ im, local: m.matrixWorld.clone() }); }); }
  function updateBatches() { root.updateMatrixWorld(true); const per = {}; for (const s of Object.values(shown)) if (s.obj.visible) (per[s.id] ||= []).push(s.obj);
    for (const id of IDS) { const objs = per[id] || []; for (const e of batch[id]) { objs.forEach((o, n) => { m4b.multiplyMatrices(o.matrixWorld, e.local); e.im.setMatrixAt(n, m4b); }); e.im.count = objs.length; e.im.instanceMatrix.needsUpdate = true; } } }
  function makeShipMesh(id) { const o = proto[id].clone(); o.scale.setScalar(SHIP_SCALE * shipFit[id]); if (id[0] === 'r') o.rotation.y = Math.PI; return o; }
  function makeShip(id) { const o = new THREE.Object3D(); o.scale.setScalar(SHIP_SCALE); if (id[0] === 'r') o.rotation.y = Math.PI; o.userData.id = id; o.userData.phase = Math.random() * 6; return o; }
  function place(o, i) { const p = cellPos(i); o.position.set(p.x, SHIP_Y, p.z); o.userData.cell = i; }
  const idOf = pc => pc ? (pc.s === 0 ? 'b' : 'r') + pc.t : null;
  let lastSt = null, lastUi = null, battle = null; const idle = [];
  function sync(st, ui) { lastSt = st; lastUi = ui || lastUi || {}; if (battle) return; dirty = true;
    setTiles(st.nebula || []);
    const lm = st.lastMove;
    if (lm && lm.kind === 'move' && shown[lm.from] && !st.board[lm.from] && idOf(st.board[lm.to]) === shown[lm.from].id && shown[lm.to] !== shown[lm.from]) {
      if (shown[lm.to]) root.remove(shown[lm.to].obj); const s = shown[lm.from]; delete shown[lm.from]; shown[lm.to] = s;
      const a = s.obj.position.clone(); place(s.obj, lm.to); s.obj.userData.glide = { a, b: s.obj.position.clone(), t0: now(), d: reduced() ? 1 : 260 }; s.obj.position.copy(a); }
    for (let i = 0; i < 36; i++) { const want = idOf(st.board[i]);
      if (shown[i] && shown[i].id !== want) { root.remove(shown[i].obj); delete shown[i]; }
      if (!shown[i] && want) { const o = makeShip(want); place(o, i); root.add(o); shown[i] = { id: want, obj: o }; } }
    // tile FX
    const m4 = new THREE.Matrix4(); const dz = (ui && ui.danger) || []; dz.forEach((i, n) => { const p = cellPos(i); m4.makeTranslation(p.x, .004, p.z); hatchIM.setMatrixAt(n, m4); }); hatchIM.count = dz.length; hatchIM.instanceMatrix.needsUpdate = true;
    const si = ui && (ui.sel !== null && ui.sel !== undefined ? ui.sel : ui.insp); if (si !== null && si !== undefined) { const p = cellPos(si); selG.position.set(p.x, .006, p.z); selG.visible = true; selMat.color.set(ui.sel === si ? 0x5cffc8 : 0xff5fd6); } else selG.visible = false; }

  // ---------- VFX ----------
  const fx = new THREE.Group(); fx.renderOrder = 10; scene.add(fx);
  const fireTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.3, 'rgba(255,220,160,.8)'); gr.addColorStop(.6, 'rgba(255,120,40,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const smokeTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(40,30,45,.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sprite(tex, color, pos, scale, blend = THREE.AdditiveBlending, opacity = 1) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: blend, depthWrite: false, depthTest: blend !== THREE.AdditiveBlending ? true : false, toneMapped: blend !== THREE.AdditiveBlending ? true : false }));
    s.position.copy(pos); s.scale.setScalar(scale); s.renderOrder = 10; fx.add(s); return s; }
  function burst(at, n, color, speed, life, up = .5, size = .05, inward = false) {   // instanced-ish particle burst (one draw call)
    const pos = new Float32Array(n * 3), vel = [], col = new Float32Array(n * 3), c = new THREE.Color(color);
    for (let k = 0; k < n; k++) { const v = new THREE.Vector3(Math.random() - .5, Math.random() * up, Math.random() - .5).normalize().multiplyScalar(speed * (.4 + Math.random() * .8));
      if (inward) { const o = v.clone().normalize().multiplyScalar(.55); pos.set([at.x + o.x, at.y + o.y, at.z + o.z], k * 3); vel.push(o.multiplyScalar(-1 / life * 1000)); } else { pos.set([at.x, at.y, at.z], k * 3); vel.push(v); }
      const cc = c.clone().multiplyScalar(1.4 + Math.random()); col.set([cc.r, cc.g, cc.b], k * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size, map: T.softDot, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); p.renderOrder = 11; fx.add(p);
    return { obj: p, upd(dt, u) { const a = g.attributes.position.array; for (let k = 0; k < n; k++) { const v = vel[k]; if (!inward) v.y -= 2.2 * dt; a[k * 3] += v.x * dt; a[k * 3 + 1] = Math.max(.02, a[k * 3 + 1] + v.y * dt); a[k * 3 + 2] += v.z * dt; } g.attributes.position.needsUpdate = true; p.material.opacity = 1 - u; } }; }
  function beamMesh(from, to, core, glow, w) { const d = to.clone().sub(from), L = d.length(), g = new THREE.Group();
    [[w * 3, glow, .25], [w * 1.6, glow, .5], [w * .6, core, 1]].forEach(([r, c, o]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 12, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); m.renderOrder = 12; g.add(m); });
    g.position.copy(from).add(to).multiplyScalar(.5); g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); fx.add(g); return g; }
  function ring(at, color, r0, r1) { const m = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
    m.position.copy(at).setY(.03); m.renderOrder = 12; fx.add(m); return { upd(dt, u) { m.scale.setScalar(r0 + (r1 - r0) * u); m.material.opacity = 1 - u; } }; }
  function debris(at, id, loser) { const src = frac[id]; if (!src) return []; const g = src.clone(); g.scale.setScalar(SHIP_SCALE * (shipFit[id] || 1)); if (id[0] === 'r') g.rotation.y = Math.PI; g.position.copy(at); fx.add(g);
    return g.children.map(ch => { const dir = ch.position.clone().setY(0).normalize(); const v = dir.multiplyScalar(1.2 + Math.random() * 1.6).add(new THREE.Vector3(0, 1.2 + Math.random() * 1.8, 0)); const w = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(14);
      return { upd(dt, u) { v.y -= 6 * dt; ch.position.addScaledVector(v, dt / SHIP_SCALE); const wy = (g.position.y + ch.position.y * SHIP_SCALE); if (wy < .03 && v.y < 0) { v.y *= -.35; v.x *= .6; v.z *= .6; w.multiplyScalar(.6); }
        ch.rotation.x += w.x * dt; ch.rotation.y += w.y * dt; ch.rotation.z += w.z * dt; const s = u > .7 ? 1 - (u - .7) / .3 : 1; ch.scale.setScalar(Math.max(.001, s)); } }; }); }

  // battle(prev, move, next): returns its duration (ms). The state is already applied by game.js; the view animates the change.
  function battleStart(prev, m, next) {
    const mode = LS('sg_battle', 'full'), rm = reduced(); const atk = prev.board[m.from], tgt = prev.board[m.to] || m.cap; if (!atk || !tgt) return 0;
    const finale = tgt.t === 'F'; let kind = rm && mode !== 'off' ? 'reduced' : mode; const T = (finale ? FINALE_MS : BATTLE_MS)[kind] || 0;
    if (!T || !shown[m.from] || !shown[m.to]) return 0;
    const A = shown[m.from].obj, B = shown[m.to].obj, aId = idOf(atk), bId = idOf(tgt), side = aId[0], loser = bId[0];
    const from = A.position.clone(), to = B.position.clone(), shot = m.kind === 'shot', moving = !shot;
    const col = side === 'b' ? { core: 0xffffff, glow: 0x43f7e2, spark: 0x7ff7ea } : { core: 0xffd0f6, glow: 0xff2bd6, spark: 0x19f0ff };
    const ev = [], ups = []; const at = (u, fn) => ev.push({ u, fn, done: false }); const over = (u0, u1, fn) => ups.push({ u0, u1, fn });
    const P = kind === 'reduced' ? { c: 0, s: .2, i: .4, e: 1 } : { c: .27, s: .42, i: .42, e: .86 };
    if (finale && kind === 'full') { P.c = .16; P.s = .26; P.i = .26; P.e = .9; }
    document.body.classList.add('sg-battle'); haze.forEach(h => { if (h.userData.cell === m.to) h.material.opacity = .28 * .3; });
    const nose = from.clone().add(to.clone().sub(from).normalize().multiplyScalar(.32)).setY(SHIP_Y + .05);
    if (kind !== 'reduced') {
      // 1 charge-up
      at(0, () => { const g = sprite(T.softDot, col.glow, nose, .05); over(0, P.c, u => g.scale.setScalar(.05 + .5 * u)); over(P.c, P.c + .08, u => g.material.opacity = 1 - u);
        const b = burst(nose, 60, col.spark, 1, (P.c * T) || 200, .5, .04, true); over(0, P.c, (u, dt) => b.upd(dt, u * .6)); over(P.c, P.c + .01, () => fx.remove(b.obj)); });
      // 2 strike
      if (shot) at(P.c, () => { if (side === 'b') { const bm = beamMesh(nose, to.clone().setY(SHIP_Y), col.core, col.glow, .03); over(P.c, P.i + .12, u => { bm.scale.set(1 - u * .7, 1, 1 - u * .7); bm.children.forEach(c => c.material.opacity *= .97); }); over(P.i + .12, P.i + .13, () => fx.remove(bm)); }
        else { const slug = sprite(T.softDot, 0xff6ae6, nose, .22), trail = burst(nose, 30, 0x19f0ff, .3, 300, .2, .035); over(P.c, P.s, (u, dt) => { slug.position.lerpVectors(nose, to.clone().setY(SHIP_Y), u); slug.position.y += Math.sin(u * 40) * .015; trail.obj.position.copy(slug.position).sub(nose); trail.upd(dt, u); });
          over(P.s, P.s + .01, () => { fx.remove(slug); fx.remove(trail.obj); }); } });
      if (atk.t === 'F' && !shot) at(P.c, () => { if (side === 'b') for (let k = 0; k < 3; k++) { const o = new THREE.Vector3((k - 1) * .35, 0, 0).applyQuaternion(A.quaternion).add(from).setY(SHIP_Y); const bm = beamMesh(o, to.clone().setY(SHIP_Y), 0xffffff, 0x43f7e2, .015); bm.visible = false; const u0 = P.c + k * .03;
          over(u0, u0 + .06, () => bm.visible = true); over(u0 + .06, u0 + .07, () => fx.remove(bm)); }
        else { const ret = ring(to, 0xff2bd6, .5, .3); over(0, P.c, (u, dt) => ret.upd(dt, u * .5)); for (let k = 0; k < 3; k++) { const bm = beamMesh(from.clone().setY(SHIP_Y + .1), to.clone().add(new THREE.Vector3((k - 1) * .1, SHIP_Y, 0)), 0xffd0f6, 0xff2bd6, .01); bm.visible = false; const u0 = P.c + k * .025; over(u0, u0 + .05, () => bm.visible = true); over(u0 + .05, u0 + .06, () => fx.remove(bm)); } } });
    }
    if (moving) { const stop = to.clone().sub(from).multiplyScalar(.82).add(from); over(P.c, P.s + (kind === 'reduced' ? .4 : 0), u => { A.position.lerpVectors(from, stop, u * u * (3 - 2 * u)); if (side === 'r' && atk.t === 'D') A.rotation.y += .4; });
      if (kind !== 'reduced') { const trail = burst(from.clone().setY(SHIP_Y), 40, col.glow, .2, 400, .2, .04); over(P.c, P.e, (u, dt) => { trail.obj.position.copy(A.position).sub(from).setY(0); trail.upd(dt, u); }); } }
    // 3 impact
    at(P.i, () => { const hit = to.clone().setY(SHIP_Y);
      if (kind !== 'reduced') { if (!rm) { const fl = sprite(fireTex, 0xffffff, hit, .4); over(P.i, P.i + .12, u => { fl.scale.setScalar(.4 + 1.6 * u); fl.material.opacity = 1 - u; }); shake = 1; shakeT0 = now(); battle.shook = true; }
        impactLight.position.copy(hit).setY(.6); impactLight.color.set(loser === 'r' ? 0xff8a3a : 0xbff8ff); over(P.i, P.e, u => impactLight.intensity = 30 * (1 - u) ** 2);
        const sp = burst(hit, 160, side === 'r' && shot ? 0x19f0ff : col.spark, 2.6, 600, 1.2, .05); over(P.i, P.e, (u, dt) => sp.upd(dt, u));
        const rg = ring(to, loser === 'r' ? 0xff7a2e : 0x9ff8ff, .1, 1.2); over(P.i, P.i + .3, (u, dt) => rg.upd(dt, u)); }
      // 4 destruction: swap in pre-broken pieces of the loser
      B.visible = false; const ch = kind === 'reduced' ? [] : debris(B.position.clone(), bId, loser); over(P.i, 1, (u, dt) => ch.forEach(c => c.upd(dt, u)));
      if (kind === 'reduced') { const g = makeShipMesh(bId); g.position.copy(B.position); fx.add(g); over(P.i, 1, u => g.scale.setScalar(SHIP_SCALE * (1 - u))); burst(hit, 12, col.spark, .6, 300, .5, .04); }
      else if (loser === 'r') { const n = finale ? 9 : 5; for (let k = 0; k < n; k++) { const d = finale ? k * .05 : 0; const f = sprite(fireTex, k % 2 ? 0xff7a2e : 0xffb05a, hit.clone().add(new THREE.Vector3((Math.random() - .5) * .4, Math.random() * .2, (Math.random() - .5) * .4)), .05); f.material.opacity = 0;
          over(P.i + d, Math.min(1, P.i + d + .35), u => { f.material.opacity = 1 - u; f.scale.setScalar(.2 + .9 * u); }); const sm = sprite(smokeTex, 0x302838, hit.clone(), .1, THREE.NormalBlending, 0); over(P.i + .08 + d, 1, u => { sm.material.opacity = .6 * Math.sin(Math.PI * u); sm.scale.setScalar(.3 + .8 * u); sm.position.y = SHIP_Y + u * .6; }); }
        const mc = burst(hit, 80, 0xff2bd6, 1.8, 500, 1, .04); over(P.i, P.e, (u, dt) => mc.upd(dt, u)); }
      else { const v = sprite(fireTex, 0xe8fffb, hit, .3); over(P.i, P.i + .25, u => { v.scale.setScalar(.3 + 1.4 * u); v.material.opacity = 1 - u; }); const gold = burst(hit, 70, 0xffd27a, 2, 500, 1, .045); over(P.i, P.e, (u, dt) => gold.upd(dt, u));
        const vent = burst(hit, 50, 0x43f7e2, 1, 600, 2.5, .06); over(P.i, 1, (u, dt) => vent.upd(dt, u)); if (finale) for (let k = 1; k < 4; k++) at(P.i + k * .12, () => { const s2 = sprite(fireTex, 0xffffff, hit.clone().add(new THREE.Vector3((Math.random() - .5) * .5, .1, (Math.random() - .5) * .5)), .2); over(P.i + k * .12, P.i + k * .12 + .2, u => { s2.scale.setScalar(.2 + u); s2.material.opacity = 1 - u; }); }); }
    });
    // 5 return: attacker settles on its square (moving captures) — the camera never left the play pose (shake is a 2D view offset)
    if (moving) over(P.e, 1, u => A.position.lerpVectors(to.clone().sub(from).multiplyScalar(.82).add(from), to, u));
    return new Promise(res => { battle = { t0: now(), called: now(), T, ev, ups, prevU: 0, res, A, from, to, moving, kind, finale, mode: kind }; }), T; }
  function battleEnd() { if (!battle) return; const b = battle; battle = null; fx.clear(); const bt0 = b.called; stats.lastBattle = { cut: b.cut, gaps: b.gaps, ms: Math.round(now() - bt0), startupMs: b.startup, maxFrameMs: Math.round(b.maxDt || 0), planned: b.T, kind: b.kind, finale: b.finale, skipped: !b.cut && now() - bt0 < b.T * (window.SG3D_TS || 1) - 30, shook: b.shook }; impactLight.intensity = 0; shake = 0; applyOffset(0, 0);
    document.body.classList.remove('sg-battle'); haze.forEach(h => h.material.opacity = .28);
    // the captured ship is gone; the attacker (if it moved) now belongs to the target square
    for (const k of Object.keys(shown)) if (shown[k].obj === b.A && b.moving) { delete shown[k]; root.remove(b.A); }
    stats.battles++; b.res && b.res(); if (lastSt) sync(lastSt, lastUi); idle.splice(0).forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  function battleTick(t) { if (battle.startup === undefined) battle.startup = Math.round(t - battle.called); const b = battle; b.maxDt = Math.max(b.maxDt || 0, t - (b.lastT || b.called)); if (t - (b.lastT || b.called) > 150) (b.gaps = b.gaps || []).push([+(b.prevU || 0).toFixed(2), Math.round(t - (b.lastT || b.called))]); const ts = window.SG3D_TS || 1, u = Math.min(1, (t - b.called) / (b.T * ts))  /* clock starts at the tap: startup/shader stalls eat into the 1.3 s, they never extend it */, dtS = Math.min(.05, (t - (b.lastT || b.t0)) / 1000) / ts; b.lastT = t;
    for (const e of b.ev) if (!e.done && u >= e.u) { e.done = true; const q = performance.now(); e.fn(); (b.evMs = b.evMs || []).push([+e.u.toFixed(2), Math.round(performance.now() - q)]); }
    for (const p of b.ups) if (u >= p.u0 && b.prevU <= p.u1) { const lu = p.u1 > p.u0 ? Math.min(1, Math.max(0, (u - p.u0) / (p.u1 - p.u0))) : 1; p.fn(lu, dtS); }
    // Deadline: on a slow GPU, if the next frame (judged by the last one) would land well past the 1.3 s / 0.5 s budget, finish now
    // instead of overshooting by a whole frame. On a normal GPU (16-33 ms frames) this never triggers before u = 0.97.
    const fdt = t - (b.prevT || b.called); b.prevT = t;
    const late = u < 1 && u >= .5 && (t - b.called) + fdt / 2 > b.T * ts;   // ending now lands nearer the budget than the next frame would
    if (late) { b.cut = +u.toFixed(2) || .01; for (const e of b.ev) if (!e.done) { e.done = true; e.fn(); } for (const p of b.ups) if (b.prevU <= p.u1) p.fn(1, 0); }
    b.prevU = u; if (u >= 1 || late) battleEnd(); }

  // ---------- loop (on-demand: 30 fps idle cap, full rate while animating) ----------
  const bench = /bench/.test(Q); let pressing = false;
  addEventListener('pointerdown', () => { pressing = true; }, true); for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { pressing = false; dirty = true; }, true);
  let dirty = true, lastFrame = 0, contextLost = false; const ft = [], stats = { frames: 0, battles: 0 };
  function frame(t) { requestAnimationFrame(frame); if (contextLost || document.hidden) return;
    const anim = bench || battle || Object.values(shown).some(s => s.obj.userData.glide);
    // Input first: no idle frames while a finger is down (a slow GPU frame must never delay pointer events and turn a swipe into a
    // 0.5 s hold), and on the Low tier the scene is static between changes (no idle bob), so the main thread stays free for taps.
    if (!anim && (pressing || (tier === 'low' && !dirty))) return;
    if (!anim && !dirty && t - lastFrame < 33) return;
    const dt = t - lastFrame; lastFrame = t; dirty = false; if (dt < 200) { ft.push(dt); if (ft.length > 120) ft.shift(); }
    // shadow map: every idle frame, but during a battle only every 3rd frame (never on its first) - a 2048 shadow pass per frame was the heaviest part of a battle frame
    if (battle) { battle.sf = (battle.sf || 0) + 1; renderer.shadowMap.needsUpdate = battle.sf % 3 === 0; } else renderer.shadowMap.needsUpdate = true;
    if (battle) battleTick(t);
    for (const s of Object.values(shown)) { const o = s.obj, g = o.userData.glide; if (g) { const u = Math.min(1, (t - g.t0) / g.d); o.position.lerpVectors(g.a, g.b, u * u * (3 - 2 * u)); if (u >= 1) delete o.userData.glide; }
      else if (!reduced() && !(battle && o === battle.A)) o.position.y = SHIP_Y + Math.sin(t / 900 + o.userData.phase) * .012; }
    if (!reduced()) { T.scan.offset.y = (t / 4000) % 1; if (rain.visible) rain.position.y = -((t / 900) % 1) * .6; }
    if (shake) { const e = (t - shakeT0) / 180; if (e >= 1) { shake = 0; applyOffset(0, 0); } else { const a = view.H * .006 * (1 - e); applyOffset((Math.random() - .5) * 2 * a, (Math.random() - .5) * 2 * a); } }
    updateBatches(); renderer.info.reset(); composer.render(); stats.frames++; if (autoTier) autoTune(); if (hud) drawHud(); }
  let tuneFrames = 0; function autoTune() { if (++tuneFrames % 90) return; const s = [...ft].sort((a, b) => a - b), p50 = s[s.length >> 1];
    const cap = battle ? 18 : 36;   // idle frames are capped at ~33 ms
    if (p50 > cap * 1.15 && tier !== 'low') { tier = tier === 'high' ? 'medium' : 'low'; try { sessionStorage.setItem('sg_auto_tier', tier); } catch (e) {} applyTier(); } }
  const hud = /debug/.test(Q) && /fps/.test(Q) ? Object.assign(document.createElement('div'), { id: 'fpshud' }) : null; if (hud) document.body.append(hud);
  function drawHud() { const s = [...ft].sort((a, b) => a - b), p = q => s[Math.floor(s.length * q)] || 0; hud.textContent = `${tier} p50 ${p(.5).toFixed(1)}ms p90 ${p(.9).toFixed(1)}ms calls ${renderer.info.render.calls} tris ${renderer.info.render.triangles}`; }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; disable('context lost'); });

  function disable(reason) { document.body.classList.remove('v3d', 'sg-battle'); boardEl.style.transform = ''; canvas.style.display = 'none'; window.SGView = null; console.warn('3D view off:', reason); battle && battle.res && battle.res(); idle.splice(0).forEach(f => f()); }

  const ro = new ResizeObserver(() => { fit(); }); addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 200));
  if (sessionStorage.getItem && autoTier) { const s = sessionStorage.getItem('sg_auto_tier'); if (s && TIERS[s] && (s === 'low' || (s === 'medium' && tier === 'high'))) tier = s; }
  function prewarm() {   // compile every VFX / debris shader once, so a battle's first frame does not stall on shader compilation
    const at0 = new THREE.Vector3(0, -5, 0); sprite(T.softDot, 0xffffff, at0, .1); sprite(smokeTex, 0x302838, at0, .1, THREE.NormalBlending, .5); burst(at0, 4, 0xffffff, 1, 100);
    beamMesh(at0, at0.clone().setY(-4), 0xffffff, 0x43f7e2, .02); ring(at0, 0xffffff, .1, .2); for (const [bl, tm] of [[THREE.AdditiveBlending, false], [THREE.NormalBlending, true]]) { const ns = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff, transparent: true, blending: bl, depthWrite: false, toneMapped: tm })); ns.position.copy(at0); fx.add(ns); }   // map-less sprite variants
    { const sg = selG.clone(); sg.position.copy(at0); fx.add(sg); const hm = new THREE.Mesh(new THREE.PlaneGeometry(.1, .1), hatchMat); hm.position.copy(at0); fx.add(hm); }   // selection frame + hatching (first tap)
    for (const id of IDS) { if (frac[id]) fx.add(frac[id].clone()); fx.add(makeShipMesh(id)); }
    fx.traverse(o => o.frustumCulled = false); try { renderer.compile(scene, camera); if (composer) { renderer.setRenderTarget(composer.renderTarget1); renderer.compile(scene, camera); renderer.setRenderTarget(null); composer.render(); } else renderer.render(scene, camera); } catch (e) {} fx.clear(); renderer.info.reset(); dirty = true; }   // compile for the canvas AND the bloom render target (linear output = separate programs)
  document.body.classList.add('v3d'); applyTier(); ro.observe(document.getElementById('boardWrap'));
  prewarm(); fracP.then(() => { if (!battle) prewarm(); }); requestAnimationFrame(frame);
  const api = window.SGView = {
    sync, battle: (p, m, n) => { const r = battleStart(p, m, n); return r; }, battling: () => !!battle, skip: () => battleEnd(), onIdle: f => battle ? idle.push(f) : f(),
    cellCenter: i => { const r = cells[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; },
    // true projected square (a trapezoid): centre, width along its middle line, height along its middle column
    cellSize: i => { camera.updateMatrixWorld(); const c = cellPos(i), q = (dx, dz) => project(new THREE.Vector3(c.x + dx, 0, c.z + dz)); const L = q(-.5, 0), R = q(.5, 0), T = q(0, -.5), B = q(0, .5), C = q(0, 0);
      return { x: C[0], y: C[1], w: Math.hypot(R[0] - L[0], R[1] - L[1]), h: Math.hypot(B[0] - T[0], B[1] - T[1]) }; },
    project: (i, y = 0) => { const p = cellPos(i).setY(y); camera.updateMatrixWorld(); return project(p); },
    fit: () => ({ ...shipFit }),
    stats: () => { const s = [...ft].sort((a, b) => a - b), p = q => +(s[Math.floor(s.length * q)] || 0).toFixed(1); return { tier, gpu, software, p50: p(.5), p90: p(.9), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, frames: stats.frames, battles: stats.battles, lastBattle: stats.lastBattle, battling: !!battle, hazeTarget: battle ? haze.filter(h => h.material.opacity < .2).length : 0, fit: fitInfo, fracLoaded: Object.keys(frac).length }; },
    setTier: t => { tier = t; applyTier(); }, disable, renderNow: () => { dirty = true; updateBatches(); composer.render(); },
  };
  window.SGGame && window.SGGame.render(); fit();
  return api; }
