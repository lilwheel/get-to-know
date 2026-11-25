// ==========================================================
// Shuffler
// Keeps one shuffled pool of questions per section and level, with
// 18+ questions in a pool of their own so they can be left out.
// Cards are dealt without repeats; when the pools in use run out they
// are reshuffled, and the card just shown is kept from coming straight
// back. Cards already seen (saved from an earlier visit) start outside
// their pool. 18+ cards are only ever dealt in CONFIG.adultSection.
// ==========================================================

import { CONFIG } from './config.js';
import { debugLog } from './debug.js';

// ----------------------------------------------------------
// Public: create a shuffler
// ----------------------------------------------------------

// Build a shuffler over all questions. seenIds lists cards already shown.
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
    dealNext: (section, level, includeAdult) => dealNext(state, section, level, includeAdult),
    putBack: (question) => putBack(state, question),
    markShown: (question) => markShown(state, question),
    findById: (id) => state.questionsById.get(id) || null,
    getSeenIds: () => [...state.seenIds],
    cardsLeft: (section, level, includeAdult) => countRemaining(state, poolKeysFor(state, section, level, includeAdult)),
    reset: () => resetAll(state),
  };
}

// ----------------------------------------------------------
// Building pools
// ----------------------------------------------------------

// The name of a pool, e.g. "dating-2-general" or "dating-2-adult".
function poolKey(section, level, isAdult) {
  return `${section}-${level}-${isAdult ? 'adult' : 'general'}`;
}

// The name of the pool a question belongs to.
function poolKeyOf(question) {
  return poolKey(question.section, question.level, question.adult === true);
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
function dealNext(state, section, level, includeAdult) {
  const keys = poolKeysFor(state, section, level, includeAdult);
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

// The non-empty pools to deal from. 18+ pools are included only when
// asked for and only in the adult section, so Icebreaker never gets them.
function poolKeysFor(state, section, level, includeAdult) {
  const keys = [poolKey(section, level, false)];
  if (includeAdult === true && section === CONFIG.adultSection) {
    keys.push(poolKey(section, level, true));
  }
  return keys.filter((key) => (state.questionsByPool.get(key) || []).length > 0);
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
