/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = 'easy', AI_DELAY = 650, OVER_DELAY = 700, LONG_PRESS = 450;
  var st, sel = null, insp = null, marks = null, danger = [], opts = [];
  var busy = false, aiTimer = null, overTimer = null, gameId = 0, hintMsg = '', overShown = false;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), cells = [], cache = [];
  var SHIP_HINT = {
    F: 'Flagship: 1 square any direction. Keep it safe!',
    D: 'Drone: jumps in an L, even over ships and nebula.',
    L: 'Lancer: steps 1 square, or fires along its lanes (up to 3).',
    S: 'Shield: 1 square straight. Immune to Lancer shots.'
  };
  var FIRST_TIP = 'Tip: Lancers fire up to 3 squares. Tap or hold a Red ship to see its range.';

  for (var i = 0; i < 36; i++) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'cell'; b.dataset.i = i;
    boardEl.appendChild(b); cells.push(b); cache.push({ cls: null, html: null, label: null });
  }

  // ---- Input: pointer events (handled on pointerup, not on the synthesized click), long-press to inspect.
  var down = null, lpTimer = null, lastPointerAt = 0;
  function cellAt(x, y) { var el = document.elementFromPoint(x, y); el = el && el.closest ? el.closest('.cell') : null; return el && boardEl.contains(el) ? +el.dataset.i : -1; }
  function clearPress() { clearTimeout(lpTimer); lpTimer = null; if (down) cells[down.i].classList.remove('press'); down = null; }
  boardEl.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    var t = e.target.closest('.cell'); if (!t) return;
    clearPress();
    down = { id: e.pointerId, i: +t.dataset.i, x: e.clientX, y: e.clientY, long: false };
    t.classList.add('press');
    var d = down;
    lpTimer = setTimeout(function () {
      var pc = st.board[d.i];
      if (down === d && pc && pc.s === AI_SIDE) { d.long = true; inspect(d.i); }
    }, LONG_PRESS);
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (down && e.pointerId === down.id && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 12) clearPress();
  });
  boardEl.addEventListener('pointerup', function (e) {
    if (!down || e.pointerId !== down.id) return;
    var d = down; clearPress();
    lastPointerAt = Date.now();
    if (d.long) return;                                   // long-press already handled (inspect)
    var i = cellAt(e.clientX, e.clientY);
    if (i === d.i) onCell(i);
  });
  boardEl.addEventListener('pointercancel', clearPress);
  boardEl.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  // Keyboard / assistive-tech activation still arrives as click; ignore the click that follows a pointer tap.
  boardEl.addEventListener('click', function (e) {
    if (Date.now() - lastPointerAt < 800) return;
    var t = e.target.closest('.cell'); if (t) onCell(+t.dataset.i);
  });

  function firstGame() { try { return !localStorage.getItem('sg_played'); } catch (e) { return false; } }

  function start() {
    clearTimeout(aiTimer); clearTimeout(overTimer); aiTimer = overTimer = null;
    gameId++;
    st = SG.newGame(); clearSel(); busy = false; overShown = false;
    hide('overModal');
    $('lastMove').textContent = 'Tap one of your blue ships to begin.';
    hintMsg = firstGame() ? FIRST_TIP : '';
    render();
  }

  function clearSel() { sel = null; insp = null; marks = null; danger = []; opts = []; }

  function inspect(i) {
    var pc = st.board[i];
    clearSel(); insp = i; marks = SG.pieceMarkers(st, i);
    hintMsg = SG.isNebula(st, i) ? 'Red ' + SG.NAMES[pc.t] + ' is jammed by nebula: no moves or shots.'
            : 'Red ' + SG.NAMES[pc.t] + ': its moves, lanes and captures. Tap elsewhere to close.';
    render();
  }

  function onCell(i) {
    var pc = st.board[i];
    var myTurn = !busy && st.winner === null && st.turn === HUMAN;
    if (myTurn && sel !== null) {
      var m = opts.filter(function (o) { return o.to === i; })[0];
      if (m) { clearSel(); commit(m); return; }
    }
    if (pc && pc.s === AI_SIDE) { if (insp === i) { clearSel(); hintMsg = ''; render(); } else inspect(i); return; }
    if (pc && pc.s === HUMAN && myTurn && sel !== i) {
      clearSel(); sel = i;
      if (SG.isNebula(st, i)) { hintMsg = 'Jammed by nebula: this ship can\u2019t move or fire until the nebula shifts.'; }
      else {
        opts = SG.pieceMoves(st, i); marks = SG.pieceMarkers(st, i); danger = SG.dangerSquares(st, i);
        hintMsg = opts.length ? SHIP_HINT[pc.t] : 'That ship has no moves right now.';
      }
    } else { clearSel(); hintMsg = ''; }
    render();
  }

  function commit(m) {
    var wasShot = m.kind === 'shot', target = m.to;
    if (st.turn === HUMAN) { try { localStorage.setItem('sg_played', '1'); } catch (e) {} }
    st = SG.applyMove(st, m);
    clearSel();
    $('lastMove').textContent = SG.describeMove(st.lastMove) + '.';
    hintMsg = st.pulsed ? 'The nebula shifted!' : '';
    render();
    if (wasShot || m.cap) flash(target);
    if (st.winner !== null) {
      var id = gameId;
      overTimer = setTimeout(function () { overTimer = null; if (id === gameId && st.winner !== null) gameOver(); }, OVER_DELAY);
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
        if (cp) html += '<i class="mk cap"></i>';
        label += (mv ? ', move' : '') + (ln ? ', fire lane' : '') + (cp ? ', capture' : '');
      }
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
    var parts = [];
    if (hintMsg) parts.push(hintMsg);
    if (flagDanger >= 0 && st.turn === HUMAN) parts.push('\u26A0 Your Flagship is under fire!');
    $('hint').innerHTML = parts.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('');
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

  if (/[?&]debug(=|&|$)/.test(location.search)) {
    window.SGDebug = { state: function () { return st; }, setState: function (s) { st = s; clearSel(); render(); } };
  }
  start();
  try { if (!localStorage.getItem('sg_seen_rules')) { show('rulesModal'); localStorage.setItem('sg_seen_rules', '1'); } } catch (e) {}
})();
