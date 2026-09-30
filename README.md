# Level Surge

A troll platformer. Get to the door. The room will lie.

The G in **SURGE** is a skull. That is not a metaphor.

## Play

Open `index.html` in a browser, or from this folder:

```bash
python3 -m http.server 8765
```

Then go to [http://127.0.0.1:8765/](http://127.0.0.1:8765/).

## Controls

| Action | Keys |
| --- | --- |
| Move | Arrows or A / D |
| Jump | Space, Up, or W |
| Dash | Shift (Dimension 3 and later) |
| Retry room | R |
| Pause | Esc |
| Mute | Speaker button |

On a phone, on-screen buttons appear. Dash shows up once you reach Dimension 3.

## How a run works

You are a small red thing. The exit is a gold-and-red door. Touch it and the room is cleared.

That is the whole honest rule. Everything else is a delay.

Rooms watch what you do: walk far enough, jump too soon, stand still, sprint, touch a fake door. When a condition matches, a **trap** fires. The floor can open. Spikes can grow. A saw can arrive late. Controls can flip for a beat. Some tells are fake (dust, a glow that is not a laser). Some tells are real and still kill you.

Survive the traps, reach the real door, go to the next room. Clear every room in a dimension to unlock the next world.

Dying plays a roast, then respawns you in the same room. The death counter does not reset until you start a new run.

## Dimensions

There are **20 worlds**. Each one is bigger and meaner than the last.

| | Rooms | Traps per room |
| --- | --- | --- |
| Dimension 1 · NULLSCAPE | 16 | 10 |
| Dimension 2 · ASHWELL | 17 | 12 |
| Dimension 3 · FROSTBITE | 18 | 15 |
| … | 15 + dimension | +2 or +3 each world |
| Dimension 20 · LAST LIGHT | 35 | more |

Dimension 1 uses the 16 handmade rooms (TRUST ME through LAST LAUGH). Worlds 2–20 are generated from a seed, with a boss room at the end of each.

Clearing a dimension unlocks the next. WORLDS on the title screen is the map. Progress is saved in the browser (`level-surge-v3`).

## What the HUD is saying

- **LEVEL SURGE** — the game, with the skull G
- **D1 NULLSCAPE** — current dimension
- **1 / 16** — room in this world
- **TRUST ME** — room name
- **????** — trap count, which lies until traps fire
- **timer / deaths** — how long you have been suffering
- **SURGE xN** — combo of traps you survived in a short window
- **✦** — shards from coins that did not explode

After a full world clear you get a **SURGE RATING**. It is a large number. It is not a real score. It is the game being theatrical.

## Files

| File | Job |
| --- | --- |
| `index.html` | Screens, HUD, buttons |
| `css/style.css` | Title, HUD, overlays |
| `img/logo-g.svg` | The G with a skull in it |
| `js/levels.js` | 16 handmade rooms for Dimension 1 |
| `js/worlds.js` | 20 dimensions, scaling, generated rooms |
| `js/game.js` | Physics, traps, drawing, audio, save |
| `js/roast.js` | Death-screen insults |
| `js/validate.js` | Checks room counts and trap data |

## Map symbols

Rooms are ASCII grids. One character is one tile.

| Char | Meaning |
| --- | --- |
| `.` | Air |
| `#` | Solid floor / wall |
| `S` | Spawn |
| `E` | Real exit |
| `F` | Fake exit |
| `^` `v` | Spikes |
| `=` | Crumbles when you stand on it |
| `*` | Looks solid, is not |
| `i` | Invisible solid |
| `B` | Bounce pad |
| `o` | Saw |
| `C` | Coin (shard, or a bomb if the room says so) |
| `!` | Hidden teeth in the floor |

## Traps

A trap is `{ if: condition, do: [actions] }`. Optional `delay` waits before it hits. `quiet` traps do not count toward combo (fake dust, fake beams).

**Typical conditions:** walk past an X, jump, jump too early, stand still, land, touch the fake door, wait too long.

**Typical actions:** hole, spikes, saw, laser, reverse controls, move the door, push you, drop a brick, hide the door.

Handmade rooms in Dimension 1 are authored in `js/levels.js`. Later worlds roll the same action set with a seeded RNG so a given dimension always builds the same rooms.

To check the data:

```bash
node js/validate.js
```

## Audio

Sound is generated in the browser (no music files). Each dimension has its own BPM and root note. The track gets louder and denser as traps fire in a room. Mute from the HUD.
