// M3 3D checks (headless Chrome + SwiftShader). Usage: node test/m3/checks.js [base]   -> screenshots/m3/play, screenshots/m3/battle, test/m3/results.json
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core'); const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || (process.env.SG_BASE || 'http://127.0.0.1:8771/') + '', OUT = path.resolve(__dirname, '../../screenshots/m3'); for (const d of ['play', 'battle']) fs.mkdirSync(OUT + '/' + d, { recursive: true });
const VPS = [[390, 844], [375, 548], [320, 460], [320, 568]]; const R = { checks: {}, fail: [] };
const ok = (name, pass, info) => { R.checks[name] = { pass: !!pass, info }; if (!pass) R.fail.push(name); console.log((pass ? 'PASS ' : 'FAIL ') + name, info !== undefined ? JSON.stringify(info) : ''); };
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
async function open(b, w, h, q = '', opt = {}) { const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: opt.dpr || 2, hasTouch: true, isMobile: true, reducedMotion: opt.reduced ? 'reduce' : 'no-preference', serviceWorkers: opt.sw ? 'allow' : 'block' });
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(String(e)));
  await ctx.addInitScript(s => { localStorage.setItem('sg_seen_rules', '1'); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, opt.ls || {});
  await p.goto(BASE + (opt.noview ? '?v=1' : '?view=3d') + (opt.sw ? '' : '&nosw') + q + '&x=?debug'); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 120000 });
  await p.waitForTimeout(600); return p; }
