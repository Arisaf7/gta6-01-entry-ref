// SOLMARA — Dario Reyes, on foot and behind the wheel. On foot he walks,
// aims with the mouse, shoots and punches; in a car he drives it with
// arcade physics. Entering a car that is not his is a crime, and the world
// answers that. This module moves the player and reports what happened;
// the world decides the consequences.

import { PLAYER, CAR_TYPES } from './config.js';
import { ACTION_ENTER, ACTION_PUNCH } from './input.js';

export function createPlayer(city) {
  const player = {
    x: 225, y: 300, angle: 0, speed: 0,
    onFoot: true, car: null, health: PLAYER.health,
    money: 0, shootCooldown: 0, punchCooldown: 0,
    lastDamageAt: -100, invulnerable: 0,
  };

  function reset(x, y, money) {
    player.x = x;
    player.y = y;
    player.angle = 0;
    player.speed = 0;
    player.onFoot = true;
    player.car = null;
    player.health = PLAYER.health;
    player.money = money;
    player.shootCooldown = 0;
    player.punchCooldown = 0;
    player.lastDamageAt = -100;
    player.invulnerable = 0;
  }

  function nearestCar(cars, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const car of cars) {
      if (car.driver === 'player') continue;
      const dist = Math.hypot(car.x - player.x, car.y - player.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  // One fixed step. `context` carries the cars, the aim angle, the elapsed
  // time and the input. Returns the events the world must answer.
  function step(dt, input, context) {
    const events = [];
    const elapsed = context.elapsed;
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);
    if (elapsed - player.lastDamageAt > PLAYER.regenDelay && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + PLAYER.regenRate * dt);
    }

    const actions = input.takeActions();

    if (player.onFoot) {
      const move = input.moveVector();
      player.x += move.x * PLAYER.walkSpeed * dt;
      player.y += move.y * PLAYER.walkSpeed * dt;
      player.angle = context.aimAngle;
      const fixed = city.collideCircle(player.x, player.y, PLAYER.radius);
      player.x = fixed.x;
      player.y = fixed.y;

      if ((input.mouse.down || input.isDown('Space')) && player.shootCooldown <= 0) {
        player.shootCooldown = PLAYER.shootCooldown;
        events.push({ type: 'shoot', x: player.x, y: player.y, angle: player.angle });
      }
      if (actions & ACTION_PUNCH && player.punchCooldown <= 0) {
        player.punchCooldown = PLAYER.punchCooldown;
        events.push({ type: 'punch', x: player.x + Math.cos(player.angle) * 24, y: player.y + Math.sin(player.angle) * 24 });
      }
      if (actions & ACTION_ENTER) {
        const car = nearestCar(context.cars, 72);
        if (car) events.push({ type: 'enter-car', car });
      }
    } else if (player.car) {
      const car = player.car;
      const spec = car.spec;
      const forward = input.isDown('KeyW', 'ArrowUp');
      const reverse = input.isDown('KeyS', 'ArrowDown');
      const steerLeft = input.isDown('KeyA', 'ArrowLeft');
      const steerRight = input.isDown('KeyD', 'ArrowRight');
      const handbrake = input.isDown('Space');

      if (forward) car.speed += spec.accel * dt;
      else if (reverse) car.speed -= spec.brake * 0.7 * dt;
      else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
      if (handbrake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 700 * dt);
      car.speed = Math.max(-spec.top * 0.45, Math.min(spec.top, car.speed));

      const steer = (steerLeft ? -1 : 0) + (steerRight ? 1 : 0);
      const grip = spec.grip * (handbrake ? 1.7 : 1);
      car.angle += steer * grip * (car.speed / spec.top) * dt * (car.speed < 0 ? -1 : 1);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      const fixed = city.collideCircle(car.x, car.y, 20);
      if (fixed.hit) {
        if (Math.abs(car.speed) > 240) {
          events.push({ type: 'crash', x: car.x, y: car.y, speed: Math.abs(car.speed) });
        }
        car.x = fixed.x;
        car.y = fixed.y;
        car.speed *= 0.45;
      }
      player.x = car.x;
      player.y = car.y;
      player.angle = car.angle;
      player.speed = car.speed;

      if (actions & ACTION_ENTER) events.push({ type: 'exit-car', car });
    }
    return events;
  }

  function damage(amount, elapsed) {
    if (player.invulnerable > 0) return false;
    player.health -= amount;
    player.lastDamageAt = elapsed;
    player.invulnerable = 0.6;
    return player.health <= 0;
  }

  return { player, reset, step, damage, nearestCar };
}

export { CAR_TYPES };
