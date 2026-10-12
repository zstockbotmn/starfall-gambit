// Runtime PBR materials per slot + procedural textures (generated on device: 0 download bytes).
import * as THREE from 'three';
let seed = 7; export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export function canvasTex(w, h, draw, srgb = true) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
export function noiseLayer(g, w, h, n, rmin, rmax, col, alpha) { for (let i = 0; i < n; i++) { const x = rnd() * w, y = rnd() * h, r = rmin + rnd() * (rmax - rmin);
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', alpha)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); } }

// Equirect deep-space backdrop: magenta/teal nebula, dust, stars, a distant ringed planet. Baked to assets/sky.webp by tools/bake.
export function drawSky(g, w, h) { seed = 11; const k = w / 4096;
  const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#020208'); bg.addColorStop(.5, '#070a18'); bg.addColorStop(1, '#020206'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'lighter';
  noiseLayer(g, w, h * .7, 160, 80 * k, 420 * k, 'rgba(120,30,140,A)', .08); noiseLayer(g, w, h * .7, 120, 60 * k, 300 * k, 'rgba(255,40,180,A)', .06);
  noiseLayer(g, w, h * .8, 140, 80 * k, 380 * k, 'rgba(20,140,170,A)', .07); noiseLayer(g, w, h * .6, 60, 30 * k, 140 * k, 'rgba(255,200,230,A)', .03);
  // dust lane
  g.save(); g.translate(w * .3, h * .45); g.rotate(-.18); noiseLayer(g, w * .9, h * .06, 220, 10 * k, 60 * k, 'rgba(255,150,220,A)', .05); g.restore();
  for (let i = 0; i < 9000; i++) { const x = rnd() * w, y = rnd() * h, b = rnd() ** 3, s = (b > .93 ? 2.2 : b > .7 ? 1.4 : .9) * Math.max(.6, k);
    g.fillStyle = `rgba(${200 + 55 * rnd() | 0},${210 + 45 * rnd() | 0},255,${.25 + .75 * b})`; g.fillRect(x, y, s, s); }
  for (let i = 0; i < 70; i++) { const x = rnd() * w, y = rnd() * h * .9, r = (6 + rnd() * 14) * k; const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(.15, 'rgba(180,220,255,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  g.globalCompositeOperation = 'source-over';
  const px = w * .62, py = h * .40, pr = 120 * k; const pg = g.createRadialGradient(px - 50 * k, py - 60 * k, 10 * k, px, py, pr);
  pg.addColorStop(0, '#5a8fb0'); pg.addColorStop(.6, '#1d3550'); pg.addColorStop(1, '#060a14'); g.fillStyle = pg; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
  g.strokeStyle = 'rgba(200,230,255,.35)'; g.lineWidth = 3 * k; g.beginPath(); g.ellipse(px, py, pr * 1.9, pr * .32, -.22, 0, 7); g.stroke();
  g.globalCompositeOperation = 'lighter'; const at = g.createRadialGradient(px, py, pr * .95, px, py, pr * 1.25); at.addColorStop(0, 'rgba(90,220,255,.35)'); at.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = at; g.fillRect(px - 200 * k, py - 200 * k, 400 * k, 400 * k); g.globalCompositeOperation = 'source-over'; }

export function makeTextures(tier = 'high') { seed = 7; const T = {}; const s = tier === 'low' ? .5 : 1;
  T.grime = canvasTex(512 * s, 512 * s, (g, w, h) => { g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { const x = rnd() * w, y = rnd() * h, l = (20 + rnd() * 120) * s; g.strokeStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${.05 + rnd() * .12})`; g.lineWidth = .5 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rnd() * 3 - 1.5, y + l); g.stroke(); }
    noiseLayer(g, w, h, 160, 10 * s, 60 * s, 'rgba(0,0,0,A)', .18); noiseLayer(g, w, h, 80, 10 * s, 50 * s, 'rgba(255,255,255,A)', .12); }, false);
  T.puddle = canvasTex(1024 * s, 512 * s, (g, w, h) => { g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, w, h); noiseLayer(g, w, h, 120, 20 * s, 110 * s, 'rgba(0,0,0,A)', .55);
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * .15})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3); } }, false);
  T.marble = canvasTex(1024 * s, 512 * s, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(150,190,200,${.05 + rnd() * .12})`; g.lineWidth = .6 + rnd() * 1.6; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() * 120 - 30) * s; y += (rnd() * 60 - 30) * s; g.lineTo(x, y); } g.stroke(); } });
  T.scan = canvasTex(64, 256, (g, w, h) => { g.clearRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(120,255,255,${.25 + .5 * rnd()})`; g.fillRect(0, y, w, 2); } });
  T.glyph = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(120,255,255,.18)'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = 'rgba(160,255,255,.10)'; g.fillRect(0, y, w, 1); }
    g.fillStyle = 'rgba(200,255,255,.95)'; for (let r = 0; r < 6; r++) { let x = 8; const y = 10 + r * 19; while (x < w - 20) { const cw = 4 + rnd() * 10; if (rnd() < .82) g.fillRect(x, y, cw, 9 - (rnd() < .3 ? 5 : 0)); x += cw + 3; } }
    g.strokeStyle = 'rgba(220,255,255,.9)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); g.beginPath(); g.arc(w - 34, 34, 20, 0, 5); g.stroke(); });
  T.nebTile = canvasTex(512 * s, 512 * s, (g, w, h) => { g.fillStyle = '#10051e'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
    noiseLayer(g, w, h, 70, 30 * s, 160 * s, 'rgba(150,60,255,A)', .14); noiseLayer(g, w, h, 40, 20 * s, 120 * s, 'rgba(255,60,200,A)', .12); noiseLayer(g, w, h, 40, 20 * s, 100 * s, 'rgba(60,200,255,A)', .1);
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rnd()})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); } });
  T.softDot = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  for (const k of ['grime', 'puddle', 'scan', 'marble']) T[k].wrapS = T[k].wrapT = THREE.RepeatWrapping;
  return T; }

// AI hull textures (Grok Imagine -> tools/ai-textures.py): base colour + emissive maps on the ship hulls.
export function loadHullTextures(base) { const L = new THREE.TextureLoader(), H = {};
  const get = (k, f, srgb, rep) => L.loadAsync(base + 'tex/' + f).then(t => { if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; H[k] = t; });
  const R = [4, 7.2];   // hull tiles are one period of the AI pattern (aspect 0.56) squeezed to 512x512: repeat v 1.8x u
  return Promise.all([get('blue', 'blue-hull.webp', 1, R), get('blueE', 'blue-hull-emissive.webp', 1, R), get('red', 'red-hull.webp', 1, R), get('redE', 'red-hull-emissive.webp', 1, R),
    get('skin', 'red-skin-top.webp', 1), get('skinE', 'red-skin-top-emissive.webp', 1), get('holo', 'holo-atlas.webp', 1), get('redN', 'red-panel-normal.webp', 0, [1.4, 1.4]), get('redR', 'red-panel-rough.webp', 0, [1.4, 1.4]), get('redAO', 'red-panel-ao.webp', 0, [1.4, 1.4])]).then(() => H, () => H); }
export function applyHullTextures(M, H) {
  if (H.blue) Object.assign(M.ceramic, { map: H.blue, emissive: new THREE.Color(0xffffff), emissiveMap: H.blueE, emissiveIntensity: 1.4 });
  if (H.red) Object.assign(M.plate, { map: H.red, color: new THREE.Color(0xb8b4c4), emissive: new THREE.Color(0xffffff), emissiveMap: H.redE, emissiveIntensity: 2.2 });
  if (H.skin) Object.assign(M.redSkin, { emissiveMap: H.skinE });   // no dark AI colour map on the hull any more: lighter gunmetal + procedural panel maps carry the surface; the AI sheet still drives the neon
  if (H.red) Object.assign(M.rPlate, { map: H.red, color: new THREE.Color(0x8a8898), emissive: new THREE.Color(0xffffff), emissiveMap: H.redE, emissiveIntensity: .7 });
  if (H.holo) M.holoAtlas.map = H.holo;
  if (H.redN) for (const k of ['redSkin', 'rGun', 'rPlate']) Object.assign(M[k], { normalMap: H.redN, normalScale: new THREE.Vector2(1.3, 1.3), roughnessMap: H.redR, roughness: 1, aoMap: H.redAO, aoMapIntensity: 1, needsUpdate: true });   // fine panel lines: grooves in normal + AO (darkens the reflections in the seams), tone-varied wet roughness
  for (const k of ['ceramic', 'plate', 'redSkin', 'rPlate', 'holoAtlas']) M[k].needsUpdate = true; }
export function makeMaterials(T, tier = 'high', opt = {}) { const hi = tier !== 'low';
  const Phys = hi ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  const M = {
    ceramic: new Phys({ color: 0xe8e4dc, roughness: .28, metalness: 0, ...(hi ? { clearcoat: 1, clearcoatRoughness: .1, sheen: .3, sheenColor: new THREE.Color(0xbff6ff) } : {}), envMapIntensity: .5 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xf0bb55, metalness: 1, roughness: .2 }),
    tealGlow: new THREE.MeshStandardMaterial({ color: 0x062a28, emissive: 0x43f7e2, emissiveIntensity: 2.4 }),
    glass: new Phys({ color: 0x8fdcff, metalness: 0, roughness: .03, transparent: true, opacity: .55, envMapIntensity: 2.5, ...(hi ? { clearcoat: 1 } : {}) }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xc4c8d8, metalness: .85, roughness: .4, roughnessMap: T.grime, bumpMap: T.grime, bumpScale: 1.2 }),
    plate: new THREE.MeshStandardMaterial({ color: 0x1b1822, metalness: .7, roughness: .5, roughnessMap: T.grime, bumpMap: T.grime, bumpScale: 2 }),
    gunmetal: new THREE.MeshStandardMaterial({ color: 0x2a2c34, metalness: .9, roughness: .38, roughnessMap: T.grime }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x08080a, metalness: .1, roughness: .8 }),
    neonM: new THREE.MeshStandardMaterial({ color: 0x30001f, emissive: 0xff2bd6, emissiveIntensity: 3 }),
    neonC: new THREE.MeshStandardMaterial({ color: 0x00262a, emissive: 0x19f0ff, emissiveIntensity: 3 }),
    holo: new THREE.MeshBasicMaterial({ color: 0x66ffff, map: T.scan, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    energy: new THREE.MeshBasicMaterial({ color: 0x3ff5e0, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    stripM: new THREE.MeshStandardMaterial({ color: 0x200018, emissive: 0xff2bd6, emissiveIntensity: .55 }),
    stripT: new THREE.MeshStandardMaterial({ color: 0x002020, emissive: 0x4ff0e0, emissiveIntensity: .4 }),
    divider: new THREE.MeshStandardMaterial({ color: 0x101010, emissive: 0xc8b0ff, emissiveIntensity: 1.2 }),
    tileB0: new Phys({ color: 0x2c6c7a, metalness: .25, roughness: .14, map: T.marble, envMapIntensity: .8, ...(hi ? { clearcoat: 1, clearcoatRoughness: .05 } : {}) }),
    tileB1: new Phys({ color: 0x215a68, metalness: .25, roughness: .14, map: T.marble, envMapIntensity: .8, ...(hi ? { clearcoat: 1, clearcoatRoughness: .05 } : {}) }),
    tileR0: new THREE.MeshStandardMaterial({ color: 0x1d1024, metalness: .65, roughness: .3, roughnessMap: T.puddle, bumpMap: T.grime, bumpScale: 1.5 }),
    tileR1: new THREE.MeshStandardMaterial({ color: 0x140a1a, metalness: .65, roughness: .3, roughnessMap: T.puddle, bumpMap: T.grime, bumpScale: 1.5 }),
    nebula: new THREE.MeshStandardMaterial({ color: 0x220a40, emissive: 0xffffff, emissiveMap: T.nebTile, emissiveIntensity: 1.3, roughness: .2, metalness: .2 }),
  };
  M.holoGlyph = new THREE.MeshBasicMaterial({ color: 0x8affff, map: T.glyph, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  M.holoGlyphPink = M.holoGlyph.clone(); M.holoGlyphPink.color.set(0xff7ae8);
  // Red hulls: dark, glossy, rain-slick gunmetal (low roughness, clearcoat, strong reflections); neon at half strength so slits read as accents
  // clearcoat only for close-ups (opt.hero): in the play view it doubled the Red fragment cost; low roughness + strong env reflections keep the wet look
  const wet = hi && opt.hero ? { clearcoat: 1, clearcoatRoughness: .06 } : {}, RedPhys = hi && opt.hero ? Phys : THREE.MeshStandardMaterial;
  M.redSkin = new RedPhys({ color: 0x6c6a7a, metalness: .6, roughness: .18, emissive: 0xffffff, emissiveIntensity: .9, envMapIntensity: 2.2, ...wet });
  M.rGun = new RedPhys({ color: 0x5a5e6c, metalness: .6, roughness: .16, envMapIntensity: 2.4, ...wet });
  M.rPlate = new RedPhys({ color: 0x4c4a58, metalness: .6, roughness: .22, envMapIntensity: 2.2, ...wet });
  M.rNeonM = new THREE.MeshStandardMaterial({ color: 0x30001f, emissive: 0xff2bd6, emissiveIntensity: 1.5 });
  M.rNeonC = new THREE.MeshStandardMaterial({ color: 0x00262a, emissive: 0x19f0ff, emissiveIntensity: 1.5 });
  M.holoAtlas = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  M.holoPink = M.holo.clone(); M.holoPink.color.set(0xff6ae6); M.holoPink.opacity = .35;
  for (const [k, m] of Object.entries(M)) m.name = k;
  return M; }

// Reflection environment: backdrop + bright studio panels (gives gold/chrome their highlights).
export function makeEnvironment(renderer, sky) { const es = new THREE.Scene(); es.background = sky; es.backgroundRotation.y = 0.6;
  const panel = (c, i, w, h, p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...p); m.lookAt(0, 0, 0); es.add(m); };
  panel('#fff4e0', 6, 8, 3, [-6, 9, 6]); panel('#bff8ff', 3, 6, 2, [7, 5, 7]); panel('#ff40d0', 4, 14, 1.2, [0, .4, -9]); panel('#dfefff', 2.2, 14, 3, [0, 5.5, -8]); panel('#30f0ff', 4, 2.5, 10, [-9, 2, -4]); panel('#ff40d0', 3, 3, 9, [9, 2, -3]); panel('#30f0ff', 2.5, 12, 1.5, [0, -3, -8]); panel('#ffffff', 1.5, 14, 2, [0, 1, 10]); panel('#ffffff', 2, 12, 12, [0, 14, 0]);
  const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(es, 0.02).texture; pm.dispose(); return t; }
