// SOLMARA — the save file: cash and finished jobs, kept in localStorage
// so the player picks up where they left off. Nothing else is stored.

import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 0, missionsDone: [] };
    const parsed = JSON.parse(raw);
    return {
      money: typeof parsed.money === 'number' ? parsed.money : 0,
      missionsDone: Array.isArray(parsed.missionsDone) ? parsed.missionsDone.filter((id) => Number.isInteger(id)) : [],
    };
  } catch {
    return { money: 0, missionsDone: [] };
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: save.money,
      missionsDone: save.missionsDone,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
