// Shared right-hand-only Pro Controller scheme (W3C standard mapping):
// A favorite, B archive, X mute, ZR play/pause a video else next carousel slide
// (loops), R previous slide.
// Indices are for the standard gamepad layout; on a Switch Pro Controller the
// face buttons map by position (face-bottom = physical B, face-right = A,
// face-top = X).
export const PAD = { ARCHIVE: 0, FAVORITE: 1, MUTE: 3, R: 5, ZR: 7 };

// Poll the first connected gamepad and emit a press-edge (button index) each
// time a button transitions from released to pressed. onConnection fires when
// the connected/disconnected state changes. Returns { start, stop }.
export function createGamepadWatcher({ onPress, onConnection } = {}) {
  let raf = 0;
  let connected = false;
  const prev = [];

  function loop() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p) {
        pad = p;
        break;
      }
    }
    if (!!pad !== connected) {
      connected = !!pad;
      onConnection?.(connected);
    }
    if (pad) {
      for (let i = 0; i < pad.buttons.length; i++) {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        if (now && !prev[i]) onPress?.(i);
        prev[i] = now;
      }
    }
    raf = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (!raf) loop();
    },
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };
}
