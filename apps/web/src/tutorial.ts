/**
 * The guided first visit (iteration 56). Each step points at the one thing to do next and moves on when the
 * player does it, one idea at a time, like the small first cases of deduction games (The Case of the Golden
 * Idol's opening scene, a tutorial you solve rather than read). Two steps only explain (her tea, the trail of
 * names) and wait for "Got it". Steps the player has already done on their own are skipped.
 *
 * Pure: the UI (ui/Tutorial.tsx) turns game state into a TutorialView and asks for the step to show.
 */

/** What the tutorial needs to know about the visit. */
export interface TutorialView {
  /** The open card: "note", "router", "notebook", "inspect", … or null. */
  panel: string | null;
  noteSeen: boolean;
  questions: number;
  /** A topic card is picked (its ask buttons are showing). */
  picked: boolean;
  /** Clue objects looked at. */
  inspected: number;
  /** Cards the player has opened since the tutorial began. */
  seen: string[];
  /** Explain-only steps the player has dismissed with "Got it". */
  acked: string[];
}

export interface TutorialStep {
  id: string;
  /** CSS selector of the thing to point at (if it isn't on screen, the bubble shows without a spotlight). */
  target: string;
  /** Explain-only: waits for "Got it". */
  ack?: boolean;
  done(v: TutorialView): boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  // 1. The goal: the password is a riddle on Michael's sticky note.
  { id: "note", target: ".top-buttons .btn-note", done: (v) => v.noteSeen },
  // 2. How to read it: one line, one part, one memory.
  { id: "read", target: ".panel-wrap .card", done: (v) => v.panel !== "note" },
  // 3. Ask with a card: pick one of the note's lines…
  { id: "pick", target: ".card-strip .topic.note", done: (v) => v.picked || v.questions > 0 },
  // 4. …and ask about it.
  { id: "ask", target: ".card-ask", done: (v) => v.questions > 0 },
  // 5. What it cost: her tea.
  { id: "tea", target: ".hud-panel.stats", ack: true, done: (v) => v.acked.includes("tea") },
  // 6. The trail: names become cards, and typing works too.
  { id: "trail", target: ".bottom .ask-bar", ack: true, done: (v) => v.acked.includes("trail") || v.questions >= 3 },
  // 7. Proof in the room.
  { id: "look", target: ".view-tabs", done: (v) => v.inspected > 0 },
  // 8. The notebook keeps what you learned.
  { id: "notebook", target: ".top-buttons .btn-notebook", done: (v) => v.seen.includes("notebook") && v.panel !== "notebook" },
  // 9. The router: where you answer.
  { id: "router", target: ".top-buttons .btn-router", done: (v) => v.seen.includes("router") },
];

/** The step to show, starting from `from`: skips every step already done. TUTORIAL_STEPS.length means finished. */
export function tutorialStep(from: number, v: TutorialView): number {
  let i = Math.max(0, from);
  while (i < TUTORIAL_STEPS.length && TUTORIAL_STEPS[i]!.done(v)) i++;
  return i;
}
