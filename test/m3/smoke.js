const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW || 390), height: +(process.env.VH || 844) }, deviceScaleFactor: 2 }); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('console', m => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
  await p.goto('http://127.0.0.1:8771/?view=3d&nosw&x=?debug'); await p.evaluate(() => { localStorage.setItem('sg_seen_rules', '1'); document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden')); });
  await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 120000 }).catch(() => errs.push('timeout'));
  await p.waitForTimeout(1500); console.log(await p.evaluate(() => ({ s: SG3D, st: window.SGView && SGView.stats() })));
  await p.screenshot({ path: '/tmp/smoke.png' }); console.log(errs.join('\n')); await b.close(); })();
