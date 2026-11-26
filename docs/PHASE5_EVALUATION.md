# Phase 5 evaluation (Step P5-0)

Written 2026-11-26 against commit `8ccb0e5` (release `2026-11-26.4`). No code was changed in this step. Later steps refer to this file instead of re-reading the whole project.

## Decisions (2026-11-26, from the P5-0 answers)

These replace the matching recommendations further down.

1. **Classic wording:**
   - Changes the drinking and drops "harmless". "Take a sip" becomes "drink".
   - "harmless", "the harmless kind", "harmlessly" and "harmless only" are removed. Each sentence still has to read well and stay legal and low-risk.
   - In-card "…or passes" is removed too; the Pass button stays on every card.
   - Affected cards: 54 sip cards and 19 "harmless" cards (69 in all).
2. **Wording approach is now a second field, `text_classic` (approach A), on those 69 cards.** Removing "harmless" means rewording sentences, not swapping one word, so placeholders would get clumsy. This adds about 8 KB.
3. **Rules screen in Classic:** "Any drink can be water or a soft drink." Passing and looking after each other stay.
4. **The Classic switch:**
   - It is an 18+ toggle framed like Dating's: label "Include 18+ wording" and a confirm screen ("Everyone playing confirms they are 18 or older").
   - It sits next to Party mode. It can only be changed while Party mode is on; otherwise it shows as unavailable (dashed, like disabled buttons).
   - Turning Party mode off turns it off too. It is stored in sessionStorage like the other toggles.
5. **Every toggle changes the background colour.** Checked on the live site:
   - Party mode works: butter `#FBE4A0` changes to apricot `#F2A262` and back.
   - **Dating 18+ doesn't change anything** (`#F8C4B4` before and after).
   - New themes are needed: `dating-adult` (Dating with 18+ on) and `friends-party-adult` (Party mode with 18+ wording on), both checked by `check_contrast.py`.
   - Built in P5-4, the toggles step.
6. **Image footnote:** the "Did you know?" fact and the study name as plain text ("Aron et al., 1997"), no links.
7. **Save button:** an icon-only floppy disk in the same ink-outline art as the flower (drawn once in `index.html`, ink stroke, solid fill, hard shadow on the button), labelled "Save card" for screen readers.
8. **Order of work:** as proposed in section 6 (P5-5 and P5-6 merged).

## Working summary (file map)

| File | What Phase 5 touches |
| --- | --- |
| `index.html` | Card screen markup: header (Home, title, Sound), `#toggle-setting` switch row, `.card-area`, `.level-controls`, `.card-controls` (Back/Next). Import map lists every JS file. |
| `js/app.js` (572 lines) | `elements` map, `session` state, `startApp`, `openSection`, `handleToggleChange`, `changeLevel`, button wiring at about lines 475–489, `toggleSound` at 509–515. |
| `js/cards.js` (355) | `createCardElement` (badges at 71–78), `createBodyElement` (question text), `createFootnoteElement`, Pass button at about line 133. All card text passes through here, so this is where a wording placeholder would be filled in. |
| `js/config.js` (164) | `CONFIG.toggles.party.confirm.message` (rules screen), `buttonLabels` (Sound only), `cardLabels`, `vibrationMs`, `clickSound`. |
| `js/feedback.js` (64) | Vibration and the click sound. |
| `js/storage.js` | sessionStorage/localStorage helpers (toggles use sessionStorage). |
| `css/styles.css` (1001) | Layout: `.app-header` 463, `.level-controls` 486, `.card-area` 530, `.card` 548, badges/starbursts 687–745, `@container card` 795, `.card-controls` 828, `.toggle-button` 874, `.setting-row`/`.switch` 884+. Tokens: `--card-width: min(100%, 30rem)`, `--card-height: min(100%, 38rem)`, `--tap-target-small: 40px`, `--tap-target-large: 48px`, `--starburst-shape` (a `clip-path` polygon). |
| `scripts/validate.py` | `PARTY_BANNED_WORDS` (line 66) and the Party wording check (about line 264). |
| `scripts/check_style.py` | Solid colours, no gradients or blurred shadows. |

## 1. Sound: everything to remove

There are no audio files: the click is made on the fly with Web Audio, and nothing about sound is saved in storage.

- `index.html:64`: `<button id="sound-toggle">Sound off</button>` in the header.
- `js/app.js:13`: imports `setSoundEnabled`. Line 28: `soundToggle` element. Line 72: `isSoundOn` in `session`. Line 489: click listener. Lines 509–515: `toggleSound()`.
- `js/feedback.js`: `isSoundEnabled`, `audioContext`, `setSoundEnabled()`, `playSoftClick()`, the sound branch of `playCardChangeFeedback()`, and the header comments. The vibration stays, so `feedback.js` keeps `playCardChangeFeedback` and `vibrateBriefly` only.
- `js/config.js:99–103`: `buttonLabels` (Sound on/off). It is only used for Sound, so the whole object goes. Lines 157–163: `clickSound`.
- `css/styles.css:826`: a comment that lists "Sound". There is no sound-only CSS rule. `.app-header .toggle-button` is still used by Home.
- `README.md` lines 59, 149, 155, 179, 205 (debug log row "Sound setting changed"), 494 (`buttonLabels`) and 509 (`clickSound`).
- Storage: nothing was ever saved. As a safeguard, P5-1 can still remove any old `getting-to-know.sound*` key on load, but there is none to clear.
- "click" also appears for button click listeners, which stay, and "Sound Relationship House", a Gottman source title, which stays.

