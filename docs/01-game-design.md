# Game Design Document: *Grandma's Wi‑Fi Password* (working title)

Version 0.1, 2026-11-11. Status: draft for team review.

---

## 1. Overview

| | |
|---|---|
| **Genre** | Conversational deduction puzzle / comedy |
| **Platforms** | Web (course demo), then Windows PC on Steam |
| **Run length** | 5–10 minutes |
| **Price target (Steam)** | $4.99 and a free demo |
| **Players** | Single-player, plus a Streamer Mode where chat participates |
| **Core fantasy** | "I'm the clever grandkid who can get anything out of Grandma, if I ask the right way." |

**Elevator pitch.** Grandma's Wi‑Fi password is written on a sticky note that only says *"first dog's name + the year I married Grandpa."* Grandma is 87 and remembers everything. She just can't tell which memory you need. You have until her teacup is empty, and then she naps.

**Course hook.** "Needle in a Haystack" is the classic long-context retrieval benchmark for LLMs. Here the AI *is* the haystack and the human takes the test. We also let an AI agent take the same test and compare the results.

---

## 2. Design pillars

1. **Everything Grandma says is true, but buried.** She never lies. The challenge is that the truth comes wrapped in tangents, mix-ups she corrects herself, and relative dates.
2. **Fair puzzles.** Every password can always be worked out from things Grandma will say. This is checked automatically before any Grandma ships (§7 of the technical design).
3. **A laugh in 30 seconds, a win in 5 minutes.** The first answer should already be funny. Nothing gates the fun.
4. **Grandma is the star, not the butt of the joke.** She is sharp, witty and loving. Her rambling comes from loving stories. We never make jokes about dementia or memory loss.
5. **Built to be watched.** Every system is chosen so it reads well on stream and in clips: visible stamina, big readable text, shareable results, chat participation.

---

## 3. The run (core loop)

```
Arrive at Grandma's ─▶ Read the sticky note ─▶ Ask questions ⟲ ─▶ Type password into router ─▶ Result card
                                                  │
                                           stamina drains,
                                           naps if empty
```

### 3.1 The sticky note (password recipe)
Every run starts with a sticky note that gives the password's *recipe*, not the password itself.

| Difficulty | Example note | Slots | Twist |
|---|---|---|---|
| Easy | `first dog's name` + `wedding year` | 2 | none |
| Medium | `street we lived on when your mom was born` + `house number` | 2 | Grandma moved a few times |
| Hard | `Grandpa's nickname for me` + `year of the big flood` + `!` | 2 + a literal | the flood year is said only as a relative date |
| Expert | `name of the boy I almost married` + `his car's color` | 2 | multi-hop: you first have to find out who he was |

**Format rules** are printed on the note: "no spaces," "first letter capital." The router shows the expected length as dots (`●●●●●●●●●●`), which is a fair hint that also builds tension.

**Smudged notes** (Medium and up): part of the note is smudged, e.g. "first d█g's name." The Reading Glasses item reveals it. Players can also guess what it says.

### 3.2 Asking questions
- The player types a question or, in voice mode, says it out loud.
- Grandma answers in 1–4 sentences. A good answer contains:
  - the fact the player asked about, if they asked well,
  - 1–3 **distractor facts** (other true memories),
  - some personality: a catchphrase, a tease, a reaction.
- **Haystack mechanics.** These are deliberate and always fair:
  - **Tangents.** Grandma drifts to a nearby memory. The real answer is still in the reply.
  - **Confusable pairs.** Grandma had two dogs, Biscuit and Buttons. If asked vaguely ("what was your dog's name?") she may name the *later* dog, because it was her favorite. Asking specifically ("your *first* dog") always gets the right one. These pairs are marked in the data.
  - **Relative dates** (Hard and up). "We married the spring after the big snowstorm, the one where your great-uncle got stuck in the outhouse." The player then has to find the year of the snowstorm. Anchors are either family events in the graph or a small curated list of uncontroversial public events.
  - **Self-corrections.** "It was 1962… no, '61. The cake had a '61 on it."
- **Grandma pushes back.** Rude or demanding questions get a witty refusal and cost more stamina. Asking "just tell me the password" gets: "Sweetheart, if I knew it I wouldn't need a sticky note."

### 3.3 Stamina: the teacup
- Grandma's energy is shown as a teacup that empties. Max 100.
- **Cost per question:**
  - base 8;
  - +4 if the question is longer than 25 words;
  - +6 if it is rude or demanding;
  - −3 for a follow-up on the topic just discussed, because continuing a conversation is cheaper than jumping around.
  - Costs are computed by the engine (deterministic), not by the LLM.
- **At 0, Grandma naps.** The run continues after a short nap animation and the teacup refills to 50. Each nap costs a star. The third nap ends the run: "Grandma's off to bed."
- A typical Easy run takes 6–10 questions.

### 3.4 Guessing
- The player types the password into the router whenever they like. A wrong guess doesn't drain stamina.
- There are 3 attempts per run. After a wrong guess the router blinks red and Grandma makes a comment ("Did you try turning it off and on again? That's what your cousin always says.").
- The run ends on a correct guess or after 3 wrong ones.

### 3.5 Result card (shareable)
```
👵 Grandma #127 · Daily
🔑 Solved in 7 questions
☕☕☕☕☕☕☕ 😴×0 🍪×1
⭐⭐⭐  grandmaswifi.game
```
**Stars:**

| Stars | Requirement |
|---|---|
| ⭐⭐⭐ | ≤ par questions and no naps |
| ⭐⭐ | ≤ 2× par |
| ⭐ | solved at all |

