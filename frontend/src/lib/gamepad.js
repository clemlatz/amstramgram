// Shared right-hand-only Pro Controller scheme (W3C standard mapping):
// A favorite, B archive, X mute, ZR play/pause a video else next carousel slide
// (loops), R previous slide. D-pad left/right is VR-only (adjusts separation).
// Indices are empirical for a Switch Pro Controller in Safari: the physical A
// button reports as index 0 and B as index 1 (Nintendo's A/B are mirrored
// versus the W3C standard layout), while X reports as index 3.
export const PAD = { FAVORITE: 0, ARCHIVE: 1, MUTE: 3, R: 5, ZR: 7, DLEFT: 14, DRIGHT: 15 };

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
