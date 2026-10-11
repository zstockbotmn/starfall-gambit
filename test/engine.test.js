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

// --- Nebula schedule: alternating pulse plies, top-to-bottom mirror, 4 cells in rows 1..4 (0-based), no overlap with previous
assert.deepEqual([1,2,3,4,5,6].map(SG.pulsePly), [6,13,18,25,30,37]);
for (let seed = 1; seed <= 300; seed++) {
  st = SG.newGame(seed);
  let pulses = 0, nextMover = [];
  while (st.winner === null && st.ply < SG.MAX_PLY) {
    const before = st.nebula;
    st = SG.applyMove(st, AI.chooseMove(st, 'easy'));
    if (st.winner !== null) break;
    if (st.pulsed) {
      pulses++;
      assert.equal(st.ply, SG.pulsePly(pulses), 'pulse timing');
      nextMover.push(st.turn);
      assert.equal(st.nebula.length, 4);
      for (const c of st.nebula) assert.ok(!before.includes(c), 'new nebula never overlaps the previous one');
    }
    for (const c of st.nebula) { assert.ok(c >= 6 && c < 30, 'middle rows only'); assert.ok(st.nebula.includes(SG.mirrorCell(c)), 'mirrored top-to-bottom'); }
    for (const c of st.nextNebula) assert.ok(!st.nebula.includes(c), 'forecast never overlaps current nebula');
  }
  for (let k = 1; k < nextMover.length; k++) assert.notEqual(nextMover[k], nextMover[k - 1], 'side reacting first alternates');
}
// Setup uses the same top-to-bottom mirror symmetry as the nebula
st = SG.newGame(3);
for (let i = 0; i < 36; i++) { const a = st.board[i], b = st.board[SG.mirrorCell(i)];
  assert.equal(!!a, !!b); if (a) { assert.equal(a.t, b.t); assert.notEqual(a.s, b.s); } }
// Display round: during play = current round; after game over = round of the final move
assert.equal(SG.displayRound({ ply: 0, winner: null }), 1);
assert.equal(SG.displayRound({ ply: 45, winner: null }), 23);
assert.equal(SG.displayRound({ ply: 46, winner: 1 }), 23, 'Red wins on its move of round 23');
assert.equal(SG.displayRound({ ply: 45, winner: 0 }), 23, 'Blue wins on its move of round 23');
// Lancer threat map: own ships block, ignore-square treated as empty, shields not threatened
g = empty();
g.board[SG.idx(0,0)] = {t:'L',s:1}; g.board[SG.idx(2,0)] = {t:'D',s:0}; g.board[SG.idx(0,2)] = {t:'S',s:0};
let th = SG.lancerThreats(g, 1, -1);
assert.ok(th.includes(SG.idx(1,0)) && th.includes(SG.idx(2,0)) && !th.includes(SG.idx(3,0)), 'stops at first ship');
assert.ok(th.includes(SG.idx(0,1)) && !th.includes(SG.idx(0,2)), 'shield not threatened & blocks');
th = SG.lancerThreats(g, 1, SG.idx(2,0));
assert.ok(th.includes(SG.idx(3,0)) && !th.includes(SG.idx(4,0)), 'moving ship unblocks the line, range 3');
// safeChooseMove: falls back when chooseMove throws or returns null / illegal
st = SG.newGame(9);
const realChoose = AI.chooseMove;
const realErr = console.error; console.error = () => {};
AI.chooseMove = () => { throw new Error('boom'); };
assert.ok(AI.safeChooseMove(st, 'easy'), 'fallback on throw');
AI.chooseMove = () => null;
assert.ok(AI.safeChooseMove(st, 'easy'), 'fallback on null');
AI.chooseMove = () => ({ from: 0, to: 35, kind: 'move' });
const fb = AI.safeChooseMove(st, 'easy');
assert.ok(SG.legalMoves(st).some(m => m.from === fb.from && m.to === fb.to), 'fallback on illegal');
AI.chooseMove = realChoose; console.error = realErr;
// Stranded: a side with no legal move loses (Red moves, leaving Blue with nothing: Flagship boxed in, Shields jammed)
g = empty(); g.turn = 1;
g.board[SG.idx(5,0)] = {t:'F',s:0}; g.board[SG.idx(4,0)] = {t:'S',s:0}; g.board[SG.idx(4,1)] = {t:'S',s:0};
g.board[SG.idx(0,5)] = {t:'F',s:1}; g.board[SG.idx(0,4)] = {t:'L',s:1};
g.nebula = [SG.idx(5,1), SG.idx(4,0), SG.idx(4,1), SG.idx(3,3)];
assert.equal(SG.legalMoves(g, 0).length, 0, 'blue has no legal move');
const strandRes = SG.applyMove(g, { from: SG.idx(0,5), to: SG.idx(1,5), kind: 'move', cap: null });
assert.equal(strandRes.winner, 1, 'stranded side loses');
assert.equal(strandRes.reason, 'stranded');
// Danger stripes include a Red-held capture square covered by a Red Lancer behind it:
// Blue Drone e1 can take Red Drone d3; Red Lancer on d6 covers d3 -> d3 striped.
g = empty();
const sq = s => SG.idx(6 - +s[1], 'abcdef'.indexOf(s[0]));
g.board[sq('e1')] = {t:'D',s:0}; g.board[sq('d3')] = {t:'D',s:1}; g.board[sq('d6')] = {t:'L',s:1};
assert.ok(SG.pieceMoves(g, sq('e1')).some(m => m.to === sq('d3') && m.cap), 'drone can capture d3');
th = SG.lancerThreats(g, 1, sq('e1'));
assert.ok(th.includes(sq('d3')), 'd3 striped (capture square in Lancer line)');
assert.ok(th.includes(sq('d5')) && th.includes(sq('d4')) && !th.includes(sq('d2')), 'line stops at the Red ship');
g.board[sq('d3')] = {t:'S',s:1};
assert.ok(SG.lancerThreats(g, 1, -1).includes(sq('d3')), 'Red Shield square also striped (capturing it puts you in line)');

