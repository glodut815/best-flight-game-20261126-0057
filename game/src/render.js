// The chase view: sky, sea, a projected island, runway, rings, storm cells,
// town, clouds and the plane itself — all drawn with plain canvas paths.
// A simple pinhole camera sits behind and above the plane and looks forward
// along its heading, so the view never fights the pilot.

import { CONFIG } from './config.js';
import { groundColour } from './terrain.js';

const TAU = Math.PI * 2;

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Mix a #rrggbb colour toward another by t in [0, 1].
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const r = Math.round(lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
  const g = Math.round(lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
  const bl = Math.round(lerp(pa & 255, pb & 255, t));
  return `rgb(${r},${g},${bl})`;
}

// Deterministic per-cell variation in [0, 1) from integer grid coords.
function cellHash(gx, gz) {
  let h = (gx * 374761393 + gz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Build the camera from the flight state. Returns position, basis vectors
// (right, up, forward), focal length and the horizon's screen y.
function buildCamera(flight, w, h) {
  const heading = (flight.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(heading), z: -Math.cos(heading) };
  const cam = CONFIG.camera;
  const px = flight.x - fwd.x * cam.distance;
  const pz = flight.z - fwd.z * cam.distance;
  const py = flight.y + cam.height;
  const tx = flight.x + fwd.x * cam.lookAhead;
  const tz = flight.z + fwd.z * cam.lookAhead;
  const ty = flight.y + 1.5;
  // Forward basis, normalised.
  let F = { x: tx - px, y: ty - py, z: tz - pz };
  const fl = Math.hypot(F.x, F.y, F.z) || 1;
  F = { x: F.x / fl, y: F.y / fl, z: F.z / fl };
  // Right = forward x world-up, normalised; up = right x forward.
  let R = { x: -F.z, y: 0, z: F.x };
  const rl = Math.hypot(R.x, R.z) || 1;
  R = { x: R.x / rl, y: 0, z: R.z / rl };
  const U = {
    x: R.y * F.z - R.z * F.y,
    y: R.z * F.x - R.x * F.z,
    z: R.x * F.y - R.y * F.x,
  };
  const focal = (h * 0.5) / Math.tan((62 * Math.PI) / 360);
  // Horizon: a point far ahead at eye level.
  const H = { x: F.x, y: 0, z: F.z };
  const hl = Math.hypot(H.x, H.z) || 1;
  H.x /= hl;
  H.z /= hl;
  const far = { x: px + H.x * 5000, y: py, z: pz + H.z * 5000 };
  const rel = { x: far.x - px, y: far.y - py, z: far.z - pz };
  const cz = rel.x * F.x + rel.y * F.y + rel.z * F.z;
  const cy = rel.x * U.x + rel.y * U.y + rel.z * U.z;
  const horizonY = h * 0.52 - (focal * cy) / cz;
  return { px, py, pz, F, R, U, focal, horizonY, cx: w / 2, cy: h * 0.52 };
}

// Project a world point to screen space. Returns null when behind the camera.
function project(cam, x, y, z) {
  const rx = x - cam.px;
  const ry = y - cam.py;
  const rz = z - cam.pz;
  const cz = rx * cam.F.x + ry * cam.F.y + rz * cam.F.z;
  if (cz < 2) return null;
  const cx = rx * cam.R.x + ry * cam.R.y + rz * cam.R.z;
  const cy = rx * cam.U.x + ry * cam.U.y + rz * cam.U.z;
  // Clamp so a quad that runs under the camera still paints the screen edge
  // instead of exploding to enormous coordinates.
  const clampCoord = (v) => Math.max(-4000, Math.min(4000, v));
  return { x: clampCoord(cam.cx + (cam.focal * cx) / cz), y: clampCoord(cam.cy - (cam.focal * cy) / cz), d: cz };
}

export function renderScene(ctx, w, h, flight, island, time) {
  const cam = buildCamera(flight, w, h);
  const fogColour = '#b8d4e8';
  const horizonY = clamp(cam.horizonY, -h * 0.2, h * 0.95);

  // ---- Sky ---------------------------------------------------------------
  const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
  sky.addColorStop(0, '#2f6fb8');
  sky.addColorStop(0.55, '#7fb2dd');
  sky.addColorStop(1, '#cfe6f2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, Math.max(horizonY + 1, 1));

  // Sun, low in the west, with a soft halo.
  const sunX = w * 0.78;
  const sunY = Math.max(horizonY - h * 0.16, h * 0.06);
  const halo = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 90);
  halo.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
  halo.addColorStop(0.25, 'rgba(255, 226, 140, 0.55)');
  halo.addColorStop(1, 'rgba(255, 226, 140, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - 95, sunY - 95, 190, 190);
  ctx.fillStyle = '#fff6cf';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 17, 0, TAU);
  ctx.fill();

  // ---- Sea -----------------------------------------------------------------
  const sea = ctx.createLinearGradient(0, horizonY, 0, h);
  sea.addColorStop(0, '#3f8fb8');
  sea.addColorStop(0.4, '#1d5f8a');
  sea.addColorStop(1, '#14486b');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // ---- Terrain grid --------------------------------------------------------
  const step = CONFIG.render.gridStep;
  const VD = CONFIG.render.viewDistance;
  const gx0 = Math.floor((flight.x - VD) / step) * step;
  const gz0 = Math.floor((flight.z - VD) / step) * step;
  const n = Math.ceil((VD * 2) / step);
  const quads = [];
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) {
      const x0 = gx0 + ix * step;
      const z0 = gz0 + iz * step;
      const cx = x0 + step / 2;
      const cz = z0 + step / 2;
      const dx = cx - flight.x;
      const dz = cz - flight.z;
      const dist = Math.hypot(dx, dz);
      if (dist > VD) continue;
      const type = island.groundType(cx, cz);
      if (type === 'sea' && dist > 420) continue; // far sea is the gradient
      const p00 = project(cam, x0, island.heightAt(x0, z0), z0);
      const p10 = project(cam, x0 + step, island.heightAt(x0 + step, z0), z0);
      const p11 = project(cam, x0 + step, island.heightAt(x0 + step, z0 + step), z0 + step);
      const p01 = project(cam, x0, island.heightAt(x0, z0 + step), z0 + step);
      if (!p00 || !p10 || !p11 || !p01) continue;
      const d = (p00.d + p10.d + p11.d + p01.d) / 4;
      quads.push({ p00, p10, p11, p01, d, type, hash: cellHash(ix, iz) });
    }
  }
  quads.sort((a, b) => b.d - a.d);
  for (const q of quads) {
    const fog = clamp((q.d - CONFIG.render.fogStart) / (CONFIG.render.fogEnd - CONFIG.render.fogStart), 0, 0.85);
    let colour = groundColour(q.type, q.hash);
    if (fog > 0) colour = mixHex(colour, fogColour, fog);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(q.p00.x, q.p00.y);
    ctx.lineTo(q.p10.x, q.p10.y);
    ctx.lineTo(q.p11.x, q.p11.y);
    ctx.lineTo(q.p01.x, q.p01.y);
    ctx.closePath();
    ctx.fill();
  }

  // ---- Runway markings ------------------------------------------------------
  drawNearGround(ctx, cam, island, flight);
  drawRunway(ctx, cam, island);

  // ---- Town blocks -----------------------------------------------------------
  for (const b of island.townBlocks) {
    const ground = island.heightAt(b.x, b.z);
    const base = project(cam, b.x, ground, b.z);
    if (!base || base.d > 1300) continue;
    const top = project(cam, b.x, ground + b.h, b.z);
    const scale = clamp(900 / base.d, 0.15, 3);
    const bw = (b.w / 2) * scale * 0.9;
    const bd = (b.d / 2) * scale * 0.9;
    const bh = (base.y - top.y);
    ctx.fillStyle = b.hue > 0.5 ? '#c9b18a' : '#b8a894';
    ctx.fillRect(base.x - bw, base.y - bh, bw * 2, bh);
    ctx.fillStyle = b.hue > 0.66 ? '#a34a3a' : b.hue > 0.33 ? '#5a6e8a' : '#7a7a72';
    ctx.beginPath();
    ctx.moveTo(base.x - bw, base.y - bh);
    ctx.lineTo(base.x - bw + bd * 0.5, base.y - bh - bd * 0.4);
    ctx.lineTo(base.x + bw + bd * 0.5, base.y - bh - bd * 0.4);
    ctx.lineTo(base.x + bw, base.y - bh);
    ctx.closePath();
    ctx.fill();
  }

  // ---- Trees ------------------------------------------------------------------
  ctx.fillStyle = '#2f6b2f';
  for (const t of island.trees) {
    const p = project(cam, t.x, island.heightAt(t.x, t.z) + 3, t.z);
    if (!p || p.d > 900 || p.d < 30) continue;
    const r = clamp(520 / p.d, 1, 7);
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }

  // ---- Volcano smoke ----------------------------------------------------------
  const vol = CONFIG.volcano;
  for (let i = 0; i < 5; i++) {
    const phase = (time * 0.12 + i * 0.2) % 1;
    const sx = vol.x + Math.sin(i * 2.4) * 18 + phase * 40;
    const sy = vol.y + vol.height + phase * 90;
    const sz = vol.z + Math.cos(i * 1.7) * 14;
    const p = project(cam, sx, sy, sz);
    if (!p || p.d > 1600) continue;
    const r = clamp((10 + phase * 34) * (700 / p.d), 2, 60);
    ctx.fillStyle = `rgba(120, 116, 110, ${0.5 * (1 - phase)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
  }

  // ---- Rings -------------------------------------------------------------------
  drawRings(ctx, cam, island, flight, time);

  // ---- Storm beacon -------------------------------------------------------------
  drawBeacon(ctx, cam, island, time, flight.missionId === 'storm');

  // ---- Storm cells ----------------------------------------------------------------
  if (flight.missionId === 'storm') drawStorm(ctx, cam, island, time);

  // ---- Clouds ----------------------------------------------------------------------
  for (const c of island.clouds) {
    const p = project(cam, c.x, c.y, c.z);
    if (!p || p.d > 1600 || p.d < 20) continue;
    const s = clamp((c.r * 700) / p.d, 6, 260);
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.ellipse(p.x - s * 0.4, p.y + s * 0.08, s * 0.55, s * 0.26, 0, 0, TAU);
    ctx.fill();
  }

  // ---- Plane shadow ------------------------------------------------------------------
  const groundY = island.heightAt(flight.x, flight.z);
  if (flight.y - groundY < 220) {
    const sp = project(cam, flight.x, groundY + 0.5, flight.z);
    if (sp) {
      const s = clamp(2600 / sp.d, 4, 90);
      ctx.fillStyle = `rgba(10, 20, 30, ${clamp(0.35 - (flight.y - groundY) / 700, 0.05, 0.35)})`;
      ctx.beginPath();
      ctx.ellipse(sp.x, sp.y, s, s * 0.32, 0, 0, TAU);
      ctx.fill();
    }
  }

  // ---- The plane -----------------------------------------------------------------------
  drawPlane(ctx, w, h, flight, time);
}

// The ground right under the camera never survives the terrain grid's near
// clip, so it shows as sea. Paint the wedge below the projected far edge
// of the lane ahead: grass aprons at the sides, the runway (or whatever the
// camera is over) down the middle, the middle wedge last so it wins.
function drawNearGround(ctx, cam, island, flight) {
  const w = ctx.canvas.width / (window.devicePixelRatio || 1);
  const h = ctx.canvas.height / (window.devicePixelRatio || 1);
  const heading = (flight.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(heading), z: -Math.cos(heading) };
  const side = { x: Math.cos(heading), z: Math.sin(heading) };
  const far = 46;
  const midType = island.groundType(cam.px + fwd.x * 20, cam.pz + fwd.z * 20);
  const lanes = [
    { a: -120, b: -30, colour: groundColour('grass', 0.5), bl: [0, h], br: [w / 2, h] },
    { a: 30, b: 120, colour: groundColour('grass', 0.5), bl: [w / 2, h], br: [w, h] },
    { a: -30, b: 30, colour: groundColour(midType, 0.5), bl: [0, h], br: [w, h] },
  ];
  for (const lane of lanes) {
    const edge = (lat) => {
      const x = cam.px + fwd.x * far + side.x * lat;
      const z = cam.pz + fwd.z * far + side.z * lat;
      const y = Math.min(island.heightAt(x, z), cam.py - 3) + 0.3;
      return project(cam, x, y, z);
    };
    const pa = edge(lane.a);
    const pb = edge(lane.b);
    const ax = pa ? pa.x : w * 0.3;
    const ay = pa ? pa.y : h * 0.62;
    const bx = pb ? pb.x : w * 0.7;
    const by = pb ? pb.y : h * 0.62;
    ctx.fillStyle = lane.colour;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(lane.br[0], lane.br[1]);
    ctx.lineTo(lane.bl[0], lane.bl[1]);
    ctx.closePath();
    ctx.fill();
  }
}

function drawRunway(ctx, cam, island) {  const rw = CONFIG.runway;
  const rh = (rw.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(rh), z: -Math.cos(rh) };
  const side = { x: Math.cos(rh), z: Math.sin(rh) };
  const hw = rw.width / 2;
  const hl = rw.length / 2;
  // The strip in segments, so a segment behind the camera is skipped
  // instead of hiding the whole runway (the west end sits behind the
  // camera when the plane is parked at the start of the strip).
  const segLen = 42;
  for (let a = -hl; a < hl; a += segLen) {
    const a0 = a;
    const a1 = Math.min(a + segLen, hl);
    const corners = [
      { x: rw.x + fwd.x * a0 - side.x * hw, z: rw.z + fwd.z * a0 - side.z * hw },
      { x: rw.x + fwd.x * a1 - side.x * hw, z: rw.z + fwd.z * a1 - side.z * hw },
      { x: rw.x + fwd.x * a1 + side.x * hw, z: rw.z + fwd.z * a1 + side.z * hw },
      { x: rw.x + fwd.x * a0 + side.x * hw, z: rw.z + fwd.z * a0 + side.z * hw },
    ];
    const pts = corners.map((c) => project(cam, c.x, 4.2, c.z));
    if (pts.some((p) => !p)) continue;
    ctx.fillStyle = '#33363d';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }
  // Centreline dashes.
  ctx.fillStyle = '#f2f2e8';
  for (let d = -hl + 18; d < hl - 10; d += 34) {
    const cx = rw.x + fwd.x * d;
    const cz = rw.z + fwd.z * d;
    const a = project(cam, cx - fwd.x * 9, 4.35, cz - fwd.z * 9);
    const b = project(cam, cx + fwd.x * 9, 4.35, cz + fwd.z * 9);
    if (!a || !b) continue;
    ctx.strokeStyle = '#f2f2e8';
    ctx.lineWidth = clamp(500 / a.d, 1, 5);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    for (let k = -2; k <= 2; k++) {
      const along = end * (hl - 8);
      const across = k * 6;
      const cx = rw.x + fwd.x * along + side.x * across;
      const cz = rw.z + fwd.z * along + side.z * across;
      const p = project(cam, cx, 4.35, cz);
      if (!p || p.d > 1200) continue;
      const s = clamp(600 / p.d, 1, 8);
      ctx.fillStyle = '#f2f2e8';
      ctx.fillRect(p.x - s, p.y - s * 0.4, s * 2, s * 0.8);
    }
  }
}

function drawRings(ctx, cam, island, flight, time) {
  const pulse = 0.75 + Math.sin(time * 4) * 0.25;
  island.rings.forEach((ring, i) => {
    const passed = i < flight.nextRing;
    const next = i === flight.nextRing;
    if (flight.missionId !== 'rings' && passed === false && i > 0) {
      // Outside the ring mission, show only the first ring faintly as a landmark.
      if (i > 0) return;
    }
    const pts = [];
    const steps = 26;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * TAU;
      // Circle in the vertical plane facing the ring's heading.
      const lx = Math.cos(a) * ring.radius;
      const ly = Math.sin(a) * ring.radius;
      const hx = Math.sin(ring.heading);
      const hz = -Math.cos(ring.heading);
      const wx = ring.x + hx * 0 + Math.cos(ring.heading) * lx;
      const wz = ring.z + 0 + Math.sin(ring.heading) * lx;
      const wy = ring.y + ly;
      const p = project(cam, wx, wy, wz);
      if (p) pts.push(p);
    }
    if (pts.length < 4) return;
    const colour = passed ? '#39d353' : next ? '#22d3ee' : '#f5b942';
    const alpha = passed ? 0.45 : next ? 0.95 : 0.55;
    const width = next ? 5 * pulse + 2 : 3;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.shadowColor = colour;
    ctx.shadowBlur = next ? 18 : 8;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
    // Number tag above the ring.
    const top = project(cam, ring.x, ring.y + ring.radius + 8, ring.z);
    if (top && top.d < 1400) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = colour;
      ctx.font = `bold ${clamp(900 / top.d, 11, 26)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), top.x, top.y);
      ctx.restore();
    }
  });
}

