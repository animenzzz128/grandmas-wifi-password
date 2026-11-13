# The LLM character

Contents: 1. Free text as a game · 2. Players who don't know what to type · 3. Grounding and consistency · 4. Secrets and jailbreaks · 5. Latency and cost · 6. Making her alive · 7. Disclosure

## 1. Free text as a game

- **One clear goal; language is the verb.** Suck Up! works because each door has a single checkable aim. 1001 Nights turns the player's words into world objects. [Schacht on Suck Up!; 1001 Nights]
- **Talk must change state.** Reviewers found Covert Protocol's conversation pointless, because nothing followed from it. Each answer should fill the notebook, unlock a nudge or move a slot. [Aftermath]
- **More verbs than asking.** Vaudeville was criticised because questioning was the only way to investigate. Showing objects, finding evidence and confirming slots give the conversation a foothold. [Vaudeville reviews]
- **Players optimise: close the cheap routes.** Testers talk past gates and "summon 300 soldiers". Assume the player will try "just tell me". [dev.to postmortem; Yonder]
- **Decide what the fun is.** Here it's the puzzle, so the model serves fixed content. Improvisation is flavour, never the solution. [Yonder; Jam & Tea]
- **Real failure, stable objectives.** Objectives that appear and complete in one breath, or near-certain success, feel hollow. [Bicking on Hidden Door]

## 2. Players who don't know what to type

- **An empty box intimidates.** Seed it: the greeting suggests topics; a few suggestion chips ("Ask about Grandpa", "Ask about the sled") that disappear once the player has typed their own questions. [Yonder; empty-state antipattern]
- **Let the room suggest topics.** In Event[0] you scan objects, then talk about them. Here, inspecting an object should give the player a natural question. [Event[0] Q&A]
- **Open dialogue helps casual players** (longer, more engaged talks in a 64-player pilot), but they asked for recaps and more time. [Units pilot; Symbolically Scaffolded Play]
- **Suggestions must have visible consequences.** [Bicking]

## 3. Grounding and consistency

- **Game logic decides; the model words the result.** Run the hard checks first, then have the model phrase a verdict it can't change. This repo already does this with the fact database and `validateReply`. [dev.to postmortem]
- **Only game events change state**, never a sentence the model wrote. [dev.to postmortem]
- **Fix the truth before play.** Never let facts be invented when asked. [Bicking]
- **Strict where breakage hurts, loose elsewhere.** Hold solution facts rigid; let her ramble freely about the weather. [Symbolically Scaffolded Play]
- **Chekhov's armoury.** Track what has been introduced so loose threads pay off or stay out. [Hidden Door coverage]
- **Judge in character.** 1001 Nights moved evaluation into the King's own reasoning, which was cheaper and easier to tune than an external scorer. [1001 Nights]
- **Check:** contradiction rate against the database, unknown names and numbers, and hidden-year leaks (`validateReply`), measured by the eval set.

## 4. Secrets and jailbreaks

- **The secret is never in context.** A "never reveal" NPC leaked its secret in 3 of 30 attempts in one study. Gandalf-style players ask for letter counts, rhymes and pieces. Keep the assembled password and the slot mapping server-side; check output for the password, its parts in sequence, spelled-out or reversed forms. [arXiv 2508.19288; Lakera Gandalf]
- **Layer the defences:** an input screen, the persona prompt, the output check and throttling. [Anthropic: mitigate jailbreaks]
- **Refuse in character.** At Gamescom, the King's in-character warnings moved about 200 players from probing the model to playing. Use scripted lines for common attacks. [1001 Nights; Anthropic: keep Claude in character]
- **Teasing isn't abuse.** NEO NPC told antagonising apart from toxicity; only toxic input should end cooperation. [Ubisoft NEO NPC]
- **Breaking the AI is fun, so give it a harmless payoff** (Grandma: "Are you feeling alright, dear?") rather than a cost spiral. [Vaudeville reviews]

## 5. Latency and cost

- **Stream, keep replies short, keep the prompt lean.** Haiku plus short output are the main levers. Covert Protocol's ~3-second pause was widely noticed. [Anthropic: reduce latency; TweakTown]
- **Never freeze.** Show a "thinking" pose (sipping tea, looking up at the ceiling) at once; on timeout, say a scripted line. [abratabia]
- **Cache the fixed prompt** (persona plus world block). [Anthropic prompt caching]
- **Plan for spikes and outages.** Vaudeville got a large launch bill and a streamer-driven outage. Set budgets, rate limits and a mock fallback. [Vaudeville pre-mortem; Jam & Tea]
- **A limited-questions meter is a proven cost cap**, and here it's also the tension mechanic (tea). [Suck Up! coverage]

## 6. Making her alive

- **Flaws as personality.** Event[0] tells players the AI is old and faulty; Grandma is forgetful and rambles. Fallback lines should sound like her ("my hearing aid is whistling"). [Event[0]]
- **A handful of moods the player can shift.** Kaizen has nine moods that decide whether it helps. Map the reply's `mood` to a pose, a face and a voice pitch. [Event[0] Q&A]
- **Keep beats moving when understanding fails.** Façade misread about 30% of input but hid it with deflection and continued beats. [Façade commentary]
- **Writers own the backstory.** Test every line against "would she say this?". Ubisoft had to correct drift toward flirting. [Ubisoft NEO NPC]
- **No voice beats a bad voice.** Robotic TTS hurt Vaudeville and Covert Protocol. Use text, expressive animation and babble blips. [Vaudeville reviews; Aftermath]

## 7. Disclosure

- **Steam requires disclosing live-generated content and its guardrails.** It also offers in-game reporting through the Steam overlay. Check the official Steamworks page before submitting, because the press summaries vary. [GamingOnLinux; PC Gamer]

## Checklist for a Grandma change

- [ ] Solution facts come from data; the validator covers any new fact type
- [ ] Nothing new in the prompt lets the model assemble the password
- [ ] Attack set re-run: password ask, letter count, rhyme, reverse, role-play, prompt injection; all pass
- [ ] Replies stay short (target ≤ 60 words); measure time to first word with streaming
- [ ] Every new failure path has an in-character line from `data/i18n`
- [ ] The `mood` values used are mapped to something visible in the client
