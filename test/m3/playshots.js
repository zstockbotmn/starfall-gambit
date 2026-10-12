// Play-view screenshots at 390x844 (high + low tier) and one battle frame; also logs any HTTP 4xx/5xx the page requests.
// Usage: node test/m3/playshots.js [base]  -> screenshots/m3/play-view/
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core'); const fs = require('fs'), path = require('path');
const BASE = process.argv[2] || (process.env.SG_BASE || 'http://127.0.0.1:8771/') + '', OUT = path.resolve(__dirname, '../../screenshots/m3/play-view'); fs.mkdirSync(OUT, { recursive: true });
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']; const bad = [];
(async () => { const b = await require(require('path').join(__dirname, '../../tools/guard.js')).launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ARGS });
  const open = async q => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    await ctx.addInitScript(() => localStorage.setItem('sg_seen_rules', '1')); const p = await ctx.newPage();
    p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
    await p.goto(BASE + '?view=3d&nosw&nostep' + q + '&x=?debug'); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 120000 }); await p.waitForTimeout(2500); return p; };
  for (const t of ['high', 'low']) { const p = await open('&tier=' + t); const s = await p.evaluate(() => SGView.stats()); await p.screenshot({ path: `${OUT}/play-390x844-${t}.png`, timeout: 180000 }); console.log(t, JSON.stringify({ tier: s.tier, calls: s.calls, tris: s.tris })); await p.context().close(); }
  { const p = await open('&tier=high'); await p.evaluate(`SGDebug.setState((() => { const s = SG.newGame(); s.board[24] = null; s.board[18] = { t: 'D', s: 1 }; return s; })()); SGGame.render();`);
    const tap = async i => { const c = await p.evaluate(i => SGDebug.cellCenter(i), i); await p.mouse.click(c.x, c.y); };
    await p.evaluate(() => { window.SG3D_TS = 12; }); await tap(30); await p.waitForTimeout(150); await tap(18); await p.waitForTimeout(4200); await p.screenshot({ path: `${OUT}/battle-390x844-high.png`, timeout: 180000 }); await p.context().close(); }
  await b.close(); console.log('HTTP errors:', JSON.stringify([...new Set(bad)]));
})();
