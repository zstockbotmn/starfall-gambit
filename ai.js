/* Starfall Gambit — computer opponent. Levels share one interface: SGAI.chooseMove(state, level).
   Easy is implemented (Milestone 1). Medium/Hard plug into the same negamax search below (Milestone 2). */
(function (root) {
  'use strict';
  var SG = (typeof module !== 'undefined' && module.exports) ? require('./engine.js') : root.SG;

  var LEVELS = {
    easy:   { kind: 'greedy', blunder: 0.35 },   // grabs captures most of the time, otherwise wanders
    medium: { kind: 'search', depth: 2 },        // TODO Milestone 2: tune
    hard:   { kind: 'search', depth: 4 }         // TODO Milestone 2: tune + move ordering / time limit
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Static evaluation from the perspective of `side` (used by search levels; light use in easy).
  function evaluate(st, side) {
    if (st.winner !== null) return st.winner === side ? 10000 : st.winner === -1 ? 0 : -10000;
    var score = SG.material(st, side) - SG.material(st, 1 - side);
    // small mobility term
    score += 0.05 * (SG.legalMoves(st, side).length - SG.legalMoves(st, 1 - side).length);
    return score;
  }

  function negamax(st, depth, alpha, beta) {
    if (depth === 0 || st.winner !== null) return evaluate(st, st.turn);
    var moves = SG.legalMoves(st);
    moves.sort(function (a, b) { return (b.cap ? SG.VALUE[b.cap.t] : 0) - (a.cap ? SG.VALUE[a.cap.t] : 0); });
    var best = -Infinity;
    for (var k = 0; k < moves.length; k++) {
      var v = -negamax(SG.applyMove(st, moves[k]), depth - 1, -beta, -alpha);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }

  function searchMove(st, depth) {
    var moves = SG.legalMoves(st), best = [], bestV = -Infinity;
    for (var k = 0; k < moves.length; k++) {
      var v = -negamax(SG.applyMove(st, moves[k]), depth - 1, -Infinity, Infinity);
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
    return cfg.kind === 'search' ? searchMove(st, cfg.depth) : greedyMove(st, cfg);
  }

  // Never throws, never returns null while a legal move exists: falls back to a random legal move.
  function safeChooseMove(st, level) {
    var m = null;
    try { m = api.chooseMove(st, level); } catch (e) { if (typeof console !== 'undefined') console.error('AI error', e); }
    var legal = SG.legalMoves(st);
    if (m && legal.some(function (x) { return x.from === m.from && x.to === m.to && x.kind === m.kind; })) return m;
    return legal.length ? pick(legal) : null;
  }

  var api = { chooseMove: chooseMove, safeChooseMove: safeChooseMove, evaluate: evaluate, LEVELS: LEVELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SGAI = api;
})(typeof self !== 'undefined' ? self : this);
