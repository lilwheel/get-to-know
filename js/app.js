// ==========================================================
// App entry point
// Loads the data once, then runs the two screens: the start screen
// (pick a section) and the card screen (the stack, level controls,
// Back/Next, and the section's gated switch: 18+ in Dating, Party mode
// in Friends & Teammates). Remembers your place between visits.
// ==========================================================

import { canvasToPngBlob, cardImageFontsReady, drawCardImage, loadCardImageFonts } from './card-image.js';
import { CONFIG, sectionHasToggle } from './config.js';
import { createCardStack } from './cards.js';
import { debugLog } from './debug.js';
import { askToConfirm, isDialogOpen } from './dialog.js';
import { playCardChangeFeedback } from './feedback.js';
import { saveImage } from './save.js';
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
  cardToolbar: document.querySelector('.card-toolbar'),
  toggleSetting: document.getElementById('toggle-setting'),
  switchTemplate: document.getElementById('switch-template'),
  cardStack: document.getElementById('card-stack'),
  cardAnnouncer: document.getElementById('card-announcer'),
  shallowerButton: document.getElementById('shallower-button'),
  deeperButton: document.getElementById('deeper-button'),
  levelIndicator: document.getElementById('level-indicator'),
  levelDots: document.querySelectorAll('.level-dot'),
  levelName: document.getElementById('level-name'),
  backButton: document.getElementById('back-button'),
  nextButton: document.getElementById('next-button'),
  saveButton: document.getElementById('save-button'),
  toast: document.getElementById('toast'),
  errorMessage: document.getElementById('error-message'),
};

// Shown if a section and level has no questions at all.
const EMPTY_CARD = {
  id: 'empty',
  type: 'question',
  text: 'No questions here yet. Try another level.',
  factText: '',
  factCitation: '',
  factUrl: '',
  sourceName: '',
  sourceUrl: '',
  canPass: false,
  isParty: false,
  isAdult: false,
};

const session = {
  shuffler: null,
  sourcesById: new Map(),
  factsById: new Map(),
  section: null,
  level: CONFIG.lowestLevel,
  // Gated switches confirmed in this tab, by name ('adult', 'party').
  // Each one only counts in its own section; see isToggleOnHere().
  toggles: { adult: false, party: false, adultWording: false },
  history: [],          // every card dealt this visit, in order; null = no question
  currentPosition: 0,   // which entry of history is on top
  cardStack: null,
  isFirstCardOfVisit: true,
};

// ----------------------------------------------------------
// Data loading
// ----------------------------------------------------------

// Fetch every card file, the sources and the facts together. The card files
// are merged into one list; each file must be a list for the merge to work.
async function loadAllData() {
  const [sources, facts, ...cardLists] = await Promise.all([
    loadJsonFile(CONFIG.sourcesUrl),
    loadJsonFile(CONFIG.factsUrl),
    ...CONFIG.questionFileUrls.map(loadJsonFile),
  ]);
  const allAreLists = [sources, facts, ...cardLists].every(Array.isArray);
  return allAreLists ? { sources, facts, questions: cardLists.flat() } : null;
}

