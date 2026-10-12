// Starfall Gambit M3 — ship + board model library (source of the baked GLB assets).
// Each builder returns a THREE.Group whose meshes use *material slot names* (mesh.userData.slot).
// tools/bake.html merges each ship per slot and exports assets/models/<id>.glb; at runtime
// src/materials.js rebuilds PBR materials per slot (procedural grime/marble maps cost 0 bytes of download).
// Detail q: 1 = LOD0 (close-ups/battles), 0.5 = LOD1 (play view).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SLOTS = ['ceramic', 'gold', 'tealGlow', 'glass', 'chrome', 'plate', 'neonM', 'neonC', 'holo', 'holoPink', 'holoGlyph', 'holoGlyphPink', 'energy', 'gunmetal', 'rubber'];
let Q = 1; const S = n => Math.max(6, Math.round(n * Q));
const P = (geo, slot) => { const m = new THREE.Mesh(geo); m.userData.slot = slot; return m; };
const V2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
function ext(pts, depth, bevel = .015, segs = 2) { const g = new THREE.ExtrudeGeometry(new THREE.Shape(V2(pts)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: Math.max(1, Math.round(segs * Q)), curveSegments: S(12) });
  g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0); return g; }               // (x, forward) -> forward = -z
function lathe(profile, seg = 48) { const g = new THREE.LatheGeometry(V2(profile), S(seg)); g.rotateX(-Math.PI / 2); return g; } // axis along z, +y profile = -z
const at = (m, x = 0, y = 0, z = 0) => (m.position.set(x, y, z), m);
const mirror = (g, m) => { const b = m.clone(); b.position.x *= -1; b.scale.x *= -1; b.rotation.y *= -1; b.rotation.z *= -1; g.add(m, b); };

// ================= BLUE: gleaming utopia — warm-white ceramic, brushed gold, teal light, glass =================
function blueFlagship() { const g = new THREE.Group();
  const body = P(lathe([[0, .48], [.03, .45], [.07, .38], [.115, .26], [.15, .08], [.158, -.1], [.145, -.26], [.11, -.36], [.07, -.40], [0, -.41]], 56), 'ceramic'); body.scale.y = .6; g.add(body);
  // swept wings with gold leading edge and teal light seams
  const W = [[.08, .06], [.30, -.10], [.45, -.24], [.47, -.36], [.36, -.34], [.22, -.27], [.1, -.22]];
  mirror(g, P(ext(W, .03, .012, 3), 'ceramic'));
  mirror(g, at(P(ext([[.30, -.10], [.45, -.24], [.465, -.27], [.31, -.135]], .036, .006), 'gold')));
  mirror(g, at(P(ext([[.14, -.12], [.40, -.29], [.40, -.305], [.14, -.14]], .008, .002), 'tealGlow'), 0, .022, 0));
  // wingtip nacelles
  for (const s of [1, -1]) { const n = P(lathe([[0, .1], [.022, .07], [.03, 0], [.026, -.08], [0, -.1]], 24), 'ceramic'); n.position.set(s * .44, .0, -.30); g.add(n);
    const ng = P(new THREE.CylinderGeometry(.02, .016, .01, S(20)), 'tealGlow'); ng.rotation.x = Math.PI / 2; ng.position.set(s * .44, 0, -.20); g.add(ng);
    const nr = P(new THREE.TorusGeometry(.029, .005, S(8), S(28)), 'gold'); nr.position.set(s * .44, 0, -.3); g.add(nr); }
  // gold bands, spine fin, glass canopy, teal core and engine bell
  for (const [z, r] of [[-.06, .156], [.13, .135], [.3, .1]]) { const b = P(new THREE.TorusGeometry(r, .01, S(12), S(56)), 'gold'); b.position.z = z; b.scale.y = .62; g.add(b); }
  const can = P(new THREE.SphereGeometry(.075, S(36), S(18)), 'glass'); can.scale.set(.82, .5, 1.7); can.position.set(0, .075, -.2); g.add(can);
  const canR = P(new THREE.TorusGeometry(.064, .006, S(8), S(36)), 'gold'); canR.scale.set(.82, 1.7, 1); canR.rotation.x = Math.PI / 2; canR.position.set(0, .07, -.2); g.add(canR);
  const fin = P(ext([[0, .12], [0, .36], [.11, .40], [.08, .22]], .018, .006), 'ceramic'); fin.rotation.z = Math.PI / 2; fin.position.y = .085; g.add(fin);
  const finE = P(ext([[0, .36], [.11, .40], [.115, .385], [.01, .345]], .022, .003), 'gold'); finE.rotation.z = Math.PI / 2; finE.position.y = .085; g.add(finE);
  const core = P(new THREE.SphereGeometry(.03, S(16), S(12)), 'tealGlow'); core.position.set(0, .093, .02); g.add(core);
  const bell = P(new THREE.CylinderGeometry(.085, .06, .06, S(36), 1, true), 'gold'); bell.rotation.x = Math.PI / 2; bell.position.z = .44; g.add(bell);
  const eng = P(new THREE.CircleGeometry(.07, S(32)), 'tealGlow'); eng.position.z = .43; g.add(eng);
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, d = P(new THREE.SphereGeometry(.008, S(8), S(6)), 'tealGlow'); d.position.set(Math.cos(a) * .12, Math.sin(a) * .075, .2); g.add(d); }
  g.scale.setScalar(1.18); return g; }

