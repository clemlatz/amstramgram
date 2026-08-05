// Shared right-hand-only control scheme, exposed as device-agnostic actions:
// A favorite, B archive, X mute, ZR play/pause a video else next carousel slide
// (loops), R previous slide. D-pad is VR-only: left/right adjusts the selected
// calibration parameter, up/down selects which one.
export const PAD = {
  FAVORITE: 'favorite',
  ARCHIVE: 'archive',
  MUTE: 'mute',
  R: 'r',
  ZR: 'zr',
  DUP: 'dup',
  DDOWN: 'ddown',
  DLEFT: 'dleft',
  DRIGHT: 'dright'
};

// Raw button index -> action, per controller. Indices are empirical (tested
// in Safari on macOS), since browsers don't standardize Nintendo mappings.
//
// Switch Pro Controller, held with both hands, right-hand buttons only: the
// physical A button reports as index 0 and B as index 1 (Nintendo's A/B are
// mirrored versus the W3C standard layout), while X reports as index 3.
const PRO_CONTROLLER_MAP = {
  0: PAD.FAVORITE,
  1: PAD.ARCHIVE,
  3: PAD.MUTE,
  5: PAD.R,
  7: PAD.ZR,
  12: PAD.DUP,
  13: PAD.DDOWN,
  14: PAD.DLEFT,
  15: PAD.DRIGHT
};

// A lone Joy-Con (R) has no R/ZR triggers reachable from the browser — macOS
// reports it via Nintendo's single-Joy-Con convention, which reserves those
// for two-handed grips and leaves SL/SR as the only shoulder-equivalent
// inputs. SL/SR stand in for R/ZR here. It also has no physical D-pad; macOS
// synthesizes one from the analog stick, with a layout rotated relative to
// the Pro Controller's real D-pad.
const JOYCON_R_MAP = {
  0: PAD.FAVORITE, // A
  1: PAD.ARCHIVE, // B
  2: PAD.MUTE, // X
  4: PAD.R, // SL
  5: PAD.ZR, // SR
  15: PAD.DUP,
  13: PAD.DRIGHT,
  14: PAD.DDOWN,
  12: PAD.DLEFT
};

function mapForPad(pad) {
  return pad.id.includes('Joy-Con') ? JOYCON_R_MAP : PRO_CONTROLLER_MAP;
}

// Poll the first connected gamepad and emit a press-edge (PAD action) each
// time a mapped button transitions from released to pressed. onConnection
// fires when the connected/disconnected state changes. Returns { start, stop }.
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
      const map = mapForPad(pad);
      for (let i = 0; i < pad.buttons.length; i++) {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        if (now && !prev[i] && map[i]) onPress?.(map[i]);
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
