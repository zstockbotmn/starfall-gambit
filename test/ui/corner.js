const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); let bad = 0;
for (const [w,h] of [[390,844],[375,548],[320,460],[320,568]]) { const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
 await p.addInitScript(() => localStorage.setItem('sg_seen_rules','1'));
 await p.goto('http://127.0.0.1:8766/?debug'); await p.waitForTimeout(400);
 const r = await p.evaluate(() => { const c = document.querySelectorAll('.cell'), a = c[0].getBoundingClientRect(), z = c[35].getBoundingClientRect(), W=document.getElementById('boardWrap');
  const out = []; for (const off of [0.5, 3, 6, 7.9]) for (const [x,y] of [[a.left-off,a.top-off],[z.right+off,a.top-off],[a.left-off,z.bottom+off],[z.right+off,z.bottom+off]]) { const e = document.elementFromPoint(x,y); out.push(e && (e === W || W.contains(e)) ? 1 : 0); } return out; });
 const miss = r.filter(v => !v).length; bad += miss; console.log(w, h, 'corner points on board:', r.length - miss, '/', r.length); await p.close(); }
await b.close(); process.exit(bad ? 1 : 0); })();
