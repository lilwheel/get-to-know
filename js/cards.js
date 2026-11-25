// ==========================================================
// Card stack
// Shows the current card on top with up to two cards behind it
// (never more than three cards in the page). Moves forward by flying
// the top card off-screen, and back by sliding the previous card in.
// The app tells the stack which card belongs at each position.
// ==========================================================

import { CONFIG } from './config.js';
import { debugLog } from './debug.js';
import { attachSwipe } from './swipe.js';
import { readCssDurationMs } from './timing.js';

// A depth one past the last visible card: the card is there but transparent,
// so it can fade into the back of the stack.
const HIDDEN_DEPTH = CONFIG.maxCardsInPage;

// ----------------------------------------------------------
// Public: create the stack
// ----------------------------------------------------------

// Build a card stack inside containerElement.
// getCardAt(position) returns {id, text, why, sourceTitle, sourceUrl} for that position.
// onCardShown(position) runs whenever a new card settles on top.
// forgetCardsAfter(position) runs just before the upcoming cards are rebuilt,
// so the app can drop the cards it had lined up after that position.
export function createCardStack({ containerElement, getCardAt, onCardShown, forgetCardsAfter }) {
  const stack = {
    containerElement,
    getCardAt,
    onCardShown,
    forgetCardsAfter,
    currentPosition: 0,
    isAnimating: false,
    needsUpcomingRefresh: false,
    isDestroyed: false,
    cardElements: [], // index 0 is the top card
  };

  renderInitialCards(stack);
  onCardShown(stack.currentPosition);

  return {
    showNext: (direction = 'left') => showNext(stack, direction),
    showPrevious: () => showPrevious(stack),
    refreshUpcoming: () => refreshUpcoming(stack),
    destroy: () => destroy(stack),
  };
}

// ----------------------------------------------------------
// Building cards
// ----------------------------------------------------------

// Create the elements for the top card and the cards behind it.
function renderInitialCards(stack) {
  for (let depth = 0; depth < CONFIG.maxCardsInPage; depth += 1) {
    const cardElement = createCardElement(stack, stack.getCardAt(stack.currentPosition + depth));
    setDepth(cardElement, depth);
    stack.containerElement.prepend(cardElement);
    stack.cardElements.push(cardElement);
  }
}

// Build one card: the text in the middle (with the dare label and "who"
// line on dares), an optional Pass button, and the footnote at the bottom.
function createCardElement(stack, card) {
  const cardElement = document.createElement('article');
  cardElement.className = card.type === 'dare' ? 'card card--dare' : 'card';
  cardElement.dataset.cardId = card.id;

  if (card.isParty) {
    cardElement.append(createPartyBadge());
  }
  cardElement.append(createBodyElement(card));
  if (card.canPass) {
    cardElement.append(createPassButton(stack, card));
  }
  cardElement.append(createFootnoteElement(card));
  attachSwipe(cardElement, {
    canSwipe: () => cardElement.dataset.depth === '0' && !stack.isAnimating,
    onSwipe: (direction) => showNext(stack, direction),
  });
  return cardElement;
}

// Build the middle of the card. A dare gets a small "Dare" label above the
// text and a "Whole table" line under it; a question is just its text.
function createBodyElement(card) {
  const bodyElement = document.createElement('div');
  bodyElement.className = 'card__body';

  const textElement = document.createElement('p');
  textElement.className = 'card__question';
  textElement.textContent = card.text;

  if (card.type !== 'dare') {
    bodyElement.append(textElement);
    return bodyElement;
  }
  const labelElement = document.createElement('p');
  labelElement.className = 'card__label';
  labelElement.textContent = CONFIG.cardLabels.dare;
  const whoElement = document.createElement('p');
  whoElement.className = 'card__who';
  whoElement.textContent = CONFIG.cardLabels.dareWho;
  bodyElement.append(labelElement, textElement, whoElement);
  return bodyElement;
}

// Build the small "Party" badge shown in the corner of Party mode cards.
function createPartyBadge() {
  const badgeElement = document.createElement('span');
  badgeElement.className = 'card__badge';
  badgeElement.textContent = CONFIG.cardLabels.party;
  return badgeElement;
}

// Build the Pass button: skips this card with no penalty, exactly like Next.
function createPassButton(stack, card) {
  const passButton = document.createElement('button');
  passButton.type = 'button';
  passButton.className = 'toggle-button card__pass';
  passButton.textContent = CONFIG.cardLabels.pass;
  passButton.addEventListener('click', () => {
    debugLog('Card passed', { cardId: card.id });
    showNext(stack, 'left');
  });
  return passButton;
}

// Build the footnote: the "why" line, then a link to the source in a new tab.
// Either part is left out when the card has none (the "no questions" card).
function createFootnoteElement(card) {
  const footnoteElement = document.createElement('footer');
  footnoteElement.className = 'card__footnote';

  if (card.why) {
    const whyElement = document.createElement('p');
    whyElement.className = 'card__why';
    whyElement.textContent = card.why;
    footnoteElement.append(whyElement);
  }

  if (card.sourceUrl) {
    const sourceLink = document.createElement('a');
    sourceLink.className = 'card__source';
    sourceLink.href = card.sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = `Source: ${card.sourceTitle}`;
    footnoteElement.append(sourceLink);
  }
  return footnoteElement;
}

