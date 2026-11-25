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
| `data/questions.json` | The question bank (currently empty). |
| `data/sources.json` | The verified sources that questions link to (currently empty). |
| `scripts/validate.py` | Offline checker for the data files. Run `python3 scripts/validate.py`. |
| `PROGRESS.md` | Build checklist: which steps are done, when, and in which commit. |
| `.nojekyll` | Tells GitHub Pages to serve files as-is, without Jekyll processing. |

## How the pieces fit together

`index.html` loads `js/app.js`. `app.js` imports the other modules, fetches
both data files, and sets up the screen. `theme.js` changes the look,
`shuffler.js` picks the next question, and `swipe.js` turns gestures into
"next" and "back". Every module logs through `debug.js`.
