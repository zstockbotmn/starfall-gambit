// Starfall Gambit M3 — ship + board model library (source of the baked GLB assets).
// Each builder returns a THREE.Group whose meshes use *material slot names* (mesh.userData.slot).
// tools/bake.html merges each ship per slot and exports assets/models/<id>.glb; at runtime
// src/materials.js rebuilds PBR materials per slot (procedural grime/marble maps cost 0 bytes of download).
// Detail q: 1 = LOD0 (close-ups/battles), 0.5 = LOD1 (play view).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SLOTS = ['ceramic', 'gold', 'tealGlow', 'glass', 'chrome', 'plate', 'neonM', 'neonC', 'holo', 'holoPink', 'holoGlyph', 'holoGlyphPink', 'holoAtlas', 'redSkin', 'energy', 'gunmetal', 'rubber'];
let Q = 1; const S = n => Math.max(6, Math.round(n * Q));
const P = (geo, slot) => { const m = new THREE.Mesh(geo); m.userData.slot = slot; return m; };
const V2 = a => a.map(p => new THREE.Vector2(p[0], p[1]));
function ext(pts, depth, bevel = .015, segs = 2) { const g = new THREE.ExtrudeGeometry(new THREE.Shape(V2(pts)), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: Math.max(1, Math.round(segs * Q)), curveSegments: S(12) });
  g.rotateX(-Math.PI / 2); g.translate(0, -depth / 2, 0); return g; }               // (x, forward) -> forward = -z
function lathe(profile, seg = 48) { const g = new THREE.LatheGeometry(V2(profile), S(seg)); g.rotateX(-Math.PI / 2); return g; } // axis along z, +y profile = -z
const at = (m, x = 0, y = 0, z = 0) => (m.position.set(x, y, z), m);
const mirror = (g, m) => { const b = m.clone(); b.position.x *= -1; b.scale.x *= -1; b.rotation.y *= -1; b.rotation.z *= -1; g.add(m, b); };

// ================= BLUE: gleaming utopia (matches concept-blue): sleek white ceramic, brushed-gold edges, teal ports =================
// Gold-edged blade: a thin ceramic blade over a slightly larger gold blade, so every edge reads as a gold rim.
function blade(g, shape, depth, y = 0, rim = 1.045, mir = false) { const c = P(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * .45, bevelSize: .008, bevelSegments: Math.max(2, Math.round(4 * Q)), curveSegments: S(24) }), 'ceramic');
  c.geometry.rotateX(-Math.PI / 2); c.geometry.translate(0, -depth / 2 + y, 0); const gd = P(c.geometry.clone(), 'gold'); gd.geometry.translate(0, -y, 0); gd.geometry.scale(rim, .8, rim); gd.geometry.translate(0, y - .004, 0);
  if (mir) { mirror(g, c); mirror(g, gd); } else g.add(c, gd); }
const curve = (pts) => { const s = new THREE.Shape(); s.moveTo(...pts[0]); for (let k = 1; k < pts.length; k += 2) s.quadraticCurveTo(...pts[k], ...pts[k + 1]); return s; };
const port = (g, x, y, z, r = .025, ry = 0, rx = 0) => { const o = new THREE.Group(); o.add(P(new THREE.TorusGeometry(r, r * .28, S(10), S(28)), 'gold')); o.add(P(new THREE.CircleGeometry(r * .8, S(24)), 'tealGlow'));
  const gl = P(new THREE.SphereGeometry(r * .82, S(16), S(10), 0, Math.PI * 2, 0, Math.PI / 2), 'glass'); gl.rotation.x = Math.PI / 2; gl.scale.z = .5; o.add(gl); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); g.add(o); return o; };
// sculpted gold filigree: a smooth tube along a Catmull-Rom curve (optionally mirrored in x)
function filigree(g, pts, r = .005, mir = true, slot = 'gold') { const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))); const m = P(new THREE.TubeGeometry(c, S(40), r, S(6), false), slot); if (mir) mirror(g, m); else g.add(m); return m; }
function blueFlagship() { const g = new THREE.Group();
  // slender core hull
  const body = P(lathe([[0, .46], [.025, .40], [.06, .26], [.085, .05], [.09, -.12], [.075, -.26], [.05, -.34], [0, -.36]], 48), 'ceramic'); body.scale.y = .62; g.add(body);
  for (const [z, r] of [[-.02, .091], [.16, .078], [.3, .055]]) { const b = P(new THREE.TorusGeometry(r, .007, S(10), S(48)), 'gold'); b.position.z = z; b.scale.y = .62; g.add(b); }
  // two great swept crescent blades (forward-swept tips) + two rear blades
  blade(g, curve([[.05, .08], [.26, .02], [.42, .2], [.30, -.02], [.06, -.12]]), .024, .0, 1.05, true);
  blade(g, curve([[.05, -.10], [.30, -.2], [.36, -.42], [.22, -.24], [.04, -.22]]), .02, -.01, 1.05, true);
  blade(g, curve([[.04, .2], [.14, .26], [.2, .4], [.1, .3], [.03, .3]]), .016, .012, 1.06, true);
  // crown: gold halo ring standing over the hull + inner ring
  const halo = P(new THREE.TorusGeometry(.12, .014, S(14), S(56)), 'gold'); halo.position.set(0, .16, .1); g.add(halo);
  const halo2 = P(new THREE.TorusGeometry(.085, .007, S(10), S(40)), 'gold'); halo2.position.set(0, .16, .1); halo2.rotation.y = Math.PI / 2; g.add(halo2);
  g.add(at(P(new THREE.SphereGeometry(.028, S(16), S(12)), 'tealGlow'), 0, .16, .1));
  g.add(at(P(new THREE.CylinderGeometry(.012, .02, .06, S(12)), 'gold'), 0, .055, .1));
  const can = P(new THREE.SphereGeometry(.05, S(32), S(16)), 'glass'); can.scale.set(.8, .55, 1.9); can.position.set(0, .05, -.16); g.add(can);
  for (const s of [1, -1]) { port(g, s * .2, .02, -.02, .022, 0, -Math.PI / 2); port(g, s * .16, .01, -.2, .016, 0, -Math.PI / 2); }
  const bell = P(new THREE.CylinderGeometry(.06, .045, .05, S(32), 1, true), 'gold'); bell.rotation.x = Math.PI / 2; bell.position.z = .44; g.add(bell);
  g.add(at(P(new THREE.CircleGeometry(.05, S(28)), 'tealGlow'), 0, 0, .43));
  g.scale.setScalar(1.12); return g; }
