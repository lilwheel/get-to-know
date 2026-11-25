// ==========================================================
// Debug logging
// The only place in the app allowed to write to the console.
// Logs appear only when the page URL contains ?debug=1.
// ==========================================================

const isDebugMode = new URLSearchParams(window.location.search).get('debug') === '1';

// Print a labelled message, but only in debug mode, so normal use stays silent.
export function debugLog(message, details) {
  if (!isDebugMode) {
    return;
  }
  if (details === undefined) {
    console.log(`[debug] ${message}`);
  } else {
    console.log(`[debug] ${message}`, details);
  }
}
