// Ember Isle — Island Hopper: bootstrap and frame loop.
// States: 'title' (pick a mission) -> 'flying' -> 'paused' | end screen.
// ?shot= stages one frozen frame for screenshots instead of playing.

import { CONFIG, DEFAULT_SEED } from './config.js';
import { buildIsland } from './terrain.js';
import { newFlight, stepFlight } from './physics.js';
import { renderScene } from './render.js';
import { drawHUD, drawTitle, drawPaused, drawEndScreen } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { parseShotParams, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const shotParams = parseShotParams(window.location.search);
const seed = shotParams.seed !== null ? shotParams.seed : DEFAULT_SEED;
const island = buildIsland(seed);

const input = createInput();
input.attach();
const audio = createAudio();

let screen = 'title'; // title | flying | paused | end
let selectedMission = 0;
let flight = newFlight(island, CONFIG.missions[selectedMission].id);
let lastTime = 0;
let elapsed = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function startMission(index) {
  selectedMission = index;
  flight = newFlight(island, CONFIG.missions[index].id);
  screen = 'flying';
  audio.ensure();
  audio.playEvent('click');
}

function restart() {
  flight = newFlight(island, CONFIG.missions[selectedMission].id);
  screen = 'flying';
}

function frame(now) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
  lastTime = now;
  elapsed += dt;

  const actions = input.consumeActions();
  if (actions.mute) audio.setMuted(!audio.isMuted());
  if (actions.mission >= 0) {
    if (screen === 'title' || screen === 'end') startMission(actions.mission);
    else selectedMission = actions.mission;
  }
  if (actions.pause && (screen === 'flying' || screen === 'paused')) {
    screen = screen === 'flying' ? 'paused' : 'flying';
  }
  if (actions.restart && screen !== 'title') restart();

  if (screen === 'title') {
    if (actions.confirm || actions.click) startMission(selectedMission);
    renderScene(ctx, w, h, flight, island, elapsed);
    drawTitle(ctx, w, h, selectedMission, elapsed);
  } else if (screen === 'paused') {
    renderScene(ctx, w, h, flight, island, elapsed);
    drawHUD(ctx, w, h, flight, island, CONFIG.missions[selectedMission]);
    drawPaused(ctx, w, h);
  } else if (screen === 'flying') {
    const events = stepFlight(flight, input.held, dt, island);
    for (const e of events) audio.playEvent(e);
    audio.update(flight);
    renderScene(ctx, w, h, flight, island, elapsed);
    drawHUD(ctx, w, h, flight, island, CONFIG.missions[selectedMission]);
    if (flight.phase !== 'flying') screen = 'end';
  } else {
    // end screen: keep the world behind it, frozen at the final moment.
    renderScene(ctx, w, h, flight, island, elapsed);
    drawHUD(ctx, w, h, flight, island, CONFIG.missions[selectedMission]);
    drawEndScreen(ctx, w, h, flight, CONFIG.missions[selectedMission]);
    if (actions.confirm || actions.click) restart();
  }

  requestAnimationFrame(frame);
}

// Shot mode: one deterministic frame, then stop. The page still loads the
// same way, so a screenshot is a real render of the game.
if (shotParams.shot) {
  const shotFlight = stageShot(shotParams.shot, island);
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderScene(ctx, w, h, shotFlight, island, 12.5);
  drawHUD(ctx, w, h, shotFlight, island, CONFIG.missions.find((m) => m.id === shotFlight.missionId));
  document.title = `Ember Isle — ${shotParams.shot}`;
} else {
  requestAnimationFrame(frame);
}