// --- M1.3 markers: move / capture / lane per piece type
const same = (a, b, msg) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y), msg);
const S = a => a.split(' ').map(sq);
// Flagship c3: 8 neighbours; own Shield d3 blocks, Red Drone c4 capturable
g = empty(); g.board[sq('c3')] = {t:'F',s:0}; g.board[sq('d3')] = {t:'S',s:0}; g.board[sq('c4')] = {t:'D',s:1}; g.board[sq('f6')] = {t:'F',s:1};
let mk = SG.pieceMarkers(g, sq('c3'));
same(mk.moves, S('b2 c2 d2 b3 b4 d4'), 'flagship moves'); same(mk.caps, S('c4'), 'flagship caps'); same(mk.lanes, [], 'no lanes');
// Drone b1: jumps over nebula c2/b2? lands not on nebula a3; captures c3
g = empty(); g.board[sq('b1')] = {t:'D',s:0}; g.board[sq('c3')] = {t:'L',s:1}; g.nebula = S('a3 b2');
mk = SG.pieceMarkers(g, sq('b1'));
same(mk.moves, S('d2'), 'drone moves (a3 is nebula, jumps over b2)'); same(mk.caps, S('c3'), 'drone caps');
// Shield c3: orthogonal only; captures Red Lancer c4, can't step on own d3
g = empty(); g.board[sq('c3')] = {t:'S',s:0}; g.board[sq('c4')] = {t:'L',s:1}; g.board[sq('d3')] = {t:'D',s:0};
mk = SG.pieceMarkers(g, sq('c3'));
same(mk.moves, S('c2 b3'), 'shield moves'); same(mk.caps, S('c4'), 'shield caps');
// Lancer c3: lanes up to 3, stop at ships & nebula; shot target = cap; Red Shield blocks w/o cap; moves are 8 empty neighbours
g = empty(); g.board[sq('c3')] = {t:'L',s:0};
g.board[sq('c5')] = {t:'D',s:1};       // up: c4 lane, c5 target
g.board[sq('e3')] = {t:'S',s:1};       // right: d3 lane, e3 shield (blocked, not capture)
g.nebula = S('b3');                    // left: blocked immediately by nebula
g.board[sq('c1')] = {t:'F',s:0};       // down: c2 lane, c1 own ship blocks
mk = SG.pieceMarkers(g, sq('c3'));
same(mk.lanes, S('c4 d3 c2'), 'lancer lanes'); same(mk.caps, S('c5'), 'lancer shot target');
same(mk.moves, S('b2 c2 d2 d3 b4 c4 d4'), 'lancer moves (b3 nebula)');
// long lane full range 3, stops at board edge
g = empty(); g.board[sq('a1')] = {t:'L',s:0};
same(SG.pieceMarkers(g, sq('a1')).lanes, S('a2 a3 a4 b1 c1 d1'), 'range 3 lanes');
// jammed ship has no markers
g.nebula = S('a1'); mk = SG.pieceMarkers(g, sq('a1')); assert.equal(mk.moves.length + mk.caps.length + mk.lanes.length, 0);