// Fetch one JSON file and return its contents, with a clear error if it fails.
async function loadJsonFile(url) {
  let response;
  try {
    // 'no-cache' asks the server whether the file changed (cheap when it hasn't),
    // so an updated question bank shows up straight after a release.
    response = await fetch(url, { cache: 'no-cache' });
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

// Combine a question with its fact and source into what a card needs to display.
// A missing fact or source just leaves that part of the footnote out.
function buildCardContent(question) {
  if (question === null) {
    return EMPTY_CARD;
  }
  const fact = session.factsById.get(question.fact_id);
  const source = session.sourcesById.get(question.source_id);
  // Party cards with Classic wording show it while "Include 18+ wording" is on.
  const useClassicWording = isToggleOnHere('adultWording') && typeof question.text_classic === 'string';
  return {
    id: question.id,
    type: question.type,
    text: useClassicWording ? question.text_classic : question.text,
    factText: fact ? fact.text : '',
    factCitation: fact ? fact.citation : '',
    factUrl: fact ? fact.url : '',
    sourceName: source ? source.name : '',
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
  // The "no questions here" card has nothing worth saving
  elements.saveButton.disabled = question === null;
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
// Gated switches (18+ in Dating; Party mode and 18+ wording in Friends & Teammates)
// ----------------------------------------------------------

// The open section's gated switches, left to right (empty if it has none).
function currentToggleNames() {
  return CONFIG.sections[session.section].toggles;
}

// True only when the named switch is on (and confirmed) and the open
// section is the one that switch belongs to.
function isToggleOnHere(toggleName) {
  return session.toggles[toggleName] && sectionHasToggle(session.section, toggleName);
}

// What the shuffler needs to know about the switches when dealing.
function dealOptions() {
  return { includeAdult: isToggleOnHere('adult'), partyMode: isToggleOnHere('party') };
}

// True if a switch can be changed right now. A switch that requires another
// (18+ wording requires Party mode) can only be changed while that one is on.
function canChangeToggle(toggleName) {
  const requiredToggle = CONFIG.toggles[toggleName].requires;
  return requiredToggle === undefined || isToggleOnHere(requiredToggle);
}

// True if a card may be shown right now: 18+ and Party cards need their switch on.
// (18+ wording has no cards of its own; it only changes Party cards' wording.)
function isCardAllowedNow(question) {
  return Object.keys(CONFIG.toggles).every((toggleName) => {
    const { cardFlag } = CONFIG.toggles[toggleName];
    const isGatedCard = cardFlag !== null && question[cardFlag] === true;
    return !isGatedCard || isToggleOnHere(toggleName);
  });
}

// A switch was flipped. Turning on needs Confirm in the dialog first; until
// then the switch stays off. Turning off never asks. Either way, the change
// applies from the next card.
async function handleToggleChange(event) {
  const input = event.target;
  const toggleName = input.dataset.toggle;
  const toggle = CONFIG.toggles[toggleName];
  if (!input.checked) {
    turnOffToggle(toggleName);
    updateToggleStates();
    if (toggle.turnOffClearsVisit) {
      restartVisitWithout(toggle.cardFlag);
    } else {
      session.cardStack.refreshUpcoming();
    }
    return;
  }
  input.checked = false;
  const confirmed = await askToConfirm(toggle.confirm);
  if (confirmed) {
    setToggle(toggleName, true);
    updateToggleStates();
    session.cardStack.refreshUpcoming();
  }
}

// Turn a switch off, along with any switch that requires it
// (turning Party mode off also turns 18+ wording off).
function turnOffToggle(toggleName) {
  setToggle(toggleName, false);
  for (const [otherName, other] of Object.entries(CONFIG.toggles)) {
    if (other.requires === toggleName && session.toggles[otherName]) {
      setToggle(otherName, false);
    }
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

// The theme for the open section: its own, or the theme of the last switch
// in its list that is on and has one (Party mode 'friends-party', then
// 18+ wording 'friends-party-adult'; Dating's 18+ 'dating-adult').
function currentThemeName() {
  const switchThemes = currentToggleNames()
    .filter((toggleName) => isToggleOnHere(toggleName) && CONFIG.toggles[toggleName].themeWhenOn)
    .map((toggleName) => CONFIG.toggles[toggleName].themeWhenOn);
  return switchThemes.length > 0 ? switchThemes[switchThemes.length - 1] : session.section;
}

// Read every switch's choice saved earlier in this tab. A switch whose
// required switch is off stays off.
function loadToggles() {
  for (const toggleName of Object.keys(CONFIG.toggles)) {
    session.toggles[toggleName] = loadSaved(CONFIG.toggles[toggleName].storageKey, false, 'session') === true;
  }
  for (const [toggleName, toggle] of Object.entries(CONFIG.toggles)) {
    if (toggle.requires !== undefined && !session.toggles[toggle.requires]) {
      session.toggles[toggleName] = false;
    }
  }
}

// Show the open section's switches (none in Icebreaker), with labels and states.
function updateToggleDisplay() {
  const toggleNames = currentToggleNames();
  elements.toggleSetting.hidden = toggleNames.length === 0;
  elements.toggleSetting.replaceChildren(...toggleNames.map(createSwitch));
  updateToggleStates();
  fitCardToolbar();
}

// Build one switch from the template in index.html.
function createSwitch(toggleName) {
  const switchElement = elements.switchTemplate.content.firstElementChild.cloneNode(true);
  const input = switchElement.querySelector('.switch__input');
  input.dataset.toggle = toggleName;
  input.addEventListener('change', handleToggleChange);
  switchElement.querySelector('.switch__label').textContent = CONFIG.toggles[toggleName].label;
  switchElement.querySelector('.switch__label-short').textContent = CONFIG.toggles[toggleName].shortLabel;
  return switchElement;
}

// Set each switch to on or off, and make a switch that can't be changed yet
// unavailable, with a tooltip saying which switch to turn on first.
function updateToggleStates() {
  for (const input of elements.toggleSetting.querySelectorAll('.switch__input')) {
    const toggleName = input.dataset.toggle;
    input.checked = isToggleOnHere(toggleName);
    input.disabled = !canChangeToggle(toggleName);
    const requiredToggle = CONFIG.toggles[toggleName].requires;
    input.closest('.switch').title = input.disabled ? `Turn on ${CONFIG.toggles[requiredToggle].label} first` : '';
  }
}

// Show the toolbar above the card with full words if the switches and the
// level fit on one line, or as chips (short labels, − and +) if they don't.
// Runs when the labels change and whenever the toolbar changes width.
function fitCardToolbar() {
  const toolbar = elements.cardToolbar;
  toolbar.classList.remove('is-compact');
  const doesNotFit = toolbar.scrollWidth > toolbar.clientWidth;
  toolbar.classList.toggle('is-compact', doesNotFit);
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
  elements.saveButton.addEventListener('click', saveCurrentCard);
  elements.backButton.addEventListener('click', () => session.cardStack.showPrevious());
  new ResizeObserver(fitCardToolbar).observe(elements.cardToolbar);
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

// ----------------------------------------------------------
// Save: a picture of the card on top
// ----------------------------------------------------------

let isSaving = false;

// Make a picture of the card on top, exactly as it reads now (Gentle or
// Classic wording), and save it to the device. Extra presses while saving
// are ignored. Swiping carries on as normal.
async function saveCurrentCard() {
  const question = session.history[session.currentPosition];
  if (isSaving || question === null || question === undefined) {
    return;
  }
  isSaving = true;
  try {
    // The fonts are almost always loaded already; waiting only if they aren't
    // keeps the picture from ever using a plain fallback font.
    if (!cardImageFontsReady()) {
      await loadCardImageFonts();
    }
    // Use the words on screen: a wording change only applies from the next
    // card, so the card on top may still show the other wording.
    const shownText = elements.cardStack.querySelector('.card[data-depth="0"] .card__question');
    const card = {
      ...buildCardContent(question),
      ...(shownText ? { text: shownText.textContent } : {}),
      level: question.level,
      levelName: CONFIG.levelNames[question.level],
    };
    const blob = canvasToPngBlob(drawCardImage(card));
    const fileName = `${CONFIG.cardImage.fileNamePrefix}-${question.section}-L${question.level}.png`;
    const result = await saveImage(blob, fileName);
    debugLog('Card saved', { cardId: question.id, fileName, result });
    if (result === 'downloaded') {
      showToast(CONFIG.saveLabels.saved);
    }
  } finally {
    isSaving = false;
  }
}

// Show a short message (e.g. "Card saved") for a moment.
let toastTimer = null;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, CONFIG.toastMs);
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
  const allFiles = [...CONFIG.questionFileUrls, CONFIG.sourcesUrl, CONFIG.factsUrl].join(', ');
  if (data === null) {
    showError(`Couldn't read the questions. Check that each of these files is a list: ${allFiles}.`);
    return;
  }
  const { questions, sources, facts } = data;
  if (questions.length === 0) {
    showError(`No questions found. Check ${CONFIG.questionFileUrls.join(', ')}.`);
    return;
  }
  session.sourcesById = new Map(sources.map((source) => [source.id, source]));
  session.factsById = new Map(facts.map((fact) => [fact.id, fact]));
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