function blueDrone() { const g = new THREE.Group();   // cross frame with four eye-pods (concept)
  const hub = P(new THREE.CylinderGeometry(.075, .085, .06, S(8)), 'ceramic'); g.add(hub); g.add(at(P(new THREE.CylinderGeometry(.088, .088, .012, S(8)), 'gold'), 0, .0, 0));
  port(g, 0, .033, 0, .03, 0, -Math.PI / 2);
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, d = .26, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const arm = P(new THREE.CylinderGeometry(.022, .03, d - .06, S(12)), 'ceramic'); arm.rotation.z = Math.PI / 2; arm.rotation.y = -a; arm.position.set(x / 2, 0, z / 2); g.add(arm);
    for (const f of [.45, .7]) { const c = P(new THREE.TorusGeometry(.03, .006, S(8), S(20)), 'gold'); c.rotation.y = -a + Math.PI / 2; c.position.set(x * f, 0, z * f); g.add(c); }
    const pod = P(new THREE.SphereGeometry(.08, S(28), S(18)), 'ceramic'); pod.position.set(x, 0, z); g.add(pod);
    const seam = P(new THREE.TorusGeometry(.081, .006, S(8), S(36)), 'gold'); seam.rotation.x = Math.PI / 2; seam.position.set(x, 0, z); g.add(seam);
    port(g, x * 1.3, 0, z * 1.3, .036, Math.PI / 2 - a, 0); port(g, x, .075, z, .03, 0, -Math.PI / 2); }
  return g; }
function blueLancer() { const g = new THREE.Group();   // spear: thicker sculpted ceramic hull, heavy gold lance, four swept gold fins, gold filigree
  const hull = P(lathe([[0, .2], [.04, .14], [.08, .02], [.095, -.1], [.088, -.2], [.06, -.28], [.03, -.33], [0, -.34]], 40), 'ceramic'); hull.scale.y = .72; hull.position.z = .1; g.add(hull);
  const lance = P(new THREE.ConeGeometry(.05, .5, S(18)), 'gold'); lance.rotation.x = -Math.PI / 2; lance.position.z = -.38; g.add(lance);
  for (const [z, r] of [[-.13, .062], [-.05, .085], [.12, .088], [.28, .055]]) { const c = P(new THREE.TorusGeometry(r, .009, S(8), S(32)), 'gold'); c.position.z = z; c.scale.y = .72; g.add(c); }
  // four swept gold fins: two wide side fins + dorsal and ventral
  for (const sweep of [[[.07, .12], [.24, .3], [.26, .42], [.16, .3], [.07, .28]]]) { const s = curve(sweep); const f = P(new THREE.ExtrudeGeometry(s, { depth: .014, bevelEnabled: true, bevelThickness: .005, bevelSize: .004, bevelSegments: 2, curveSegments: S(16) }), 'gold'); f.geometry.rotateX(-Math.PI / 2); f.geometry.translate(0, -.007, 0); mirror(g, f); }
  blade(g, curve([[.06, -.06], [.17, -.14], [.22, -.3], [.12, -.2], [.05, -.18]]), .014, .0, 1.08, true);
  for (const sgn of [1, -1]) { const f = P(new THREE.ExtrudeGeometry(curve([[0, .1], [.14, .26], [.17, .4], [.08, .3], [0, .3]]), { depth: .012, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2, curveSegments: S(16) }), 'gold'); f.geometry.rotateX(-Math.PI / 2); f.geometry.rotateZ(sgn * Math.PI / 2); f.geometry.translate(0, sgn * .04, 0); g.add(f); }
  filigree(g, [[.06, .03, -.12], [.085, .035, .0], [.08, .03, .14], [.05, .02, .3]], .0045);
  filigree(g, [[.0, .062, -.08], [.0, .07, .06], [.0, .06, .2]], .005, false);
  for (const s of [1, -1]) port(g, s * .093, .0, -.02, .02, 0, -Math.PI / 2 * s * 0 - Math.PI / 2);
  const can = P(new THREE.SphereGeometry(.04, S(20), S(10)), 'glass'); can.scale.set(.8, .6, 2.2); can.position.set(0, .055, -.02); g.add(can);
  const bell = P(new THREE.CylinderGeometry(.05, .036, .045, S(20), 1, true), 'gold'); bell.rotation.x = Math.PI / 2; bell.position.z = .45; g.add(bell);
  g.add(at(P(new THREE.CircleGeometry(.04, S(20)), 'tealGlow'), 0, 0, .44));
  return g; }
