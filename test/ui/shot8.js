const { chromium, devices } = require('playwright-core');
const assert = require('assert');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const out = process.env.OUT || '/workspace/starfall-gambit-m2/screenshots/m2/ui';
require('fs').mkdirSync(out, { recursive: true });
const sq = s => (6 - +s[1]) * 6 + 'abcdef'.indexOf(s[0]);
const C = s => `.cell[data-i="${sq(s)}"]`;
const setPos = (page, pos, extra) => page.evaluate(([pos, extra]) => { const s = SG.newGame(21); s.board = new Array(36).fill(null);
  for (const [k, v] of Object.entries(pos)) s.board[(6 - +k[1]) * 6 + 'abcdef'.indexOf(k[0])] = { t: v[0], s: +v[1] };
  Object.assign(s, extra || {}); SGDebug.setState(s); }, [pos, extra]);
// Force Red's next move (from,to) via the AI hook
const forceRed = (page, from, to) => page.evaluate(([f, t]) => { window.__forced = [f, t];
  if (!window.__origAI) { window.__origAI = SGAI.safeChooseMove; SGAI.safeChooseMove = function (st, lv) {
    if (window.__forced) { const [a, b] = window.__forced; window.__forced = null; const m = SG.legalMoves(st).find(x => x.from === a && x.to === b); if (m) return m; }
    return window.__origAI(st, lv); }; } }, [sq(from), sq(to)]);
const marks = page => page.evaluate(() => { const r = { move: [], cap: [], sel: [], expose: [], queued: [], threat: [] }, f = i => 'abcdef'[i % 6] + (6 - Math.floor(i / 6));
  document.querySelectorAll('.cell').forEach(c => { const i = +c.dataset.i;
    if (c.querySelector('.mk.move')) r.move.push(f(i)); if (c.querySelector('.mk.cap')) r.cap.push(f(i)); if (c.querySelector('.ov.sel')) r.sel.push(f(i));
    if (c.querySelector('.mk.expose')) r.expose.push(f(i)); if (c.querySelector('.ov.queued')) r.queued.push(f(i)); if (c.querySelector('.ov.threat')) r.threat.push(f(i)); }); return r; });
const ply = page => page.evaluate(() => SGDebug.state().ply);
const hint = page => page.textContent('#hint');

