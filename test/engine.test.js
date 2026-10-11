// Run: node test/engine.test.js   — rules sanity + many AI-vs-AI games.
const assert = require('assert');
const SG = require('../engine.js');
const AI = require('../ai.js');

// --- Setup sanity
let st = SG.newGame(42);
const count = (s, t) => st.board.filter(p => p && p.s === s && p.t === t).length;
for (const s of [0, 1]) { assert.equal(count(s,'F'),1); assert.equal(count(s,'D'),2); assert.equal(count(s,'L'),2); assert.equal(count(s,'S'),2); }
assert.ok(SG.legalMoves(st).length > 0, 'blue has opening moves');
assert.ok(SG.legalMoves(st).every(m => !m.cap), 'no captures on move 1');

// --- Unit checks on a hand-built board
function empty() { const g = SG.newGame(1); g.board = new Array(36).fill(null); g.nebula = []; return g; }
let g = empty();
g.board[SG.idx(5,0)] = {t:'F',s:0}; g.board[SG.idx(0,5)] = {t:'F',s:1};
g.board[SG.idx(3,0)] = {t:'L',s:0};
g.board[SG.idx(0,0)] = {t:'D',s:1};           // 3 away up the file -> shootable
g.board[SG.idx(3,4)] = {t:'D',s:1};           // 4 away -> out of range
let shots = SG.shotTargets(g, SG.idx(3,0), 0);
assert.deepEqual(shots, [SG.idx(0,0)], 'range 3 shot');
g.board[SG.idx(1,0)] = {t:'S',s:1};
assert.deepEqual(SG.shotTargets(g, SG.idx(3,0), 0), [], 'shield blocks & is immune');
g.board[SG.idx(1,0)] = null; g.nebula = [SG.idx(2,0)];
assert.deepEqual(SG.shotTargets(g, SG.idx(3,0), 0), [], 'nebula blocks shots');
g.nebula = [SG.idx(3,0)];
assert.equal(SG.pieceMoves(g, SG.idx(3,0)).length, 0, 'piece in nebula is jammed');
g.nebula = [];
// lancer cannot capture by moving
g.board[SG.idx(2,1)] = {t:'D',s:1};
assert.ok(!SG.pieceMoves(g, SG.idx(3,0)).some(m => m.kind==='move' && m.to===SG.idx(2,1)), 'lancer no melee capture');
// drone jumps
g = empty(); g.board[SG.idx(5,1)] = {t:'D',s:0}; g.board[SG.idx(4,1)] = {t:'S',s:0}; g.board[SG.idx(4,0)] = {t:'S',s:0};
assert.ok(SG.pieceMoves(g, SG.idx(5,1)).some(m => m.to===SG.idx(3,0)), 'drone jumps');
// flagship capture ends game
g = empty(); g.board[SG.idx(5,0)] = {t:'F',s:0}; g.board[SG.idx(2,0)] = {t:'L',s:0}; g.board[SG.idx(0,0)] = {t:'F',s:1};
const win = SG.legalMoves(g).find(m => m.cap && m.cap.t==='F');
assert.ok(win); assert.equal(SG.applyMove(g, win).winner, 0);

// --- Nebula schedule: pulses every 6 plies, symmetric, 4 cells in middle rows
st = SG.newGame(7);
let pulses = 0;
for (let i = 0; i < 30 && st.winner === null; i++) {
  const before = st.nebula;
  st = SG.applyMove(st, SG.legalMoves(st)[0]);
  if (st.pulsed) { pulses++; assert.equal(st.ply % 6, 0); assert.notEqual(st.nebula, before); }
  for (const c of st.nebula) { assert.ok(c >= 6 && c < 30); assert.ok(st.nebula.includes(35 - c), 'symmetric'); }
  assert.ok(st.nebula.length === 0 || st.nebula.length === 4);
}
assert.ok(pulses >= 1);

// --- Many AI-vs-AI games
function play(levelB, levelR, seed) {
  let s = SG.newGame(seed);
  while (s.winner === null) {
    const moves = SG.legalMoves(s);
    assert.ok(moves.length > 0, 'side to move has moves if game not over');
    for (const m of moves) {
      const pc = s.board[m.from];
      assert.ok(pc && pc.s === s.turn, 'moves only own pieces');
      assert.ok(!SG.isNebula(s, m.to), 'never into nebula');
      if (m.cap) assert.notEqual(m.cap.s, s.turn, 'never captures own piece');
      if (m.kind === 'shot') assert.notEqual(m.cap.t, 'S', 'shield never shot');
    }
    const m = AI.chooseMove(s, s.turn === 0 ? levelB : levelR);
    assert.ok(m, 'AI returned a move');
    s = SG.applyMove(s, m);
    assert.ok(s.ply <= SG.MAX_PLY, 'turn cap respected');
  }
  return s;
}
const N = +process.argv[2] || 2000;
const res = { blue: 0, red: 0, draw: 0, reasons: {}, plies: 0 };
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const s = play('easy', 'easy', i + 1);
  res[s.winner === 0 ? 'blue' : s.winner === 1 ? 'red' : 'draw']++;
  res.reasons[s.reason] = (res.reasons[s.reason] || 0) + 1;
  res.plies += s.ply;
}
console.log(`easy vs easy x${N}:`, JSON.stringify(res), 'avg plies', (res.plies / N).toFixed(1), `${Date.now() - t0}ms`);
// medium search vs easy: just check it works and is stronger
const r2 = { med: 0, easy: 0, draw: 0 };
for (let i = 0; i < 40; i++) {
  const medBlue = i % 2 === 0, s = play(medBlue ? 'medium' : 'easy', medBlue ? 'easy' : 'medium', 1000 + i);
  if (s.winner === -1) r2.draw++; else if ((s.winner === 0) === medBlue) r2.med++; else r2.easy++;
}
console.log('medium(search d2) vs easy x40:', JSON.stringify(r2));
console.log('ALL TESTS PASSED');
