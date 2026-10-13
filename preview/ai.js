/* Starfall Gambit — computer opponent. Levels share one interface: SGAI.chooseMove(state, level).
   Easy is implemented (Milestone 1). Medium/Hard plug into the same negamax search below (Milestone 2). */
(function (root) {
  'use strict';
  var SG = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG;

  var LEVELS = {
    easy:   { kind: 'greedy', blunder: 0.35 },   // grabs captures most of the time, otherwise wanders
    medium: { kind: 'search', depth: 2, bySide: [2, 2.1] },   // second mover searches 1 ply deeper on 10% of moves: standard vs standard 50.0% Red (800 games; was 33.5%)
    hard:   { kind: 'search', depth: 4, bySide: [4, 4.2] }   // second mover 1 ply deeper on 20% of moves (160-game probe: 46.9% Red, was 40.6%)
  };

  var TUNE = { urgDiv: 40, press: 1, hit: .7, hitM: .7 };
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Static evaluation from the perspective of `side` (used by search levels; light use in easy).
  function evaluate(st, side) {
    if (st.winner !== null) return st.winner === side ? 10000 - st.ply : st.winner === -1 ? 0 : -10000 + st.ply;   // prefer the fastest win and the slowest loss (a lost position must not hand the Flagship over at once)
    var score = SG.material(st, side) - SG.material(st, 1 - side);
    // capture upgrades are worth keeping (and denying), scaled by turns left (ut/3); an unused Flagship 2-square move a little more
    for (var i = 0; i < 36; i++) { var p = st.board[i]; if (p && p.up) { var w = p.t === 'F' ? (p.dbl ? .6 : .2) : .9; if (typeof p.ut === 'number') w *= p.ut / SG.UPGRADE_TURNS; score += (p.s === side ? 1 : -1) * w; } }
    // small mobility term
    var mine = SG.legalMoves(st, side), theirs = SG.legalMoves(st, 1 - side);
    score += 0.05 * (mine.length - theirs.length);
    // Press for the kill (M4): attackers close to the enemy Flagship and direct threats on it count, more so as the game
    // goes on, so searches stop drifting to round 40.
    var urg = 1 + st.ply / TUNE.urgDiv;
    score += (TUNE.pressBySide ? TUNE.pressBySide[rootSide] : TUNE.press) * urg * (pressure(st, side) - pressure(st, 1 - side));
    var fE = SG.findFlagship(st, 1 - side), fM = SG.findFlagship(st, side), hitE = 0, hitM = 0;
    for (var k = 0; k < mine.length; k++) if (mine[k].to === fE) hitE++;
    for (k = 0; k < theirs.length; k++) if (theirs[k].to === fM) hitM++;
    score += urg * (TUNE.hit * Math.min(2, hitE) - TUNE.hitM * Math.min(2, hitM));
    return score;
  }

  function pressure(st, side) {   // sum over side's attackers of closeness (Chebyshev) to the enemy Flagship
    var f = SG.findFlagship(st, 1 - side); if (f < 0) return 0; var fr = SG.rc(f), v = 0;
    for (var i = 0; i < 36; i++) { var p = st.board[i]; if (!p || p.s !== side || p.t === 'F') continue; var q = SG.rc(i), d = Math.max(Math.abs(q[0] - fr[0]), Math.abs(q[1] - fr[1]));
      v += Math.max(0, 4 - d) * (p.t === 'L' ? .06 : .11); }
    return v; }
  function negamax(st, depth, alpha, beta) {
    if (depth === 0 || st.winner !== null) return evaluate(st, st.turn);
    var moves = SG.legalMoves(st);
    moves.sort(function (a, b) { return (b.cap ? SG.VALUE[b.cap.t] : 0) - (a.cap ? SG.VALUE[a.cap.t] : 0); });
    var best = -Infinity;
    for (var k = 0; k < moves.length; k++) {
      var ch = SG.applyMove(st, moves[k]), v = ch.turn === st.turn ? negamax(ch, depth - 1, alpha, beta) : -negamax(ch, depth - 1, -beta, -alpha);   // a skipped turn (stranded side) keeps the same mover
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  var rootSide = 0;
  function searchMove(st, depth) { rootSide = st.turn;
    var moves = SG.legalMoves(st), best = [], bestV = -Infinity;
    for (var k = 0; k < moves.length; k++) {
      var ch = SG.applyMove(st, moves[k]), v = ch.turn === st.turn ? negamax(ch, depth - 1, -Infinity, Infinity) : -negamax(ch, depth - 1, -Infinity, Infinity);
      var mine = st.lastBy && st.lastBy[st.turn];   // undoing our own last move (e.g. a Lancer shuffling e6<->f6) needs a real reason
      if (mine && !moves[k].cap && moves[k].from === mine.to && moves[k].to === mine.from) v -= 0.3;
      if (v > bestV + 1e-9) { bestV = v; best = [moves[k]]; } else if (Math.abs(v - bestV) < 1e-9) best.push(moves[k]);
    }
    return best.length ? pick(best) : null;
  }

  function greedyMove(st, cfg) {
    var me = st.turn, moves = SG.legalMoves(st);
    if (!moves.length) return null;
    // 1. Always take the enemy Flagship if possible.
    for (var k = 0; k < moves.length; k++) if (moves[k].cap && moves[k].cap.t === 'F') return moves[k];
    // 2. If our Flagship is under fire, usually try to get it out of danger.
    if (SG.flagshipThreatened(st, me) && Math.random() > cfg.blunder / 2) {
      var safe = moves.filter(function (m) { return !SG.flagshipThreatened(SG.applyMove(st, m), me); });
      if (safe.length) {
        var safeCaps = safe.filter(function (m) { return m.cap; });
        return pick(safeCaps.length ? safeCaps : safe);
      }
    }
    // 3. Prefer captures (most valuable first), unless we "blunder".
    var caps = moves.filter(function (m) { return m.cap; });
    if (caps.length && Math.random() > cfg.blunder) {
      var top = Math.max.apply(null, caps.map(function (m) { return SG.VALUE[m.cap.t]; }));
      return pick(caps.filter(function (m) { return SG.VALUE[m.cap.t] === top; }));
    }
    // 4. Otherwise a random move, mildly avoiding ones that hand over our Flagship.
    var ok = moves.filter(function (m) { return !SG.flagshipThreatened(SG.applyMove(st, m), me); });
    return pick(ok.length && Math.random() > cfg.blunder ? ok : moves);
  }

  function chooseMove(st, level) {
    var cfg = LEVELS[level] || LEVELS.easy;
    if (cfg.kind !== 'search') return greedyMove(st, cfg);
    var d = (cfg.bySide && cfg.bySide[st.turn]) || cfg.depth, fl = Math.floor(d);   // fractional depth: one ply deeper on that share of moves
    return searchMove(st, fl + (Math.random() < d - fl ? 1 : 0));
  }

  // Never throws, never returns null while a legal move exists: falls back to a random legal move.
  function safeChooseMove(st, level) {
    var m = null;
    try { m = api.chooseMove(st, level); } catch (e) { if (typeof console !== 'undefined') console.error('AI error', e); }
    var legal = SG.legalMoves(st);
    if (m && legal.some(function (x) { return x.from === m.from && x.to === m.to && x.kind === m.kind; })) return m;
    return legal.length ? pick(legal) : null;
  }

  // Fleet pick (blind: the AI never sees the player's choice). Easy picks at random; Medium leans to balanced fleets;
  // Hard plays the fleet that did best in the fairness self-play (test/sims.js).
  var FLEET_PREF = { medium: ['2L2D2S', '1L3D2S', '3L1D2S', '2L1D3S', '1L2D3S'], hard: ['2L2D2S', '1L3D2S', '3L1D2S'] };
  function pickFleet(level) { var all = SG.allFleets(); if (level === 'easy') return pick(all);
    var pref = FLEET_PREF[level] || FLEET_PREF.medium, f = all.filter(function (x) { return pref.indexOf(SG.fleetKey(x)) >= 0; });
    return Object.assign({}, pick(f.length ? f : all)); }
  var api = { pickFleet: pickFleet, chooseMove: chooseMove, safeChooseMove: safeChooseMove, evaluate: evaluate, LEVELS: LEVELS, TUNE: TUNE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SGAI = api;
})(typeof self !== 'undefined' ? self : this);
