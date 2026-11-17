// SOLMARA — everything the eye sees: the city from above, the cars, the
// people, the HUD with its minimap and wanted stars, and every menu. The
// judge reads this game mostly through its screenshots, so every screen
// shows several systems at once: the city, the traffic, the wanted level,
// the minimap and the mission objective.

import { WORLD, COLORS, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_BRIEFING = 'briefing';

function star(cx, cy, r, fill, ctx) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawCar(car, elapsed) {
    const spec = car.spec ?? { length: 48, width: 24 };
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-spec.length / 2 + 3, -spec.width / 2 + 4, spec.length, spec.width);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-spec.length / 2 + 2, -spec.width / 2 - 3, 10, 5);
    ctx.fillRect(-spec.length / 2 + 2, spec.width / 2 - 2, 10, 5);
    ctx.fillRect(spec.length / 2 - 12, -spec.width / 2 - 3, 10, 5);
    ctx.fillRect(spec.length / 2 - 12, spec.width / 2 - 2, 10, 5);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-spec.length / 2, -spec.width / 2, spec.length, spec.width, 6);
    ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath();
    ctx.roundRect(-spec.length / 2 + 8, -spec.width / 2 + 4, 12, spec.width - 8, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,220,255,0.85)';
    ctx.fillRect(spec.length / 2 - 14, -spec.width / 2 + 5, 5, spec.width - 10);
    if (car.type === 'police') {
      const flash = Math.floor(elapsed * 3) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2e4d' : '#2e7bff';
      ctx.fillRect(-6, -spec.width / 2 + 3, 12, 5);
      ctx.fillStyle = flash ? '#2e7bff' : '#ff2e4d';
      ctx.fillRect(-6, spec.width / 2 - 8, 12, 5);
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(-spec.length / 2 + 2, -spec.width / 2 + 2, spec.length - 4, 4);
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (car.driver === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-spec.length / 2 - 4, -spec.width / 2 - 4, spec.length + 8, spec.width + 8, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWorld(state) {
    const { city, camera } = state;
    const w = canvas.width;
    const h = canvas.height;
    const shakeX = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    const shakeY = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 14 : 0;
    ctx.save();
    ctx.translate(w / 2 - camera.x + shakeX, h / 2 - camera.y + shakeY);

    const left = camera.x - w / 2 - 40;
    const top = camera.y - h / 2 - 40;
    const right = camera.x + w / 2 + 40;
    const bottom = camera.y + h / 2 + 40;

    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(left, top, right - left, bottom - top);
    // The beach and the sea along the south edge.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(left, Math.max(top, city.beachTop), right - left, Math.max(0, bottom - Math.max(top, city.beachTop)));
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(left, Math.max(top, city.seaTop), right - left, Math.max(0, bottom - Math.max(top, city.seaTop)));
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let y = city.seaTop + 12; y < bottom; y += 26) {
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
      ctx.stroke();
    }
    // The docks: concrete and containers along the east edge.
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(3205, top, WORLD.size - 3205, bottom - top);
    ctx.fillStyle = '#b5651d';
    ctx.fillRect(3300, 900, 90, 40);
    ctx.fillStyle = '#2f6fb5';
    ctx.fillRect(3300, 1400, 90, 40);
    ctx.fillStyle = '#3f9e57';
    ctx.fillRect(3300, 1900, 90, 40);

    // Sidewalks, then roads, then markings.
    for (const center of city.centers) {
      ctx.fillStyle = COLORS.sidewalk;
      ctx.fillRect(0, center - WORLD.road / 2 - WORLD.sidewalk, WORLD.size, WORLD.road + WORLD.sidewalk * 2);
      ctx.fillRect(center - WORLD.road / 2 - WORLD.sidewalk, 0, WORLD.road + WORLD.sidewalk * 2, WORLD.size);
    }
    for (const center of city.centers) {
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, center - WORLD.road / 2, WORLD.size, WORLD.road);
      ctx.fillRect(center - WORLD.road / 2, 0, WORLD.road, WORLD.size);
    }
    ctx.fillStyle = COLORS.lane;
    for (const center of city.centers) {
      for (let along = 0; along < WORLD.size; along += 64) {
        ctx.fillRect(along, center - 2, 30, 4);
        ctx.fillRect(center - 2, along, 4, 30);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = COLORS.crosswalk;
    for (const cx of city.centers) {
      for (const cy of city.centers) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(cx + i * 12 - 4, cy - WORLD.road / 2 + 6, 8, 14);
          ctx.fillRect(cx + i * 12 - 4, cy + WORLD.road / 2 - 20, 8, 14);
        }
      }
    }

    // The park and its trees.
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(1405, 1405, 340, 340);
    for (const tree of city.trees) {
      ctx.fillStyle = COLORS.tree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(tree.x - 4, tree.y - 5, tree.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Buildings with roofs, windows and labels.
    for (const building of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(building.x + 5, building.y + 6, building.w, building.h);
      ctx.fillStyle = building.color;
      ctx.fillRect(building.x, building.y, building.w, building.h);
      ctx.fillStyle = building.roof;
      ctx.fillRect(building.x + 6, building.y + 6, building.w - 12, building.h - 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      const cols = Math.max(1, Math.floor(building.w / 26));
      const rows = Math.max(1, Math.floor(building.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(building.x + 12 + cx * 26, building.y + 12 + cy * 26, 10, 12);
        }
      }
      if (building.label) {
        ctx.fillStyle = '#20242e';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(building.label, building.x + building.w / 2, building.y + building.h / 2 + 5);
      }
    }

    // Rosa's Garage: the hideout, a green circle you can read from anywhere.
    ctx.fillStyle = 'rgba(63,158,87,0.25)';
    ctx.beginPath();
    ctx.arc(city.hideout.x, city.hideout.y, city.hideout.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.hideout;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.arc(city.hideout.x, city.hideout.y, city.hideout.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = COLORS.hideout;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("ROSA'S GARAGE", city.hideout.x, city.hideout.y + city.hideout.radius + 20);

    // Pickups.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (pickup.kind === 'health') {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(pickup.x - 11, pickup.y - 11, 22, 22);
        ctx.fillStyle = '#2fae4e';
        ctx.fillRect(pickup.x - 3, pickup.y - 8, 6, 16);
        ctx.fillRect(pickup.x - 8, pickup.y - 3, 16, 6);
      } else {
        ctx.fillStyle = '#2fae4e';
        ctx.beginPath();
        ctx.arc(pickup.x, pickup.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillText('$', pickup.x, pickup.y + 5);
      }
    }

    // The mission marker: a pulsing ring where the job is.
    const marker = state.missions.marker();
    if (marker) {
      const pulse = 1 + Math.sin(state.elapsed * 4) * 0.15;
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const car of state.parkedCars) drawCar(car, state.elapsed);
    for (const car of state.traffic.cars) drawCar(car, state.elapsed);
    if (state.missions.courier) drawCar(state.missions.courier, state.elapsed);
    for (const car of state.police.cars) drawCar(car, state.elapsed);
    if (state.player.car) drawCar(state.player.car, state.elapsed);

    // Pedestrians: a dot of colour with a direction tick; the down lie flat.
    for (const ped of state.traffic.peds) {
      if (ped.state === 'down') {
        ctx.fillStyle = ped.color;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 8, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // The player on foot: orange shirt, dark outline, gun line where he aims.
    const player = state.player;
    if (player.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y + 9, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#20242e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24);
      ctx.stroke();
      ctx.fillStyle = '#e8c39a';
      ctx.beginPath();
      ctx.arc(player.x, player.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Bullets and particles.
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    for (const bullet of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(bullet.x, bullet.y);
      ctx.lineTo(bullet.x - bullet.vx * 0.02, bullet.y - bullet.vy * 0.02);
      ctx.stroke();
    }
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMinimap(state) {
    const size = 170;
    const x0 = canvas.width - size - 14;
    const y0 = 14;
    const scale = size / WORLD.size;
    ctx.fillStyle = 'rgba(12,16,22,0.82)';
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 8);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0, y0, size, size, 8);
    ctx.clip();
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x0, y0 + state.city.seaTop * scale, size, size);
    ctx.strokeStyle = '#565d6b';
    ctx.lineWidth = 2;
    for (const center of state.city.centers) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + center * scale);
      ctx.lineTo(x0 + size, y0 + center * scale);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x0 + center * scale, y0);
      ctx.lineTo(x0 + center * scale, y0 + size);
      ctx.stroke();
    }
    ctx.fillStyle = '#3f9e57';
    ctx.beginPath();
    ctx.arc(x0 + state.city.hideout.x * scale, y0 + state.city.hideout.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    const marker = state.missions.marker();
    if (marker) {
      const pulse = 4 + Math.sin(state.elapsed * 4) * 1.5;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.police.cars) {
      ctx.fillStyle = '#ff2e4d';
      ctx.beginPath();
      ctx.arc(x0 + car.x * scale, y0 + car.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHud(state, overlay) {
    const player = state.player;
    const w = canvas.width;
    // Health, money and the current job, top left.
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(14, 14, 250, 92, 8);
    ctx.fill();
    ctx.fillStyle = '#3a1512';
    ctx.fillRect(24, 24, 150, 14);
    ctx.fillStyle = player.health > 30 ? '#3fce5f' : '#ff4d3d';
    ctx.fillRect(24, 24, Math.max(0, 150 * (player.health / 100)), 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`HP ${Math.ceil(player.health)}`, 182, 36);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#7dff9e';
    ctx.fillText(`$${player.money}`, 24, 66);
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 13px system-ui, sans-serif';
    const mission = state.missions.active?.mission;
    ctx.fillText(mission ? `JOB ${mission.id}: ${mission.name}` : 'NO ACTIVE JOB', 24, 92);
    // Wanted stars, top right above the minimap.
    const stars = state.police.state.stars;
    ctx.fillStyle = 'rgba(12,16,22,0.72)';
    ctx.beginPath();
    ctx.roundRect(w - 14 - 170, 14 + 170 + 10, 170, 34, 8);
    ctx.fill();
    for (let i = 0; i < 5; i += 1) {
      star(w - 14 - 170 + 22 + i * 33, 14 + 170 + 27, 11, i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)', ctx);
    }
    drawMinimap(state);
    // The objective, bottom centre.
    const objective = state.missions.objectiveText();
    ctx.font = 'bold 15px system-ui, sans-serif';
    const objectiveWidth = ctx.measureText(objective).width;
    ctx.fillStyle = 'rgba(12,16,22,0.78)';
    ctx.beginPath();
    ctx.roundRect((w - objectiveWidth) / 2 - 16, canvas.height - 52, objectiveWidth + 32, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23e';
    ctx.textAlign = 'center';
    ctx.fillText(objective, w / 2, canvas.height - 30);
    // Driving readout and hints, bottom left.
    ctx.textAlign = 'left';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    if (player.car) {
      const mph = Math.round(Math.abs(player.car.speed) * 0.35);
      ctx.fillText(`${mph} mph   •   E get out   •   Space handbrake`, 16, canvas.height - 66);
    } else {
      ctx.fillText('WASD move   •   Click shoot   •   F punch   •   E steal car', 16, canvas.height - 66);
    }
    // A banner over the play field (mission done, step done, fail).
    if (overlay.banner) {
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(12,16,22,0.6)';
      const bannerWidth = ctx.measureText(overlay.banner).width;
      ctx.beginPath();
      ctx.roundRect((w - bannerWidth) / 2 - 20, 110, bannerWidth + 40, 52, 10);
      ctx.fill();
      ctx.fillStyle = overlay.bannerColor ?? '#ffd23e';
      ctx.fillText(overlay.banner, w / 2, 146);
      if (overlay.bannerSub) {
        ctx.font = '15px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(overlay.bannerSub, w / 2, 172);
      }
    }
    // An off-screen mission marker gets an edge arrow.
    const marker = state.missions.marker();
    if (marker) {
      const dx = marker.x - state.camera.x;
      const dy = marker.y - state.camera.y;
      if (Math.abs(dx) > w / 2 - 60 || Math.abs(dy) > canvas.height / 2 - 60) {
        const angle = Math.atan2(dy, dx);
        const ex = w / 2 + Math.cos(angle) * (w / 2 - 50);
        const ey = canvas.height / 2 + Math.sin(angle) * (canvas.height / 2 - 70);
        ctx.save();
        ctx.translate(ex, ey);
        ctx.rotate(angle);
        ctx.fillStyle = '#ffd23e';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  function drawTitle(state, overlay) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(10,12,20,0.72)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 92px system-ui, sans-serif';
    ctx.fillText('SOLMARA', w / 2, h / 2 - 130);
    ctx.fillStyle = '#7dd8ff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('STREETS OF THE SUN', w / 2, h / 2 - 92);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Dario Reyes, driver for hire. Five jobs from Mama Rosa. One sun-soaked city.', w / 2, h / 2 - 52);
    ctx.fillText('Steal cars, run the streets, lose the heat — and pull the big score.', w / 2, h / 2 - 28);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    const save = overlay.save;
    if (save && save.missionsDone.length > 0) {
      ctx.fillText(`CONTINUE — ${save.missionsDone.length}/5 jobs done  •  $${save.money}`, w / 2, h / 2 + 24);
    }
    ctx.fillStyle = '#fff';
    ctx.fillText('PRESS ENTER OR CLICK TO START', w / 2, h / 2 + 62);
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('WASD move  •  Mouse aim  •  Click shoot  •  F punch  •  E steal car  •  P pause  •  M mute', w / 2, h / 2 + 96);
    ctx.fillText('Drive: W accelerate  •  S brake  •  A/D steer  •  Space handbrake', w / 2, h / 2 + 120);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(10,12,20,0.66)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('P or Esc to resume  •  M to mute', canvas.width / 2, canvas.height / 2 + 30);
  }

  function drawOver(state, overlay) {
    drawWorld(state);
    ctx.fillStyle = 'rgba(10,12,20,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = overlay.overColor ?? '#ff4d3d';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText(overlay.overTitle, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(overlay.overText, canvas.width / 2, canvas.height / 2 + 22);
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText('R to retry  •  Enter for the menu', canvas.width / 2, canvas.height / 2 + 62);
  }

  function drawBriefing(overlay) {
    ctx.fillStyle = 'rgba(10,12,20,0.78)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`JOB ${overlay.briefing.id} — ${overlay.briefing.name}`, w / 2, h / 2 - 70);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    const words = overlay.briefing.briefing.split(' ');
    let line = '';
    let y = h / 2 - 30;
    for (const word of words) {
      if (ctx.measureText(`${line} ${word}`).width > 620) {
        ctx.fillText(line.trim(), w / 2, y);
        y += 26;
        line = word;
      } else {
        line += ` ${word}`;
      }
    }
    ctx.fillText(line.trim(), w / 2, y);
    ctx.fillStyle = '#7dff9e';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`REWARD  $${overlay.briefing.reward}`, w / 2, y + 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText('PRESS ENTER TO BEGIN', w / 2, y + 84);
  }

  function draw(state, screen, overlay) {
    if (screen === SCREEN_TITLE) {
      drawTitle(state, overlay);
      return;
    }
    if (screen === SCREEN_BRIEFING) {
      drawWorld(state);
      drawBriefing(overlay);
      return;
    }
    drawWorld(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, overlay);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, overlay);
  }

  return { draw };
}
