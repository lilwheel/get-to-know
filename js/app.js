// ==========================================================
// App entry point
// Loads the data once, then runs the two screens: the start screen
// (pick a section) and the card screen (the stack, level controls,
// Back/Next, and the section's gated switch: 18+ in Dating, Party mode
// in Friends & Teammates). Remembers your place between visits.
// ==========================================================

import { CONFIG, sectionHasToggle } from './config.js';
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
  sectionChoices: document.getElementById('section-choices'),
  resetButton: document.getElementById('reset-button'),
  homeButton: document.getElementById('home-button'),
  sectionTitle: document.getElementById('section-title'),
  soundToggle: document.getElementById('sound-toggle'),
  toggleSetting: document.getElementById('toggle-setting'),
  toggleInput: document.getElementById('toggle-input'),
  toggleLabel: document.getElementById('toggle-label'),
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
  type: 'question',
  text: 'No questions here yet. Try another level.',
  why: '',
  sourceTitle: '',
  sourceUrl: '',
  canPass: false,
  isParty: false,
  isAdult: false,
};

const session = {
  shuffler: null,
  sourcesById: new Map(),
  section: null,
  level: CONFIG.lowestLevel,
  // Gated switches confirmed in this tab, by name ('adult', 'party').
  // Each one only counts in its own section; see isToggleOnHere().
  toggles: { adult: false, party: false },
  history: [],          // every card dealt this visit, in order; null = no question
  currentPosition: 0,   // which entry of history is on top
  cardStack: null,
  isFirstCardOfVisit: true,
  isSoundOn: false,     // the click sound; off by default, not saved
};

// ----------------------------------------------------------
// Data loading
// ----------------------------------------------------------

// Fetch every card file and the sources together. The card files are
// merged into one list; each file must be a list for the merge to work.
async function loadAllData() {
  const [sources, ...cardLists] = await Promise.all([
    loadJsonFile(CONFIG.sourcesUrl),
    ...CONFIG.questionFileUrls.map(loadJsonFile),
  ]);
  const allAreLists = Array.isArray(sources) && cardLists.every(Array.isArray);
  return allAreLists ? { sources, questions: cardLists.flat() } : null;
}

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
    type: question.type,
    text: question.text,
    why: question.why,
    sourceTitle: source ? source.title : '',
    sourceUrl: source ? source.url : '',
    canPass: CONFIG.sections[question.section].hasPassButton,
    isParty: question.party === true,
    isAdult: question.adult === true,
  };
}

