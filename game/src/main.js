// SOLMARA — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between five
// screens: title, briefing, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=chase|foot|mission|menu (with &seed=N)
// stages that scene instead of running the loop, paints it twice and marks
// the document ready for a screenshot.

import { STEP, MISSIONS } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_WASTED, EVENT_MISSION } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_BRIEFING } from './render.js';
import { stageShot } from './shots.js';
import { loadSave, writeSave } from './save.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const save = loadSave();
const world = createWorld(createRandom(seed), save);
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { save, banner: null, bannerSub: null });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else document.title = 'shot-ready';
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let banner = null;
  let bannerSub = null;
  let bannerUntil = 0;
  let overTitle = '';
  let overText = '';
  let overColor = '#ff4d3d';
  let briefing = null;
  let failInfo = null;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function persist() {
    save.money = world.state.player.money;
    save.missionsDone = [...world.state.missions.done].sort((a, b) => a - b);
    writeSave(save);
  }

  function showBriefing(missionIndex) {
    const mission = MISSIONS[missionIndex];
    if (!mission) {
      screen = SCREEN_PLAY;
      announce('Free roam. All jobs done — Solmara is yours.');
      return;
    }
    briefing = mission;
    screen = SCREEN_BRIEFING;
    announce(`Job ${mission.id}: ${mission.name}. ${mission.briefing}`);
  }

  function startGame() {
    audio.unlock();
    audio.startMusic();
    world.reset();
    world.state.player.money = save.money;
    banner = null;
    failInfo = null;
    showBriefing(world.state.missions.index);
  }

  function beginMission() {
    audio.unlock();
    world.startMission();
    screen = SCREEN_PLAY;
    announce(`Job started. ${world.state.missions.objectiveText()}`);
  }

  function endGame(title, text, color) {
    overTitle = title;
    overText = text;
    overColor = color;
    screen = SCREEN_OVER;
    persist();
    announce(`${title}. ${text}`);
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event.type === 'busted') {
        endGame('BUSTED', 'The Solmara PD caught you. Mama Rosa will post your bail — this time.', '#ff4d3d');
      } else if (event.type === 'wasted') {
        endGame('WASTED', 'Dario is down. The city keeps moving without you.', '#ff4d3d');
      } else if (event.type === 'mission-complete') {
        banner = `JOB COMPLETE — ${event.mission.name}`;
        bannerSub = `+$${event.mission.reward}  •  $${world.state.player.money}`;
        bannerUntil = world.state.elapsed + 3.5;
        persist();
        announce(`Job complete: ${event.mission.name}. $${event.mission.reward}.`);
        if (world.state.missions.index >= MISSIONS.length) {
          bannerSub = `All 5 jobs done — Solmara is yours. $${world.state.player.money}`;
        }
      } else if (event.type === 'mission-fail') {
        failInfo = event.reason;
        banner = 'MISSION FAILED';
        bannerSub = event.reason;
        bannerUntil = world.state.elapsed + 4;
        world.state.missions.abort();
        announce(`Mission failed. ${event.reason}`);
      } else if (event.type === 'step-complete') {
        banner = 'STEP DONE';
        bannerSub = world.state.missions.objectiveText();
        bannerUntil = world.state.elapsed + 2.5;
      }
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (input.muteToggle()) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startGame();
    } else if (screen === SCREEN_BRIEFING) {
      if (actions & ACTION_CONFIRM) beginMission();
    } else if (screen === SCREEN_PLAY) {
      if (failInfo && (actions & ACTION_CONFIRM)) {
        failInfo = null;
        banner = null;
        showBriefing(world.state.missions.index);
        return;
      }
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (screen === SCREEN_OVER) {
      if (input.consumeRestart()) {
        startGame();
      } else if (actions & ACTION_CONFIRM) {
        screen = SCREEN_TITLE;
        world.reset();
        announce('Solmara. Press Enter or click to start.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, input, audio, { w: canvas.width, h: canvas.height });
        handleEvents(events);
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    const overlay = {
      save,
      banner: world.state.elapsed < bannerUntil ? banner : null,
      bannerSub: world.state.elapsed < bannerUntil ? bannerSub : null,
      bannerColor: banner === 'MISSION FAILED' ? '#ff4d3d' : '#ffd23e',
      briefing,
      overTitle, overText, overColor,
    };
    renderer.draw(world.state, screen, overlay);
  }

  // Leaving the tab pauses a running game rather than letting the heat rise unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  canvas.addEventListener('mousedown', () => audio.unlock());
  announce('Solmara. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
