// SOLMARA — the wanted system and the Solmara PD. Heat rises with crimes,
// stars follow the heat, and cruisers hunt the player along the street grid
// until the heat cools. On foot, a cruiser that stays on the player busts
// them; in a car, the cruisers ram.

import { WANTED, CAR_TYPES } from './config.js';
import { DIRECTIONS } from './city.js';

const LANE = 27;

function lanePoint(ix, iy, dir, centers) {
  const cx = centers[ix];
  const cy = centers[iy];
  if (dir === 0) return { x: cx, y: cy + LANE };
  if (dir === 1) return { x: cx - LANE, y: cy };
  if (dir === 2) return { x: cx, y: cy - LANE };
  return { x: cx + LANE, y: cy };
}

export function createPolice(city, random) {
  const centers = city.centers;
  const maxIndex = centers.length - 1;
  const cars = [];
  const state = { heat: 0, stars: 0, lastCrimeAt: -100, bustTimer: 0 };

  function spawnCruiser(playerX, playerY) {
    const point = city.randomRoadPoint(random, playerX, playerY, 700);
    const cruiser = {
      kind: 'police', type: 'police', spec: CAR_TYPES.police, color: '#2f3a4d',
      x: point.x, y: point.y, angle: 0, speed: 0,
      ix: 1, iy: 1, dir: 0, target: point, mode: 'road', stuck: 0, health: CAR_TYPES.police.health,
      active: true, driver: 'police',
    };
    // Snap its grid position to the nearest intersection.
    let bestIx = 0;
    let bestIy = 0;
    let best = Infinity;
    for (let ix = 0; ix <= maxIndex; ix += 1) {
      for (let iy = 0; iy <= maxIndex; iy += 1) {
        const dist = Math.hypot(centers[ix] - point.x, centers[iy] - point.y);
        if (dist < best) {
          best = dist;
          bestIx = ix;
          bestIy = iy;
        }
      }
    }
    cruiser.ix = bestIx;
    cruiser.iy = bestIy;
    cruiser.target = lanePoint(bestIx, bestIy, 0, centers);
    cars.push(cruiser);
    return cruiser;
  }

  function nextTarget(cruiser, playerIx, playerIy) {
    let bestDir = null;
    let bestScore = Infinity;
    for (let d = 0; d < 4; d += 1) {
      if (d === (cruiser.dir + 2) % 4) continue;
      const nx = cruiser.ix + DIRECTIONS[d].x;
      const ny = cruiser.iy + DIRECTIONS[d].y;
      if (nx < 0 || nx > maxIndex || ny < 0 || ny > maxIndex) continue;
      const score = Math.abs(nx - playerIx) + Math.abs(ny - playerIy) + random() * 0.6;
      if (score < bestScore) {
        bestScore = score;
        bestDir = d;
      }
    }
    if (bestDir === null) return lanePoint(cruiser.ix, cruiser.iy, cruiser.dir, centers);
    cruiser.dir = bestDir;
    cruiser.ix += DIRECTIONS[bestDir].x;
    cruiser.iy += DIRECTIONS[bestDir].y;
    return lanePoint(cruiser.ix, cruiser.iy, bestDir, centers);
  }

  function addHeat(amount, elapsed) {
    state.heat = Math.min(100, state.heat + amount);
    state.lastCrimeAt = elapsed;
    state.stars = Math.min(WANTED.maxStars, Math.floor(state.heat / WANTED.heatPerStar));
  }

  function reset() {
    cars.length = 0;
    state.heat = 0;
    state.stars = 0;
    state.lastCrimeAt = -100;
    state.bustTimer = 0;
  }

  // One fixed step. `context` carries the player (position, car, on foot),
  // the elapsed time, and whether the player is hiding at the garage.
  // Returns events the world must answer (busted, ram).
  function step(dt, context) {
    const events = [];
    const player = context.player;
    const elapsed = context.elapsed;

    state.stars = Math.min(WANTED.maxStars, Math.floor(state.heat / WANTED.heatPerStar));
    const nearCop = cars.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < 500);
    if (elapsed - state.lastCrimeAt > WANTED.quietSeconds && !nearCop) {
      const rate = context.inHideout ? WANTED.hideoutDecay : WANTED.decayPerSecond;
      state.heat = Math.max(0, state.heat - rate * dt);
      state.stars = Math.min(WANTED.maxStars, Math.floor(state.heat / WANTED.heatPerStar));
    }

    const wanted = WANTED.policePerStar[state.stars];
    while (cars.length < wanted) spawnCruiser(player.x, player.y);
    for (let i = cars.length - 1; i >= 0; i -= 1) {
      const car = cars[i];
      if (cars.length > wanted && Math.hypot(car.x - player.x, car.y - player.y) > 1200) {
        cars.splice(i, 1);
      }
    }

    const playerIx = Math.round(player.x / 450);
    const playerIy = Math.round(player.y / 450);
    const distToPlayer = (car) => Math.hypot(player.x - car.x, player.y - car.y);

    for (const car of cars) {
      const dist = distToPlayer(car);
      if (car.mode === 'road' && dist < 150) car.mode = 'pursuit';
      if (car.mode === 'pursuit' && dist > 320) car.mode = 'road';

      let wantAngle;
      let targetSpeed;
      if (car.mode === 'pursuit') {
        wantAngle = Math.atan2(player.y - car.y, player.x - car.x);
        targetSpeed = car.spec.top * 0.92;
      } else {
        const dx = car.target.x - car.x;
        const dy = car.target.y - car.y;
        const targetDist = Math.hypot(dx, dy);
        wantAngle = Math.atan2(dy, dx);
        targetSpeed = car.spec.top * 0.8;
        if (targetDist < 14) car.target = nextTarget(car, playerIx, playerIy);
      }
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, diff));
      car.speed += Math.max(-420 * dt, Math.min(380 * dt, targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = city.collideCircle(car.x, car.y, 18);
      if (fixed.hit) {
        car.x = fixed.x;
        car.y = fixed.y;
        car.speed *= 0.5;
      }
      // On foot, a cruiser that stays on the player busts them.
      if (context.onFoot && dist < 36) {
        state.bustTimer += dt;
        if (state.bustTimer > WANTED.bustSeconds) events.push({ type: 'busted' });
      }
    }
    if (context.onFoot) {
      const anyClose = cars.some((car) => distToPlayer(car) < 36);
      if (!anyClose) state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    } else {
      state.bustTimer = 0;
    }
    return events;
  }

  return { cars, state, addHeat, reset, step };
}