// What screen readers hear for a card: Party, 18+ and dare cards say so,
// and dares say who does them, so the difference isn't only visual.
function describeForScreenReader(card) {
  const { dare, dareWho, party, adult } = CONFIG.cardLabels;
  let prefix = '';
  if (card.isParty) {
    prefix = `${party}. `;
  } else if (card.isAdult) {
    prefix = `${adult}. `;
  }
  if (card.type !== 'dare') {
    return `${prefix}${card.text}`;
  }
  return `${prefix}${dare}: ${card.text} ${dareWho}.`;
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
    && Object.hasOwn(CONFIG.sections, place.section)
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
    const question = session.shuffler.dealNext(session.section, session.level, dealOptions());
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
  elements.cardAnnouncer.textContent = describeForScreenReader(buildCardContent(question));
  elements.backButton.disabled = position === 0;
  if (!session.isFirstCardOfVisit) {
    playCardChangeFeedback();
  }
  session.isFirstCardOfVisit = false;
  debugLog('Card shown', {
    section: session.section,
    level: question ? question.level : session.level,
    cardId: question ? question.id : EMPTY_CARD.id,
    party: question ? question.party === true : false,
    cardsLeftInPool: session.shuffler.cardsLeft(session.section, session.level, dealOptions()),
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
// Gated switches (18+ in Dating, Party mode in Friends & Teammates)
// ----------------------------------------------------------

// True only when the named switch is on (and confirmed) and the open
// section is the one that switch belongs to.
function isToggleOnHere(toggleName) {
  return session.toggles[toggleName] && sectionHasToggle(session.section, toggleName);
}

// What the shuffler needs to know about the switches when dealing.
function dealOptions() {
  return { includeAdult: isToggleOnHere('adult'), partyMode: isToggleOnHere('party') };
}

// True if a card may be shown right now: 18+ and Party cards need their switch on.
function isCardAllowedNow(question) {
  return Object.keys(CONFIG.toggles).every((toggleName) => {
    const isGatedCard = question[CONFIG.toggles[toggleName].cardFlag] === true;
    return !isGatedCard || isToggleOnHere(toggleName);
  });
}

// The section's switch was flipped. Turning on needs Confirm in the dialog
// first; until then the switch stays off. Turning off never asks.
async function handleToggleChange() {
  const toggleName = CONFIG.sections[session.section].toggle;
  const toggle = CONFIG.toggles[toggleName];
  if (!elements.toggleInput.checked) {
    setToggle(toggleName, false);
    if (toggle.turnOffClearsVisit) {
      restartVisitWithout(toggle.cardFlag);
    } else {
      session.cardStack.refreshUpcoming();
    }
    return;
  }
  elements.toggleInput.checked = false;
  const confirmed = await askToConfirm(toggle.confirm);
  if (confirmed) {
    elements.toggleInput.checked = true;
    setToggle(toggleName, true);
    session.cardStack.refreshUpcoming();
  }
}

// Store a switch's choice for this tab only (sessionStorage), and update
// the page's theme in case this switch has a look of its own (Party mode).
function setToggle(toggleName, isOn) {
  session.toggles[toggleName] = isOn;
  save(CONFIG.toggles[toggleName].storageKey, isOn, 'session');
  applyTheme(currentThemeName());
  debugLog('Toggle changed', { toggle: toggleName, on: isOn });
}

// The theme for the open section: its own, or its switch's theme while
// that switch is on (Party mode uses 'friends-party').
function currentThemeName() {
  const toggleName = CONFIG.sections[session.section].toggle;
  const themeWhenOn = toggleName === null ? undefined : CONFIG.toggles[toggleName].themeWhenOn;
  return themeWhenOn && isToggleOnHere(toggleName) ? themeWhenOn : session.section;
}

// Read every switch's choice saved earlier in this tab.
function loadToggles() {
  for (const toggleName of Object.keys(CONFIG.toggles)) {
    session.toggles[toggleName] = loadSaved(CONFIG.toggles[toggleName].storageKey, false, 'session') === true;
  }
}

// Show the open section's switch (if it has one), with its label and state.
function updateToggleDisplay() {
  const toggleName = CONFIG.sections[session.section].toggle;
  elements.toggleSetting.hidden = toggleName === null;
  if (toggleName !== null) {
    elements.toggleLabel.textContent = CONFIG.toggles[toggleName].label;
    elements.toggleInput.checked = isToggleOnHere(toggleName);
  }
}

// Reopen the section so no card with this flag (e.g. 18+) is showing, lined
// up, or reachable with Back. Keeps the current card if it doesn't have the flag.
function restartVisitWithout(cardFlag) {
  const currentQuestion = session.history[session.currentPosition];
  const keepCardId = currentQuestion && currentQuestion[cardFlag] !== true ? currentQuestion.id : null;
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
  elements.sectionTitle.textContent = CONFIG.sections[section].name;
  updateToggleDisplay();
  applyTheme(currentThemeName());
  updateLevelDisplay();
  session.cardStack = createCardStack({
    containerElement: elements.cardStack,
    getCardAt,
    onCardShown: handleCardShown,
    forgetCardsAfter,
  });
}

// The saved card to put back on top, if it belongs to the open section
// and is allowed right now (an 18+ or Party card needs its switch on).
function findResumableQuestion(cardId) {
  const question = cardId ? session.shuffler.findById(cardId) : null;
  if (question === null || question.section !== session.section) {
    return null;
  }
  return isCardAllowedNow(question) ? question : null;
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

// Add one start-screen button per section in CONFIG.sections. Each button
// wears its own section's theme, so it previews the colours inside.
function renderSectionButtons() {
  for (const [sectionId, section] of Object.entries(CONFIG.sections)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'section-button';
    button.dataset.theme = sectionId;

    const nameElement = document.createElement('span');
    nameElement.className = 'section-button__name';
    nameElement.textContent = section.name;
    const hintElement = document.createElement('span');
    hintElement.className = 'section-button__hint';
    hintElement.textContent = section.hint;
    button.append(nameElement, hintElement);

    const openThisSection = () => chooseSection(sectionId);
    button.addEventListener('click', () => changeScreenWithFade(openThisSection));
    elements.sectionChoices.append(button);
  }
}

// Connect every button and the arrow keys. Runs once at startup.
function connectControls() {
  renderSectionButtons();
  elements.resetButton.addEventListener('click', resetProgress);
  elements.homeButton.addEventListener('click', () => changeScreenWithFade(showStartScreen));
  elements.shallowerButton.addEventListener('click', () => changeLevel(-1));
  elements.deeperButton.addEventListener('click', () => changeLevel(1));
  elements.nextButton.addEventListener('click', () => session.cardStack.showNext('left'));
  elements.backButton.addEventListener('click', () => session.cardStack.showPrevious());
  elements.soundToggle.addEventListener('click', toggleSound);
  elements.toggleInput.addEventListener('change', handleToggleChange);
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
  let data;
  try {
    data = await loadAllData();
  } catch (error) {
    showError(error.message);
    return;
  }
  const allFiles = [...CONFIG.questionFileUrls, CONFIG.sourcesUrl].join(', ');
  if (data === null) {
    showError(`Couldn't read the questions. Check that each of these files is a list: ${allFiles}.`);
    return;
  }
  const { questions, sources } = data;
  if (questions.length === 0) {
    showError(`No questions found. Check ${CONFIG.questionFileUrls.join(', ')}.`);
    return;
  }
  session.sourcesById = new Map(sources.map((source) => [source.id, source]));
  loadToggles();
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