function blueDrone() { const g = new THREE.Group();
  const c = P(new THREE.SphereGeometry(.11, S(40), S(24)), 'ceramic'); c.scale.y = .66; g.add(c);
  const cr = P(new THREE.TorusGeometry(.112, .011, S(12), S(48)), 'gold'); cr.rotation.x = Math.PI / 2; g.add(cr);
  const cc = P(new THREE.SphereGeometry(.05, S(20), S(14)), 'glass'); cc.position.y = .05; g.add(cc);
  const ci = P(new THREE.SphereGeometry(.03, S(16), S(12)), 'tealGlow'); ci.position.y = .055; g.add(ci);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2, d = .27, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const arm = P(new THREE.CylinderGeometry(.014, .02, d - .08, S(14)), 'ceramic'); arm.rotation.z = Math.PI / 2; arm.rotation.y = -a; arm.position.set(x / 2, 0, z / 2); g.add(arm);
    const armG = P(new THREE.CylinderGeometry(.021, .021, .02, S(14)), 'gold'); armG.rotation.z = Math.PI / 2; armG.rotation.y = -a; armG.position.set(x * .62, 0, z * .62); g.add(armG);
    const pod = P(new THREE.SphereGeometry(.085, S(32), S(20)), 'ceramic'); pod.scale.y = .6; pod.position.set(x, 0, z); g.add(pod);
    const duct = P(new THREE.TorusGeometry(.09, .012, S(10), S(40)), 'gold'); duct.rotation.x = Math.PI / 2; duct.position.set(x, 0, z); g.add(duct);
    const fan = P(new THREE.CircleGeometry(.07, S(24)), 'tealGlow'); fan.rotation.x = Math.PI / 2; fan.position.set(x, -.052, z); g.add(fan);
    const lt = P(new THREE.SphereGeometry(.022, S(12), S(8)), 'tealGlow'); lt.position.set(x, .045, z); g.add(lt); }
  return g; }

