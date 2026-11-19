/**
 * The guided first visit (iteration 56): a spotlight on the one thing to do next, and a speech bubble saying
 * why. It never blocks the game (clicks go through to the highlighted thing); the player can skip it at any
 * time. Steps and their rules are in tutorial.ts.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import { t } from "../strings.ts";
import { useGame } from "../store.ts";
import { TUTORIAL_STEPS, stepTarget, tutorialStep } from "../tutorial.ts";
import type { TutorialView } from "../tutorial.ts";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the target is on screen, followed every frame (cards scroll, panels open, the window resizes). */
function useTargetBox(selector: string | undefined): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useLayoutEffect(() => {
    if (!selector) return setBox(null);
    let id = 0;
    let last = "";
    const tick = () => {
      id = requestAnimationFrame(tick);
      const el = document.querySelector(selector);
      const r = el?.getBoundingClientRect();
      const next = r && r.width > 0 && r.height > 0 ? { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } : null;
      const key = JSON.stringify(next);
      if (key !== last) {
        last = key;
        setBox(next);
      }
    };
    tick();
    return () => cancelAnimationFrame(id);
  }, [selector]);
  return box;
}

const BUBBLE_W = 320;

/**
 * In her own view Grandma fills the middle of the screen: a bubble that would cover her face or body moves to
 * the side nearer where it was (review 2, F5).
 */
function awayFromGrandma(style: React.CSSProperties, width: number, vw: number, vh: number, onHer: boolean): React.CSSProperties {
  if (!onHer || vw < 700) return style;
  const left = typeof style.left === "number" ? style.left : (vw - width) / 2;
  const top = typeof style.top === "number" ? style.top : typeof style.bottom === "number" ? vh - style.bottom - 170 : vh * 0.3;
  const overlapsX = left < vw * 0.66 && left + width > vw * 0.34;
  const overlapsY = top < vh * 0.72;
  if (!overlapsX || !overlapsY) return style;
  return { ...style, left: left + width / 2 < vw / 2 ? 16 : vw - width - 16 };
}
const PAD = 6;

export function Tutorial() {
  const tut = useGame((s) => s.tutorial);
  const panel = useGame((s) => s.panel?.type ?? null);
  const noteSeen = useGame((s) => s.noteSeen);
  const questions = useGame((s) => s.run?.questionCount ?? 0);
  const playing = useGame((s) => s.run?.status === "playing");
  const picked = useGame((s) => s.pickedTopic !== null);
  const inspected = useGame((s) => s.inspected.length);
  const setStep = useGame((s) => s.setTutorialStep);
  const ack = useGame((s) => s.ackTutorial);
  const showHint = useGame((s) => s.showHint);
  const cameraView = useGame((s) => s.view);
  // Wait while her newest line is still typing out (review 2, F5): about 30 ms a character, at most 5 s.
  const lastLine = useGame((s) => [...s.log].reverse().find((l) => l.who === "grandma"));
  const [quiet, setQuiet] = useState(true);
  useEffect(() => {
    if (!lastLine) return;
    setQuiet(false);
    const id = setTimeout(() => setQuiet(true), Math.min(5000, 400 + lastLine.text.length * 30));
    return () => clearTimeout(id);
  }, [lastLine?.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  const view: TutorialView | null = tut ? { panel, noteSeen, questions, picked, inspected, seen: tut.seen, acked: tut.acked } : null;
  const next = tut && view ? tutorialStep(tut.step, view) : null;
  useEffect(() => {
    if (next === null || !tut) return;
    if (next >= TUTORIAL_STEPS.length) {
      setStep(null);
      showHint(t("tutorial.done"));
    } else if (next !== tut.step) setStep(next);
  }, [next, tut, setStep, showHint]);

  const step = next !== null && next < TUTORIAL_STEPS.length ? TUTORIAL_STEPS[next] : undefined;
  // Wait while a card covers the room (a close-up, the notebook), except the note step, which points into it.
  const hidden = !playing || !step || panel !== null;
  const box = useTargetBox(hidden || !step || !view ? undefined : stepTarget(step, view));
  if (hidden || !step || next === null || (!quiet && step.id !== "note")) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // The bubble goes under the target if there's room, else above it; centred on it, kept on screen.
  const width = Math.min(BUBBLE_W, vw - 24);
  let style: React.CSSProperties = { width, left: (vw - width) / 2, top: vh * 0.3 };
  if (box) {
    const left = Math.min(Math.max(12, box.x + box.w / 2 - width / 2), vw - width - 12);
    // Never over the chat (her answer appears there) or the view tabs (review F7): a target in the bottom
    // panel gets the bubble above the whole panel; a target up top gets it below the tabs.
    const bottomTop = document.querySelector(".hud .bottom")?.getBoundingClientRect().top ?? vh;
    const tabsBottom = document.querySelector(".view-tabs")?.getBoundingClientRect().bottom ?? 0;
    if (box.y >= bottomTop - 4) style = { width, left, bottom: vh - bottomTop + 12 };
    else {
      const below = Math.max(box.y + box.h + PAD + 12, step.id === "look" ? 0 : tabsBottom + 10);
      style = below + 170 < vh ? { width, left, top: below } : { width, left, bottom: vh - box.y + PAD + 12 };
    }
  }
  return (
    <div className="tutorial" aria-live="polite">
      {box && <div className="tutorial-ring" style={{ left: box.x - PAD, top: box.y - PAD, width: box.w + PAD * 2, height: box.h + PAD * 2 }} />}
      <div className="tutorial-bubble" style={awayFromGrandma(style, width, vw, vh, cameraView === "grandma")} role="note">
        <small>{t("tutorial.progress", { n: next + 1, total: TUTORIAL_STEPS.length })}</small>
        <p>{t(`tutorial.${step.id}`)}</p>
        <div className="tutorial-actions">
          {step.ack && (
            <button onClick={() => ack(step.id)}>
              {t("tutorial.gotIt")}
            </button>
          )}
          <button className="ghost" onClick={() => setStep(null)}>
            {t("tutorial.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