function drawBeacon(ctx, cam, island, time, active) {
  const b = island.beacon;
  const p = project(cam, b.x, b.y, b.z);
  if (!p || p.d > 1600) return;
  const pulse = 0.7 + Math.sin(time * 3) * 0.3;
  // Vertical beam.
  const top = project(cam, b.x, b.y + 220, b.z);
  const base = project(cam, b.x, island.heightAt(b.x, b.z), b.z);
  if (top && base) {
    const grad = ctx.createLinearGradient(0, top.y, 0, base.y);
    grad.addColorStop(0, 'rgba(245, 185, 66, 0)');
    grad.addColorStop(1, `rgba(245, 185, 66, ${0.5 * pulse})`);
    ctx.fillStyle = grad;
    const wHalf = clamp(1400 / p.d, 2, 26);
    ctx.fillRect(p.x - wHalf, top.y, wHalf * 2, base.y - top.y);
  }
  const r = clamp(1600 / p.d, 6, 40) * pulse;
  ctx.save();
  ctx.strokeStyle = '#f5b942';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#f5b942';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y - r);
  ctx.lineTo(p.x + r * 0.8, p.y);
  ctx.lineTo(p.x, p.y + r);
  ctx.lineTo(p.x - r * 0.8, p.y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
  if (active) {
    ctx.fillStyle = '#f5b942';
    ctx.font = `bold ${clamp(1000 / p.d, 11, 22)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('BEACON', p.x, p.y - r - 8);
  }
}

function drawStorm(ctx, cam, island, time) {
  for (const cell of island.stormCells) {
    const p = project(cam, cell.x, cell.y, cell.z);
    if (!p || p.d > 1600 || p.d < 20) continue;
    const s = clamp((cell.radius * 620) / p.d, 10, 320);
    const grad = ctx.createRadialGradient(p.x, p.y, s * 0.1, p.x, p.y, s);
    grad.addColorStop(0, 'rgba(48, 44, 66, 0.92)');
    grad.addColorStop(0.7, 'rgba(58, 52, 84, 0.75)');
    grad.addColorStop(1, 'rgba(58, 52, 84, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s, s * 0.62, 0, 0, TAU);
    ctx.fill();
    // Lightning flicker: a jagged bolt under the cell, now and then.
    const flick = Math.sin(time * 2.1 + cell.phase) > 0.86;
    if (flick && p.d < 1200) {
      ctx.strokeStyle = 'rgba(255, 240, 150, 0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      let lx = p.x;
      let ly = p.y + s * 0.3;
      ctx.moveTo(lx, ly);
      for (let k = 0; k < 5; k++) {
        lx += (Math.sin(time * 9 + cell.phase + k * 2.3) * 14);
        ly += s * 0.22;
        ctx.lineTo(lx, ly);
      }
      ctx.stroke();
    }
  }
}

// The plane, drawn as a built prop plane seen from behind and slightly
// above: fuselage, wings, tail, canopy and a spinning prop disc.
function drawPlane(ctx, w, h, flight, time) {
  const cx = w / 2;
  const cy = h * 0.54 - flight.pitch * 1.1;
  const scale = (Math.min(w, h) / 620) * 0.82;
  const rollRad = (-flight.roll * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rollRad * 0.85);
  ctx.scale(scale, scale);

  const prop = 0.35 + Math.abs(Math.sin(time * 40)) * 0.2;
  // Prop disc (seen edge-on from behind, a shimmering blur at the nose).
  ctx.fillStyle = `rgba(200, 210, 220, ${0.25 + prop * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(0, -118, 92, 7, 0, 0, TAU);
  ctx.fill();

  // Wings: broad, rounded, with red tips and a sunlit top.
  ctx.fillStyle = '#d8433a';
  roundRect(ctx, -168, -96, 336, 34, 16);
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  roundRect(ctx, -150, -96, 300, 34, 14);
  ctx.fill();
  ctx.fillStyle = '#d8433a';
  roundRect(ctx, -168, -96, 22, 34, 10);
  ctx.fill();
  roundRect(ctx, 146, -96, 22, 34, 10);
  ctx.fill();

  // Fuselage: tapered body with a cream stripe and a teal belly.
  ctx.fillStyle = '#b8352c';
  ctx.beginPath();
  ctx.moveTo(-26, -128);
  ctx.quadraticCurveTo(0, -140, 26, -128);
  ctx.lineTo(30, 96);
  ctx.quadraticCurveTo(0, 112, -30, 96);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.moveTo(-24, -118);
  ctx.lineTo(24, -118);
  ctx.lineTo(28, 88);
  ctx.lineTo(-28, 88);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f7f8f';
  ctx.beginPath();
  ctx.moveTo(-28, 60);
  ctx.lineTo(28, 60);
  ctx.lineTo(30, 96);
  ctx.quadraticCurveTo(0, 112, -30, 96);
  ctx.closePath();
  ctx.fill();

  // Canopy: a glossy bubble the pilot sits under.
  const canopy = ctx.createLinearGradient(-14, -116, 14, -60);
  canopy.addColorStop(0, '#bfe6f2');
  canopy.addColorStop(0.5, '#5fa8c4');
  canopy.addColorStop(1, '#2f6b8a');
  ctx.fillStyle = canopy;
  ctx.beginPath();
  ctx.ellipse(0, -88, 15, 26, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-5, -98, 4, 10, 0.3, 0, TAU);
  ctx.fill();

  // Tailplane and fin.
  ctx.fillStyle = '#d8433a';
  roundRect(ctx, -58, 74, 116, 18, 8);
  ctx.fill();
  ctx.fillStyle = '#f4f1e6';
  roundRect(ctx, -48, 74, 96, 18, 7);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-8, 92);
  ctx.lineTo(8, 92);
  ctx.lineTo(12, 52);
  ctx.lineTo(-12, 52);
  ctx.closePath();
  ctx.fillStyle = '#b8352c';
  ctx.fill();

  // Registration on the wing.
  ctx.fillStyle = '#3a3a3a';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EI-ISLE', 0, -72);

  // Nav lights: red left, green right, blinking white tail strobe.
  ctx.fillStyle = '#ff2d2d';
  ctx.beginPath();
  ctx.arc(-166, -79, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#2dff5a';
  ctx.beginPath();
  ctx.arc(166, -79, 5, 0, TAU);
  ctx.fill();
  if (Math.sin(time * 3) > 0.2) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 106, 5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