function blueLancer() { const g = new THREE.Group();
  const hull = P(lathe([[0, .12], [.04, .06], [.068, -.06], [.072, -.16], [.062, -.27], [.04, -.33], [0, -.35]], 40), 'ceramic'); hull.scale.y = .7; hull.position.z = .08; g.add(hull);
  const shaft = P(new THREE.CylinderGeometry(.014, .02, .6, S(18)), 'gold'); shaft.rotation.x = Math.PI / 2; shaft.position.z = -.24; g.add(shaft);
  for (const z of [-.18, -.3, -.42]) { const c = P(new THREE.TorusGeometry(.024, .006, S(8), S(20)), 'tealGlow'); c.position.z = z; g.add(c); }
  const head = P(new THREE.ConeGeometry(.05, .18, S(4)), 'gold'); head.rotation.x = -Math.PI / 2; head.rotation.y = Math.PI / 4; head.position.z = -.62; g.add(head);
  const headB = P(new THREE.OctahedronGeometry(.03, 0), 'tealGlow'); headB.position.z = -.52; g.add(headB);
  mirror(g, P(ext([[.04, -.22], [.15, -.38], [.14, -.43], [.04, -.37]], .014, .006), 'ceramic'));
  mirror(g, P(ext([[.15, -.38], [.14, -.43], [.13, -.425], [.142, -.385]], .018, .003), 'gold'));
  const can = P(new THREE.SphereGeometry(.04, S(24), S(12)), 'glass'); can.scale.set(.8, .55, 1.8); can.position.set(0, .04, -.02); g.add(can);
  const bell = P(new THREE.CylinderGeometry(.045, .032, .04, S(24), 1, true), 'gold'); bell.rotation.x = Math.PI / 2; bell.position.z = .44; g.add(bell);
  const eng = P(new THREE.CircleGeometry(.04, S(24)), 'tealGlow'); eng.position.z = .43; g.add(eng);
  const r = P(new THREE.TorusGeometry(.07, .008, S(8), S(32)), 'gold'); r.position.z = .08; r.scale.y = .7; g.add(r);
  return g; }

function blueShield() { const g = new THREE.Group();   // reads at the 62° play angle: a tall curved white wall (crescent) with gold crest + teal band over a saucer emitter
  const R0 = .40, R1 = .33, a0 = Math.PI * .18, a1 = Math.PI * .82, pts = [];
  for (let k = 0; k <= 24; k++) { const a = a0 + (a1 - a0) * k / 24; pts.push([Math.cos(a) * R0, Math.sin(a) * R0 - .16]); }
  for (let k = 24; k >= 0; k--) { const a = a0 + (a1 - a0) * k / 24; pts.push([Math.cos(a) * R1, Math.sin(a) * R1 - .14]); }
  const wall = P(ext(pts, .2, .02, 3), 'ceramic'); wall.position.y = .06; g.add(wall);
  const crest = P(ext(pts, .02, .008), 'gold'); crest.scale.set(1.02, 1, 1.02); crest.position.y = .175; g.add(crest);
  const band = P(ext(pts, .012, .002), 'tealGlow'); band.scale.set(1.03, 1, 1.03); band.position.y = .09; g.add(band);
  const base = P(lathe([[0, .14], [.12, .12], [.17, .06], [.18, 0], [.15, -.04], [0, -.05]].map(p => [p[1] < 0 ? p[0] : p[0], p[1]]), 40), 'ceramic'); base.rotation.x = 0; base.geometry.rotateX(Math.PI / 2); base.scale.set(1, 1, 1); base.position.set(0, -.02, .02);
  g.add(base);
  const baseR = P(new THREE.TorusGeometry(.175, .01, S(10), S(48)), 'gold'); baseR.rotation.x = Math.PI / 2; baseR.position.set(0, -.02, .02); g.add(baseR);
  const ec = P(new THREE.SphereGeometry(.05, S(20), S(14)), 'tealGlow'); ec.position.set(0, .07, .04); g.add(ec);
  const dome = P(new THREE.SphereGeometry(.46, S(64), S(24), Math.PI * .18, Math.PI * .64, Math.PI * .2, Math.PI * .3), 'energy'); dome.rotation.y = Math.PI; dome.position.set(0, -.12, .16); g.add(dome);
  for (const a of [.3, .5, .7]) { const x = Math.cos(Math.PI * a) * .405, z = -(Math.sin(Math.PI * a) * .405 - .16); g.add(at(P(new THREE.SphereGeometry(.016, 10, 8), 'tealGlow'), x, .135, z)); }
  return g; }

