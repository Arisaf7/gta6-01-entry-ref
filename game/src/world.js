// SOLMARA — the world: everything the game is, in one place, and the one
// fixed step that advances it. The world owns the city, the traffic, the
// police, the missions, the player, the bullets and the particles, and turns
// their reports into consequences: heat for crimes, damage for crashes,
// money for jobs done.

import { STEP, PLAYER, WANTED, HIDEOUT } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createPlayer } from './player.js';

export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION = 4;

export function createWorld(random, save) {
  const city = createCity(random);
  const traffic = createTraffic(city, random);
  const police = createPolice(city, random);
  const missions = createMissions(save);
  const playerApi = createPlayer(city);
  const player = playerApi.player;

  const state = {
    city, traffic, police, missions, player,
    bullets: [], particles: [], pickups: [], parkedCars: [],
    elapsed: 0, aimAngle: 0,
    camera: { x: player.x, y: player.y },
    noise: [], shake: 0,
  };

  function spawnParkedCars() {
    state.parkedCars.length = 0;
    const types = ['sedan', 'sedan', 'taxi', 'van', 'sport'];
    for (let i = 0; i < 9; i += 1) {
      const point = city.randomRoadPoint(random, HIDEOUT.x, HIDEOUT.y, 300);
      const horizontal = random() < 0.5;
      const type = types[i % types.length];
      const car = {
        kind: 'parked', type, driver: 'parked', active: true,
        spec: null, color: type === 'taxi' ? '#e8c832' : ['#4a7fb5', '#7a4a8f', '#3f9e57', '#c9a227', '#8f2f3d'][i % 5],
        x: point.x, y: point.y, angle: horizontal ? 0 : Math.PI / 2,
        speed: 0, health: 100,
      };
      // Parked cars sit on the road's edge, not its middle.
      car.x += horizontal ? 0 : 38;
      car.y += horizontal ? 38 : 0;
      state.parkedCars.push(car);
    }
  }

  function spawnPickups() {
    state.pickups.length = 0;
    const spots = [
      { kind: 'health', x: 675, y: 675 },
      { kind: 'health', x: 2475, y: 2475 },
      { kind: 'health', x: 1125, y: 2925 },
      { kind: 'cash', x: 2025, y: 675 },
      { kind: 'cash', x: 675, y: 2025 },
      { kind: 'cash', x: 2925, y: 1125 },
      { kind: 'cash', x: 1125, y: 1575 },
      { kind: 'cash', x: 2475, y: 3375 },
      { kind: 'cash', x: 3375, y: 2475 },
    ];
    for (const spot of spots) state.pickups.push({ ...spot, taken: false });
  }

  function reset() {
    playerApi.reset(HIDEOUT.x, HIDEOUT.y + 70, save?.money ?? 0);
    traffic.reset();
    police.reset();
    missions.abort();
    state.bullets.length = 0;
    state.particles.length = 0;
    state.elapsed = 0;
    state.noise.length = 0;
    state.shake = 0;
    state.camera.x = player.x;
    state.camera.y = player.y;
    spawnParkedCars();
    spawnPickups();
  }

  function startMission() {
    if (missions.index < 5) {
      missions.start(missions.index, { police, elapsed: state.elapsed });
    }
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const velocity = speed * (0.4 + random() * 0.8);
      state.particles.push({
        x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
        life: 0.5 + random() * 0.5, maxLife: 1, color, size: 2 + random() * 3,
      });
    }
  }

  function allEnterableCars() {
    return [...state.parkedCars, ...traffic.cars];
  }

  function allSolidCars() {
    const list = [...traffic.cars, ...police.cars, ...state.parkedCars];
    if (missions.courier) list.push(missions.courier);
    if (player.car) list.push(player.car);
    return list;
  }

  // One fixed step. Returns the events the screens must answer.
  function step(dt, input, audio, view) {
    const events = [];
    state.elapsed += dt;

    // The mouse aims in screen space; the player faces the world point under it.
    const aimX = state.camera.x + (input.mouse.x - view.w / 2);
    const aimY = state.camera.y + (input.mouse.y - view.h / 2);
    state.aimAngle = Math.atan2(aimY - player.y, aimX - player.x);

    const playerEvents = playerApi.step(dt, input, {
      cars: allEnterableCars(), aimAngle: state.aimAngle, elapsed: state.elapsed,
    });

    for (const event of playerEvents) {
      if (event.type === 'shoot') {
        state.bullets.push({
          x: event.x, y: event.y,
          vx: Math.cos(event.angle) * PLAYER.bulletSpeed,
          vy: Math.sin(event.angle) * PLAYER.bulletSpeed,
          life: 1.1,
        });
        state.noise.push({ x: event.x, y: event.y, t: state.elapsed });
        audio.shot();
        const copNear = police.cars.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < WANTED.shotNoiseRadius);
        if (copNear) police.addHeat(WANTED.shotNoiseHeat, state.elapsed);
      } else if (event.type === 'punch') {
        audio.punch();
        for (const ped of traffic.peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(ped.x - event.x, ped.y - event.y) < 42) {
            ped.state = 'down';
            ped.downTimer = 5;
            police.addHeat(WANTED.hitPedHeat, state.elapsed);
            burst(ped.x, ped.y, '#e8e8e8', 8, 120);
            break;
          }
        }
      } else if (event.type === 'enter-car') {
        const car = event.car;
        car.driver = 'player';
        car.spec = car.spec ?? { top: 320, accel: 300, brake: 520, grip: 2.6, health: 100, length: 48, width: 24 };
        car.health = car.spec.health;
        player.onFoot = false;
        player.car = car;
        const parkedIndex = state.parkedCars.indexOf(car);
        if (parkedIndex !== -1) state.parkedCars.splice(parkedIndex, 1);
        const trafficIndex = traffic.cars.indexOf(car);
        if (trafficIndex !== -1) traffic.cars.splice(trafficIndex, 1);
        police.addHeat(WANTED.stealHeat, state.elapsed);
        audio.pickup();
      } else if (event.type === 'exit-car') {
        const car = event.car;
        car.driver = 'parked';
        car.speed = 0;
        player.onFoot = true;
        player.car = null;
        player.x = car.x - Math.sin(car.angle) * 34;
        player.y = car.y + Math.cos(car.angle) * 34;
        state.parkedCars.push(car);
      } else if (event.type === 'crash') {
        audio.crash();
        state.shake = 0.35;
        burst(event.x, event.y, '#c9c9c9', 10, 160);
        if (player.car) {
          player.car.health -= 12;
          if (player.car.health <= 0) {
            burst(player.car.x, player.car.y, '#ff7a3c', 26, 260);
            player.onFoot = true;
            player.car = null;
          }
        }
      }
    }

    const extraCars = [...police.cars];
    if (player.car) extraCars.push(player.car);
    if (missions.courier) extraCars.push(missions.courier);
    traffic.step(dt, {
      extraCars, noise: state.noise,
      threatX: player.x, threatY: player.y,
    });

    const policeEvents = police.step(dt, {
      player, elapsed: state.elapsed, onFoot: player.onFoot,
      inHideout: Math.hypot(player.x - HIDEOUT.x, player.y - HIDEOUT.y) < HIDEOUT.radius,
    });
    for (const event of policeEvents) {
      if (event.type === 'busted') {
        events.push({ type: 'busted' });
        audio.busted();
      }
    }

    const missionEvents = missions.update(dt, {
      player, police, city, random, elapsed: state.elapsed,
    });
    for (const event of missionEvents) {
      if (event.type === 'mission-complete') {
        player.money += event.mission.reward;
        audio.missionDone();
        events.push({ type: 'mission-complete', mission: event.mission });
      } else if (event.type === 'mission-fail') {
        audio.missionFail();
        events.push({ type: 'mission-fail', reason: event.reason });
      } else if (event.type === 'step-complete') {
        audio.cash();
        events.push({ type: 'step-complete' });
      }
    }

    // Bullets fly, spark on walls, drop pedestrians and punch holes in cars.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let dead = bullet.life <= 0;
      if (!dead && city.buildingAt(bullet.x, bullet.y)) {
        burst(bullet.x, bullet.y, '#e8d24a', 5, 120);
        dead = true;
      }
      if (!dead) {
        for (const ped of traffic.peds) {
          if (ped.state === 'down') continue;
          if (Math.hypot(ped.x - bullet.x, ped.y - bullet.y) < 14) {
            ped.state = 'down';
            ped.downTimer = 6;
            police.addHeat(WANTED.killPedHeat, state.elapsed);
            burst(ped.x, ped.y, '#c23b4e', 10, 160);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of [...police.cars, ...traffic.cars]) {
          if (Math.hypot(car.x - bullet.x, car.y - bullet.y) < 24) {
            car.health -= PLAYER.bulletDamage;
            burst(bullet.x, bullet.y, '#e8d24a', 6, 140);
            dead = true;
            if (car.health <= 0) {
              burst(car.x, car.y, '#ff7a3c', 30, 300);
              state.shake = 0.4;
              if (car.kind === 'police') {
                police.addHeat(WANTED.shootCopHeat, state.elapsed);
                const index = police.cars.indexOf(car);
                if (index !== -1) police.cars.splice(index, 1);
              } else {
                car.speed = 0;
                const index = traffic.cars.indexOf(car);
                if (index !== -1) traffic.cars.splice(index, 1);
              }
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }

    // The player's car against the world: other cars, pedestrians, cops.
    if (player.car) {
      const car = player.car;
      for (const other of allSolidCars()) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 44 && dist > 0.01) {
          const push = (44 - dist) / 2;
          const nx = dx / dist;
          const ny = dy / dist;
          car.x -= nx * push;
          car.y -= ny * push;
          if (other.kind !== 'police' && other.driver !== 'player') {
            other.x += nx * push;
            other.y += ny * push;
          }
          if (Math.abs(car.speed) > 200) {
            car.health -= 8;
            if (other.health !== undefined) other.health -= 8;
            audio.crash();
            state.shake = 0.3;
            if (car.health <= 0) {
              burst(car.x, car.y, '#ff7a3c', 26, 260);
              player.onFoot = true;
              player.car = null;
              break;
            }
          }
        }
      }
      for (const ped of traffic.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - car.x, ped.y - car.y) < 28 && Math.abs(car.speed) > 60) {
          ped.state = 'down';
          ped.downTimer = 6;
          police.addHeat(Math.abs(car.speed) > 220 ? WANTED.killPedHeat : WANTED.hitPedHeat, state.elapsed);
          burst(ped.x, ped.y, '#c23b4e', 10, 160);
          state.shake = 0.25;
        }
      }
      // A cruiser ramming the player on foot, or the player, hurts.
      for (const cruiser of police.cars) {
        if (!player.onFoot && Math.hypot(cruiser.x - car.x, cruiser.y - car.y) < 40) {
          player.health -= 0;
        }
      }
    } else {
      for (const cruiser of police.cars) {
        if (Math.hypot(cruiser.x - player.x, cruiser.y - player.y) < 32) {
          if (playerApi.damage(14, state.elapsed)) {
            events.push({ type: 'wasted' });
            audio.busted();
          }
          const away = Math.atan2(player.y - cruiser.y, player.x - cruiser.x);
          player.x += Math.cos(away) * 30;
          player.y += Math.sin(away) * 30;
          break;
        }
      }
    }

    // Pickups: health kits mend, cash is cash.
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      if (Math.hypot(pickup.x - player.x, pickup.y - player.y) < 32) {
        pickup.taken = true;
        if (pickup.kind === 'health') {
          player.health = Math.min(PLAYER.health, player.health + 40);
          audio.pickup();
        } else {
          player.money += 50;
          audio.cash();
        }
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.96;
      particle.vy *= 0.96;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }

    state.noise = state.noise.filter((shot) => state.elapsed - shot.t < 1.5);
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);

    // The camera follows the player and stays inside the city.
    const targetX = Math.max(view.w / 2, Math.min(3600 - view.w / 2, player.x));
    const targetY = Math.max(view.h / 2, Math.min(3600 - view.h / 2, player.y));
    state.camera.x += (targetX - state.camera.x) * Math.min(1, 8 * dt);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, 8 * dt);

    if (player.car) audio.engine(Math.abs(player.car.speed) / player.car.spec.top);
    else audio.engineOff();
    const sirenNear = police.cars.some((car) => Math.hypot(car.x - player.x, car.y - player.y) < 700);
    audio.siren(sirenNear && police.state.stars > 0);

    return events;
  }

  reset();
  return { state, reset, step, startMission, burst };
}
