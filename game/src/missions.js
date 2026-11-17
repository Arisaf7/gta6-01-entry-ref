// SOLMARA — Mama Rosa's five story jobs. A mission is a list of steps, each
// one kind of work: go somewhere, drive somewhere, follow a car, deliver
// against the clock, lose the heat, or escape to the hideout. The state
// machine checks the current step every frame and reports what changed.

import { MISSIONS } from './config.js';
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

export function createMissions(save) {
  const done = new Set(save?.missionsDone ?? []);
  let index = 0;
  while (index < MISSIONS.length && done.has(MISSIONS[index].id)) index += 1;
  let active = null;
  let courier = null;

  function start(missionIndex, context) {
    index = missionIndex;
    const mission = MISSIONS[index];
    active = { mission, stepIndex: 0, timer: 0, followTime: 0, lostTime: 0, started: false };
    courier = null;
    if (mission.id === 4) context.police.addHeat(60, context.elapsed);
    return active;
  }

  function currentStep() {
    if (!active) return null;
    return active.mission.steps[active.stepIndex] ?? null;
  }

  function objectiveText() {
    const step = currentStep();
    if (!step) return 'All jobs done — Solmara is yours.';
    if (step.type === 'deliver' && active.timer > 0) {
      return `${step.text} — ${Math.ceil(active.timer)}s left`;
    }
    return step.text;
  }

  function marker() {
    const step = currentStep();
    if (!step) return null;
    if (step.type === 'follow' && courier) return { x: courier.x, y: courier.y, kind: 'follow' };
    if (step.type === 'lose') return null;
    return { x: step.x, y: step.y, kind: 'goto' };
  }

  function spawnCourier(city, random) {
    const centers = city.centers;
    const maxIndex = centers.length - 1;
    const ix = Math.floor(2 + random() * 4);
    const iy = Math.floor(2 + random() * 4);
    courier = {
      kind: 'courier', type: 'sedan', color: '#2f6fb5',
      x: centers[ix], y: centers[iy] + LANE, angle: 0, speed: 130,
      ix, iy, dir: 0, target: lanePoint(ix + 1, iy, 0, centers), health: 100,
    };
    return courier;
  }

  function stepCourier(dt, city, random) {
    if (!courier) return;
    const centers = city.centers;
    const maxIndex = centers.length - 1;
    const dx = courier.target.x - courier.x;
    const dy = courier.target.y - courier.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - courier.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    courier.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    courier.x += Math.cos(courier.angle) * courier.speed * dt;
    courier.y += Math.sin(courier.angle) * courier.speed * dt;
    if (dist < 12) {
      const options = [];
      for (let d = 0; d < 4; d += 1) {
        if (d === (courier.dir + 2) % 4) continue;
        const nx = courier.ix + DIRECTIONS[d].x;
        const ny = courier.iy + DIRECTIONS[d].y;
        if (nx < 0 || nx > maxIndex || ny < 0 || ny > maxIndex) continue;
        options.push(d);
      }
      let dir = courier.dir;
      const roll = random();
      if (roll < 0.15 && options.includes((courier.dir + 1) % 4)) dir = (courier.dir + 1) % 4;
      else if (roll < 0.3 && options.includes((courier.dir + 3) % 4)) dir = (courier.dir + 3) % 4;
      else if (options.includes(courier.dir)) dir = courier.dir;
      else if (options.length > 0) dir = options[0];
      courier.dir = dir;
      courier.ix += DIRECTIONS[dir].x;
      courier.iy += DIRECTIONS[dir].y;
      courier.target = lanePoint(courier.ix, courier.iy, dir, centers);
    }
  }

  // One fixed step. `context` carries the player, the police, the city and
  // the clock. Returns the events the world must answer.
  function update(dt, context) {
    const events = [];
    if (!active) return events;
    const step = currentStep();
    if (!step) return events;
    const player = context.player;

    if (step.type === 'follow' && !courier) {
      spawnCourier(context.city, context.random);
      events.push({ type: 'courier-spawned', car: courier });
    }
    if (courier) stepCourier(dt, context.city, context.random);

    if (!active.started) {
      active.started = true;
      if (step.type === 'deliver') active.timer = step.time;
      if (active.mission.id === 5 && active.stepIndex === 1) {
        context.police.addHeat(70, context.elapsed);
      }
    }

    if (step.type === 'deliver') {
      active.timer -= dt;
      if (active.timer <= 0) {
        events.push({ type: 'mission-fail', reason: 'Out of time.' });
        return events;
      }
    }

    let done = false;
    if (step.type === 'goto' || step.type === 'drive' || step.type === 'deliver' || step.type === 'escape') {
      const dist = Math.hypot(player.x - step.x, player.y - step.y);
      done = dist < step.radius && (step.type !== 'drive' || !player.onFoot);
    } else if (step.type === 'follow' && courier) {
      const dist = Math.hypot(player.x - courier.x, player.y - courier.y);
      if (dist < 60) {
        events.push({ type: 'mission-fail', reason: 'Spotted! The courier made you.' });
        return events;
      }
      if (dist > 420) {
        active.lostTime += dt;
        if (active.lostTime > 4) {
          events.push({ type: 'mission-fail', reason: 'Lost the courier.' });
          return events;
        }
      } else {
        active.lostTime = 0;
        active.followTime += dt;
        if (active.followTime >= step.seconds) done = true;
      }
    } else if (step.type === 'lose') {
      done = context.police.state.stars === 0;
    }

    if (done) {
      active.stepIndex += 1;
      if (active.stepIndex >= active.mission.steps.length) {
        events.push({ type: 'mission-complete', mission: active.mission });
        done.add(active.mission.id);
        courier = null;
        active = null;
      } else {
        active.started = false;
        events.push({ type: 'step-complete' });
      }
    }
    return events;
  }

  function abort() {
    courier = null;
    active = null;
  }

  return {
    done, get index() { return index; }, get active() { return active; },
    get courier() { return courier; },
    start, currentStep, objectiveText, marker, update, abort,
  };
}
