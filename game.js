/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = 'easy', AI_DELAY = 650, OVER_DELAY = 250, LONG_PRESS = 500, LONG_PRESS_CAP = 900;   // hold-to-inspect; longer on a Red ship you could capture
  var GHOST_MS = 600;            // a pointer-generated click within this time of a pointer tap on the same square is its echo
  var DEBUG = /[?&]debug(=|&|$)/.test(location.search);
  var st, sel = null, insp = null, marks = null, danger = [], opts = [], exposed = [];
  var busy = false, aiTimer = null, overTimer = null, gameId = 0, hintMsg = '', overShown = false;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), wrapEl = $('boardWrap'), infoEl = document.querySelector('.info'), cells = [], cache = [];
  var SHIP_HINT = {
    F: 'Flagship: 1 square any direction. Keep it safe!',
    D: 'Drone: jumps in an L, even over ships and nebula.',
    L: 'Lancer: steps 1 square, or fires along its lanes (up to 3).',
    S: 'Shield: 1 square straight. Immune to Lancer shots.'
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
  function dlog(kind, msg) {
    if (kind === 'ignored') { stats.ignored++; stats.reasons[msg] = (stats.reasons[msg] || 0) + 1; }
    if (!DEBUG) return;
    dbgLines.unshift(new Date().toISOString().slice(17, 23) + ' ' + kind + ': ' + msg);
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
  var down = null, lpTimer = null, ghosts = [];
  function cellFrom(x, y) {
    var el = document.elementFromPoint(x, y);
    el = el && el.closest ? el.closest('.cell') : null;
    return el && boardEl.contains(el) ? +el.dataset.i : -1;
  }
  // Square under (x, y), or the nearest square if the point is at most EDGE_PX outside the grid; else -1.
  function cellNear(x, y) {
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
    if (!NO_CUE[reason]) { fxDel(d.i, 'nogo'); void cells[d.i].offsetWidth; fxAdd(d.i, 'nogo', 450); }   // brief faint ring: "that didn't count"
    stats.cancelled++; stats.cancelReasons[reason] = (stats.cancelReasons[reason] || 0) + 1;
    dlog('cancelled', reason + (detail ? ' (' + detail + ')' : '') + ' [' + d.type + ' from ' + SG.coord(d.i) + ']');
    return d;
  }
  wrapEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    viewSkip();                                            // a tap during a battle skips to its end (and still counts as a tap)
    // Rounded board corners / hairline gaps: fall back to the nearest cell.
    var t = e.target.closest('.cell'), i0 = t ? +t.dataset.i : cellNear(e.clientX, e.clientY);
    if (i0 < 0) return;
    t = cells[i0];
    if (down) cancelPress('second finger');
    ghosts = [];                                           // a new press means any pending echo click is stale
    // In 3D the DOM square is a projected trapezoid whose bounding box is wider than the square itself; tolerances use the real width
    var size = (window.SGView && SGView.cellSize) ? SGView.cellSize(i0).w : t.getBoundingClientRect().width;
    down = { id: e.pointerId, i: +t.dataset.i, x: e.clientX, y: e.clientY, long: false, type: e.pointerType, max: DRAG_CELLS * size, slop: Math.max(SLOP_MIN_PX, SLOP_CELLS * size), ply: st.ply, gid: gameId };
    try { wrapEl.setPointerCapture(e.pointerId); } catch (err) {}   // keep getting move/up even off the board
    fxAdd(i0, 'press');
    var d = down, pc0 = st.board[i0];
    if (pc0 && pc0.s === AI_SIDE) {
      // Hold to inspect a Red ship. If it's a capture target of your selection the hold is longer, so a slow
      // tap still captures; a ring fills up while you hold so the inspect never comes as a surprise.
      var capTarget = sel !== null && st.turn === HUMAN && opts.some(function (o) { return o.to === i0; });
      var hold = capTarget ? LONG_PRESS_CAP : LONG_PRESS;
      d.hold = hold; t.style.setProperty('--hold', (hold - 150) + 'ms'); fxAdd(i0, 'holding');
      lpTimer = setTimeout(function () {
        if (down !== d) return;
        fxDel(d.i, 'holding'); d.long = true; inspect(d.i); dlog('ok', 'long-press inspect ' + SG.coord(d.i) + ' (' + hold + 'ms)');
      }, hold);
    }
  });
  wrapEl.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id || down.long) return;
    var dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist > down.max) { down.drag = true; cancelPress('drag over ' + DRAG_CELLS + ' cell', Math.round(dist) + 'px'); }
  });
  wrapEl.addEventListener('pointerup', function (e) {
    var now = Date.now();
    if (!down || e.pointerId !== down.id) {                // already cancelled (drag) or unknown pointer:
      ghosts.push({ i: cellNear(e.clientX, e.clientY), j: -2, t: now });   // still swallow its echo click
      return;
    }
    var d = down;
    var i = cellNear(e.clientX, e.clientY);
    ghosts.push({ i: i, j: d.i, t: now });                 // swallow the browser's echo click either way
    var dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (d.long) { clearPress(); return; }                  // the long-press already acted (inspect)
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
    tap(d.i, d.type);
  });
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
    ghosts = ghosts.filter(function (g) { return now - g.t < GHOST_MS; });
    // detail === 0: keyboard, VoiceOver or programmatic activation, never an echo of a finger/mouse tap.
    if (e.detail !== 0) for (var k = 0; k < ghosts.length; k++) {
      if (ghosts[k].i === i || ghosts[k].j === i) { ghosts.splice(k, 1); return; }   // echo of a pointer press: already dealt with
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

  function start() {
    viewSkip(); clearTimeout(aiTimer); clearTimeout(overTimer); aiTimer = overTimer = null; movedAt = null; flashUntil = 0; fxClear();
    gameId++;
    st = SG.newGame(); clearSel(); busy = false; overShown = false;
    hide('overModal');
    $('lastMove').textContent = 'New game. You\u2019re Blue and you move first.';
    hintMsg = firstGame() ? FIRST_TIP : START_HINT;
    render();
  }

  function clearSel() { sel = null; insp = null; marks = null; danger = []; opts = []; exposed = []; }

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
    }
    hintMsg = !opts.length ? 'That ship has no moves right now.' : SHIP_HINT[pc.t] +
      (exposed.length ? ' \u26A0 ! = leaves your Flagship open.' : '');
  }

  // A brief message that falls back to the previous hint unless something else replaced it meanwhile.
  // It is shown on top of the normal hint for FLASH_MS (>= 1.2s) even if Red moves meanwhile; the normal
  // hint (possibly updated underneath) comes back afterwards.
  var redMovedAt = 0;
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
    var pc = st.board[i], now = Date.now();
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
    $('lastMove').textContent = SG.describeMove(st.lastMove) + '.';
    if (st.pulsed) hintMsg = 'The nebula shifted! ' + hintMsg;
    if (!redMove) stats.moves++;
    render();
    if (wasShot || m.cap) flash(target);
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
    var warn = !over && SG.nebulaWarning(st);
    var flagDanger = !over && SG.flagshipThreatened(st, HUMAN) ? SG.findFlagship(st, HUMAN) : -1;
    var lm = st.lastMove, foe = insp !== null ? ' foe' : '';
    for (var i = 0; i < 36; i++) {
      var c = cells[i], pc = st.board[i], p = SG.rc(i);
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '') + (SG.isNebula(st, i) ? ' nebula' : '');
      var html = '';
      if (has(danger, i)) html += '<i class="ov threat"></i>';
      if (lm && (lm.from === i || lm.to === i)) html += '<i class="ov last"></i>';
      if (warn && st.nextNebula.indexOf(i) >= 0) html += '<i class="ov forecast"></i>';
      if (sel === i || insp === i) html += '<i class="ov sel' + foe + '"></i>';
      if (pc) {
        html += shipHTML(pc.s === SG.BLUE ? 'b' : 'r', pc.t, (SG.isNebula(st, i) ? ' jam' : '') + (i === flagDanger ? ' danger' : ''));
        if (SG.isNebula(st, i)) html += '<i class="mk lock"><svg aria-hidden="true"><use href="#i-lock"/></svg></i>';   // jammed
      }
      var label = SG.coord(i) + (pc ? ' ' + SG.SIDE_NAMES[pc.s] + ' ' + SG.NAMES[pc.t] : '') + (SG.isNebula(st, i) ? (pc ? ', jammed in nebula' : ', nebula') : '');
      if (marks) {
        var mv = has(marks.moves, i), ln = has(marks.lanes, i), cp = has(marks.caps, i);
        if (ln) html += '<i class="mk lane' + (mv ? ' withmove' : '') + '"></i>';
        if (mv) html += '<i class="mk move' + foe + '"></i>';
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
    else ni.textContent = 'Nebula in ' + plies + ' moves';
    ni.className = 'neb' + (warn ? ' warn' : '');
    // Warning line has its own slot above everything else in the info area, so it is never clipped.
    var wtxt = flagDanger >= 0 && st.turn === HUMAN ? '\u26A0 Your Flagship is under attack!' : '';
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
    else text = 'Round 40 reached. Fleet points (Flagship not counted): Blue ' + SG.material(st, SG.BLUE) +
      ', Red ' + SG.material(st, SG.RED) + '.';
    $('overIcon').textContent = icon; $('overTitle').textContent = title; $('overText').textContent = text;
    overShown = true;
    show('overModal');
    render();
  }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); if (st) render(); }
  $('btnRules').onclick = function () { show('rulesModal'); };
  $('btnResult').onclick = function () { gameOver(); };
  $('btnNew').onclick = function () {
    if (st.ply === 0 || st.winner !== null || confirm('Abandon this game and start a new one?')) start();
  };
  $('btnAgain').onclick = start;
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
