/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = 'easy', AI_DELAY = 650, OVER_DELAY = 700;
  var st, sel = null, opts = [], threats = [], busy = false, aiTimer = null, overTimer = null, gameId = 0;
  var hintMsg = '', overShown = false;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), cells = [];
  var SHIP_HINT = {
    F: 'Flagship: 1 square any direction. Keep it safe!',
    D: 'Drone: jumps in an L, even over ships and nebula.',
    L: 'Lancer: steps 1 square, or fires (yellow crosshair) up to 3 squares.',
    S: 'Shield: 1 square straight. Immune to Lancer shots.'
  };
  var FIRST_TIP = 'Tip: Lancers shoot up to 3 squares in a straight line. Select a ship to see red-striped danger squares.';

  for (var i = 0; i < 36; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cell';
    b.dataset.i = i;
    boardEl.appendChild(b);
    cells.push(b);
  }
  boardEl.addEventListener('click', function (e) {
    var t = e.target.closest('.cell'); if (t) onCell(+t.dataset.i);
  });

  function firstGame() { try { return !localStorage.getItem('sg_played'); } catch (e) { return false; } }

  function start() {
    clearTimeout(aiTimer); clearTimeout(overTimer); aiTimer = overTimer = null;
    gameId++;
    st = SG.newGame(); sel = null; opts = []; threats = []; busy = false; overShown = false;
    hide('overModal');
    $('lastMove').textContent = 'Tap one of your blue ships to begin.';
    hintMsg = firstGame() ? FIRST_TIP : '';
    render();
  }

  function onCell(i) {
    if (busy || st.winner !== null || st.turn !== HUMAN) return;
    var m = opts.filter(function (o) { return o.to === i; })[0];
    if (sel !== null && m) { sel = null; opts = []; threats = []; commit(m); return; }
    var pc = st.board[i];
    if (pc && pc.s === HUMAN && sel !== i) {
      sel = i; opts = SG.pieceMoves(st, i);
      threats = pc.t === 'S' ? [] : SG.lancerThreats(st, AI_SIDE, i);   // Shields are immune: no stripes
      hintMsg = SG.isNebula(st, i) ? 'That ship is jammed in the nebula until it shifts.'
              : opts.length ? SHIP_HINT[pc.t] : 'That ship has no moves right now.';
    } else { sel = null; opts = []; threats = []; hintMsg = ''; }
    render();
  }

  function commit(m) {
    var wasShot = m.kind === 'shot', target = m.to;
    if (st.turn === HUMAN) { try { localStorage.setItem('sg_played', '1'); } catch (e) {} }
    st = SG.applyMove(st, m);
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

  function flash(i) { var c = cells[i]; c.classList.remove('boom'); void c.offsetWidth; c.classList.add('boom'); }

  function render() {
    var over = st.winner !== null;
    var warn = !over && SG.nebulaWarning(st);
    var flagDanger = !over && SG.flagshipThreatened(st, HUMAN) ? SG.findFlagship(st, HUMAN) : -1;
    var lm = st.lastMove;
    for (var i = 0; i < 36; i++) {
      var c = cells[i], pc = st.board[i], p = SG.rc(i);
      var o = opts.filter(function (x) { return x.to === i; })[0];
      var cls = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '');
      if (SG.isNebula(st, i)) cls += ' nebula';
      if (c.classList.contains('boom')) cls += ' boom';
      c.className = cls;
      var html = '';
      if (sel !== null && threats.indexOf(i) >= 0) html += '<i class="ov threat"></i>';
      if (lm && (lm.from === i || lm.to === i)) html += '<i class="ov last"></i>';
      if (warn && st.nextNebula.indexOf(i) >= 0) html += '<i class="ov forecast"></i>';
      if (sel === i) html += '<i class="ov sel"></i>';
      if (pc) {
        html += '<span class="pc ' + (pc.s === SG.BLUE ? 'b' : 'r') + ' ' + pc.t +
          (SG.isNebula(st, i) ? ' jam' : '') + (i === flagDanger ? ' danger' : '') +
          '"><span class="ic">' + pc.t + '</span></span>';
      }
      if (o) html += '<i class="mk ' + (o.kind === 'shot' ? 'shot' : o.cap ? 'cap' : 'move') + '"></i>';
      if (p[1] === 0) html += '<span class="lbl row">' + (6 - p[0]) + '</span>';
      if (p[0] === 5) html += '<span class="lbl col">' + 'abcdef'[p[1]] + '</span>';
      c.innerHTML = html;
      c.setAttribute('aria-label', SG.coord(i) + (pc ? ' ' + SG.SIDE_NAMES[pc.s] + ' ' + SG.NAMES[pc.t] : '') +
        (SG.isNebula(st, i) ? ' (nebula)' : ''));
    }
    var t = $('turn');
    if (over) { t.textContent = 'Game over'; t.className = 'turn'; }
    else if (st.turn === HUMAN) { t.textContent = 'Your turn'; t.className = 'turn you'; }
    else { t.textContent = 'Red is thinking…'; t.className = 'turn ai'; }
    $('btnResult').classList.toggle('hidden', !over || !overShown || !$('overModal').classList.contains('hidden'));
    $('round').textContent = 'Round ' + Math.min(SG.displayRound(st), SG.MAX_PLY / 2) + '/' + SG.MAX_PLY / 2;
    var ni = $('nebulaInfo'), plies = SG.pliesToPulse(st), rounds = Math.ceil(plies / 2);
    if (over) ni.textContent = '';
    else if (warn) ni.textContent = '⚠ Shift after ' + (SG.pulseAfterSide(st) === HUMAN ? 'your move' : "Red's move");
    else ni.textContent = 'Nebula in ' + rounds + ' round' + (rounds === 1 ? '' : 's');
    ni.className = 'neb' + (warn ? ' warn' : '');
    // Hint line: transient message plus the Flagship warning (never overwrites it).
    var parts = [];
    if (hintMsg) parts.push(hintMsg);
    if (flagDanger >= 0 && st.turn === HUMAN) parts.push('⚠ Your Flagship is under fire!');
    $('hint').innerHTML = parts.map(function (s) { return '<div>' + esc(s) + '</div>'; }).join('');
    tray('trayRed', st.captured[HUMAN], 'r', 'Destroyed:');
    tray('trayBlue', st.captured[AI_SIDE], 'b', 'Lost:');
  }

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  function tray(id, list, cls, label) {
    $(id).innerHTML = list.length ? '<span class="tlabel">' + label + '</span>' + list.map(function (t) {
      return '<span class="pc mini ' + cls + ' ' + t + '"><span class="ic">' + t + '</span></span>';
    }).join('') : '';
  }

  function gameOver() {
    if (st.winner === null) return;
    var w = st.winner, title, text, icon;
    if (w === -1) { title = 'Draw'; icon = '☯'; }
    else if (w === HUMAN) { title = 'Victory!'; icon = '★'; }
    else { title = 'Defeat'; icon = '✖'; }
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
  // iOS: block pinch-zoom; enable :active styles (Safari needs a touchstart listener).
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchstart', function () {}, { passive: true });
  // Double-tap zoom is disabled via CSS touch-action: manipulation (no JS hack, so fast taps still register).

  // Test hooks only with ?debug in the URL (not exposed in normal play).
  if (/[?&]debug(=|&|$)/.test(location.search)) {
    window.SGDebug = { state: function () { return st; }, setState: function (s) { st = s; sel = null; opts = []; threats = []; render(); } };
  }
  start();
  try { if (!localStorage.getItem('sg_seen_rules')) { show('rulesModal'); localStorage.setItem('sg_seen_rules', '1'); } } catch (e) {}
})();
