// ==========================================================
// Saved progress
// Small wrappers around localStorage. Storage can be blocked
// (private browsing, strict settings), so every read and write is
// guarded and the app keeps working without it.
// ==========================================================

import { debugLog } from './debug.js';

// Read a saved value, or return fallback if it's missing or unreadable.
export function loadSaved(key, fallback) {
  try {
    const savedText = localStorage.getItem(key);
    return savedText === null ? fallback : JSON.parse(savedText);
  } catch {
    debugLog('Could not read saved progress', { key });
    return fallback;
  }
}

// Save a value as JSON. If storage is unavailable, carry on without saving.
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    debugLog('Could not save progress', { key });
  }
}

// Delete saved values.
export function clearSaved(keys) {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    debugLog('Could not clear saved progress', { keys });
  }
}
