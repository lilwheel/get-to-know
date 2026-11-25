// ==========================================================
// Shuffler
// Keeps one shuffled pool of cards per section, level and kind:
//   general - normal cards
//   adult   - 18+ cards, added alongside general ones when the 18+ switch is on
//   party   - Party mode cards, dealt instead of general ones when Party mode is on
// Cards are dealt without repeats; when the pools in use run out they
// are reshuffled, and the card just shown is kept from coming straight
// back. Cards already seen (saved from an earlier visit) start outside
// their pool. Each kind only works in the section whose toggle it belongs
// to (see sectionHasToggle in config.js).
// ==========================================================

import { sectionHasToggle } from './config.js';
import { debugLog } from './debug.js';

// ----------------------------------------------------------
// Public: create a shuffler
// ----------------------------------------------------------

// Build a shuffler over all questions. seenIds lists cards already shown.
// Dealing takes `options`: { includeAdult, partyMode }, both true or false.
export function createShuffler(questions, seenIds = []) {
  const state = {
    questionsByPool: groupByPool(questions),
    questionsById: new Map(questions.map((question) => [question.id, question])),
    seenIds: new Set(),
    dealtButNotShownIds: new Set(),
    lastShownIdByPool: new Map(),
    pools: new Map(),
  };
  seenIds.filter((id) => state.questionsById.has(id)).forEach((id) => state.seenIds.add(id));
  fillAllPools(state);

  return {
    dealNext: (section, level, options) => dealNext(state, section, level, options),
    putBack: (question) => putBack(state, question),
    markShown: (question) => markShown(state, question),
    takeOut: (question) => takeOut(state, question),
    findById: (id) => state.questionsById.get(id) || null,
    getSeenIds: () => [...state.seenIds],
    cardsLeft: (section, level, options) => cardsLeft(state, section, level, options),
    reset: () => resetAll(state),
  };
}

// ----------------------------------------------------------
// Building pools
// ----------------------------------------------------------

// The name of a pool, e.g. "dating-2-general", "dating-2-adult" or "friends-1-party".
function poolKey(section, level, kind) {
  return `${section}-${level}-${kind}`;
}

// The name of the pool a question belongs to.
function poolKeyOf(question) {
  let kind = 'general';
  if (question.adult === true) {
    kind = 'adult';
  } else if (question.party === true) {
    kind = 'party';
  }
  return poolKey(question.section, question.level, kind);
}

// Index every question by its pool once, so dealing never scans the whole bank.
function groupByPool(questions) {
  const questionsByPool = new Map();
  for (const question of questions) {
    const key = poolKeyOf(question);
    if (!questionsByPool.has(key)) {
      questionsByPool.set(key, []);
    }
    questionsByPool.get(key).push(question);
  }
  return questionsByPool;
}

// Fill every pool with its unseen questions in a random order.
function fillAllPools(state) {
  for (const [key, questions] of state.questionsByPool) {
    const unseen = questions.filter((question) => !state.seenIds.has(question.id));
    state.pools.set(key, shuffle(unseen));
  }
}

// Return a shuffled copy of a list (Fisher–Yates: every order equally likely).
function shuffle(list) {
  const shuffled = [...list];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// ----------------------------------------------------------
// Dealing
// ----------------------------------------------------------

// Take the next card for a section and level, reshuffling first if every
// pool in use is empty. Returns null only if there are no questions at all.
function dealNext(state, section, level, options) {
  const keys = poolKeysFor(state, section, level, options);
  if (keys.length === 0) {
    return null;
  }
  if (countRemaining(state, keys) === 0) {
    keys.forEach((key) => reshufflePool(state, key));
  }
  const question = state.pools.get(pickPoolByRemaining(state, keys)).pop();
  state.dealtButNotShownIds.add(question.id);
  return question;
}

// The non-empty pools to deal from at a section and level.
// - Party mode (only in the party section) swaps the general pool for the
//   party pool; if that level has no party cards, general cards are used.
// - The 18+ switch (only in the adult section) adds the adult pool.
// Checking the section here means no other section can ever get these cards.
function poolKeysFor(state, section, level, options) {
  const hasCards = (key) => (state.questionsByPool.get(key) || []).length > 0;
  let mainKey = poolKey(section, level, 'general');
  const partyKey = poolKey(section, level, 'party');
  if (options.partyMode === true && sectionHasToggle(section, 'party') && hasCards(partyKey)) {
    mainKey = partyKey;
  }
  const keys = [mainKey];
  if (options.includeAdult === true && sectionHasToggle(section, 'adult')) {
    keys.push(poolKey(section, level, 'adult'));
  }
  return keys.filter(hasCards);
}

// How many cards are left to deal for a section and level (used in debug logs).
function cardsLeft(state, section, level, options) {
  const keys = poolKeysFor(state, section, level, options);
  return countRemaining(state, keys);
}

// How many cards are left across some pools.
function countRemaining(state, keys) {
  return keys.reduce((total, key) => total + state.pools.get(key).length, 0);
}

// Choose a pool with odds matching how many cards it has left, which is
// the same as dealing from one combined shuffled pool.
function pickPoolByRemaining(state, keys) {
  let target = Math.random() * countRemaining(state, keys);
  for (const key of keys) {
    target -= state.pools.get(key).length;
    if (target < 0) {
      return key;
    }
  }
  return keys.find((key) => state.pools.get(key).length > 0);
}

// Refill an emptied pool: everything in it becomes unseen again, except
// cards already dealt into the stack. The last card shown goes to the
// bottom so it doesn't come straight back.
function reshufflePool(state, key) {
  const allQuestions = state.questionsByPool.get(key);
  allQuestions.forEach((question) => state.seenIds.delete(question.id));
  let refill = allQuestions.filter((question) => !state.dealtButNotShownIds.has(question.id));
  // Tiny pools can have every card already dealt; then allow repeats.
  if (refill.length === 0) {
    refill = allQuestions;
  }
  refill = shuffle(refill);
  moveLastShownToBottom(refill, state.lastShownIdByPool.get(key));
  state.pools.set(key, refill);
  debugLog('Pool reshuffled', { pool: key, cards: refill.length });
}

// Cards are dealt from the end of the list, so index 0 is dealt last.
function moveLastShownToBottom(pool, lastShownId) {
  const index = pool.findIndex((question) => question.id === lastShownId);
  if (index > 0) {
    const [lastShown] = pool.splice(index, 1);
    pool.unshift(lastShown);
  }
}

// ----------------------------------------------------------
// Returning and recording cards
// ----------------------------------------------------------

// Return a dealt card that was never shown, so it's dealt next time instead.
function putBack(state, question) {
  if (!state.dealtButNotShownIds.has(question.id)) {
    return;
  }
  state.dealtButNotShownIds.delete(question.id);
  state.pools.get(poolKeyOf(question)).push(question);
}

// Take a specific card out of its pool, so it won't be dealt this time
// round. Used for the saved card that resumes on top after a reload.
function takeOut(state, question) {
  const pool = state.pools.get(poolKeyOf(question));
  const index = pool.indexOf(question);
  if (index !== -1) {
    pool.splice(index, 1);
  }
}

// Record that a card reached the top of the stack.
function markShown(state, question) {
  state.dealtButNotShownIds.delete(question.id);
  state.seenIds.add(question.id);
  state.lastShownIdByPool.set(poolKeyOf(question), question.id);
}

// Forget everything seen and reshuffle every pool from scratch.
function resetAll(state) {
  state.seenIds.clear();
  state.dealtButNotShownIds.clear();
  state.lastShownIdByPool.clear();
  fillAllPools(state);
}
