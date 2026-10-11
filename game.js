/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = 'easy', AI_DELAY = 650, OVER_DELAY = 250, LONG_PRESS = 500;
  var GHOST_MS = 600;            // a pointer-generated click within this time of a pointer tap on the same square is its echo
  var DEBUG = /[?&]debug(=|&|$)/.test(location.search);
  var st, sel = null, insp = null, marks = null, danger = [], opts = [], exposed = [], queued = null;
  var busy = false, aiTimer = null, overTimer = null, gameId = 0, hintMsg = '', overShown = false;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), cells = [], cache = [];
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
    dbgEl = document.createElement('div'); dbgEl.id = 'tapLog'; dbgEl.className = 'taplog';
    document.body.appendChild(dbgEl);
  }
  function dlog(kind, msg) {
    if (kind === 'ignored') { stats.ignored++; stats.reasons[msg] = (stats.reasons[msg] || 0) + 1; }
    if (!DEBUG) return;
    dbgLines.unshift(new Date().toISOString().slice(17, 23) + ' ' + kind + ': ' + msg);
    dbgLines.length = Math.min(dbgLines.length, 8);
    dbgEl.textContent = dbgLines.join('\n');
  }

  // ---- Input. Pointer events are the single source of taps; a click is only used when no pointer tap
  // produced it (keyboard, VoiceOver, or a browser that cancelled the pointer stream).
  // touch-action:none on the board means the browser never turns a slightly-moving finger into a pan
  // (that used to fire pointercancel and swallow taps). Because of that, drags must be rejected here:
  // a tap counts only if the press starts and ends on the same square and never travels more than
  // DRAG_CELLS x cell size (straight-line distance from the pointerdown point).
  var DRAG_CELLS = 0.6;
  var down = null, lpTimer = null, ghosts = [];
  function cellFrom(x, y) {
    var el = document.elementFromPoint(x, y);
    el = el && el.closest ? el.closest('.cell') : null;
    return el && boardEl.contains(el) ? +el.dataset.i : -1;
  }
  function clearPress() { clearTimeout(lpTimer); lpTimer = null; if (down) cells[down.i].classList.remove('press'); down = null; }
  function cancelPress(reason, detail) {
    if (!down) return;
    var d = down; clearPress();
    stats.cancelled++; stats.cancelReasons[reason] = (stats.cancelReasons[reason] || 0) + 1;
    dlog('cancelled', reason + (detail ? ' (' + detail + ')' : '') + ' [' + d.type + ' from ' + SG.coord(d.i) + ']');
    return d;
  }
  boardEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var t = e.target.closest('.cell'); if (!t) return;
    if (down) cancelPress('second finger');
    ghosts = [];                                           // a new press means any pending echo click is stale
    var size = t.getBoundingClientRect().width;
    down = { id: e.pointerId, i: +t.dataset.i, x: e.clientX, y: e.clientY, long: false, type: e.pointerType, max: DRAG_CELLS * size };
    try { boardEl.setPointerCapture(e.pointerId); } catch (err) {}   // keep getting move/up even off the board
    t.classList.add('press');
    var d = down;
    lpTimer = setTimeout(function () {
      var pc = st.board[d.i];
      if (down === d && pc && pc.s === AI_SIDE) { d.long = true; inspect(d.i); dlog('ok', 'long-press inspect ' + SG.coord(d.i)); }
    }, LONG_PRESS);
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (!down || e.pointerId !== down.id || down.long) return;
    var dist = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (dist > down.max) { down.drag = true; cancelPress('drag over ' + DRAG_CELLS + ' cell', Math.round(dist) + 'px'); }
  });
  boardEl.addEventListener('pointerup', function (e) {
    var now = Date.now();
    if (!down || e.pointerId !== down.id) return;          // already cancelled (drag) or unknown pointer
    var d = down;
    var i = cellFrom(e.clientX, e.clientY);
    ghosts.push({ i: i, j: d.i, t: now });                 // swallow the browser's echo click either way
    var dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (d.long) { clearPress(); return; }                  // the long-press already acted (inspect)
    if (dist > d.max) { cancelPress('drag over ' + DRAG_CELLS + ' cell', Math.round(dist) + 'px'); return; }
    if (i < 0) { cancelPress('lifted off the board'); return; }
    if (i !== d.i) { cancelPress('ended on a different square', SG.coord(i)); return; }
    clearPress();
    tap(i, d.type);
  });
  boardEl.addEventListener('pointercancel', function (e) {
    if (down && e.pointerId === down.id) cancelPress('pointercancel from the browser');
  });
  boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  boardEl.addEventListener('click', function (e) {
    var t = e.target.closest('.cell'); if (!t) return;
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

  function start() {
    clearTimeout(aiTimer); clearTimeout(overTimer); clearTimeout(queueTimer); aiTimer = overTimer = queueTimer = null; movedAt = null;
    gameId++;
    st = SG.newGame(); clearSel(); busy = false; overShown = false;
    hide('overModal');
    $('lastMove').textContent = 'New game. You\u2019re Blue and you move first.';
    hintMsg = firstGame() ? FIRST_TIP : START_HINT;
    render();
  }

  function clearSel() { sel = null; insp = null; marks = null; danger = []; opts = []; exposed = []; queued = null; }

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
    opts = SG.pieceMoves(st, i); marks = SG.pieceMarkers(st, i); danger = SG.dangerSquares(st, i);
    // '!' only for moves that NEWLY expose the Flagship; if it is already under attack, the single
    // "Flagship under attack" warning line covers it instead of badges.
    exposed = opts.filter(function (m) { return SG.newlyExposesFlagship(st, m); }).map(function (m) { return m.to; });
    hintMsg = !opts.length ? 'That ship has no moves right now.' : SHIP_HINT[pc.t] +
      (exposed.length ? ' \u26A0 ! = leaves your Flagship open.' : '');
  }

  var QUEUE_DELAY = 350, queueTimer = null, movedAt = null;   // movedAt: {i, t} of the last move you made by tapping

  // Returns {did} or {ignored: reason} for the debug log / stress test.
  function onCell(i) {
    var pc = st.board[i], now = Date.now();
    var over = st.winner !== null, myTurn = !busy && !over && st.turn === HUMAN;
    if (queueTimer) return { ignored: 'playing your queued move' };
    // Second tap of a double-tap lands on the ship that just moved there: don't reselect it.
    if (movedAt && movedAt.i === i && now - movedAt.t < 450 && pc && pc.s === HUMAN) return { ignored: 'double-tap echo on the ship that just moved' };
    if (sel !== null) {
      var m = opts.filter(function (o) { return o.to === i; })[0];
      if (m) {
        if (over) { render(); return { ignored: 'game over' }; }
        if (!myTurn) {                                        // Red's turn: queue it
          if (queued && queued.to === i) { queued = null; hintMsg = 'Queued move cancelled.'; render(); return { did: 'unqueue' }; }
          queued = { from: sel, to: i, kind: m.kind, cap: !!m.cap };
          hintMsg = 'Queued: plays right after Red moves, if it\u2019s still legal.';
          render(); return { did: 'queued' };
        }
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
    var keepType = keep !== null ? st.board[keep].t : null, q = redMove ? queued : null;
    st = SG.applyMove(st, m);
    clearSel(); hintMsg = '';
    var playQueued = null;
    if (keep !== null && st.winner === null) {
      if (st.board[keep] && st.board[keep].s === HUMAN) {
        selectOwn(keep);                                       // markers recomputed for the new position
        if (q) {
          playQueued = SG.pieceMoves(st, q.from).filter(function (x) { return x.to === q.to && x.kind === q.kind && !!x.cap === q.cap; })[0] || null;
          hintMsg = playQueued ? 'Playing your queued move\u2026' : 'Wait for Red: your queued move isn\u2019t possible any more.';
        }
      } else {
        hintMsg = 'Your selected ' + SG.NAMES[keepType] + ' was captured.' + (q ? ' Queued move cancelled.' : '');
      }
    }
    $('lastMove').textContent = SG.describeMove(st.lastMove) + '.';
    if (st.pulsed) hintMsg = 'The nebula shifted! ' + hintMsg;
    if (!redMove) stats.moves++;
    render();
    if (wasShot || m.cap) flash(target);
    if (st.winner !== null) {
      var id = gameId;
      overTimer = setTimeout(function () { overTimer = null; if (id === gameId && st.winner !== null) gameOver(); }, OVER_DELAY);
      return;
    }
    if (playQueued) {
      if (playQueued) queued = { from: playQueued.from, to: playQueued.to };   // keep the queued marker visible
      render();
      var g0 = gameId;
      queueTimer = setTimeout(function () {
        queueTimer = null; queued = null;
        if (g0 !== gameId || st.winner !== null || st.turn !== HUMAN) { render(); return; }
        var mv = SG.pieceMoves(st, playQueued.from).filter(function (x) { return x.to === playQueued.to && x.kind === playQueued.kind; })[0];
        clearSel();
        if (mv) commit(mv); else render();
      }, QUEUE_DELAY);
      return;
    }
    if (st.turn === AI_SIDE) {
      busy = true;
      var gid = gameId;
      aiTimer = setTimeout(function () {
        aiTimer = null;
        if (gid !== gameId || st.winner !== null) return;
        var am = SGAI.safeChooseMove(st, LEVEL);
        busy = false;
        if (am) commit(am);
      }, AI_DELAY);
    }
  }

  function flash(i) { var c = cells[i]; c.classList.remove('boom'); void c.offsetWidth; c.classList.add('boom'); cache[i].cls = null; }
  function has(a, i) { return a && a.indexOf(i) >= 0; }

  function render() {
    var over = st.winner !== null;
    var warn = !over && SG.nebulaWarning(st);
    var flagDanger = !over && SG.flagshipThreatened(st, HUMAN) ? SG.findFlagship(st, HUMAN) : -1;
    var lm = st.lastMove, foe = insp !== null ? ' foe' : '';
    for (var i = 0; i < 36; i++) {
      var c = cells[i], pc = st.board[i], p = SG.rc(i);
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '') + (SG.isNebula(st, i) ? ' nebula' : '') +
        (c.classList.contains('boom') ? ' boom' : '') + (c.classList.contains('press') ? ' press' : '');
      var html = '';
      if (has(danger, i)) html += '<i class="ov threat"></i>';
      if (lm && (lm.from === i || lm.to === i)) html += '<i class="ov last"></i>';
      if (warn && st.nextNebula.indexOf(i) >= 0) html += '<i class="ov forecast"></i>';
      if (sel === i || insp === i) html += '<i class="ov sel' + foe + '"></i>';
      if (queued && queued.to === i) html += '<i class="ov queued"></i>';
      if (pc) {
        html += '<span class="pc ' + (pc.s === SG.BLUE ? 'b' : 'r') + ' ' + pc.t +
          (SG.isNebula(st, i) ? ' jam' : '') + (i === flagDanger ? ' danger' : '') +
          '"><span class="ic">' + pc.t + '</span></span>';
      }
      var label = SG.coord(i) + (pc ? ' ' + SG.SIDE_NAMES[pc.s] + ' ' + SG.NAMES[pc.t] : '') + (SG.isNebula(st, i) ? ', nebula' : '');
      if (marks) {
        var mv = has(marks.moves, i), ln = has(marks.lanes, i), cp = has(marks.caps, i);
        if (ln) html += '<i class="mk lane' + (mv ? ' withmove' : '') + '"></i>';
        if (mv) html += '<i class="mk move' + foe + '"></i>';
        if (cp) html += '<i class="mk cap' + (has(exposed, i) ? ' withexpose' : '') + '"></i>';
        label += (mv ? ', move' : '') + (ln ? ', fire lane' : '') + (cp ? ', capture' : '');
      }
      if (has(exposed, i)) { html += '<i class="mk expose">!</i>'; label += ', leaves your Flagship open'; }
      if (queued && queued.to === i) label += ', queued';
      if (has(danger, i)) label += ', danger';
      var k = cache[i];
      if (k.cls !== cls) { c.className = cls; k.cls = cls; }
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
    if ($('hint').textContent !== hintMsg) $('hint').textContent = hintMsg;
    tray('trayRed', st.captured[HUMAN], 'r', 'Captured:');
    tray('trayBlue', st.captured[AI_SIDE], 'b', 'Lost:');
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function tray(id, list, cls, label) {
    var html = list.length ? '<span class="tlabel">' + label + '</span>' + list.map(function (t) {
      return '<span class="pc mini ' + cls + ' ' + t + '"><span class="ic">' + t + '</span></span>';
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
      setState: function (s) { clearTimeout(aiTimer); clearTimeout(overTimer); clearTimeout(queueTimer); aiTimer = overTimer = queueTimer = null; movedAt = null; busy = false; gameId++;
        st = s; clearSel(); hintMsg = ''; overShown = false; hide('overModal'); },
      stats: function () { return JSON.parse(JSON.stringify(stats)); },
      busy: function () { return busy; }
    };
  }
  start();
  try { if (!localStorage.getItem('sg_seen_rules')) { show('rulesModal'); localStorage.setItem('sg_seen_rules', '1'); } } catch (e) {}
})();
