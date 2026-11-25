// ==========================================================
// App entry point
// Loads the question data once, then sets up the start screen.
// ==========================================================

import { debugLog } from './debug.js';
import { applyTheme } from './theme.js';

// ----------------------------------------------------------
// Setup: settings shared across the app
// ----------------------------------------------------------
const CONFIG = {
  questionsUrl: 'data/questions.json',
  sourcesUrl: 'data/sources.json',
};

// ----------------------------------------------------------
// Data loading
// ----------------------------------------------------------

// Fetch one JSON file and return its contents, with a clear error if it fails.
async function loadJsonFile(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Couldn't load ${url}. Check that the file exists.`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`Couldn't read ${url}. Check that it is valid JSON.`);
  }
}

// ----------------------------------------------------------
// Error display
// ----------------------------------------------------------

// Show a plain, specific error message to the user.
function showError(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  errorElement.hidden = false;
}

// ----------------------------------------------------------
// Startup
// ----------------------------------------------------------

// Load all data, then show the start screen in the neutral theme.
async function startApp() {
  applyTheme('neutral');
  try {
    const [questions, sources] = await Promise.all([
      loadJsonFile(CONFIG.questionsUrl),
      loadJsonFile(CONFIG.sourcesUrl),
    ]);
    debugLog('Data loaded', { questions: questions.length, sources: sources.length });
  } catch (error) {
    showError(error.message);
  }
}

startApp();
