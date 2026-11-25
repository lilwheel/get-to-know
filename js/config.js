// ==========================================================
// App settings
// The one CONFIG object. Every tunable number in the JavaScript
// lives here. Animation durations and easings live in CSS variables
// (css/styles.css) so prefers-reduced-motion can change them in one place.
// ==========================================================

export const CONFIG = {
  // Data files. sample.json is temporary; Step 7 switches to questions.json.
  questionsUrl: 'data/sample.json',
  sourcesUrl: 'data/sources.json',

  // Swiping: a drag past this share of the screen width counts as a swipe.
  swipeDistanceRatio: 0.3,
  // A release faster than this (pixels per millisecond) counts as a flick.
  flickVelocityPxPerMs: 0.5,
  // How far back in time (ms) to look when measuring release speed.
  velocitySampleWindowMs: 100,
  // How much the card tilts while dragged, in degrees per pixel moved.
  dragRotationDegreesPerPixel: 0.05,

  // Extra wait (ms) after an animation's duration in case transitionend never fires.
  transitionSafetyMarginMs: 50,

  // Feedback when a card changes.
  vibrationMs: 12,
  clickSound: {
    frequencyHz: 1800,
    durationMs: 40,
    volume: 0.15,
  },
};