// ================= RED: gritty neon cyberpunk — dark gunmetal hulls, chrome trims, magenta/cyan neon edge-lights, hologram panels =================
// Helpers: chrome trim lip around a hull outline, neon edge strips along its top perimeter, hologram panels, greebles, cables.
const underglow = (pts, s = 1.08) => { const o = P(ext(pts, .012, .004), 'neonM'); o.scale.set(s, 1, s); o.position.y = -.035; return o; };
const vent = (w, l) => { const g = new THREE.Group(); g.add(P(new THREE.BoxGeometry(w, .012, l), 'gunmetal')); for (let k = 0; k < 4; k++) g.add(at(P(new THREE.BoxGeometry(w * .8, .006, l * .08), 'rubber'), 0, .008, -l / 2 + l * (k + .5) / 4)); return g; };
function trimLip(pts, y, s = 1.035, d = .016) { const o = P(ext(pts, d, .004), 'chrome'); o.scale.set(s, 1, s); o.position.y = y; return o; }
function edgeStrips(g, pts, y, slot, s = 1.0, w = .008, skip = () => false) { const n = pts.length;
  for (let k = 0; k < n; k++) { if (skip(k)) continue; const a = pts[k], b = pts[(k + 1) % n]; const ax = a[0] * s, az = -a[1] * s, bx = b[0] * s, bz = -b[1] * s; const L = Math.hypot(bx - ax, bz - az); if (L < .03) continue;
    const m = P(new THREE.BoxGeometry(w, w, L * .86), slot); m.position.set((ax + bx) / 2, y, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az); g.add(m); } }
function holoPanel(g, w, h, x, y, z, ry = 0, slot = 'holoGlyph') { const p = P(new THREE.PlaneGeometry(w, h), slot); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  const fr = new THREE.Group(); fr.position.set(x, y, z); fr.rotation.y = ry; for (const sy of [-1, 1]) fr.add(at(P(new THREE.BoxGeometry(w + .012, .006, .006), 'chrome'), 0, sy * h / 2, 0));
  for (const sx of [-1, 1]) fr.add(at(P(new THREE.BoxGeometry(.006, h, .006), 'neonC'), sx * w / 2, 0, 0)); g.add(fr);
  g.add(at(P(new THREE.CylinderGeometry(.004, .004, y - h / 2, 5), 'chrome'), x, (y - h / 2) / 2, z)); }
let gs = 3; const grnd = () => ((gs = (gs * 16807) % 2147483647) / 2147483647);
function greebles(g, n, x0, x1, z0, z1, y, seed = 3) { gs = seed; for (let k = 0; k < n; k++) { const w = .015 + grnd() * .035, l = .015 + grnd() * .05, h = .008 + grnd() * .018;
  const m = P(new THREE.BoxGeometry(w, h, l), grnd() < .6 ? 'gunmetal' : 'chrome'); m.position.set(x0 + grnd() * (x1 - x0), y + h / 2, z0 + grnd() * (z1 - z0)); g.add(m);
  if (grnd() < .25) g.add(at(P(new THREE.BoxGeometry(w * .5, .004, .004), grnd() < .5 ? 'neonC' : 'neonM'), m.position.x, y + h + .002, m.position.z)); } }
function cable(g, pts, r = .006) { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); g.add(P(new THREE.TubeGeometry(c, S(16), r, S(6)), 'rubber')); }
const antenna = (g, x, z, h, base = .02, tip = 'neonM') => { g.add(at(P(new THREE.CylinderGeometry(.004, .006, h, 6), 'chrome'), x, base + h / 2, z)); g.add(at(P(new THREE.SphereGeometry(.01, 8, 6), tip), x, base + h, z)); };

