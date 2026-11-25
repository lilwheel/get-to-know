// ==========================================================
// App settings
// The one CONFIG object. Every tunable number in the JavaScript
// lives here. Animation durations and easings live in CSS variables
// (css/styles.css) so prefers-reduced-motion can change them in one place.
// ==========================================================

export const CONFIG = {
  // Data files, loaded once at startup. Every card file is merged into one bank.
  // data/sample-friends.json is temporary: it holds Friends & Teammates sample
  // cards until the real ones are written (Phase 2, Step P2-6), then it goes.
  questionFileUrls: ['data/questions.json', 'data/sample-friends.json'],
  sourcesUrl: 'data/sources.json',

  // The sections, in the order their buttons appear on the start screen.
  // The key is the section id used in the data and as the theme name.
  //   name:           shown on the start button and the card screen header
  //   hint:           the line under the name on the start button
  //   hasPassButton:  show a Pass button on every card (no penalty for using it)
  // To add a section: add it here, add its cards, and give it a theme in css/styles.css.
  sections: {
    icebreaker: {
      name: 'Icebreaker',
      hint: 'First dates and new connections',
      hasPassButton: false,
    },
    dating: {
      name: 'Dating',
      hint: 'Couples a few months in',
      hasPassButton: false,
    },
    friends: {
      name: 'Friends & Teammates',
      hint: 'Questions and dares for the whole table',
      hasPassButton: true,
    },
  },

  // Words shown on cards.
  cardLabels: {
    dare: 'Dare',
    // Every dare is done by the whole table (decided for Phase 2).
    dareWho: 'Whole table',
    pass: 'Pass',
  },

  levelNames: {
    1: 'Light',
    2: 'Personal',
    3: 'Deep',
  },
  lowestLevel: 1,
  deepestLevel: 3,

  // The only section that can ever show 18+ questions.
  adultSection: 'dating',

  // Storage keys for saved progress and settings.
  storageKeys: {
    seenIds: 'getting-to-know.seen-ids',
    place: 'getting-to-know.place',
    // Kept in sessionStorage, so it resets when the tab is closed.
    includeAdult: 'getting-to-know.include-adult',
  },

  // Most cards in the page at once: the top card and two behind it.
  // css/styles.css styles one data-depth per card, so change both together.
  maxCardsInPage: 3,

  // Swiping: a drag past this share of the screen width counts as a swipe.
  swipeDistanceRatio: 0.3,
  // A release faster than this (pixels per millisecond) counts as a flick.
  flickVelocityPxPerMs: 0.5,
  // How far back in time (ms) to look when measuring release speed.
  velocitySampleWindowMs: 100,
  // How much the card tilts while dragged, in degrees per pixel moved.
  dragRotationDegreesPerPixel: 0.05,

  // Extra wait (ms) after an animation's duration in case transitionend never fires.
  transitionSafetyMarginMs: 50,

  // Feedback when a card changes.
  vibrationMs: 12,
  clickSound: {
    frequencyHz: 1800,
    durationMs: 40,
    volume: 0.15,
  },
};
