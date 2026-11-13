# Credits and asset licenses

Every third-party asset in this repository is listed here with its source, license and the date we downloaded it. **Add a row whenever you add an asset.** We need this list for the Steam page and for any future license questions.

All 3D assets used so far are **CC0 1.0 (public domain)**. We can use them commercially, change them, and ship them without credit. We credit the authors anyway. The one thing CC0 pack authors ask is that nobody resells the raw files as their own asset pack.

## 3D models

| Asset | Author | Source | License | Downloaded | Used for |
|---|---|---|---|---|---|
| Furniture Bits 1.0 (Free) | Kay Lousberg | https://kaylousberg.itch.io/furniture-bits | CC0 1.0 | 2026-11-12 | armchair, sofa, coffee table, sideboard, floor and table lamps, rug, photo album, picture frames (`apps/web/public/models/kaykit/`) |
| Furniture Kit 2.0 | Kenney | https://kenney.nl/assets/furniture-kit | CC0 1.0 | 2026-11-12 | fridge, kitchen cabinets, vintage TV and stand, radio, plant, coat rack, doormat, ceiling lamp (`apps/web/public/models/kenney/`) |
| Universal Base Characters (Standard) | Quaternius | https://quaternius.itch.io/universal-base-characters | CC0 1.0 | 2026-11-12 | Grandma's body and hair (`apps/web/public/models/quaternius/`) |

The license text of each pack is in its download (`License.txt` / `License_Standard.txt`). Some extra models from these packs are copied in as spares for the art pass (book set, pillow, cactus, shelf, upper kitchen cabinets).

## Changes we made

- **Grandma** (`apps/web/src/scene/Grandma.tsx`): built at load time from the Quaternius female base and its parted hairstyle. We changed them in code: a seated pose, painted clothes (blouse, skirt, stockings, shoes), a softened chest, a puffed-out buttoned cardigan, grey hair with a bun, glasses and a crocheted lap blanket. Normal and roughness maps were dropped and the light skin texture is used.
- **Furniture:** scaled to fit the collider boxes in `data/scenes/rosie-living-room.json`; some are re-tinted.

## Made by us

These are built in code, so there is no third-party license to track:
- Props: bowling trophy, blue ribbon, sled, fishing rod and tackle box, cookie jar, router, sticky note, house number sign, front door, window and curtains (`apps/web/src/scene/handmade.tsx`).
- Surface textures: wood floor, wallpaper with wainscot, ceiling (`apps/web/src/scene/textures.ts`).
- Sounds: Grandma's babble voice and the UI chimes are synthesised at runtime with WebAudio (`apps/web/src/audio.ts`); there are no audio files.

## Updating the art

`tools/import-assets.mjs` copies the models we use out of the unzipped packs. Run it only to add or change models; the copied files are already in the repo.

## AI-generated content

No AI-generated 3D models, textures, music or sound are used. If that changes (for example a paid Meshy model), list it here **and** in the Steam "AI generated content" disclosure.

---
*Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction. Please re-check the sources and licenses before a public release.*