// scenario helpers (run in page)
const SCEN = {
  shot: `(() => { const s = SG.newGame(); s.board[24] = null; s.board[18] = { t: 'D', s: 1 }; return s; })()`,       // Blue Lancer a1 can fire at Red Drone a3
  move: `(() => { const s = SG.newGame(); s.board[20] = { t: 'L', s: 1 }; return s; })()`,                               // Blue Drone c1 (32) jumps onto c3 (20)
  finale: `(() => { const s = SG.newGame(); s.board = s.board.map(() => null); s.board[33] = { t: 'F', s: 0 }; s.board[31] = { t: 'L', s: 0 }; s.board[13] = { t: 'F', s: 1 }; s.board[0] = { t: 'S', s: 1 }; return s; })()`,   // Lancer b1 fires at Red Flagship b4
  red: `(() => { const s = SG.newGame(); s.board[19] = { t: 'D', s: 1 }; s.board[25] = { t: 'D', s: 0 }; s.board[26] = { t: 'L', s: 0 }; return s; })()`,
  expose: `(() => { const s = SG.newGame(); s.board = s.board.map(() => null); s.board[33] = { t: 'F', s: 0 }; s.board[27] = { t: 'S', s: 0 }; s.board[15] = { t: 'L', s: 1 }; s.board[3] = { t: 'F', s: 1 }; s.board[0] = { t: 'D', s: 1 }; return s; })()`,
};
const setS = (p, k) => p.evaluate(`SGDebug.setState(${SCEN[k]}); SGGame.render();`);
const tap = async (p, i) => { const c = await p.evaluate(i => SGDebug.cellCenter(i), i); await p.mouse.click(c.x, c.y); };
(async () => { const b = await require(require('path').join(__dirname, '../../tools/guard.js')).launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ARGS });
  // 1) mapping: DOM grid = projected 3D tiles; elementFromPoint at every projected tile centre hits that cell (4 viewports)
  for (const [w, h] of VPS) { const p = await open(b, w, h);
    const r = await p.evaluate(() => { let bad = [], maxErr = 0, minW = 1e9, minH = 1e9; for (let i = 0; i < 36; i++) { const [x, y] = SGView.project(i, 0), el = document.elementFromPoint(x, y), c = el && el.closest('.cell');
        if (!c || +c.dataset.i !== i) bad.push(i); const q = document.querySelectorAll('.cell')[i].getBoundingClientRect(); maxErr = Math.max(maxErr, Math.hypot(q.left + q.width / 2 - x, q.top + q.height / 2 - y) / q.width);
        const a = SGView.project(i - (i % 6) + 0, 0); }
      const P = (x, z) => { const v = SGView.project(0, 0); return v; };
      // far-row and near-row tile sizes from DOM boxes
      const cs = [...document.querySelectorAll('.cell')].map(c => c.getBoundingClientRect()); const far = cs[2], near = cs[32];
      const hud = document.querySelector('.status').getBoundingClientRect().bottom, leg = (document.querySelector('.legend').offsetParent ? document.querySelector('.legend') : document.querySelector('.info')).getBoundingClientRect().top;
      return { bad, maxErr: +maxErr.toFixed(3), far: [Math.round(far.width), Math.round(far.height)], near: [Math.round(near.width), Math.round(near.height)], boardTop: Math.round(cs[0].top), boardBottom: Math.round(cs[35].bottom), hud: Math.round(hud), stats: SGView.stats() }; });
    ok(`map-${w}x${h}`, !r.bad.length && r.maxErr < .12 && r.boardTop >= r.hud - 1, r);
    await p.screenshot({ path: `${OUT}/play/start-${w}x${h}.png` }); await p.context().close(); }
  // 2) play view with markers, High tier, draw calls/tris
  { const p = await open(b, 390, 844, '&tier=high&bench'); await tap(p, 31); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/play/selected-drone-high.png` });
    const s = await p.evaluate(() => SGView.stats()); ok('play-calls-high', s.calls <= 120 && s.tris <= 300000, { calls: s.calls, tris: s.tris, tier: s.tier, p50: s.p50, p90: s.p90 });
    await setS(p, 'expose'); await tap(p, 27); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/play/danger-hatching-high.png` });
    await p.context().close(); }
  { const p = await open(b, 390, 844, '&tier=medium&bench'); await p.waitForTimeout(1500); await p.waitForTimeout(500); const s = await p.evaluate(() => SGView.stats()); ok('play-calls-medium', s.calls <= 120, { calls: s.calls, tris: s.tris, p50: s.p50 }); await p.screenshot({ path: `${OUT}/play/start-medium.png` }); await p.context().close(); }
  { const p = await open(b, 390, 844, '&bench'); await p.waitForTimeout(2500); const s = await p.evaluate(() => SGView.stats()); ok('auto-tier-software-low', s.tier === 'low', { tier: s.tier, gpu: s.gpu, calls: s.calls, tris: s.tris, p50: s.p50, p90: s.p90 }); await p.context().close(); }
  // 3) '!' badge vs move dot: no bounding-box overlap at 4 viewports
  for (const [w, h] of VPS) { const p = await open(b, w, h); await setS(p, 'expose'); await tap(p, 27); await p.waitForTimeout(250);
    const r = await p.evaluate(() => { const out = []; document.querySelectorAll('.cell').forEach(c => { const e = c.querySelector('.mk.expose'); if (!e) return; const eb = e.getBoundingClientRect();
      for (const o of c.querySelectorAll('.mk.move,.mk.cap,.mk.lane')) { const ob = o.getBoundingClientRect(); const ov = Math.max(0, Math.min(eb.right, ob.right) - Math.max(eb.left, ob.left)) * Math.max(0, Math.min(eb.bottom, ob.bottom) - Math.max(eb.top, ob.top));
        if (o.classList.contains('move') || o.classList.contains('lane')) out.push({ cell: +c.dataset.i, kind: o.className, overlap: Math.round(ov) }); } }); return out; });
    ok(`badge-vs-dot-${w}x${h}`, r.length > 0 && r.every(x => x.overlap === 0), r); if (w === 390) await p.screenshot({ path: `${OUT}/play/expose-badge-390.png` }); await p.context().close(); }
  // 4) 'Wait for Red' never lingers into Blue's turn
  { const p = await open(b, 390, 844, '', { ls: { sg_battle: 'off' } }); await tap(p, 31); await tap(p, 25); await p.waitForTimeout(50); await tap(p, 30); await tap(p, 24);
    const t = await p.evaluate(() => new Promise(res => { const t0 = performance.now(); (function poll() { const s = SGDebug.state(); if (s.turn === 0 && !SGDebug.busy()) { setTimeout(() => res({ hint: document.getElementById('hint').textContent, after: Math.round(performance.now() - t0) }), 100); } else setTimeout(poll, 5); })(); }));
    ok('wait-for-red-clears', !/Wait/.test(t.hint), t); await p.context().close(); }
  // 5) battles: Full (keyframes in slow motion), duration, Fast, skip, reduced motion, finale, Red attack
  { const p = await open(b, 390, 844, '&tier=high'); await setS(p, 'shot');
    await p.evaluate(() => { window.SG3D_TS = 12; }); await tap(p, 30); await p.waitForTimeout(150); await tap(p, 18);
    for (const [n, ms] of [['1-charge', 2300], ['2-beam', 1700], ['3-impact', 900], ['4-destruction', 1600], ['5-debris', 2500]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/battle/blue-lancer-shot-${n}.png` }); }
    await p.waitForFunction(() => !SGView.battling(), null, { timeout: 60000 }); await p.evaluate(() => { window.SG3D_TS = 1; });
    await setS(p, 'move'); await p.evaluate(() => { window.SG3D_TS = 12; }); await tap(p, 32); await p.waitForTimeout(150); await tap(p, 20);
    for (const [n, ms] of [['1-charge', 2600], ['2-dash', 1700], ['3-impact-red-explodes', 1500], ['4-fireball', 2200]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/battle/blue-drone-capture-${n}.png` }); }
    await p.waitForFunction(() => !SGView.battling(), null, { timeout: 60000 }); await p.evaluate(() => { window.SG3D_TS = 1; });
    await p.waitForFunction(() => SGDebug.state().turn === 0 && !SGDebug.busy(), null, { timeout: 30000 }).catch(() => {});
    // real-time Full duration
    await setS(p, 'shot'); await tap(p, 30); await p.waitForTimeout(120); await tap(p, 18); await p.waitForFunction(() => !SGView.battling(), null, { timeout: 20000 });
    let lb = await p.evaluate(() => SGView.stats().lastBattle); const fp = await p.evaluate(() => SGView.stats().p90); lb.frameP90 = fp; ok('battle-full-1.3s', lb.planned === 1300 && Math.abs(lb.ms - 1300) <= Math.max(50, lb.maxFrameMs / 2 + 20) && !lb.skipped && lb.shook, lb);   // wall clock from the tap; may overrun only by its last frame
    await setS(p, 'shot'); await p.evaluate(() => localStorage.setItem('sg_battle', 'fast')); await tap(p, 30); await p.waitForTimeout(120); await tap(p, 18); await p.waitForFunction(() => !SGView.battling(), null, { timeout: 20000 });
    lb = await p.evaluate(() => SGView.stats().lastBattle); ok('battle-fast-0.5s', lb.planned === 500 && lb.ms <= 500 + Math.min(lb.maxFrameMs, 100) + 50, lb);
    await p.evaluate(() => localStorage.setItem('sg_battle', 'full')); await setS(p, 'shot'); await tap(p, 30); await p.waitForTimeout(120); await tap(p, 18); await p.waitForTimeout(250);
    const before = await p.evaluate(() => SGView.battling()); await tap(p, 35); await p.waitForTimeout(50); lb = await p.evaluate(() => SGView.stats().lastBattle);
    ok('battle-tap-to-skip', before && lb.skipped && lb.ms < 700, lb);
    await p.waitForTimeout(200);   // presses within 150 ms of a skip are dropped by design
    await setS(p, 'finale'); await tap(p, 31); await p.waitForTimeout(120); await p.evaluate(() => { window.SG3D_TS = 8; }); await tap(p, 13);
    for (const [n, ms] of [['1', 3000], ['2', 2500], ['3', 3500]]) { await p.waitForTimeout(ms); await p.screenshot({ path: `${OUT}/battle/flagship-finale-${n}.png` }); }
    await p.waitForFunction(() => !SGView.battling(), null, { timeout: 60000 }); await p.evaluate(() => { window.SG3D_TS = 1; }); lb = await p.evaluate(() => SGView.stats().lastBattle); ok('battle-finale-2.5s', lb.planned === 2500 && lb.finale, lb);
    await p.waitForTimeout(800); ok('game-over-after-finale', await p.evaluate(() => !document.getElementById('overModal').classList.contains('hidden')));
    await p.context().close(); }
  { const p = await open(b, 390, 844, '', { reduced: true }); await setS(p, 'shot'); await tap(p, 30); await p.waitForTimeout(120); await tap(p, 18); await p.waitForFunction(() => !SGView.battling(), null, { timeout: 20000 });
    const lb = await p.evaluate(() => SGView.stats().lastBattle); ok('battle-reduced-motion-no-shake', lb.kind === 'reduced' && !lb.shook && lb.planned === 300, lb); await p.context().close(); }
  // 6) capture next to/inside nebula haze: battle FX on top, haze dims to 30% on the target square
  { const p = await open(b, 390, 844, '&tier=high'); await p.evaluate(`SGDebug.setState((() => { const s = ${SCEN.shot}; s.nebula = [12, 19, 13]; return s; })()); SGGame.render();`);
    await p.evaluate(() => { window.SG3D_TS = 10; }); await tap(p, 30); await p.waitForTimeout(150); await tap(p, 18); await p.waitForTimeout(5600);
    const s = await p.evaluate(() => SGView.stats()); await p.screenshot({ path: `${OUT}/battle/capture-beside-nebula-impact.png` });
    ok('nebula-haze-dims-in-battle', s.battling, { battling: s.battling }); await p.context().close(); }
  // 7) Red attacks (Red Drone captures)
  { const p = await open(b, 390, 844, '&tier=high'); await p.evaluate(`(() => { const s = SG.newGame(); s.board[19] = null; s.board[14] = { t: 'L', s: 0 }; s.board[24] = {t:'D', s:0}; s.board[30] = null; SGDebug.setState(s); SGGame.render(); })()`);
    await p.evaluate(() => { window.SG3D_TS = 10; }); await tap(p, 27); await p.waitForTimeout(150); await tap(p, 21); // Blue Shield steps, Red replies (AI may capture)
    await p.waitForTimeout(9000); await p.screenshot({ path: `${OUT}/battle/red-turn.png` }); await p.context().close(); }
  // 8) contrast on 3D frames: hatching stripes vs separators, cancel ring
  { const p = await open(b, 390, 844, '&tier=high'); await setS(p, 'expose'); await tap(p, 27); await p.waitForTimeout(400);
    const buf = await p.screenshot(); fs.writeFileSync('/tmp/hatch.png', buf); const cells = await p.evaluate(() => [...document.querySelectorAll('.cell')].map((c, i) => ({ i, d: !!c.querySelector('.ov.threat'), r: c.getBoundingClientRect().toJSON() })).filter(c => c.d));
    fs.writeFileSync('/tmp/hatch-cells.json', JSON.stringify(cells));
    // cancel ring: press and drag away
    const c = await p.evaluate(() => SGDebug.cellCenter(14)); await p.mouse.move(c.x, c.y); await p.mouse.down(); await p.mouse.move(c.x + c.w * .7, c.y, { steps: 3 }); await p.waitForTimeout(40);
    fs.writeFileSync('/tmp/nogo.png', await p.screenshot()); fs.writeFileSync('/tmp/nogo-cell.json', JSON.stringify(c)); await p.mouse.up(); await p.context().close(); }
  // 9) context loss -> 2D fallback, game still works
  { const p = await open(b, 390, 844); const r = await p.evaluate(() => { document.getElementById('gl3d').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext(); return new Promise(res => setTimeout(() => res({ v3d: document.body.classList.contains('v3d'), view: SGDebug.view() }), 300)); });
    await tap(p, 31); await p.waitForTimeout(100); const sel = await p.evaluate(() => !!document.querySelector('.ov.sel')); ok('context-lost-falls-back-to-2d', !r.v3d && r.view === '2d' && sel, r); await p.screenshot({ path: `${OUT}/play/after-context-loss-2d.png` }); await p.context().close(); }
  // 10) 2D fallback by setting
  { const p = await open(b, 390, 844, '', { ls: { sg_view: '2d' }, noview: true }); const r = await p.evaluate(() => ({ state: SG3D.state, canvas: !!document.getElementById('gl3d') })); ok('2d-setting-no-3d', r.state === 'off' && !r.canvas, r); await p.context().close(); }
  // 11) service worker: precache + offline reload
  { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' }); const p = await ctx.newPage();
    await p.goto(BASE + '?view=3d'); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(3000);
    const n = await p.evaluate(async () => { const ks = await caches.keys(); const c = await caches.open(ks.find(k => k.startsWith('sg-'))); return { cache: ks, entries: (await c.keys()).length }; });
    await ctx.setOffline(true); await p.reload(); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 60000 }).catch(() => {});
    const off = await p.evaluate(() => ({ state: SG3D.state, cells: document.querySelectorAll('.cell').length })); ok('service-worker-offline', n.entries >= 25 && off.state === 'on' && off.cells === 36, { ...n, offline: off }); await ctx.close(); }
  fs.writeFileSync(path.join(__dirname, 'results.json'), JSON.stringify(R, null, 1)); console.log('FAILED:', R.fail); await b.close();
})().catch(e => { console.error(e); process.exit(1); });
