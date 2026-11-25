// ==========================================================
// App entry point
// Loads the data once, then runs the two screens: the start screen
// (pick a section) and the card screen (the stack, level controls,
// Back/Next). Remembers your place between visits.
// ==========================================================

import { CONFIG } from './config.js';
import { createCardStack } from './cards.js';
import { debugLog } from './debug.js';
import { playCardChangeFeedback, setSoundEnabled } from './feedback.js';
import { createShuffler } from './shuffler.js';
import { clearSaved, loadSaved, save } from './storage.js';
import { applyTheme } from './theme.js';

// ----------------------------------------------------------
// Setup: page elements and the current session
// ----------------------------------------------------------
const elements = {
  startScreen: document.getElementById('start-screen'),
  cardScreen: document.getElementById('card-screen'),
  sectionButtons: document.querySelectorAll('[data-section]'),
  resetButton: document.getElementById('reset-button'),
  homeButton: document.getElementById('home-button'),
  sectionTitle: document.getElementById('section-title'),
  soundToggle: document.getElementById('sound-toggle'),
  cardStack: document.getElementById('card-stack'),
  shallowerButton: document.getElementById('shallower-button'),
  deeperButton: document.getElementById('deeper-button'),
  levelIndicator: document.getElementById('level-indicator'),
  levelDots: document.querySelectorAll('.level-dot'),
  levelName: document.getElementById('level-name'),
  backButton: document.getElementById('back-button'),
  nextButton: document.getElementById('next-button'),
  errorMessage: document.getElementById('error-message'),
};

// Shown if a section and level has no questions at all.
const EMPTY_CARD = {
  id: 'empty',
  text: 'No questions here yet. Try another level.',
  why: '',
  sourceTitle: '',
  sourceUrl: '',
};

