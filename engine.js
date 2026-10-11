/* Starfall Gambit — rules engine (pure, no DOM). Works in browser (window.SG) and Node (require). */
(function (root) {
  'use strict';
  var N = 6, CELLS = 36;
  var BLUE = 0, RED = 1;               // Blue = human (bottom), Red = computer (top)
  var LANCER_RANGE = 3;
  var NEBULA_EVERY = 6;                // plies (= 3 full rounds)
  var MAX_PLY = 80;                    // 40 rounds turn cap
  var VALUE = { F: 100, L: 3, D: 3, S: 2 };
  var NAMES = { F: 'Flagship', D: 'Drone', L: 'Lancer', S: 'Shield' };
  var SIDE_NAMES = ['Blue', 'Red'];

  var KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  var ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];
  var KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

  function rc(i) { return [Math.floor(i / N), i % N]; }
  function idx(r, c) { return r * N + c; }
  function inB(r, c) { return r >= 0 && r < N && c >= 0 && c < N; }
  function coord(i) { var p = rc(i); return 'abcdef'[p[1]] + (N - p[0]); }

  // Deterministic RNG (mulberry32) so the nebula schedule is part of the state (search-friendly, reproducible).
  function nextRand(seed) {
    var t = (seed + 0x6D2B79F5) | 0;
    var r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return { seed: t, value: ((r ^ (r >>> 14)) >>> 0) / 4294967296 };
  }

  // Nebula: 2 random cells in the middle 4 rows (rows 2-5 as labelled on screen) plus their top-to-bottom
  // mirror images (same column, mirrored row), exactly like the starting setup, so it is always fair.
  // A new pattern never overlaps the previous one (the old nebula fully clears).
  function mirrorCell(i) { var p = rc(i); return idx(N - 1 - p[0], p[1]); }
  function genNebula(seed, avoid) {
    avoid = avoid || [];
    var cells = [];
    while (cells.length < 4) {
      var x = nextRand(seed); seed = x.seed;
      var i = 6 + Math.floor(x.value * 24);       // rows 1..4 (0-based)
      var m = mirrorCell(i);
      if (cells.indexOf(i) < 0 && avoid.indexOf(i) < 0 && avoid.indexOf(m) < 0) { cells.push(i, m); }
    }
    cells.sort(function (a, b) { return a - b; });
    return { cells: cells, seed: seed };
  }
  // Pulse k (1-based) happens after ply 6k, plus one extra ply on even pulses: plies 6, 13, 18, 25, 30, ...
  // So the nebula still shifts every 3 rounds on average, but alternately after Red's move (Blue reacts first)
  // and after Blue's move (Red reacts first). This removes Blue's edge from always reacting first.
  function pulsePly(k) { return NEBULA_EVERY * k + (k % 2 === 0 ? 1 : 0); }

  function newGame(seed) {
    if (seed === undefined) seed = (Math.random() * 4294967296) >>> 0;
    var board = new Array(CELLS).fill(null);
    var back = ['L', 'D', 'S', 'F', 'D', 'L'];
    for (var c = 0; c < N; c++) {
      board[idx(0, c)] = { t: back[c], s: RED };
      board[idx(5, c)] = { t: back[c], s: BLUE };
    }
    board[idx(1, 3)] = { t: 'S', s: RED };   // second Shield guards the Flagship
    board[idx(4, 3)] = { t: 'S', s: BLUE };
    var g = genNebula(seed >>> 0, null);
    return {
      board: board, turn: BLUE, ply: 0,
      nebula: [], nextNebula: g.cells, nextPulse: pulsePly(1), pulses: 0, seed: g.seed,
      winner: null, reason: null, lastMove: null, captured: [[], []]
    };
  }

  function clone(st) {
    return {
      board: st.board.slice(), turn: st.turn, ply: st.ply,
      nebula: st.nebula, nextNebula: st.nextNebula, nextPulse: st.nextPulse, pulses: st.pulses, seed: st.seed,
      winner: st.winner, reason: st.reason, lastMove: st.lastMove,
      captured: [st.captured[0].slice(), st.captured[1].slice()]
    };
  }

  function isNebula(st, i) { return st.nebula.indexOf(i) >= 0; }

  // Lancer fire targets from cell i for side s.
  function shotTargets(st, i, s) {
    var out = [], p = rc(i);
    for (var d = 0; d < 4; d++) {
      for (var k = 1; k <= LANCER_RANGE; k++) {
        var r = p[0] + ORTHO[d][0] * k, c = p[1] + ORTHO[d][1] * k;
        if (!inB(r, c)) break;
        var j = idx(r, c);
        if (isNebula(st, j)) break;            // nebula blocks line of sight
        var q = st.board[j];
        if (!q) continue;
        if (q.s !== s && q.t !== 'S') out.push(j); // Shields can't be shot
        break;                                     // any piece blocks the line
      }
    }
    return out;
  }

  function pieceMoves(st, i) {
    var pc = st.board[i]; if (!pc) return [];
    if (isNebula(st, i)) return [];               // jammed inside the nebula
    var s = pc.s, p = rc(i), out = [];
    function step(dirs, canCapture) {
      for (var d = 0; d < dirs.length; d++) {
        var r = p[0] + dirs[d][0], c = p[1] + dirs[d][1];
        if (!inB(r, c)) continue;
        var j = idx(r, c);
        if (isNebula(st, j)) continue;
        var q = st.board[j];
        if (!q) out.push({ from: i, to: j, kind: 'move', cap: null });
        else if (canCapture && q.s !== s) out.push({ from: i, to: j, kind: 'move', cap: q });
      }
    }
    switch (pc.t) {
      case 'F': step(KING, true); break;
      case 'D': step(KNIGHT, true); break;
      case 'S': step(ORTHO, true); break;
      case 'L':
        step(KING, false);
        shotTargets(st, i, s).forEach(function (j) {
          out.push({ from: i, to: j, kind: 'shot', cap: st.board[j] });
        });
        break;
    }
    return out;
  }

  function legalMoves(st, side) {
    if (side === undefined) side = st.turn;
    var out = [];
    if (st.winner !== null) return out;
    for (var i = 0; i < CELLS; i++) {
      var pc = st.board[i];
      if (pc && pc.s === side) Array.prototype.push.apply(out, pieceMoves(st, i));
    }
    return out;
  }

  function material(st, s) {
    var v = 0;
    for (var i = 0; i < CELLS; i++) { var p = st.board[i]; if (p && p.s === s && p.t !== 'F') v += VALUE[p.t]; }
    return v;
  }

  function applyMove(st, m) {
    var ns = clone(st), b = ns.board, mover = b[m.from];
    if (m.cap) ns.captured[mover.s].push(m.cap.t);
    if (m.kind === 'shot') { b[m.to] = null; }
    else { b[m.to] = mover; b[m.from] = null; }
    ns.lastMove = { from: m.from, to: m.to, kind: m.kind, piece: mover.t, side: mover.s, cap: m.cap ? m.cap.t : null };
    ns.ply++;
    ns.turn = 1 - ns.turn;
    if (m.cap && m.cap.t === 'F') { ns.winner = mover.s; ns.reason = 'flagship'; return ns; }
    if (ns.ply === ns.nextPulse) {                     // nebula pulse
      ns.nebula = ns.nextNebula;
      var g = genNebula(ns.seed, ns.nebula);
      ns.nextNebula = g.cells; ns.seed = g.seed; ns.pulses++; ns.nextPulse = pulsePly(ns.pulses + 1);
      ns.pulsed = true;
    } else ns.pulsed = false;
    if (ns.ply >= MAX_PLY) {
      var a = material(ns, BLUE), r = material(ns, RED);
      ns.winner = a > r ? BLUE : r > a ? RED : -1;   // -1 = draw
      ns.reason = 'turncap';
      return ns;
    }
    if (legalMoves(ns).length === 0) { ns.winner = 1 - ns.turn; ns.reason = 'stranded'; }
    return ns;
  }

  function findFlagship(st, s) {
    for (var i = 0; i < CELLS; i++) { var p = st.board[i]; if (p && p.s === s && p.t === 'F') return i; }
    return -1;
  }
  // Is side s's Flagship capturable by the opponent right now (ignoring whose turn it is)?
  function flagshipThreatened(st, s) {
    var f = findFlagship(st, s); if (f < 0) return false;
    var ms = legalMoves(st, 1 - s);
    for (var k = 0; k < ms.length; k++) if (ms[k].to === f && ms[k].cap) return true;
    return false;
  }
  // Rounds until next pulse is counted in plies; warning is shown during the final full round.
  function pliesToPulse(st) { return st.nextPulse - st.ply; }
  // Which side makes the move that triggers the next pulse.
  function pulseAfterSide(st) { return (st.nextPulse - 1) % 2; }
  // Round number for display: during play the current round; once the game is over, the round of the final move.
  function displayRound(st) { return st.winner !== null ? Math.max(1, Math.ceil(st.ply / 2)) : Math.floor(st.ply / 2) + 1; }
  // Squares enemy Lancers (of side `enemy`) could hit, treating `ignore` as empty (the square a selected ship leaves).
  // A square holding one of the enemy's own (non-Lancer-target-proof) ships is included when a Lancer covers it:
  // if you capture that ship, your ship lands there in the Lancer's line of fire.
  function lancerThreats(st, enemy, ignore) {
    var out = {};
    for (var i = 0; i < CELLS; i++) {
      var pc = st.board[i];
      if (!pc || pc.s !== enemy || pc.t !== 'L' || isNebula(st, i)) continue;
      var p = rc(i);
      for (var d = 0; d < 4; d++) {
        for (var k = 1; k <= LANCER_RANGE; k++) {
          var r = p[0] + ORTHO[d][0] * k, c = p[1] + ORTHO[d][1] * k;
          if (!inB(r, c)) break;
          var j = idx(r, c);
          if (isNebula(st, j)) break;
          var q = j === ignore ? null : st.board[j];
          if (!q) { out[j] = true; continue; }
          if (q.s === enemy || q.t !== 'S') out[j] = true;   // enemy-held square (capture target) or our non-Shield ship
          break;                                            // any ship blocks the rest of the line
        }
      }
    }
    return Object.keys(out).map(Number);
  }
  // Markers for any ship (either side): where it can MOVE (empty squares), what it can ATTACK (squares where it
  // would capture: melee captures, or Lancer shot targets), and for Lancers the full firing LANES (empty squares
  // in range up to the first ship or nebula). Jammed ships have none.
  function pieceMarkers(st, i) {
    var pc = st.board[i], res = { moves: [], caps: [], lanes: [] };
    if (!pc || isNebula(st, i)) return res;
    pieceMoves(st, i).forEach(function (m) { (m.cap ? res.caps : res.moves).push(m.to); });
    if (pc.t === 'L') {
      var p = rc(i);
      for (var d = 0; d < 4; d++) {
        for (var k = 1; k <= LANCER_RANGE; k++) {
          var r = p[0] + ORTHO[d][0] * k, c = p[1] + ORTHO[d][1] * k;
          if (!inB(r, c)) break;
          var j = idx(r, c);
          if (isNebula(st, j) || st.board[j]) break;
          res.lanes.push(j);
        }
      }
    }
    return res;
  }

  // Real danger to the ship on square i: each of its legal MOVES (incl. captures) is played out with applyMove
  // (so a nebula shift triggered by that move uses the incoming pattern), and the destination is marked if the
  // opponent could then capture that ship. Shots aren't included (the Lancer stays put). The ship's current
  // square is also marked if it is under attack right now. Moves that win the game are never marked.
  function dangerSquares(st, i) {
    var pc = st.board[i], out = [];
    if (!pc || st.winner !== null) return out;
    var me = pc.s, foe = 1 - me;
    var base = st.turn === me ? st : Object.assign({}, st, { turn: me });
    pieceMoves(base, i).forEach(function (m) {
      if (m.kind !== 'move') return;
      var ns = applyMove(base, m);
      if (ns.winner !== null) return;
      var hit = legalMoves(ns, foe).some(function (x) { return x.cap && x.to === m.to; });
      if (hit) out.push(m.to);
    });
    if (!isNebula(st, i) && legalMoves(Object.assign({}, st, { turn: foe }), foe).some(function (x) { return x.cap && x.to === i; })) out.push(i);
    return out;
  }
  // Would making move m leave the mover's own Flagship capturable by the opponent right after it?
  // (Flagship-winning moves never count.) Used to warn, never to block.
  function exposesFlagship(st, m) {
    var pc = st.board[m.from]; if (!pc) return false;
    var me = pc.s, base = st.turn === me ? st : Object.assign({}, st, { turn: me });
    var ns = applyMove(base, m);
    if (ns.winner !== null) return false;
    var f = findFlagship(ns, me); if (f < 0) return false;
    return legalMoves(ns, 1 - me).some(function (x) { return x.cap && x.to === f; });
  }
  function nebulaWarning(st) { return pliesToPulse(st) <= 2; }

  function describeMove(lm) {
    if (!lm) return '';
    var who = SIDE_NAMES[lm.side];
    var s = who + ' ' + NAMES[lm.piece] + (lm.kind === 'shot' ? ' fired from ' + coord(lm.from) + ' at ' + coord(lm.to)
                                                            : ' ' + coord(lm.from) + '→' + coord(lm.to));
    if (lm.cap) s += (lm.kind === 'shot' ? ', destroying a ' : ', capturing a ') + NAMES[lm.cap];
    return s;
  }

  var api = {
    N: N, BLUE: BLUE, RED: RED, LANCER_RANGE: LANCER_RANGE, NEBULA_EVERY: NEBULA_EVERY, MAX_PLY: MAX_PLY,
    VALUE: VALUE, NAMES: NAMES, SIDE_NAMES: SIDE_NAMES,
    newGame: newGame, legalMoves: legalMoves, pieceMoves: pieceMoves, applyMove: applyMove, shotTargets: shotTargets,
    material: material, findFlagship: findFlagship, flagshipThreatened: flagshipThreatened,
    pliesToPulse: pliesToPulse, pulseAfterSide: pulseAfterSide, displayRound: displayRound, lancerThreats: lancerThreats, pieceMarkers: pieceMarkers, dangerSquares: dangerSquares, exposesFlagship: exposesFlagship,
    mirrorCell: mirrorCell, pulsePly: pulsePly, genNebula: genNebula, nebulaWarning: nebulaWarning, isNebula: isNebula,
    coord: coord, rc: rc, idx: idx, describeMove: describeMove, nextRand: nextRand
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SG = api;
})(typeof self !== 'undefined' ? self : this);