Par comes from AI play-testing (technical design §8). The card is copied to the clipboard as text. A ceiling feature is a card image.

---

## 4. Items and tools

| Item | Effect | How you get it |
|---|---|---|
| 🍪 Cookie | +25 stamina, and Grandma is delighted | 1 per run; more through progression |
| 📷 Photo album | Opens 5 captioned photos with years (e.g. "Lake Erie, 1958"). Free information that helps you place relative dates | Once per run, Medium and up |
| 👓 Reading glasses | Reveals the smudged part of the note | Once per run |
| 🦻 Hearing aid | Voice mode only: fewer "mishearings" | Progression unlock |
| 📓 Notebook | Highlight any text in Grandma's reply to pin it as a note. Always available. QoL, and it shows streamers' reasoning on screen | Always |

---

## 5. Modes

| Mode | Description | Course scope |
|---|---|---|
| **Visit (story)** | 10 Grandmas of increasing difficulty, hand-tuned from generated worlds. Beating them unlocks relatives (§6) | Floor: 4 Grandmas |
| **Daily Grandma** | Everyone gets the same Grandma and note each day. Shareable card, global stats | Mid |
| **Random Grandma** | A new generated Grandma from the pre-generated pool | Mid |
| **Human vs AI** | Watch a Claude agent attempt the same Grandma, then compare question counts | Mid (it reuses the eval agent) |
| **Streamer Mode** | Twitch chat votes between 3 suggested questions, or `!ask` submissions the streamer approves. Large-font UI and a delay buffer | Ceiling |

---

## 6. Characters and progression

- **Grandma (the base character).** Each generated Grandma has her own name, life history, home region, era details, verbal tics and humor style. Personality dials:
  - talkativeness (how long her tangents run),
  - teasing level,
  - nostalgia,
  - suspicion of "kids these days."
- **Relatives** are unlocked by progression. Each one is a new "haystack" with its own twist:
  - **Grandpa Walt:** only tells war-era and fishing stories. Facts hide inside very long stories.
  - **Uncle Ray:** confidently wrong about dates, but Aunt June corrects him in the background.
  - **Cousin Mia (19):** talks fast, uses slang, and answers with memes. A comedy contrast.
- **No forced orders or grinding.** This is the lesson from Find The Needle's reviews. Progression only adds new content and convenience items.

---

## 7. Tone and content rules

- PG rating. Warm, teasing, family humor.
- Grandma has agency. She can tease the player, refuse rudeness, and change the subject.
- **Never:**
  - jokes about dementia or memory loss as illness;
  - slurs, sexual content, or political hot-button topics;
  - real living people as family members.
- Harmful player input gets one of a set of fixed in-character deflections ("We don't talk like that in this house. Now, did I ever tell you about the county fair?"). There is also a hard-coded stop for self-harm content that points to resources.
- Public events used as date anchors come from a curated, reviewed list (e.g. moon landing 1969, a World's Fair). We avoid tragedies.

---

## 8. Presentation

### 8.1 Screen layout (16:9)
```
┌───────────────────────────────────────────────────────────────┐
│ [Sticky note]                                   [Router ●●●●] │
│                                                               │
│                 ( Grandma portrait, 6 moods )     ☕ teacup    │
│        ┌─────────────────────────────────────┐                │
│        │ Speech bubble (types out text)      │   [📷][👓][🍪]  │
│        └─────────────────────────────────────┘                │
│ [📓 Notebook]                                                 │
│ ┌───────────────────────────────────────────────┐ [🎤] [Ask]  │
│ │ Ask Grandma something...                      │             │
│ └───────────────────────────────────────────────┘             │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 Art and audio
- **Art:** hand-drawn 2D, warm palette, a cozy living room. One portrait with 6 expressions: neutral, laughing, thinking, nostalgic, sleepy, offended. **The art is made by humans** (team or commissioned) to avoid the AI-art backlash on Steam.
- **Voice:** babble sounds, short syllables per word in a "grandma" pitch, instead of TTS. This is cheap, charming, has no latency, and avoids AI-voice concerns. Real TTS is an optional ceiling feature.
- **Music:** gentle lo-fi or ragtime loop. Ambience: ticking clock, kettle.

### 8.3 Juice (moments for clips)
- Grandma's eyes slowly close as stamina drops, with snoring on the nap.
- Router confetti and Grandma cheering on a correct guess.
- "Mishear" moments in voice mode are shown in big text: *"Pass the SWORD?!"*

---

## 9. Voice mode and the mishear mechanic
- Speech-to-text runs in the browser (Web Speech API) for the prototype.
- If the transcript's confidence is below the threshold, the engine may apply a **mishear**: one keyword is swapped using a curated pun table (password→"pass the sword", Wi‑Fi→"wifey", router→"rooster"). Grandma then answers the misheard question, which is the comedy moment.
- The mishear chance is capped at 1 in 5 questions so it never becomes frustrating. The Hearing Aid item lowers it further.

---

## 10. Accessibility
- No time pressure; stamina is per question, not per second.
- Text size slider and a dyslexia-friendly font option.
- Every voice feature also works by typing.
- Colorblind-safe UI. Information is never shown by color alone.

---

## 11. Open design questions (to resolve in playtests)
1. Is 100 stamina / 8 per question the right budget? Target: Easy has a par of 6–8 questions.
2. Should distractor density scale with difficulty, or with how vague the question is?
3. Notebook: should it auto-capture facts, or stay manual? Manual is more skill-based and better on stream.
4. Is 3 wrong guesses too forgiving or too punishing?
5. Should the expected password length be shown, or is that too big a hint?

---

*Drafted with Claude Code (Claude Opus 5.5) under Jacky Yao's direction. Team review required.*
