// Screenshot staging: ?shot=<scene>&seed=<n> puts the game in one fixed,
// fully rendered frame — the same code path the player sees, frozen at a
// moment that shows the game at its best. No animation, no audio.
//
//   takeoff  — parked on the runway, throttle up, instruments lit
//   rings    — mid-flight, the next ring glowing ahead over the island
//   landing  — final approach, runway ahead, flaps down

import { CONFIG } from './config.js';
import { newFlight, headingVector } from './physics.js';

export function parseShotParams(search) {
  const params = new URLSearchParams(search || '');
  const shot = params.get('shot');
  const seedRaw = params.get('seed');
  const seed = seedRaw === null ? null : Number.parseInt(seedRaw, 10);
  return {
    shot: shot === 'takeoff' || shot === 'rings' || shot === 'landing' ? shot : null,
    seed: Number.isFinite(seed) ? seed : null,
  };
}

// Stage a flight for a shot scene and return it, already positioned.
export function stageShot(shot, island) {
  if (shot === 'takeoff') {
    const flight = newFlight(island, 'rings');
    flight.throttle = 0.85;
    flight.speed = 6;
    flight.groundSpeed = 6;
    flight.fuel = 96;
    flight.message = 'RING RUN — throttle up and go!';
    flight.messageTimer = 999;
    return flight;
  }
  if (shot === 'rings') {
    const flight = newFlight(island, 'rings');
    // Place the plane just before ring 2, heading straight for it.
    const ring = island.rings[1];
    const prev = island.rings[0];
    const dx = ring.x - prev.x;
    const dz = ring.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    // Sit a little to the side of the gate line, so the next ring reads
    // clearly beside the plane instead of hiding behind it.
    const sideX = -dz / len;
    const sideZ = dx / len;
    flight.x = ring.x - (dx / len) * 260 + sideX * 55;
    flight.z = ring.z - (dz / len) * 260 + sideZ * 55;
    flight.y = ring.y + 6;
    flight.heading = (Math.atan2(dx, -dz) * 180) / Math.PI;
    flight.pitch = 1;
    flight.roll = -6;
    flight.speed = 58;
    flight.groundSpeed = 58;
    flight.throttle = 0.72;
    flight.nextRing = 1;
    flight.ringsPassed = 1;
    flight.score = 500;
    flight.time = 42;
    flight.timeLeft = 198;
    flight.fuel = 88;
    flight.message = 'RING 2 / 8 — thread the cyan gate!';
    flight.messageTimer = 999;
    return flight;
  }
  // landing
  const flight = newFlight(island, 'landing');
  const rw = CONFIG.runway;
  const fwd = headingVector(rw.heading);
  // On final approach, 500 m out, descending toward the threshold — a
  // little to the side of the centreline, so the strip reads beside the plane.
  flight.x = rw.x - fwd.x * 520 - fwd.z * 55;
  flight.z = rw.z - fwd.z * 520 + fwd.x * 55;
  flight.y = 62;
  flight.heading = rw.heading;
  flight.pitch = -4;
  flight.roll = 2;
  flight.speed = 46;
  flight.throttle = 0.4;
  flight.flaps = true;
  flight.volcanoRounded = true;
  flight.time = 186;
  flight.timeLeft = 114;
  flight.fuel = 61;
  flight.score = 400;
  flight.verticalSpeed = -3.4;
  flight.groundSpeed = 45;
  flight.message = 'FINAL APPROACH — flaps down, hold her steady';
  flight.messageTimer = 999;
  return flight;
}
