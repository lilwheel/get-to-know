// ==========================================================
// App entry point
// Loads the data once, then runs the two screens: the start screen
// (pick a section) and the card screen (the stack, level controls,
// Back/Next, and the 18+ switch in Dating). Remembers your place
// between visits.
// ==========================================================

import { CONFIG } from './config.js';
import { createCardStack } from './cards.js';
import { debugLog } from './debug.js';
import { askToConfirm, isDialogOpen } from './dialog.js';
import { playCardChangeFeedback, setSoundEnabled } from './feedback.js';
import { createShuffler } from './shuffler.js';
import { clearSaved, loadSaved, save } from './storage.js';
import { applyTheme, changeScreenWithFade } from './theme.js';

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
  adultSetting: document.getElementById('adult-setting'),
  adultToggle: document.getElementById('adult-toggle'),
  cardStack: document.getElementById('card-stack'),
  cardAnnouncer: document.getElementById('card-announcer'),
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
  includeAdult: false,  // the 18+ switch, confirmed this tab; only used in CONFIG.adultSection
  history: [],          // every card dealt this visit, in order; null = no question
  currentPosition: 0,   // which entry of history is on top
  cardStack: null,
  isFirstCardOfVisit: true,
  isSoundOn: false,     // the click sound; off by default, not saved
};

// ----------------------------------------------------------
// Data loading
// ----------------------------------------------------------

// Fetch one JSON file and return its contents, with a clear error if it fails.
async function loadJsonFile(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    // fetch itself fails when offline, or when the page is opened as a file.
    throw new Error(`Couldn't load ${url}. Check your connection, or open the app through a web server.`);
  }
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
    const question = session.shuffler.dealNext(session.section, session.level, isAdultIncludedHere());
    session.history.push(question);
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
  elements.cardAnnouncer.textContent = buildCardContent(question).text;
  elements.backButton.disabled = position === 0;
  if (!session.isFirstCardOfVisit) {
    playCardChangeFeedback();
  }
  session.isFirstCardOfVisit = false;
  debugLog('Card shown', {
    section: session.section,
    level: question ? question.level : session.level,
    cardId: question ? question.id : EMPTY_CARD.id,
    cardsLeftInPool: session.shuffler.cardsLeft(session.section, session.level, isAdultIncludedHere()),
  });
}

// ----------------------------------------------------------
// Levels
// ----------------------------------------------------------

// Move up (+1) or down (-1) one level. The card showing stays;
// the next card comes from the new level.
function changeLevel(step) {
  const newLevel = clampLevel(session.level + step);
  if (newLevel === session.level) {
    return;
  }
  session.level = newLevel;
  updateLevelDisplay();
  savePlace('cards');
  session.cardStack.refreshUpcoming();
  debugLog('Level changed', { section: session.section, level: newLevel });
}