function blueShield() { const g = new THREE.Group();   // tall domed bastion: larger, taller dome with gold ribs, crown spire, flared rim wings, teal eye ports
  const dome = P(new THREE.LatheGeometry(V2([[0, .34], [.06, .335], [.13, .3], [.19, .24], [.24, .15], [.27, .06], [.28, 0]]), S(64)), 'ceramic'); g.add(dome);
  const rim = P(new THREE.LatheGeometry(V2([[.28, 0], [.37, -.015], [.42, -.04], [.35, -.06], [.22, -.075], [0, -.085]]), S(64)), 'ceramic'); g.add(rim);
  for (const [y, r] of [[.0, .28], [.15, .24], [.26, .16], [-.038, .42]]) { const s = P(new THREE.TorusGeometry(r, .008, S(8), S(64)), 'gold'); s.rotation.x = Math.PI / 2; s.position.y = y; g.add(s); }
  // sculpted gold ribs sweeping up the dome
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8, pts = [[.292, .0], [.278, .1], [.226, .2], [.142, .295], [.058, .342]].map(([r, y]) => [Math.cos(a) * r, y, Math.sin(a) * r]); filigree(g, pts, .007, false); }
  // crown spire
  g.add(at(P(new THREE.CylinderGeometry(.055, .065, .025, S(24)), 'gold'), 0, .345, 0)); g.add(at(P(new THREE.CylinderGeometry(.035, .035, .03, S(20)), 'tealGlow'), 0, .36, 0));
  const sp = P(new THREE.ConeGeometry(.02, .14, S(12)), 'gold'); sp.position.y = .44; g.add(sp); const hr = P(new THREE.TorusGeometry(.05, .006, S(8), S(32)), 'gold'); hr.position.y = .41; g.add(hr);
  port(g, 0, .14, -.25, .055, 0, 0); for (const s of [1, -1]) port(g, s * .2, .11, -.17, .032, s * .7, 0);
  blade(g, curve([[.29, -.07], [.52, -.03], [.56, .2], [.43, .07], [.31, .06]]), .022, -.03, 1.05, true);
  blade(g, curve([[.2, .2], [.3, .3], [.28, .42], [.22, .3], [.15, .26]]), .016, -.02, 1.06, true);
  for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; g.add(at(P(new THREE.BoxGeometry(.032, .006, .012), 'tealGlow'), Math.cos(a) * .35, -.024, Math.sin(a) * .35)).children.at(-1).rotation.y = -a; }
  g.scale.setScalar(1.22); return g; }

// ================= RED: gritty neon cyberpunk (matches concept-red + red-flagship-ref): long, angular, heavily greebled black hulls =================
// 'redSkin' faces get a planar projection of the AI top-view reference (greebles + neon) in tools/bake.html.
const underglow = (pts, s = 1.06) => { const o = P(ext(pts, .01, .003), 'neonM'); o.scale.set(s, 1, s); o.position.y = -.03; return o; };
function edgeStrips(g, pts, y, slot, s = 1.0, w = .007, skip = () => false) { const n = pts.length;
  for (let k = 0; k < n; k++) { if (skip(k)) continue; const a = pts[k], b = pts[(k + 1) % n]; const ax = a[0] * s, az = -a[1] * s, bx = b[0] * s, bz = -b[1] * s; const L = Math.hypot(bx - ax, bz - az); if (L < .03) continue;
    const m = P(new THREE.BoxGeometry(w, w, L * .8), slot); m.position.set((ax + bx) / 2, y, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az); g.add(m); } }
// hologram panel showing one cell (0..15) of the AI 4x4 hologram sheet
function holoPanel(g, w, h, x, y, z, ry = 0, cell = 0) { const geo = new THREE.PlaneGeometry(w, h), c = cell % 4, r = Math.floor(cell / 4), uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + .03 + uv.getX(k) * .94) / 4, 1 - (r + .97 - uv.getY(k) * .94) / 4);
  const p = P(geo, 'holoAtlas'); p.position.set(x, y, z); p.rotation.y = ry; g.add(p);
  g.add(at(P(new THREE.CylinderGeometry(.003, .003, Math.max(.01, y - h / 2 - .02), 5), 'chrome'), x, (y - h / 2) / 2 + .01, z)); }
let gs = 3; const grnd = () => ((gs = (gs * 16807) % 2147483647) / 2147483647);
// dense greebles inside a polygon outline (x, forward), on a deck at height y
function greeble(g, poly, n, y, seed, hMax = .03) { gs = seed; const inside = (x, f) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > f) !== (yj > f) && x < (xj - xi) * (f - yi) / (yj - yi) + xi) c = !c; } return c; };
  const xs = poly.map(p => p[0]), fs = poly.map(p => p[1]); let made = 0, tries = 0;
  while (made < n && tries++ < n * 20) { const x = Math.min(...xs) + grnd() * (Math.max(...xs) - Math.min(...xs)), f = Math.min(...fs) + grnd() * (Math.max(...fs) - Math.min(...fs)); if (!inside(x, f)) continue;
    const w = .01 + grnd() * .03, l = .015 + grnd() * .06, h = .005 + grnd() * hMax, r = grnd(); made++;
    const m = P(new THREE.BoxGeometry(w, h, l), r < .5 ? 'gunmetal' : r < .8 ? 'plate' : 'chrome'); m.position.set(x, y + h / 2, -f); g.add(m);
    if (grnd() < .3) g.add(at(P(new THREE.BoxGeometry(w * .7, .003, .003), grnd() < .55 ? 'neonM' : 'neonC'), x, y + h + .002, -f + l * .3)); } }