const session = {
  shuffler: null,
  sourcesById: new Map(),
  section: null,
  level: CONFIG.lowestLevel,
  history: [],          // every card dealt this visit, in order; null = no question
  currentPosition: 0,   // which entry of history is on top
  cardStack: null,
  isFirstCardOfVisit: true,
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

// Combine a question with its source into what a card needs to display.
function buildCardContent(question) {
  if (question === null) {
    return EMPTY_CARD;
  }
  const source = session.sourcesById.get(question.source_id);
  return {
    id: question.id,
    text: question.text,
    why: question.why,
    sourceTitle: source ? source.title : '',
    sourceUrl: source ? source.url : '',
  };
}

// ----------------------------------------------------------
// Saved place
// ----------------------------------------------------------

// Remember which screen, section, level and card you're on.
function savePlace(screen) {
  const currentQuestion = session.history[session.currentPosition];
  save(CONFIG.storageKeys.place, {
    screen,
    section: session.section,
    level: session.level,
    currentCardId: currentQuestion ? currentQuestion.id : null,
  });
}

// Record that you're on the start screen, keeping the saved section,
// level and card so choosing that section again resumes it.
function saveStartScreenVisit() {
  const place = loadPlace();
  if (place !== null) {
    save(CONFIG.storageKeys.place, { ...place, screen: 'start' });
  }
}

// Read the saved place, ignoring anything that doesn't make sense.
function loadPlace() {
  const place = loadSaved(CONFIG.storageKeys.place, null);
  const isValid = place !== null
    && Object.hasOwn(CONFIG.sectionNames, place.section)
    && Number.isInteger(place.level);
  return isValid ? place : null;
}

// ----------------------------------------------------------
// Dealing cards for the stack
// ----------------------------------------------------------

// The card at a position in this visit. Positions past the end are
// dealt from the shuffler at the current level.
function getCardAt(position) {
  while (session.history.length <= position) {
    session.history.push(session.shuffler.dealNext(session.section, session.level));
  }
  return buildCardContent(session.history[position]);
}

// Drop cards lined up after a position and return unshown ones to their pool.
// Reversed so the pool deals them again in their original order.
function forgetCardsAfter(position) {
  const droppedQuestions = session.history.splice(position + 1);
  droppedQuestions.reverse().forEach((question) => {
    if (question !== null) {
      session.shuffler.putBack(question);
    }
  });
}

// A card settled on top: record it, save progress, give feedback, log it.
function handleCardShown(position) {
  session.currentPosition = position;
  const question = session.history[position];
  if (question !== null) {
    session.shuffler.markShown(question);
    save(CONFIG.storageKeys.seenIds, session.shuffler.getSeenIds());
  }
  savePlace('cards');
  elements.backButton.disabled = position === 0;
  if (!session.isFirstCardOfVisit) {
    playCardChangeFeedback();
  }
  session.isFirstCardOfVisit = false;
  debugLog('Card shown', {
    section: session.section,
    level: question ? question.level : session.level,
    cardId: question ? question.id : EMPTY_CARD.id,
    cardsLeftInPool: session.shuffler.cardsLeft(session.section, session.level),
  });
}

// ----------------------------------------------------------
// Levels
// ----------------------------------------------------------

// Move up (+1) or down (-1) one level. The card showing stays;
// the next card comes from the new level.
function changeLevel(step) {
  const newLevel = Math.min(CONFIG.deepestLevel, Math.max(CONFIG.lowestLevel, session.level + step));
  if (newLevel === session.level) {
    return;
  }
  session.level = newLevel;
  updateLevelDisplay();
  savePlace('cards');
  session.cardStack.refreshUpcoming();
  debugLog('Level changed', { section: session.section, level: newLevel });
}

// Fill in the level dots and name, and stop the buttons at levels 1 and 3.
function updateLevelDisplay() {
  const levelName = CONFIG.levelNames[session.level];
  elements.levelDots.forEach((dot) => {
    dot.classList.toggle('is-filled', Number(dot.dataset.level) <= session.level);
  });
  elements.levelName.textContent = levelName;
  elements.levelIndicator.setAttribute('aria-label',
    `Level ${session.level} of ${CONFIG.deepestLevel}: ${levelName}. Applies from the next card.`);
  elements.shallowerButton.disabled = session.level === CONFIG.lowestLevel;
  elements.deeperButton.disabled = session.level === CONFIG.deepestLevel;
}

// ----------------------------------------------------------
// Screens
// ----------------------------------------------------------

// Show the start screen and close any open card stack.
function showStartScreen() {
  closeCardStack();
  elements.cardScreen.hidden = true;
  elements.startScreen.hidden = false;
  applyTheme('neutral');
  saveStartScreenVisit();
}

// Open a section at a level. If resumeCardId names a card from this
// section, it goes back on top so you continue where you left off.
function openSection(section, level, resumeCardId) {
  closeCardStack();
  const resumeQuestion = resumeCardId ? session.shuffler.findById(resumeCardId) : null;
  session.section = section;
  session.level = Math.min(CONFIG.deepestLevel, Math.max(CONFIG.lowestLevel, level));
  session.history = resumeQuestion && resumeQuestion.section === section ? [resumeQuestion] : [];
  session.currentPosition = 0;
  session.isFirstCardOfVisit = true;

  elements.startScreen.hidden = true;
  elements.cardScreen.hidden = false;
  elements.sectionTitle.textContent = CONFIG.sectionNames[section];
  applyTheme(section);
  updateLevelDisplay();
  session.cardStack = createCardStack({
    containerElement: elements.cardStack,
    getCardAt,
    onCardShown: handleCardShown,
    forgetCardsAfter,
  });
}

// Remove the current card stack, returning any unshown cards to their pools.
function closeCardStack() {
  if (session.cardStack === null) {
    return;
  }
  forgetCardsAfter(session.currentPosition);
  session.cardStack.destroy();
  session.cardStack = null;
}

// A section button was pressed: resume that section if it's where you
// were last, otherwise start it at level 1.
function chooseSection(section) {
  const place = loadPlace();
  if (place && place.section === section) {
    openSection(section, place.level, place.currentCardId);
  } else {
    openSection(section, CONFIG.lowestLevel, null);
  }
}

// Clear seen cards and the saved place, after asking first.
function resetProgress() {
  const confirmed = window.confirm('Reset? This forgets which cards you have seen and where you were.');
  if (!confirmed) {
    return;
  }
  clearSaved([CONFIG.storageKeys.seenIds, CONFIG.storageKeys.place]);
  session.shuffler.reset();
  session.section = null;
  session.level = CONFIG.lowestLevel;
  session.history = [];
  debugLog('Progress reset');
  showStartScreen();
}

// ----------------------------------------------------------
// Controls
// ----------------------------------------------------------

// Connect every button and the arrow keys. Runs once at startup.
function connectControls() {
  elements.sectionButtons.forEach((button) => {
    button.addEventListener('click', () => chooseSection(button.dataset.section));
  });
  elements.resetButton.addEventListener('click', resetProgress);
  elements.homeButton.addEventListener('click', showStartScreen);
  elements.shallowerButton.addEventListener('click', () => changeLevel(-1));
  elements.deeperButton.addEventListener('click', () => changeLevel(1));
  elements.nextButton.addEventListener('click', () => session.cardStack.showNext('left'));
  elements.backButton.addEventListener('click', () => session.cardStack.showPrevious());
  elements.soundToggle.addEventListener('click', toggleSound);
  document.addEventListener('keydown', handleArrowKeys);
}

// Left/right arrows move through cards, but only on the card screen.
function handleArrowKeys(event) {
  if (session.cardStack === null) {
    return;
  }
  if (event.key === 'ArrowRight') {
    session.cardStack.showNext('left');
  } else if (event.key === 'ArrowLeft') {
    session.cardStack.showPrevious();
  }
}

// Flip the click sound on or off and update the button's label and state.
function toggleSound() {
  const turningOn = elements.soundToggle.getAttribute('aria-pressed') !== 'true';
  setSoundEnabled(turningOn);
  elements.soundToggle.setAttribute('aria-pressed', String(turningOn));
  elements.soundToggle.textContent = turningOn ? 'Sound on' : 'Sound off';
}

// ----------------------------------------------------------
// Error display
// ----------------------------------------------------------

// Show a plain, specific error message in place of both screens.
function showError(message) {
  elements.startScreen.hidden = true;
  elements.cardScreen.hidden = true;
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
}

// ----------------------------------------------------------
// Startup
// ----------------------------------------------------------

// Load all data, set up the shuffler, then reopen where you left off.
async function startApp() {
  applyTheme('neutral');
  let questions;
  let sources;
  try {
    [questions, sources] = await Promise.all([
      loadJsonFile(CONFIG.questionsUrl),
      loadJsonFile(CONFIG.sourcesUrl),
    ]);
  } catch (error) {
    showError(error.message);
    return;
  }
  if (questions.length === 0) {
    showError(`No questions found. Check ${CONFIG.questionsUrl}.`);
    return;
  }
  session.sourcesById = new Map(sources.map((source) => [source.id, source]));
  session.shuffler = createShuffler(questions, loadSaved(CONFIG.storageKeys.seenIds, []));
  connectControls();
  restorePlace();
}

// Reopen the section and level you were on, or show the start screen.
function restorePlace() {
  const place = loadPlace();
  debugLog('Restoring place', place);
  if (place && place.screen === 'cards') {
    openSection(place.section, place.level, place.currentCardId);
  } else {
    showStartScreen();
  }
}

startApp();