## 2. Drink wording

**Today:**
- 600 Party cards. Only **54** mention drinking (5 more say "cheers", meaning applaud).
- Phrases: "takes a sip" ×35, "take a sip" ×14, plus "takes one sip, and the round ends" (5 cards) and "takes a sip or passes" (6).
- The other 546 Party cards contain no drinking at all, so Classic would not change them.

**Original Classic phrasing:** it doesn't exist.
- `git log -S drink` shows Party cards were written as "take a sip" from the first draft (6d–6f), and the old `sample-friends.json` used "take a sip" too.
- Classic has to be written fresh. It is mostly a mechanical swap: "take a sip" becomes "drink" and "takes a sip" becomes "drinks".

| | A. Second field `text_classic` | B. Placeholders, e.g. `{sip}` / `{sips}` |
| --- | --- | --- |
| Data change | Add a full second sentence to 54 cards | Replace the phrase in 54 cards with a placeholder. The wording table lives in `CONFIG` (Gentle: "take a sip"/"takes a sip"; Classic: "drink"/"drinks") |
| Validator | Field only on Party cards; banned words checked on both texts; Classic must differ from Gentle | Only known placeholders, only on Party cards; banned-word check run on both renderings |
| File size | About +7 KB (1.26 MB file) | About +0.1 KB |
| Freedom | Any rewording per card | Word swaps only |
| Safety floor | Has to be checked card by card | Built in: Classic can only say what the two table entries say |
| Effort | Write and check 54 sentences | One script; one small `fillWording()` used by the card, the screen-reader announcer and the image |

**Recommendation: B, placeholders.**
- It's smaller, keeps the wording in one place, and the safety floor can't be broken by a single card.
- One tiny Gentle change: "takes one sip" becomes "takes a sip", so two placeholders cover every card.

## 3. Card image

| | A. Canvas API (built in) | B. Library: `html-to-image` (about 13 KB gzipped) or `html2canvas` (about 45 KB gzipped) |
| --- | --- | --- |
| Match | Redrawn at 1080 × 1350 from the same theme tokens (read from CSS), the same flower path and the same starburst polygon. Same look, laid out for portrait. | A copy of the on-screen card at its on-screen size (480 × 449 on a 1280 × 720 screen), which isn't 4:5, so it would still need padding or scaling to reach 1080 × 1350. |
| Ink outlines and starbursts | Drawn exactly: polygon path, ink stroke, hard offset shadow. | `html2canvas` doesn't support `clip-path`, so the PARTY/DARE starbursts would come out as squares. `html-to-image` renders through SVG, which handles them in Chrome, but Safari's SVG rendering is known to drop web fonts on the first try. |
| Fonts | `await document.fonts.load()` for Mochiy Pop One and Zen Maru Gothic before drawing; they're our own files, already loaded on the page. | `html-to-image` fetches and embeds the fonts itself; unreliable on iPhone Safari. |
| Sharpness | Drawn at full 1080 × 1350 pixels, so it's sharp on any screen. | Needs `pixelRatio` set; large captures are slow on phones. |
| Page weight | 0 KB extra, about 200–250 lines in a new `js/card-image.js`. | +13–45 KB and a new dependency. |
| Effort | Medium: line wrapping and font fitting (shrink until the text fits), stickers, footnote, dots, credit. | Low to start, then workarounds for Safari and the starbursts. |

**Recommendation: A, Canvas API.**
- No dependency, exact size, sharp, and reliable on iPhone, the riskiest device.
- The longest card (153 characters) plus the longest fact must fit. The text shrinks step by step until it fits, so nothing is cut off.

## 4. Saving on each device

- **iPhone Safari:**
  - A normal download (`<a download>`) shows a "Download?" prompt and saves to the **Files** app, not Photos. Getting it into Photos takes about five more taps.
  - The **share sheet** (`navigator.share({ files })`, supported since iOS 15) offers **Save Image**, which goes straight to Photos: Share, then Save Image.
- **Android Chrome:**
  - A normal download saves to Downloads in one tap, with no prompt, and Google Photos and gallery apps show it in their "Download" album.
  - The share sheet works too, but often has no plain "save" option, only apps such as Messages or Drive.
- **Desktop** (Chrome, Edge, Firefox, Safari):
  - A normal download saves a PNG to the Downloads folder.
  - Chrome on Windows and macOS also supports file sharing, but on a desktop a plain download is what people expect.