// --- M1.3 danger: only real threats to the selected ship
function base() { const x = empty(); x.board[sq('a1')] = {t:'F',s:0}; x.board[sq('f6')] = {t:'F',s:1}; x.turn = 0; x.ply = 0; x.nextPulse = 99; return x; }
g = base(); g.board[sq('e1')] = {t:'D',s:0}; g.board[sq('d3')] = {t:'D',s:1}; g.board[sq('d6')] = {t:'L',s:1};
let dz = SG.dangerSquares(g, sq('e1'));
assert.ok(dz.includes(sq('d3')), 'capture square covered by Lancer behind it is danger');
assert.ok(!dz.includes(sq('f3')), 'f3 not covered');
assert.ok(!dz.includes(sq('d6')) && !dz.includes(sq('d5')), 'squares the Drone cannot reach are never marked');
dz.forEach(d => assert.ok(SG.pieceMoves(g, sq('e1')).some(m => m.to === d) || d === sq('e1'), 'danger only on legal destinations/current square'));
// Shield: immune to shots -> Lancer line is not danger; but a Red Drone threat is
g = base(); g.board[sq('c2')] = {t:'S',s:0}; g.board[sq('c6')] = {t:'L',s:1};
assert.ok(!SG.dangerSquares(g, sq('c2')).includes(sq('c3')), 'shield safe from Lancer');
g.board[sq('a5')] = {t:'D',s:1};       // Drone a5 attacks b3 and c4
assert.ok(SG.dangerSquares(g, sq('c2')).includes(sq('b2')) === false, 'b2 not attacked');
g.board[sq('c2')] = null; g.board[sq('b2')] = {t:'S',s:0};
assert.ok(SG.dangerSquares(g, sq('b2')).includes(sq('b3')), 'shield moving into Drone reach is danger');
// current square under attack is marked
g = base(); g.board[sq('c2')] = {t:'D',s:0}; g.board[sq('c5')] = {t:'L',s:1};
assert.ok(SG.dangerSquares(g, sq('c2')).includes(sq('c2')), 'currently attacked square marked');
// winning capture is never danger
g = base(); g.board[sq('e4')] = {t:'D',s:0}; g.board[sq('f6')] = {t:'F',s:1}; g.board[sq('f3')] = {t:'L',s:1};
assert.ok(!SG.dangerSquares(g, sq('e4')).includes(sq('f6')), 'flagship capture not danger');

// --- M1.3 incoming nebula: a shift triggered by Blue's move is used for stripes
// (1) destination becomes nebula -> ship jammed & unreachable -> not danger
g = base(); g.board[sq('c1')] = {t:'D',s:0}; g.board[sq('b6')] = {t:'L',s:1};
assert.ok(SG.dangerSquares(g, sq('c1')).includes(sq('b3')), 'b3 covered by Lancer b6 (no shift)');
g.ply = 0; g.nextPulse = 1; g.nextNebula = S('b3 b4 e3 e4');
assert.ok(!SG.dangerSquares(g, sq('c1')).includes(sq('b3')), 'b3 becomes nebula on the shift -> safe');
// (2) current nebula blocks a lane but clears on the shift -> danger
g = base(); g.board[sq('c1')] = {t:'D',s:0}; g.board[sq('b6')] = {t:'L',s:1};
g.nebula = S('b4 b5 e2 e3'); g.nextNebula = S('c4 c5 d2 d3');
g.nextPulse = 99; assert.ok(!SG.dangerSquares(g, sq('c1')).includes(sq('b3')), 'lane blocked by current nebula');
g.nextPulse = 1;  assert.ok(SG.dangerSquares(g, sq('c1')).includes(sq('b3')), 'nebula clears on shift -> danger');

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
    const m = AI.safeChooseMove(s, s.turn === 0 ? levelB : levelR);
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
