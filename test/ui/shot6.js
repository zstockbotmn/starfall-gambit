const { chromium, devices } = require('playwright-core');
const assert = require('assert');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const out = '/workspace/starfall-gambit/screenshots/m1.5';
require('fs').rmSync(out, { recursive: true, force: true }); require('fs').mkdirSync(out, { recursive: true });
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
const marks = page => page.evaluate(() => { const r = { move: [], cap: [], sel: [], expose: [], queued: [] }, f = i => 'abcdef'[i % 6] + (6 - Math.floor(i / 6));
  document.querySelectorAll('.cell').forEach(c => { const i = +c.dataset.i;
    if (c.querySelector('.mk.move')) r.move.push(f(i)); if (c.querySelector('.mk.cap')) r.cap.push(f(i)); if (c.querySelector('.ov.sel')) r.sel.push(f(i));
    if (c.querySelector('.mk.expose')) r.expose.push(f(i)); if (c.querySelector('.ov.queued')) r.queued.push(f(i)); }); return r; });
const ply = page => page.evaluate(() => SGDebug.state().ply);
const hint = page => page.textContent('#hint');

async function features(page, tag) {
  const R = {};
  // Queue (legal): Blue F a1, D b1, L f2; Red F f6, D e5. Blue moves L f2->f3, then during Red's delay selects D b1 and taps a3.
  await setPos(page, { a1: 'F0', b1: 'D0', f2: 'L0', f6: 'F1', e5: 'D1' });
  await forceRed(page, 'f6', 'e6');
  await page.tap(C('f2')); await page.tap(C('f3'));
  await page.tap(C('b1')); await page.tap(C('a3'));
  let m = await marks(page); assert.deepEqual(m.queued, ['a3'], 'queued marker'); R.queuedHint = await hint(page);
  await page.screenshot({ path: `${out}/${tag}-queued-move.png` });
  await page.waitForFunction(() => SGDebug.state().ply === 3, null, { timeout: 4000 });
  assert.equal(await page.evaluate(q => SGDebug.state().board[q] && SGDebug.state().board[q].t, sq('a3')), 'D', 'queued move played');
  await page.waitForFunction(() => SGDebug.state().turn === 0, null, { timeout: 4000 });
  // Queue (no longer legal): Red Drone lands on a3 -> Blue's quiet move to a3 is now a capture -> not played
  await setPos(page, { a1: 'F0', b1: 'D0', f2: 'L0', f6: 'F1', b5: 'D1' });
  await forceRed(page, 'b5', 'a3');
  await page.tap(C('f2')); await page.tap(C('f3'));
  await page.tap(C('b1')); await page.tap(C('a3'));
  await page.waitForFunction(() => SGDebug.state().ply === 2 && SGDebug.state().turn === 0, null, { timeout: 4000 });
  await page.waitForTimeout(450);
  R.illegalQueueHint = await hint(page); assert.ok(/Wait for Red/.test(R.illegalQueueHint)); assert.equal(await ply(page), 2);
  m = await marks(page); assert.deepEqual(m.sel, ['b1'], 'selection kept'); assert.ok(m.cap.includes('a3'), 'markers recomputed after Red (a3 now a capture)');
  await page.screenshot({ path: `${out}/${tag}-queued-move-not-legal.png` });
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
  // Double-tap a destination: the moved ship must not be reselected
  await setPos(page, { a1: 'F0', b1: 'D0', f6: 'F1' });
  await page.tap(C('b1')); await page.tap(C('c3')); await page.tap(C('c3'));
  m = await marks(page); assert.equal(await ply(page), 1); assert.deepEqual(m.sel, [], 'not reselected after double-tap');
  await page.waitForTimeout(900);
  // '!' only when newly exposed + badge not covering bracket
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', d4: 'L1', f6: 'F1', c2: 'D1' });
  await page.tap(C('d2'));
  m = await marks(page); assert.deepEqual(m.expose.sort(), ['c2', 'e2'], 'badges');
  const overlap = await page.$eval(C('c2'), c => { const b = c.querySelector('.mk.expose').getBoundingClientRect(), k = c.querySelector('.mk.cap').getBoundingClientRect();
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
  const cdp = await page.context().newCDPSession(page);
  const g = await page.$eval(C('d2'), e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: g[0], y: g[1] }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: g[0] - g[2] * 1.2, y: g[1] }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(100);
  R.logTop = (await page.textContent('#tapLog')).split('\n')[0];
  assert.ok(/cancelled: drag over 0.6 cell/.test(R.logTop));
  assert.equal(await ply(page), 0);
  await page.screenshot({ path: `${out}/${tag}-debug-cancel-log.png` });
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
