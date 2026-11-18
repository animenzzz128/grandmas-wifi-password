> Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, 2026-11-16 (design plan F, `docs/08-design-improvement-plan.zh.md`). A starting point for the team: the wording, the store copy and the choice of shots are yours to change.

# Demo and launch kit

## 1. Three-minute live demo

Goal: the audience sees the hook (a riddle only Grandma's memories can answer), one laugh, one "aha", and the share card. Rehearse on the machine you'll present from, with sound on.

| Time | What to do | What to say |
|---|---|---|
| 0:00 | Title screen. Click **Visit Grandma** (first visit) or **Today's Grandma**. | "Grandma's Wi-Fi password is a riddle on a sticky note, made of her memories." |
| 0:15 | Walk to the sticky note, press **E**. Read the riddle aloud. | "She doesn't know the password. She only remembers her life." |
| 0:35 | Walk to Grandma. Click a suggested question, press Enter. | Point at the tea meter dropping: "Every question drinks some of her tea." |
| 1:00 | Ask a follow-up ("And then what happened?"). | "Following up is cheaper. She rambles, and the clue is buried in the story." |
| 1:20 | Pick up an object (the album on Easy). She reacts. Open the notebook (**Tab**). | "The room has evidence too. The notebook collects names, years and places as you hear them." |
| 1:50 | Router: type one part right and one wrong on purpose. | "It tells you which part is right, so a wrong guess still teaches you something." |
| 2:15 | Type the right answer. Confetti, result card, **Copy result**. | "Spoiler-free, Wordle-style share card, and a new Grandma puzzle every day." |
| 2:40 | Settings for a moment: text size, high contrast, key remapping, volumes. | "Built to be accessible: no timers, remappable keys, relaxed mode." |

**Answers for rehearsal (don't show the audience):**

| Puzzle | Answer |
|---|---|
| Easy | Biscuit1961, Niagara1963, Buttons1972 |
| Medium | Maple412, Marge1958, Buttons27 |
| Hard | Sparrow1977!, Biscuit1949! |

The puzzle you get is random per visit ("Try another" never repeats the one just played), and today's daily is the same all day. For a predictable demo, rehearse on the day's daily, or press "Back to the start" and revisit until you get the one you rehearsed.

**If something breaks:**
- **No internet or no API key:** start the server with `--mock` (the offline Grandma). Everything above works; her replies are shorter.
- **The model is slow:** keep talking over the "thinking" pose. The 12-second timeout falls back to a free in-character line.
- **The 3D room doesn't load:** the error screen offers Reload. Keep a 60-second screen recording of a full run as a backup.

## 2. itch.io page (draft)

**Title:** Grandma's Wi-Fi Password

**Short description (one line):** A daily deduction puzzle: chat with your AI Grandma to work out the Wi-Fi password hidden in her memories.

**Anchor and hook:** Wordle-style daily deduction, but you're coaxing the answer out of a rambling, very real-feeling Grandma.

**Description:**

> The Wi-Fi password is on a sticky note, and it's a riddle: "the sock thief + the year we said 'I do'". Only Grandma knows the answers, and she'll happily tell you, along with three stories about Uncle Stan's fishing cabin.
>
> Ask her anything in your own words. Pick up the photo album, the old sled, the wedding picture. Piece it together, then type the password into the router before her tea runs out and she dozes off.
>
> - A new puzzle every day, the same for everyone, with a spoiler-free share card
> - Easy, Medium and Hard puzzles, several of each
> - Grandma remembers only what's true: every answer can be found more than one way
> - 10–15 minutes a visit

**Controls:** WASD walk (remappable) · mouse look · E use · Enter talk · Tab notebook · Esc back. Keyboard and mouse required.

**Accessibility:** no time limits · relaxed mode (her tea never runs out) · text size 85–160% · readable font · high contrast · remappable keys · separate music, effects and voice volumes · screen-reader announcements for her replies · reduced-motion support · every sound has an on-screen equivalent.

**AI disclosure:** Grandma's replies are written live by an AI model (Claude, by Anthropic), checked by the game against her fixed memories before you see them. Her memories, the puzzles and the room are hand-made by the team. The room music was written by an AI (Claude Code). Most 3D models are CC0 assets (see Credits).

**Credits:** the team names, and `CREDITS.md` (asset packs, licences).

## 3. Shots to capture

**Cover image or GIF (630 × 500):** the sticky note riddle in the foreground, Grandma in her armchair behind. If animated: the note, then a typed question, then her reply typing out, then the notebook chime. Under 5 seconds and no flashing (itch.io quality guidelines).

**Screenshots (3–5, all real gameplay; the first one is what people see in lists):**
1. Talking to Grandma, with a reply and the suggested questions visible.
2. The sticky note card.
3. Holding up the photo album to her.
4. The router with one part green, one red.
5. The result card with confetti.

**45-second trailer:**

| Time | Shot |
|---|---|
| 0–5 s | Gameplay at once: the riddle note fills the screen. |
| 5–20 s | Three quick questions and her funniest replies. |
| 20–30 s | Picking up clues, the notebook filling up. |
| 30–40 s | The router: a wrong part, then right. Confetti. |
| 40–45 s | Title card and "A new Grandma puzzle every day". |

No logo fade-in at the start.

## 4. Launch checklist

- [x] Course key set as a Fly secret, `GRANDMA_MODE=llm`, daily budget set (`fly.toml`, README) (2026-11-18)
- [x] `fly deploy --ha=false`, then `fly scale show` says 1 machine (2026-11-18: one machine in ewr, health check passing)
- [ ] If embedding on itch.io: `EMBED_ORIGINS="https://itch.io https://*.itch.zone"` as a Fly env value. Otherwise link to the Fly URL from the page.
- [ ] Fresh-machine check: Chrome, Edge and Firefox, start to solve, sound on
- [ ] `npm run stats` after the first playtest: funnel, time to first question, clues found
- [ ] Page reviewed by the whole team before it goes public
