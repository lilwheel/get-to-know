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
| `index.html` | The single page. Loads the stylesheet and `js/app.js` as a module, and holds the start screen and error message. |
| `css/styles.css` | All styling. Colours, spacing and sizes are CSS variables at the top. |
| `js/app.js` | Entry point. Loads `data/questions.json` and `data/sources.json` once, shows errors, and wires the other modules together. |
| `js/shuffler.js` | (Step 4) Keeps a shuffled pool per section and level and deals cards without repeats. |
| `js/swipe.js` | (Step 3) Drag, flick and keyboard handling for the card stack. |
| `js/theme.js` | Switches the page theme by setting `data-theme` on `<body>`. |
| `js/debug.js` | `debugLog()`: the only console output in the app, shown only with `?debug=1`. |
| `data/questions.json` | The question bank (currently empty). Format below. |
| `data/sources.json` | The 14 verified sources that questions link to. Format below. |
| `scripts/validate.py` | Offline checker for both data files. Run `python3 scripts/validate.py`. |
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

`index.html` loads `js/app.js`. `app.js` imports the other modules, fetches
both data files, and sets up the screen. `theme.js` changes the look,
`shuffler.js` picks the next question, and `swipe.js` turns gestures into
"next" and "back". Every module logs through `debug.js`.
