// Red hull contrast in the play view: per Red ship, median relative luminance of its hull pixels (masked against the
// same square rendered empty, excluding the accent rim hue) vs the square's empty background. WCAG ratio; target >= 3:1.
// Usage: node test/m3/contrast.js [base]   (PNG decoded in the page)
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
const BASE = process.argv[2] || process.env.SG_BASE || 'http://127.0.0.1:8773/';
const lum = (r, g, b) => { const f = c => (c /= 255) <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
(async () => { const b = await require('../../tools/guard').launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, { timeoutMs: 600000 });
  try { const out = {};
    for (const tier of ['low', 'high']) {
      const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, serviceWorkers: 'block' }); await ctx.addInitScript(() => localStorage.setItem('sg_seen_rules', '1'));
      const p = await ctx.newPage(); await p.emulateMedia({ reducedMotion: 'reduce' }); /* static rain: identical in both shots, so it is not mistaken for hull */ await p.goto(BASE + '?view=3d&nosw&debug&aidelay=60000&tier=' + tier); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 180000 }); await p.waitForTimeout(1500);
      const shot = async () => { await p.evaluate(() => SGView.renderNow()); const b64 = (await p.screenshot({ timeout: 180000 })).toString('base64'); return p.evaluate(async b64 => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return { width: im.width, data: Array.from(g.getImageData(0, 0, im.width, im.height).data) }; }, b64); };
      const ids = await p.evaluate(() => { const s = SG.newGame(); return [0, 1, 2, 3, 4, 5, 7, 9].filter(i => s.board[i] && s.board[i].s === 1).map(i => [i, s.board[i].t]); });
      await p.evaluate(() => { SGDebug.setState(SG.newGame()); SGGame.render(); }); await p.waitForTimeout(800); const full = await shot();
      await p.evaluate(() => { const s = SG.newGame(); for (let i = 0; i < 36; i++) if (s.board[i] && s.board[i].s === 1) s.board[i] = null; SGDebug.setState(s); SGGame.render(); }); await p.waitForTimeout(800); const empty = await shot();
      const res = {};
      for (const [i, t] of ids) { const c = await p.evaluate(i => SGView.cellSize(i), i); const hull = [], bg = [];
        for (let y = Math.round(c.y - c.h * .42); y < c.y + c.h * .42; y++) for (let x = Math.round(c.x - c.w * .42); x < c.x + c.w * .42; x++) { const k = (y * full.width + x) * 4;
          const L1 = lum(full.data[k], full.data[k + 1], full.data[k + 2]), L0 = lum(empty.data[k], empty.data[k + 1], empty.data[k + 2]); bg.push(L0);
          const r = full.data[k], g = full.data[k + 1], bl = full.data[k + 2], rim = r > 200 && g > 120 && g < 200 && bl < 120;   // amber accent rim
          if (Math.abs(L1 - L0) > .01 && !rim) hull.push(L1); }
        hull.sort((a, b) => a - b); bg.sort((a, b) => a - b); const Lh = hull[hull.length >> 1] || 0, Lb = bg[bg.length >> 1] || 0;
        res[t + i] = { ratio: +((Math.max(Lh, Lb) + .05) / (Math.min(Lh, Lb) + .05)).toFixed(2), px: hull.length }; }
      out[tier] = res; await ctx.close(); }
    console.log(JSON.stringify(out));
    const bad = Object.values(out).flatMap(r => Object.entries(r)).filter(([, v]) => v.ratio < 3); console.log(bad.length ? 'FAIL < 3:1 ' + JSON.stringify(bad) : 'PASS all Red hulls >= 3:1');
  } finally { await b.close(); } })();
