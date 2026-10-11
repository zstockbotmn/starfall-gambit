const { chromium, devices } = require('playwright-core');
const assert = require('assert');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const out = '/workspace/starfall-gambit/screenshots/m1.4';
require('fs').rmSync(out, { recursive: true, force: true }); require('fs').mkdirSync(out, { recursive: true });
const sq = s => (6 - +s[1]) * 6 + 'abcdef'.indexOf(s[0]);
const C = s => `.cell[data-i="${sq(s)}"]`;
const setPos = (page, pos, extra) => page.evaluate(([pos, extra]) => { const s = SG.newGame(21); s.board = new Array(36).fill(null);
  for (const [k, v] of Object.entries(pos)) s.board[(6 - +k[1]) * 6 + 'abcdef'.indexOf(k[0])] = { t: v[0], s: +v[1] };
  Object.assign(s, extra || {}); SGDebug.setState(s); }, [pos, extra]);

async function run(browser, w, h, tag) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await page.goto(BASE + '?debug', { waitUntil: 'networkidle' });
  await page.tap('#rulesModal [data-close]');
  const R = { tag };
  const boardTop = () => page.$eval('#board', e => Math.round(e.getBoundingClientRect().top));
  const tops = new Set([await boardTop()]);
  const noScroll = () => page.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth);
  R.cell = await page.$eval('.cell', e => +e.getBoundingClientRect().width.toFixed(1));
  R.noScrollStart = await noScroll();
  // start hint
  R.startHint = await page.textContent('#hint');
  await page.tap(C('b1'));
  R.hintAfterSelect = await page.textContent('#hint');
  assert.ok(!/begin/.test(R.hintAfterSelect), 'start hint replaced on select');
  // 3. capture bracket inside last-move frame: Red D moved b6->a4 (last move), Blue Drone c3 can capture a4
  await setPos(page, { a1: 'F0', c3: 'D0', a4: 'D1', f6: 'F1' }, { lastMove: { from: sq('b6'), to: sq('a4'), kind: 'move', piece: 'D', side: 1, cap: null } });
  await page.tap(C('c3'));
  assert.ok(await page.$eval(C('a4'), c => !!c.querySelector('.mk.cap') && !!c.querySelector('.ov.last')));
  R.capInset = await page.$eval(C('a4') + ' .mk.cap', e => { const c = e.parentElement.getBoundingClientRect(), r = e.getBoundingClientRect(); return Math.round(r.left - c.left); });
  await page.locator('#boardWrap').screenshot({ path: `${out}/${tag}-capture-in-lastmove-frame.png` });
  // 4. Flagship exposure warning: Shield d2 shields Flagship d1 from Lancer d4
  await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', d4: 'L1', f6: 'F1' });
  await page.tap(C('d2'));
  const exp = await page.$$eval('.mk.expose', a => a.map(e => +e.parentElement.dataset.i));
  assert.deepEqual(exp.sort(), [sq('c2'), sq('e2')].sort(), 'exposure badges on c2, e2 ' + exp);
  R.exposeHint = await page.textContent('#hint');
  await page.screenshot({ path: `${out}/${tag}-flagship-exposure-warning.png` });
  await page.tap(C('c2'));                                     // not blocked
  assert.equal(await page.evaluate(() => SGDebug.state().ply), 1, 'exposing move allowed');
  await page.waitForTimeout(900);
  // 5a. jammed: no ring + countdown
  await setPos(page, { d1: 'F0', c2: 'S0', f6: 'F1', a6: 'L1' }, { nebula: [sq('c2'), sq('c5'), sq('e3'), sq('e4')], nextPulse: 6, ply: 2 });
  await page.tap(C('c2'));
  R.jamHint = await page.textContent('#hint');
  assert.ok(/shifts in 4 moves/.test(R.jamHint), 'jam countdown');
  assert.equal(await page.$$eval('.ov.sel', a => a.length), 0, 'no ring on jammed ship');
  await page.screenshot({ path: `${out}/${tag}-jammed-countdown.png` });
  // 5b. inspect closes on the next move (consistent): inspect Red Lancer, then make a Blue move, Red replies
  await setPos(page, { d1: 'F0', b1: 'D0', f6: 'F1', a6: 'L1' });
  await page.tap(C('a6')); assert.equal(await page.$$eval('.ov.sel.foe', a => a.length), 1);
  await page.tap(C('b1')); await page.tap(C('c3'));
  assert.equal(await page.$$eval('.ov.sel.foe', a => a.length), 0, 'inspect closed on move');
  // pre-select during Red's delay survives Red's move
  await page.tap(C('d1'));
  await page.waitForFunction(() => SGDebug.state().turn === 0, null, { timeout: 3000 });
  R.preselectKept = await page.$$eval('.ov.sel:not(.foe)', a => a.length) === 1;
  // 5c. victory popup delay
  await setPos(page, { a1: 'F0', d3: 'L0', d6: 'F1' });
  await page.tap(C('d3'));
  const t0 = Date.now(); await page.tap(C('d6'));
  await page.waitForSelector('#overModal:not(.hidden)', { timeout: 3000 }); R.victoryMs = Date.now() - t0;
  await page.screenshot({ path: `${out}/${tag}-victory.png` });
  await page.tap('#btnAgain');
  // debug tap log screenshot (tap empty square with nothing selected -> logged as ignored)
  await page.tap(C('c4'));
  if (tag === '390') await page.screenshot({ path: `${out}/${tag}-debug-taplog.png` });
  // legend + full trays + no scroll
  await page.evaluate(() => { const s = SGDebug.state(); SGDebug.setState(Object.assign({}, s, { captured: [['F','D','D','L','L','S','S'], ['S','S','L','L','D','D','F']] })); });
  R.noScrollFullTrays = await noScroll(); tops.add(await boardTop());
  await page.screenshot({ path: `${out}/${tag}-full-trays.png` });
  // play-through: board top fixed, no scroll
  await page.evaluate(() => SGDebug.setState(SG.newGame(88)));
  tops.add(await boardTop());
  let warnSeen = false, ns = true;
  for (let n = 0; n < 80; n++) {
    const s = await page.evaluate(() => { const s = SGDebug.state(); return { w: s.winner, t: s.turn }; });
    if (s.w !== null) break;
    if (s.t !== 0) { await page.waitForTimeout(120); n--; continue; }
    if (await page.$('.neb.warn')) { if (!warnSeen) await page.screenshot({ path: `${out}/${tag}-shift-warning.png` }); warnSeen = true; }
    const mv = await page.evaluate(() => SGAI.safeChooseMove(SGDebug.state(), 'easy'));
    await page.tap(`.cell[data-i="${mv.from}"]`); tops.add(await boardTop());
    if (n === 3) await page.screenshot({ path: `${out}/${tag}-selected-midgame.png` });
    await page.tap(`.cell[data-i="${mv.to}"]`); tops.add(await boardTop()); ns = ns && await noScroll();
    await page.waitForTimeout(720); tops.add(await boardTop()); ns = ns && await noScroll();
  }
  await page.waitForTimeout(500); tops.add(await boardTop());
  await page.screenshot({ path: `${out}/${tag}-game-over.png` });
  if (await page.isVisible('#overModal')) { await page.tap('#overModal [data-close]'); tops.add(await boardTop()); ns = ns && await noScroll(); }
  R.boardTops = [...tops]; R.noScrollPlay = ns; R.warnSeen = warnSeen; R.errs = errs;
  await ctx.close();
  return R;
}
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const res = [];
  for (const [w, h, t] of [[390, 844, '390'], [375, 548, '375x548'], [320, 568, '320']]) res.push(await run(browser, w, h, t));
  console.log(JSON.stringify(res, null, 1));
  for (const r of res) {
    assert.equal(r.boardTops.length, 1, r.tag + ' board moved'); assert.ok(r.noScrollStart && r.noScrollFullTrays && r.noScrollPlay, r.tag + ' scroll');
    assert.ok(r.cell >= 44, r.tag + ' cell'); assert.equal(r.errs.length, 0); assert.ok(r.preselectKept); assert.ok(r.victoryMs < 700);
  }
  console.log('UI CHECKS PASSED');
  await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
