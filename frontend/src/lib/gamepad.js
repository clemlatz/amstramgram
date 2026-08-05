// Shared right-hand-only control scheme, exposed as device-agnostic actions:
// A favorite, B archive, X mute, ZR play/pause a video else next carousel slide
// (loops), R previous slide, + shows the bindings overlay. D-pad is VR-only:
// left/right adjusts the selected calibration parameter, up/down selects
// which one.
export const PAD = {
  FAVORITE: 'favorite',
  ARCHIVE: 'archive',
  MUTE: 'mute',
  R: 'r',
  ZR: 'zr',
  DUP: 'dup',
  DDOWN: 'ddown',
  DLEFT: 'dleft',
  DRIGHT: 'dright',
  HELP: 'help'
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
  9: PAD.HELP,
  12: PAD.DUP,
  13: PAD.DDOWN,
  14: PAD.DLEFT,
  15: PAD.DRIGHT
};

const PRO_CONTROLLER_LABELS = {
  [PAD.FAVORITE]: 'A',
  [PAD.ARCHIVE]: 'B',
  [PAD.MUTE]: 'X',
  [PAD.R]: 'R',
  [PAD.ZR]: 'ZR',
  [PAD.HELP]: '+',
  [PAD.DUP]: 'D-pad ↑',
  [PAD.DDOWN]: 'D-pad ↓',
  [PAD.DLEFT]: 'D-pad ←',
  [PAD.DRIGHT]: 'D-pad →'
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
  9: PAD.HELP, // +
  15: PAD.DUP,
  13: PAD.DRIGHT,
  14: PAD.DDOWN,
  12: PAD.DLEFT
};

const JOYCON_R_LABELS = {
  [PAD.FAVORITE]: 'A',
  [PAD.ARCHIVE]: 'B',
  [PAD.MUTE]: 'X',
  [PAD.R]: 'SL',
  [PAD.ZR]: 'SR',
  [PAD.HELP]: '+',
  [PAD.DUP]: 'stick ↑',
  [PAD.DDOWN]: 'stick ↓',
  [PAD.DLEFT]: 'stick ←',
  [PAD.DRIGHT]: 'stick →'
};

function schemeForId(id) {
  return id?.includes('Joy-Con')
    ? { map: JOYCON_R_MAP, labels: JOYCON_R_LABELS }
    : { map: PRO_CONTROLLER_MAP, labels: PRO_CONTROLLER_LABELS };
}

// Button-name labels (e.g. "SL", "D-pad ↑") for the controller identified by
// a Gamepad.id string, keyed by PAD action. Falls back to the Pro Controller
// scheme when id is unknown (e.g. no gamepad connected yet).
export function labelsForId(id) {
  return schemeForId(id).labels;
}

// Poll the first connected gamepad and emit a press-edge (PAD action) each
// time a mapped button transitions from released to pressed. onConnection
// fires with (connected, pad) when the connected/disconnected state changes.
// Returns { start, stop }.
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
      onConnection?.(connected, pad);
    }
    if (pad) {
      const { map } = schemeForId(pad.id);
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
