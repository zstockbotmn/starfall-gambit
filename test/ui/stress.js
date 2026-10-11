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
  async function tapCell(i, type) {
    const [x, y, w] = await geo(i);
    const j = Math.min(w * 0.42, 24);                         // drift up to ~24px, staying inside the square
    const sx = x + rnd(-j, j) * 0.5, sy = y + rnd(-j, j) * 0.5, ex = x + rnd(-j, j), ey = y + rnd(-j, j);
    const hold = pick([0, 15, 40, 90, 180, 350]);
    if (type === 'touch') {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
      if (hold) await page.waitForTimeout(hold / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: ex, y: ey }] });
      if (hold) await page.waitForTimeout(hold / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else if (type === 'mouse') {
      await page.mouse.move(sx, sy); await page.mouse.down(); if (hold) await page.waitForTimeout(hold);
      await page.mouse.move(ex, ey); await page.mouse.up();
    } else {                                                  // click only (keyboard / VoiceOver style)
      await page.$eval(`.cell[data-i="${i}"]`, e => e.click());
    }
    R.taps++; R.byType[type] = (R.byType[type] || 0) + 1;
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
          const own = await page.evaluate(() => SGDebug.state().board.map((p, i) => p && p.s === 0 && !SG.isNebula(SGDebug.state(), i) ? i : -1).filter(i => i >= 0));
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
  R.appStats = await page.evaluate(() => SGDebug.stats());
  R.errs = errs;
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
  assert.equal(R.dropped, 0, 'dropped taps');
  console.log(`STRESS PASSED: ${R.taps} taps, 0 dropped`);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