function redFlagship() { const g = new THREE.Group();
  const H = [[0, .42], [.12, .28], [.36, .22], [.42, .02], [.3, -.06], [.16, -.04], [.1, -.3], [0, -.4], [-.1, -.3], [-.16, -.04], [-.3, -.06], [-.42, .02], [-.36, .22], [-.12, .28]];
  g.add(P(ext(H, .08, .02, 3), 'plate')); g.add(underglow(H)); g.add(trimLip(H, .03));
  edgeStrips(g, H, .052, 'neonM', 1.03, .008, k => k % 2 === 1);
  const T = [[0, .3], [.1, .18], [.1, -.12], [0, -.26], [-.1, -.12], [-.1, .18]];
  g.add(at(P(ext(T, .06, .01, 2), 'chrome'), 0, .07, 0)); edgeStrips(g, T, .105, 'neonC', 1.0, .006);
  mirror(g, at(vent(.1, .12), .26, .045, .1)); mirror(g, at(vent(.05, .1), .06, .105, .1));
  // command tower with hex crown + holo reticle
  g.add(at(P(new THREE.CylinderGeometry(.075, .085, .06, 6), 'gunmetal'), 0, .13, .02)); g.add(at(P(new THREE.CylinderGeometry(.082, .082, .012, 6), 'neonC'), 0, .165, .02));
  g.add(at(P(new THREE.CylinderGeometry(.05, .06, .03, 6), 'chrome'), 0, .186, .02));
  g.add(at(P(new THREE.CylinderGeometry(.2, .2, .2, S(48), 1, true), 'holo'), 0, .32, 0));
  const ring = P(new THREE.TorusGeometry(.2, .004, 6, S(48)), 'neonC'); ring.rotation.x = Math.PI / 2; ring.position.y = .22; g.add(ring);
  const ring2 = ring.clone(); ring2.position.y = .42; g.add(ring2);
  holoPanel(g, .16, .09, .25, .2, .02, -Math.PI / 2 + .3); holoPanel(g, .16, .09, -.25, .2, .02, Math.PI / 2 - .3, 'holoGlyphPink');
  for (const s of [1, -1]) { const e = P(new THREE.CylinderGeometry(.03, .036, .1, S(14)), 'gunmetal'); e.rotation.x = Math.PI / 2; e.position.set(s * .08, 0, .35); g.add(e);
    const eg = P(new THREE.CircleGeometry(.026, S(14)), 'neonC'); eg.position.set(s * .08, 0, .401); g.add(eg);
    for (let k = 0; k < 2; k++) g.add(at(P(new THREE.TorusGeometry(.034, .004, 6, S(14)), 'chrome'), s * .08, 0, .32 + k * .04));
    const st = P(new THREE.BoxGeometry(.18, .012, .02), 'neonM'); st.position.set(s * .27, .05, .14); st.rotation.y = s * .25; g.add(st);
    const gun = P(new THREE.CylinderGeometry(.008, .012, .2, S(8)), 'chrome'); gun.rotation.x = Math.PI / 2; gun.position.set(s * .39, .03, -.04); g.add(gun);
    g.add(at(P(new THREE.BoxGeometry(.04, .03, .07), 'gunmetal'), s * .39, .03, .06)); g.add(at(P(new THREE.BoxGeometry(.006, .006, .06), 'neonC'), s * .39, .048, .06));
    cable(g, [[s * .12, .1, .12], [s * .2, .09, .18], [s * .3, .05, .12]]); }
  greebles(g, 14, -.32, .32, .02, .22, .04, 5);
  antenna(g, .06, .2, .24, .1); antenna(g, -.05, .22, .16, .1, 'neonC');
  g.scale.setScalar(1.05); return g; }