// Keep a level between the lowest (1) and the deepest (3).
function clampLevel(level) {
  return Math.min(CONFIG.deepestLevel, Math.max(CONFIG.lowestLevel, level));
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
// 18+ questions
// ----------------------------------------------------------

// True only when the switch is on (and confirmed) and this section allows 18+.
function isAdultIncludedHere() {
  return session.includeAdult && session.section === CONFIG.adultSection;
}

// The switch was flipped. Turning on needs both people to confirm their
// age first; until they do, the switch stays off.
async function handleAdultToggleChange() {
  if (!elements.adultToggle.checked) {
    setIncludeAdult(false);
    restartVisitWithoutAdultCards();
    return;
  }
  elements.adultToggle.checked = false;
  const confirmed = await askToConfirm({
    message: 'Both of you confirm you are 18 or older.',
  });
  if (confirmed) {
    elements.adultToggle.checked = true;
    setIncludeAdult(true);
    session.cardStack.refreshUpcoming();
  }
}

// Store the 18+ choice for this tab only (sessionStorage).
function setIncludeAdult(include) {
  session.includeAdult = include;
  save(CONFIG.storageKeys.includeAdult, include, 'session');
  debugLog('18+ questions', { included: include });
}

// Reopen the section so no 18+ card is showing, lined up, or reachable
// with Back. Keeps the current card if it isn't 18+.
function restartVisitWithoutAdultCards() {
  const currentQuestion = session.history[session.currentPosition];
  const keepCardId = currentQuestion && !currentQuestion.adult ? currentQuestion.id : null;
  openSection(session.section, session.level, keepCardId);
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
  session.section = section;
  session.level = clampLevel(level);
  const resumeQuestion = findResumableQuestion(resumeCardId);
  if (resumeQuestion) {
    // It may still be in its pool; take it out so it isn't dealt again this visit.
    session.shuffler.takeOut(resumeQuestion);
  }
  session.history = resumeQuestion ? [resumeQuestion] : [];
  session.currentPosition = 0;
  session.isFirstCardOfVisit = true;

  elements.startScreen.hidden = true;
  elements.cardScreen.hidden = false;
  elements.sectionTitle.textContent = CONFIG.sectionNames[section];
  elements.adultSetting.hidden = section !== CONFIG.adultSection;
  elements.adultToggle.checked = isAdultIncludedHere();
  applyTheme(section);
  updateLevelDisplay();
  session.cardStack = createCardStack({
    containerElement: elements.cardStack,
    getCardAt,
    onCardShown: handleCardShown,
    forgetCardsAfter,
  });
}

// The saved card to put back on top, if it belongs to the open section
// and is allowed right now (an 18+ card needs the switch on).
function findResumableQuestion(cardId) {
  const question = cardId ? session.shuffler.findById(cardId) : null;
  if (question === null || question.section !== session.section) {
    return null;
  }
  return question.adult && !isAdultIncludedHere() ? null : question;
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
async function resetProgress() {
  const confirmed = await askToConfirm({
    message: 'Reset? This forgets which cards you have seen and where you were.',
    confirmLabel: 'Reset',
  });
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
    const openThisSection = () => chooseSection(button.dataset.section);
    button.addEventListener('click', () => changeScreenWithFade(openThisSection));
  });
  elements.resetButton.addEventListener('click', resetProgress);
  elements.homeButton.addEventListener('click', () => changeScreenWithFade(showStartScreen));
  elements.shallowerButton.addEventListener('click', () => changeLevel(-1));
  elements.deeperButton.addEventListener('click', () => changeLevel(1));
  elements.nextButton.addEventListener('click', () => session.cardStack.showNext('left'));
  elements.backButton.addEventListener('click', () => session.cardStack.showPrevious());
  elements.soundToggle.addEventListener('click', toggleSound);
  elements.adultToggle.addEventListener('change', handleAdultToggleChange);
  document.addEventListener('keydown', handleArrowKeys);
}

// Left/right arrows move through cards, but only on the card screen,
// not while a dialog is open, and not with a modifier key (Alt+Left is
// the browser's own Back).
function handleArrowKeys(event) {
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
  if (session.cardStack === null || isDialogOpen() || hasModifier) {
    return;
  }
  if (event.key === 'ArrowRight') {
    session.cardStack.showNext('left');
  } else if (event.key === 'ArrowLeft') {
    session.cardStack.showPrevious();
  }
}

// Flip the click sound on or off and update the button's label to match.
function toggleSound() {
  session.isSoundOn = !session.isSoundOn;
  setSoundEnabled(session.isSoundOn);
  elements.soundToggle.textContent = session.isSoundOn ? 'Sound on' : 'Sound off';
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
  if (!Array.isArray(questions) || !Array.isArray(sources)) {
    showError(`Couldn't read the questions. Check ${CONFIG.questionsUrl} and ${CONFIG.sourcesUrl} are lists.`);
    return;
  }
  if (questions.length === 0) {
    showError(`No questions found. Check ${CONFIG.questionsUrl}.`);
    return;
  }
  session.sourcesById = new Map(sources.map((source) => [source.id, source]));
  session.includeAdult = loadSaved(CONFIG.storageKeys.includeAdult, false, 'session') === true;
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