const antenna = (g, x, z, h, base, tip = 'neonM') => { g.add(at(P(new THREE.CylinderGeometry(.003, .005, h, 5), 'chrome'), x, base + h / 2, z)); g.add(at(P(new THREE.SphereGeometry(.007, 6, 5), tip), x, base + h, z)); };
const scaleP = (pts, sx, sf, df = 0) => pts.map(([x, f]) => [x * sx, f * sf + df]);
function deck(g, pts, depth, y, slot = 'redSkin', bevel = .006) { const m = P(ext(pts, depth, bevel, 1), slot); m.position.y = y + depth / 2; g.add(m); return y + depth + bevel; }
function hexCore(g, x, y, z, r = .05) { g.add(at(P(new THREE.CylinderGeometry(r * 1.25, r * 1.35, .02, 6), 'gunmetal'), x, y + .01, z)); const c = P(new THREE.CylinderGeometry(r, r, .016, 6), 'neonC'); c.position.set(x, y + .024, z); g.add(c);
  const rr = P(new THREE.TorusGeometry(r * 1.15, .005, 4, 6), 'neonC'); rr.rotation.x = Math.PI / 2; rr.position.set(x, y + .03, z); g.add(rr); }
// ---------- Red kit: faceted lofted wedge hulls + procedural greebles / vents / slits / spikes ----------
// A section is {f (forward), w (half-width at the hull edge), e (edge height), sw/sh (shoulder x/height), r (ridge height), kw/k (keel half-width/depth)}.
const ringOf = s => { const R = [[0, s.r], [s.sw, s.sh], [s.w, s.e], [s.w * .9, s.e - .014], [s.kw, -s.k], [0, -s.k - .006]]; return [...R, ...R.slice(1, 5).reverse().map(([x, y]) => [-x, y])]; };
function loft(g, secs, slot = 'redSkin', x0 = 0, y0 = 0) { const pos = [], rings = secs.map(s => ringOf(s).map(([x, y]) => [x + x0, y + y0, -s.f])), n = rings[0].length;
  const tri = (a, b, c, ctr) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], nn = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    const m = [(a[0] + b[0] + c[0]) / 3 - ctr[0], (a[1] + b[1] + c[1]) / 3 - ctr[1], (a[2] + b[2] + c[2]) / 3 - ctr[2]]; if (Math.hypot(...nn) < 1e-12) return;
    if (nn[0] * m[0] + nn[1] * m[1] + nn[2] * m[2] < 0) pos.push(...a, ...c, ...b); else pos.push(...a, ...b, ...c); };
  for (let i = 0; i + 1 < rings.length; i++) { const A = rings[i], B = rings[i + 1], s = secs[i], t = secs[i + 1];
    for (let j = 0; j < n; j++) { const j2 = (j + 1) % n, ctr = [x0, y0 + ((s.r - s.k) + (t.r - t.k)) / 4, -(s.f + t.f) / 2]; tri(A[j], A[j2], B[j2], ctr); tri(A[j], B[j2], B[j], ctr); } }
  for (const [R, dz] of [[rings[0], -1], [rings.at(-1), 1]]) { const c = R.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]); for (let j = 0; j < n; j++) tri(c, R[j], R[(j + 1) % n], [c[0], c[1], c[2] - dz]); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
  const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] * 2 + .5, pos[k + 2] * 2 + .5); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = P(geo, slot); g.add(m); return m; }