function redDrone() { const g = new THREE.Group();
  const core = P(new THREE.BoxGeometry(.15, .08, .15), 'plate'); core.rotation.y = Math.PI / 4; g.add(core);
  const cap = P(new THREE.CylinderGeometry(.075, .095, .03, 4), 'chrome'); cap.position.y = .055; g.add(cap);
  const c2 = P(new THREE.BoxGeometry(.06, .04, .06), 'neonC'); c2.position.y = .08; c2.rotation.y = Math.PI / 4; g.add(c2);
  g.add(at(P(new THREE.CylinderGeometry(.12, .12, .02, S(24)), 'gunmetal'), 0, -.03, 0));
  const r = P(new THREE.TorusGeometry(.12, .005, 6, S(32)), 'neonM'); r.rotation.x = Math.PI / 2; r.position.y = -.02; g.add(r);
  const blade = [[0, .06], [.055, .2], [.0, .42], [-.055, .2]];
  for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.add(P(ext(blade, .05, .01, 3), 'plate')); b.add(underglow(blade, 1.12)); b.add(trimLip(blade, .02, 1.06, .012));
    edgeStrips(b, blade, .034, k % 2 ? 'neonM' : 'neonC', 1.0, .006);
    b.add(at(P(new THREE.BoxGeometry(.04, .02, .04), 'neonC'), 0, .04, -.3));
    b.add(at(P(new THREE.CylinderGeometry(.014, .014, .07, 8), 'gunmetal'), 0, .0, -.08)); b.add(at(P(new THREE.BoxGeometry(.03, .015, .025), 'chrome'), 0, .035, -.15));
    b.rotation.y = Math.PI / 4 + k * Math.PI / 2; g.add(b); }
  holoPanel(g, .09, .05, 0, .17, -.02, 0, 'holoGlyphPink'); antenna(g, .04, .03, .12, .07, 'neonC');
  return g; }

function redLancer() { const g = new THREE.Group();
  const H = [[0, .45], [.06, .22], [.09, -.1], [.05, -.3], [-.05, -.3], [-.09, -.1], [-.06, .22]];
  g.add(P(ext(H, .07, .015, 3), 'plate')); g.add(underglow(H, 1.15)); g.add(trimLip(H, .028, 1.05));
  edgeStrips(g, H, .045, 'neonM', 1.06, .006);
  // twin rail barrels (railgun) with cyan coils
  for (const s of [1, -1]) { const rail = P(new THREE.BoxGeometry(.016, .022, .5), 'chrome'); rail.position.set(s * .03, .055, -.14); g.add(rail);
    g.add(at(P(new THREE.BoxGeometry(.006, .006, .44), 'neonC'), s * .03, .068, -.14));
    for (let k = 0; k < 4; k++) g.add(at(P(new THREE.BoxGeometry(.03, .03, .012), 'gunmetal'), s * .03, .055, -.3 + k * .07)); }
  g.add(at(P(ext([[0, .53], [.025, .32], [-.025, .32]], .02, .004), 'neonM'), 0, .055, 0));
  for (const s of [1, -1]) { const e = P(new THREE.CylinderGeometry(.022, .026, .14, S(12)), 'gunmetal'); e.rotation.x = Math.PI / 2; e.position.set(s * .035, 0, .34); g.add(e);
    const eg = P(new THREE.CircleGeometry(.018, S(12)), 'neonC'); eg.position.set(s * .035, 0, .411); g.add(eg);
    for (let k = 0; k < 3; k++) g.add(at(P(new THREE.TorusGeometry(.026, .004, 6, S(14)), 'chrome'), s * .035, 0, .3 + k * .03)); }
  g.add(at(vent(.06, .08), 0, .05, .16)); holoPanel(g, .08, .05, .0, .14, .1, Math.PI / 2);
  greebles(g, 6, -.05, .05, .02, .12, .045, 9); antenna(g, -.04, .16, .1, .04);
  return g; }

