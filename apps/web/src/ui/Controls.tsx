/**
 * Moving around and the game's buttons (ported from the Godot edition's UI): view tabs across the top, the
 * note / notebook / router / pause buttons, a label for what the pointer is over, and the keyboard shortcuts.
 *
 * Keys (never while typing, except Esc): 1–7 views · N note · Tab notebook · R router · Enter talk ·
 * V ask out loud · O settings · Esc backs out one layer (card → picked topic → talk).
 */
import { useEffect } from "react";
import { useGame } from "../store.ts";
import { t } from "../strings.ts";
import { useSettings } from "../settings.ts";

function isTyping(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement;
}

/** The order views appear in the tabs (and keys 1–7). */
const TAB_ORDER = ["grandma", "table", "sideboard", "tv", "hall", "kitchen", "room"];

export function useViews() {
  const scene = useGame((s) => s.scene);
  const views = scene?.views ?? [];
  return TAB_ORDER.map((id) => views.find((v) => v.id === id)).filter((v): v is NonNullable<typeof v> => Boolean(v));
}

export function ViewTabs() {
  const view = useGame((s) => s.view);
  const goView = useGame((s) => s.goView);
  const views = useViews();
  const current = view.startsWith("focus:") ? "" : view;
  return (
    <nav className="view-tabs" aria-label={t("views.label")}>
      {views.map((v, i) => (
        <button key={v.id} className={v.id === current ? "on" : ""} aria-pressed={v.id === current} title={`${v.label} (${i + 1})`} onClick={() => goView(v.id)}>
          {t(`views.${v.id}`)}
        </button>
      ))}
    </nav>
  );
}

export function TopButtons() {
  const openPanel = useGame((s) => s.openPanel);
  const noteSeen = useGame((s) => s.noteSeen);
  return (
    <div className="top-buttons">
      <button className={`btn-note ${noteSeen ? "" : "attention"}`} onClick={() => openPanel({ type: "note" })} title={`${t("buttons.note")} (N)`}>
        {t("buttons.note")}
      </button>
      <button className="secondary" onClick={() => openPanel({ type: "notebook" })} title={`${t("buttons.notebook")} (Tab)`}>
        {t("buttons.notebook")}
      </button>
      <button className="btn-router" onClick={() => openPanel({ type: "router" })} title={`${t("buttons.router")} (R)`}>
        {t("buttons.router")}
      </button>
      <button className="secondary icon" aria-label={t("settings.title")} title={`${t("settings.title")} (O)`} onClick={() => openPanel({ type: "settings" })}>
        ⚙
      </button>
    </div>
  );
}

/** What the pointer is over, and what tapping it does. */
export function HoverLabel() {
  const focusId = useGame((s) => s.focusId);
  const scene = useGame((s) => s.scene);
  const panel = useGame((s) => s.panel);
  const it = scene?.interactables.find((i) => i.id === focusId);
  if (!it || panel) return null;
  return <div className="hover-label">{t(`tap.${it.kind}`, { label: it.label })}</div>;
}

export function KeyboardControls() {
  const views = useViews();
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const game = useGame.getState();
      if (e.code === "Escape") {
        if (game.back()) e.preventDefault();
        else if (game.pickedTopic) game.pickTopic(null);
        return;
      }
      if (isTyping() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (game.run?.status !== "playing") return;
      // With a card open, keys keep their usual jobs (Tab between buttons, Space to press).
      if (game.panel) return;
      const digit = /^Digit([1-9])$/.exec(e.code)?.[1];
      if (digit) {
        const v = views[Number(digit) - 1];
        if (v) {
          e.preventDefault();
          game.goView(v.id);
        }
        return;
      }
      const bind = useSettings.getState().keys;
      // preventDefault: the key that opens a box must never type into it.
      if (e.code === "KeyN") {
        e.preventDefault();
        game.openPanel({ type: "note" });
      } else if (e.code === bind.notebook || e.code === "Tab") {
        e.preventDefault();
        game.openPanel({ type: "notebook" });
      } else if (e.code === "KeyR") {
        e.preventDefault();
        game.openPanel({ type: "router" });
      } else if (e.code === "KeyO") {
        e.preventDefault();
        game.openPanel({ type: "settings" });
      } else if (e.code === bind.speak) {
        e.preventDefault();
        useGame.setState((s) => ({ voiceTick: s.voiceTick + 1 }));
      } else if (e.code === "Enter") {
        e.preventDefault();
        game.goView("grandma");
        game.focusChat();
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [views]);
  return null;
}
