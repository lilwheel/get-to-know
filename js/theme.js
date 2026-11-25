// ==========================================================
// Theming
// Switches the page between themes by setting data-theme on <body>.
// The colours for each theme live in css/styles.css. Changing section
// fades the content out, swaps the theme while nothing is visible,
// and fades back in, so colours never animate (only opacity does).
// ==========================================================

import { debugLog } from './debug.js';
import { readCssDurationMs, wait } from './timing.js';

const appElement = document.getElementById('app');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');
let isFading = false;

// Apply a named theme ("neutral", "icebreaker" or "dating") to the whole page,
// and colour the phone's browser toolbar to match.
export function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
  const toolbarColor = getComputedStyle(document.body).getPropertyValue('--color-backdrop-start').trim();
  themeColorMeta.setAttribute('content', toolbarColor);
  debugLog('Theme applied', { theme: themeName });
}

// Fade the content out, run changeScreen (which shows the new screen and
// applies its theme), then fade back in. Extra presses during a fade are ignored.
export async function changeScreenWithFade(changeScreen) {
  if (isFading) {
    return;
  }
  isFading = true;
  appElement.classList.add('is-fading');
  await wait(readCssDurationMs('--duration-theme-fade'));
  changeScreen();
  appElement.classList.remove('is-fading');
  isFading = false;
}
