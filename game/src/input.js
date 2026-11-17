// SOLMARA — keyboard and mouse, read once per frame. Movement comes from
// WASD or the arrow keys; the mouse aims; single presses are consumed so a
// key tap fires exactly one action.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false };

  function code(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(event.code);
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouse.down = true;
    if (event.button === 2) pressed.add('MouseRight');
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function isDown(...codes) {
    return codes.some((c) => keys.has(c));
  }

  // The WASD / arrow movement vector, normalised.
  function moveVector() {
    let x = 0;
    let y = 0;
    if (isDown('KeyA', 'ArrowLeft')) x -= 1;
    if (isDown('KeyD', 'ArrowRight')) x += 1;
    if (isDown('KeyW', 'ArrowUp')) y -= 1;
    if (isDown('KeyS', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  // One-shot actions, consumed when read: Enter/Space/click confirm,
  // P or Escape pauses, E enters a car, F punches, R restarts.
  function takeActions() {
    let actions = 0;
    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('MouseRight')) actions |= ACTION_CONFIRM;
    if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
    if (pressed.has('KeyE')) actions |= ACTION_ENTER;
    if (pressed.has('KeyF')) actions |= ACTION_PUNCH;
    pressed.clear();
    return actions;
  }

  function consumeRestart() {
    const hit = pressed.has('KeyR');
    pressed.delete('KeyR');
    return hit;
  }

  function muteToggle() {
    const hit = pressed.has('KeyM');
    pressed.delete('KeyM');
    return hit;
  }

  return { isDown, moveVector, takeActions, consumeRestart, muteToggle, mouse, keys };
}
