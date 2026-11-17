// SOLMARA — the city's living traffic: cars that drive the street grid on
// lanes, and pedestrians who walk the sidewalks and run from trouble.
// Both follow the same rule: pick a street, walk or drive it, turn at an
// intersection, never reverse.

import { WORLD, CAR_TYPES, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { pick, range } from './random.js';
import { DIRECTIONS } from './city.js';

const LANE = 27;
const CAR_COLORS = ['#4a7fb5', '#c9a227', '#7a4a8f', '#3f9e57', '#b5651d', '#d8d8d8', '#5a6b7a', '#8f2f3d'];

function lanePoint(ix, iy, dir, centers) {
  const cx = centers[ix];
  const cy = centers[iy];
  if (dir === 0) return { x: cx, y: cy + LANE };
  if (dir === 1) return { x: cx - LANE, y: cy };
  if (dir === 2) return { x: cx, y: cy - LANE };
  return { x: cx + LANE, y: cy };
}

export function createTraffic(city, random) {
  const cars = [];
  const peds = [];
  const centers = city.centers;
  const maxIndex = centers.length - 1;

  function spawnCar() {
    const type = pick(random, ['sedan', 'sedan', 'taxi', 'van', 'sedan', 'sport']);
    const spec = CAR_TYPES[type];
    const ix = Math.floor(range(random, 1, maxIndex - 1));
    const iy = Math.floor(range(random, 1, maxIndex - 1));
    const dir = Math.floor(random() * 4);
    const point = lanePoint(ix, iy, dir, centers);
    const car = {
      kind: 'traffic', type, spec, color: type === 'taxi' ? '#e8c832' : pick(random, CAR_COLORS),
      x: point.x, y: point.y, angle: Math.atan2(DIRECTIONS[dir].y, DIRECTIONS[dir].x),
      speed: spec.top * range(random, 0.32, 0.45), cruise: spec.top * range(random, 0.32, 0.45),
      ix, iy, dir, health: spec.health, target: null, stuck: 0, active: true, driver: 'traffic',
    };
    car.target = nextTarget(car);
    return car;
  }

  function nextTarget(car) {
    const options = [];
    for (let d = 0; d < 4; d += 1) {
      if (d === (car.dir + 2) % 4) continue; // never reverse
      const nx = car.ix + DIRECTIONS[d].x;
      const ny = car.iy + DIRECTIONS[d].y;
      if (nx < 0 || nx > maxIndex || ny < 0 || ny > maxIndex) continue;
      options.push(d);
    }
    if (options.length === 0) return lanePoint(car.ix, car.iy, car.dir, centers);
    let dir = car.dir;
    const roll = random();
    if (roll < 0.15 && options.includes((car.dir + 1) % 4)) dir = (car.dir + 1) % 4;
    else if (roll < 0.3 && options.includes((car.dir + 3) % 4)) dir = (car.dir + 3) % 4;
    else if (options.includes(car.dir)) dir = car.dir;
    else dir = options[0];
    const nx = car.ix + DIRECTIONS[dir].x;
    const ny = car.iy + DIRECTIONS[dir].y;
    car.dir = dir;
    car.ix = nx;
    car.iy = ny;
    return lanePoint(nx, ny, dir, centers);
  }

  function spawnPed() {
    const point = city.randomSidewalkPoint(random);
    const horizontal = random() < 0.5;
    return {
      x: point.x, y: point.y, angle: horizontal ? 0 : Math.PI / 2,
      speed: range(random, 45, 75), color: pick(random, ['#e07a5f', '#4a7fb5', '#7a4a8f', '#3f9e57', '#c9a227', '#d8d8d8', '#b5651d']),
      state: 'walk', fleeTimer: 0, downTimer: 0, turnTimer: range(random, 1, 4),
    };
  }

  function reset() {
    cars.length = 0;
    peds.length = 0;
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) cars.push(spawnCar());
    for (let i = 0; i < PED_COUNT; i += 1) peds.push(spawnPed());
  }

  function carAhead(car, others, distance) {
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    for (const other of others) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * fx + dy * fy;
      if (ahead > 0 && ahead < distance && Math.abs(dx * fy - dy * fx) < 26) return true;
    }
    return false;
  }

  // One fixed step. `context` carries the player car (for avoidance), the
  // player's position, and the recent gunshots peds flee from. Returns the
  // events the world must answer (a pedestrian was hit).
  function step(dt, context) {
    const events = [];
    const allCars = [...cars, ...context.extraCars];

    for (const car of cars) {
      const dx = car.target.x - car.x;
      const dy = car.target.y - car.y;
      const dist = Math.hypot(dx, dy);
      const wantAngle = Math.atan2(dy, dx);
      let diff = wantAngle - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      const blocked = carAhead(car, allCars, 78);
      const targetSpeed = blocked ? 0 : car.cruise;
      car.speed += Math.max(-260 * dt, Math.min(200 * dt, targetSpeed - car.speed));
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist < 12) car.target = nextTarget(car);
      // A traffic car that hits a pedestrian knocks them down.
      for (const ped of peds) {
        if (ped.state === 'down') continue;
        const px = ped.x - car.x;
        const py = ped.y - car.y;
        if (Math.abs(px) < 30 && Math.abs(py) < 30 && Math.hypot(px, py) < 30 && car.speed > 60) {
          ped.state = 'down';
          ped.downTimer = 6;
          events.push({ type: 'ped-hit', x: ped.x, y: ped.y, byTraffic: true });
        }
      }
    }

    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.fleeTimer = 2.5;
        }
        continue;
      }
      if (ped.state === 'flee') {
        ped.fleeTimer -= dt;
        const away = Math.atan2(ped.y - context.threatY, ped.x - context.threatX);
        ped.angle = away;
        ped.x += Math.cos(away) * ped.speed * 2.3 * dt;
        ped.y += Math.sin(away) * ped.speed * 2.3 * dt;
        const fixed = city.collideCircle(ped.x, ped.y, 10);
        ped.x = fixed.x;
        ped.y = fixed.y;
        if (ped.fleeTimer <= 0) {
          ped.state = 'walk';
          const point = city.randomSidewalkPoint(random);
          ped.x = point.x;
          ped.y = point.y;
        }
        continue;
      }
      // Walking: a fresh gunshot nearby sends them running.
      for (const shot of context.noise) {
        if (Math.hypot(ped.x - shot.x, ped.y - shot.y) < 260) {
          ped.state = 'flee';
          ped.fleeTimer = 2.5;
          context.threatX = shot.x;
          context.threatY = shot.y;
          break;
        }
      }
      if (ped.state !== 'walk') continue;
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.turnTimer = range(random, 2, 6);
        ped.angle += (random() < 0.5 ? -1 : 1) * Math.PI / 2;
      }
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (ped.x < 60 || ped.x > WORLD.size - 60 || ped.y < 60 || ped.y > city.seaTop - 20) {
        ped.angle += Math.PI;
        ped.x = Math.max(60, Math.min(WORLD.size - 60, ped.x));
        ped.y = Math.max(60, Math.min(city.seaTop - 20, ped.y));
      }
      const fixed = city.collideCircle(ped.x, ped.y, 10);
      if (fixed.hit) {
        ped.angle += Math.PI / 2;
        ped.x = fixed.x;
        ped.y = fixed.y;
      }
    }
    return events;
  }

  reset();
  return { cars, peds, reset, step };
}
