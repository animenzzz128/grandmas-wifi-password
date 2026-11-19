/**
 * The guided first visit (iteration 56). Each step points at the one thing to do next and moves on when the
 * player does it, one idea at a time, like the small first cases of deduction games (The Case of the Golden
 * Idol's opening scene, a tutorial you solve rather than read). Steps the player has already done on their own
 * are skipped.
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
  target: string | ((v: TutorialView) => string);
  /** Explain-only: waits for "Got it". */
  ack?: boolean;
  done(v: TutorialView): boolean;
}

/**
 * Three steps, the whole loop once: read the riddle, ask about it, answer at the router (playability review,
 * docs/14, P7: nine steps took longer than solving an Easy note). Everything else (her tea, follow-ups, the
 * trail of cards, proof in the room, the notebook) is taught the first time it comes up, in the chat
 * (store.ts, `lesson.*`).
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // 1. The goal: the password is a riddle on Michael's sticky note, one memory per line.
  { id: "note", target: ".top-buttons .btn-note", done: (v) => v.noteSeen && v.panel !== "note" },
  // 2. Ask about a line: pick one of the note's cards, then "Tell me about it" (or type a question).
  { id: "ask", target: (v) => (v.picked ? ".card-ask" : ".card-strip .topic.note"), done: (v) => v.questions > 0 },
  // 3. The router: where you answer.
  { id: "router", target: ".top-buttons .btn-router", done: (v) => v.seen.includes("router") },
];

/** The selector a step points at for this view of the visit. */
export function stepTarget(step: TutorialStep, v: TutorialView): string {
  return typeof step.target === "function" ? step.target(v) : step.target;
}

/** The step to show, starting from `from`: skips every step already done. TUTORIAL_STEPS.length means finished. */
export function tutorialStep(from: number, v: TutorialView): number {
  let i = Math.max(0, from);
  while (i < TUTORIAL_STEPS.length && TUTORIAL_STEPS[i]!.done(v)) i++;
  return i;
}
