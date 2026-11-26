// The HUD and the screens around the flight: altitude, airspeed, heading
// compass, artificial horizon, fuel and throttle gauges, score, timer and
// the mission objective — plus title, pause and end-of-sortie screens.

import { CONFIG, MISSION_INTRO } from './config.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// A glassy dark panel.
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10, 18, 28, 0.72)';
  ctx.strokeStyle = 'rgba(140, 200, 240, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
  ctx.stroke();
}

function label(ctx, text, x, y, size, colour) {
  ctx.fillStyle = colour || '#9fc6e8';
  ctx.font = `${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

function value(ctx, text, x, y, size, colour) {
  ctx.fillStyle = colour || '#ffffff';
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

const KTS = 1.94384; // m/s to knots
const FT = 3.28084; // metres to feet

export function drawHUD(ctx, w, h, flight, island, mission) {
  // ---- Top-left: the three big numbers -------------------------------------
  panel(ctx, 14, 12, 250, 100);
  label(ctx, 'ALTITUDE', 28, 34, 11);
  value(ctx, `${Math.round(flight.y * FT).toLocaleString('en-US')} ft`, 28, 58, 22);
  label(ctx, 'AIRSPEED', 28, 80, 11);
  value(ctx, `${Math.round(flight.groundSpeed * KTS)} kt`, 28, 102, 22);
  label(ctx, 'HEADING', 150, 34, 11);
  value(ctx, `${String(Math.round(flight.heading)).padStart(3, '0')}°`, 150, 58, 22);
  label(ctx, 'VERT SPEED', 150, 80, 11);
  const vs = Math.round(flight.verticalSpeed * FT * 60);
  value(ctx, `${vs >= 0 ? '+' : ''}${vs} fpm`, 150, 102, 16, vs < -600 ? '#ff9a7a' : '#ffffff');

  // ---- Top-centre: compass tape --------------------------------------------
  const tapeW = 320;
  const tapeX = w / 2 - tapeW / 2;
  panel(ctx, tapeX, 12, tapeW, 44);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(tapeX, 12, tapeW, 44, 10);
  ctx.clip();
  const degPerPx = 0.55;
  for (let d = -90; d <= 90; d += 5) {
    const hdg = (Math.round(flight.heading) + d + 360) % 360;
    const x = w / 2 + d / degPerPx;
    const major = hdg % 30 === 0;
    ctx.strokeStyle = major ? '#ffffff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 18);
    ctx.lineTo(x, major ? 30 : 25);
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(names[hdg] || String(hdg).padStart(3, '0'), x, 46);
    }
  }
  ctx.restore();
  // Centre caret.
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 7, 12);
  ctx.lineTo(w / 2 + 7, 12);
  ctx.lineTo(w / 2, 22);
  ctx.closePath();
  ctx.fill();

  // ---- Objective bar, under the compass -------------------------------------
  const obj = objectiveText(flight, island, mission);
  ctx.font = '13px system-ui, sans-serif';
  const objW = Math.min(560, ctx.measureText(obj).width + 28);
  panel(ctx, w / 2 - objW / 2, 64, objW, 28);
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(obj, w / 2, 83);

  // ---- Top-right: score, timer, fuel ----------------------------------------
  panel(ctx, w - 264, 12, 250, 100);
  label(ctx, 'SCORE', w - 250, 34, 11);
  value(ctx, String(flight.score), w - 250, 58, 22);
  label(ctx, 'TIME LEFT', w - 150, 34, 11);
  const tl = Math.max(0, Math.ceil(flight.timeLeft));
  value(ctx, `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`, w - 150, 58, 22, tl < 30 ? '#ff9a7a' : '#ffffff');
  label(ctx, mission.name.toUpperCase(), w - 250, 80, 11, '#ffd34d');
  value(ctx, missionProgress(flight, island), w - 150, 102, 16);

  // ---- Bottom-left: artificial horizon ----------------------------------------
  drawAttitude(ctx, 78, h - 78, 62, flight);

  // ---- Bottom-centre: minimap ---------------------------------------------------
  drawMinimap(ctx, w, h, flight, island);

  // ---- Bottom-right: fuel and throttle -----------------------------------------
  panel(ctx, w - 214, h - 132, 200, 120);
  label(ctx, 'FUEL', w - 200, h - 108, 11);
  drawBar(ctx, w - 200, h - 100, 172, 12, flight.fuel / 100, flight.fuel < 20 ? '#ff5a3c' : '#39d353');
  value(ctx, `${Math.round(flight.fuel)}%`, w - 200, h - 78, 15);
  label(ctx, 'THROTTLE', w - 200, h - 60, 11);
  drawBar(ctx, w - 200, h - 52, 172, 12, flight.throttle, '#22d3ee');
  value(ctx, `${Math.round(flight.throttle * 100)}%`, w - 200, h - 30, 15);
  if (flight.flaps) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('FLAPS DOWN', w - 200, h - 142);
  }

  // ---- Damage -------------------------------------------------------------------
  if (flight.damage > 0) {
    panel(ctx, 14, h - 52, 200, 40);
    label(ctx, 'DAMAGE', 28, h - 34, 11);
    drawBar(ctx, 28, h - 28, 172, 10, flight.damage / 100, '#ff5a3c');
  }

  // ---- Centre message ------------------------------------------------------------
  if (flight.message && flight.messageTimer > 0) {
    ctx.font = 'bold 30px system-ui, sans-serif';
    const mw = ctx.measureText(flight.message).width;
    panel(ctx, w / 2 - mw / 2 - 18, h * 0.22 - 26, mw + 36, 52);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(flight.message, w / 2, h * 0.22 + 8);
  }

  // ---- Stall warning ----------------------------------------------------------------
  if (flight.phase === 'flying' && flight.speed < CONFIG.plane.stallSpeed && flight.y > island.heightAt(flight.x, flight.z) + 5) {
    ctx.fillStyle = '#ff5a3c';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('STALL — NOSE DOWN, THROTTLE UP', w / 2, h * 0.68);
  }
}

function drawBar(ctx, x, y, w, h, frac, colour) {
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.roundRect(x, y, Math.max(2, w * clamp(frac, 0, 1)), h, h / 2);
  ctx.fill();
}

function drawAttitude(ctx, cx, cy, r, flight) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // Sky and ground, rotated by roll and shifted by pitch.
  ctx.translate(cx, cy);
  ctx.rotate((-flight.roll * Math.PI) / 180);
  const pitchPx = clamp(flight.pitch * 1.6, -r, r);
  ctx.fillStyle = '#4a90c4';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
  ctx.fillStyle = '#8a6a42';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings marker and bezel.
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.15, cy);
  ctx.moveTo(cx + r * 0.15, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9fc6e8';
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', cx, cy + r + 16);
}

function drawMinimap(ctx, w, h, flight, island) {
  const mw = 176;
  const mh = 122;
  const mx = w / 2 - mw / 2;
  const my = h - mh - 14;
  panel(ctx, mx, my, mw, mh);
  const R = CONFIG.islandRadius;
  const toMap = (x, z) => [mx + mw / 2 + (x / (R * 1.15)) * (mw / 2 - 6), my + mh / 2 + (z / (R * 1.15)) * (mh / 2 - 6)];
  // Sea and island.
  ctx.fillStyle = '#1d5f8a';
  ctx.beginPath();
  ctx.roundRect(mx + 6, my + 6, mw - 12, mh - 12, 6);
  ctx.fill();
  ctx.fillStyle = '#5da24a';
  ctx.beginPath();
  ctx.arc(mx + mw / 2, my + mh / 2, (mw / 2 - 6) * (R / (R * 1.15)), 0, Math.PI * 2);
  ctx.fill();
  // Volcano.
  const [vx, vy] = toMap(CONFIG.volcano.x, CONFIG.volcano.z);
  ctx.fillStyle = '#6e6258';
  ctx.beginPath();
  ctx.arc(vx, vy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.arc(vx, vy, 2, 0, Math.PI * 2);
  ctx.fill();
  // Runway.
  const rw = CONFIG.runway;
  const rh = (rw.heading * Math.PI) / 180;
  const fwd = { x: Math.sin(rh), z: -Math.cos(rh) };
  const [r1x, r1y] = toMap(rw.x - fwd.x * rw.length / 2, rw.z - fwd.z * rw.length / 2);
  const [r2x, r2y] = toMap(rw.x + fwd.x * rw.length / 2, rw.z + fwd.z * rw.length / 2);
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(r1x, r1y);
  ctx.lineTo(r2x, r2y);
  ctx.stroke();
  // Rings: passed green, next cyan, later gold.
  island.rings.forEach((ring, i) => {
    const [px, py] = toMap(ring.x, ring.z);
    ctx.fillStyle = i < flight.nextRing ? '#39d353' : i === flight.nextRing ? '#22d3ee' : '#f5b942';
    ctx.beginPath();
    ctx.arc(px, py, i === flight.nextRing ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fill();
  });
  // Bonus rings, gold diamonds.
  for (const ring of island.bonusRings) {
    if (flight._bonusHit && flight._bonusHit.has(ring.index)) continue;
    const [px, py] = toMap(ring.x, ring.z);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(px, py - 3);
    ctx.lineTo(px + 3, py);
    ctx.lineTo(px, py + 3);
    ctx.lineTo(px - 3, py);
    ctx.closePath();
    ctx.fill();
  }
  // Storm beacon / cells.
  if (flight.missionId === 'storm') {
    for (const cell of island.stormCells) {
      const [px, py] = toMap(cell.x, cell.z);
      ctx.fillStyle = 'rgba(90, 80, 130, 0.9)';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const [bx, by] = toMap(island.beacon.x, island.beacon.z);
    ctx.fillStyle = '#f5b942';
    ctx.beginPath();
    ctx.arc(bx, by, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The plane: a white arrow pointing along its heading.
  const [px, py] = toMap(flight.x, flight.z);
  const ha = (flight.heading * Math.PI) / 180;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0a1420';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + Math.sin(ha) * 8, py - Math.cos(ha) * 8);
  ctx.lineTo(px + Math.sin(ha + 2.6) * 6, py - Math.cos(ha + 2.6) * 6);
  ctx.lineTo(px + Math.sin(ha - 2.6) * 6, py - Math.cos(ha - 2.6) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#9fc6e8';
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('MAP', mx + mw / 2, my + mh - 4);
}

function objectiveText(flight, island, mission) {
  if (flight.phase === 'landed') return 'Landed! Press R to fly again.';
  if (flight.phase === 'down') return 'Down in the fields. Press R to try again.';
  if (flight.phase === 'crashed') return 'Crashed. Press R to try again.';
  if (flight.phase === 'timeout') return 'Time up. Press R to try again.';
  if (flight.phase === 'complete') return 'Mission complete! Press R to fly again.';
  if (mission.id === 'rings') {
    return `Ring ${Math.min(flight.nextRing + 1, island.rings.length)} of ${island.rings.length} — follow the cyan gate`;
  }
  if (mission.id === 'landing') {
    return flight.volcanoRounded ? 'Volcano rounded — land on the runway!' : 'Climb out and round the volcano beacon';
  }
  return flight.beaconReached ? 'Beacon reached!' : 'Reach the gold beacon through the storm';
}

function missionProgress(flight, island) {
  if (flight.missionId === 'rings') return `${flight.ringsPassed}/${island.rings.length} rings`;
  if (flight.missionId === 'landing') return flight.volcanoRounded ? 'beacon ✓' : 'beacon …';
  return `${flight.stormHits} hits`;
}

// ---- Screens ----------------------------------------------------------------

export function drawTitle(ctx, w, h, selectedMission, time) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd34d';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('EMBER ISLE', w / 2, h * 0.2);
  ctx.fillStyle = '#ffffff';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('— Island Hopper —', w / 2, h * 0.2 + 40);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('A little prop plane, one island, three ways to earn your wings.', w / 2, h * 0.2 + 72);

  CONFIG.missions.forEach((m, i) => {
    const y = h * 0.36 + i * 92;
    const sel = i === selectedMission;
    ctx.fillStyle = sel ? 'rgba(255, 211, 77, 0.22)' : 'rgba(10, 18, 28, 0.6)';
    ctx.strokeStyle = sel ? '#ffd34d' : 'rgba(140, 200, 240, 0.4)';
    ctx.lineWidth = sel ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 300, y, 600, 76, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${m.name}`, w / 2 - 280, y + 30);
    ctx.fillStyle = '#cfe6f2';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(m.blurb, w / 2 - 280, y + 54);
    ctx.fillStyle = sel ? '#ffd34d' : '#9fc6e8';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sel ? '◀ SELECTED' : 'press ' + (i + 1), w / 2 + 280, y + 30);
  });

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const blink = Math.sin(time * 3) > -0.2;
  if (blink) ctx.fillText('Press ENTER or click to fly', w / 2, h * 0.36 + 3 * 92 + 34);
  ctx.fillStyle = '#9fc6e8';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('W/S throttle · Arrow keys pitch & roll · F flaps · P pause · M mute · R restart', w / 2, h * 0.36 + 3 * 92 + 62);
  ctx.fillText('Land gently on the runway. Mind the fuel — and the volcano.', w / 2, h * 0.36 + 3 * 92 + 84);
  ctx.fillStyle = '#ffd34d';
  ctx.fillText('Gold bonus rings are worth +750 — if you dare to go low.', w / 2, h * 0.36 + 3 * 92 + 106);
}

