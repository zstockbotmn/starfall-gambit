# Starfall Gambit — Rules

**Goal:** destroy the enemy **Flagship**.

The board is **6×6**: columns a–f, rows 1–6. You are **Blue** (bottom, rows 1–2) and you move first. The computer is **Red** (top, rows 5–6).

On your turn, do exactly one thing: **move one ship** or **fire one Lancer**.
Tap a ship to see its options (see **Board markers** below), then tap a marked square to move, capture or fire.

## Board markers
When you tap one of your ships, its options appear. Each marker has its own shape, so they're easy to tell apart even if you can't distinguish the colours:

| Marker | Shape | Meaning |
|---|---|---|
| **Move** | mint dot | The ship can move to this empty square. |
| **Fire lane** | amber plus | A Lancer's line of fire: up to 3 squares straight, stopping at the first ship or nebula. |
| **Capture** | white corner brackets (dark outline) | The ship can capture here, by moving onto the enemy or (for a Lancer) by firing. |
| **Flagship warning** | gold ! badge | Making this move would leave your currently safe Flagship open to capture. If your Flagship is already under attack, you get a single “Your Flagship is under attack!” warning instead. It's a warning only; you can still do it. |
| **Enemy move** | hollow ring | Shown when you inspect a Red ship: where it can move. |
| **Danger** | orange-red hatching | If your selected ship moves here, Red could capture it on the next turn. This already takes into account a nebula shift your move would trigger. Hatching under the ship itself means it's under attack right now. |

**Reading enemy threats:** tap a Red ship, or press and hold any Red ship, to see the same markers for it (its moves, fire lanes and captures). Tap anywhere else to close. The view also closes when the next move is made. You can select your own ship while Red is thinking. Your selection stays, and its markers (moves, danger stripes and ! warnings) appear once Red has moved. Tapping a destination while Red is thinking does nothing (you'll see “Wait for Red's move”), so tap it again after Red moves. A tap counts on the square where your finger went down, even if it drifts slightly; swipes and drags across the board do nothing.

## The fleets (7 ships each)
Blue (you) is a bright utopian fleet in white, gold and soft teal; Red is a neon cyberpunk fleet in magenta and cyan. Each ship type has its own silhouette on both sides:

- **Flagship:** the biggest ship, a winged hull with a ring around the bridge (gold halo for Blue, cyan hexagon for Red).
- **Drone:** an X-shaped frame with four pods (round for Blue, angular claws for Red).
- **Lancer:** a slim hull with a long barrel pointing forward (gold lance for Blue, twin cyan rails for Red).
- **Shield:** a wide, flat curved wall (smooth dome for Blue, chevron plate for Red).

Blue ships point up the board, Red ships point down.


| Ship | Count | Moves | Captures |
|---|---|---|---|
| **Flagship (F)** | 1 | 1 square in any direction | By moving onto an enemy. **If it's destroyed, you lose.** |
| **Drone (D)** | 2 | L-shaped jump like a chess knight. It can jump over ships **and over nebula**, but can't land on nebula. | By landing on an enemy |
| **Lancer (L)** | 2 | 1 square in any direction | **Only by firing.** It can't capture by moving. |
| **Shield (S)** | 2 | 1 square up, down, left or right | By moving onto an enemy. **Immune to Lancer shots.** |

**Starting setup:** each back row is Lancer, Drone, Shield, Flagship, Drone, Lancer (a–f). The second Shield starts one square in front of the Flagship. Red's setup is Blue's **mirrored top-to-bottom**, column for column.

### Lancer shots
- Instead of moving, a Lancer can fire **up, down, left or right**, up to **3 squares**. It doesn't move when it fires.
- The shot stops at the **first ship** in that line. If that ship is an enemy (not a Shield), it's destroyed.
- **Your own ships block your Lancer's shots.** So do Shields of either side, and nebula squares.

## The nebula
- About every **3 rounds** (one round = your move plus Red's move), the nebula **shifts**. The counter at the top shows how many moves are left, counting both sides' moves. The old nebula **fully clears**, and **4 new squares** become nebula.
- New nebula only appears in the **middle four rows (rows 2–5)**, never in the back rows. It never lands on any of the squares that just cleared.
- The pattern is **mirrored top-to-bottom**, just like the starting setup: a nebula square in row 2 has a twin in the same column in row 5, and row 3 pairs with row 4. Neither side is favored.
- Shifts **alternate** between happening right after Red's move (you react first) and right after your move (Red reacts first). They come after 6, 13, 18, 25, 30, 37… total moves.
- The squares about to become nebula **flicker during the last two moves before the shift**.
- No ship can move into a nebula square, and Lancer shots can't pass through one.
- A shift **can land on squares that already have ships**, and you're allowed to move onto a flickering square. A ship on a square when it becomes nebula is **jammed**: it can't move or fire, but nothing can reach it either. It's free again when the nebula shifts. Tapping a jammed ship shows how many moves are left until then.

## How the game ends
1. **Flagship destroyed:** the player who destroyed it wins.
2. **No legal move loses:** if it's your turn and none of your ships can move or fire (for example, they're all blocked or jammed by the nebula), you're **stranded** and you lose.
3. **Round limit:** after **40 rounds** (Red makes the last move before the count), the side with more fleet points left wins. Points are Lancer 3, Drone 3, Shield 2. **The Flagship isn't counted.** Equal points means a draw.

There's no "check" rule, so you're allowed to leave your Flagship in danger. A red flashing ring warns you when your Flagship is under fire.
