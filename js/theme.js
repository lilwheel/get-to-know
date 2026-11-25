// ==========================================================
// Theming
// Switches the page between themes by setting data-theme on <body>.
// The colours for each theme live in css/styles.css (added in Step 6).
// ==========================================================

import { debugLog } from './debug.js';

// Apply a named theme ("neutral", "icebreaker" or "dating") to the whole page.
export function applyTheme(themeName) {
  document.body.dataset.theme = themeName;
  debugLog('Theme applied', { theme: themeName });
}
