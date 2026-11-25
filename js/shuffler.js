// ==========================================================
// Shuffler
// Keeps one shuffled pool of cards per section, level and kind:
//   general - normal cards
//   adult   - 18+ cards, mixed in at a fixed rate when the 18+ switch is on
//   party   - Party mode cards, dealt instead of general ones when Party mode is on
// Cards are dealt without repeats. When a general or party pool runs out
// it is reshuffled, and the card just shown is kept from coming straight
// back. An 18+ pool is never reshuffled: once its cards are used up, that
// level deals normal cards only, until Reset. Cards already seen (saved
// from an earlier visit) start outside their pool. Each kind only works in
// the section whose toggle it belongs to (see sectionHasToggle in config.js).
//
// 18+ rate: at a level listed in CONFIG.toggles.adult.oneInEveryByLevel
// (say 1 in 3), cards are dealt in blocks of 3 with exactly one 18+ card
// in a random spot in each block. See "The 18+ rate" below.
// ==========================================================

import { CONFIG, sectionHasToggle } from './config.js';
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
    // One 18+ rate plan per section and level, created when first needed.
    adultPlans: new Map(),
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

// Take the next card for a section and level. If this spot in the current
// 18+ block is the 18+ one and an 18+ card is left, deal that; otherwise
// deal from the main pool (general, or party in Party mode), reshuffling it
// first if it has run out. Returns null only if there are no cards at all.
function dealNext(state, section, level, options) {
  const adultPlan = isAdultRateActive(section, level, options) ? getAdultPlan(state, section, level) : null;
  const wantsAdult = adultPlan !== null && takeNextSlot(adultPlan);
  const adultPool = adultPoolOf(state, section, level);

  let question;
  if (wantsAdult && adultPool.length > 0) {
    question = adultPool.pop();
  } else {
    question = dealFromMainPool(state, section, level, options);
  }
  if (question === null) {
    return null;
  }
  state.dealtButNotShownIds.add(question.id);
  if (adultPlan !== null) {
    recordPlannedDeal(adultPlan, question, section, level);
  }
  return question;
}

// Deal one card from the main pool, reshuffling it first if it's empty.
function dealFromMainPool(state, section, level, options) {
  const key = mainPoolKey(state, section, level, options);
  if (key === null) {
    return null;
  }
  if (state.pools.get(key).length === 0) {
    reshufflePool(state, key);
  }
  return state.pools.get(key).pop();
}

// The 18+ cards left to deal at a section and level (empty if there are none).
function adultPoolOf(state, section, level) {
  return state.pools.get(poolKey(section, level, 'adult')) || [];
}

// True if a pool has any cards at all (seen or not).
function poolHasCards(state, key) {
  return (state.questionsByPool.get(key) || []).length > 0;
}

// The pool normal dealing uses: party in Party mode (only in the party
// section, and only if that level has party cards), otherwise general.
// Null if neither has any cards.
function mainPoolKey(state, section, level, options) {
  const partyKey = poolKey(section, level, 'party');
  if (options.partyMode === true && sectionHasToggle(section, 'party') && poolHasCards(state, partyKey)) {
    return partyKey;
  }
  const generalKey = poolKey(section, level, 'general');
  return poolHasCards(state, generalKey) ? generalKey : null;
}

// How many cards are left to deal for a section and level before a
// reshuffle (used in debug logs), counting 18+ cards when they're on.
function cardsLeft(state, section, level, options) {
  const mainKey = mainPoolKey(state, section, level, options);
  let total = mainKey === null ? 0 : state.pools.get(mainKey).length;
  if (isAdultRateActive(section, level, options)) {
    total += adultPoolOf(state, section, level).length;
  }
  return total;
}

// ----------------------------------------------------------
// The 18+ rate
// A plan per section and level counts the cards dealt there while 18+ is
// on, and picks one random spot per block for the 18+ card. A card that is
// put back (lined up but never shown) comes off the count, so changing
// level or flipping a switch doesn't throw the rate off.
// ----------------------------------------------------------

// True if 18+ cards should be mixed in here: the switch is on, this is the
// 18+ section, and this level has a rate in CONFIG.
function isAdultRateActive(section, level, options) {
  const rate = CONFIG.toggles.adult.oneInEveryByLevel[level];
  return options.includeAdult === true && sectionHasToggle(section, 'adult') && rate > 0;
}

// The name of the 18+ plan for a section and level, e.g. "dating-3".
function adultPlanKey(section, level) {
  return `${section}-${level}`;
}

// The plan for a section and level, made the first time it's needed.
function getAdultPlan(state, section, level) {
  const key = adultPlanKey(section, level);
  if (!state.adultPlans.has(key)) {
    state.adultPlans.set(key, {
      blockSize: CONFIG.toggles.adult.oneInEveryByLevel[level],
      dealtCount: 0,           // cards dealt here so far (minus any put back)
      adultSpotByBlock: [],    // for each block, which spot (0 to blockSize - 1) is 18+
      plannedIds: new Set(),   // cards dealt under this plan and not yet put back
      adultDealt: 0,
      regularDealt: 0,
    });
  }
  return state.adultPlans.get(key);
}

// Move to the next spot in the plan and say whether it's the 18+ spot.
function takeNextSlot(plan) {
  const blockIndex = Math.floor(plan.dealtCount / plan.blockSize);
  if (plan.adultSpotByBlock[blockIndex] === undefined) {
    plan.adultSpotByBlock[blockIndex] = Math.floor(Math.random() * plan.blockSize);
  }
  const spotInBlock = plan.dealtCount % plan.blockSize;
  plan.dealtCount += 1;
  return spotInBlock === plan.adultSpotByBlock[blockIndex];
}

// Count a card dealt under a plan, and log the running totals.
function recordPlannedDeal(plan, question, section, level) {
  plan.plannedIds.add(question.id);
  if (question.adult === true) {
    plan.adultDealt += 1;
  } else {
    plan.regularDealt += 1;
  }
  debugLog('18+ rate', { section, level, adult: plan.adultDealt, regular: plan.regularDealt });
}

// Undo the count for a card that was put back, so the plan steps back one spot.
function unrecordPlannedDeal(state, question) {
  const plan = state.adultPlans.get(adultPlanKey(question.section, question.level));
  if (plan === undefined || !plan.plannedIds.has(question.id)) {
    return;
  }
  plan.plannedIds.delete(question.id);
  plan.dealtCount -= 1;
  if (question.adult === true) {
    plan.adultDealt -= 1;
  } else {
    plan.regularDealt -= 1;
  }
}

// ----------------------------------------------------------
// Reshuffling
// ----------------------------------------------------------

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
  unrecordPlannedDeal(state, question);
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
  state.adultPlans.clear();
  fillAllPools(state);
}
