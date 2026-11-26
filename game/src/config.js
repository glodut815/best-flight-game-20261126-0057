// Ember Isle — Island Hopper: every tunable number for the game lives here.
// The game is an original 2D canvas flight game: a small prop plane flying
// over a procedurally generated island (sea, beaches, fields, a volcano, a
// town and one runway), with three missions that each ask for different flying.

export const CONFIG = {
  // World: metres. The island is a disc of radius ISLAND_RADIUS around (0, 0).
  islandRadius: 1050,
  seaLevel: 0,
  // Runway: centre, heading (degrees, 0 = north) and size. Flat ground.
  runway: { x: -320, z: 260, heading: 90, length: 420, width: 34 },
  // Volcano: centre, cone radius and peak height.
  volcano: { x: 380, z: -330, radius: 240, height: 150 },
  // Town: centre and spread, beside the runway.
  town: { x: -320, z: 420, spread: 150 },
  // Plane: speeds in m/s, altitudes in metres, fuel in percent.
  plane: {
    maxSpeed: 95,
    cruiseSpeed: 55,
    stallSpeed: 26,
    maxThrottle: 1,
    accel: 14,
    drag: 0.35,
    climbRate: 16,
    sinkRate: 9,
    rollRate: 1.9,
    pitchRate: 0.9,
    turnRate: 0.55,
    fuelCapacity: 100,
    fuelBurn: 0.5, // percent per second at full throttle
    fuelBurnIdle: 0.08,
    startFuel: 100,
  },
  // Missions.
  missions: [
    {
      id: 'rings',
      name: 'Ring Run',
      short: 'RINGS',
      blurb: 'Thread all 8 glowing rings in order, as fast as you can.',
      ringCount: 8,
      timeLimit: 240,
      par: 150,
    },
    {
      id: 'landing',
      name: 'Island Hop',
      short: 'LAND',
      blurb: 'Take off, circle the volcano, and land back on the runway.',
      timeLimit: 300,
      par: 200,
    },
    {
      id: 'storm',
      name: 'Storm Front',
      short: 'STORM',
      blurb: 'Reach the far beacon through the storm. Clouds hurt — dodge them.',
      timeLimit: 240,
      par: 180,
    },
  ],
  // Scoring.
  score: {
    ring: 500,
    bonusRing: 750,
    ringTimeBonus: 8, // per second under par, at mission end
    landingSoft: 800,
    landingOk: 400,
    stormBeacon: 1200,
    stormCellHit: -150,
    crash: 0,
  },
  // Camera: chase view behind and above the plane.
  camera: { distance: 30, height: 10, lookAhead: 40, focal: 620 },
  // Rendering.
  render: {
    viewDistance: 1500,
    gridStep: 55,
    fogStart: 700,
    fogEnd: 1500,
  },
};

// Mission text shown on the title screen and in the HUD objective bar.
export const MISSION_INTRO = {
  rings: 'Fly through the rings in order — green is next, gold is done.',
  landing: 'Climb out, round the volcano beacon, then put her down on the runway.',
  storm: 'Storm cells ahead. One touch costs 150 points and 12% damage.',
};

// Fixed seeds: the island is the same every run unless ?seed= says otherwise.
export const DEFAULT_SEED = 7;
