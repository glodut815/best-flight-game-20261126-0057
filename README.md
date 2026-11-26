[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/glodut815/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/glodut815/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
Bounty: https://make.fun/bounty/best-flight-game-20261126-0057

# Ember Isle — Island Hopper

A 2D canvas flight game, built as plain static files — no library, no build
step, no network. Everything (island, art, sound) is original and generated
in code.

You are a bush pilot on Ember Isle, a volcanic island with one runway, a
fishing town, patchwork fields and a smoking volcano. Pick a mission and
earn your wings: thread 8 glowing rings in the **Ring Run**, circle the
volcano and put her down on the runway in **Island Hop**, or punch through
the storm front to the far beacon in **Storm Front**. Fuel burns, storm
cells hurt, and a stall at low altitude is a short story.

## What is in the game

- **A living island**: sea, beaches, fields, a volcano with drifting smoke,
  a town beside the runway, trees and drifting clouds — all laid out from a
  fixed seed, so the island is the same every time you play.
- **A chase view that never fights you**: the camera sits behind and above
  the plane and follows its heading, with a pseudo-3D projected terrain.
- **Real flying**: throttle, pitch and banked turns, lift and stall, flaps
  for slow flight, fuel burn and damage. Landings read as landings — a
  gentle touchdown on the strip, a hard bounce, or a crash.
- **Three missions with different goals**: rings against the clock, a
  round-the-volcano landing, and a storm dodge with a beacon at the far end.
- **HUD + instruments**: altitude, airspeed, heading compass tape,
  artificial horizon, vertical speed, fuel and throttle gauges, score,
  timer and the mission objective.
- **Sound**: WebAudio synthesis only — engine hum, wind, ring chimes,
  touchdown thuds and a mission-complete jingle. No audio files.

## Controls

| Key | Action |
| --- | --- |
| W / S (or Shift / Ctrl) | Throttle up / down |
| Arrow Up / Down | Pitch down / up |
| Arrow Left / Right (or A / D) | Roll and turn |
| F | Flaps up / down |
| P / Esc | Pause |
| M | Mute |
| R | Restart |
| 1 / 2 / 3 | Pick a mission |
| Enter / click | Start flying |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static file server and open `index.html`.

## Screenshots

`?shot=takeoff` shows the plane on the runway, throttle up;
`?shot=rings` shows the ring run mid-flight over the island;
`?shot=landing` shows the final approach, flaps down, runway ahead.

## Layout

- `game/index.html` — the page and canvas
- `game/src/main.js` — bootstrap and frame loop
- `game/src/config.js` — tuning, missions, scoring
- `game/src/terrain.js` — the seeded island: height, ground, rings, storm, town
- `game/src/physics.js` — flight model and mission state
- `game/src/render.js` — chase-view camera, terrain, plane, rings, storm
- `game/src/hud.js` — instruments, objective bar, title/pause/end screens
- `game/src/audio.js` — WebAudio synth sounds
- `game/src/input.js` — keyboard and mouse
- `game/src/random.js` — seeded RNG and value noise
- `game/src/shots.js` — `?shot=` staging for screenshots
- `main.ts` — the make.fun entry program (Node 22 stdlib only)

MIT licensed. An original game by @agenticgangster.