// interpolate a section at forward position f
function secAt(secs, f) { for (let i = 0; i + 1 < secs.length; i++) { const a = secs[i], b = secs[i + 1]; if (f <= a.f && f >= b.f) { const u = (a.f - f) / (a.f - b.f || 1), o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * u; return o; } } return null; }
// height of the top surface at lateral x on a section, plus its slope angle
function topAt(s, x) { const ax = Math.abs(x); let y, sl; if (ax <= s.sw) { y = s.r + (s.sh - s.r) * ax / (s.sw || 1); sl = Math.atan2(s.sh - s.r, s.sw || 1); } else { const u = Math.min(1, (ax - s.sw) / ((s.w - s.sw) || 1)); y = s.sh + (s.e - s.sh) * u; sl = Math.atan2(s.e - s.sh, (s.w - s.sw) || 1); } return [y, x < 0 ? -sl : sl]; }
// greebles that sit on (and tilt with) the lofted top surface: boxes, vent banks, little fins, light slits
function greebleLoft(g, secs, n, seed, { x0 = 0, y0 = 0, fMin = -1, fMax = 1, wFrac = .92, hMax = .022, slits = .35 } = {}) { gs = seed; n = Math.round(n * (.45 + .55 * Q)); let made = 0, tries = 0;
  const f0 = Math.max(secs.at(-1).f, fMin), f1 = Math.min(secs[0].f, fMax);
  while (made < n && tries++ < n * 30) { const f = f0 + grnd() * (f1 - f0), s = secAt(secs, f); if (!s || s.w < .02) continue; const x = (grnd() * 2 - 1) * s.w * wFrac, [y, sl] = topAt(s, x); made++;
    const kind = grnd(), o = new THREE.Group(); o.position.set(x + x0, y + y0, -f); o.rotation.z = sl;
    if (kind < .55) { const w = .008 + grnd() * .026, l = .012 + grnd() * .05, h = .004 + grnd() * hMax, r = grnd(); o.add(at(P(new THREE.BoxGeometry(w, h, l), r < .5 ? 'gunmetal' : r < .8 ? 'plate' : 'chrome'), 0, h / 2, 0));
      if (grnd() < .25) o.add(at(P(new THREE.BoxGeometry(w * .6, h * .7, l * .6), 'plate'), 0, h + h * .35, 0)); }
    else if (kind < .75) { const k = 3 + Math.floor(grnd() * 3), l = .02 + grnd() * .03; for (let v = 0; v < k; v++) o.add(at(P(new THREE.BoxGeometry(.003, .006, l), 'chrome'), (v - (k - 1) / 2) * .006, .003, 0)); o.add(at(P(new THREE.BoxGeometry(k * .006 + .004, .002, l + .004), 'gunmetal'), 0, .001, 0)); }
    else if (kind < .85) { const fin = P(ext([[0, 0], [0, .03 + grnd() * .03], [.012 + grnd() * .02, 0]], .003, .001, 1), 'gunmetal'); fin.rotation.set(0, 0, Math.PI / 2); fin.position.y = .0; o.add(fin); }
    else { o.add(at(P(new THREE.CylinderGeometry(.004 + grnd() * .006, .006 + grnd() * .006, .006 + grnd() * .012, 6), 'gunmetal'), 0, .006, 0)); }
    if (grnd() < slits) o.add(at(P(new THREE.BoxGeometry(.003, .0025, .015 + grnd() * .03), grnd() < .6 ? 'neonM' : 'neonC'), (grnd() - .5) * .02, .0022, 0));
    g.add(o); } }
// light slits along the hull flanks (just under the edge)
function flankSlits(g, secs, n, seed, { x0 = 0, y0 = 0, mag = .62 } = {}) { gs = seed; n = Math.round(n * (.5 + .5 * Q));
  for (let k = 0; k < n; k++) { const f = secs.at(-1).f + grnd() * (secs[0].f - secs.at(-1).f), s = secAt(secs, f); if (!s || s.w < .03) continue; const l = .02 + grnd() * .06, sd = k % 2 ? 1 : -1;
    const m = P(new THREE.BoxGeometry(.003, .003, l), grnd() < mag ? 'neonM' : 'neonC'); m.position.set(x0 + sd * (s.w * .95 + .0015), y0 + s.e - .007 - grnd() * .004, -f); g.add(m); } }
// flat swept spike/fin (x, f) triangle, gunmetal with a neon leading edge
function spike(g, a, tip, b, thick = .01, y = 0, edge = 'neonM', mir = true) { const pts = [a, tip, b]; const ar = (tip[0] - a[0]) * (b[1] - a[1]) - (tip[1] - a[1]) * (b[0] - a[0]); const P3 = ar < 0 ? pts : [b, tip, a];
  const m = P(ext(P3, thick, .002, 1), 'redSkin'); m.position.y = y; const L = Math.hypot(tip[0] - a[0], tip[1] - a[1]); const e = P(new THREE.BoxGeometry(.004, .004, L * .85), edge);
  e.position.set((a[0] + tip[0]) / 2, y + thick / 2 + .002, -(a[1] + tip[1]) / 2); e.rotation.y = Math.atan2(tip[0] - a[0], -(tip[1] - a[1]));
  if (mir) { mirror(g, m); mirror(g, e); } else g.add(m, e); }
function holoFlush(g, w, h, x, y, z, ry, cell) { const geo = new THREE.PlaneGeometry(w, h), c = cell % 4, r = Math.floor(cell / 4), uv = geo.attributes.uv;
  for (let k = 0; k < uv.count; k++) uv.setXY(k, (c + .03 + uv.getX(k) * .94) / 4, 1 - (r + .97 - uv.getY(k) * .94) / 4);
  const p = P(geo, 'holoAtlas'); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); }
