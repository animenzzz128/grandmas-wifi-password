/**
 * Moving around and the game's buttons (ported from the Godot edition's UI): view tabs across the top, the
 * note / notebook / router / pause buttons, a label for what the pointer is over, and the keyboard shortcuts.
 *
 * Keys (never while typing, except Esc): 1–7 views · N note · J notebook · R router · Enter talk ·
 * V ask out loud · O settings · H things here · Esc backs out one layer (card → picked topic → talk).
 */
import { useEffect, useState } from "react";
import { useGame } from "../store.ts";
import { t } from "../strings.ts";
import { keyLabel, useSettings } from "../settings.ts";

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

/**
 * "Things here" (iteration 56): H, or the button after the view tabs, lists what can be looked at in this view
 * as buttons. A keyboard (or screen-reader) player had no way to open anything in the room, and a player who
 * can't spot the sparkles gets the same help: the hotspot reveal of point-and-click adventures.
 */
export function ThingsHere() {
  const open = useGame((s) => s.thingsOpen);
  const view = useGame((s) => s.view);
  const scene = useGame((s) => s.scene);
  const tap = useGame((s) => s.tapObject);
  const [first, setFirst] = useState<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (open) first?.focus();
  }, [open, first]);
  if (!scene) return null;
  const here = scene.interactables.filter((i) => i.view === view && i.kind !== "grandma");
  return (
    <div className="things-here">
      <button className="ghost things-toggle" aria-expanded={open} onClick={() => useGame.setState({ thingsOpen: !open })} title={`${t("things.title")} (H)`}>
        {t("things.title")}
      </button>
      {open && (
        <div className="things-list" role="group" aria-label={t("things.title")}>
          {here.length ? (
            here.map((it, i) => (
              <button key={it.id} ref={i === 0 ? setFirst : undefined} onClick={() => tap(it.id)}>
                {it.label.charAt(0).toUpperCase() + it.label.slice(1)}
              </button>
            ))
          ) : (
            <span>{t("things.none")}</span>
          )}
        </div>
      )}
    </div>
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
      <button className="secondary btn-notebook" onClick={() => openPanel({ type: "notebook" })} title={`${t("buttons.notebook")} (${keyLabel(useSettings.getState().keys.notebook)})`}>
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
      // An open card keeps the keyboard: Tab cycles through its own controls, never to the buttons behind it.
      if (game.panel && e.code === "Tab") {
        const wrap = document.querySelector(".panel-wrap");
        const items = wrap ? [...wrap.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex='-1'])")] : [];
        if (items.length) {
          const at = items.indexOf(document.activeElement as HTMLElement);
          const next = at < 0 ? 0 : (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
          e.preventDefault();
          items[next]!.focus();
          return;
        }
      }
      if (isTyping() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      // Enter or Space on a focused button presses that button, never a game shortcut (iteration 56: Enter on a
      // "Things here" item went to Grandma's chat instead of opening the item).
      if ((e.code === "Enter" || e.code === "NumpadEnter" || e.code === "Space") && document.activeElement instanceof HTMLButtonElement) return;
      if (game.run?.status !== "playing") return;
      // The key that opened the note or the notebook closes it again (review F12): N for the note, the notebook
      // key for the notebook. Not Tab, though: inside a card Tab moves between its buttons.
      const bindNow = useSettings.getState().keys;
      if (game.panel?.type === "note" && e.code === "KeyN") {
        e.preventDefault();
        game.openPanel(null);
        return;
      }
      if (game.panel?.type === "notebook" && e.code === bindNow.notebook && e.code !== "Tab") {
        e.preventDefault();
        game.openPanel(null);
        return;
      }
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
      } else if (e.code === bind.notebook && e.code !== "Tab") {
        // Tab is never a game key: it moves keyboard focus (review 3, F1).
        e.preventDefault();
        game.openPanel({ type: "notebook" });
      } else if (e.code === "KeyR") {
        e.preventDefault();
        game.openPanel({ type: "router" });
      } else if (e.code === "KeyH") {
        e.preventDefault();
        useGame.setState((s) => ({ thingsOpen: !s.thingsOpen }));
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