function redShield() { const g = new THREE.Group();
  const H = [[-.46, -.1], [-.4, .12], [-.24, .26], [0, .32], [.24, .26], [.4, .12], [.46, -.1], [.33, -.16], [.27, .02], [0, .12], [-.27, .02], [-.33, -.16]];
  g.add(P(ext(H, .12, .02, 3), 'plate')); g.add(underglow(H, 1.04)); g.add(trimLip(H, .06, 1.02, .014));
  edgeStrips(g, H, .078, 'neonM', 1.025, .008, k => k >= 7);
  const arc = P(new THREE.TorusGeometry(.3, .014, S(8), S(48), Math.PI * .7), 'neonC'); arc.rotation.set(Math.PI / 2, 0, Math.PI * .15); arc.position.set(0, .085, .12); g.add(arc);
  for (const x of [-.3, -.15, .15, .3]) { g.add(at(P(new THREE.BoxGeometry(.07, .035, .06), 'chrome'), x, .085, -.05 + Math.abs(x) * .15)); g.add(at(P(new THREE.BoxGeometry(.05, .006, .006), 'neonC'), x, .105, -.02 + Math.abs(x) * .15)); }
  g.add(at(P(new THREE.CylinderGeometry(.05, .065, .09, 6), 'gunmetal'), 0, .05, .02)); g.add(at(P(new THREE.SphereGeometry(.03, S(12), S(8)), 'neonM'), 0, .11, .02));
  // projected hologram wall with emitter posts
  const wall = P(new THREE.CylinderGeometry(.5, .5, .26, S(48), 1, true, -Math.PI * .32, Math.PI * .64), 'holoPink'); wall.position.set(0, .14, .3); g.add(wall);
  for (const a of [-.32, 0, .32]) { const x = Math.sin(a * Math.PI) * .5, z = .3 + Math.cos(a * Math.PI) * -.5; g.add(at(P(new THREE.CylinderGeometry(.012, .016, .3, 6), 'chrome'), x, .1, z)); g.add(at(P(new THREE.SphereGeometry(.014, 8, 6), 'neonM'), x, .26, z)); }
  holoPanel(g, .12, .07, 0, .2, .12, 0);
  mirror(g, at(vent(.08, .1), .36, .07, -.02)); greebles(g, 8, -.2, .2, .1, .2, .06, 13);
  return g; }

export const BUILDERS = { bF: blueFlagship, bD: blueDrone, bL: blueLancer, bS: blueShield, rF: redFlagship, rD: redDrone, rL: redLancer, rS: redShield };
export function buildShip(id, q = 1) { Q = q; const g = BUILDERS[id](); g.name = id; Q = 1; return g; }

// ================= BOARD: slab + trims + grid strips (tiles are instanced at runtime) =================
export function buildBoard(q = 1) { Q = q; const g = new THREE.Group(); g.name = 'board';
  g.add(at(P(new RoundedBoxGeometry(6.5, .3, 6.5, Math.max(1, Math.round(4 * q)), .08), 'gunmetal'), 0, -.27, 0));
  g.add(at(P(new RoundedBoxGeometry(6.56, .08, .16, 3, .03), 'gold'), 0, -.14, 3.2));
  g.add(at(P(new RoundedBoxGeometry(6.56, .05, .06, 2, .02), 'neonM'), 0, -.14, -3.24));
  for (const sx of [-1, 1]) { g.add(at(P(new THREE.BoxGeometry(.05, .04, 3.1), 'neonC'), sx * 3.24, -.14, -1.6)); g.add(at(P(new THREE.BoxGeometry(.07, .06, 3.1), 'gold'), sx * 3.24, -.14, 1.6));
    for (let k = 0; k < 5; k++) g.add(at(P(new THREE.BoxGeometry(.04, .14, .12), 'plate'), sx * 3.27, -.27, -3 + k * .6)); }   // grimy rivet blocks on the Red flank
  for (let k = 0; k <= 6; k++) { const x = k - 3; g.add(at(P(new THREE.BoxGeometry(.025, .02, 3), 'stripM'), x, -.005, -1.5)); g.add(at(P(new THREE.BoxGeometry(.025, .02, 3), 'stripT'), x, -.005, 1.5));
    const z = k - 3; if (z !== 0) g.add(at(P(new THREE.BoxGeometry(6, .02, .025), z < 0 ? 'stripM' : 'stripT'), 0, -.005, z)); }
  g.add(at(P(new THREE.BoxGeometry(6.2, .03, .05), 'divider'), 0, 0, 0));
  Q = 1; return g; }
export const TILE = { w: .94, h: .12, r: .035 };