async function features(page, tag) {
  const R = {};
  const cdp = await page.context().newCDPSession(page);
  const geo = c => page.evaluate(i => { const c = SGDebug.cellCenter(i); return [c.x, c.y, c.w]; }, sq(c));   // real projected square in 3D
  const touch = async (pts, gap) => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0][0], y: pts[0][1] }] });
    for (const p of pts.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const tapAt = async c => { const g = await geo(c); await touch([[g[0], g[1]]]); };
  // 1+5. Destination tap during Red's turn does nothing; no hatching / '!' until Red has moved.
  // Blue F a1, D b1, L f2; Red F f6, D b5 (attacks a3, c3). Blue L f2->f3, then during Red's delay select D b1 and tap a3.
  await setPos(page, { a1: 'F0', b1: 'D0', f2: 'L0', f6: 'F1', b5: 'D1' });
  await forceRed(page, 'f6', 'e6');
  await page.tap(C('f2')); await page.tap(C('f3'));
  await page.tap(C('b1')); await page.tap(C('a3'));
  let m = await marks(page);
  assert.equal(await ply(page), 1, 'no move during Red turn'); assert.deepEqual(m.sel, ['b1'], 'selection kept');
  assert.deepEqual(m.threat, [], 'no hatching during Red turn'); assert.deepEqual(m.queued, [], 'no queue marker');
  assert.deepEqual(m.move, [], 'no stale move dots during Red turn'); assert.deepEqual(m.cap, [], 'no brackets during Red turn');
  R.redTurnHint = await hint(page); assert.ok(/Wait for Red\u2019s move/.test(R.redTurnHint), 'brief wait message: ' + R.redTurnHint);
  await page.screenshot({ path: `${out}/${tag}-redturn-preselect-no-hatching.png` });
  await page.waitForFunction(() => SGDebug.state().ply === 2, null, { timeout: 4000 }); await page.waitForTimeout(200);
  m = await marks(page); assert.equal(await ply(page), 2, 'nothing auto-played'); assert.deepEqual(m.sel, ['b1']); assert.ok(m.move.includes('a3'), 'move dots after Red moved');
  assert.deepEqual(m.threat.sort(), ['a3', 'c3'], 'hatching appears after Red moved');
  await page.screenshot({ path: `${out}/${tag}-after-red-markers.png` });
  await page.tap(C('a3')); assert.equal(await ply(page), 3, 'tap again after Red moves plays it');
  await page.waitForFunction(() => SGDebug.state().turn === 0, null, { timeout: 4000 });
  // 5. '!' badges: none during Red's turn, shown after Red moved
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', d4: 'L1', f6: 'F1' });
  await forceRed(page, 'f6', 'e6');
  await page.tap(C('a1')); await page.tap(C('a2')); await page.tap(C('d2'));
  m = await marks(page); assert.deepEqual(m.sel, ['d2']); assert.deepEqual(m.expose, [], "no '!' during Red turn");
  await page.waitForFunction(() => SGDebug.state().ply === 2, null, { timeout: 4000 }); await page.waitForTimeout(100);
  m = await marks(page); assert.deepEqual(m.expose.sort(), ['c2', 'e2'], "'!' after Red moved");
  await page.screenshot({ path: `${out}/${tag}-expose-after-red.png` });
  // 2. Warning + what Red just did + hint all visible (Red Drone b5->c3 attacks the Flagship on d1)
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', f6: 'F1', b5: 'D1' });
  await forceRed(page, 'b5', 'c3');
  await page.tap(C('a1')); await page.tap(C('a2'));
  await page.waitForFunction(() => SGDebug.state().ply === 2, null, { timeout: 4000 });
  await page.tap(C('a2'));
  R.info = await page.evaluate(() => { const info = document.querySelector('.info').getBoundingClientRect(), lim = Math.min(innerHeight, info.bottom) + 0.5;
    const v = id => { const e = document.getElementById(id), r = e.getBoundingClientRect(); return { text: e.textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), ok: r.height >= 14 && r.bottom <= lim && r.top >= info.top - 0.5 }; };
    return { warn: v('warn'), last: v('lastMove'), hint: v('hint'), infoH: Math.round(info.height) }; });
  assert.equal(R.info.warn.text, '\u26A0 Your Flagship is under attack!'); assert.ok(/Red/.test(R.info.last.text));
  assert.ok(R.info.warn.ok && R.info.last.ok && R.info.hint.ok, 'warning, last move and hint all visible ' + JSON.stringify(R.info));
  await page.screenshot({ path: `${out}/${tag}-warning-with-red-move.png` });
  // 4. Re-tap on the ship that just moved: ~50ms (double-tap echo) ignored, ~160ms reselects
  await setPos(page, { a1: 'F0', b1: 'D0', f6: 'F1' });
  { const g = await geo('c3'); await tapAt('b1'); await page.evaluate(() => { window.__ups = []; addEventListener('pointerup', e => __ups.push(e.timeStamp), true); }); await touch([[g[0], g[1]]]); await page.waitForTimeout(50); await touch([[g[0], g[1]]]); }   // coords fetched up front so the echo gap is really ~50 ms
  m = await marks(page); assert.equal(await ply(page), 1); R.echoGapMs = await page.evaluate(() => Math.round(__ups[__ups.length - 1] - __ups[__ups.length - 2]));
  if (R.echoGapMs < 150) assert.deepEqual(m.sel, [], 'echo at ~50ms ignored'); else console.log('NOTE echo gap ' + R.echoGapMs + 'ms >= 150ms on this renderer: reselect is correct, echo check skipped');
  await page.waitForTimeout(900);
  await setPos(page, { a1: 'F0', b1: 'D0', f6: 'F1' });
  await tapAt('b1'); await tapAt('c3'); await page.waitForTimeout(160); await tapAt('c3');
  m = await marks(page); assert.equal(await ply(page), 1); assert.deepEqual(m.sel, ['c3'], 're-tap at ~160ms reselects');
  await page.waitForTimeout(900);
  // 3. Edge drift: < 0.25 cell across a border counts on the start square; lift <= 8px outside the board counts; 14px outside cancels
  await setPos(page, { a1: 'F0', b1: 'D0', f6: 'F1' });
  let g = await geo('b1');
  await touch([[g[0] + g[2] * 0.4, g[1]], [g[0] + g[2] * 0.52, g[1]], [g[0] + g[2] * 0.62, g[1]]]);   // 0.22 cell, ends in c1
  m = await marks(page); assert.deepEqual(m.sel, ['b1'], 'drift across border counts on start'); R.driftLog = (await page.textContent('#tapLog')).split('\n').slice(0, 2);
  await page.screenshot({ path: `${out}/${tag}-edge-drift.png` });
  await tapAt('b1'); m = await marks(page); assert.deepEqual(m.sel, []);
  const bb = await page.evaluate(() => document.querySelectorAll('.cell')[35].getBoundingClientRect().bottom);
  await touch([[g[0], bb - g[2] * 0.2], [g[0], bb + 3], [g[0], bb + 7]]);   // lifts 7px below the board
  m = await marks(page); assert.deepEqual(m.sel, ['b1'], 'lift within 8px outside counts');
  await tapAt('b1');
  await touch([[g[0], bb - g[2] * 0.2], [g[0], bb + 8], [g[0], bb + 14]]);  // 14px outside: cancelled
  m = await marks(page); assert.deepEqual(m.sel, [], 'lift 14px outside cancels');
  R.edgeLog = (await page.textContent('#tapLog')).split('\n')[0]; assert.ok(/lifted off the board/.test(R.edgeLog));
  await touch([[g[0], g[1]], [g[0] + g[2] * 0.4, g[1]], [g[0] + g[2] * 0.62, g[1]]]);   // 0.62 cell: swipe cancel
  m = await marks(page); assert.deepEqual(m.sel, [], '0.6 swipe cancel kept');
  await touch([[g[0] + g[2] * 0.2, g[1]], [g[0] + g[2] * 0.45, g[1]], [g[0] + g[2] * 0.6, g[1]]]);   // 0.4 cell into c1: cancelled
  m = await marks(page); assert.deepEqual(m.sel, [], '0.25-0.6 into neighbour cancels');
  assert.ok(/ended on a different square/.test((await page.textContent('#tapLog')).split('\n')[0]));
  // Pre-selected ship captured by Red
  await setPos(page, { a1: 'F0', b1: 'D0', f2: 'L0', f6: 'F1', c3: 'D1' });
  await forceRed(page, 'c3', 'b1');
  await page.tap(C('f2')); await page.tap(C('f3'));
  await page.tap(C('b1'));
  await page.waitForFunction(() => SGDebug.state().ply === 2, null, { timeout: 4000 });
  R.capturedHint = await hint(page); assert.ok(/Your selected Drone was captured/.test(R.capturedHint));
  await page.screenshot({ path: `${out}/${tag}-preselected-captured.png` });
  // Pre-selection markers recomputed: Lancer a1 pre-selected; Red Drone moves into its lane (a4) -> capture marker appears
  await setPos(page, { b1: 'F0', a1: 'L0', f2: 'L0', f6: 'F1', b6: 'D1' });
  await forceRed(page, 'b6', 'a4');
  await page.tap(C('f2')); await page.tap(C('f3')); await page.tap(C('a1'));
  m = await marks(page); assert.ok(!m.cap.includes('a4'));
  await page.waitForFunction(() => SGDebug.state().ply === 2, null, { timeout: 4000 });
  m = await marks(page); assert.deepEqual(m.sel, ['a1']); assert.ok(m.cap.includes('a4'), 'pre-selection recomputed');
  await page.screenshot({ path: `${out}/${tag}-preselect-recomputed.png` });
  // '!' only when newly exposed + badge not covering bracket
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', d4: 'L1', f6: 'F1', c2: 'D1' });
  await page.tap(C('d2'));
  m = await marks(page); assert.deepEqual(m.expose.sort(), ['c2', 'e2'], 'badges');
  const overlap = await page.$eval(C('c2'), c => { const L = e => ({ left: e.offsetLeft, top: e.offsetTop, right: e.offsetLeft + e.offsetWidth, bottom: e.offsetTop + e.offsetHeight }), b = L(c.querySelector('.mk.expose')), k = L(c.querySelector('.mk.cap'));
    return b.bottom > k.top + 0.5 && b.top < k.bottom && b.right > k.left && b.left < k.right; });
  R.badgeOverlapsBracket = overlap; assert.ok(!overlap, 'badge clear of bracket box');
  await page.locator('#boardWrap').screenshot({ path: `${out}/${tag}-badge-and-capture.png` });
  // already under attack -> no badges, one warning line
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', d4: 'L1', f6: 'F1', c3: 'D1' });
  await page.tap(C('d2'));
  m = await marks(page); assert.deepEqual(m.expose, [], 'no badges when already under attack');
  R.warn = await page.textContent('#warn');
  assert.equal(R.warn, '\u26A0 Your Flagship is under attack!');
  const wv = await page.evaluate(() => { const w = document.getElementById('warn'), r = w.getBoundingClientRect(), info = document.querySelector('.info').getBoundingClientRect();
    return r.height > 0 && r.bottom <= Math.min(innerHeight, info.bottom) + 0.5 && w.scrollWidth <= w.clientWidth + 1; });
  R.warnFullyVisible = wv; assert.ok(wv, 'warning not clipped');
  await page.screenshot({ path: `${out}/${tag}-flagship-under-attack.png` });
  // ?debug log of a cancelled swipe
  g = await page.$eval(C('d2'), e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g[0], y: g[1] }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: g[0] - g[2] * 1.2, y: g[1] }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  R.logTop = (await page.textContent('#tapLog')).split('\n')[0];
  assert.ok(/cancelled: drag over 0.6 cell/.test(R.logTop));
  assert.equal(await ply(page), 0);
  assert.ok(!(await page.isVisible('#tapLog')), 'debug log starts collapsed');
  await page.click('.taplogbtn'); assert.ok(await page.isVisible('#tapLog'), 'log expands');
  R.logPanel = await page.evaluate(() => { const b = document.querySelector('.taplogbox').getBoundingClientRect(), w = document.getElementById('warn').getBoundingClientRect(), info = document.querySelector('.info').getBoundingClientRect();
    return { bottom: Math.round(b.bottom), warnTop: Math.round(w.top), clear: b.bottom <= info.top && b.bottom <= w.top }; });
  assert.ok(R.logPanel.clear, 'debug log clear of warning');
  await page.screenshot({ path: `${out}/${tag}-debug-cancel-log.png` });
  await page.click('.taplogbtn'); assert.ok(!(await page.isVisible('#tapLog')), 'log collapses again');
  // Corner taps (inside the rounded corner, and up to ~6px outside the grid) fall back to the nearest cell
  await setPos(page, { a1: 'F0', f1: 'D0', f6: 'F1', a6: 'L1' });
  const gb = await page.evaluate(() => { const c = document.querySelectorAll('.cell'), a = c[0].getBoundingClientRect(), b = c[35].getBoundingClientRect(); return { l: a.left, t: a.top, r: b.right, b: b.bottom }; });
  R.corner = {};
  for (const [name, x, y, want] of [['a1 corner', gb.l + 1, gb.b - 1, 'a1'], ['a1 outside 5px', gb.l - 5, gb.b + 5, 'a1'], ['f1 corner', gb.r - 1, gb.b - 1, 'f1'], ['f1 outside 6px', gb.r + 6, gb.b + 4, 'f1']]) {
    await touch([[x, y]]); m = await marks(page); R.corner[name] = m.sel[0] || null; assert.deepEqual(m.sel, [want], name);
    await tapAt(want); m = await marks(page); assert.deepEqual(m.sel, []);
  }
  await touch([[gb.l + 1, gb.t + 1]]); R.corner['a6 corner (Red, inspect)'] = await page.evaluate(() => !!document.querySelector('.ov.sel.foe')); assert.ok(R.corner['a6 corner (Red, inspect)']);
  // Info area order is warning > last move > hint on every screen
  R.infoOrder = await page.evaluate(() => [...document.querySelector('.info').children].map(e => e.id).join(','));
  assert.equal(R.infoOrder, 'warn,lastMove,hint');
  // ?debug panel sits below dialogs
  await page.click('#btnRules');
  R.logUnderDialog = await page.evaluate(() => { const b = document.querySelector('.taplogbtn').getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !el.closest('.taplogbox'); });
  assert.ok(R.logUnderDialog, 'debug panel below the rules dialog');
  await page.click('#rulesModal [data-close]');
  return R;
}

