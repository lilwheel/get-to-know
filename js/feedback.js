// ==========================================================
// Feedback
// A short vibration (where supported) each time the card changes.
// ==========================================================

import { CONFIG } from './config.js';

// Give the user a light physical cue that the card changed. Vibrates on
// devices that support it (most Android phones; not iPhone).
export function playCardChangeFeedback() {
  if ('vibrate' in navigator) {
    navigator.vibrate(CONFIG.vibrationMs);
  }
}
