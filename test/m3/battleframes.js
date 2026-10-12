// Full-capture frame shots: Blue Lancer a1 fires at a Red Drone on a3 (edge capture, the push's worst case near the side).
// Per frame it records the camera rotation vs the play pose (must be 0: dolly only), the board's far edge vs the header bottom
// (must stay below it), and every GL error in the console. ANGLE=gl (Mesa llvmpipe, a non-SwiftShader GL path) | swiftshader.
// Usage: ANGLE=gl TIER=high node test/m3/battleframes.js   -> screenshots/m3/battle-full/<angle>-<tier>/
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
const ANGLE = process.env.ANGLE || 'gl', TIER = process.env.TIER || 'high', DIR = `/workspace/starfall-gambit-m3-next/screenshots/m3/battle-full/${ANGLE}-${TIER}`;
require('fs').mkdirSync(DIR, { recursive: true });
(async () => { const b = await require('/workspace/starfall-gambit-m3-next/tools/guard').launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=' + ANGLE, '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, { timeoutMs: 500000 });
 let fail = []; try { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' }); await ctx.addInitScript(() => localStorage.setItem('sg_seen_rules', '1'));
  const p = await ctx.newPage(); const gl = []; p.on('console', m => { if (/GL_INVALID|glDraw|too many errors/i.test(m.text())) gl.push(m.text().slice(0, 160)); });
  await p.goto(`http://127.0.0.1:8773/?view=3d&nosw&debug&nostep&tier=${TIER}&aidelay=60000`, { timeout: 120000 }); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = SG.newGame(); s.board[24] = null; s.board[18] = { t: 'D', s: 1 }; SGDebug.setState(s); SGGame.render(); window.SG3D_TS = 25;
    const { camera, THREE } = SGView._three; window.__q0 = camera.quaternion.clone(); window.__probe = () => { const hb = document.querySelector('header.top').getBoundingClientRect().bottom;
      const y = [-3.08, 3.08].map(x => { const v = new THREE.Vector3(x, 0, -3.08).project(camera); return (1 - v.y) / 2 * innerHeight; }); return { rotDeg: +(camera.quaternion.angleTo(__q0) * 180 / Math.PI).toFixed(3), farEdgeY: Math.round(Math.min(...y)), headerBottom: Math.round(hb) }; }; });
  const tap = async i => { const c = await p.evaluate(i => SGDebug.cellCenter(i), i); await p.touchscreen.tap(c.x, c.y); };
  await tap(30); await p.waitForTimeout(400); await tap(18);
  const out = []; for (const [n, u, name] of [[1, .12, 'charge'], [2, .3, 'push-in'], [3, .45, 'impact'], [4, .62, 'explosion-debris'], [5, .9, 'return']]) { await p.waitForFunction(u => { const s = SGView.stats(); return !s.battling || s.battleU >= u; }, u, { timeout: 120000, polling: 30 });
    const s = await p.evaluate(() => ({ ...SGView.stats(), probe: __probe() })); if (!s.battling) break; const f = `${DIR}/${n}-${name}-u${String(u).slice(2)}.png`; await p.screenshot({ path: f, timeout: 120000 });
    out.push({ f, u: s.battleU, ...s.probe }); if (s.probe.rotDeg > .01) fail.push('rotation ' + n); if (s.probe.farEdgeY < s.probe.headerBottom) fail.push('under header ' + n); }
  await p.waitForFunction(() => !SGView.stats().battling, null, { timeout: 120000 }); const lb = await p.evaluate(() => ({ push: SGView.stats().lastBattle.push, gpu: SGView.stats().gpu, tier: SGView.stats().tier, ...__probe() }));
  if (gl.length) fail.push(gl.length + ' GL errors: ' + gl[0]); if (out.length < 5) fail.push('only ' + out.length + ' frames');
  console.log(JSON.stringify({ frames: out, after: lb, glErrors: gl.length }, null, 1)); console.log(fail.length ? 'FRAMES FAIL ' + fail.join('; ') : 'FRAMES PASS');
 } finally { await b.close(); } process.exitCode = fail.length ? 1 : 0; })();
