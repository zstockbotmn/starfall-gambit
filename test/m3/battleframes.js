const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
(async () => { const b = await require('/workspace/starfall-gambit-m3-next/tools/guard').launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] }, { timeoutMs: 500000 });
 try { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' }); await ctx.addInitScript(() => localStorage.setItem('sg_seen_rules', '1'));
  const p = await ctx.newPage(); await p.goto('http://127.0.0.1:8773/?view=3d&nosw&debug&tier=medium&aidelay=60000', { timeout: 120000 }); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 180000 }); await p.waitForTimeout(1500);
  await p.evaluate(() => { const s = SG.newGame(); s.board[24] = null; s.board[18] = { t: 'D', s: 1 }; SGDebug.setState(s); SGGame.render(); window.SG3D_TS = 25; });
  const tap = async i => { const c = await p.evaluate(i => SGDebug.cellCenter(i), i); await p.touchscreen.tap(c.x, c.y); };
  await tap(30); await p.waitForTimeout(400); await tap(18);
  const out = []; for (const [n, u] of [[1, .12], [2, .3], [3, .45], [4, .62], [5, .9]]) { await p.waitForFunction(u => { const s = SGView.stats(); return !s.battling || s.battleU >= u; }, u, { timeout: 120000, polling: 30 });
    const s = await p.evaluate(() => SGView.stats()); if (!s.battling) break; const f = `/workspace/starfall-gambit-m3-next/screenshots/m3/battle-full/full-capture-${n}-u${String(u).slice(2)}.png`; await p.screenshot({ path: f, timeout: 120000 }); out.push(f + ' (u=' + s.battleU + ')'); }
  console.log(out.join('\n'));
 } finally { await b.close(); } })();
