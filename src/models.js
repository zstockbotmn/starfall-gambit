// Starfall Gambit M3 — ship + board model library (source of the baked GLB assets).
// Each builder returns a THREE.Group whose meshes use *material slot names* (mesh.userData.slot).
// tools/bake.html merges each ship per slot and exports assets/models/<id>.glb; at runtime
// src/materials.js rebuilds PBR materials per slot (procedural grime/marble maps cost 0 bytes of download).
// Detail q: 1 = LOD0 (close-ups/battles), 0.5 = LOD1 (play view).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SLOTS = ['ceramic', 'gold', 'tealGlow', 'glass', 'chrome', 'plate', 'neonM', 'neonC', 'holo', 'holoPink', 'energy', 'gunmetal', 'rubber'];
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

function blueShield() { const g = new THREE.Group();
  const shell = P(new THREE.SphereGeometry(.42, S(64), S(24), Math.PI * .2, Math.PI * .6, Math.PI * .28, Math.PI * .3), 'ceramic'); shell.rotation.y = Math.PI; shell.position.set(0, -.18, .14); shell.scale.set(1, .9, .9); g.add(shell);
  const inner = P(new THREE.SphereGeometry(.405, S(64), S(24), Math.PI * .2, Math.PI * .6, Math.PI * .28, Math.PI * .3), 'gold'); inner.geometry.scale(-1, 1, 1); inner.rotation.y = Math.PI; inner.position.set(0, -.18, .14); inner.scale.set(1, .9, .9); g.add(inner);
  const rim = P(new THREE.TorusGeometry(.4, .016, S(12), S(64), Math.PI * .6), 'gold'); rim.rotation.set(Math.PI / 2, 0, Math.PI * .2); rim.position.set(0, .02, .14); rim.scale.set(1, .9, 1); g.add(rim);
  for (const a of [-.35, 0, .35]) { const rib = P(new THREE.BoxGeometry(.012, .16, .02), 'tealGlow'); rib.position.set(Math.sin(a) * .385, -.04, .14 - Math.cos(a) * .35); rib.rotation.y = -a; rib.rotation.x = -.25; g.add(rib); }
  const dome = P(new THREE.SphereGeometry(.47, S(64), S(24), Math.PI * .2, Math.PI * .6, Math.PI * .22, Math.PI * .36), 'energy'); dome.rotation.y = Math.PI; dome.position.set(0, -.18, .14); g.add(dome);
  const em = P(new THREE.SphereGeometry(.07, S(24), S(16)), 'ceramic'); em.position.set(0, 0, .2); em.scale.y = .7; g.add(em);
  const emR = P(new THREE.TorusGeometry(.07, .008, S(8), S(32)), 'gold'); emR.rotation.x = Math.PI / 2; emR.position.set(0, 0, .2); g.add(emR);
  const ec = P(new THREE.SphereGeometry(.034, S(16), S(12)), 'tealGlow'); ec.position.set(0, .03, .19); g.add(ec);
  return g; }

// ================= RED: gritty neon cyberpunk — grimy chrome, gunmetal plating, magenta/cyan neon, holograms =================
const underglow = (pts, s = 1.08) => { const o = P(ext(pts, .012, .004), 'neonM'); o.scale.set(s, 1, s); o.position.y = -.035; return o; };
const vent = (w, l) => { const g = new THREE.Group(); g.add(P(new THREE.BoxGeometry(w, .012, l), 'gunmetal')); for (let k = 0; k < 4; k++) g.add(at(P(new THREE.BoxGeometry(w * .8, .006, l * .08), 'rubber'), 0, .008, -l / 2 + l * (k + .5) / 4)); return g; };
function redFlagship() { const g = new THREE.Group();
  const H = [[0, .42], [.12, .28], [.36, .22], [.42, .02], [.3, -.06], [.16, -.04], [.1, -.3], [0, -.4], [-.1, -.3], [-.16, -.04], [-.3, -.06], [-.42, .02], [-.36, .22], [-.12, .28]];
  g.add(P(ext(H, .08, .02), 'chrome')); g.add(underglow(H));
  g.add(at(P(ext([[0, .3], [.1, .18], [.1, -.12], [0, -.26], [-.1, -.12], [-.1, .18]], .06, .01), 'plate'), 0, .06, 0));
  mirror(g, at(P(new THREE.BoxGeometry(.012, .012, .5), 'neonM'), .105, .095, -.02));
  mirror(g, at(vent(.1, .12), .26, .045, .1));
  const hex = P(new THREE.CylinderGeometry(.08, .08, .05, 6), 'neonC'); hex.position.set(0, .1, .02); g.add(hex);
  const hexC = P(new THREE.CylinderGeometry(.06, .07, .02, 6), 'gunmetal'); hexC.position.set(0, .128, .02); g.add(hexC);
  for (const s of [1, -1]) { const e = P(new THREE.CylinderGeometry(.03, .036, .1, S(14)), 'gunmetal'); e.rotation.x = Math.PI / 2; e.position.set(s * .08, 0, .35); g.add(e);
    const eg = P(new THREE.CircleGeometry(.026, S(14)), 'neonC'); eg.position.set(s * .08, 0, .401); g.add(eg);
    const st = P(new THREE.BoxGeometry(.18, .012, .02), 'neonM'); st.position.set(s * .27, .05, .14); st.rotation.y = s * .25; g.add(st);
    const pipe = P(new THREE.TorusGeometry(.06, .007, S(6), S(16), Math.PI), 'chrome'); pipe.rotation.set(0, Math.PI / 2, 0); pipe.position.set(s * .17, .04, -.02); g.add(pipe);
    const gun = P(new THREE.CylinderGeometry(.008, .01, .16, S(8)), 'chrome'); gun.rotation.x = Math.PI / 2; gun.position.set(s * .39, .02, -.02); g.add(gun); }
  g.add(at(P(new THREE.CylinderGeometry(.2, .2, .22, S(48), 1, true), 'holo'), 0, .25, 0));
  const hp = P(new THREE.CylinderGeometry(.11, .02, .2, 6, 1, true), 'holo'); hp.position.y = .31; hp.rotation.y = .3; g.add(hp);
  g.add(at(P(new THREE.CylinderGeometry(.005, .005, .22, 6), 'chrome'), .06, .17, .2)); g.add(at(P(new THREE.SphereGeometry(.012, 8, 6), 'neonM'), .06, .28, .2));
  g.add(at(P(new THREE.CylinderGeometry(.004, .004, .14, 6), 'chrome'), -.05, .14, .22));
  g.scale.setScalar(1.05); return g; }

