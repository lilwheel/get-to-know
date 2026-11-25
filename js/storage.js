// ==========================================================
// Saved progress
// Small wrappers around localStorage (kept between visits) and
// sessionStorage (cleared when the tab closes). Storage can be blocked
// (private browsing, strict settings), so every read and write is
// guarded and the app keeps working without it.
// ==========================================================

import { debugLog } from './debug.js';

// Pick the storage area by name. Done inside each try block, because
// just touching localStorage can throw when storage is blocked.
function getStorageArea(areaName) {
  return areaName === 'session' ? sessionStorage : localStorage;
}

// Read a saved value, or return fallback if it's missing or unreadable.
// areaName is 'local' (default) or 'session'.
export function loadSaved(key, fallback, areaName = 'local') {
  try {
    const savedText = getStorageArea(areaName).getItem(key);
    return savedText === null ? fallback : JSON.parse(savedText);
  } catch {
    debugLog('Could not read saved progress', { key });
    return fallback;
  }
}

// Save a value as JSON. If storage is unavailable, carry on without saving.
export function save(key, value, areaName = 'local') {
  try {
    getStorageArea(areaName).setItem(key, JSON.stringify(value));
  } catch {
    debugLog('Could not save progress', { key });
  }
}

// Delete saved values from localStorage (used by Reset). The 18+ choice in
// sessionStorage is left alone; it clears itself when the tab closes.
export function clearSaved(keys) {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    debugLog('Could not clear saved progress', { keys });
  }
}