async function run(browser, w, h, tag) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '?debug', { waitUntil: 'networkidle' });
  await page.tap('#rulesModal [data-close]');
  const boardTop = () => page.$eval('#board', e => Math.round(e.getBoundingClientRect().top));
  const noScroll = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
  const tops = new Set([await boardTop()]);
  const R = { tag, cell: await page.$eval('.cell', e => +e.getBoundingClientRect().width.toFixed(1)) };
  Object.assign(R, await features(page, tag));
  tops.add(await boardTop());
  // full trays + under-attack warning + no scroll
  await setPos(page, { d1: 'F0', d2: 'S0', d4: 'L1', f6: 'F1', c3: 'D1' }, { captured: [['F','D','D','L','L','S','S'], ['S','S','L','L','D','D','F']] });
  R.noScrollFull = await noScroll(); tops.add(await boardTop());
  await page.screenshot({ path: `${out}/${tag}-full-trays-warning.png` });
  // play-through
  await page.evaluate(() => { if (window.__origAI) SGAI.safeChooseMove = window.__origAI; window.__origAI = null; SGDebug.setState(SG.newGame(91)); });
  let ns = true;
  for (let n = 0; n < 80; n++) {
    const s = await page.evaluate(() => { const s = SGDebug.state(); return { w: s.winner, t: s.turn }; });
    if (s.w !== null) break;
    if (s.t !== 0) { await page.waitForTimeout(120); n--; continue; }
    const mv = await page.evaluate(() => SGAI.safeChooseMove(SGDebug.state(), 'easy'));
    await page.tap(`.cell[data-i="${mv.from}"]`); tops.add(await boardTop());
    await page.tap(`.cell[data-i="${mv.to}"]`); tops.add(await boardTop()); ns = ns && await noScroll();
    await page.waitForTimeout(720); tops.add(await boardTop());
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${tag}-game-over.png` });
  if (await page.isVisible('#overModal')) { await page.tap('#overModal [data-close]'); tops.add(await boardTop()); }
  R.boardTops = [...tops]; R.noScrollPlay = ns; R.errs = errs;
  await ctx.close();
  return R;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = [];
  for (const [w, h] of [[390, 844], [375, 548], [320, 460], [320, 568]]) res.push(await run(browser, w, h, `${w}x${h}`));
  console.log(JSON.stringify(res, null, 1));
  for (const r of res) { assert.equal(r.boardTops.length, 1, r.tag + ' board moved'); assert.ok(r.noScrollFull && r.noScrollPlay, r.tag + ' scroll'); assert.equal(r.errs.length, 0); }
  console.log('UI CHECKS PASSED');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
