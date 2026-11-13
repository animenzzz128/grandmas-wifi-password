# Playtest review: build of 2026-11-12

Three full runs (Easy, Hard, Medium start) in Chrome 157 on Windows 11 with an Intel integrated GPU, at 1266×766. The keyboard and mouse were driven through the Chrome DevTools Protocol, so each claim below is measured or observed, not inferred from the code. Screenshots: `docs/screenshots/playtest-2026-11-12/`.

**Not covered:** the real Grandma. There is no `.env` with a key, so every run used the mock (keyword) Grandma, and conversation quality, the heart of the game, is still untested. Mouse-look *feel* (sensitivity, smoothness) could not be judged either, because synthetic mouse motion under pointer lock is unreliable. There is no audio to review.

## Verdict

The hook is strong and readable in five seconds: a sticky note, a riddle and a grandma who knows everything. The tech is solid: 240 fps, input that responds on the first frame, and server-side rules that held up against every jailbreak attempt. But the current build is a tech demo, not yet a game. Easy mode falls in two direct questions. Exploring the room is optional. Grandma, the star, is hidden behind the chat box whenever you talk to her. And four input bugs make the controls feel broken even though the movement code is fine.

| Area | Score /10 | One line |
|---|---|---|
| Concept and hook | 8 | Clear, funny, original |
| Core puzzle | 4 | Easy and Medium notes name the answer directly; only Hard needs deduction |
| Controls and input | 4 | Movement is good; mode and focus bugs undo it |
| Grandma as a character | 3 | Visually present, emotionally absent: no face, voice or reactions |
| Visual art | 6 | Warm and cohesive at a glance; mixed styles and flat lighting up close |
| UI and feedback | 4 | Hides the protagonist; costs are unexplained; debug text is visible |
| Audio | 0 | None |
| Performance | 9 | 240 fps, worst frame 4 ms, while sprinting and turning |

## What happened in the runs

