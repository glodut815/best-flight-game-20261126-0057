// Flight physics and mission state: one small prop plane, a simple but
// honest model — throttle, lift, stall, banked turns, flaps, fuel, damage,
// ground contact, and the three missions' win/lose conditions.

import { CONFIG } from './config.js';

const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

// Heading in degrees, 0 = north, clockwise. Forward vector in world (x, z).
export function headingVector(headingDeg) {
  const h = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(h), z: -Math.cos(h) };
}

export function headingFromVector(x, z) {
  return (Math.atan2(x, -z) * 180) / Math.PI;
}

// Fresh flight state for a mission. `island` supplies terrain queries.
export function newFlight(island, missionId) {
  const rw = CONFIG.runway;
  const fwd = headingVector(rw.heading);
  // Start parked on the runway, nose down the strip.
  const flight = {
    missionId,
    phase: 'flying', // flying | landed | crashed | complete | outoffuel
    x: rw.x - fwd.x * (rw.length / 2 - 40),
    z: rw.z - fwd.z * (rw.length / 2 - 40),
    y: island.heightAt(rw.x, rw.z),
    heading: rw.heading,
    pitch: 0, // degrees, + = nose up
    roll: 0, // degrees, + = right wing down
    speed: 0, // m/s
    throttle: 0,
    flaps: false,
    fuel: CONFIG.plane.startFuel,
    damage: 0,
    score: 0,
    time: 0,
    timeLeft: CONFIG.missions.find((m) => m.id === missionId).timeLimit,
    ringsPassed: 0,
    nextRing: 0,
    beaconReached: false,
    volcanoRounded: false,
    message: '',
    messageTimer: 0,
    touchdownQuality: null, // 'soft' | 'ok' | 'hard' | null
    verticalSpeed: 0,
    groundSpeed: 0,
    landedOnRunway: false,
    stormHits: 0,
    _stormCooldown: 0,
    _takeoffDone: false,
  };
  return flight;
}

