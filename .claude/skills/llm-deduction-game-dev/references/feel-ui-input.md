# Feel, UI, input and onboarding

Contents: 1. Input modes · 2. Pointer lock · 3. Interaction · 4. Feedback and juice · 5. Onboarding · 6. HUD · 7. Accessibility · 8. Checklist

## 1. Input modes (the most common source of "the controls feel broken")

A first-person conversation game has at least four modes: **look/walk**, **talk** (typing to Grandma), **card** (reading an object, the note or the router), **menu/result**. Rules:

- **One owner per key at a time.** Movement keys do nothing while a text field has focus. The key that opens a panel must not reach the panel's input: open on `keyup`, call `preventDefault` on the opening `keydown`, or focus the field on the next frame.
- **Esc backs out exactly one layer:** card → talk → look (pointer released). It is never a no-op and never skips a layer.
- **Leaving talk is explicit and visible.** After sending a message, either keep talk mode with a clear indicator ("Talking to Grandma · Esc to walk") or return focus to the world. Never leave a hidden focused text box that swallows WASD.
- **Show the mode.** The crosshair, a border on the chat box or a hint line says which mode is active.
- **Entering talk from look:** Enter or E on Grandma. Releasing pointer lock for typing is fine; re-locking needs a click (see 2).

## 2. Pointer lock (browser specifics)

- Lock only from a user gesture (a click). Esc always releases it (browser-controlled). Listen for `pointerlockchange` and `pointerlockerror`. [MDN Pointer Lock]
- Re-locking after the user pressed Esc needs a new gesture, and some browsers reject an immediate re-lock. Show a "Click to look around" overlay rather than trying again in code. [MDN]
- Request `unadjustedMovement: true` for raw input and fall back without it. Accumulate deltas and apply them once per frame, together with movement, so look and walk stay in sync (this repo's `Player.tsx` does this).
- Offer sensitivity, invert Y and FOV settings, and save them. [Game Accessibility Guidelines]

## 3. Interaction

- **Generous targeting.** Use the hit boxes, not the meshes, with a minimum size; snap to the nearest interactable in a small cone within reach. Floor and wall items should not need pixel-perfect aim.
- **Proximity matters.** Showing or giving something to a character works only near them. Otherwise space stops meaning anything.
- **Telegraph interactables.** Important objects look interesting and filler looks plain. Add a subtle glint or outline within reach, plus a prompt that names the verb. [Outer Wilds analysis]
- **Every interaction gives something.** Inspect text that never pays off trains players to stop inspecting.

## 4. Feedback and juice (cosy-scaled)

- **Game feel is real-time response (within ~100 ms) plus polish that emphasises interactions.** Unverified: this definition comes via secondary sources on Swink's *Game Feel*. [Swink via Liz England]
- **Juice signals events; it isn't decoration.** Use small, warm effects: a soft chime and a notebook pulse when a fact is learned, router LEDs reacting to each attempt, a gentle camera nudge on the "aha", the teacup visibly emptying. [Vlambeer, "Art of Screenshake" coverage]
- **Never silent waiting.** A "thinking" pose and a "…" bubble appear immediately while the model works.
- **Explain costs inline:** "−14 tea (question 8 · rude +6)".

## 5. Onboarding (first 60 seconds)

- **Teach through a situation where only one action makes sense, not a wall of text.** The camera starts on Grandma for her greeting; she points you at the note; the note sits in clear view on the way. [GDevelop, Roblox onboarding guides]
- **An objective strip that ticks off:** Read the note · Ask Grandma · Find proof in the room · Enter the password.
- **The title screen states the premise and difficulty in one line each.**

## 6. HUD

- Keep the centre and the protagonist clear. During conversation use a side panel or subtitles under her, and frame her with the camera.
- Show only what drives a decision: tea, guesses left, the pinned note. Hide debug badges and FPS outside development.
- Controls hints fade after the player has used them.
- The result card is shareable and adds par and a Grandma line.

## 7. Accessibility (Game Accessibility Guidelines basics)

Remappable keys; sensitivity and FOV; no information carried by colour or sound alone; resizable, high-contrast text; read at your own pace (the tea timer is per question, not per second); an option to relax or turn off the tea limit; reduced motion (no camera bob or shake); saved settings. [gameaccessibilityguidelines.com]

## 8. Checklist for any UI or controls change

- [ ] In every mode (look, talk, card, result), pressing W, E, Enter, Esc and Tab does the expected thing; nothing types into the wrong field
- [ ] Esc layering works from the deepest layer back to look
- [ ] Grandma stays visible while talking
- [ ] Each new interaction has feedback within ~100 ms
- [ ] Strings are in `data/i18n`; no hard-coded text
- [ ] Re-run the playtest scenarios in `playtest.md` (the input-mode section)
