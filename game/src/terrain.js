// The island: height, ground type, runway, rings, storm cells, town and
// clouds. Everything is a pure function of the seed, so the same seed always
// builds the same island.

import { CONFIG } from './config.js';
import { makeNoise2D, mulberry32, scatterPoints } from './random.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

// Build the island for one seed. Returns an object with:
//   heightAt(x, z)   ground height in metres (0 = sea level)
//   groundType(x, z) 'sea' | 'sand' | 'grass' | 'field' | 'rock' | 'lava'
//   runway, rings, stormCells, townBlocks, clouds, beacon
export function buildIsland(seed) {
  const noise = makeNoise2D(seed);
  const rand = mulberry32(seed * 7919 + 13);
  const R = CONFIG.islandRadius;
  const vol = CONFIG.volcano;
  const rw = CONFIG.runway;

  // Runway frame: unit vectors along and across the strip.
  const rh = ((rw.heading * Math.PI) / 180);
  const rFwd = { x: Math.sin(rh), z: -Math.cos(rh) };
  const rSide = { x: Math.cos(rh), z: Math.sin(rh) };

  function runwayLocal(x, z) {
    const dx = x - rw.x;
    const dz = z - rw.z;
    return { along: dx * rFwd.x + dz * rFwd.z, across: dx * rSide.x + dz * rSide.z };
  }

  function onRunway(x, z) {
    const l = runwayLocal(x, z);
    return Math.abs(l.along) <= rw.length / 2 && Math.abs(l.across) <= rw.width / 2;
  }

  function rawHeight(x, z) {
    const d = Math.hypot(x, z);
    // Island body: a broad dome that falls to the sea at the rim.
    const body = Math.pow(clamp(1 - (d / R) * (d / R), 0, 1), 1.4) * 58;
    // Volcano cone, sitting on the body.
    const dv = Math.hypot(x - vol.x, z - vol.z);
    const cone = Math.pow(clamp(1 - dv / vol.radius, 0, 1), 1.6) * vol.height;
    // Rolling hills from value noise, fading near the shore.
    const hills = (noise(x / 260 + 5, z / 260 + 9) - 0.5) * 26 * smoothstep(R * 0.55, R * 0.2, d);
    let h = body + cone + hills;
    // Grade the ground around the runway down to the strip, so the strip
    // sits in a flat apron instead of a trench through the hills.
    const l = runwayLocal(x, z);
    if (Math.abs(l.along) < rw.length / 2 + 80) {
      const blend = smoothstep(100, 30, Math.abs(l.across));
      h = h * (1 - blend) + 4 * blend;
    }
    return h;
  }

  function heightAt(x, z) {
    if (onRunway(x, z)) return 4; // the strip is graded flat
    return Math.max(0, rawHeight(x, z));
  }

  function groundType(x, z) {
    if (onRunway(x, z)) return 'runway';
    const h = rawHeight(x, z);
    if (h <= 0.4) return 'sea';
    if (h < 3.2) return 'sand';
    const dv = Math.hypot(x - vol.x, z - vol.z);
    if (dv < vol.radius * 0.32) return 'lava';
    if (dv < vol.radius * 0.85) return 'rock';
    // Patchwork fields on the flat south-west farmland.
    const f = noise(x / 190 + 31, z / 190 + 17);
    if (f > 0.62 && h < 30) return 'field';
    if (f > 0.52 && h < 30) return 'field2';
    return 'grass';
  }

  // ---- Rings: a loop that starts at the runway, swings past the volcano
  // and comes back over the town. Centres are fixed per seed.
  const ringDefs = [
    { x: rw.x + rFwd.x * 320, z: rw.z + rFwd.z * 320, y: 70 },
    { x: 60, z: -80, y: 95 },
    { x: vol.x - 190, z: vol.z + 60, y: 150 },
    { x: vol.x + 60, z: vol.z - 230, y: 175 },
    { x: 620, z: -420, y: 120 },
    { x: 760, z: 180, y: 90 },
    { x: 300, z: 620, y: 80 },
    { x: rw.x + rFwd.x * 300, z: rw.z + rFwd.z * 300, y: 65 },
  ];
  const rings = ringDefs.map((r, i) => ({
    ...r,
    radius: 22,
    index: i,
    // Face the ring toward the previous ring so it reads as a gate.
    heading: 0,
  }));
  for (let i = 0; i < rings.length; i++) {
    const prev = rings[(i + rings.length - 1) % rings.length];
    const cur = rings[i];
    cur.heading = Math.atan2(cur.x - prev.x, -(cur.z - prev.z));
  }

  // ---- Storm cells for the storm mission: a front of dark clouds across
  // the north-east, with the beacon at the far side.
  const stormCells = [];
  {
    const srand = mulberry32(seed * 104729 + 7);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      stormCells.push({
        x: 250 + t * 620 + (srand() - 0.5) * 180,
        z: -620 + t * 260 + (srand() - 0.5) * 160,
        y: 90 + srand() * 60,
        radius: 55 + srand() * 45,
        phase: srand() * TAU,
      });
    }
  }
  const beacon = { x: 880, z: -260, y: 110, radius: 26 };

  // ---- Town: a grid of small blocks beside the runway.
  const townBlocks = [];
  {
    const trand = mulberry32(seed * 31 + 5);
    for (let gx = -3; gx <= 3; gx++) {
      for (let gz = -2; gz <= 2; gz++) {
        if (trand() < 0.22) continue;
        townBlocks.push({
          x: CONFIG.town.x + gx * 34 + (trand() - 0.5) * 8,
          z: CONFIG.town.z + gz * 34 + (trand() - 0.5) * 8,
          w: 16 + trand() * 10,
          d: 14 + trand() * 10,
          h: 6 + trand() * 14,
          hue: trand(),
        });
      }
    }
  }

  // ---- Clouds: soft drifters above the island.
  const clouds = scatterPoints(rand, 26, 0, 0, R * 0.95).map((p) => ({
    ...p,
    y: 190 + rand() * 90,
    r: 60 + rand() * 70,
  }));

  // ---- Trees: dots of green scattered on grass, kept off the runway.
  const trees = scatterPoints(rand, 320, 0, 0, R * 0.92)
    .filter((p) => groundType(p.x, p.z) === 'grass' || groundType(p.x, p.z) === 'field')
    .slice(0, 220);

  return {
    seed,
    heightAt,
    groundType,
    onRunway,
    runwayLocal,
    rings,
    stormCells,
    beacon,
    townBlocks,
    clouds,
    trees,
  };
}

// Colours for each ground type, with a little per-cell variation.
export const GROUND_COLOURS = {
  sea: '#1d5f8a',
  sand: '#e8d39a',
  grass: '#5da24a',
  field: '#c9a44e',
  field2: '#7fae54',
  rock: '#6e6258',
  lava: '#3a2a24',
  runway: '#3c3f45',
};

export function groundColour(type, variation) {
  const base = GROUND_COLOURS[type] || GROUND_COLOURS.grass;
  if (!variation) return base;
  const n = Math.round((variation - 0.5) * 22);
  const r = parseInt(base.slice(1, 3), 16) + n;
  const g = parseInt(base.slice(3, 5), 16) + n;
  const b = parseInt(base.slice(5, 7), 16) + n;
  const c = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