// Place a card at a depth in the stack. Only the top card can be used;
// the ones behind are inert so they can't be focused, clicked or read aloud.
function setDepth(cardElement, depth) {
  cardElement.dataset.depth = String(depth);
  cardElement.inert = depth > 0;
}

// ----------------------------------------------------------
// Moving forward
// ----------------------------------------------------------

// Fly the top card off to one side and bring the next card to the top.
async function showNext(stack, direction) {
  if (stack.isAnimating) {
    return;
  }
  stack.isAnimating = true;

  const leavingCard = stack.cardElements.shift();
  flyOff(leavingCard, direction);
  stack.cardElements.forEach((cardElement, depth) => setDepth(cardElement, depth));

  await waitForTransition(leavingCard, readCssDurationMs('--duration-fly'));
  if (stack.isDestroyed) {
    return;
  }
  leavingCard.remove();
  stack.currentPosition += 1;
  addCardAtBack(stack);

  finishMove(stack);
}

// Start the fly-off animation from wherever the card currently is.
function flyOff(cardElement, direction) {
  cardElement.classList.remove('is-dragging');
  cardElement.style.transform = '';
  cardElement.classList.add(direction === 'right' ? 'card--off-right' : 'card--off-left');
}

// Add a new card at the back of the stack and fade it in.
function addCardAtBack(stack) {
  const backDepth = CONFIG.maxCardsInPage - 1;
  const card = stack.getCardAt(stack.currentPosition + backDepth);
  const cardElement = createCardElement(stack, card);
  setDepth(cardElement, HIDDEN_DEPTH);
  stack.containerElement.prepend(cardElement);
  forceStyleUpdate(cardElement);
  setDepth(cardElement, backDepth);
  stack.cardElements.push(cardElement);
}

// ----------------------------------------------------------
// Moving back
// ----------------------------------------------------------

// Slide the previous card back in from the left, on top of the stack.
async function showPrevious(stack) {
  if (stack.isAnimating || stack.currentPosition === 0) {
    return;
  }
  stack.isAnimating = true;

  // Remove the back card first so the page never holds more than three.
  stack.cardElements.pop().remove();
  stack.cardElements.forEach((cardElement, depth) => setDepth(cardElement, depth + 1));

  const returningCard = createCardElement(stack, stack.getCardAt(stack.currentPosition - 1));
  returningCard.classList.add('card--off-left', 'card--no-transition');
  setDepth(returningCard, 0);
  stack.containerElement.append(returningCard);
  forceStyleUpdate(returningCard);
  returningCard.classList.remove('card--off-left', 'card--no-transition');
  stack.cardElements.unshift(returningCard);

  await waitForTransition(returningCard, readCssDurationMs('--duration-settle'));
  if (stack.isDestroyed) {
    return;
  }
  stack.currentPosition -= 1;
  finishMove(stack);
}

// ----------------------------------------------------------
// Replacing upcoming cards and closing the stack
// ----------------------------------------------------------

// Rebuild the cards behind the top one (e.g. after a level change), so the
// next card comes from the new level. Waits if a move is still animating.
function refreshUpcoming(stack) {
  if (stack.isAnimating) {
    stack.needsUpcomingRefresh = true;
    return;
  }
  stack.forgetCardsAfter(stack.currentPosition);
  for (let depth = 1; depth < stack.cardElements.length; depth += 1) {
    const oldCardElement = stack.cardElements[depth];
    const newCardElement = createCardElement(stack, stack.getCardAt(stack.currentPosition + depth));
    setDepth(newCardElement, depth);
    oldCardElement.replaceWith(newCardElement);
    stack.cardElements[depth] = newCardElement;
  }
}

// Remove every card and stop any animation that is still finishing.
function destroy(stack) {
  stack.isDestroyed = true;
  stack.cardElements = [];
  stack.containerElement.replaceChildren();
}

// ----------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------

// Unlock input, apply any refresh that had to wait, and tell the app
// which card is now on top.
function finishMove(stack) {
  stack.isAnimating = false;
  if (stack.needsUpcomingRefresh) {
    stack.needsUpcomingRefresh = false;
    refreshUpcoming(stack);
  }
  debugLog('Card stack moved', {
    position: stack.currentPosition,
    cardsInPage: stack.containerElement.children.length,
  });
  stack.onCardShown(stack.currentPosition);
}

// Make the browser apply a card's starting style now, so the next
// style change animates instead of jumping straight to the end.
function forceStyleUpdate(element) {
  element.getBoundingClientRect();
}

// Resolve when the element's transform animation ends, or after its
// duration plus a safety margin if the browser never reports the end.
function waitForTransition(element, durationMs) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(finish, durationMs + CONFIG.transitionSafetyMarginMs);
    // Stop listening and waiting, then let the caller carry on. Runs only once.
    function finish() {
      clearTimeout(timeoutId);
      element.removeEventListener('transitionend', handleTransitionEnd);
      resolve();
    }
    // Finish when this card's own transform transition ends (not a child's, not opacity).
    function handleTransitionEnd(event) {
      if (event.target === element && event.propertyName === 'transform') {
        finish();
      }
    }
    element.addEventListener('transitionend', handleTransitionEnd);
  });
}
