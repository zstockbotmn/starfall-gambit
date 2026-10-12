// Capture with/without-marker board images for contrast analysis -> ct/<pass>-<marker>-{A,B}.png + ct/meta.json
const { chromium, devices } = require('playwright-core'); const fs = require('fs');
const OUT = '/workspace/sg-tools/ct21'; fs.mkdirSync(OUT, { recursive: true });
const MK = { move: '<i class="mk move"></i>', foering: '<i class="mk move foe"></i>', lane: '<i class="mk lane"></i>', cap: '<i class="mk cap"></i>', threat: '<i class="ov threat"></i>',
  bang: '<i class="mk expose">!</i>', last: '<i class="ov last"></i>', sel: '<i class="ov sel"></i>', selfoe: '<i class="ov sel foe"></i>', forecast: '<i class="ov forecast"></i>' };
const PASSES = {
  empty: { ships: null, under: '', mk: ['move', 'foering', 'lane', 'threat', 'bang', 'last', 'forecast'] },
  hatched: { ships: null, under: MK.threat, mk: ['move', 'lane', 'bang'] },
  blueShips: { ships: 0, under: '', mk: ['cap', 'threat', 'last', 'sel', 'forecast', 'dangerRing', 'SHIP'] },
  redShips: { ships: 1, under: '', mk: ['cap', 'threat', 'bang', 'last', 'selfoe', 'forecast', 'SHIP'] },
  redShipsHatched: { ships: 1, under: MK.threat, mk: ['cap', 'bang', 'SHIP'] },
  blueShipsHatched: { ships: 0, under: MK.threat, mk: ['SHIP', 'sel'] },
  nebulaEmpty: { ships: null, neb: true, under: '', mk: ['last'] },
  nebulaRed: { ships: 1, neb: true, under: '', mk: ['selfoe', 'last', 'SHIP'] },
  nebulaBlue: { ships: 0, neb: true, under: '', mk: ['last', 'SHIP'] },
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); await page.goto('http://127.0.0.1:8766/?debug', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.setItem('sg_seen_rules', '1'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    const s = document.createElement('style'); s.textContent = '*,*::before,*::after{animation:none!important;transition:none!important} .taplogbox{display:none!important}'; document.head.appendChild(s); });
  const meta = {};
  for (const [pn, P] of Object.entries(PASSES)) {
    const setup = async (withShips) => page.evaluate(([P, withShips]) => { const s = SG.newGame(3); s.board = new Array(36).fill(null); const T = 'FDLS';
      if (P.ships !== null && withShips) for (let i = 0; i < 36; i++) { if (P.neb || true) s.board[i] = { t: T[(i + Math.floor(i / 6)) % 4], s: P.ships }; }
      // keep a Flagship for each side somewhere so the game is valid (only matters for engine helpers)
      s.nebula = P.neb ? [...Array(36).keys()] : []; s.nextNebula = []; s.nextPulse = 99; s.ply = 10; s.lastMove = null; SGDebug.setState(s);
      document.getElementById('lastMove').textContent = ''; document.querySelectorAll('#board [data-inj]').forEach(e => e.remove()); document.querySelectorAll('#board .pc.dinj').forEach(e => e.classList.remove('danger','dinj')); }, [P, withShips]);
    for (const m of P.mk) {
      const shots = {};
      for (const side of ['A', 'B']) {
        const withShips = m === 'SHIP' ? side === 'A' : true;
        await setup(withShips);
        await page.evaluate(([P, m, side, MK]) => { document.querySelectorAll('#board .cell').forEach(c => {
            if (P.under) c.insertAdjacentHTML('afterbegin', P.under.replace('<i ', '<i data-inj=1 '));
            if (side === 'A' && m !== 'SHIP') { if (m === 'dangerRing') { const pc = c.querySelector('.pc.F'); if (pc) pc.classList.add('danger','dinj'); } else c.insertAdjacentHTML('beforeend', MK[m].replace('<i ', '<i data-inj=1 ')); } }); }, [P, m, side, MK]);
        const cnt = await page.evaluate(() => document.querySelectorAll("#board .mk, #board .ov, #board .pc.danger").length); if (side === "A" && pn === "empty") console.log(pn, m, cnt);
        await page.waitForTimeout(60);
        await page.locator('#board').screenshot({ path: `${OUT}/${pn}-${m}-${side}.png` });
      }
    }
    meta[pn] = P;
  }
  const geo = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(); return [...document.querySelectorAll('#board .cell')].map(c => { const r = c.getBoundingClientRect(); return [r.left - b.left, r.top - b.top, r.width, r.height]; }); });
  fs.writeFileSync(OUT + '/meta.json', JSON.stringify({ passes: meta, geo, dpr: 2 }));
  await browser.close(); console.log('ok');
})().catch(e => { console.error(e); process.exit(1); });
