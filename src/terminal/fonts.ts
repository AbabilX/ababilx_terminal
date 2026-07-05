/**
 * Bundled terminal fonts, loaded as real webfonts (never assumed to be
 * installed on the OS). xterm measures its cell size from whichever font is
 * actually active at `open()` time, so terminals must wait for these to
 * finish loading — otherwise the browser substitutes a fallback font for
 * that first measurement and the grid comes out wrong.
 */
const FACES = [
  '16px "JetBrains Mono"',
  '700 16px "JetBrains Mono"',
  '16px "Purno Pran Unicode"',
];

let ready: Promise<void> | undefined;

export function ensureFontsReady(): Promise<void> {
  if (!ready) {
    ready = Promise.all(FACES.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => undefined);
  }
  return ready;
}
