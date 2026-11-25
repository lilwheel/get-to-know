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
- [ ] P2-6 — Card bank
  - [x] 6a — Friends Level 1 (2026-11-25, commit d22ba74, 200 cards: 120 questions, 80 dares)
  - [ ] 6b — Friends Level 2
  - [ ] 6c — Friends Level 3
  - [ ] 6d — Party Level 1
  - [ ] 6e — Party Level 2
  - [ ] 6f — Party Level 3
  - [ ] 6g — Dating 18+ top-up
- [ ] P2-7 — Final check and deploy
