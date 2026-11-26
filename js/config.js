// ==========================================================
// App settings
// The one CONFIG object (plus a small helper that reads it). Every
// tunable number and section setting in the JavaScript lives here. Animation durations and easings live in CSS variables
// (css/styles.css) so prefers-reduced-motion can change them in one place.
// ==========================================================

// True if a section shows the named toggle ('adult', 'party' or 'adultWording').
// Used by the shuffler and the app, so a toggle can never affect another section.
export function sectionHasToggle(section, toggleName) {
  const sectionSettings = CONFIG.sections[section];
  return sectionSettings !== undefined && sectionSettings.toggles.includes(toggleName);
}

export const CONFIG = {
  // Data files, loaded once at startup. Every card file in the list is merged
  // into one bank, so cards could be split across files later if needed.
  questionFileUrls: ['data/questions.json'],
  sourcesUrl: 'data/sources.json',
  // The research findings shown in each card's footnote ("Did you know?").
  factsUrl: 'data/facts.json',

  // The sections, in the order their buttons appear on the start screen.
  // The key is the section id used in the data and as the theme name.
  //   name:           shown on the start button and the card screen header
  //   hint:           the line under the name on the start button
  //   hasPassButton:  show a Pass button on every card (no penalty for using it)
  //   toggles:        the gated switches this section shows, left to right, from
  //                   `toggles` below (empty for none). A toggle only ever works in
  //                   its own section.
  // To add a section: add it here, add its cards, and give it a theme in css/styles.css.
  sections: {
    icebreaker: {
      name: 'Icebreaker',
      hint: 'First dates and new connections',
      hasPassButton: false,
      toggles: [],
    },
    dating: {
      name: 'Dating',
      hint: 'Couples a few months in',
      hasPassButton: false,
      toggles: ['adult'],
    },
    friends: {
      name: 'Friends & Teammates',
      hint: 'Questions and dares for the whole table',
      hasPassButton: true,
      toggles: ['party', 'adultWording'],
    },
  },

  // Gated switches: off by default, and turning one on needs Confirm in a dialog.
  // The choice lives in sessionStorage, so it resets when the tab closes.
  //   label:              the text beside the switch
  //   shortLabel:         the switch's text on narrow cards, where it shrinks to a chip
  //   cardFlag:           the card field that marks this toggle's cards ("adult" or
  //                       "party"), or null for a switch that only changes wording
  //   storageKey:         where the choice is kept (sessionStorage)
  //   confirm:            what the dialog shows: an optional heading, the message
  //                       (each line on its own line), and the button text
  //   turnOffClearsVisit: true = turning it off reopens the section, so none of its
  //                       cards stay on screen or behind Back; false = normal cards
  //                       just resume from the next swipe
  //   themeWhenOn:        (optional) a theme the page switches to while it's on. With
  //                       several switches on, the last one in the section's list wins.
  //   requires:           (optional) another switch that must be on before this one
  //                       can be changed; turning that one off turns this one off too
  toggles: {
    adult: {
      label: 'Include 18+ questions',
      shortLabel: '18+',
      cardFlag: 'adult',
      storageKey: 'getting-to-know.include-adult',
      confirm: {
        message: 'Both of you confirm you are 18 or older.',
        confirmLabel: 'Confirm',
      },
      turnOffClearsVisit: true,
      // While 18+ is on, the page uses this deeper theme (css/styles.css).
      themeWhenOn: 'dating-adult',
      // How often 18+ cards come up while the switch is on: at level 2, one in
      // every 5 cards; at level 3, one in every 3. Levels not listed get none.
      // Cards are dealt in blocks of that size with exactly one 18+ card in a
      // random spot, so the rate is steady rather than streaky.
      oneInEveryByLevel: { 2: 5, 3: 3 },
    },
    party: {
      label: 'Party mode',
      shortLabel: 'Party',
      cardFlag: 'party',
      storageKey: 'getting-to-know.party-mode',
      confirm: {
        heading: 'Party mode',
        message: [
          'Everyone playing is of legal drinking age where you are.',
          'Any sip can be water or a soft drink.',
          'Pass anytime, no penalty.',
          'Look after each other.',
        ].join('\n'),
        confirmLabel: 'Confirm',
      },
      turnOffClearsVisit: false,
      // While Party mode is on, the page uses this bolder theme (css/styles.css).
      themeWhenOn: 'friends-party',
    },
    // Classic wording for Party cards: "drink" instead of "take a sip", without
    // "harmless" or "or passes" (the card's text_classic in data/questions.json).
    // The rules don't change, so its confirm screen repeats them.
    adultWording: {
      label: 'Include 18+ wording',
      shortLabel: '18+',
      cardFlag: null,
      storageKey: 'getting-to-know.adult-wording',
      confirm: {
        heading: '18+ wording',
        message: [
          'Everyone playing confirms they are 18 or older.',
          'Any drink can be water or a soft drink.',
          'Pass anytime, no penalty.',
          'Look after each other.',
        ].join('\n'),
        confirmLabel: 'Confirm',
      },
      turnOffClearsVisit: false,
      requires: 'party',
      themeWhenOn: 'friends-party-adult',
    },
  },

  // Card text longer than this many characters is set a little smaller
  // (css/styles.css .card__question--long), so it fits with the footnote.
  longCardTextCharacters: 110,

  // Words shown on cards.
  cardLabels: {
    dare: 'Dare',
    // Every dare is done by the whole table (decided for Phase 2).
    dareWho: 'Whole table',
    pass: 'Pass',
    // The small badges on Party mode cards and 18+ cards.
    party: 'Party',
    adult: '18+',
    // The footnote: the research finding, then its study and where the card came from.
    factIntro: 'Did you know?',
    study: 'Study',
    cardSource: 'Card idea',
  },

  // Save: the picture of the card (js/card-image.js) and how it's saved (js/save.js).
  cardImage: {
    // Portrait, in pixels. Sharp on any phone screen.
    width: 1080,
    height: 1350,
    // Image pixels per on-screen CSS pixel, for outlines, shadows and stickers,
    // so they look as bold in the picture as on the card.
    scale: 2,
    // The small credit at the bottom of the picture, in ink.
    credit: 'Getting to Know',
    // File name: getting-to-know-icebreaker-L2.png
    fileNamePrefix: 'getting-to-know',
    // The card text starts at this size and shrinks a step at a time until
    // everything fits on the card, so nothing is ever cut off.
    questionFontMaxPx: 64,
    questionFontMinPx: 32,
    questionFontStepPx: 2,
  },
  saveLabels: {
    saved: 'Card saved',
    pressAndHold: 'Press and hold the image to save it',
  },
  // How long "Card saved" stays on screen.
  toastMs: 2000,

  levelNames: {
    1: 'Light',
    2: 'Personal',
    3: 'Deep',
  },
  lowestLevel: 1,
  deepestLevel: 3,

  // Storage keys for saved progress (localStorage). The toggles' keys are
  // with each toggle above.
  storageKeys: {
    seenIds: 'getting-to-know.seen-ids',
    place: 'getting-to-know.place',
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
};