**Recommendation:**
- iPhone and iPad use the share sheet; every other device downloads.
- Spotting an iPhone or iPad needs a small, explained browser check (iPads report themselves as Macs).
- If neither works, show the fallback: the image full-screen with "Press and hold the image to save it".

Notes:
- The share sheet has to open soon after the tap. Drawing takes well under a second once the fonts are loaded (they already are on the card screen), so this is fine.
- If Safari still refuses the share, the fallback image appears.
- With the share sheet, the app can't tell whether "Save Image" or something else was chosen. The confirmation should therefore show only for a download ("Card saved"), and nothing after the share sheet closes.

## 5. Layout

Measured on the live site in Friends & Teammates:

| Screen | Header | Switch row | Card | Level row | Back/Next | Card height |
| --- | --- | --- | --- | --- | --- | --- |
| 1280 × 720 | 16–56 | 72–112 | 128–577 | 593–641 | 657–705 | 449 px (62%) |
| 1024 × 600 | 16–56 | 72–112 | 128–456 | 472–520 | 536–584 | **328 px (55%)**: the longest dare overflows by 5 px |
| 375 × 812 | 16–63 | 79–119 | 135–669 | 685–733 | 749–797 | 534 px |

**Below the card today:**
- The level row: Go Shallower, the three flowers with the level name, and Go Deeper.
- Back and Next.
- (Pass is inside the card. Home, the title and Sound are in the header; the 18+/Party switch has its own row under the header.)

**What gets squeezed:**
- On short screens, four rows of controls (header, switch, level, Back/Next) use 240 px of height, so the card shrinks into compact mode.
- At 1024 × 600 the longest card no longer fits.
- Nothing overlaps; the card just gets too short.
- The small buttons (Home, Sound, switch) are 40 px tall, below the 44 px rule.

**After the fix:**
- **Header:** Home on the left, section name in the middle. Sound is gone.
- **One row just above the card, as wide as the card:**
  - Left: the section's switches (18+ in Dating; Party mode, and Drink wording once Party mode is on, in Friends).
  - Right: the level group: a Shallower button, the three flowers, a Deeper button.
- **The card**, which gains about 75 px of height (two rows become one).
- **Bottom:** Back, Share and Next only.
- **At 375 px:** the level group is 306 px and the Party switch 123 px, which together is wider than the 343 px available. So on narrow screens:
  - The level buttons become "−" / "+" chips beside the flowers, with screen-reader labels "Go shallower" / "Go deeper".
  - The switches become short chips ("18+", "Party", "Classic").
- All buttons become at least 44 px tall.

## 6. Proposed order of work

Keep the written order, with one merge:

1. **P5-1 Remove sound.** First, because it clears the header and the code the layout step would otherwise move.
2. **P5-2 Layout.**
   - Built so later steps drop straight in: the top-left group is filled from `CONFIG`, so Drink wording is one more entry.
   - The bottom row is laid out for three buttons now, so Share doesn't reopen the layout.
   - The text-fitting fix for short screens is done here once.
3. **P5-3 Drink wording data**, then **P5-4 Drink wording setting**.
   - Kept as two checkpoints, but P5-3 also adds the small `fillWording()` function (Gentle only), so the cards look the same and P5-4 only adds the switch.
4. **P5-5 + P5-6 merged: Share, image and saving.**
   - The button can't be tested without a saving method, and the saving method shapes the button (share sheet on iPhone, download elsewhere).
   - One checkpoint, with sample images and device notes.
5. **P5-7 Final check and deploy.**

**Effort saved:**
- No second layout pass for Share or Drink wording.
- One wording function used by the card, the announcer and the image.
- One combined test sweep for Share instead of two.
- The version tag is bumped only on steps that change code.

## 7. Risks and questions

**Questions:**
1. **Classic scope:** just the swap on the 54 cards ("drink" / "drinks")? Or should Classic also drop the in-card "…or passes"? I recommend swap only; the Pass button stays either way.
2. **Rules screen in Classic:** "Any sip can be water or a soft drink" becomes "Any drink can be water or a soft drink". Passing and looking after each other stay in both. OK?
3. **Turning Classic on:** a plain switch, or a confirm screen like Party mode? I recommend a plain switch, shown only while Party mode is on. It goes back to Gentle when Party mode is turned off or the tab closes.
4. **Image footnote:** the plan asks for the "why it works" line, which is now the "Did you know?" fact. Include the study name as plain text (for example "Aron et al., 1997"), with no link? I recommend yes.
5. **Button name:** "Share" with a download icon, as planned? Or "Save", since it saves rather than posts? I recommend "Save".

**Risks:**
- iPhone share sheet timing (see section 4); the fallback covers it.
- The image is drawn separately from the HTML card, so a future card style change has to be made in both places. The theme tokens are read from CSS to limit this.
- Spotting an iPhone or iPad relies on a browser check; if it guesses wrong, the person gets a normal download, which still works.
