# Art, lighting, audio and assets

## Build order (don't polish lighting on unreadable shapes)

1. **Silhouette and layout read at play distance.** Can a player name every important object from 3 m away?
2. **Materials and palette.** Write a three-line art bible first: era (1970s Polish-American home), palette (avocado, mustard, walnut, cream, faded rose), rendering (chunky pixels, flat-ish shading). Unify packs from different sources with one palette and the same roughness. [Unity craft-game-floors; Threejs-Awesome-Graphics router]
3. **Lighting.** One key light that casts shadows (the lamp by Grandma), contact shadows or baked AO under furniture, warm fill. Without shadows, furniture floats.
4. **Atmosphere and post.** Palette quantisation and optional ordered dithering for cohesion, a vignette, subtle fog. Check with a baseline that has post-processing off.
5. **Validate visually** at near and far camera positions, at the default pixel scale; don't sign off on a single frame. [Threejs visual-validation skill]

## Readability of clues

- Clue objects are bigger and more saturated than filler, and placed at eye height or on surfaces you walk past.
- Text the puzzle depends on (engravings, a name carved on the sled, a plaque) appears on the object in 3D and in the inspect card, and they agree.
- Set dressing tells the story of "what happened here" and hides redundant clue routes: family photos, a wall clock (its tick can echo the tea), a calendar, a knitting basket, doilies. [Harvey Smith on environmental storytelling]
- The window and the outside can carry theme (snow for the snowstorm recipe).

## Characters

- One style across the cast and the room. A semi-realistic face in a chunky room reads as uncanny.
- Expressions and poses map to the model's `mood` (happy, wistful, confused, suspicious, sleepy).
- A look-at toward the player, a talking bob while text appears, a sip of tea while thinking.

## Audio (cheapest big win)

Room tone; clock ticks; kettle; footsteps on wood; UI clicks; a notebook chime; router beep (fail) and chime (success); Grandma's babble blips (pitch per character, not TTS); a snore for naps; a title theme. Mix quietly. Every sound needs an on-screen equivalent for accessibility.

## Sourcing and credits

- **Prefer CC0:** KayKit, Kenney, Quaternius, Poly Haven, ambientCG, Kenney audio, freesound CC0 filter. Check each item's licence on Poly Pizza (mixed CC0 and CC-BY).
- **Log every asset in `CREDITS.md`** the moment it enters the repo: source URL, author, licence, download date, what it's used for.
- **AI-generated assets:** only with a licence that allows commercial use (Meshy paid, for example). List them in `CREDITS.md` and in Steam's AI disclosure. Live LLM dialogue needs its own disclosure with guardrails.
- `tools/import-assets.mjs` copies chosen models from extracted packs. Models are fitted to the collider boxes in `data/scenes`, so swapping art never changes gameplay.

## Checklist for an art or audio change

- [ ] Reads at play distance; clue objects stand out from filler
- [ ] Matches the art bible palette
- [ ] Text on the object and in the inspect card agree
- [ ] Logged in `CREDITS.md`; the licence allows commercial use
- [ ] Frame time stays under budget (record `__pt.fps()` before and after)
