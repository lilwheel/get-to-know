// ==========================================================
// Feedback
// A short vibration (where supported) and an optional soft click
// each time the card changes. Sound is off by default.
// ==========================================================

import { CONFIG } from './config.js';
import { debugLog } from './debug.js';

let isSoundEnabled = false;
let audioContext = null;

// ----------------------------------------------------------
// Sound setting
// ----------------------------------------------------------

// Turn the click sound on or off. Called from a button press, which
// browsers require before audio is allowed to start. Browsers without
// Web Audio just stay silent.
export function setSoundEnabled(enabled) {
  const canPlayAudio = 'AudioContext' in window;
  isSoundEnabled = enabled && canPlayAudio;
  if (isSoundEnabled && audioContext === null) {
    audioContext = new AudioContext();
  }
  debugLog('Sound setting changed', { soundOn: enabled });
}

// ----------------------------------------------------------
// Playing feedback
// ----------------------------------------------------------

// Give the user a light physical and (optionally) audible cue that the card changed.
export function playCardChangeFeedback() {
  vibrateBriefly();
  if (isSoundEnabled) {
    playSoftClick();
  }
}

// Vibrate for a moment on devices that support it (most Android phones; not iPhone).
function vibrateBriefly() {
  if ('vibrate' in navigator) {
    navigator.vibrate(CONFIG.vibrationMs);
  }
}

// Play a very short, quiet tone that fades out quickly so it sounds like a click.
function playSoftClick() {
  const { frequencyHz, durationMs, volume } = CONFIG.clickSound;
  const startTime = audioContext.currentTime;
  const endTime = startTime + durationMs / 1000;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequencyHz;
  gain.gain.setValueAtTime(volume, startTime);
  // Exponential ramps can't reach zero, so fade to a near-silent value instead.
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(startTime);
  oscillator.stop(endTime);
}
