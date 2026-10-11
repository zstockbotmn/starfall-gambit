# Starfall Gambit (Milestone 1 prototype)

Mobile-web, chess-like sci-fi strategy game on a 6×6 board, played against a computer opponent. Static HTML/CSS/JS with no build step.

- `engine.js`: pure rules engine (moves, Lancer shots, nebula schedule, win conditions). Works in the browser (`window.SG`) and in Node.
- `ai.js`: computer opponent behind `SGAI.chooseMove(state, level)`. `easy` is greedy and random-ish. `medium` and `hard` use negamax with alpha-beta and are stubbed for Milestone 2.
- `game.js`, `index.html`, `style.css`: touch UI for portrait iPhone.
- `RULES.md`: the plain-language rules (also shown in-game under **Rules**).
- `test/engine.test.js`: rules unit checks plus thousands of AI-vs-AI games. Run with `node test/engine.test.js [games]`.

Run locally with `python3 -m http.server`, then open http://localhost:8000.
