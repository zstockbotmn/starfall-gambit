// Tap stress test: rapid select->destination taps with mixed input (CDP touch, mouse, click-only),
// jittered finger drift, holds, taps inside the computer's move delay and right after redraws. Counts dropped taps.
const { chromium } = require('playwright-core');
const assert = require('assert');
const BASE = process.argv[2] || 'http://127.0.0.1:8765/';
const GAMES = +process.argv[3] || 6;
const W = +(process.argv[4] || 390), H = +(process.argv[5] || 844);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '?debug', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.setItem('sg_seen_rules', '1'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); });
  const cdp = await ctx.newCDPSession(page);
  const R = { taps: 0, dropped: 0, byType: {}, drops: [], kinds: {} };
  const geo = i => page.$eval(`.cell[data-i="${i}"]`, e => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width]; });
  let maxDrift = 0;
  async function tapCell(i, type) {
    const [x, y, w] = await geo(i);
    // start near the centre, then drift up to 0.48 cell in a random direction, staying inside the square
    const sx = x + rnd(-0.12, 0.12) * w, sy = y + rnd(-0.12, 0.12) * w;
    let L = rnd(0, 0.48) * w; const ang = rnd(0, 2 * Math.PI);
    let ex, ey;
    for (;;) { ex = sx + L * Math.cos(ang); ey = sy + L * Math.sin(ang); if (Math.abs(ex - x) < 0.47 * w && Math.abs(ey - y) < 0.47 * w) break; L *= 0.9; }
    maxDrift = Math.max(maxDrift, L / w);
    const hold = pick([0, 15, 40, 90, 180, 350]);
    if (type === 'touch') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
      if (hold) await page.waitForTimeout(hold / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (sx + ex) / 2, y: (sy + ey) / 2 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ex, y: ey }] });
      if (hold) await page.waitForTimeout(hold / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (type === 'mouse') {
      await page.mouse.move(sx, sy); await page.mouse.down(); if (hold) await page.waitForTimeout(hold);
      await page.mouse.move(ex, ey, { steps: 2 }); await page.mouse.up();
    } else {
      await page.$eval(`.cell[data-i="${i}"]`, e => e.click());
    }
    R.taps++; R.byType[type] = (R.byType[type] || 0) + 1;
  }
  // A swipe/drag: path of points; must never change anything.
  async function swipe(points, type) {
    if (type === 'touch') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: points[0][0], y: points[0][1] }] });
      for (const p of points.slice(1)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: p[0], y: p[1] }] }); await page.waitForTimeout(8); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await page.mouse.move(points[0][0], points[0][1]); await page.mouse.down();
      for (const p of points.slice(1)) await page.mouse.move(p[0], p[1], { steps: 2 });
      await page.mouse.up();
    }
  }
  const S = () => page.evaluate(() => { const s = SGDebug.state(); const sel = document.querySelector('.ov.sel:not(.foe)');
    return { ply: s.ply, turn: s.turn, w: s.winner, sel: sel ? +sel.closest('.cell').dataset.i : null, busy: SGDebug.busy() }; });
  const settle = () => page.waitForTimeout(30);
  function drop(kind, info) { R.dropped++; R.drops.push({ kind, ...info }); }
  for (let g = 0; g < GAMES; g++) {
    await page.evaluate(seed => SGDebug.setState(SG.newGame(seed)), 500 + g);
    let guard = 0;
    while (guard++ < 120) {
      let s = await S();
      if (s.w !== null) break;
      if (s.turn !== 0) {
        // Inside the computer's delay: pre-select a random own ship (must register even mid-delay).
        if (s.busy && Math.random() < 0.6) {
          const own = await page.evaluate(() => { const s = SGDebug.state(), lm = s.lastMove; return s.board.map((p, i) => p && p.s === 0 && !SG.isNebula(s, i) && !(lm && lm.side === 0 && lm.to === i) ? i : -1).filter(i => i >= 0); });
          if (own.length) {
            const i = pick(own), type = pick(['touch', 'touch', 'mouse', 'click']);
            await tapCell(i, type); await settle();
            const t = await S(); R.kinds.preselect = (R.kinds.preselect || 0) + 1;
            if (t.turn === 1 && t.w === null && t.sel !== i) drop('preselect-during-delay', { i, type, t });
          }
        }
        await page.waitForFunction(() => SGDebug.state().turn === 0 || SGDebug.state().winner !== null, null, { timeout: 5000, polling: 5 });
        continue;                                             // tap immediately after Red's redraw
      }
      const mv = await page.evaluate(() => SGAI.safeChooseMove(SGDebug.state(), 'easy'));
      if (s.sel !== mv.from) {
        const type = pick(['touch', 'touch', 'touch', 'mouse', 'click']);
        await tapCell(mv.from, type); await settle();
        const t = await S(); R.kinds.select = (R.kinds.select || 0) + 1;
        if (t.sel !== mv.from) { drop('select', { i: mv.from, type, t }); continue; }
      }
      const type = pick(['touch', 'touch', 'touch', 'mouse', 'click']);
      const ply0 = (await S()).ply;
      await tapCell(mv.to, type); await settle();
      const t = await S(); R.kinds.destination = (R.kinds.destination || 0) + 1;
      if (t.ply !== ply0 + 1 && !(t.w !== null && t.ply === ply0 + 1)) drop('destination', { from: mv.from, to: mv.to, type, t });
    }
  }
  // ---- Phase B: swipes / drags (touch + mouse). None may change the game.
  R.swipes = 0; R.accidentalMoves = 0; R.accidentalChanges = 0; R.swipeKinds = {};
  const SWIPES = +(process.env.SWIPES || 150);
  for (let k = 0; k < SWIPES; k++) {
    if (k % 25 === 0) await page.evaluate(seed => SGDebug.setState(SG.newGame(seed)), 900 + k);
    let s0 = await S();
    if (s0.turn !== 0 || s0.w !== null) { await page.evaluate(seed => SGDebug.setState(SG.newGame(seed)), 950 + k); s0 = await S(); }
    // select a ship that has moves (by a normal tap), so a sloppy swipe *could* hit a legal destination
    const info = await page.evaluate(() => { const s = SGDebug.state(); const ms = SG.legalMoves(s).filter(m => m.kind === 'move'); const m = ms[Math.floor(Math.random() * ms.length)]; return m ? { from: m.from, to: m.to } : null; });
    if (!info) continue;
    if (s0.sel !== info.from) await tapCell(info.from, 'touch');
    await page.waitForTimeout(20);
    const before = await page.evaluate(() => { const s = SGDebug.state(); return { ply: s.ply, sel: (document.querySelector('.ov.sel') || { closest: () => null }).closest('.cell')?.dataset.i ?? null, insp: !!document.querySelector('.ov.sel.foe') }; });
    if (before.sel === null) continue;
    const bb = await page.$eval('#board', e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; });
    const [fx, fy, w] = await geo(info.from), [tx, ty] = await geo(info.to);
    const kind = pick(['ship-to-destination', 'destination-to-elsewhere', 'elsewhere-to-destination', 'off-board', 'out-and-back', 'across-board', 'edge-lift-off', 'small-into-neighbour']);
    let pts;
    if (kind === 'ship-to-destination') pts = [[fx, fy], [(fx + tx) / 2, (fy + ty) / 2], [tx, ty]];
    else if (kind === 'destination-to-elsewhere') pts = [[tx, ty], [tx + w * 0.4, ty], [tx + w * 0.9, ty + w * 0.3]];
    else if (kind === 'elsewhere-to-destination') pts = [[tx - w * 1.1, ty + w * 0.2], [tx - w * 0.5, ty], [tx, ty]];
    else if (kind === 'off-board') pts = [[tx, ty], [tx, ty - w * 0.4], [tx, bb.t - 30], [tx, Math.max(2, bb.t - 80)]];
    else if (kind === 'out-and-back') pts = [[tx, ty], [tx + w * 0.8, ty], [tx + w * 1.2, ty + w * 0.4], [tx + w * 0.1, ty]];
    else if (kind === 'edge-lift-off') { const [ex, ey] = await geo(info.to % 6); pts = [[ex, bb.t + w * 0.08], [ex, bb.t - w * 0.15], [ex, bb.t - w * 0.35]]; }   // < 0.6 cell, ends off the board
    else if (kind === 'small-into-neighbour') pts = [[tx + w * 0.38, ty], [tx + w * 0.6, ty], [tx + w * 0.8, ty]];   // 0.42 cell, ends in the next square
    else pts = [[bb.l + 5, ty], [ (bb.l + bb.r) / 2, ty], [bb.r - 5, ty]];
    const type = pick(['touch', 'touch', 'mouse']);
    await swipe(pts, type);
    await page.waitForTimeout(40);
    const after = await page.evaluate(() => { const s = SGDebug.state(); return { ply: s.ply, sel: (document.querySelector('.ov.sel') || { closest: () => null }).closest('.cell')?.dataset.i ?? null, insp: !!document.querySelector('.ov.sel.foe') }; });
    R.swipes++; R.swipeKinds[kind + '/' + type] = (R.swipeKinds[kind + '/' + type] || 0) + 1;
    if (after.ply !== before.ply) { R.accidentalMoves++; R.drops.push({ kind: 'SWIPE MOVED', swipe: kind, type }); await page.waitForTimeout(900); }
    else if (after.sel !== before.sel || after.insp !== before.insp) { R.accidentalChanges++; R.drops.push({ kind: 'swipe changed selection', swipe: kind, type, before, after }); }
  }
  R.maxDriftCells = +maxDrift.toFixed(2);
  R.appStats = await page.evaluate(() => SGDebug.stats());
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  assert.equal(R.dropped, 0, 'dropped taps');
  assert.equal(R.accidentalMoves, 0, 'swipes made moves');
  assert.equal(R.accidentalChanges, 0, 'swipes changed selection');
  console.log(`STRESS PASSED: ${R.taps} taps (max drift ${R.maxDriftCells} cell), 0 dropped; ${R.swipes} swipes, 0 moves, 0 changes`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
