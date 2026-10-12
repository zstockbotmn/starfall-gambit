// Bakes src/models.js + the sky into assets/ (GLB per ship/LOD, meshopt-compressed by gltfpack). Needs a server on :8771 at the repo root.
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core'); const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), A = path.join(ROOT, 'assets');
(async () => { const b = await require(require('path').join(__dirname, 'guard.js')).launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); p.on('pageerror', e => console.error('pageerror', e)); p.on('console', m => m.type() === 'error' && console.error(m.text()));
  await p.goto((process.env.SG_BASE || 'http://127.0.0.1:8771/') + 'tools/bake.html'); await p.waitForFunction(() => window.__ready);
  const { files, stats } = await p.evaluate(() => window.bake()); await b.close();
  fs.mkdirSync(path.join(A, 'models'), { recursive: true }); fs.mkdirSync('/tmp/sgraw', { recursive: true });
  for (const [f, d] of Object.entries(files)) { const buf = Buffer.from(d, 'base64');
    if (f.endsWith('.glb')) { const raw = '/tmp/sgraw/' + path.basename(f); fs.writeFileSync(raw, buf);
      execFileSync(path.join(ROOT, 'node_modules/.bin/gltfpack'), ['-i', raw, '-o', path.join(A, f), '-cc', '-km', '-kn', '-kv', '-vp', '14', '-noq'].filter(x => x !== '-noq'), { stdio: 'pipe' });
      stats[path.basename(f, '.glb')].raw = buf.length; stats[path.basename(f, '.glb')].packed = fs.statSync(path.join(A, f)).size; }
    else fs.writeFileSync(path.join(A, f), buf); }
  fs.writeFileSync(path.join(A, 'bake-stats.json'), JSON.stringify(stats, null, 1)); console.log(stats);
})();
