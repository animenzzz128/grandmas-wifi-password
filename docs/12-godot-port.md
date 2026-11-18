> Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction, 2026-11-17 (iteration 54). The scores
> come from my own play in the browser pane and from the tests, not from people playing. Treat them as a starting
> point for the team's review.

# Iteration 54: what the web edition took from the Godot edition

On 2026-11-17 the two versions were compared side by side, and the web edition was chosen to go on: it is the one
with the AI (LLM Grandma, guardrails, eval), which the course is about, and free-text questions keep every visit
different. The Godot edition (`../grandma-wifi-godot`) scored higher on three things: the first 30 seconds, the
look, and controls and platforms. This iteration ports what made it better, so the web edition matches or beats it
there too.

## What was ported

| From the Godot edition | Now in the web edition | Where |
|---|---|---|
| Topic cards: the note's parts plus every name she mentions or a clue shows; "Tell me about it" / "When was that?" | Cards next to free typing. The card picks the memory (deterministic, testable); the LLM only words it. Names in a reply or on an object unlock new cards. The cost shows on the button; asking the same card again is a follow-up. | `packages/engine/src/topics.ts`, `AskRequest.topic`, `RunView.topics`, `POST /api/runs/:id/look`, `apps/web/src/ui/Cards.tsx` |
| Fairness bot (`test_logic.gd`) | Plays all 8 notes with cards only, until nothing new turns up: every part is findable, no hidden year is ever said. A second test checks that no card's name gives away an answer the unlocking text didn't say. | `packages/engine/test/topics.test.ts` |
| The house and Grandma, modelled in code in Blender | `room.glb` and a lighter `grandma.glb` (`tools/decimate-glb.py`), static meshes merged per material at load (578 meshes → ~50 draw calls) | `apps/web/src/scene/House.tsx`, `Rosie.tsx` |
| Procedural shaders (wood, wallpaper, fabric, knit, rug, lace, sky, CRT, photo, tile, glint, hover rim) | Ported to three.js: patched into `MeshPhysicalMaterial`, so they keep three's lights, shadows and tone mapping | `apps/web/src/scene/materials.ts` |
| Grandma's procedural animation (`grandma.gd`) | Breathing, blinks, look-at, lip flaps, a pose per mood, dozing with her tea, sips, the tea level in her cup, steam, "z z Z" | `Rosie.tsx` |
| Six camera views, tap to look closer, drag to look around | Seven views (a kitchen view added), smooth moves that curve through the room, tap/click to inspect, drag to look, keys 1–7. Replaces first-person walking. Views frame their subject above the bottom dock (camera view offset). | `apps/web/src/scene/ViewRig.tsx`, `ui/Controls.tsx` |
| Title over the living room, sticky-note picker, best stars per note | The camera drifts round the room behind the title; "Choose a sticky note" lists all eight with your best stars. The very first visit still goes straight into an Easy one. | `App.tsx`, `noteStars.ts` |
| Quality presets; touch and phone layout | Low / Medium / High, chosen by device and lowered automatically if the frame rate stays low; phone layout; installable as an app (web manifest, icons) | `settings.ts`, `adaptive.ts`, `house.css`, `public/manifest.webmanifest` |
| Fonts (Nunito, Fraunces, Caveat), the cream-paper UI | Same fonts and look | `house.css`, `public/fonts/` |
| The hall phone: ring Uncle Michael for a hint | Twice a visit, free; he passes on the next of the note's nudges (shared with Grandma's own nudges, so nothing repeats). His words stay out of Grandma's LLM history. | `callMichael` in `run.ts`, `POST /api/runs/:id/item {item:"phone"}`, the phone's close-up card |

## Bugs found and fixed along the way

- **Card names gave answers away.** Looking at the photo album ("a beagle… nobody wrote the names underneath")
  unlocked cards named *Biscuit* and *Buttons*, because their match words included "beagle" and "spaniel". The same
  went for "honeymoon" unlocking *Niagara Falls*. The Godot edition has the same data. Cards now unlock only from
  names, and a test guards it.
