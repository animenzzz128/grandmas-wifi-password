/**
 * Topic cards (ported from the Godot edition): the note's parts (yellow, handwritten) and every name Grandma has
 * mentioned or a clue has shown. Tap one, then "Tell me about it" or "When was that?". Typing a question still
 * works next to them; the cards are the phone-friendly way in, and they show what the player knows.
 */
import { useEffect, useRef } from "react";
import { useGame } from "../store.ts";
import { t } from "../strings.ts";
import { Smudged } from "./Smudged.tsx";

export function CardStrip() {
  const run = useGame((s) => s.run);
  const picked = useGame((s) => s.pickedTopic);
  const busy = useGame((s) => s.busy);
  const pickTopic = useGame((s) => s.pickTopic);
  const askTopic = useGame((s) => s.askTopic);
  const strip = useRef<HTMLDivElement>(null);
  const count = run?.topics.length ?? 0;
  const prev = useRef(count);
  // A new card slides in at the end: scroll it into view.
  useEffect(() => {
    if (count > prev.current) strip.current?.scrollTo({ left: strip.current.scrollWidth, behavior: "smooth" });
    prev.current = count;
  }, [count]);
  const lastAsked = useGame((s) => s.lastTopic);
  if (!run || run.status !== "playing") return null;
  const card = run.topics.find((c) => c.id === picked);
  const cost = (id: string) => (id === lastAsked ? 5 : 8);
  return (
    // A mouse press here mustn't take focus from the question box: the chat log would collapse, the cards would
    // jump down under the pointer, and the click would land on nothing (review 2, F1). Keyboard focus still works.
    <div className="cards" aria-label={t("cards.label")} onMouseDown={(e) => e.preventDefault()}>
      {card && (
        <div className="card-ask" role="group" aria-label={card.label}>
          <span className="card-ask-label">{card.kind === "note" ? <>“<Smudged text={card.label} />”</> : card.label}</span>
          {card.readable ? (
            <>
              <button disabled={busy} onClick={() => void askTopic(card.id, "about")}>
                {t("cards.about")} <small>−{cost(card.id)} {t("hud.tea").toLowerCase()}</small>
              </button>
              <button className="secondary" disabled={busy} onClick={() => void askTopic(card.id, "when")}>
                {t("cards.when")} <small>−{cost(card.id)}</small>
              </button>
            </>
          ) : (
            <button className="secondary" disabled={busy} onClick={() => void askTopic(card.id, "about")}>
              {t("cards.smudged")}
            </button>
          )}
          <button className="ghost close-x" aria-label={t("close")} onClick={() => pickTopic(null)}>
            ×
          </button>
        </div>
      )}
      <div className="card-strip" ref={strip} role="listbox" aria-label={t("cards.label")}>
        {run.topics.map((c) => (
          <button
            key={c.id}
            role="option"
            aria-selected={c.id === picked}
            className={`topic ${c.kind} ${c.id === picked ? "picked" : ""} ${c.fresh ? "fresh" : ""}`}
            onClick={(e) => {
              pickTopic(c.id === picked ? null : c.id);
              // Picked with the keyboard (a click with no pointer): focus its first ask button (review 3, F1).
              if (e.detail === 0 && c.id !== picked) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".card-ask button")?.focus());
            }}
          >
            {c.fresh && <span className="new-badge">{t("cards.newBadge")}</span>}
            {c.kind === "note" ? <>“<Smudged text={c.label} />”</> : c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
