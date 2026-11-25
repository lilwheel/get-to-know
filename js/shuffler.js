// ==========================================================
// Shuffler
// Keeps one shuffled pool of questions per section and level.
// Cards are dealt from a pool without repeats; when a pool runs out
// it is reshuffled, and the card just shown is kept from coming
// straight back. Cards already seen (saved from an earlier visit)
// start outside their pool.
// ==========================================================

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
    dealNext: (section, level) => dealNext(state, section, level),
    putBack: (question) => putBack(state, question),
    markShown: (question) => markShown(state, question),
    findById: (id) => state.questionsById.get(id) || null,
    getSeenIds: () => [...state.seenIds],
    cardsLeft: (section, level) => (state.pools.get(poolKey(section, level)) || []).length,
    reset: () => resetAll(state),
  };
}

// ----------------------------------------------------------
// Building pools
// ----------------------------------------------------------

// The name of the pool for one section and level, e.g. "dating-2".
function poolKey(section, level) {
  return `${section}-${level}`;
}

// Index every question by its pool once, so dealing never scans the whole bank.
function groupByPool(questions) {
  const questionsByPool = new Map();
  for (const question of questions) {
    const key = poolKey(question.section, question.level);
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

// Take the next card from a pool, reshuffling first if the pool is empty.
// Returns null only if the section and level have no questions at all.
function dealNext(state, section, level) {
  const key = poolKey(section, level);
  const allQuestions = state.questionsByPool.get(key);
  if (!allQuestions || allQuestions.length === 0) {
    return null;
  }
  if (state.pools.get(key).length === 0) {
    reshufflePool(state, key, allQuestions);
  }
  const question = state.pools.get(key).pop();
  state.dealtButNotShownIds.add(question.id);
  return question;
}

// Refill an emptied pool: everything in it becomes unseen again, except
// cards already dealt into the stack. The last card shown goes to the
// bottom so it doesn't come straight back.
function reshufflePool(state, key, allQuestions) {
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
  state.pools.get(poolKey(question.section, question.level)).push(question);
}

// Record that a card reached the top of the stack.
function markShown(state, question) {
  state.dealtButNotShownIds.delete(question.id);
  state.seenIds.add(question.id);
  state.lastShownIdByPool.set(poolKey(question.section, question.level), question.id);
}

// Forget everything seen and reshuffle every pool from scratch.
function resetAll(state) {
  state.seenIds.clear();
  state.dealtButNotShownIds.clear();
  state.lastShownIdByPool.clear();
  fillAllPools(state);
}
