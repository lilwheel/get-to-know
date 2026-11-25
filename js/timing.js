// ==========================================================
// Timing helpers
// Animation durations live in CSS variables (so reduced-motion can
// shorten them in one place). These helpers let JavaScript read them
// and wait for them.
// ==========================================================

// Read an animation duration (written in ms) from a CSS variable.
export function readCssDurationMs(variableName) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName);
  return parseFloat(value) || 0;
}

// Resolve after a number of milliseconds.
export function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