- **Merged geometry moved the room.** Baking world matrices into shared, cached glTF buffers moved the floor 20 cm
  down under React's dev double-render. Geometry is copied before merging.
- **Shadows cost ~115 ms a frame** on an integrated GPU (the lamp's cube shadow map redrawn every frame). The room is
  static, so shadow maps are drawn while it settles and then kept: 153 ms → 36 ms a frame.
- **The Godot web build's missing glyphs** (★, ☆, █ showed as boxes) don't happen here: stars are text with labels,
  and smudged note parts are drawn as ink smudges.
- **The house number sign showed the answer.** Its art read "412" while its description says the middle digit
  has flaked off; that handed Medium (Maple412) over to anyone who looked. This predates the port. The sign now reads
  "4 _ 2".
- **Text matched the old room.** Grandma's greeting, the objectives and the cookie lesson pointed at "the kitchen";
  the router is in the front hall now.

Ambient occlusion (GTAO) was tried on High and is off: with the camera's view offset it washed the picture out, and
it cost ~30 ms a frame. `?ao=1` turns it on for experiments.

## Re-score

Same ten dimensions as the 2026-11-17 comparison (1–10). Web "before" is the build of iteration 53.

| Dimension | Web before | Web now | Godot | Evidence for "now" |
|---|---|---|---|---|
| Core deduction fun | 6 | **7** | 5 | Free text plus cards: the trail is visible, and typing still lets a player test a hunch. Cards alone can be brute-forced, like Godot's. |
| First 30 seconds | 6 | **8** | 8 | Title over the moving room, one button into an Easy visit, note picker, how-to-play card; Grandma greets you face on. The 6 MB room takes a few seconds on a slow connection (warm background and a progress line meanwhile). |
| Visuals | 5 | **8** | 8 | Same models, materials and fonts. Lamp and moon shadows, glow on High. No volumetric fog or GI (Godot High has them); better than Godot's own web build, which runs the Compatibility renderer without them. |
| Character and conversation | 7 (LLM, unverified) / 4 offline | 7 / 5 | 5 | Rosie's animation from Godot plus the LLM. Card asks give the offline Grandma the right memory every time. LLM mode still not run (no key here). |
| Controls and platforms | 6 | **9** | 9 | Mouse, touch and keyboard; views, taps, drag; phone layout tested at 375×812; quality presets with automatic step-down; installable. Each edition has a platform the other lacks: the browser reaches iPhones (Godot couldn't build iOS here), Godot has native files (exe, apk) that run without a server. |
| Replayability | 7 | 7 | 4 | Unchanged: free text, daily Grandma; cards don't reduce it. |
| Streaming potential | 8 | 8 | 5 | Unchanged. |
| Engineering | 8 | **8** | 6 | 255 tests (was 229), typecheck, data checks, production build. |
| Course fit | 9 | 9 | 2 | Unchanged: the AI is still the core. |
| Long-term upkeep | 7 | **8** | 6 | One codebase now carries both editions' strengths; the Godot assets are reused, not forked. |

**Where the web edition was lower (first 30 s, visuals, controls and platforms), it now matches the Godot edition.**
It leads everywhere else.

## Not tested

- The LLM Grandma (no API key on this machine). The prompt for card asks is covered by a unit test only.
- Real phones (the phone layout was tested in the browser's phone emulation) and Safari.
- Frame rate on a discrete GPU, and on phones. On this machine's integrated GPU a High frame takes ~36 ms without
  glow; the game lowers resolution and then quality by itself.
- People playing.

## Next

1. Run `npm run eval` and the AI player with a key, now including card asks.
2. A playtest with the cards: do players use them, typing, or both?
3. Native packages if needed (Electron for Steam can run the server inside the app).