function nozzles(g, xs, y, z, r, glow = 'neonC') { for (const x of xs) { const e = P(new THREE.CylinderGeometry(r, r * 1.2, .05, S(10)), 'gunmetal'); e.rotation.x = Math.PI / 2; e.position.set(x, y, z); g.add(e); g.add(at(P(new THREE.CircleGeometry(r * .8, S(10)), glow), x, y, z + .0255)); } }
function bigHex(g, x, y, z, r) { // large glowing cyan hexagonal reactor core with nested rims
  g.add(at(P(new THREE.CylinderGeometry(r * 1.42, r * 1.6, .026, 6), 'gunmetal'), x, y + .013, z));
  g.add(at(P(new THREE.CylinderGeometry(r * 1.18, r * 1.25, .01, 6), 'plate'), x, y + .03, z));
  g.add(at(P(new THREE.CylinderGeometry(r, r, .02, 6), 'neonC'), x, y + .033, z));
  for (const [rr, yy] of [[r * 1.12, .045], [r * .7, .046], [r * .4, .047]]) { const t = P(new THREE.TorusGeometry(rr, .0045, 4, 6), 'neonC'); t.rotation.set(Math.PI / 2, 0, Math.PI / 6); t.position.set(x, y + yy, z); g.add(t); }
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + Math.PI / 6, m = P(new THREE.BoxGeometry(.008, .016, r * .5), 'chrome'); m.position.set(x + Math.sin(a) * r * 1.3, y + .03, z + Math.cos(a) * r * 1.3); m.rotation.y = a; g.add(m); } }
const SEC = (f, w, e, sw, sh, r, kw, k) => ({ f, w, e, sw, sh, r, kw, k });
function redFlagship() { const g = new THREE.Group();   // dreadnought (red-flagship-ref): long faceted arrowhead, stepped spine, sawtooth spikes, big cyan hex core, aft bridge tower
  const H = [SEC(.5, .006, 0, .003, .01, .012, .003, .006), SEC(.38, .06, .008, .03, .03, .036, .03, .018), SEC(.18, .15, .012, .065, .05, .062, .065, .03), SEC(-.04, .24, .016, .095, .066, .082, .095, .036),
    SEC(-.22, .29, .018, .11, .072, .088, .1, .036), SEC(-.34, .23, .018, .1, .068, .08, .09, .032), SEC(-.43, .13, .018, .075, .058, .066, .07, .028)];
  loft(g, H);
  const SP = [SEC(.34, .008, .0, .004, .01, .014, .006, .0), SEC(.2, .05, .01, .025, .034, .04, .04, .0), SEC(-.06, .085, .016, .045, .05, .058, .07, .0), SEC(-.3, .09, .018, .05, .055, .062, .08, .0), SEC(-.4, .06, .016, .035, .045, .05, .055, .0)];
  loft(g, SP, 'redSkin', 0, .06);   // raised spine superstructure
  bigHex(g, 0, .11, -.05, .062);
  // aft bridge tower: stacked angular blocks + antenna cluster
  const T = [SEC(-.2, .045, .0, .03, .03, .034, .045, .0), SEC(-.28, .05, .0, .035, .04, .044, .05, .0), SEC(-.36, .04, .0, .028, .032, .036, .04, .0)];
  loft(g, T, 'plate', 0, .118); loft(g, [SEC(-.25, .025, 0, .015, .02, .024, .025, 0), SEC(-.33, .025, 0, .015, .022, .026, .025, 0)], 'gunmetal', 0, .16);
  g.add(at(P(new THREE.BoxGeometry(.07, .006, .004), 'neonC'), 0, .148, .2)); g.add(at(P(new THREE.BoxGeometry(.05, .004, .004), 'neonM'), 0, .175, .25));
  for (const [x, z, h] of [[.018, .29, .13], [-.014, .3, .1], [.03, .31, .07], [-.03, .27, .06], [0, .32, .085]]) antenna(g, x, z, h, .17, h > .1 ? 'neonM' : 'neonC');
  // sawtooth spikes along both flanks (aft-swept) + big swept wing blades
  for (let k = 0; k < 5; k++) { const f = .26 - k * .12, s = secAt(H, f), s2 = secAt(H, f - .07); if (!s || !s2) continue; spike(g, [s.w - .01, f], [s.w + .06 + k * .012, f - .1], [s2.w - .01, f - .07], .008, s.e - .006, k % 2 ? 'neonC' : 'neonM'); }
  spike(g, [.2, -.02], [.42, -.34], [.24, -.26], .012, .008, 'neonM');
  spike(g, [.12, -.36], [.2, -.5], [.07, -.43], .01, .01, 'neonC');
  // gun batteries on the shoulders
  for (const s of [1, -1]) for (let k = 0; k < 4; k++) { const f = .12 - k * .1, se = secAt(H, f), x = s * se.sw * 1.35, [y, sl] = topAt(se, x); const tb = new THREE.Group(); tb.position.set(x, y, -f); tb.rotation.z = sl;
    tb.add(at(P(new THREE.CylinderGeometry(.014, .017, .012, 6), 'gunmetal'), 0, .006, 0)); for (const d of [-.005, .005]) { const b = P(new THREE.CylinderGeometry(.0028, .0032, .05, 5), 'chrome'); b.rotation.x = Math.PI / 2; b.position.set(d, .012, -.025); tb.add(b); } g.add(tb); }
  greebleLoft(g, H, 260, 5, { wFrac: .95, slits: .4 }); greebleLoft(g, SP, 110, 6, { y0: .06, hMax: .016, slits: .45 });
  flankSlits(g, H, 70, 8); flankSlits(g, SP, 30, 9, { y0: .06, mag: .4 });
  edgeStrips(g, [[0, .5], [.06, .38], [.15, .18], [.24, -.04], [.29, -.22], [.23, -.34], [.13, -.43], [-.13, -.43], [-.23, -.34], [-.29, -.22], [-.24, -.04], [-.15, .18], [-.06, .38]], .005, 'neonM', 1.01, .005, k => k === 6);
  g.add(underglow([[0, .48], [.27, -.22], [.12, -.42], [-.12, -.42], [-.27, -.22]], .8));
  nozzles(g, [-.1, -.05, 0, .05, .1], .01, .43, .02); nozzles(g, [-.035, .035], .085, .4, .014, 'neonM');
  // hologram atlas panels flush on the spine flanks + a floating tactical holo over the stern
  for (const s of [1, -1]) { holoFlush(g, .14, .032, s * .093, .085, .1, s * (Math.PI / 2 - .25), s > 0 ? 1 : 2); holoFlush(g, .1, .028, s * .2, .03, -.1, s * (Math.PI / 2 - .5), s > 0 ? 6 : 9); }
  holoPanel(g, .12, .07, .17, .2, .18, -Math.PI / 2 + .45, 4);
  return g; }
