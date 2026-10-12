/* Starfall Gambit — rules engine (pure, no DOM). Works in browser (window.SG) and Node (require). */
(function (root) {
  'use strict';
  var N = 6, CELLS = 36;
  var BLUE = 0, RED = 1;               // Blue = human (bottom), Red = computer (top)
  var LANCER_RANGE = 3;
  var JAM_CAPTURE = true;              // M4: nebula jams but doesn't shield (Drones/Shields may capture into it)
  var NEBULA_EVERY = 6;                // plies (= 3 full rounds)
  var MAX_PLY = 80;                    // 40 rounds turn cap
  var VALUE = { F: 100, L: 3, D: 3, S: 2 };
  var NAMES = { F: 'Flagship', D: 'Drone', L: 'Lancer', S: 'Shield' };
  var SIDE_NAMES = ['Blue', 'Red'];
  var UPGRADE = { L: 'range 4', D: 'can also step 1 square', S: 'can also move diagonally', F: 'one 2-square move' };

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

  // ---- Fleet pick: the Flagship plus 6 ships, at most 3 of a type, costing at most BUDGET points (L 3, D 3, S 2).
  var BUDGET = 16, FLEET_SIZE = 6, TYPE_MAX = 3, COST = { L: 3, D: 3, S: 2 };
  var DEFAULT_FLEET = { L: 2, D: 2, S: 2 };
  function fleetCost(f) { return (f.L || 0) * COST.L + (f.D || 0) * COST.D + (f.S || 0) * COST.S; }
  function fleetValid(f) { var n = (f.L || 0) + (f.D || 0) + (f.S || 0); return n === FLEET_SIZE && fleetCost(f) <= BUDGET && ['L', 'D', 'S'].every(function (t) { var k = f[t] || 0; return k >= 0 && k <= TYPE_MAX && k === Math.floor(k); }); }
  function allFleets() { var out = []; for (var l = 0; l <= TYPE_MAX; l++) for (var d = 0; d <= TYPE_MAX; d++) { var f = { L: l, D: d, S: FLEET_SIZE - l - d }; if (fleetValid(f)) out.push(f); } return out; }
  function fleetKey(f) { return f.L + 'L' + f.D + 'D' + f.S + 'S'; }
  // Placement: columns a-f of the back row (Flagship on d) plus the square in front of the Flagship. Each type fills its
  // preferred slots in turn: Lancers the corners, Drones next to them, Shields in front of / beside the Flagship.
  var SLOT_PREF = { L: ['a1', 'f1', 'b1', 'e1', 'c1', 'd2'], D: ['b1', 'e1', 'c1', 'a1', 'f1', 'd2'], S: ['d2', 'c1', 'b1', 'e1', 'a1', 'f1'] };
  function placeFleet(f) { var used = {}, out = {};
    ['L', 'D', 'S'].forEach(function (t) { for (var k = 0; k < (f[t] || 0); k++) { var sl = SLOT_PREF[t].filter(function (x) { return !used[x]; })[0]; used[sl] = 1; out[sl] = t; } });
    return out; }   // slot name (Blue's view) -> type
  function newGame(seed, opts) {
    if (seed === undefined || seed === null) seed = (Math.random() * 4294967296) >>> 0;
    opts = opts || {};
    var fleets = [opts.fleets && fleetValid(opts.fleets[0] || {}) ? opts.fleets[0] : DEFAULT_FLEET, opts.fleets && fleetValid(opts.fleets[1] || {}) ? opts.fleets[1] : DEFAULT_FLEET];
    var board = new Array(CELLS).fill(null);
    board[idx(5, 3)] = { t: 'F', s: BLUE }; board[idx(0, 3)] = { t: 'F', s: RED };
    [BLUE, RED].forEach(function (s) { var pl = placeFleet(fleets[s]);
      Object.keys(pl).forEach(function (sl) { var c = 'abcdef'.indexOf(sl[0]), r = sl[1] === '1' ? 5 : 4; if (s === RED) r = N - 1 - r; board[idx(r, c)] = { t: pl[sl], s: s }; }); });
    var g = genNebula(seed >>> 0, null);
    return {
      board: board, turn: BLUE, ply: 0,
      nebula: [], nextNebula: g.cells, nextPulse: pulsePly(1), pulses: 0, seed: g.seed,
      winner: null, reason: null, lastMove: null, captured: [[], []], fleets: [Object.assign({}, fleets[0]), Object.assign({}, fleets[1])]
    };
  }

  function clone(st) {
    return {
      board: st.board.slice(), turn: st.turn, ply: st.ply,
      nebula: st.nebula, nextNebula: st.nextNebula, nextPulse: st.nextPulse, pulses: st.pulses, seed: st.seed,
      winner: st.winner, reason: st.reason, lastMove: st.lastMove,
      captured: [st.captured[0].slice(), st.captured[1].slice()], fleets: st.fleets, lastBy: st.lastBy
    };
  }

  function isNebula(st, i) { return st.nebula.indexOf(i) >= 0; }

  // Lancer fire targets from cell i for side s.
  // Capture upgrade (one-time, on a ship's first capture): Lancer range +1, Drone may also step 1 square, Shield may also
  // move diagonally, Flagship gets one move of 2 squares in a straight line (pc.dbl = still available).
  function lancerRange(pc) { return LANCER_RANGE + (pc && pc.up ? 1 : 0); }
  function shotTargets(st, i, s) {
    var out = [], p = rc(i), rng = lancerRange(st.board[i]);
    for (var d = 0; d < 4; d++) {
      for (var k = 1; k <= rng; k++) {
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
    var seen = {};
    function step(dirs, canCapture) {
      for (var d = 0; d < dirs.length; d++) {
        var r = p[0] + dirs[d][0], c = p[1] + dirs[d][1];
        if (!inB(r, c)) continue;
        var j = idx(r, c);
        if (seen[j]) continue;
        var q = st.board[j];
        // Nebula jams but doesn't shield: a Drone or Shield may move into nebula only to capture a jammed enemy (it is then
        // jammed itself). Nothing else enters nebula; the Flagship never does.
        if (isNebula(st, j)) { if (JAM_CAPTURE && canCapture && q && q.s !== s && pc.t !== 'F') { seen[j] = 1; out.push({ from: i, to: j, kind: 'move', cap: q }); } continue; }
        seen[j] = 1;
        if (!q) out.push({ from: i, to: j, kind: 'move', cap: null });
        else if (canCapture && q.s !== s) out.push({ from: i, to: j, kind: 'move', cap: q });
      }
    }
    function dbl() {   // upgraded Flagship: one move of exactly 2 squares in a straight line, over an empty non-nebula square
      for (var d = 0; d < KING.length; d++) {
        var r1 = p[0] + KING[d][0], c1 = p[1] + KING[d][1], r = p[0] + 2 * KING[d][0], c = p[1] + 2 * KING[d][1];
        if (!inB(r, c)) continue;
        var m1 = idx(r1, c1), j = idx(r, c);
        if (st.board[m1] || isNebula(st, m1) || isNebula(st, j)) continue;
        var q = st.board[j];
        if (!q) out.push({ from: i, to: j, kind: 'move', cap: null, dbl: true });
        else if (q.s !== s) out.push({ from: i, to: j, kind: 'move', cap: q, dbl: true });
      }
    }
    switch (pc.t) {
      case 'F': step(KING, true); if (pc.dbl) dbl(); break;
      case 'D': step(KNIGHT, true); if (pc.up) step(KING, true); break;
      case 'S': step(pc.up ? KING : ORTHO, true); break;
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

  function destroyed(st, s) { var v = 0; st.captured[s].forEach(function (t) { if (t !== 'F') v += VALUE[t]; }); return v; }
  function applyMove(st, m) {
    var ns = clone(st), b = ns.board, mover = b[m.from];
    if (m.cap) ns.captured[mover.s].push(m.cap.t);
    var at = m.kind === 'shot' ? m.from : m.to, piece = mover, upgraded = false;
    if (m.dbl) piece = Object.assign({}, piece, { dbl: false });
    if (m.cap && !piece.up) { piece = Object.assign({}, piece, { up: true, dbl: piece.t === 'F' && !m.dbl }); upgraded = true; }
    if (m.kind === 'shot') { b[m.to] = null; b[m.from] = piece; }
    else { b[m.to] = piece; b[m.from] = null; }
    ns.lastBy = [(st.lastBy || [null, null])[0], (st.lastBy || [null, null])[1]]; ns.lastBy[mover.s] = { from: m.from, to: m.to, kind: m.kind };   // each side's own last move (AI: no back-and-forth shuffles)
    ns.lastMove = { from: m.from, to: m.to, kind: m.kind, piece: mover.t, side: mover.s, cap: m.cap ? m.cap.t : null, up: upgraded ? at : null, dbl: !!m.dbl };
    ns.ply++;
    ns.turn = 1 - ns.turn;
    if (m.cap && m.cap.t === 'F') { ns.winner = mover.s; ns.reason = 'flagship'; return ns; }
    ns.skipped = null;
    if (advance(ns)) return ns;
    // Fair nebula: a side with no legal move is not lost; its turn is skipped (repeat, e.g. if both are stuck, until the
    // nebula frees someone or the round limit is reached).
    for (var guard = 0; legalMoves(ns).length === 0 && guard < 40; guard++) {
      (ns.skipped = ns.skipped || []).push(ns.turn);
      ns.ply++; ns.turn = 1 - ns.turn;
      if (advance(ns)) return ns;
    }
    return ns;
  }
  // Nebula pulse + round limit after a ply. Returns true when the game ended.
  function advance(ns) {
    if (ns.ply === ns.nextPulse) {                     // nebula pulse
      ns.nebula = incomingNebula(ns);                  // a Flagship is never jammed: its square (and the mirror twin) stay clear
      var g = genNebula(ns.seed, ns.nebula);
      ns.nextNebula = g.cells; ns.seed = g.seed; ns.pulses++; ns.nextPulse = pulsePly(ns.pulses + 1);
      ns.pulsed = true;
    } else if (!ns.skipped) ns.pulsed = false;
    if (ns.ply >= MAX_PLY) {
      var a = destroyed(ns, BLUE), r = destroyed(ns, RED);   // points each side destroyed (fair when the fleets differ)
      ns.winner = a > r ? BLUE : r > a ? RED : -1;   // -1 = draw
      ns.reason = 'turncap';
      return true;
    }
    return false;
  }
  // The squares that will become nebula at the next shift, as of now: the scheduled pattern minus any mirrored pair that
  // has a Flagship on either square (the preview updates live when a Flagship steps onto a previewed square).
  function incomingNebula(st) {
    var nx = st.nextNebula || [];
    return nx.filter(function (i) { var m = mirrorCell(i), a = st.board[i], b = st.board[m]; return !(a && a.t === 'F') && !(b && b.t === 'F'); });
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
        for (var k = 1; k <= lancerRange(pc); k++) {
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
        for (var k = 1; k <= lancerRange(pc); k++) {
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
    else if (pulseUnjamsThreat(st, i, me)) out.push(i);   // staying put: my move triggers the nebula shift, which exposes this square
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
  // Warning only (no rule change): on my turn, if my move is the one that triggers the nebula pulse, would the square i
  // (currently jammed/shielded by the nebula, or newly reachable) be capturable by the foe once the shift has happened?
  function pulseUnjamsThreat(st, i, me) {
    if (st.winner !== null || st.turn !== me || st.ply + 1 !== st.nextPulse || !st.nextNebula) return false;
    var after = Object.assign({}, st, { nebula: incomingNebula(st), turn: 1 - me });
    if (isNebula(after, i)) return false;
    return legalMoves(after, 1 - me).some(function (x) { return x.cap && x.to === i; });
  }
  function flagshipExposedByPulse(st, s) { var f = findFlagship(st, s); return f >= 0 && !flagshipThreatened(st, s) && pulseUnjamsThreat(st, f, s); }
  // Only moves that turn a safe Flagship into an attacked one (no warning if it is already under attack).
  function newlyExposesFlagship(st, m) {
    var pc = st.board[m.from]; if (!pc) return false;
    var base = st.turn === pc.s ? st : Object.assign({}, st, { turn: pc.s });
    if (flagshipThreatened(base, pc.s)) return false;
    return exposesFlagship(base, m);
  }
  function nebulaWarning(st) { return pliesToPulse(st) <= 2; }

  function describeMove(lm) {
    if (!lm) return '';
    var who = SIDE_NAMES[lm.side];
    var s = who + ' ' + NAMES[lm.piece] + (lm.kind === 'shot' ? ' fired from ' + coord(lm.from) + ' at ' + coord(lm.to)
                                                            : ' ' + coord(lm.from) + '→' + coord(lm.to));
    if (lm.cap) s += (lm.kind === 'shot' ? ', destroying a ' : ', capturing a ') + NAMES[lm.cap];
    if (lm.up !== null && lm.up !== undefined) s += '. ' + NAMES[lm.piece] + ' upgraded: ' + UPGRADE[lm.piece];
    return s;
  }

  var api = {
    N: N, BLUE: BLUE, RED: RED, LANCER_RANGE: LANCER_RANGE, NEBULA_EVERY: NEBULA_EVERY, MAX_PLY: MAX_PLY,
    VALUE: VALUE, NAMES: NAMES, SIDE_NAMES: SIDE_NAMES,
    newGame: newGame, legalMoves: legalMoves, pieceMoves: pieceMoves, applyMove: applyMove, shotTargets: shotTargets,
    material: material, findFlagship: findFlagship, flagshipThreatened: flagshipThreatened,
    pliesToPulse: pliesToPulse, pulseAfterSide: pulseAfterSide, displayRound: displayRound, lancerThreats: lancerThreats, pieceMarkers: pieceMarkers, dangerSquares: dangerSquares, flagshipExposedByPulse: flagshipExposedByPulse, exposesFlagship: exposesFlagship, newlyExposesFlagship: newlyExposesFlagship,
    mirrorCell: mirrorCell, incomingNebula: incomingNebula, destroyed: destroyed, BUDGET: BUDGET, FLEET_SIZE: FLEET_SIZE, TYPE_MAX: TYPE_MAX, COST: COST, DEFAULT_FLEET: DEFAULT_FLEET, fleetCost: fleetCost, fleetValid: fleetValid, allFleets: allFleets, fleetKey: fleetKey, placeFleet: placeFleet, lancerRange: lancerRange, UPGRADE: UPGRADE, pulsePly: pulsePly, genNebula: genNebula, nebulaWarning: nebulaWarning, isNebula: isNebula,
    coord: coord, rc: rc, idx: idx, describeMove: describeMove, nextRand: nextRand
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SG = api;
})(typeof self !== 'undefined' ? self : this);
