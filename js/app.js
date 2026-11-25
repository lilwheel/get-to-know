// ==========================================================
// App entry point
// Loads the data once, builds the card stack, and connects the
// buttons, arrow keys and sound toggle to it.
// ==========================================================

import { CONFIG } from './config.js';
import { createCardStack } from './cards.js';
import { debugLog } from './debug.js';
import { playCardChangeFeedback, setSoundEnabled } from './feedback.js';
import { applyTheme } from './theme.js';

// ----------------------------------------------------------
// Setup: page elements used by the app
// ----------------------------------------------------------
const elements = {
  cardStack: document.getElementById('card-stack'),
  backButton: document.getElementById('back-button'),
  nextButton: document.getElementById('next-button'),
  soundToggle: document.getElementById('sound-toggle'),
  errorMessage: document.getElementById('error-message'),
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

// Turn the sources list into a lookup table keyed by source id.
function indexSourcesById(sources) {
  return new Map(sources.map((source) => [source.id, source]));
}

// Combine a question with its source into what a card needs to display.
function buildCardContent(question, sourcesById) {
  const source = sourcesById.get(question.source_id);
  return {
    id: question.id,
    section: question.section,
    level: question.level,
    text: question.text,
    why: question.why,
    sourceTitle: source ? source.title : '',
    sourceUrl: source ? source.url : '',
  };
}

// ----------------------------------------------------------
// Error display
// ----------------------------------------------------------

// Show a plain, specific error message to the user and hide the controls.
function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
  elements.backButton.disabled = true;
  elements.nextButton.disabled = true;
}

// ----------------------------------------------------------
// Controls: buttons, keyboard and sound toggle
// ----------------------------------------------------------

// Connect Back/Next buttons and the left/right arrow keys to the stack.
function connectNavigation(cardStack) {
  elements.nextButton.addEventListener('click', () => cardStack.showNext('left'));
  elements.backButton.addEventListener('click', () => cardStack.showPrevious());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      cardStack.showNext('left');
    } else if (event.key === 'ArrowLeft') {
      cardStack.showPrevious();
    }
  });
}

// Flip the click sound on or off and update the button's label and state.
function connectSoundToggle() {
  elements.soundToggle.addEventListener('click', () => {
    const turningOn = elements.soundToggle.getAttribute('aria-pressed') !== 'true';
    setSoundEnabled(turningOn);
    elements.soundToggle.setAttribute('aria-pressed', String(turningOn));
    elements.soundToggle.textContent = turningOn ? 'Sound on' : 'Sound off';
  });
}

// ----------------------------------------------------------
// Startup
// ----------------------------------------------------------

// Load all data, then build the card stack and wire up the controls.
async function startApp() {
  applyTheme('neutral');
  let cards;
  try {
    const [questions, sources] = await Promise.all([
      loadJsonFile(CONFIG.questionsUrl),
      loadJsonFile(CONFIG.sourcesUrl),
    ]);
    const sourcesById = indexSourcesById(sources);
    cards = questions.map((question) => buildCardContent(question, sourcesById));
  } catch (error) {
    showError(error.message);
    return;
  }
  if (cards.length === 0) {
    showError(`No questions found. Check ${CONFIG.questionsUrl}.`);
    return;
  }
  startCardStack(cards);
}

// Create the stack over the loaded cards. For now the sample cards
// simply repeat in order; Step 4 replaces this with the shuffler.
function startCardStack(cards) {
  let isFirstCard = true;
  const getCardAt = (position) => cards[position % cards.length];
  const cardStack = createCardStack({
    containerElement: elements.cardStack,
    getCardAt,
    onCardShown: (position) => {
      const card = getCardAt(position);
      elements.backButton.disabled = position === 0;
      if (!isFirstCard) {
        playCardChangeFeedback();
      }
      isFirstCard = false;
      debugLog('Card shown', {
        section: card.section,
        level: card.level,
        cardId: card.id,
        cardsLeft: cards.length - 1 - (position % cards.length),
      });
    },
  });
  connectNavigation(cardStack);
  connectSoundToggle();
}

startApp();
