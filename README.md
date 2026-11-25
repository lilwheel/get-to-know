# Getting to Know

Swipeable question cards for getting to know someone. A static web app
(plain HTML, CSS and JavaScript) with no backend, no accounts and no tracking,
hosted on GitHub Pages.

## Preview locally

From the project folder, run:

```
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. To test on a phone on the
same Wi-Fi, open `http://<your-laptop-ip>:8000` on the phone.

Add `?debug=1` to the address (for example http://localhost:8000/?debug=1)
to see debug logs in the browser console.

## File map

| File | What it does |
| --- | --- |
| `index.html` | The single page. Loads the stylesheet and `js/app.js` as a module. Holds two screens: the start screen (Icebreaker / Dating buttons, Reset) and the card screen (Home, sound toggle, 18+ switch for Dating, card stack, level controls, Back/Next), the confirmation dialog and the error message. |
| `css/styles.css` | All styling. Colours, sizes and animation timings are CSS variables at the top; reduced-motion settings shorten the timings. Card depth (0 = top) is styled with `data-depth`. |
| `js/config.js` | The one `CONFIG` object: data file paths, section and level names, which section allows 18+, storage keys, swipe distance and flick speed, vibration length, click sound. |
| `js/app.js` | Entry point. Loads the data once, switches between the two screens, deals cards from the shuffler into the stack, handles level changes and the 18+ switch, saves your place and connects every control. |
| `js/cards.js` | The card stack. Keeps at most 3 cards in the page, flies the top card off for "next" and slides the previous card back in for "back". Asks `app.js` which card belongs at each position, and can rebuild the cards behind the top one after a level change. |
| `js/swipe.js` | Dragging with touch or mouse. Moves the card on each animation frame; on release, reports a swipe (past 30% of the screen width or a fast flick) or snaps back. |
| `js/feedback.js` | A short vibration (where the phone supports it) and an optional soft click, off by default, when the card changes. |
| `js/shuffler.js` | One shuffled pool per section and level, with 18+ questions in separate pools that are only dealt in Dating when asked for. Deals without repeats, reshuffles a pool when it runs out (never showing the last card straight away), takes back cards that were lined up but not shown, and skips cards seen on earlier visits. |
| `js/storage.js` | Safe read/write/clear for localStorage and sessionStorage, so the app still works if storage is blocked. |
| `js/dialog.js` | One reusable in-page confirmation dialog (`askToConfirm`), used for the 18+ age check and for Reset. |
| `js/theme.js` | Switches the page theme by setting `data-theme` on `<body>`. |
| `js/debug.js` | `debugLog()`: the only console output in the app, shown only with `?debug=1`. |
| `data/questions.json` | The question bank (currently empty). Format below. |
| `data/sample.json` | 10 temporary sample questions the app shows until Step 7 fills the real bank. Deleted in Step 7. |
| `data/sources.json` | The 14 verified sources that questions link to. Format below. |
| `scripts/validate.py` | Offline checker for both data files. Run `python3 scripts/validate.py` (or pass another file, e.g. `data/sample.json`). |
| `PROGRESS.md` | Build checklist: which steps are done, when, and in which commit. |
| `.nojekyll` | Tells GitHub Pages to serve files as-is, without Jekyll processing. |

## Data format

### Sources (`data/sources.json`)

Every link in the app comes from this file. Each source is:

```json
{
  "id": "gottman-love-maps",
  "title": "The Sound Relationship House: Build Love Maps",
  "url": "https://www.gottman.com/blog/the-sound-relationship-house-build-love-maps/",
  "framework": "Gottman: Love Maps"
}
```

Only add a source after opening its URL and checking it matches the title.

### Questions (`data/questions.json`)

Every field is required. A complete example:

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
| `id` | `section-level-number`: `ice-1-0001` for icebreaker, `date-2-0042` for dating. Must match `section` and `level`. |
| `section` | `"icebreaker"` or `"dating"`. |
| `level` | `1` (light), `2` (personal) or `3` (deep). |
| `category` | Short topic label, e.g. "Quirky habits". |
| `adult` | `true` or `false`. Always `false` in icebreaker; `true` only in dating levels 2 and 3. |
| `text` | The question: open-ended (not yes/no), and both people answer it. |
| `why` | One sentence, under 20 words, naming the principle. |
| `framework` | Must equal the `framework` of the source it cites. |
| `source_id` | Must match an `id` in `data/sources.json`. |

### Checking the data

Run `python3 scripts/validate.py`. It prints counts per section and level
and flags missing or invalid fields, unknown source ids, wrong frameworks,
exact duplicates and near-duplicates (over 80% word overlap). It exits with
an error if it finds any problem.

## How the pieces fit together

`index.html` loads `js/app.js`. `app.js` reads its settings from `config.js`,
fetches the data once and gives the questions to `shuffler.js`, which indexes
them by section and level. When `cards.js` needs a card, `app.js` deals one
from the shuffler; `storage.js` saves what has been seen and where you are. `cards.js` draws
the stack and gives each card to `swipe.js`, which turns a drag into "next".
The Back/Next buttons and arrow keys call the same `cards.js` functions.
Each time a card settles, `app.js` triggers `feedback.js` (vibration and
optional click). `theme.js` changes the look, and every module logs only
through `debug.js`.

## Saved progress

Two things are kept in localStorage on your device (nothing is sent anywhere):

- `getting-to-know.seen-ids`: ids of cards already shown, so they aren't dealt again until their pool runs out.
- `getting-to-know.place`: the last screen, section, level and card, so a reload keeps your place.

"Reset seen cards" on the start screen clears both.

One thing is kept in sessionStorage, which the browser clears when the tab closes:

- `getting-to-know.include-adult`: whether the 18+ switch is on.

## 18+ questions

- Only Dating has the "Include 18+ questions" switch. It is off by default.
- Turning it on shows "Both of you confirm you are 18 or older." with Cancel and Confirm. Only Confirm turns it on; Cancel or Escape leaves it off.
- Questions with `"adult": true` are dealt only when the switch is on, and only in Dating. The shuffler enforces the Dating-only rule itself, and `validate.py` rejects 18+ questions outside Dating levels 2 and 3.
- Turning it off restarts the current visit, so no 18+ card stays on screen, lined up, or reachable with Back.
- A new tab always starts with the switch off. A saved 18+ card is not reopened unless the switch is on.

## Controls

- Swipe the card left or right (touch or mouse), or flick it: next card.
- A short drag snaps back.
- Next button or Right arrow: next card. Back button or Left arrow: previous card.
- Go Deeper / Go Shallower: change level (1 Light, 2 Personal, 3 Deep). The card showing stays; the next card comes from the new level. The dots show the level.
- Home: back to the start screen. Choosing the same section again picks up where you left off.
- The source link in the footnote opens in a new tab.
