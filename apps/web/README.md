# apps/web

First-person 3D client: React + Vite + React Three Fiber (technical design §8).

- `src/scene/`: the room built from `data/scenes/*.json` and the player controller (pointer lock, WASD, collision, center-screen raycast)
  - `models.ts`: which art each scene `node` uses. Models are scaled into the object's collider box, so swapping art never changes collision or interaction
  - `Model.tsx`: glTF loading and fitting; falls back to a grey box if a model is missing
  - `Grandma.tsx`: Grandma, built from the Quaternius base character (pose, clothes, hair, glasses, idle animation)
  - `handmade.tsx`: props made in code (trophy, sled, router...); `textures.ts`: floor, wallpaper, ceiling
- `public/models/`: CC0 models, listed in `CREDITS.md` at the repo root
- `src/ui/Hud.tsx`: teacup, chat, inspect card, sticky note, router, result card
- `src/store.ts`: client state only. Rules live on the server; this mirrors the `RunView` it returns
- `src/strings.ts`: all text comes from `data/i18n/en.json`

Keep it replaceable (§8.3): no game rules here, no hard-coded strings, no browser-only APIs in game logic.
Input modes: look/walk, talk (the chat box has focus; a yellow label says so), card (inspect, note, router). Esc backs out one layer; clicking the room leaves talk mode. Clues and cookies are carried to Grandma and shown/given with E within 2.4 m (`store.ts` `carrying`, `Player.tsx` `NEAR_GRANDMA`). The mode badge and dev hooks exist only in development builds.

Dev helpers in the browser console: `__game.getState()`, `__camera`, and `__view(x, z, yaw, pitch)` to put the player somewhere (handy for screenshots).

**Adding art:** add the file under `public/models/`, add a line to `ART` in `models.ts` for the scene node, and add a row to `CREDITS.md`. New objects go in `data/scenes/*.json` first (`npm run validate` checks them).
