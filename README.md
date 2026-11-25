# Question Cards

**Ask each other anything. If it's awkward, blame the cards.**

Swipeable question cards for two people getting to know each other. There are two sections, each with three levels:

- **Icebreaker:** first dates and people who have just met.
- **Dating:** couples a few months in. Includes optional 18+ questions.

The app is a static site: plain HTML, CSS and JavaScript. It has no backend, no build step, no accounts and no tracking.

- Live app: <https://lilwheel.github.io/get-to-know/>
- Repository: <https://github.com/lilwheel/get-to-know>. The repo keeps its original name, "get-to-know", so the web address stays the same.

---

## Contents

1. [Run it on your computer](#1-run-it-on-your-computer)
2. [How the app works](#2-how-the-app-works)
3. [File map](#3-file-map)
4. [Debugging guide](#4-debugging-guide)
5. [The question bank](#5-the-question-bank)
6. [Themes and colours](#6-themes-and-colours)
7. [Saved data](#7-saved-data)
8. [Settings you can change](#8-settings-you-can-change)
9. [Common changes, step by step](#9-common-changes-step-by-step)
10. [Deploying](#10-deploying)
11. [Code conventions](#11-code-conventions)

---

## 1. Run it on your computer

The app loads its questions with `fetch()`, which browsers block for pages opened straight from disk (`file://`). Always run it through a small local web server.

From the project folder:

```
python3 -m http.server 8000
```

- Open <http://localhost:8000> on this computer.
- To test on a phone on the same Wi-Fi, open `http://<this computer's IP address>:8000` on the phone. Windows may ask you to allow Python through the firewall the first time.
- Add `?debug=1` to the address to see debug logs in the browser console, for example <http://localhost:8000/?debug=1>. See [Debugging guide](#4-debugging-guide).

Nothing needs installing apart from Python 3, which is used only for the local server and the two checking scripts.

---

## 2. How the app works

### The two screens

| Screen | What's on it |
| --- | --- |
| Start screen | Title, the Icebreaker and Dating buttons, and "Reset seen cards". |
| Card screen | Home and Sound buttons, the 18+ switch (Dating only), the card stack, Go Shallower / Go Deeper with three level dots, and Back / Next. |

Only one screen shows at a time. A third element, the error message, replaces both if the data can't load.

### What happens at startup (`js/app.js`, `startApp`)

1. Apply the neutral theme (the start screen's colours).
2. Fetch `data/questions.json` and `data/sources.json` together. This happens once per visit.
3. If either fails, show a plain error message and stop.
4. Build the shuffler (`js/shuffler.js`). It sorts every question into a pool by section, level and adult/not adult, leaving out cards you've already seen.
5. Connect every button and the arrow keys.
6. Restore your place. If you were on the card screen last time, reopen the same section, level and card. Otherwise show the start screen.

### How a card gets on screen

```
You press Next / swipe / press →
        │
        ▼
cards.js  showNext()      flies the top card off, moves the others up one place
        │
        ▼
cards.js  addCardAtBack() asks app.js for the card at the new back position
        │
        ▼
app.js    getCardAt()     if that position hasn't been dealt yet, asks the shuffler
        │
        ▼
shuffler.js dealNext()    takes the next card from the pool for this section + level
        │                 (plus the 18+ pool, but only in Dating with the switch on)
        ▼
cards.js  finishMove()    unlocks input and tells app.js which card is now on top
        │
        ▼
app.js    handleCardShown()  marks it seen, saves progress, reads it to screen
                             readers, vibrates / clicks, writes the debug log
```

- **History:** `app.js` keeps every card dealt this visit in `session.history`, so Back can return to earlier cards.
- **Cards in the page:** the page never holds more than three cards: the top card and two behind it.

### Levels

- Go Deeper and Go Shallower change `session.level`, between 1 and 3.
- The card on screen stays. The two cards behind it are swapped for cards from the new level (`refreshUpcoming`), so the change applies from the next card.
- If a card is mid-animation, the swap waits until the animation finishes.

### The 18+ switch

- It only appears in Dating. Turning it on opens the dialog "Both of you confirm you are 18 or older." Only Confirm turns it on.
- 18+ questions sit in their own pools. The shuffler only adds those pools when the switch is on **and** the section is Dating (`CONFIG.adultSection`). Icebreaker can never get them, even through a bug in `app.js`.
- Turning the switch off reopens the section, so no 18+ card stays on screen, waits behind the top card, or can be reached with Back.
- The choice is kept in sessionStorage, so it resets when the tab is closed.

### No repeats

- Each pool is shuffled once (Fisher–Yates) and dealt from the end, so no card repeats until its pool is used up.
- When a pool runs out, it is reshuffled. The card you just saw is put at the bottom, so it can't come straight back.
- Cards seen on earlier visits (saved in localStorage) start outside their pools.

---

## 3. File map

| File | What it does | Main functions |
| --- | --- | --- |
| `index.html` | The single page: three theme background layers, the start screen, the card screen, the confirm dialog, the screen-reader announcer and the error message. Loads `css/styles.css` and `js/app.js`. | — |
| `css/styles.css` | All styling. It starts with design tokens (palette, colour roles, sizes, timings), then the Icebreaker and Dating theme overrides, then the components in page order. | — |
| `js/config.js` | The one `CONFIG` object: every tunable number and name in the JavaScript. See [Settings](#8-settings-you-can-change). | — |
| `js/app.js` | Entry point and coordinator. Loads data, switches screens, deals cards into the stack, handles levels, the 18+ switch, Reset, sound and keyboard, and saves your place. | `startApp`, `openSection`, `getCardAt`, `handleCardShown`, `changeLevel`, `handleAdultToggleChange` |
| `js/cards.js` | The card stack on screen. Builds card elements, keeps at most 3 in the page, flies the top card off for Next, slides one back in for Back, and rebuilds the upcoming cards after a level change. | `createCardStack`, `showNext`, `showPrevious`, `refreshUpcoming` |
| `js/swipe.js` | Dragging a card with touch or mouse (pointer events). Follows the pointer on each animation frame. On release it decides swipe or snap back: past 30% of the screen width, or a fast flick in the same direction. | `attachSwipe`, `getSwipeDirection` |
| `js/shuffler.js` | The pools of questions and the dealing rules: no repeats, reshuffle when empty, 18+ only in Dating, returning cards that were lined up but never shown. | `createShuffler`, `dealNext`, `putBack`, `markShown`, `takeOut` |
| `js/theme.js` | Sets `data-theme` on `<body>`, colours the phone's browser bar, and fades between screens. | `applyTheme`, `changeScreenWithFade` |
| `js/dialog.js` | The reusable "are you sure?" dialog, used for the 18+ check and Reset. | `askToConfirm`, `isDialogOpen` |
| `js/feedback.js` | A short vibration (where supported) and an optional soft click when the card changes. | `playCardChangeFeedback`, `setSoundEnabled` |
| `js/storage.js` | Safe read, write and clear for localStorage and sessionStorage. If storage is blocked, the app carries on without saving. | `loadSaved`, `save`, `clearSaved` |
| `js/timing.js` | Reads animation durations from CSS variables and waits for them. | `readCssDurationMs`, `wait` |
| `js/debug.js` | `debugLog()`, the **only** place that writes to the console, and only with `?debug=1`. | `debugLog` |
| `data/questions.json` | The 2,000 questions. See [The question bank](#5-the-question-bank). | — |
| `data/sources.json` | The 12 verified sources that card footnotes link to. | — |
| `scripts/validate.py` | Offline checker for both data files. Run it after any data change. | — |
| `scripts/check_contrast.py` | Offline WCAG AA contrast check of every colour pair in all three themes, read from `css/styles.css`. Run it after any colour change. | — |
| `PROGRESS.md` | Build history: each step of the build plan, its date and commit. | — |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. | — |
| `.gitignore` | Keeps local-only files out of git: the private question review page (`REVIEW-PAGE.html`) and Python's `__pycache__`. | — |

### Who uses whom

```
index.html ──loads──► app.js
                        ├── config.js     (settings, read by most modules)
                        ├── shuffler.js   (which question comes next)
                        ├── cards.js ──► swipe.js   (what's on screen, and dragging)
                        ├── theme.js ──► timing.js  (colours and the fade)
                        ├── dialog.js     (confirmations)
                        ├── feedback.js   (vibration and click)
                        ├── storage.js    (saving)
                        └── debug.js      (logging; used by every module)
```

`cards.js` never talks to the shuffler. It asks `app.js` for "the card at position N", and `app.js` decides what that is. This keeps "what to show" (`app.js` and `shuffler.js`) separate from "how to show it" (`cards.js` and `swipe.js`).

---

## 4. Debugging guide

### Turn on debug logs

Add `?debug=1` to the address, open the browser's developer tools (F12, or Cmd+Option+I on a Mac), and go to the **Console** tab. Without `?debug=1` the app prints nothing.

| Log message | When | What the details mean |
| --- | --- | --- |
| `Restoring place` | Startup | The saved place: `screen`, `section`, `level`, `currentCardId`. `null` means nothing was saved. |
| `Theme applied` | Every screen change | `theme`: `neutral`, `icebreaker` or `dating`. |
| `Card shown` | Every time a card settles on top | `section`, `level`, `cardId`, and `cardsLeftInPool`: cards left to deal at this level before a reshuffle. |
| `Card stack moved` | After Next or Back finishes | `position` in this visit's history, and `cardsInPage`, which should never be more than 3. |
| `Level changed` | Go Deeper / Go Shallower | The new `level`. |
| `Pool reshuffled` | A pool ran out | `pool` (for example `dating-2-general` or `dating-2-adult`) and how many `cards` it now holds. |
| `18+ questions` | The switch changed | `included`: true or false. |
| `Sound setting changed` | Sound button | `soundOn`. |
| `Progress reset` | After Reset is confirmed | — |
| `Could not read / save / clear saved progress` | Storage is blocked or full | The storage `key`. The app keeps working, but won't remember your place. |

### Inspect or clear saved data

In developer tools, go to **Application** (Chrome) or **Storage** (Firefox), then **Local Storage** and **Session Storage**, and pick the site. The keys are listed in [Saved data](#7-saved-data). Delete them to start fresh, or press "Reset seen cards" on the start screen.

### Common problems

| What you see | Likely cause | What to check or do |
| --- | --- | --- |
| "Couldn't load data/questions.json. Check your connection, or open the app through a web server." | The page was opened as a file, or you're offline | Run `python3 -m http.server 8000` and use <http://localhost:8000>. |
| "Couldn't load data/questions.json. Check that the file exists." | The file is missing or misnamed (the server returned 404) | Check the file is at `data/questions.json`, with lower-case letters. |
| "Couldn't read data/questions.json. Check that it is valid JSON." | A typo in the data file, such as a missing comma or quote | Run `python3 scripts/validate.py`. It names the line. |
| "Couldn't read the questions. Check … are lists." | The file is valid JSON but not a `[ … ]` list | The file must start with `[` and end with `]`. |
| A blank page with no message | A JavaScript error stopped startup | Open the Console (no `?debug=1` needed for errors) and read the red error with its file and line. |
| "No questions here yet. Try another level." on a card | That section and level has no questions | Run `validate.py` and check the counts table. |
| Old text or old behaviour after a change | The browser cached the old files | Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on a Mac). GitHub Pages can take 1–2 minutes to update after a push. |
| 18+ questions never appear | The switch is off, you're in Icebreaker, or the level is 1 | 18+ questions exist only in Dating levels 2 and 3. With `?debug=1`, `Card shown` should list `date-2-…` / `date-3-…` ids that have `"adult": true`. |
| The same card came back | Its pool ran out and was reshuffled | Look for `Pool reshuffled` in the log. That's expected after every card in that level has been seen. |
| A swipe doesn't register, or flies too easily | The swipe thresholds | Adjust `swipeDistanceRatio` and `flickVelocityPxPerMs` in `js/config.js`. |
| Animations feel instant | The device has "reduce motion" switched on | Expected: `css/styles.css` shortens every animation to 1 ms under `prefers-reduced-motion`. |
| No vibration | Not supported (iPhones don't support web vibration), or no tap yet | Expected. Browsers only allow vibration after the first tap on the page. |
| Colours look wrong in one section | A theme override is missing a colour role | Compare that theme's block in `css/styles.css` with the `:root` roles, then run `check_contrast.py`. |

### Where to look in the code

| Problem area | Start here |
| --- | --- |
| Which card comes next, repeats, 18+ filtering | `js/shuffler.js`: `dealNext`, `poolKeysFor`, `reshufflePool` |
| What Back shows, or where a reload resumes | `js/app.js`: `getCardAt`, `forgetCardsAfter`, `openSection`, `findResumableQuestion` |
| Card animations, cards stacking up, Back/Next timing | `js/cards.js`: `showNext`, `showPrevious`, `waitForTransition` |
| Drag and flick behaviour | `js/swipe.js`: `handlePointerUp`, `getSwipeDirection` |
| Level buttons and dots | `js/app.js`: `changeLevel`, `updateLevelDisplay` |
| Saving and restoring | `js/app.js`: `savePlace`, `loadPlace`, `restorePlace`; `js/storage.js` |

---

## 5. The question bank

### Counts

| Section | Level 1 (Light) | Level 2 (Personal) | Level 3 (Deep) |
| --- | --- | --- | --- |
| Icebreaker | 350 | 300 | 300 |
| Dating | 350 | 350 (50 are 18+) | 350 (50 are 18+) |

That's 2,000 in total. With 18+ switched off, every pool still has at least 300 cards.

| Level | Icebreaker | Dating |
| --- | --- | --- |
| 1 | Quirky habits, would-you-rather, favourites with a twist, hypotheticals | Gottman Love Maps: daily life, current worries, dreams, people, backstory |
| 2 | Stories, passions, how you spend your time, small life lessons | Fondness and admiration, turning towards, gentle feedback, conflict and repair, stress; 18+ on desires, needs, boundaries and communication |
| 3 | Values, hopes, formative moments, still fine for an early date | Shared meaning, future plans, values; 18+ on long-term intimacy |

All questions are original. The sources inspired their style and principles; nothing is copied.

### Question format (`data/questions.json`)

A list of objects. Every field is required:

```json
{
  "id": "date-1-0001",
  "section": "dating",
  "level": 1,
  "category": "Daily life",
  "adult": false,
  "text": "What's been taking up the most space in your head this week, and why?",
  "why": "Builds Love Maps by learning their current worries.",
  "framework": "Gottman: Love Maps",
  "source_id": "gottman-love-maps"
}
```

| Field | Rule |
| --- | --- |
| `id` | `ice-<level>-<4 digits>` for Icebreaker, `date-<level>-<4 digits>` for Dating. Must agree with `section` and `level`, and be unique. |
| `section` | `"icebreaker"` or `"dating"`. |
| `level` | `1`, `2` or `3`, as a number, not a string. |
| `category` | A short topic label, such as "Quirky habits". |
| `adult` | `true` or `false`. Always `false` in Icebreaker. `true` only in Dating levels 2 and 3. |
| `text` | The question. Open-ended (not yes/no), and both people answer it. |
| `why` | The card footnote: one sentence, under 20 words, naming the principle. |
| `framework` | Must equal the `framework` of the source it cites. |
| `source_id` | Must match an `id` in `data/sources.json`. |

### Source format (`data/sources.json`)

```json
{
  "id": "gottman-love-maps",
  "title": "The Sound Relationship House: Build Love Maps",
  "url": "https://www.gottman.com/blog/the-sound-relationship-house-build-love-maps/",
  "framework": "Gottman: Love Maps"
}
```

Every link in the app comes from this file. Only add a source after opening its URL and checking that it loads and matches its title. Never guess a URL.

### Checking the data

```
python3 scripts/validate.py
```

It prints the counts table, then flags:
- missing or wrong-type fields, and badly formed ids
- 18+ questions outside Dating levels 2 and 3
- "why" lines of 20 words or more
- unknown `source_id`s, and a `framework` that doesn't match its source
- questions that open like a yes/no question ("Do you…", "Have you…")
- duplicate ids or URLs
- exact duplicate questions (ignoring case and punctuation)
- near-duplicates (over 80% word overlap)

It exits with an error if anything is wrong, so you can use it before every commit. To check a draft file instead, pass its path: `python3 scripts/validate.py path/to/draft.json`.

---

## 6. Themes and colours

| Theme | Where | Look |
| --- | --- | --- |
| Neutral | Start screen | Warm paper background. Each section button previews its own theme. |
| Icebreaker | Icebreaker cards | Mint and surf-green gradient, near-white mint cards, dark teal text, rounded letters where available. |
| Dating | Dating cards | Maroon gradient, burgundy cards, warm cream text, serif questions. |

Colours in `css/styles.css` come in two layers:

1. **Palette** (`--palette-*`): the raw colours, named by what they look like.
2. **Roles** (`--color-*`): what each colour is for, such as card background or link. `:root` sets the neutral roles, and `[data-theme="icebreaker"]` and `[data-theme="dating"]` override them.

Components use only roles, never palette colours, so a theme is just a list of role overrides.

Switching section fades the content out, swaps the theme while nothing is visible, then fades it back in. Meanwhile one background layer per theme cross-fades. Only opacity animates, never colour, which keeps it smooth on phones.

**After changing any colour**, run:

```
python3 scripts/check_contrast.py
```

It checks every text and control pair against WCAG AA: 4.5:1 for text, 3:1 for borders, dots, the switch and the focus ring.

---

## 7. Saved data

Everything stays in the browser on the device. Nothing is sent anywhere.

| Key | Where | What it holds | Cleared by |
| --- | --- | --- | --- |
| `getting-to-know.seen-ids` | localStorage | A list of card ids already shown | "Reset seen cards" |
| `getting-to-know.place` | localStorage | `{screen, section, level, currentCardId}`: where you were | "Reset seen cards" |
| `getting-to-know.include-adult` | sessionStorage | `true` if the 18+ switch is on | Closing the tab |

The keys keep the original "getting-to-know" prefix. Renaming them would make returning visitors lose their place.

If saved data is unreadable (edited by hand, or from an old version), `loadPlace` ignores it and the app starts fresh.

---

## 8. Settings you can change

**`js/config.js`** holds every number and name the JavaScript uses:

| Setting | Default | Meaning |
| --- | --- | --- |
| `questionsUrl`, `sourcesUrl` | `data/…json` | Where the data files are. |
| `sectionNames`, `levelNames` | Icebreaker/Dating, Light/Personal/Deep | Names shown on screen. |
| `lowestLevel`, `deepestLevel` | 1, 3 | Level limits. |
| `adultSection` | `dating` | The only section that can ever show 18+ questions. |
| `storageKeys` | see [Saved data](#7-saved-data) | Names of the saved values. |
| `maxCardsInPage` | 3 | Cards in the page at once. The CSS styles one `data-depth` per card, so change both together. |
| `swipeDistanceRatio` | 0.3 | A drag past this share of the screen width counts as a swipe. |
| `flickVelocityPxPerMs` | 0.5 | A release faster than this counts as a flick, even if it's short. |
| `velocitySampleWindowMs` | 100 | How far back to look when measuring release speed. |
| `dragRotationDegreesPerPixel` | 0.05 | How much a card tilts while dragged. |
| `transitionSafetyMarginMs` | 50 | Extra wait in case the browser never reports an animation's end. |
| `vibrationMs` | 12 | Length of the vibration. |
| `clickSound` | 1800 Hz, 40 ms, volume 0.15 | The soft click. |

**`css/styles.css`** (the top `:root` block) holds every colour, size and timing, including animation durations such as `--duration-fly` and `--duration-settle`. Durations live in CSS so the reduced-motion rule can shorten them all in one place, and `js/timing.js` reads them from there.

---

## 9. Common changes, step by step

**Add or edit questions**
1. Edit `data/questions.json`. For a new question, use the next free number in its section and level, for example `ice-2-0301`.
2. Run `python3 scripts/validate.py` and fix anything it lists.
3. Refresh the app (hard refresh if needed). Use "Reset seen cards" if you want to see new cards sooner.

**Add a source**
1. Open the URL and check that it loads and matches its title.
2. Add it to `data/sources.json` with a unique `id` and the right `framework`.
3. Point questions to it with `source_id`, using the same `framework`. Run `validate.py`.

**Change a colour**
1. Change the palette value or role in `css/styles.css`.
2. Run `python3 scripts/check_contrast.py`. Every line must say PASS.

**Change the title or subtitle**
Edit the `<h1>` and the `start-screen__subtitle` paragraph in `index.html`. Also change `<title>` (the browser tab).

---

## 10. Deploying

The site is served by GitHub Pages from the `main` branch, root folder.

1. Run `python3 scripts/validate.py` and `python3 scripts/check_contrast.py`.
2. Commit and push to `main`.
3. Wait 1–2 minutes, then hard refresh <https://lilwheel.github.io/get-to-know/>.

If the site doesn't update, open the repo's **Actions** tab on GitHub and check the "pages build and deployment" run for errors.

---

## 11. Code conventions

- **Plain tools:** HTML, CSS and vanilla JavaScript ES modules. No frameworks, npm packages or build step. Python is used only for offline helper scripts in `scripts/`.
- **Readable first:**
  - Descriptive names, a labelled section header in every file, and a one-line comment above every function saying what it does and why.
  - Functions stay short (about 30 lines or fewer) and do one thing.
- **Indentation:** 2 spaces in HTML, CSS and JavaScript. The Python scripts use 4 spaces, the Python standard (PEP 8).
- **No magic numbers:** every colour, size and timing is a CSS variable or a `CONFIG` value.
- **No console output** except through `debugLog()`.
- **Performance:**
  - Data loads once and is indexed by pool, so a swipe never scans the whole bank.
  - At most 3 cards are in the page.
  - Only `transform` and `opacity` animate.
  - Dragging uses `requestAnimationFrame` and passive listeners.
  - `prefers-reduced-motion` is respected.
- **Accessibility:**
  - Real buttons and a real checkbox for the switch, and visible focus rings.
  - Cards behind the top one are `inert`.
  - Each new question is announced to screen readers through `#card-announcer`.
- **History:** `PROGRESS.md` records each build step with its commit.
