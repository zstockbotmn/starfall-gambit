/* Starfall Gambit — UI layer (touch-first). Depends on SG (engine.js) and SGAI (ai.js). */
(function () {
  'use strict';
  var HUMAN = SG.BLUE, AI_SIDE = SG.RED, LEVEL = 'easy', AI_DELAY = 650;
  var st, sel = null, opts = [], busy = false, aiTimer = null;
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), cells = [];

  // Build grid once.
  for (var i = 0; i < 36; i++) {
    var b = document.createElement('button');
    var p = SG.rc(i);
    b.type = 'button';
    b.className = 'cell' + ((p[0] + p[1]) % 2 ? ' alt' : '');
    b.dataset.i = i;
    b.setAttribute('aria-label', SG.coord(i));
    boardEl.appendChild(b);
    cells.push(b);
  }
  boardEl.addEventListener('click', function (e) {
    var t = e.target.closest('.cell'); if (t) onCell(+t.dataset.i);
  });

  function start() {
    clearTimeout(aiTimer);
    st = SG.newGame(); sel = null; opts = []; busy = false;
    hide('overModal');
    $('lastMove').textContent = 'Tap one of your blue ships to begin.';
    render();
  }

  function onCell(i) {
    if (busy || st.winner !== null || st.turn !== HUMAN) return;
    var m = opts.filter(function (o) { return o.to === i; })[0];
    if (sel !== null && m) { sel = null; opts = []; commit(m); return; }
    var pc = st.board[i];
    if (pc && pc.s === HUMAN && sel !== i) {
      sel = i; opts = SG.pieceMoves(st, i);
      hint(opts.length ? '' : SG.isNebula(st, i) ? 'That ship is jammed in the nebula.' : 'That ship has no moves.');
    } else { sel = null; opts = []; hint(''); }
    render();
  }

  function commit(m) {
    var wasShot = m.kind === 'shot', target = m.to;
    st = SG.applyMove(st, m);
    $('lastMove').textContent = SG.describeMove(st.lastMove) + '.';
    hint(st.pulsed ? 'The nebula pulsed!' : '');
    render();
    if (wasShot || m.cap) flash(target);
    if (st.winner !== null) { setTimeout(gameOver, 700); return; }
    if (st.turn === AI_SIDE) {
      busy = true;
      aiTimer = setTimeout(function () {
        var am = SGAI.chooseMove(st, LEVEL);
        busy = false;
        if (am) commit(am);
      }, AI_DELAY);
    }
  }

  function flash(i) { var c = cells[i]; c.classList.remove('boom'); void c.offsetWidth; c.classList.add('boom'); }
  function hint(t) { $('hint').textContent = t; }

  function render() {
    var warn = st.winner === null && SG.nebulaWarning(st);
    var flagDanger = st.winner === null && SG.flagshipThreatened(st, HUMAN) ? SG.findFlagship(st, HUMAN) : -1;
    var lm = st.lastMove;
    for (var i = 0; i < 36; i++) {
      var c = cells[i], pc = st.board[i];
      var o = opts.filter(function (x) { return x.to === i; })[0];
      var cls = 'cell' + ((SG.rc(i)[0] + SG.rc(i)[1]) % 2 ? ' alt' : '');
      if (SG.isNebula(st, i)) cls += ' nebula';
      if (warn && st.nextNebula.indexOf(i) >= 0) cls += ' forecast';
      if (lm && (lm.from === i || lm.to === i)) cls += ' last';
      if (sel === i) cls += ' sel';
      if (o) cls += o.kind === 'shot' ? ' shot' : o.cap ? ' cap' : ' move';
      if (c.classList.contains('boom')) cls += ' boom';
      c.className = cls;
      var html = '';
      if (pc) {
        html = '<span class="pc ' + (pc.s === SG.BLUE ? 'b' : 'r') + ' ' + pc.t +
          (SG.isNebula(st, i) ? ' jam' : '') + (i === flagDanger ? ' danger' : '') +
          '"><span class="ic">' + pc.t + '</span></span>';
      }
      var p = SG.rc(i);
      if (p[1] === 0) html += '<span class="lbl">' + (6 - p[0]) + '</span>';
      else if (p[0] === 5) html += '<span class="lbl">' + 'abcdef'[p[1]] + '</span>';
      c.innerHTML = html;
      c.setAttribute('aria-label', SG.coord(i) + (pc ? ' ' + SG.SIDE_NAMES[pc.s] + ' ' + SG.NAMES[pc.t] : ''));
    }
    var t = $('turn');
    if (st.winner !== null) { t.textContent = 'Game over'; t.className = 'turn'; }
    else if (st.turn === HUMAN) { t.textContent = 'Your turn'; t.className = 'turn you'; }
    else { t.textContent = 'Red is thinking…'; t.className = 'turn ai'; }
    $('round').textContent = 'Round ' + Math.min(Math.floor(st.ply / 2) + 1, SG.MAX_PLY / 2) + '/' + SG.MAX_PLY / 2;
    var rounds = Math.ceil(SG.pliesToPulse(st) / 2), ni = $('nebulaInfo');
    ni.textContent = warn ? '⚠ Nebula shifts after this round' : 'Nebula shifts in ' + rounds + ' rounds';
    ni.className = 'neb' + (warn ? ' warn' : '');
    if (flagDanger >= 0 && st.turn === HUMAN && !$('hint').textContent) hint('⚠ Your Flagship is under fire!');
    tray('trayRed', st.captured[HUMAN], 'r', 'Destroyed: ');
    tray('trayBlue', st.captured[AI_SIDE], 'b', 'Lost: ');
  }

  function tray(id, list, cls, label) {
    $(id).innerHTML = list.length ? label + list.map(function (t) {
      return '<span class="pc mini ' + cls + ' ' + t + '">' + t + '</span>';
    }).join('') : '';
  }

  function gameOver() {
    var w = st.winner, title, text, icon;
    if (w === -1) { title = 'Draw'; icon = '☯'; }
    else if (w === HUMAN) { title = 'Victory!'; icon = '★'; }
    else { title = 'Defeat'; icon = '☄'; }
    if (st.reason === 'flagship') text = w === HUMAN ? 'You destroyed the enemy Flagship.' : 'Your Flagship was destroyed.';
    else if (st.reason === 'stranded') text = (w === HUMAN ? 'Red' : 'You') + ' had no legal move left (stranded).';
    else text = 'Round limit reached. Fleet points: Blue ' + SG.material(st, SG.BLUE) + ', Red ' + SG.material(st, SG.RED) + '.';
    $('overIcon').textContent = icon; $('overTitle').textContent = title; $('overText').textContent = text;
    show('overModal');
  }

  function show(id) { $(id).classList.remove('hidden'); }
  function hide(id) { $(id).classList.add('hidden'); }
  $('btnRules').onclick = function () { show('rulesModal'); };
  $('btnNew').onclick = function () {
    if (st.ply === 0 || st.winner !== null || confirm('Abandon this game and start a new one?')) start();
  };
  $('btnAgain').onclick = start;
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.onclick = function () { b.closest('.modal').classList.add('hidden'); };
  });
  document.querySelectorAll('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m) m.classList.add('hidden'); });
  });
  // iOS: block pinch / double-tap zoom gestures.
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  // Double-tap zoom is disabled via CSS touch-action: manipulation (no JS hack, so fast taps still register).

  window.SGDebug = { state: function () { return st; } };
  start();
  try { if (!localStorage.getItem('sg_seen_rules')) { show('rulesModal'); localStorage.setItem('sg_seen_rules', '1'); } } catch (e) {}
})();