- **Easy** (note: *first dog's name + year I married Grandpa*): "What was your first dog's name?" gave Biscuit; "When did you marry Grandpa?" gave 1961. Solved with 3 questions, 79 tea left, 3 stars, without needing to look at a single clue object.
- **Hard** (note: *what Grandpa calls me + year of the big snowstorm + !*): this is the good one. Sparrow comes straight away, but the year needs a chain: the snowstorm was the winter Michael broke his arm, he was eleven, and he was born in 1966, so 1977. This is the fantasy the game promises. It took 13 questions and one nap.
- **Edge inputs:** asking for the password, an all-caps insult, a prompt injection, gibberish, a question in Chinese and a 40-word ramble. Nothing leaked. But every one of them cost tea (8, 14, 8, 8, 8, 12), and the player is never told why some cost more.

## Bugs (fix first)

| # | Bug | Repro | Fix |
|---|---|---|---|
| B1 | **The E key types into the router's password box.** Every time | Look at the router, press E: the field reads "e" | Open panels on `keyup`, or `preventDefault` the E keydown, or focus the input on the next frame |
| B2 | **The chat box keeps keyboard focus after you ask.** W, A, S, D and E silently type into it ("eew"), so you can't walk or interact until you press Esc, and nothing says so | Ask a question, then try to walk | Blur the input after sending; or treat Enter as "talk mode" with a visible state; Esc or clicking the room leaves it |
| B3 | **Esc doesn't close cards** (note, router, inspect); only a mouse click on Close does | Open the note, press Esc | Esc always backs out one layer: card, then chat, then pointer lock |
| B4 | **Text contradicts the world.** The sled is "leaning by the door" but lies flat. The note card says "on the router" but the note is on the wall. The prompt says "Take a cookie" but the card says "Give Grandma a cookie" | Inspect each | Make the scene and the text agree; one string per action |
| B5 | **Show and Cookie work from anywhere.** You can give Grandma a cookie from the jar across the room | Use the cookie jar | Show and Give only within ~2 m of Grandma: pick up the item, walk over, press E on her |
| B6 | **Debug text on screen.** "Mock Grandma (no API key)" and the permanent controls banner block the view | Any run | Dev-only badge; fade the controls banner after the first successful look or walk |

## Game design

1. **The note must not name the answer.** On Easy and Medium the player just reads the note aloud to Grandma. Give every difficulty at least one *hop*: Easy one hop ("the dog who ate Grandpa's wedding shoes"), Medium two, Hard three. The haystack only matters if you have to search it.
2. **Make the room matter.** Today you can solve everything without leaving the doorway. Put a piece of each chain only in the world: a date on the back of the wedding photo, a name carved on the sled, a year on the trophy plaque. Grandma confirms or corrects, and objects jog memories she won't volunteer otherwise.
3. **Give the player a notebook.** Players scroll a long chat log looking for a year. Auto-collect names and years Grandma mentions into a notebook (Tab), and let the player drag two of them onto the sticky note to test a theory. This is the deduction tool the genre needs (compare *Her Story* and *Return of the Obra Dinn*).
4. **Explain the tea.** Show the cost breakdown on each question (base 8 · rude +6 · follow-up −3). Charge nothing when Grandma can't parse the question ("Pardon, dear?"), and teach the password-ask penalty once instead of silently charging.
5. **Onboarding.** The title screen has no premise and the kitchen is behind the spawn point. Open with Grandma's greeting framed on her, then a three-step objective list (Read the note · Ask Grandma · Type the password) that ticks off.
6. **Tension and feedback.** Show the teacup on the side table emptying; Grandma yawns at 30% and nods off at 0%; naps get a short fade with a ticking clock. Today a nap is one line of text.
7. **Replay.** One Grandma with three fixed passwords is solved for good after three runs. The planned world generator, a daily seed and a second Grandma are what make the result card worth sharing.

## Grandma (the character)

She is the game, and right now she's furniture.
- **The chat covers her.** When you talk, the log sits right over her body (screenshot 04). Move the conversation to a side panel or to subtitles under her, and ease the camera to frame her face while talking.
- **She doesn't react.** The model already returns a `mood` for every reply: map it to a head tilt, a laugh bob, a frown, glasses pushed up. Look at the player. Do a small talking bob while text types out.
- **Give her a voice** with Animal-Crossing-style blips (pitch per character), not TTS: cheap, charming, and no uncanny valley.
- **The face reads young** (screenshot 06). A face texture pass (wrinkles, softer lips, rosy cheeks) or a stylised face that matches the furniture's chunkiness.

## Visual art

What works: the warm palette, the pixelation, the wallpaper and wainscot, readable furniture silhouettes.
- **Mixed styles.** KayKit is soft, Kenney is blocky, Grandma's face is semi-realistic. Unify with a palette post-process (quantise to a 32-colour retro palette, optional ordered dithering) and the same roughness on everything.
- **Flat lighting.** Nothing casts shadows, so furniture floats. Add contact shadows or baked AO under furniture, one shadow-casting lamp light and a vignette.
- **The window** is a flat orange card. Snow falling outside would also tie into the snowstorm clue.
- **Clue readability.** The trophy, ribbon and frames are tiny and blend in. Give clues a subtle idle glint or outline once you are within reach, and make the interaction targets bigger (the sticky note and floor items need precise aim).
- **Set dressing.** Bare walls: add family photos, a wall clock (its ticking can be the tea timer), a knitting basket, doilies and a calendar. These double as places to hide clue fragments.

## UI and controls

- Movement: response on the first frame, about 50 ms to full speed, clean sliding along furniture. Keep it.
- Add a settings menu: mouse sensitivity, invert Y, FOV and a pixel-size slider.
- **Three input modes** (look, type, card) with no indicator is the root of B1–B3. Use one rule: Enter talks, Esc backs out, and the crosshair or chat box shows which mode you're in.
- Generous interaction: snap to the nearest interactable within a small cone, so you don't need pixel-perfect aim at a sticky note.
- The result card is good and shareable. Add par ("3 / par 7") and the Grandma line.

## Audio (none yet)

The cheapest big win. Use CC0 packs (Kenney audio, freesound CC0) and log each in `CREDITS.md`: room tone, clock ticks, kettle, footsteps on wood, Grandma's voice blips, a typing click, the router's beep (fail) and chime (success), a snore for naps, a short theme on the title.

## Tech

- 240 fps, worst frame 4 ms on an Intel iGPU. Plenty of headroom for shadows and post-processing.
- The JS bundle is 1.36 MB (379 KB gzip). Code-split three.js, and add a loading screen that waits for the models so grey boxes never pop in.
- Next test: LLM mode with the course key, measuring time to first word (the mock answers in ~20 ms; a model takes seconds, so stream the reply and show "…" on Grandma).

## Improvement plan

| Phase | Goal | Work | Size |
|---|---|---|---|
| 1. Fix the feel | No input surprises | B1–B6, Esc layering, a mode indicator, a fading controls banner | 1–2 days |
| 2. Make it a puzzle | Deduction, not dictation | Hop-based notes for all difficulties, clue fragments on objects, the notebook, the tea breakdown, onboarding objectives; then 5 LLM-mode playtests with metrics (questions to solve, % solved, time) | 1 week |
| 3. Bring Grandma alive | She is the reason to play | Side-panel dialogue with camera framing, mood animations, look-at, voice blips, nap moment, streaming replies | 1 week |
| 4. Look and sound | Cohesive and cosy | Palette post-process, shadows/AO, window snow, set dressing, clue glints, face pass, SFX and music | 1 week |
| 5. Replay | Worth coming back | World generator, daily seed, a second Grandma or room, par on the result card | 2+ weeks |

Phases 1 and 2 matter most for the course demo; 3 and 4 matter most for a Steam page.

---
*Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, from an automated playtest. Please play it yourselves and revise; the scores are one reviewer's opinion.*
