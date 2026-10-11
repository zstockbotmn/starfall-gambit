# Starfall Gambit — Rules

**Goal:** destroy the enemy **Flagship**.

The board is **6×6**: columns a–f, rows 1–6. You are **Blue** (bottom, rows 1–2) and you move first. The computer is **Red** (top, rows 5–6).

On your turn, do exactly one thing: **move one ship** or **fire one Lancer**.
Tap a ship to see its options (see **Board markers** below), then tap a marked square to move, capture or fire.

## Board markers
When you tap one of your ships, its options appear. Each marker has its own shape, so they're easy to tell apart even if you can't distinguish the colours:

| Marker | Shape | Meaning |
|---|---|---|
| **Move** | green dot | The ship can move to this empty square. |
| **Fire lane** | amber plus | A Lancer's line of fire: up to 3 squares straight, stopping at the first ship or nebula. |
| **Capture** | red corner brackets | The ship can capture here, by moving onto the enemy or (for a Lancer) by firing. |
| **Flagship warning** | yellow ! badge | Making this move would leave your own Flagship open to capture. It's a warning only; you can still do it. |
| **Danger** | red hatching | If your selected ship moves here, Red could capture it on the next turn. This already takes into account a nebula shift your move would trigger. Hatching under the ship itself means it's under attack right now. |

**Reading enemy threats:** tap a Red ship, or press and hold any Red ship, to see the same markers for it (its moves, fire lanes and captures). Tap anywhere else to close. The view also closes when the next move is made. You can select your own ship while Red is thinking, and your selection stays after Red moves.

## Your fleet (7 ships each)

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