function redLancer() { const g = new THREE.Group();   // long spear with a ram: needle hull, armoured ram head with chrome prongs, twin rails, swept tail spikes
  const H = [SEC(.3, .05, .01, .025, .03, .036, .03, .02), SEC(.1, .062, .012, .03, .036, .044, .036, .024), SEC(-.15, .07, .014, .034, .04, .048, .04, .026), SEC(-.33, .085, .016, .04, .046, .054, .046, .028), SEC(-.44, .05, .016, .03, .038, .044, .035, .024)];
  loft(g, H);
  // ram head: a heavier faceted wedge at the bow ending in a chrome ram spike
  const R = [SEC(.5, .012, .0, .006, .012, .016, .006, .01), SEC(.42, .07, .006, .035, .04, .05, .04, .03), SEC(.33, .09, .01, .045, .05, .06, .05, .034), SEC(.27, .05, .01, .025, .03, .036, .03, .02)];
  loft(g, R, 'plate');
  const ram = P(new THREE.ConeGeometry(.016, .1, 6), 'chrome'); ram.rotation.x = -Math.PI / 2; ram.position.set(0, .006, -.54); g.add(ram);
  for (const s of [1, -1]) { const pr = P(new THREE.ConeGeometry(.008, .08, 5), 'chrome'); pr.rotation.set(-Math.PI / 2, 0, 0); pr.position.set(s * .05, .004, -.46); g.add(pr); }
  g.add(at(P(new THREE.BoxGeometry(.11, .004, .004), 'neonM'), 0, .03, -.36)); g.add(at(P(new THREE.BoxGeometry(.08, .004, .004), 'neonC'), 0, .04, -.4));
  // twin railgun barrels along the spine
  for (const s of [1, -1]) { g.add(at(P(new THREE.BoxGeometry(.012, .016, .62), 'gunmetal'), s * .018, .05, -.05)); g.add(at(P(new THREE.BoxGeometry(.003, .003, .58), s > 0 ? 'neonC' : 'neonM'), s * .018, .059, -.05));
    for (let k = 0; k < 6; k++) g.add(at(P(new THREE.BoxGeometry(.016, .02, .008), 'chrome'), s * .018, .05, -.3 + k * .1)); }
  // swept tail spikes + dorsal fin + small forward canards
  spike(g, [.06, -.18], [.2, -.46], [.075, -.36], .01, .006, 'neonM');
  spike(g, [.07, -.3], [.14, -.52], [.05, -.42], .008, .0, 'neonC');
  spike(g, [.05, .22], [.11, .12], [.06, .14], .006, .006, 'neonC');
  const df = P(ext([[0, -.16], [0, -.42], [.09, -.46], [.03, -.28]], .006, .002, 1), 'redSkin'); df.rotation.z = Math.PI / 2; df.position.set(0, .05, 0); g.add(df);
  greebleLoft(g, H, 120, 21, { wFrac: .95, hMax: .014, slits: .45 }); greebleLoft(g, R, 25, 22, { hMax: .01, slits: .3 });
  flankSlits(g, H, 50, 23); flankSlits(g, R, 10, 24, { mag: .3 });
  nozzles(g, [-.03, .03], .01, .45, .018); nozzles(g, [0], .045, .44, .012, 'neonM');
  for (const s of [1, -1]) holoFlush(g, .16, .022, s * .072, .03, .0, s * (Math.PI / 2 - .3), s > 0 ? 10 : 11);
  g.add(underglow([[0, .5], [.09, .33], [.085, -.33], [-.085, -.33], [-.09, .33]], .6));
  return g; }
