# Progress

New session? Read this first, then resume from the next unticked step.

## Keystone session and links

- Keystone Claude Code session (the main session for this project): https://claude.ai/code/session_01FVN9H83TR3msWmCh1Edhze
- Live app preview (private artifact): https://claude.ai/artifact/CSiwSJaMrGSzxJuE2PwPme
- Question bank review page, with flags and notes (private artifact): https://claude.ai/artifact/PmsGAGhqcdNDhRqj2JYrvB
- GitHub repo: https://github.com/lilwheel/get-to-know
- Live app (GitHub Pages, from main): https://lilwheel.github.io/get-to-know/
- Before fixing questions, read the flags saved on the review page (collection `flags`, one document per question id).

## Steps

- [x] Step 1 — Project setup (2026-11-25, commit ae87f0a)
- [x] Step 2 — Data schema, sources and validator (2026-11-25, commit ae41cfc)
- [x] Step 3 — Card UI and swiping (2026-11-25, commit e5c7194)
- [x] Step 4 — Sections, levels and shuffler (2026-11-25, commit ef795be)
- [x] Step 5 — 18+ gate (2026-11-25, commit 88c6812)
- [x] Step 6 — Theming and polish (2026-11-25, commit 4a33290)
- [x] Step 7 — Question bank (7a–7f, then 7g top-up)
  - [x] 7a — Icebreaker Level 1 (2026-11-25, commit 84b53ed, 300 questions)
  - [x] 7b — Icebreaker Level 2 (2026-11-25, commit 02c9901, 300 questions)
  - [x] 7c — Icebreaker Level 3 (2026-11-25, commit 5f2b395, 300 questions)
  - [x] 7d — Dating Level 1 (2026-11-25, commit 7495169, 300 questions)
  - [x] 7e — Dating Level 2 (2026-11-25, commit c92efd1, 300 questions incl. 50 adult)
  - [x] 7f — Dating Level 3 (2026-11-25, commit 556ee37, 300 questions incl. 50 adult)
  - [x] 7g — Top up to ~2,000 and switch the app to the real bank (2026-11-25, commit dcf200d, 2,000 questions)
- [x] Step 8 — Final check and deploy (2026-11-25, commit 27c48b4; live on GitHub Pages)

## Phase 2: Friends & Teammates

Plan: `PHASE2_PLAN.md`, kept next to `BUILD_PLAN.md` in the folder above this project.

Decisions:
- P2-3 (2026-11-25): every dare is done by the whole table. Dare cards show "Whole table"; no extra field in the data.
- P2-6g (2026-11-25): the 18+ top-up is additive. New 18+ questions are added on top of the 300 regular
  questions per level (for example, 40% of 300 = 120 18+ questions), never by turning regular ones into 18+.
  Confirmed (2026-11-25): target is 40% of the 300 regular questions = 120 18+ questions each at Dating L2 and L3.
  The 50 existing ones count, so 6g writes 70 new 18+ questions per level (140 in all).

- P2-4b (2026-11-25): regular pools reshuffle when they run out, as before. The 18+ pool does not:
  once every 18+ card at a level has been shown, that level deals regular cards only (no 18+ repeats)
  until "Reset seen cards".

- [x] P2-1 — 18+ count and data schema update (2026-11-25, commit 5e58241). Before: Dating L2 50/350 (14.3%), L3 50/350 (14.3%), L1 0.
- [x] P2-2 — Sources (2026-11-25, commit ed358e6, 12 added, 0 dropped)
- [x] P2-3 — Third section on screen (2026-11-25, commit 02197c7; 10 sample cards in data/sample-friends.json)
- [x] P2-4 — Party mode toggle (2026-11-25, commit ce74112; 6 Party sample cards)
- [x] P2-4b — 18+ card frequency (Dating) (2026-11-25, commit e1b7af8; 30 swipes: L1 0, L2 6, L3 10 adult)
- [x] P2-5 — Theme (2026-11-25, commit 0c2e5e0; friends + friends-party pass WCAG AA)
- [x] P2-6 — Card bank
  - [x] 6a — Friends Level 1 (2026-11-25, commit d22ba74, 200 cards: 120 questions, 80 dares)
  - [x] 6b — Friends Level 2 (2026-11-25, commit b6e8098, 200 cards: 120 questions, 80 dares)
  - [x] 6c — Friends Level 3 (2026-11-25, commit 7705608, 200 cards: 120 questions, 80 dares)
  - [x] 6d — Party Level 1 (2026-11-25, commit 4700126, 200 cards: 120 questions, 80 dares)
  - [x] 6e — Party Level 2 (2026-11-25, commit b1531d3, 200 cards: 120 questions, 80 dares)
  - [x] 6f — Party Level 3 (2026-11-25, commit 355f203, 200 cards: 120 questions, 80 dares)
  - [x] 6g — Dating 18+ top-up (2026-11-26, commit b74a577; L2 and L3: 120 18+ each, 40% of 300 regular)
- [x] P2-7 — Final check and deploy (2026-11-26, review fixes 8c653d1)

## Phase 3: Flower Field Theme (look only)

Plan: `PHASE3_PLAN.md`, next to `BUILD_PLAN.md` in the folder above this project. Phase 2 (6g and P2-7) was finished after Phase 3.

Decisions (2026-11-25):
- Fonts are self-hosted (Latin subsets of Zen Maru Gothic 500/700 and Mochiy Pop One in `fonts/`), not loaded from Google, so no visitor data goes to a third party.
- `--leaf`, `--rose` and `--periwinkle` may be nudged lighter so `--ink` text on them meets WCAG AA (unadjusted: 3.47, 2.75, 4.41).
- The dialog backdrop becomes a solid fill of the section's background colour instead of a see-through dimming wash.
- Section colour changes keep the solid-layer opacity cross-fade (only transform and opacity animate), which looks like a 200 ms colour change.

- [x] P3-1 — Audit and tokens (2026-11-25, commit a9b9fac)
- [x] P3-2 — New palette, fonts and ink style (2026-11-25, commit 64e8a6c)
- [x] P3-3 — Section themes and toggle states (2026-11-25, commit 07ddab4)
- [x] P3-4 — Manga details (2026-11-25, commit 2825824)
- [x] P3-5 — Final check and deploy (2026-11-26, commit 63315de; live on GitHub Pages)

## After Phase 3

- [x] Research facts in card footnotes (2026-11-26): "Did you know?" findings from 55 checked studies and pages replace the "why" lines; every fact was re-checked by an independent reader against the raw abstract, and disputed or unconfirmable findings were dropped. 106 cards reworded after a phrasing review of all 3,340. Short-card layout added so footnotes fit on small phones.

## Phase 4

Paused — not started (wording toggle moved to Phase 5). Card ratings are not being built.

## Phase 5: Remove sound, layout fix, drink wording, share as image

Plan: `PHASE5_PLAN.md`. Evaluation and working notes: `docs/PHASE5_EVALUATION.md`.

- [x] P5-0 — Quick evaluation (2026-11-26, no code changes)
- [x] P5-1 — Remove sound (2026-11-26, commit 2eb7aec)
- [x] P5-2 — Layout fix for small and short screens (2026-11-26, commit 27cccb5)
- [x] P5-3 — Drink wording: data (2026-11-26, commit d88e677; 69 cards with Classic wording)
- [x] P5-4 — Drink wording: setting (2026-11-26, commit 258084a; "Include 18+ wording", plus 18+ backgrounds)
- [ ] P5-5 — Share button and card image
- [ ] P5-6 — Saving on every device
- [ ] P5-7 — Final check and deploy
