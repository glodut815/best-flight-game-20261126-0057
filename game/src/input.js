// Keyboard and mouse input: held keys for the flight model, plus one-shot
// actions (pause, flaps, mute, restart, mission select) the main loop reads.

export function createInput() {
  const held = {
    throttleUp: false,
    throttleDown: false,
    pitchUp: false, // nose up
    pitchDown: false, // nose down
    rollLeft: false,
    rollRight: false,
    flapsToggle: false,
  };
  const actions = {
    pause: false,
    mute: false,
    restart: false,
    confirm: false,
    click: false,
    mission: -1, // 0, 1, 2 when the player picks a mission
  };
  const keyMap = {
    KeyW: 'throttleUp',
    ArrowUp: 'pitchDown',
    ArrowDown: 'pitchUp',
    ArrowLeft: 'rollLeft',
    ArrowRight: 'rollRight',
    KeyA: 'rollLeft',
    KeyD: 'rollRight',
    KeyS: 'throttleDown',
  };

  function onKeyDown(e) {
    if (e.repeat) {
      if (keyMap[e.code]) e.preventDefault();
      return;
    }
    const field = keyMap[e.code];
    if (field) {
      held[field] = true;
      e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'KeyF':
        held.flapsToggle = true;
        break;
      case 'KeyP':
      case 'Escape':
        actions.pause = true;
        break;
      case 'KeyM':
        actions.mute = true;
        break;
      case 'KeyR':
        actions.restart = true;
        break;
      case 'Enter':
      case 'Space':
        actions.confirm = true;
        e.preventDefault();
        break;
      case 'Digit1':
        actions.mission = 0;
        break;
      case 'Digit2':
        actions.mission = 1;
        break;
      case 'Digit3':
        actions.mission = 2;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        held.throttleUp = true;
        break;
      case 'ControlLeft':
      case 'ControlRight':
        held.throttleDown = true;
        break;
      default:
        break;
    }
  }

  function onKeyUp(e) {
    const field = keyMap[e.code];
    if (field) held[field] = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') held.throttleUp = false;
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') held.throttleDown = false;
  }

  function onMouseDown() {
    actions.click = true;
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousedown', onMouseDown);
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('mousedown', onMouseDown);
  }

  // One-shot actions clear after the main loop reads them.
  function consumeActions() {
    const out = { ...actions };
    actions.pause = false;
    actions.mute = false;
    actions.restart = false;
    actions.confirm = false;
    actions.click = false;
    actions.mission = -1;
    return out;
  }

  return { held, actions, attach, detach, consumeActions };
}
