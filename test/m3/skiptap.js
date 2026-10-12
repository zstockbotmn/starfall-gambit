// Deterministic skip-tap test: the battle clock is slowed (SG3D_TS = 40: a 1.3 s battle lasts ~52 s) so the run can wait until the
// battle is past its mid-point (SGView.stats().battleU >= 0.5), then one touch tap on an empty square must end the battle (skipped)
// and do nothing else: no move, selection unchanged, last log line "battle skipped".
// Usage: node test/m3/skiptap.js [base]
const { chromium } = require('/workspace/sg-tools/node_modules/playwright-core'); const assert = require('assert');
const BASE = process.argv[2] || process.env.SG_BASE || 'http://127.0.0.1:8773/';
(async () => { const b = await require('../../tools/guard').launch(chromium, { executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }, { timeoutMs: 600000 });
  let ok = false;
  try { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' }); await ctx.addInitScript(() => localStorage.setItem('sg_seen_rules', '1'));
    const p = await ctx.newPage(); await p.goto(BASE + '?view=3d&nosw&debug&tier=low&aidelay=60000', { timeout: 180000 }); await p.waitForFunction(() => window.SG3D && SG3D.state !== 'loading', null, { timeout: 180000 });
    await p.evaluate(() => { const s = SG.newGame(); s.board[24] = null; s.board[18] = { t: 'D', s: 1 }; SGDebug.setState(s); SGGame.render(); window.SG3D_TS = 40; });
    const tap = async i => { const c = await p.evaluate(i => SGDebug.cellCenter(i), i); await p.touchscreen.tap(c.x, c.y); };
    await tap(30); await p.waitForFunction(() => SGDebug.state().sel === 30 || true, null, { timeout: 30000 }); await p.waitForTimeout(300); await tap(18);   // capture -> battle
    await p.waitForFunction(() => SGView.stats().battling && SGView.stats().battleU >= 0.5, null, { timeout: 180000, polling: 50 });
    const before = await p.evaluate(() => ({ ply: SGDebug.state().ply, sel: SGDebug.state().sel, u: SGView.stats().battleU }));
    await tap(14); await p.waitForTimeout(180); await tap(31); await p.waitForTimeout(180); await tap(31);   // tester's case: 3 quick taps, 2-3 on an own ship must not select/deselect
    await p.waitForFunction(() => !SGView.stats().battling, null, { timeout: 30000 }); await p.waitForTimeout(700);
    const after = await p.evaluate(() => ({ ply: SGDebug.state().ply, sel: SGDebug.state().sel, last: SGView.stats().lastBattle, log: (document.getElementById('tapLog') || {}).textContent || '' }));
    console.log(JSON.stringify({ before, after: { ...after, log: after.log.split('\n').slice(0, 3) } }));
    assert(before.u >= 0.5 && before.u < 1, 'paused past mid-point'); assert(after.last && after.last.skipped, 'battle was skipped');
    assert.equal(after.ply, before.ply, 'skip tap made no move'); assert.equal(after.sel, before.sel, 'skip tap did not change selection');
    assert(/battle skipped|right after a battle skip/.test(after.log.split('\n')[0]) && /battle skipped/.test(after.log), 'skip logged, follow-up taps swallowed'); ok = true;
  } catch (e) { console.error('FAIL', e.message); } finally { await b.close(); }
  console.log(ok ? 'SKIPTAP PASSED' : 'SKIPTAP FAILED'); process.exit(ok ? 0 : 1); })();
