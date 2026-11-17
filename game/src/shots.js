// SOLMARA — the screenshot scenes behind ?shot=chase|foot|mission|menu.
// Each one plays the real rules forward from a fresh world with a fixed
// seed, so the frame is what a short game really looks like and the same
// seed always gives the same frame. The cover is a chase: the player in a
// sports car, three stars, cruisers behind, the minimap and the mission
// objective all on the HUD at once.

import { CAR_TYPES, BANK, DOCKS, HOTEL, HIDEOUT } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const VIEW = { w: 1280, h: 720 };

function silentAudio() {
  const noop = () => {};
  return {
    unlock: noop, setMuted: noop, isMuted: () => true, shot: noop, punch: noop,
    pickup: noop, cash: noop, missionDone: noop, missionFail: noop, busted: noop,
    crash: noop, engine: noop, engineOff: noop, siren: noop, startMusic: noop,
  };
}

function autoInput(drive) {
  return {
    moveVector: () => ({ x: 0, y: 0 }),
    mouse: { x: 640, y: 360, down: false },
    isDown: (code) => drive && code === 'KeyW',
    takeActions: () => 0,
    consumeRestart: () => false,
    muteToggle: () => false,
    keys: new Set(),
  };
}

function driveSteps(world, audio, seconds, drive) {
  const input = autoInput(drive);
  const steps = Math.floor(seconds * 60);
  for (let i = 0; i < steps; i += 1) world.step(1 / 60, input, audio, VIEW);
}

function putPlayerInCar(world, type, x, y, angle, speed) {
  const state = world.state;
  const car = {
    kind: 'player', type, driver: 'player', active: true,
    spec: CAR_TYPES[type], color: CAR_TYPES[type].color,
    x, y, angle, speed, health: CAR_TYPES[type].health,
  };
  state.player.car = car;
  state.player.onFoot = false;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
  state.player.speed = speed;
  state.camera.x = x;
  state.camera.y = y;
  return car;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * Names: chase (cover), foot, mission, menu; anything else is menu.
 */
export function stageShot(name, world) {
  const audio = silentAudio();
  const state = world.state;
  world.reset();

  if (name === 'chase') {
    // Mission 5, second step: the escape. The player already grabbed the
    // cash at the bank, the alarm tripped the heat, and now the cruisers
    // are on him in a sports car heading for the hideout.
    state.missions.start(4, { police: state.police, elapsed: 0 });
    state.player.x = BANK.x;
    state.player.y = BANK.y;
    state.missions.update(1 / 60, {
      player: state.player, police: state.police, city: state.city,
      random: () => 0.5, elapsed: 0,
    });
    putPlayerInCar(world, 'sport', 1350, 1350, 0, 300);
    state.player.money = 1250;
    driveSteps(world, audio, 4.5, true);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'foot') {
    // On foot by the Coral Hotel, mission 2 waiting, traffic and
    // pedestrians going about their day.
    state.missions.start(1, { police: state.police, elapsed: 0 });
    state.player.x = HOTEL.x;
    state.player.y = HOTEL.y + 120;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    driveSteps(world, audio, 1.2, false);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // Mission 2, second step: the package is in the taxi at the docks and
    // the clock is running to the Coral Hotel.
    state.missions.start(1, { police: state.police, elapsed: 0 });
    state.player.x = DOCKS.x;
    state.player.y = DOCKS.y;
    state.missions.update(1 / 60, {
      player: state.player, police: state.police, city: state.city,
      random: () => 0.5, elapsed: 0,
    });
    putPlayerInCar(world, 'taxi', 2700, 1350, Math.PI, 120);
    state.player.money = 150;
    driveSteps(world, audio, 1.0, true);
    return { screen: SCREEN_PLAY };
  }

  // Menu: the city alive behind the title.
  state.camera.x = 1800;
  state.camera.y = 1800;
  driveSteps(world, audio, 3, false);
  state.camera.x = 1800;
  state.camera.y = 1800;
  return { screen: SCREEN_TITLE };
}
