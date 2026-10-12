// M2 showcase screenshots, contact sheet, marker sheet + contrast samples, reduced-motion check.
const { chromium, devices } = require('playwright-core');
const assert = require('assert');
const fs = require('fs');
const BASE = process.argv[2] || 'http://127.0.0.1:8766/';
const out = '/workspace/starfall-gambit-m2/screenshots/m2';
fs.mkdirSync(out, { recursive: true });
const sq = s => (6 - +s[1]) * 6 + 'abcdef'.indexOf(s[0]);
const C = s => `.cell[data-i="${sq(s)}"]`;
const setPos = (page, pos, extra) => page.evaluate(([pos, extra]) => { const s = SG.newGame(21); s.board = new Array(36).fill(null);
  for (const [k, v] of Object.entries(pos)) s.board[(6 - +k[1]) * 6 + 'abcdef'.indexOf(k[0])] = { t: v[0], s: +v[1] };
  Object.assign(s, extra || {}); SGDebug.setState(s); }, [pos, extra]);
async function open(browser, w, h, opts) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: w, height: h }, ...(opts || {}) });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '?debug', { waitUntil: 'networkidle' });
  await page.tap('#rulesModal [data-close]');
  return { ctx, page, errs };
}
const FLEET = { a1: 'L0', b1: 'D0', c1: 'S0', d1: 'F0', e1: 'D0', f1: 'L0', d2: 'S0', a6: 'L1', b6: 'D1', c6: 'S1', d6: 'F1', e6: 'D1', f6: 'L1', d5: 'S1' };
(async () => {
  const browser = await require(require('path').join(__dirname, '../../tools/guard.js')).launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const R = {};
  for (const [w, h] of [[390, 844], [375, 548], [320, 460], [320, 568]]) {
    const tag = `${w}x${h}`, { ctx, page, errs } = await open(browser, w, h);
    const shot = name => page.screenshot({ path: `${out}/${tag}-${name}.png` });
    await page.evaluate(() => SGDebug.setState(SG.newGame(7))); await page.waitForTimeout(150); await shot('start-board');
    // all 8 ship designs on the board (Blue F D L S on row 3, Red on row 4)
    await setPos(page, { a3: 'F0', b3: 'D0', c3: 'L0', d3: 'S0', c1: 'F0', f6: 'F1', a4: 'F1', b4: 'D1', c4: 'L1', d4: 'S1' });
    await page.waitForTimeout(100); await page.locator('#boardWrap').screenshot({ path: `${out}/${tag}-ships-both-sides.png` });
    // Lancer selected: lanes, capture bracket, danger hatching, '!' badges
    await setPos(page, { d1: 'F0', d2: 'L0', a1: 'S0', f1: 'D0', d4: 'L1', b4: 'D1', f6: 'F1' });
    await page.tap(C('d2')); await page.waitForTimeout(100);
    R[tag + ' lancer'] = await page.evaluate(() => ({ lanes: document.querySelectorAll('.mk.lane').length, caps: document.querySelectorAll('.mk.cap').length, danger: document.querySelectorAll('.ov.threat').length, bang: document.querySelectorAll('.mk.expose').length }));
    const L = R[tag + ' lancer']; assert.ok(L.lanes && L.caps && L.danger && L.bang, tag + ' lancer markers ' + JSON.stringify(L));
    await shot('lancer-lanes-danger-expose');
    // Nebula (current + flickering forecast, a jammed ship)
    await page.evaluate(() => { const s = SG.newGame(7); s.nebula = [8, 15, 20, 27]; s.nextNebula = [13, 10, 25, 22]; s.ply = 4; s.nextPulse = 6;
      s.board[15] = s.board[31]; s.board[31] = null; SGDebug.setState(s); });
    await page.waitForTimeout(400); await shot('nebula');
    // Enemy inspect: Red Lancer mid-board (lanes, capture brackets on Blue ships) / Red Drone (ring = enemy move)
    await setPos(page, { d1: 'F0', c2: 'D0', a3: 'S0', f3: 'L0', c3: 'L1', e5: 'D1', f6: 'F1' });
    await page.tap(C('c3')); await page.waitForTimeout(100); await shot('enemy-inspect-lancer');
    await page.tap(C('e5')); await page.waitForTimeout(100);
    R[tag + ' inspect'] = await page.evaluate(() => document.querySelectorAll('.mk.move.foe').length); await shot('enemy-inspect-drone');
    // Flagship under attack (dashed ring + warning)
    await setPos(page, { d1: 'F0', d2: 'S0', a1: 'L0', f6: 'F1', c3: 'D1' }); await page.waitForTimeout(100); await shot('flagship-under-attack');
    // Game over: Blue Drone e4 takes the Red Flagship on f6
    await setPos(page, { d1: 'F0', e4: 'D0', f6: 'F1', a6: 'L1' });
    await page.tap(C('e4')); await page.tap(C('f6')); await page.waitForSelector('#overModal:not(.hidden)'); await page.waitForTimeout(150); await shot('game-over');
    await page.tap('#overModal [data-close]');
    // Rules / legend
    await page.tap('#btnRules'); await page.waitForTimeout(100); await shot('rules-markers');
    await page.evaluate(() => { const h = [...document.querySelectorAll('#rulesModal h3')].find(x => /fleets/.test(x.textContent)); h.scrollIntoView(); });
    await page.waitForTimeout(100); await shot('rules-fleets'); await page.tap('#rulesModal [data-close]');
    R[tag + ' errs'] = errs; assert.equal(errs.length, 0);
    await ctx.close();
  }
  // Reduced motion: animations off
  for (const [w, h] of [[390, 844], [320, 460]]) {
    const { ctx, page } = await open(browser, w, h, { reducedMotion: 'reduce' });
    await page.evaluate(() => { const s = SG.newGame(7); s.nebula = [8, 15, 20, 27]; s.nextNebula = [13, 10, 25, 22]; s.ply = 4; s.nextPulse = 6; SGDebug.setState(s); });
    await page.waitForTimeout(200);
    const rm = await page.evaluate(() => { const cs = (el, p) => el ? getComputedStyle(el, p).animationName : 'missing';
      return { redShip: cs(document.querySelector('.pc.r .shp')), nebula: cs(document.querySelector('.cell.nebula')), forecast: cs(document.querySelector('.ov.forecast')),
        sweep: getComputedStyle(document.getElementById('board'), '::before').display, nebInfo: cs(document.getElementById('nebulaInfo')) }; });
    R[`${w}x${h} reduced-motion`] = rm;
    assert.equal(rm.redShip, 'none'); assert.equal(rm.nebula, 'none'); assert.equal(rm.forecast, 'none'); assert.equal(rm.sweep, 'none'); assert.equal(rm.nebInfo, 'none');
    await page.screenshot({ path: `${out}/${w}x${h}-reduced-motion.png` });
    await ctx.close();
  }
  { // normal motion: animations on (sanity)
    const { ctx, page } = await open(browser, 640, 1500);   // tall so the whole sheet is on screen for pixel sampling
    R['motion on'] = await page.evaluate(() => getComputedStyle(document.querySelector('.pc.r .shp')).animationName); assert.equal(R['motion on'], 'glitch');
    // Contact sheet: 8 ships at 38px and 57px on both halves; marker sheet on the 4 square types + nebula
    const boxes = await page.evaluate(() => {
      const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const sheet = document.createElement('div'); sheet.id = 'sheet';
      sheet.style.cssText = 'position:fixed;inset:0;z-index:100;background:#060914;padding:10px;font:12px -apple-system,sans-serif;color:#cfd8ff;overflow:auto';
      const sq = { 'Blue half': css('--sqb'), 'Blue half alt': css('--sqb2'), 'Red half': css('--sqr'), 'Red half alt': css('--sqr2') };
      const tile = (size, bg, inner, red) => `<div class="cell" style="--cell:${size}px;width:${size}px;height:${size}px;background:${bg}${red ? ' repeating-linear-gradient(0deg,rgba(255,43,214,.08) 0 1px,transparent 1px 4px)' : ''};box-shadow:inset 0 0 0 .5px ${red ? 'rgba(255,43,214,.26)' : 'rgba(127,243,230,.22)'};display:inline-flex;margin:2px">${inner}</div>`;
      const ship = (s, t) => `<span class="pc ${s} ${t}"><svg class="shp"><use href="#s${s}-${t}"/></svg></span>`;
      const names = { F: 'Flagship', D: 'Drone', L: 'Lancer', S: 'Shield' };
      let h = '<div id="contact" style="display:inline-block;padding:8px;background:#060914"><b style="font-size:14px">Starfall Gambit M2 — ship designs at 38px and 57px cells (own half / enemy half)</b><table style="border-collapse:collapse;margin-top:6px">';
      h += '<tr><td></td><td>38px</td><td>57px</td><td>38px</td><td>57px</td></tr>';
      for (const t of 'FDLS') {
        h += `<tr><td style="padding-right:8px"><b>${names[t]}</b></td>`;
        for (const s of ['b', 'r']) h += `<td style="padding:0 6px">${tile(38, s === 'b' ? sq['Blue half'] : sq['Red half'], ship(s, t), s === 'r')}${tile(38, s === 'b' ? sq['Red half alt'] : sq['Blue half alt'], ship(s, t), s !== 'r')}</td><td style="padding:0 6px">${tile(57, s === 'b' ? sq['Blue half'] : sq['Red half'], ship(s, t), s === 'r')}${tile(57, s === 'b' ? sq['Red half alt'] : sq['Blue half alt'], ship(s, t), s !== 'r')}</td>`;
        h += '</tr>';
      }
      h += '<tr><td></td><td colspan="2" style="text-align:center;color:#7ff3e6">Blue (utopian)</td><td colspan="2" style="text-align:center;color:#ff2bd6">Red (cyberpunk)</td></tr></table></div>';
      // marker sheet
      const mk = { move: '<i class="mk move"></i>', 'enemy move': '<i class="mk move foe"></i>', lane: '<i class="mk lane"></i>', capture: '<i class="mk cap"></i>', danger: '<i class="ov threat"></i>', '!': '<i class="mk expose">!</i>' };
      h += '<div id="markers" style="display:inline-block;padding:8px;background:#060914;margin-top:8px"><b style="font-size:14px">Markers on each square type (44px)</b><table style="margin-top:6px">';
      const bgs = Object.assign({}, sq, { Nebula: 'nebula' });
      h += '<tr><td></td>' + Object.keys(mk).map(k => `<td style="text-align:center">${k}</td>`).join('') + '<td>capture on ships</td></tr>';
      for (const [n, bg] of Object.entries(bgs)) {
        h += `<tr><td style="padding-right:6px">${n}</td>` + Object.entries(mk).map(([k, v]) => `<td data-bg="${n}" data-mk="${k}">${bg === 'nebula' ? `<div id="nb" class="cell nebula" style="--cell:44px;width:44px;height:44px;display:inline-flex;margin:2px">${v}</div>` : tile(44, bg, v, /Red/.test(n))}</td>`).join('') +
          `<td>${bg === 'nebula' ? '' : tile(44, bg, ship('r', 'F') + '<i class="mk cap"></i>', /Red/.test(n)) + tile(44, bg, ship('b', 'S') + '<i class="mk cap"></i>', /Red/.test(n))}</td></tr>`;
      }
      h += '</table></div>';
      sheet.innerHTML = h; document.body.appendChild(sheet);
      // sample points for contrast: square background (corner) per type
      const res = {};
      document.querySelectorAll('#markers td[data-mk="move"] .cell').forEach(c => { const r = c.getBoundingClientRect(); res[c.closest('td').dataset.bg] = { x: r.left + 4, y: r.top + 4 }; });
      return res;
    });
    await page.waitForTimeout(200);
    await page.locator('#contact').screenshot({ path: `${out}/contact-sheet-ships.png` });
    await page.locator('#markers').screenshot({ path: `${out}/marker-sheet.png` });
    await page.screenshot({ path: '/tmp/sheet-full.png' });
    fs.writeFileSync('/tmp/sheet-bg.json', JSON.stringify(boxes));
    await ctx.close();
  }
  console.log(JSON.stringify(R, null, 1));
  console.log('M2 SHOTS PASSED');
  await browser.close();
})().catch(e => { console.error('FAIL', e.stack); process.exit(1); });