function redDrone() { const g = new THREE.Group();   // compact hunter with a spiky claw: stubby armoured wedge body, two jagged pincers forward, rear spikes
  const H = [SEC(.2, .03, .01, .015, .03, .036, .02, .02), SEC(.1, .11, .016, .05, .06, .07, .06, .035), SEC(-.06, .14, .02, .065, .075, .088, .075, .04), SEC(-.18, .1, .02, .05, .06, .07, .06, .034), SEC(-.24, .05, .018, .03, .04, .046, .035, .026)];
  loft(g, H);
  bigHex(g, 0, .082, .03, .03);
  // claw: each pincer is a thick jagged blade curving inward, with inner teeth and a neon edge
  for (const s of [1, -1]) { const C = [[.07, .06], [.17, .16], [.19, .3], [.13, .43], [.05, .47], [.11, .36], [.12, .25], [.08, .16], [.04, .1]].map(([x, f]) => [s * x, f]);
    const pts = s > 0 ? C.slice().reverse() : C; const cl = P(ext(pts, .03, .004, 1), 'redSkin'); cl.position.y = .0; g.add(cl);
    const top = P(ext((s > 0 ? [[.09, .1], [.16, .18], [.17, .3], [.12, .38], [.1, .26], [.08, .16]].reverse() : [[.09, .1], [.16, .18], [.17, .3], [.12, .38], [.1, .26], [.08, .16]].map(([x, f]) => [-x, f])), .012, .002, 1), 'plate'); top.position.y = .024; g.add(top);
    for (let k = 0; k < 4; k++) { const f = .18 + k * .065, x = s * (.09 + (k === 3 ? .02 : .0)); spike(g, [x, f], [x - s * .05, f + .025], [x, f + .04], .016, -.008, k % 2 ? 'neonC' : 'neonM', false); }
    for (const [a, b] of [[[.17, .16], [.19, .3]], [[.19, .3], [.13, .43]], [[.13, .43], [.05, .47]]]) { const ax = s * a[0], bx = s * b[0], L = Math.hypot(bx - ax, b[1] - a[1]); const e = P(new THREE.BoxGeometry(.004, .004, L * .9), 'neonM'); e.position.set((ax + bx) / 2, .02, -(a[1] + b[1]) / 2); e.rotation.y = Math.atan2(bx - ax, -(b[1] - a[1])); g.add(e); }
    const tipS = P(new THREE.ConeGeometry(.008, .05, 5), 'chrome'); tipS.rotation.set(-Math.PI / 2, 0, -s * .9); tipS.position.set(s * .04, .006, -.48); g.add(tipS);
  }
  spike(g, [.1, -.08], [.25, -.24], [.08, -.18], .01, .01, 'neonC');
  const df = P(ext([[0, .04], [0, -.18], [.08, -.24], [.03, -.05]], .006, .002, 1), 'redSkin'); df.rotation.z = Math.PI / 2; df.position.set(0, .085, 0); g.add(df);
  greebleLoft(g, H, 90, 31, { wFrac: .95, hMax: .016, slits: .45 }); flankSlits(g, H, 30, 32);
  nozzles(g, [-.03, .03], .01, .245, .02);
  for (const s of [1, -1]) holoFlush(g, .1, .026, s * .125, .035, .02, s * (Math.PI / 2 - .35), s > 0 ? 3 : 7);
  g.add(underglow([[0, .2], [.13, -.06], [.05, -.24], [-.05, -.24], [-.13, -.06]], .8));
  return g; }
function redShield() { const g = new THREE.Group();   // broad angular bulwark: wide faceted armour wedge, buttress spikes, tall tilted emitter plate projecting a hologram wall
  const H = [SEC(.2, .16, .014, .07, .05, .06, .1, .03), SEC(.1, .4, .016, .14, .07, .085, .2, .04), SEC(-.06, .46, .018, .16, .08, .095, .22, .042), SEC(-.18, .3, .018, .12, .07, .08, .16, .036), SEC(-.24, .14, .016, .07, .05, .058, .08, .03)];
  loft(g, H);
  // emitter plate: tall angled armoured frame at the bow, glowing pink emitter face with a neon grid
  const E = new THREE.Group(); E.position.set(0, .06, -.14); E.rotation.x = -.42;
  const frame = [[0, .2], [.2, .17], [.3, .06], [.28, 0], [-.28, 0], [-.3, .06], [-.2, .17]];
  const fr = P(new THREE.ExtrudeGeometry(new THREE.Shape(V2(frame)), { depth: .025, bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 1 }), 'gunmetal'); fr.position.z = -.0125; E.add(fr);
  const inner = P(new THREE.ShapeGeometry(new THREE.Shape(V2(frame.map(([x, y]) => [x * .84, y * .8 + .02])))), 'holoPink'); inner.position.z = -.016; inner.rotation.y = Math.PI; E.add(inner); const inner2 = inner.clone(); inner2.rotation.y = 0; inner2.position.z = .016; E.add(inner2);
  for (let k = 1; k < 4; k++) E.add(at(P(new THREE.BoxGeometry(.44 - k * .06, .003, .003), 'neonM'), 0, k * .045, -.018));
  for (const x of [-.12, 0, .12]) E.add(at(P(new THREE.BoxGeometry(.003, .14, .003), 'neonC'), x, .09, -.018));
  for (let k = 0; k < frame.length; k++) { const a = frame[k], b = frame[(k + 1) % frame.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); const e = P(new THREE.BoxGeometry(L * .9, .004, .004), k % 2 ? 'neonC' : 'neonM'); e.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -.02); e.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); E.add(e); }
  for (const s of [1, -1]) { const st = P(new THREE.BoxGeometry(.03, .14, .03), 'plate'); st.position.set(s * .18, .02, .05); st.rotation.x = .42; E.add(st); }
  g.add(E);
  // buttress spikes forward from the wing tips + aft fins
  spike(g, [.36, .08], [.5, .3], [.44, -.02], .014, .006, 'neonM');
  spike(g, [.4, -.1], [.5, -.26], [.3, -.18], .01, .006, 'neonC');
  spike(g, [.12, -.22], [.18, -.36], [.06, -.25], .008, .006, 'neonM');
  greebleLoft(g, H, 170, 41, { wFrac: .95, fMax: .02, hMax: .018, slits: .4 }); flankSlits(g, H, 50, 42);
  nozzles(g, [-.08, 0, .08], .01, .25, .018);
  for (const s of [1, -1]) holoFlush(g, .14, .03, s * .4, .03, .04, s * (Math.PI / 2 - .9), s > 0 ? 5 : 12);
  antenna(g, .2, .1, .08, .07, 'neonM'); antenna(g, -.2, .1, .08, .07, 'neonC');
  g.add(underglow([[0, .2], [.46, -.06], [.14, -.24], [-.14, -.24], [-.46, -.06]], .75));
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