function redDrone() { const g = new THREE.Group();
  const core = P(new THREE.BoxGeometry(.14, .08, .14), 'plate'); core.rotation.y = Math.PI / 4; g.add(core);
  const c2 = P(new THREE.BoxGeometry(.07, .05, .07), 'neonC'); c2.position.y = .05; c2.rotation.y = Math.PI / 4; g.add(c2);
  const hub = P(new THREE.CylinderGeometry(.11, .11, .02, S(24)), 'gunmetal'); hub.position.y = -.03; g.add(hub);
  const blade = [[0, .06], [.05, .2], [.0, .4], [-.05, .2]];
  for (let k = 0; k < 4; k++) { const b = new THREE.Group(); b.add(P(ext(blade, .05, .01), 'chrome')); b.add(underglow(blade, 1.12));
    b.add(at(P(new THREE.BoxGeometry(.04, .02, .04), 'neonC'), 0, .04, -.3)); b.add(at(P(new THREE.BoxGeometry(.006, .01, .2), 'neonM'), 0, .032, -.2));
    b.add(at(P(new THREE.CylinderGeometry(.012, .012, .06, 8), 'rubber'), 0, .0, -.08));
    b.rotation.y = Math.PI / 4 + k * Math.PI / 2; g.add(b); }
  g.add(at(P(new THREE.CylinderGeometry(.003, .003, .14, 5), 'chrome'), .03, .1, 0));
  return g; }

function redLancer() { const g = new THREE.Group();
  const H = [[0, .45], [.06, .22], [.09, -.1], [.05, -.3], [-.05, -.3], [-.09, -.1], [-.06, .22]];
  g.add(P(ext(H, .07, .015), 'chrome')); g.add(underglow(H, 1.15));
  g.add(at(P(ext([[0, .52], [.025, .3], [-.025, .3]], .03, .005), 'neonM'), 0, .03, 0));
  const rail = P(new THREE.BoxGeometry(.016, .02, .42), 'gunmetal'); mirror(g, at(rail, .03, .05, -.1));
  for (const s of [1, -1]) { const e = P(new THREE.CylinderGeometry(.022, .026, .14, S(12)), 'gunmetal'); e.rotation.x = Math.PI / 2; e.position.set(s * .035, 0, .34); g.add(e);
    const eg = P(new THREE.CircleGeometry(.018, S(12)), 'neonC'); eg.position.set(s * .035, 0, .411); g.add(eg);
    for (let k = 0; k < 3; k++) g.add(at(P(new THREE.TorusGeometry(.026, .004, 6, S(14)), 'chrome'), s * .035, 0, .3 + k * .03)); }
  g.add(at(P(new THREE.BoxGeometry(.05, .012, .2), 'neonC'), 0, .045, 0));
  g.add(at(vent(.06, .08), 0, .042, .16));
  return g; }

function redShield() { const g = new THREE.Group();
  const H = [[-.46, -.1], [-.4, .12], [-.24, .26], [0, .32], [.24, .26], [.4, .12], [.46, -.1], [.33, -.16], [.27, .02], [0, .12], [-.27, .02], [-.33, -.16]];
  g.add(P(ext(H, .12, .02), 'chrome')); g.add(underglow(H, 1.04));
  const arc = P(new THREE.TorusGeometry(.3, .014, S(8), S(48), Math.PI * .7), 'neonC'); arc.rotation.set(Math.PI / 2, 0, Math.PI * .15); arc.position.set(0, .07, .12); g.add(arc);
  for (const x of [-.3, -.15, .15, .3]) g.add(at(P(new THREE.BoxGeometry(.06, .03, .05), 'plate'), x, .07, -.05 + Math.abs(x) * .15));
  g.add(at(P(new THREE.CylinderGeometry(.05, .06, .08, 6), 'plate'), 0, .04, .02)); g.add(at(P(new THREE.SphereGeometry(.03, S(12), S(8)), 'neonM'), 0, .1, .02));
  const wall = P(new THREE.CylinderGeometry(.5, .5, .26, S(48), 1, true, -Math.PI * .32, Math.PI * .64), 'holoPink'); wall.position.set(0, .1, .3); g.add(wall);
  mirror(g, at(vent(.08, .1), .36, .065, -.02));
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