// One simulation step. `input` is the held-keys object from input.js,
// `dt` seconds, `island` the terrain, `audio` optional sound hooks.
// Returns an object of events that happened this step (for sounds/toasts).
export function stepFlight(flight, input, dt, island) {
  const P = CONFIG.plane;
  const events = [];
  if (flight.phase !== 'flying') return events;
  flight.time += dt;
  flight.timeLeft -= dt;
  if (flight.timeLeft <= 0) {
    flight.timeLeft = 0;
    if (flight.missionId === 'rings' || flight.missionId === 'storm') {
      endFlight(flight, 'complete', 'Time up — sortie over.');
      events.push('timeout');
      return events;
    }
  }
  if (flight.messageTimer > 0) flight.messageTimer -= dt;

  // --- Controls -----------------------------------------------------------
  const onGround = flight.y <= island.heightAt(flight.x, flight.z) + 0.05;
  if (input.throttleUp) flight.throttle = clamp(flight.throttle + dt * 0.7, 0, 1);
  if (input.throttleDown) flight.throttle = clamp(flight.throttle - dt * 0.7, 0, 1);
  if (input.flapsToggle) {
    flight.flaps = !flight.flaps;
    input.flapsToggle = false;
    events.push(flight.flaps ? 'flapsdown' : 'flapsup');
  }

  const stall = flight.speed < P.stallSpeed;
  const authority = onGround ? 0.25 : clamp(flight.speed / P.cruiseSpeed, 0.3, 1) * (stall ? 0.45 : 1);

  // Pitch: ArrowUp = nose down (stick forward), ArrowDown = nose up.
  let pitchInput = 0;
  if (input.pitchUp) pitchInput += 1;
  if (input.pitchDown) pitchInput -= 1;
  const pitchTarget = pitchInput * (flight.flaps ? 16 : 22);
  flight.pitch += (pitchTarget - flight.pitch) * clamp(dt * 3.2 * authority, 0, 1);
  if (stall && !onGround) flight.pitch -= dt * 6; // nose drops in a stall

  // Roll: arrows or A/D. A banked turn yaws the heading.
  let rollInput = 0;
  if (input.rollRight) rollInput += 1;
  if (input.rollLeft) rollInput -= 1;
  const rollTarget = rollInput * 48;
  flight.roll += (rollTarget - flight.roll) * clamp(dt * 3.6 * authority, 0, 1);
  const turnRate = P.turnRate * Math.sin((flight.roll * Math.PI) / 180) * clamp(flight.speed / P.cruiseSpeed, 0.2, 1.2);
  flight.heading = (flight.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

  // --- Speed, lift and altitude ------------------------------------------
  const flapDrag = flight.flaps ? 0.5 : 0;
  const targetSpeed = flight.throttle * P.maxSpeed;
  flight.speed += (targetSpeed - flight.speed) * clamp(dt * (0.35 + flight.throttle * 0.4), 0, 1);
  flight.speed -= flight.speed * (P.drag + flapDrag) * dt * 0.12;
  if (flight.speed < 0) flight.speed = 0;

  const fwd = headingVector(flight.heading);
  const pitchRad = (flight.pitch * Math.PI) / 180;
  const liftFactor = clamp(flight.speed / P.stallSpeed, 0, 1.4);
  let climb = Math.sin(pitchRad) * flight.speed * liftFactor;
  if (flight.flaps && flight.speed > 18) climb += 1.5;
  if (stall && !onGround) climb -= P.sinkRate * 0.6;
  if (flight.throttle < 0.05 && flight.speed < P.stallSpeed && !onGround) climb -= 2;
  flight.verticalSpeed = climb;
  flight.y += climb * dt;
  flight.x += fwd.x * flight.speed * Math.cos(pitchRad) * dt;
  flight.z += fwd.z * flight.speed * Math.cos(pitchRad) * dt;
  flight.groundSpeed = flight.speed * Math.cos(pitchRad);

  // Take-off: once the wheels leave the ground the sortie has begun.
  if (!flight._takeoffDone && !onGround && flight.y > island.heightAt(flight.x, flight.z) + 2) {
    flight._takeoffDone = true;
  }

  // --- Fuel ----------------------------------------------------------------
  const burn = (flight.throttle * P.fuelBurn + P.fuelBurnIdle) * dt;
  flight.fuel = Math.max(0, flight.fuel - burn);
  if (flight.fuel <= 0 && flight.throttle > 0) {
    flight.throttle = 0;
    events.push('fuelout');
    flight.message = 'FUEL EMPTY — gliding!';
    flight.messageTimer = 3;
  }

  // --- Ground contact ------------------------------------------------------
  const ground = island.heightAt(flight.x, flight.z);
  if (flight.y <= ground) {
    flight.y = ground;
    const vs = -flight.verticalSpeed;
    const onStrip = island.onRunway(flight.x, flight.z);
    const gentle = vs < 3.2 && Math.abs(flight.roll) < 12 && flight.groundSpeed < 55;
    if (flight.speed > 8) {
      // Touchdown while still moving: landing or crash.
      if (onStrip && gentle) {
        flight.phase = 'landed';
        flight.touchdownQuality = vs < 1.6 ? 'soft' : 'ok';
        flight.landedOnRunway = true;
        const bonus = flight.touchdownQuality === 'soft' ? CONFIG.score.landingSoft : CONFIG.score.landingOk;
        if (flight.missionId === 'landing' && flight.volcanoRounded) {
          flight.score += bonus;
          events.push('landed');
        } else if (flight.missionId === 'landing') {
          events.push('landed');
        } else {
          flight.score += 100;
          events.push('landed');
        }
        flight.message = flight.touchdownQuality === 'soft' ? 'BUTTER-SMOOTH LANDING!' : 'Down safe on the runway.';
        flight.messageTimer = 4;
      } else if (onStrip && vs < 6 && flight.groundSpeed < 70) {
        // Hard but survivable runway arrival: bounce, take damage.
        flight.damage = clamp(flight.damage + 25, 0, 100);
        flight.y = ground + 1.5;
        flight.pitch = 6;
        flight.speed *= 0.6;
        flight.touchdownQuality = 'hard';
        flight.message = 'HARD TOUCHDOWN! Damage +25%';
        flight.messageTimer = 3;
        events.push('hardlanding');
        if (flight.damage >= 100) {
          endFlight(flight, 'crashed', 'The airframe gave up after that landing.');
          events.push('crash');
        }
      } else {
        endFlight(flight, 'crashed', onStrip ? 'Came in too hot — the runway ran out of mercy.' : 'Terra firma. Not the soft kind.');
        events.push('crash');
      }
    } else {
      // Rolling to a stop on the ground.
      flight.speed = Math.max(0, flight.speed - 18 * dt);
      if (flight.phase === 'flying' && onStrip && flight._takeoffDone && flight.missionId === 'landing' && flight.volcanoRounded) {
        flight.phase = 'landed';
        flight.touchdownQuality = 'ok';
        flight.score += CONFIG.score.landingOk;
        events.push('landed');
      }
    }
    if (flight.phase === 'flying' && onGround) {
      // Taxiing: keep the nose level.
      flight.pitch *= 0.9;
    }
  }

  // --- Water: the sea is not a runway --------------------------------------
  if (flight.phase === 'flying' && flight.y <= 0.2 && island.groundType(flight.x, flight.z) === 'sea') {
    endFlight(flight, 'crashed', 'Ditched in the sea.');
    events.push('crash');
    return events;
  }

  // --- Mission logic --------------------------------------------------------
  if (flight.phase === 'flying') {
    if (flight.missionId === 'rings') {
      const ring = island.rings[flight.nextRing];
      if (ring) {
        const d = Math.hypot(flight.x - ring.x, flight.z - ring.z, flight.y - ring.y);
        if (d < ring.radius + 6) {
          flight.ringsPassed++;
          flight.nextRing++;
          flight.score += CONFIG.score.ring;
          flight.message = `RING ${flight.ringsPassed} / ${island.rings.length}!`;
          flight.messageTimer = 2;
          events.push('ring');
          if (flight.nextRing >= island.rings.length) {
            const bonus = Math.max(0, Math.round((CONFIG.missions[0].par - flight.time) * CONFIG.score.ringTimeBonus));
            flight.score += bonus;
            endFlight(flight, 'complete', `All ${island.rings.length} rings! Time bonus +${bonus}.`);
            events.push('complete');
          }
        }
      }
    } else if (flight.missionId === 'landing') {
      const v = CONFIG.volcano;
      if (!flight.volcanoRounded && Math.hypot(flight.x - v.x, flight.z - v.z) < v.radius + 60 && flight.y > 120) {
        flight.volcanoRounded = true;
        flight.message = 'Volcano beacon rounded — now land on the runway!';
        flight.messageTimer = 3;
        events.push('beacon');
      }
    } else if (flight.missionId === 'storm') {
      flight._stormCooldown -= dt;
      const b = island.beacon;
      if (!flight.beaconReached && Math.hypot(flight.x - b.x, flight.z - b.z, flight.y - b.y) < b.radius + 8) {
        flight.beaconReached = true;
        flight.score += CONFIG.score.stormBeacon;
        endFlight(flight, 'complete', 'Beacon reached — through the storm!');
        events.push('complete');
      } else {
        for (const cell of island.stormCells) {
          const d = Math.hypot(flight.x - cell.x, flight.z - cell.z, (flight.y - cell.y) * 1.4);
          if (d < cell.radius && flight._stormCooldown <= 0) {
            flight._stormCooldown = 1.2;
            flight.stormHits++;
            flight.damage = clamp(flight.damage + 12, 0, 100);
            flight.score = Math.max(0, flight.score + CONFIG.score.stormCellHit);
            flight.message = 'STORM HIT! Damage +12%';
            flight.messageTimer = 2;
            events.push('stormhit');
            if (flight.damage >= 100) {
              endFlight(flight, 'crashed', 'The storm tore the plane apart.');
              events.push('crash');
            }
            break;
          }
        }
      }
    }
  }

  // World edge: turn the pilot back with a warning instead of a void.
  const dist = Math.hypot(flight.x, flight.z);
  if (dist > 1600) {
    const back = Math.atan2(-flight.x, flight.z);
    flight.heading = (headingFromVector(-flight.x, -flight.z) + 360) % 360;
    flight.message = 'Turn back — open sea ahead!';
    flight.messageTimer = 2;
  }
  return events;
}

function endFlight(flight, phase, message) {
  flight.phase = phase;
  flight.message = message;
  flight.messageTimer = 6;
  flight.speed = Math.max(0, flight.speed * 0.4);
}
