/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = (function () { try { var l = localStorage.getItem('sg_level'); return /^(easy|medium|hard)$/.test(l) ? l : 'medium'; } catch (e) { return 'medium'; } })(), AI_DELAY = 650, OVER_DELAY = 250, LONG_PRESS = 500, LONG_PRESS_CAP = 900;   // hold-to-inspect; longer on a Red ship you could capture
  var GHOST_MS = 600;            // a pointer-generated click within this time of a pointer tap on the same square is its echo
  var DEBUG = /[?&]debug(=|&|$)/.test(location.search);
  // test harness only: ?aidelay=ms stretches Red's think time so scripted taps fit inside it on a slow software renderer
  (function (m) { if (m) AI_DELAY = Math.min(5000, +m[1]); })(location.search.match(/[?&]aidelay=(\d+)/));
  var st, sel = null, insp = null, marks = null, danger = [], opts = [], exposed = [], shiftWarn = false;
  var busy = false, aiTimer = null, overTimer = null, gameId = 0, hintMsg = '', overShown = false;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), wrapEl = $('boardWrap'), infoEl = document.querySelector('.info'), cells = [], cache = [];
  var SHIP_HINT = {
    F: 'Flagship: 1 square any direction. Keep it safe!',
    D: 'Drone: jumps in an L, even over ships and nebula.',
    L: 'Lancer: steps 1 square, or fires along its lanes (up to 3).',
    S: 'Shield: 1 square straight. Stops Lancer shots, protecting ships behind it, but can be shot itself.'
  };
  var START_HINT = 'Tap one of your blue ships to begin.';
  var FIRST_TIP = 'Tip: Lancers fire up to 3 squares. Tap or hold a Red ship to see its range.';

  for (var i = 0; i < 36; i++) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cell'; b.dataset.i = i;
    boardEl.appendChild(b); cells.push(b); cache.push({ cls: null, html: null, label: null });
  }

  // ---- Debug log (only with ?debug): every tap that did not change anything, and why.
  var dbgEl = null, dbgLines = [], stats = { taps: 0, handled: 0, ignored: 0, reasons: {}, cancelled: 0, cancelReasons: {}, moves: 0 };
  if (DEBUG) {
    // Collapsible panel in the status row (not over the title or the warning / info area).
    var dbgBox = document.createElement('div'); dbgBox.className = 'taplogbox collapsed';   // starts collapsed; sits below dialogs
    var dbgBtn = document.createElement('button'); dbgBtn.type = 'button'; dbgBtn.className = 'taplogbtn'; dbgBtn.textContent = 'log \u25B8';
    dbgEl = document.createElement('div'); dbgEl.id = 'tapLog'; dbgEl.className = 'taplog';
    dbgBtn.onclick = function () { var c = dbgBox.classList.toggle('collapsed'); dbgBtn.textContent = c ? 'log \u25B8' : 'log \u25BE'; };
    dbgBox.appendChild(dbgBtn); dbgBox.appendChild(dbgEl);
    var stRow = document.querySelector('.status'); stRow.insertBefore(dbgBox, stRow.querySelector('.meta'));   // in the status row: never over the title
  }
  var pressAt = null;   // debug: where the press landed (CSS px, and offset from the square's centre in square widths)
  function dlog(kind, msg) {
    if (kind === 'ignored') { stats.ignored++; stats.reasons[msg] = (stats.reasons[msg] || 0) + 1; }
    if (!DEBUG) return;
    dbgLines.unshift(new Date().toISOString().slice(17, 23) + ' ' + kind + ': ' + msg + (pressAt || ''));
    dbgLines.length = Math.min(dbgLines.length, 5);
    dbgEl.textContent = dbgLines.join('\n');
  }

  // ---- Input. Pointer events are the single source of taps; a click is only used when no pointer tap
  // produced it (keyboard, VoiceOver, or a browser that cancelled the pointer stream).
  // touch-action:none on the board means the browser never turns a slightly-moving finger into a pan
  // (that used to fire pointercancel and swallow taps). Because of that, drags must be rejected here:
  // a tap counts only if the press starts and ends on the same square and never travels more than
  // DRAG_CELLS x cell size (straight-line distance from the pointerdown point).
  // Edge drift: a press that moved less than SLOP_CELLS x cell counts on its START square even if the finger
  // crossed a border; a lift up to EDGE_PX outside the board is treated as being on the nearest edge square.
  // Between SLOP_CELLS and DRAG_CELLS the press must still end on its start square; beyond DRAG_CELLS it cancels.
  var DRAG_CELLS = 0.6, SLOP_CELLS = 0.25, SLOP_MIN_PX = 12, EDGE_PX = 8;   // tap tolerance = max(12px, 0.25 cell)
  var SKIP_QUIET_MS = 250, BURST_MS = 600, quietUntil = -1e9, lastSwallow = -1e9;   // after a skip: swallow presses until the play-pose frame is drawn + SKIP_QUIET_MS
  var down = null, lpTimer = null, ghosts = [], skipPtr = null, lastTouchEnd = -1e9;
  function cellFrom(x, y) {
    if (window.SGView && SGView.pick) return SGView.pick(x, y, 0);   // 3D: raycast the projected board, never the DOM overlay
    var el = document.elementFromPoint(x, y);
    el = el && el.closest ? el.closest('.cell') : null;
    return el && boardEl.contains(el) ? +el.dataset.i : -1;
  }
  // Square under (x, y), or the nearest square if the point is at most EDGE_PX outside the grid; else -1.
  function cellNear(x, y) {
    if (window.SGView && SGView.pick) { var s0 = SGView.cellSize(0).w || 40; return SGView.pick(x, y, EDGE_PX / s0); }
    var i = cellFrom(x, y); if (i >= 0) return i;
    var a = cells[0].getBoundingClientRect(), b = cells[35].getBoundingClientRect();
    if (x < a.left - EDGE_PX || x > b.right + EDGE_PX || y < a.top - EDGE_PX || y > b.bottom + EDGE_PX) return -1;
    var cw = (b.right - a.left) / 6, ch = (b.bottom - a.top) / 6;
    var c = Math.min(5, Math.max(0, Math.floor((x - a.left) / cw))), r = Math.min(5, Math.max(0, Math.floor((y - a.top) / ch)));
    return r * 6 + c;
  }
  // Transient per-cell effect classes (press, holding, nogo, boom). They live outside render(): render rebuilds
  // className from game state only and then re-applies whatever effects are active, so nothing gets stuck.
  var fx = cells.map(function () { return {}; }), fxSeq = 0;
  function fxAdd(i, name, ms) {
    var tok = ++fxSeq; fx[i][name] = tok; cells[i].classList.add(name);
    if (ms) setTimeout(function () { if (fx[i][name] === tok) fxDel(i, name); }, ms);
  }
  function fxDel(i, name) { delete fx[i][name]; cells[i].classList.remove(name); }
  function fxClear() { for (var i = 0; i < 36; i++) for (var n in fx[i]) fxDel(i, n); }
  cells.forEach(function (c, i) {
    c.addEventListener('animationend', function (e) { if (e.animationName === 'boom') fxDel(i, 'boom'); if (e.animationName === 'nogo') fxDel(i, 'nogo'); });
  });
  function clearPress() { clearTimeout(lpTimer); lpTimer = null; if (down) { fxDel(down.i, 'press'); fxDel(down.i, 'holding'); } down = null; }
  var NO_CUE = { 'board changed during the press': 1, 'second finger': 1 };
  function cancelPress(reason, detail) {
    if (!down) return;
    var d = down; clearPress();
    if (!NO_CUE[reason]) { fxDel(d.i, 'nogo'); void cells[d.i].offsetWidth; fxAdd(d.i, 'nogo', 650); }   // brief faint ring: "that didn't count"
    stats.cancelled++; stats.cancelReasons[reason] = (stats.cancelReasons[reason] || 0) + 1;
    dlog('cancelled', reason + (detail ? ' (' + detail + ')' : '') + ' [' + d.type + ' from ' + SG.coord(d.i) + ']');
    return d;
  }
  // Pinch zoom + two-finger pan (3D only). A second finger cancels the first finger's press silently, so zooming or
  // panning never selects or moves; after the last finger lifts, presses are swallowed briefly (same quiet window as a skip).
  var pinch = null, touches = {};
  function pinchGeo() { var ids = Object.keys(touches); if (ids.length < 2) return null; var a = touches[ids[0]], b = touches[ids[1]];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  function zoomUi() { var z = window.SGView && SGView.zoom ? SGView.zoom().z : 1; $('btnZoomReset').classList.toggle('hidden', !(z > 1.001)); }
  var isHud = function (t) { return !!(t && t.closest && t.closest('button, a, input, select, .modal, header')) && !wrapEl.contains(t); };   // HUD controls never feed the board's gesture/press handling
  document.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch' || !(window.SGView && SGView.zoomTo) || isHud(e.target)) return;
    touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(touches).length === 2) { if (down) cancelPress('second finger'); pinch = pinchGeo(); quietUntil = Infinity; dlog('ok', 'pinch start'); }
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!touches[e.pointerId]) return; touches[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!pinch) return; var g = pinchGeo(); if (!g) return;
    if (Math.abs(g.d - pinch.d) > .5 || Math.hypot(g.x - pinch.x, g.y - pinch.y) > .5) { var z = SGView.zoom().z; SGView.zoomTo(z * g.d / Math.max(1, pinch.d), g.x, g.y, g.x - pinch.x, g.y - pinch.y); zoomUi(); }
    pinch.d = g.d; pinch.x = g.x; pinch.y = g.y;
  }, true);
  function liftTouch(e) { if (!touches[e.pointerId]) return; delete touches[e.pointerId];
    if (pinch && Object.keys(touches).length === 0) { pinch = null; quietUntil = performance.now() + SKIP_QUIET_MS; dlog('ok', 'pinch end (zoom ' + SGView.zoom().z.toFixed(2) + ')'); } }
  document.addEventListener('pointerup', liftTouch, true); document.addEventListener('pointercancel', liftTouch, true);
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });   // iOS: the board pinch must not zoom the page
  // Desktop: mouse wheel / trackpad pinch (ctrl+wheel) zooms the 3D board about the pointer; never selects or moves
  document.addEventListener('wheel', function (e) { if (!(window.SGView && SGView.zoomTo) || isHud(e.target) || (e.target.closest && e.target.closest('.modal, .taplogbox'))) return;
    e.preventDefault(); var z = SGView.zoom().z; SGView.zoomTo(z * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX, e.clientY); zoomUi(); }, { passive: false });
  function resetZoomNow(src) { if (!(window.SGView && SGView.resetZoom) || SGView.zoom().z <= 1.001) return; SGView.resetZoom(); zoomUi(); dlog('ok', 'zoom reset (' + src + ')'); }
  // A HUD button press runs its action on pointerup and swallows the follow-up (compatibility) click wherever it lands for
  // 600 ms, so a click can never fall through to the board (e.g. once Reset zoom has hidden itself, onto the square under it).
  var hudSwallow = { until: -1e9, el: null };
  $('btnZoomReset').addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; hudSwallow = { until: performance.now() + 600, el: this }; resetZoomNow(e.pointerType); });
  $('btnZoomReset').onclick = function (e) { if (e.detail === 0) resetZoomNow('keyboard'); };   // pointer presses already acted on pointerup
  document.addEventListener('click', function (e) { if (performance.now() < hudSwallow.until && e.detail !== 0) { hudSwallow.until = -1e9;
    if (hudSwallow.el && hudSwallow.el.contains(e.target)) return; e.stopPropagation(); e.preventDefault(); dlog('ignored', 'click after a HUD button press'); } }, true);
  // listen on the document: in 3D the board's near corners can project a few px outside #boardWrap's box
  document.addEventListener('pointerdown', function (e) {
    if (isHud(e.target)) return;   // HUD buttons (Reset zoom, header) handle their own click
    if (!wrapEl.contains(e.target) && (!(window.SGView && SGView.pick) || (e.target.closest && e.target.closest('button, a, input, select, .modal, header')))) { if (DEBUG && e.target.closest && !e.target.closest('.modal')) dlog('ignored', 'press outside board on ' + (e.target.id || e.target.className || e.target.tagName)); return; }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.pointerType !== 'touch') lastTouchEnd = -1e9;          // a real mouse/pen press after a touch: its click is genuine
    // a tap during a battle only skips it: it is swallowed (no select), along with its echo click
    if (window.SGView && SGView.battling()) { viewSkip(); skipPtr = e.pointerId; quietUntil = Infinity;
      var setQuiet = function () { quietUntil = Math.max(performance.now() + SKIP_QUIET_MS, lastSwallow + BURST_MS); };   /* a tap swallowed while the rest frame was still pending keeps its own burst window */
      if (window.SGView && SGView.afterDraw) { SGView.afterDraw(setQuiet); setTimeout(function () { if (quietUntil === Infinity) setQuiet(); }, 1500); } else setQuiet();   // the camera is back at rest in the next drawn frame
      dlog('ok', 'battle skipped'); return; }
    // presses until the rested frame + SKIP_QUIET_MS after a skip (by the event clock, so taps that queued up behind a busy frame count by when they
    // happened) are dropped: a skip never also selects or moves
    if (pinch) { if (skipPtr === null) skipPtr = e.pointerId; return; }   // part of a pinch, never a tap
    var evT = Math.abs(e.timeStamp - performance.now()) < 30000 ? e.timeStamp : performance.now();   // event clock when it is the page clock (synthetic input may carry another base)
    if (evT < quietUntil) { lastSwallow = performance.now(); if (quietUntil !== Infinity) quietUntil = Math.max(quietUntil, evT + BURST_MS);   /* a burst of taps keeps the window open: the whole burst is swallowed (up to 600 ms between taps: a busy phone stretches a 3-tap burst) */ if (skipPtr === null) skipPtr = e.pointerId; dlog('ignored', 'press right after a battle skip'); return; }
    // Rounded board corners / hairline gaps: fall back to the nearest cell.
    var t = e.target.closest('.cell'), i0 = (window.SGView && SGView.pick) ? cellNear(e.clientX, e.clientY) : t ? +t.dataset.i : cellNear(e.clientX, e.clientY);
    if (i0 < 0) { if (DEBUG) dlog('ignored', 'press off the board (' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ')'); return; }
    t = cells[i0];
    if (down) cancelPress('second finger');
    ghosts = [];                                           // a new press means any pending echo click is stale
    // In 3D the DOM square is a projected trapezoid whose bounding box is wider than the square itself; tolerances use the real width
    var size = (window.SGView && SGView.cellSize) ? SGView.cellSize(i0).w : t.getBoundingClientRect().width;
    down = { t0: e.timeStamp, id: e.pointerId, i: +t.dataset.i, x: e.clientX, y: e.clientY, long: false, type: e.pointerType, max: DRAG_CELLS * size, slop: Math.max(SLOP_MIN_PX, SLOP_CELLS * size), ply: st.ply, gid: gameId };
    try { wrapEl.setPointerCapture(e.pointerId); } catch (err) {}   // keep getting move/up even off the board
    fxAdd(i0, 'press');
    var d = down, pc0 = st.board[i0];
    if (pc0 && pc0.s === AI_SIDE) {
      // Hold to inspect a Red ship. If it's a capture target of your selection the hold is longer, so a slow
      // tap still captures; a ring fills up while you hold so the inspect never comes as a surprise.
      var capTarget = sel !== null && st.turn === HUMAN && opts.some(function (o) { return o.to === i0; });
      var hold = capTarget ? LONG_PRESS_CAP : LONG_PRESS;
      d.hold = hold; t.style.setProperty('--hold', (hold - 150) + 'ms'); fxAdd(i0, 'holding');
      var fire = function (late) {
        if (down !== d) return;
        // a timer that ran late may have a queued pointerup behind it: yield once so input is handled first, then decide
        if (!late && performance.now() - d.t0 > hold + 50) { lpTimer = setTimeout(function () { fire(true); }, 0); return; }
        if (performance.now() - d.t0 < hold) return;
        d.prevSel = sel;                                        // restored if the lift turns out to have come before the hold time
        fxDel(d.i, 'holding'); d.long = true; inspect(d.i); dlog('ok', 'long-press inspect ' + SG.coord(d.i) + ' (' + hold + 'ms)');
      };
      lpTimer = setTimeout(function () { fire(false); }, hold);
    }
  });
  wrapEl.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id || down.long) return;
    var dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist > down.max) { down.drag = true; cancelPress('drag over ' + DRAG_CELLS + ' cell', Math.round(dist) + 'px'); }
  });
  wrapEl.addEventListener('pointerup', function (e) {
    var now = Date.now();
    if (e.pointerType === 'touch') lastTouchEnd = now;
    if (skipPtr === e.pointerId) { skipPtr = null; ghosts.push({ i: -3, j: -3, t: now, any: true }); return; }
    if (!down || e.pointerId !== down.id) {                // already cancelled (drag) or unknown pointer:
      ghosts.push({ i: cellNear(e.clientX, e.clientY), j: -2, t: now });   // still swallow its echo click
      return;
    }
    var d = down;
    var i = cellNear(e.clientX, e.clientY);
    ghosts.push({ i: i, j: d.i, t: now });                 // swallow the browser's echo click either way
    var dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    // hold vs tap is decided by the event clock: a finger that lifted before the hold time is a tap even if the
    // (late) hold timer already ran on a busy main thread
    if (d.long && e.timeStamp - d.t0 >= d.hold) { clearPress(); return; }   // the long-press already acted (inspect)
    if (d.long) { d.long = false; clearSel(); if (d.prevSel !== null && d.prevSel !== undefined && st.board[d.prevSel] && st.board[d.prevSel].s === HUMAN) selectOwn(d.prevSel); dlog('ok', 'late hold timer ignored (' + Math.round(e.timeStamp - d.t0) + 'ms press)'); }
    if (dist > d.max) { cancelPress('drag over ' + DRAG_CELLS + ' cell', Math.round(dist) + 'px'); return; }
    // Red moved while the finger was down: the tap was aimed at the old position, so it does nothing.
    if (d.ply !== st.ply || d.gid !== gameId) { cancelPress('board changed during the press'); return; }
    if (dist >= d.slop) {                                  // a real slide: must end on the start square
      if (i < 0) { cancelPress('lifted off the board', Math.round(dist) + 'px'); return; }
      if (i !== d.i) { cancelPress('ended on a different square', SG.coord(i) + ', ' + Math.round(dist) + 'px'); return; }
    } else if (i !== d.i && DEBUG) {
      dlog('drift', Math.round(dist) + 'px into ' + (i < 0 ? 'off-board' : SG.coord(i)) + ', counted on ' + SG.coord(d.i));
    }
    clearPress();
    // judge timing (double-tap echo) by when the finger lifted, not when a busy main thread got round to it (3D frames can lag)
    if (DEBUG) { var cs = window.SGView && SGView.cellSize ? SGView.cellSize(d.i) : null;
      pressAt = ' @' + Math.round(d.x) + ',' + Math.round(d.y) + (cs ? ' d' + ((d.x - cs.x) / cs.w).toFixed(2) + ',' + ((d.y - cs.y) / cs.h).toFixed(2) : '') + ' up+' + Math.round(e.timeStamp - d.t0) + 'ms'; }
    inputTime = performance.timeOrigin + e.timeStamp; try { tap(d.i, d.type); } finally { inputTime = null; pressAt = null; }
    // the echo window starts once the tap's work (render, 3D sync) is done, not at pointerup
    var done = Date.now(); ghosts.forEach(function (g) { if (g.t === now) g.t = done; }); if (e.pointerType === 'touch') lastTouchEnd = done;
  });
  // stop the browser synthesising compatibility mouse events / click after a touch
  wrapEl.addEventListener('touchend', function (e) { if (e.cancelable) e.preventDefault(); }, { passive: false });
  wrapEl.addEventListener('pointercancel', function (e) {
    if (down && e.pointerId === down.id) cancelPress('pointercancel from the browser');
  });
  wrapEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  wrapEl.addEventListener('click', function (e) {
    // Only clicks aimed at a cell button (keyboard, VoiceOver, plain click). Pointer presses are handled above;
    // their echo clicks land on the board/wrap (pointer capture) or are swallowed as ghosts below.
    var t = e.target.closest('.cell'); if (!t) return;
    if (e.detail === 0) viewSkip();
    var i = +t.dataset.i, now = Date.now();
    if (e.detail !== 0 && now - lastTouchEnd < 1000) { dlog('ignored', 'compat click after touch [' + SG.coord(i) + ']'); return; }
    ghosts = ghosts.filter(function (g) { return now - g.t < GHOST_MS; });
    // detail === 0: keyboard, VoiceOver or programmatic activation, never an echo of a finger/mouse tap.
    if (e.detail !== 0) for (var k = 0; k < ghosts.length; k++) {
      if (ghosts[k].any || ghosts[k].i === i || ghosts[k].j === i) { ghosts.splice(k, 1); return; }   // echo of a pointer press: already dealt with
    }
    tap(i, 'click');
  });

  function tap(i, src) {
    stats.taps++;
    var r = onCell(i);
    if (r && r.ignored) dlog('ignored', r.ignored + ' [' + src + ' ' + SG.coord(i) + ']');
    else { stats.handled++; if (DEBUG) dlog('ok', (r && r.did || 'tap') + ' [' + src + ' ' + SG.coord(i) + ']'); }
  }

  function firstGame() { try { return !localStorage.getItem('sg_played'); } catch (e) { return false; } }

  // 3D view hooks (src/view3d.js sets window.SGView when the 3D renderer is up; 2D works without it).
  function afterView(fn) { if (window.SGView && SGView.battling()) SGView.onIdle(fn); else fn(); }
  function viewSkip() { if (window.SGView && SGView.battling()) SGView.skip(); }
  window.SGGame = { render: function () { if (st) render(); } };

  function fleetText(f) { return ['L', 'D', 'S'].filter(function (t) { return f[t]; }).map(function (t) { return f[t] + ' ' + SG.NAMES[t] + (f[t] > 1 ? 's' : ''); }).join(', '); }
  function start() {
    viewSkip(); clearTimeout(aiTimer); clearTimeout(overTimer); aiTimer = overTimer = null; movedAt = null; flashUntil = 0; fxClear();
    gameId++;
    var redFleet = SGAI.pickFleet(LEVEL);
    st = SG.newGame(null, { fleets: [FLEET, redFleet] }); clearSel(); busy = false; overShown = false;
    hide('overModal');
    $('lastMove').textContent = 'New game. You\u2019re Blue and you move first.' + (isStd(redFleet) && isStd(FLEET) ? '' : ' Red\u2019s fleet: ' + fleetText(redFleet) + '.');
    hintMsg = firstGame() ? FIRST_TIP : START_HINT;
    render();
    dlog('ok', 'new game (' + LEVEL + ')');
  }

  // the move line changes together with the 3D board: wait for the frame that draws the move (cap 250 ms)
  var statusSeq = 0;
  function setStatus(txt) {
    var n = ++statusSeq, done = false, put = function () { if (done || n !== statusSeq) return; done = true; $('lastMove').textContent = txt; };
    if (window.SGView && SGView.afterDraw && !SGView.battling()) { SGView.afterDraw(put); setTimeout(put, 250); } else put();
  }

  function clearSel() { sel = null; insp = null; marks = null; danger = []; opts = []; exposed = []; shiftWarn = false; }

  function inspect(i) {
    var pc = st.board[i];
    clearSel(); insp = i; marks = SG.pieceMarkers(st, i);
    hintMsg = SG.isNebula(st, i) ? 'Red ' + SG.NAMES[pc.t] + ' is jammed by nebula (free in ' + SG.pliesToPulse(st) + ' moves).'
            : 'Red ' + SG.NAMES[pc.t] + ': its moves, lanes and captures. Closes on the next move.';
    render();
  }

  function selectOwn(i) {
    var pc = st.board[i];
    clearSel();
    if (SG.isNebula(st, i)) {                       // jammed: no ring, no markers, just the hint
      var n = SG.pliesToPulse(st);
      hintMsg = 'Jammed by nebula: this ship is stuck until the nebula shifts in ' + n + ' move' + (n === 1 ? '' : 's') + '.';
      return;
    }
    sel = i;
    opts = SG.pieceMoves(st, i);
    if (st.turn !== HUMAN) {                        // Red's turn: ring only; dots/lanes/brackets appear after Red moves
      hintMsg = 'Selected your ' + SG.NAMES[pc.t] + '. Its options appear after Red\u2019s move.';
      return;
    }
    marks = SG.pieceMarkers(st, i);
    // Danger hatching and '!' badges depend on Red's reply, so they are only shown on your turn
    // (a pre-selection made while Red is thinking gets them once Red has moved).
    if (st.turn === HUMAN) {
      danger = SG.dangerSquares(st, i);
      // '!' only for moves that NEWLY expose the Flagship; if it is already under attack, the single
      // "Flagship under attack" warning line covers it instead of badges.
      exposed = opts.filter(function (m) { return SG.newlyExposesFlagship(st, m); }).map(function (m) { return m.to; });
      // the shift my move triggers can expose my OTHER ships (a lane opens, a jammed enemy is freed): hatch them too
      if (SG.pliesToPulse(st) === 1 && SG.pulseAfterSide(st) === HUMAN) { var nowHit = SG.legalMoves(Object.assign({}, st, { turn: 1 - HUMAN }), 1 - HUMAN).filter(function (x) { return x.cap; }).map(function (x) { return x.to; });
        for (var j = 0; j < 36; j++) { var q = st.board[j]; if (j !== i && q && q.s === HUMAN && danger.indexOf(j) < 0 && nowHit.indexOf(j) < 0 && SG.pulseUnjamsThreat(st, j, HUMAN)) danger.push(j); } }
      if (danger.some(function (j) { return j !== i && st.board[j] && st.board[j].s === HUMAN; })) shiftWarn = true;
    }
    hintMsg = !opts.length ? 'That ship has no moves right now.' : SHIP_HINT[pc.t] +
      (exposed.length ? ' \u26A0 ! = leaves your Flagship open.' : '') + (shiftWarn ? ' \u26A0 Hatched: the shift after your move exposes those ships.' : '');
  }

  // A brief message that falls back to the previous hint unless something else replaced it meanwhile.
  // It is shown on top of the normal hint for FLASH_MS (>= 1.2s) even if Red moves meanwhile; the normal
  // hint (possibly updated underneath) comes back afterwards.
  var redMovedAt = 0, inputTime = null;
  var UPTAG = { L: 'R4', D: '+1', S: '\u2197', F: '2\u00d7' };
  // Popup toast (never takes taps) + one-time tips (remembered in localStorage sg_tips)
  var toastQ = [], toastBusy = false;
  function toast(msg, kind, ms) { toastQ.push([msg, kind || '', ms || 2200]); if (!toastBusy) nextToast(); }
  function nextToast() { var t = toastQ.shift(), el = $('toast'); if (!t || !el) { toastBusy = false; return; } toastBusy = true;
    el.textContent = t[0]; el.className = 'toast show ' + t[1]; setTimeout(function () { el.className = 'toast ' + t[1]; setTimeout(nextToast, 250); }, t[2]); }
  function tipOnce(key, msg) { var seen = {}; try { seen = JSON.parse(localStorage.getItem('sg_tips') || '{}'); } catch (e) {} if (seen[key]) return;
    seen[key] = 1; try { localStorage.setItem('sg_tips', JSON.stringify(seen)); } catch (e) {} toast(msg, 'tip', 4200); }
  var FLASH_MS = 1500, flashMsg = '', flashUntil = 0;
  function flashHint(msg) {
    flashMsg = msg; flashUntil = Date.now() + FLASH_MS; render();
    setTimeout(render, FLASH_MS + 20);
  }

  // movedAt: {i, t} of the last move you made by tapping. The second tap of a quick double-tap (< ECHO_MS)
  // on the ship that just moved is ignored; a genuine re-tap after that reselects it.
  var ECHO_MS = 150, movedAt = null;

  // Returns {did} or {ignored: reason} for the debug log / stress test.
  function onCell(i) {
    var pc = st.board[i], now = inputTime || Date.now();
    var over = st.winner !== null, myTurn = !busy && !over && st.turn === HUMAN;
    // Second tap of a double-tap lands on the ship that just moved there: don't reselect it.
    if (movedAt && movedAt.i === i && now - movedAt.t < ECHO_MS && pc && pc.s === HUMAN) return { ignored: 'double-tap echo on the ship that just moved' };
    if (sel !== null) {
      var m = opts.filter(function (o) { return o.to === i; })[0];
      if (m) {
        if (over) { render(); return { ignored: 'game over' }; }
        // Red's turn: nothing happens and the selection stays; markers are redrawn after Red moves.
        if (!myTurn) { flashHint('Wait for Red\u2019s move.'); return { ignored: 'destination during Red\u2019s turn (selection kept)' }; }
        clearSel(); movedAt = m.kind === 'move' ? { i: i, t: now } : null;   // shots: the Lancer stays put, nothing to guard
        commit(m);
        return { did: 'move' };
      }
    }
    if (pc && pc.s === AI_SIDE) {
      if (insp === i) { clearSel(); hintMsg = ''; render(); return { did: 'close inspect' }; }
      inspect(i); return { did: 'inspect' };
    }
    if (pc && pc.s === HUMAN && !over) {
      if (sel === i) { clearSel(); hintMsg = ''; render(); return { did: 'deselect' }; }
      selectOwn(i); render(); return { did: 'select' };          // allowed during Red's turn (pre-select)
    }
    var had = sel !== null || insp !== null;
    clearSel(); hintMsg = ''; render();
    return had ? { did: 'clear' } : { ignored: over ? 'game over, empty square' : 'empty square, nothing selected' };
  }

  function commit(m) {
    var wasShot = m.kind === 'shot', target = m.to, redMove = st.turn === AI_SIDE;
    if (!redMove) { try { localStorage.setItem('sg_played', '1'); } catch (e) {} }
    var keep = redMove && sel !== null ? sel : null;           // a pre-selection survives Red's move
    var keepType = keep !== null ? st.board[keep].t : null;
    var prev = st;
    st = SG.applyMove(st, m);
    if (window.SGView && m.cap) SGView.battle(prev, m, st);   // cinematic battle; the state is already final
    // 'Wait for Red' belongs to Red's turn: once Red has moved it clears at once (the 1.2s minimum only applies during Red's turn).
    if (redMove) { flashUntil = 0; redMovedAt = Date.now(); }
    clearSel(); hintMsg = '';
    if (keep !== null && st.winner === null) {
      if (st.board[keep] && st.board[keep].s === HUMAN) {
        selectOwn(keep);                                       // markers recomputed for the new position
      } else {
        hintMsg = 'Your selected ' + SG.NAMES[keepType] + ' was captured.';
      }
    }
    setStatus(SG.describeMove(st.lastMove) + '.');
    if (st.pulsed) hintMsg = 'The nebula shifted! ' + hintMsg;
    if (st.skipped) hintMsg = st.skipped.map(function (sd) { return sd === HUMAN ? 'You have no legal move: your turn is skipped.' : 'Red has no legal move: its turn is skipped.'; }).join(' ') + (hintMsg ? ' ' + hintMsg : '');
    if (!redMove) stats.moves++;
    render();
    if (wasShot || m.cap) flash(target);
    var upAt = st.lastMove && st.lastMove.up;
    if (upAt !== null && upAt !== undefined) { var upId = gameId, upPly = st.ply, upPc = st.lastMove.piece, upSide = st.lastMove.side;
      afterView(function () { if (upId !== gameId) return; fxDel(upAt, 'upfx'); void cells[upAt].offsetWidth; fxAdd(upAt, 'upfx', 1300);
        if (st.ply === upPly || upSide === HUMAN) { flashMsg = '\u2605 ' + (upSide === HUMAN ? 'Your ' : 'Red ') + SG.NAMES[upPc] + ' upgraded: ' + SG.UPGRADE[upPc] + '!'; flashUntil = Date.now() + 2500; render(); }
        toast('\u2605 ' + (upSide === HUMAN ? '' : 'Red ') + SG.NAMES[upPc] + ' upgraded: ' + SG.UPGRADE[upPc], upSide === HUMAN ? 'blue' : 'red');
        tipOnce('up', 'Tip: a capture by a non-upgraded ship upgrades it for 3 of your own turns. The \u2605 tag counts down, then the upgrade wears off. A ship can earn it again with a later capture. An unused Flagship 2-square move is lost when it wears off.');
        if (upPc === 'F' && upSide === HUMAN) tipOnce('dbl', 'Tip: your Flagship now has ONE 2-square straight move (\u2605 2\u00d7). Its middle square must be empty. Unused, that move is lost when the upgrade wears off.'); }); }
    if (st.winner !== null) {
      var id = gameId;
      afterView(function () { if (id !== gameId) return; overTimer = setTimeout(function () { overTimer = null; if (id === gameId && st.winner !== null) gameOver(); }, OVER_DELAY); });
      return;
    }
    if (st.turn === AI_SIDE) {
      busy = true;
      var gid = gameId;
      afterView(function () { if (gid !== gameId) return; aiTimer = setTimeout(function () {
        aiTimer = null;
        if (gid !== gameId || st.winner !== null) return;
        var am = SGAI.safeChooseMove(st, LEVEL);
        busy = false;
        if (am) commit(am);
      }, AI_DELAY); });
    }
  }

  // Capture/shot flash: a one-off animation; the class is removed on animationend (or after 700ms at the latest).
  function flash(i) { fxDel(i, 'boom'); void cells[i].offsetWidth; fxAdd(i, 'boom', 700); }
  function has(a, i) { return a && a.indexOf(i) >= 0; }

  function render() {
    var over = st.winner !== null;
    var warn = !over && SG.nebulaWarning(st), incoming = warn ? SG.incomingNebula(st) : [];
    var flagDanger = !over && SG.flagshipThreatened(st, HUMAN) ? SG.findFlagship(st, HUMAN) : -1;
    if (flagDanger < 0 && !over && st.turn === HUMAN && SG.flagshipExposedByPulse(st, HUMAN)) flagDanger = SG.findFlagship(st, HUMAN);   // the shift my move triggers will expose it
    var lm = st.lastMove, foe = insp !== null ? ' foe' : '';
    for (var i = 0; i < 36; i++) {
      var c = cells[i], pc = st.board[i], p = SG.rc(i);
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '') + (SG.isNebula(st, i) ? ' nebula' : '') + (has(lm && lm.expired, i) ? ' upgone' : '');
      var html = '', utn = pc && pc.up ? (pc.ut != null ? pc.ut : SG.UPGRADE_TURNS) : 0;
      if (has(danger, i)) html += '<i class="ov threat"></i>';
      if (lm && (lm.from === i || lm.to === i)) html += '<i class="ov last"></i>';
      if (warn && incoming.indexOf(i) >= 0) html += '<i class="ov forecast"></i>';
      if (sel === i || insp === i) html += '<i class="ov sel' + foe + '"></i>';
      if (pc) {
        html += shipHTML(pc.s === SG.BLUE ? 'b' : 'r', pc.t, (SG.isNebula(st, i) ? ' jam' : '') + (i === flagDanger ? ' danger' : '') + (pc.up ? ' up' : ''));
        if (pc.up) html += '<i class="mk upb' + (pc.t === 'F' && !pc.dbl ? ' spent' : '') + '" aria-hidden="true">\u2605' + UPTAG[pc.t] + '\u00b7' + utn + '</i>';   // capture upgrade tag: star + what it gained + turns left
        if (SG.isNebula(st, i)) html += '<i class="mk lock"><svg aria-hidden="true"><use href="#i-lock"/></svg></i>';   // jammed
      }
      var label = SG.coord(i) + (pc ? ' ' + SG.SIDE_NAMES[pc.s] + ' ' + SG.NAMES[pc.t] + (pc.up ? ' (upgraded: ' + (pc.t === 'F' && !pc.dbl ? '2-square move used' : SG.UPGRADE[pc.t]) + ', ' + utn + ' turns left)' : '') : '') + (SG.isNebula(st, i) ? (pc ? ', jammed in nebula' : ', nebula') : '');
      if (marks) {
        var mv = has(marks.moves, i), ln = has(marks.lanes, i), cp = has(marks.caps, i);
        if (ln) html += '<i class="mk lane' + (mv ? ' withmove' : '') + '"></i>';
        if (mv) html += '<i class="mk move' + foe + (has(exposed, i) ? ' withexpose' : '') + '"></i>';
        if (cp) html += '<i class="mk cap' + (has(exposed, i) ? ' withexpose' : '') + '"></i>';
        label += (mv ? ', move' : '') + (ln ? ', fire lane' : '') + (cp ? ', capture' : '');
      }
      if (has(exposed, i)) { html += '<i class="mk expose">!</i>'; label += ', leaves your Flagship open'; }
      if (has(danger, i)) label += ', danger';
      var k = cache[i];
      if (k.cls !== cls) { c.className = cls; k.cls = cls; for (var n in fx[i]) c.classList.add(n); }
      if (k.html !== html) { c.innerHTML = html; k.html = html; }
      if (k.label !== label) { c.setAttribute('aria-label', label); k.label = label; }
    }
    var t = $('turn');
    if (over) { t.textContent = 'Game over'; t.className = 'turn'; }
    else if (st.turn === HUMAN) { t.textContent = 'Your turn'; t.className = 'turn you'; }
    else { t.textContent = 'Red\u2019s turn\u2026'; t.className = 'turn ai'; }
    $('btnResult').classList.toggle('hidden', !over || !overShown || !$('overModal').classList.contains('hidden'));
    $('round').textContent = 'Round ' + Math.min(SG.displayRound(st), SG.MAX_PLY / 2) + '/' + SG.MAX_PLY / 2;
    var ni = $('nebulaInfo'), plies = SG.pliesToPulse(st);
    if (over) ni.textContent = '';
    else if (warn) ni.textContent = '\u26A0 Shift after ' + (SG.pulseAfterSide(st) === HUMAN ? 'your move' : 'Red\u2019s move');
    if (warn && !over && SG.pulseAfterSide(st) === HUMAN && st.turn === HUMAN) tipOnce('shift', 'Tip: the nebula shifts right after your move. Hatched squares show ships the shift would expose.');
    else ni.textContent = 'Nebula in ' + plies + ' moves';
    ni.className = 'neb' + (warn ? ' warn' : '');
    // Warning line has its own slot above everything else in the info area, so it is never clipped.
    var wtxt = flagDanger >= 0 && st.turn === HUMAN ? (SG.flagshipThreatened(st, HUMAN) ? '\u26A0 Your Flagship is under attack!' : '\u26A0 The nebula shift after your move exposes your Flagship!') : '';
    if ($('warn').textContent !== wtxt) $('warn').textContent = wtxt;
    infoEl.classList.toggle('haswarn', !!wtxt);   // short screens: hint drops to 1 line so 'what Red did' stays visible
    var htxt = Date.now() < flashUntil ? flashMsg : hintMsg;
    if ($('hint').textContent !== htxt) $('hint').textContent = htxt;
    if (window.SGView) SGView.sync(st, { sel: sel, insp: insp, danger: danger });
    tray('trayRed', st.captured[HUMAN], 'r', 'Captured:');
    tray('trayBlue', st.captured[AI_SIDE], 'b', 'Lost:');
  }

  // Ships are inline-SVG symbols (#sb-F, #sr-L, ...) defined once in index.html.
  function shipHTML(side, t, extra) {
    return '<span class="pc ' + side + ' ' + t + (extra || '') + '"><svg class="shp" aria-hidden="true"><use href="#s' + side + '-' + t + '"/></svg></span>';
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function tray(id, list, cls, label) {
    var html = list.length ? '<span class="tlabel">' + label + '</span>' + list.map(function (t) {
      return shipHTML(cls, t, ' mini');
    }).join('') : '';
    var el = $(id); if (el.innerHTML !== html) el.innerHTML = html;
  }

  function gameOver() {
    if (st.winner === null) return;
    var w = st.winner, title, text, icon;
    if (w === -1) { title = 'Draw'; icon = '\u262F'; }
    else if (w === HUMAN) { title = 'Victory!'; icon = '\u2605'; }
    else { title = 'Defeat'; icon = '\u2716'; }
    if (st.reason === 'flagship') text = w === HUMAN ? 'You destroyed the enemy Flagship.' : 'Your Flagship was destroyed.';
    else if (st.reason === 'stranded') text = (w === HUMAN ? 'Red was' : 'You were') +
      ' stranded: no legal move (every ship blocked or jammed by the nebula). No legal move means you lose.';
    else text = 'Round 40 reached. Points destroyed (Flagship not counted): you ' + SG.destroyed(st, SG.BLUE) +
      ', Red ' + SG.destroyed(st, SG.RED) + '.';
    $('overIcon').textContent = icon; $('overTitle').textContent = title; $('overText').textContent = text;
    overShown = true;
    show('overModal');
    render();
  }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); if (st) render(); }
  $('btnRules').onclick = function () { show('rulesModal'); };
  $('btnResult').onclick = function () { gameOver(); };
  // New game screen: difficulty picker (default Medium, last choice remembered)
  var pick = LEVEL, lvlBtns = [].slice.call(document.querySelectorAll('#newModal .lvl'));
  function showLevels() { lvlBtns.forEach(function (b) { b.setAttribute('aria-checked', b.dataset.level === pick ? 'true' : 'false'); }); }
  lvlBtns.forEach(function (b) { b.onclick = function () { pick = b.dataset.level; showLevels(); }; });
  // Fleet pick (M4): steppers within the points budget; 'Standard fleet' is one tap. Remembered between games.
  var FLEET = (function () { try { var f = JSON.parse(localStorage.getItem('sg_fleet')); return SG.fleetValid(f || {}) ? f : SG.DEFAULT_FLEET; } catch (e) { return SG.DEFAULT_FLEET; } })(), fpick = null;
  function isStd(f) { return f.L === 2 && f.D === 2 && f.S === 2; }
  function showFleet() { var n = fpick.L + fpick.D + fpick.S, cost = SG.fleetCost(fpick), ok = SG.fleetValid(fpick);
    [].forEach.call(document.querySelectorAll('#newModal .frow[data-t]'), function (r) { var t = r.dataset.t; r.querySelector('.fcount').textContent = fpick[t];
      r.querySelector('[data-d="-1"]').disabled = fpick[t] <= 0; r.querySelector('[data-d="1"]').disabled = fpick[t] >= SG.TYPE_MAX || n >= SG.FLEET_SIZE || cost + SG.COST[t] > SG.BUDGET; });
    $('fleetPts').textContent = cost + ' / ' + SG.BUDGET + ' pts \u00b7 ' + (n + 1) + ' / ' + (SG.FLEET_SIZE + 1) + ' ships'; $('fleetPts').className = ok ? '' : 'bad';
    var std = isStd(fpick), pl = function (k, w) { return fpick[k] + ' ' + w + (fpick[k] === 1 ? '' : 's'); };
    $('btnStdFleet').setAttribute('aria-pressed', std ? 'true' : 'false');
    $('btnStdFleet').innerHTML = std ? 'Standard fleet <small>2 Lancers · 2 Drones · 2 Shields</small>'
      : 'Custom fleet <small>' + pl('L', 'Lancer') + ' · ' + pl('D', 'Drone') + ' · ' + pl('S', 'Shield') + ' — tap for Standard</small>';
    $('fleetNote').textContent = ok ? '7 ships: the Flagship + 6 more, max 3 of a type, ' + SG.BUDGET + ' points. Red picks its fleet too.' : 'Pick ' + (SG.FLEET_SIZE - n) + ' more ship' + (SG.FLEET_SIZE - n === 1 ? '' : 's') + ' (7 in all).';
    $('btnStart').disabled = !ok; }
  [].forEach.call(document.querySelectorAll('#newModal .frow[data-t] .step'), function (b) { b.onclick = function () { var t = b.closest('.frow').dataset.t; fpick[t] = Math.max(0, fpick[t] + +b.dataset.d); showFleet(); }; });
  $('btnStdFleet').onclick = function () { fpick = Object.assign({}, SG.DEFAULT_FLEET); showFleet(); };
  function openNew() { pick = LEVEL; showLevels(); fpick = Object.assign({}, FLEET); showFleet(); $('newWarn').classList.toggle('hidden', !(st.ply > 0 && st.winner === null)); hide('overModal'); show('newModal'); }
  $('btnStart').onclick = function () { if (!SG.fleetValid(fpick)) return; LEVEL = pick; FLEET = Object.assign({}, fpick); try { localStorage.setItem('sg_level', LEVEL); localStorage.setItem('sg_fleet', JSON.stringify(FLEET)); } catch (e) {} hide('newModal'); start(); };
  $('btnNew').onclick = openNew;
  $('btnAgain').onclick = openNew;
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.onclick = function () { hide(b.closest('.modal').id); };
  });
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) hide(m.id); });
  });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchstart', function () {}, { passive: true });   // enables :active on iOS buttons

  if (DEBUG) {
    window.SGDebug = {
      state: function () { return st; },
      sel: function () { return sel; },
      redMovedAt: function () { return redMovedAt; },
      setState: function (s) { viewSkip(); clearTimeout(aiTimer); clearTimeout(overTimer); aiTimer = overTimer = null; movedAt = null; flashUntil = 0; fxClear(); busy = false; gameId++;
        st = s; clearSel(); hintMsg = ''; overShown = false; hide('overModal'); },
      stats: function () { return JSON.parse(JSON.stringify(stats)); },
      busy: function () { return busy; },
      view: function () { return window.SGView ? '3d' : '2d'; },
      cellCenter: function (i) { if (window.SGView && SGView.cellSize) return SGView.cellSize(i); var r = cells[i].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }
    };
  }
  start();
  try { if (!localStorage.getItem('sg_seen_rules')) { show('rulesModal'); localStorage.setItem('sg_seen_rules', '1'); } } catch (e) {}
})();