export function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 16, 28, 0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h / 2 - 10);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('P to resume · R to restart · M to mute', w / 2, h / 2 + 26);
}

export function drawEndScreen(ctx, w, h, flight, mission) {
  const won = flight.phase === 'complete' || flight.phase === 'landed';
  ctx.fillStyle = 'rgba(8, 16, 28, 0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = won ? '#39d353' : '#ff9a7a';
  ctx.font = 'bold 46px system-ui, sans-serif';
  ctx.fillText(
    flight.phase === 'complete'
      ? 'MISSION COMPLETE'
      : flight.phase === 'landed'
        ? 'LANDED SAFELY'
        : flight.phase === 'down'
          ? 'FORCED LANDING'
          : flight.phase === 'timeout'
            ? 'TIME UP'
            : 'CRASHED',
    w / 2,
    h * 0.32,
  );
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px system-ui, sans-serif';
  ctx.fillText(flight.message || '', w / 2, h * 0.32 + 36);
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(`Score: ${flight.score}`, w / 2, h * 0.32 + 84);
  ctx.fillStyle = '#cfe6f2';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Mission: ${mission.name} · Time: ${Math.round(flight.time)}s · Fuel left: ${Math.round(flight.fuel)}%`, w / 2, h * 0.32 + 116);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press R to fly again, or 1 / 2 / 3 to pick another mission', w / 2, h * 0.32 + 156);
}

export { MISSION_INTRO };
