/* Starfall Gambit M3 boot: settings dialog, 3D view loader (2D board is the first screen and the fallback), service worker. */
(function () {
  'use strict';
  var get = function (k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  var set = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
  var DEF = { sg_view: 'auto', sg_quality: 'auto', sg_battle: 'full' };
  var modal = document.getElementById('settingsModal');
  function paint() { modal.querySelectorAll('.seg').forEach(function (g) { var v = get(g.dataset.key, DEF[g.dataset.key]);
    g.querySelectorAll('button').forEach(function (b) { b.type = 'button'; b.setAttribute('aria-pressed', b.dataset.v === v); }); }); }
  modal.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { var k = b.parentNode.dataset.key, old = get(k, DEF[k]); set(k, b.dataset.v); paint();
    if (k === 'sg_quality' && window.SGView && b.dataset.v !== 'auto') SGView.setTier(b.dataset.v);
    if (k === 'sg_view' && old !== b.dataset.v) location.reload(); }; });
  document.getElementById('btnSettings').onclick = function () { paint(); modal.classList.remove('hidden'); };
  // 3D: WebGL2 + not forced to 2D (?view=2d or the setting). Loads after the 2D board is already playable.
  var q = location.search, m = q.match(/view=(2d|3d)/), pref = (m && m[1]) || get('sg_view', 'auto');
  window.SG3D = { state: 'off' };
  if (pref !== '2d') {
    var ok = false; try { ok = !!document.createElement('canvas').getContext('webgl2'); } catch (e) {}
    if (ok) { window.SG3D.state = 'loading';
      import('./dist/view3d.js').then(function (mod) { return mod.start({ base: new URL('assets/', location.href).href }); })
        .then(function () { window.SG3D.state = 'on'; }, function (e) { window.SG3D.state = 'failed'; window.SG3D.error = String(e); console.warn('3D unavailable, using 2D:', e); });
    } else window.SG3D.state = 'no-webgl2';
  }
  if ('serviceWorker' in navigator && !/nosw/.test(q) && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});
  // cache-first SW: after a deploy the first load still ran the OLD cached scripts (stale fixes, missing debug logging). When a new
  // worker takes over a page that an old one was serving, reload once - only in the first 15 s, so it never interrupts a game.
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller && !/nosw/.test(q)) { var swT0 = Date.now(), swDone = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (swDone || Date.now() - swT0 > 15000) return; swDone = true; location.reload(); }); }
})();
