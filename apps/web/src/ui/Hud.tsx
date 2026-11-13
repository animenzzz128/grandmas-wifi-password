/** HTML overlay on top of the 3D canvas. Text comes from data/i18n via t(). */
import { useEffect, useRef, useState } from "react";
import { useGame } from "../store.ts";
import type { Carrying } from "../store.ts";
import { t } from "../strings.ts";
import { babble, chime, toggleMute } from "../audio.ts";
import { SettingsCard } from "./Settings.tsx";

function Teacup() {
  const run = useGame((s) => s.run)!;
  const pct = Math.max(0, Math.min(100, (run.stamina / run.maxStamina) * 100));
  return (
    <div className="hud-panel stats">
      <div className="tea">
        <span>☕ {t("hud.tea")}</span>
        <div className="tea-bar">
          <div className="tea-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="num">{run.stamina}</span>
      </div>
      <div className="stat-row">
        <span>{t("hud.questions", { n: run.questionCount })}</span>
        <span>{t("hud.naps", { n: run.naps, max: run.maxNaps })}</span>
        <span>{t("hud.cookies", { n: run.cookies })}</span>
        <span>{t("router.attempts", { n: run.attemptsLeft })}</span>
      </div>
    </div>
  );
}

/** Which Grandma is running. Developer info only: players never see it. */
function ModeBadge() {
  const health = useGame((s) => s.health);
  if (!health || !import.meta.env.DEV) return null;
  return <div className="badge">{health.grandmaMode === "mock" ? t("mode.mock") : t("mode.llm", { model: health.model ?? "" })}</div>;
}

function PinnedNote() {
  const run = useGame((s) => s.run)!;
  const seen = useGame((s) => s.noteSeen);
  if (!seen) return null;
  return (
    <div className="sticky pinned">
      <div>{run.note.text}</div>
      <small>
        {run.note.rules.join(" · ")} · {t("note.length", { n: run.passwordLength })}
      </small>
    </div>
  );
}

/** The label of whatever the player is carrying, if anything. */
function useCarriedLabel(): string | null {
  const carrying = useGame((s) => s.carrying);
  const scene = useGame((s) => s.scene);
  if (!carrying) return null;
  if (carrying.kind === "cookie") return t("carry.cookieLabel");
  return scene?.interactables.find((i) => i.id === carrying.objectId)?.label ?? null;
}

/** What pressing E on the focused object will do, in words. */
function promptFor(kind: string, label: string, carrying: Carrying, carriedLabel: string | null, near: boolean): string {
  if (kind === "grandma" && carrying && carriedLabel) {
    if (!near) return t("prompt.grandmaCloser", { label: carriedLabel });
    return carrying.kind === "cookie" ? t("prompt.grandmaCookie") : t("prompt.grandmaShow", { label: carriedLabel });
  }
  return t(`prompt.${kind}`, { label });
}

function Crosshair() {
  const locked = useGame((s) => s.locked);
  const focusId = useGame((s) => s.focusId);
  const scene = useGame((s) => s.scene);
  const panel = useGame((s) => s.panel);
  const talking = useGame((s) => s.talking);
  const carrying = useGame((s) => s.carrying);
  const near = useGame((s) => s.nearGrandma);
  const learned = useGame((s) => s.controlsLearned);
  const carriedLabel = useCarriedLabel();
  const it = scene?.interactables.find((i) => i.id === focusId);
  if (panel || talking) return null;
  return (
    <>
      <div className={`crosshair ${it ? "on" : ""}`} />
      {it && <div className="prompt">{promptFor(it.kind, it.label, carrying, carriedLabel, near)}</div>}
      {!locked &&
        (learned ? (
          <div className="look-hint">{t("clickToLook")}</div>
        ) : (
          <div className="look-hint">
            {t("clickToLook")}
            <br />
            <small>{t("controls")}</small>
          </div>
        ))}
    </>
  );
}

/** First-visit objectives, ticked off as the player does them (onboarding by doing). */
function Objectives() {
  const run = useGame((s) => s.run)!;
  const noteSeen = useGame((s) => s.noteSeen);
  const inspected = useGame((s) => s.inspected);
  const steps = [
    { done: noteSeen, label: t("goal.note") },
    { done: run.questionCount > 0, label: t("goal.ask") },
    { done: inspected.some((id) => id !== "cookie_jar"), label: t("goal.proof") },
    { done: run.attemptsLeft < run.maxNaps || run.status === "solved", label: t("goal.router") },
  ];
  if (steps.every((s) => s.done)) return null;
  return (
    <div className="hud-panel objectives">
      {steps.map((s) => (
        <div key={s.label} className={s.done ? "done" : ""}>
          {s.done ? "☑" : "☐"} {s.label}
        </div>
      ))}
    </div>
  );
}

/** Tab: everything the player has learned so far, grouped, with the sentence it came from. */
function NotebookCard() {
  const run = useGame((s) => s.run)!;
  const notebook = useGame((s) => s.notebook);
  const openPanel = useGame((s) => s.openPanel);
  const groups = (["name", "year", "place", "number"] as const).map((kind) => ({ kind, items: notebook.filter((n) => n.kind === kind) }));
  return (
    <div className="card notebook-card">
      <h3>{t("notebook.title")}</h3>
      <p className="riddle">{run.note.text}</p>
      {notebook.length === 0 && <p>{t("notebook.empty")}</p>}
      {groups.map(
        (g) =>
          g.items.length > 0 && (
            <div key={g.kind} className="group">
              <h4>{t(`notebook.${g.kind}`)}</h4>
              {g.items.map((n) => (
                <div key={n.value} className="entry" title={n.source}>
                  <b>{n.value}</b> <span>{n.from === "object" ? "🔎" : "👵"} {n.source}</span>
                </div>
              ))}
            </div>
          ),
      )}
      <button className="ghost" onClick={() => openPanel(null)}>
        {t("close")}
      </button>
    </div>
  );
}

/** Plays sounds for game events: Grandma's lines, notebook entries, router results. M toggles sound. */
function AudioDirector() {
  const lastSeq = useGame((s) => s.log.at(-1)?.seq ?? 0);
  const notes = useGame((s) => s.notebook.length);
  const status = useGame((s) => s.run?.status);
  const attempts = useGame((s) => s.run?.attemptsLeft ?? 0);
  const prev = useRef({ seq: lastSeq, notes, status, attempts });
  useEffect(() => {
    const p = prev.current;
    if (lastSeq !== p.seq) {
      const line = useGame.getState().log.at(-1);
      if (line?.who === "grandma") babble(line.text, line.mood);
    }
    if (notes > p.notes) chime("note");
    if (status === "solved" && p.status !== "solved") chime("success");
    else if (attempts < p.attempts) chime("fail");
    prev.current = { seq: lastSeq, notes, status, attempts };
  }, [lastSeq, notes, status, attempts]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (e.code !== "KeyM" || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      useGame.getState().showHint(toggleMute() ? t("audio.muted") : t("audio.on"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return null;
}

/** A short message that fades after a few seconds. */
function HintToast() {
  const hint = useGame((s) => s.hint);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!hint) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2600);
    return () => clearTimeout(id);
  }, [hint]);
  return visible && hint ? <div className="hint-toast">{hint.text}</div> : null;
}

/** "Carrying: the old sled · E on Grandma to show her · Q to put it back" */
function CarryHint() {
  const carrying = useGame((s) => s.carrying);
  const label = useCarriedLabel();
  if (!carrying || !label) return null;
  return <div className="carry">{carrying.kind === "cookie" ? t("carry.cookie") : t("carry.clue", { label })}</div>;
}

/** F3: frames per second and worst frame time, measured in the browser (for diagnosing "laggy" reports). */
function FpsMeter() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === "F3") {
        e.preventDefault();
        setOn((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let frames = 0;
    let worst = 0;
    let last = performance.now();
    let windowStart = last;
    const tick = (now: number) => {
      frames++;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - windowStart >= 500) {
        if (ref.current) ref.current.textContent = t("hud.fps", { fps: Math.round((frames * 1000) / (now - windowStart)), worst: Math.round(worst) });
        frames = 0;
        worst = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return on ? <div className="fps" ref={ref} /> : null;
}

function ChatLog() {
  const log = useGame((s) => s.log);
  const busy = useGame((s) => s.busy);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log, busy]);
  return (
    <div className="chat-log" ref={ref}>
      {log.map((l, i) => (
        <div key={i} className={`line ${l.who}`}>
          {l.who === "grandma" ? "👵 " : l.who === "player" ? "🧑 " : ""}
          {l.text}
          {l.cost ? <span className="cost">{t("ask.cost", { cost: l.cost })}{l.costWhy ? ` (${l.costWhy})` : ""}</span> : null}
        </div>
      ))}
      {busy && <div className="line system">{t("ask.thinking")}</div>}
    </div>
  );
}

function AskBar() {
  const [text, setText] = useState("");
  const ask = useGame((s) => s.ask);
  const busy = useGame((s) => s.busy);
  const tick = useGame((s) => s.chatFocusTick);
  const talking = useGame((s) => s.talking);
  const setTalking = useGame((s) => s.setTalking);
  const playing = useGame((s) => s.run?.status === "playing");
  const inEarshot = useGame((s) => s.inEarshot);
  const input = useRef<HTMLInputElement>(null);
  // Take focus only when asked *after* mounting (E on Grandma, Enter). On a new visit the tick is
  // already non-zero, and grabbing focus then would make WASD type into the box.
  const seenTick = useRef(tick);
  useEffect(() => {
    if (tick !== seenTick.current) {
      seenTick.current = tick;
      input.current?.focus();
    }
  }, [tick]);
  useEffect(() => () => setTalking(false), [setTalking]);
  const submit = async () => {
    const q = text.trim();
    if (!q || busy) return;
    setText("");
    await ask(q);
    input.current?.focus();
  };
  return (
    <form
      className={`ask-bar ${talking ? "talking" : ""}`}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        ref={input}
        value={text}
        maxLength={280}
        disabled={!playing || (!inEarshot && !talking)}
        placeholder={inEarshot || talking ? t("ask.placeholder") : t("ask.placeholderFar")}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setTalking(true)}
        onBlur={() => setTalking(false)}
      />
      <button disabled={busy || !text.trim() || !playing}>{t("ask.send")}</button>
      {talking && <div className="talk-mode">{t("talk.mode")}</div>}
    </form>
  );
}

function InspectCard({ objectId }: { objectId: string }) {
  const scene = useGame((s) => s.scene);
  const run = useGame((s) => s.run)!;
  const carrying = useGame((s) => s.carrying);
  const { take, openPanel } = useGame();
  const it = scene?.interactables.find((i) => i.id === objectId);
  if (!it) return null;
  const holdingThis = carrying?.kind === "clue" && carrying.objectId === it.id;
  const holdingCookie = carrying?.kind === "cookie";
  return (
    <div className="card">
      <h3 className="cap">{it.label}</h3>
      <p>{it.inspect_text}</p>
      {it.kind === "cookie_jar" ? (
        <button disabled={run.cookies <= 0 || holdingCookie} onClick={() => take({ kind: "cookie" })}>
          {run.cookies <= 0 ? t("cookie.none") : holdingCookie ? t("cookie.holding") : t("cookie.take")}
        </button>
      ) : (
        <button disabled={holdingThis} onClick={() => take({ kind: "clue", objectId: it.id })}>
          {holdingThis ? t("inspect.holding") : t("inspect.take")}
        </button>
      )}
      <button className="ghost" onClick={() => openPanel(null)}>
        {t("close")}
      </button>
    </div>
  );
}

function NoteCard() {
  const run = useGame((s) => s.run)!;
  const openPanel = useGame((s) => s.openPanel);
  return (
    <div className="card note-card">
      <h3>{t("note.title")}</h3>
      <div className="sticky big">
        <div>{run.note.text}</div>
        <small>
          {run.note.rules.join(" · ")} · {t("note.length", { n: run.passwordLength })}
        </small>
      </div>
      <button className="ghost" onClick={() => openPanel(null)}>
        {t("close")}
      </button>
    </div>
  );
}

/** One box per part of the note ([name] + [year] + !). The game assembles and formats the password. */
function RouterCard() {
  const run = useGame((s) => s.run)!;
  const { guess, openPanel, busy } = useGame();
  const [parts, setParts] = useState<string[]>(() => Array.from({ length: run.slots }, () => ""));
  const [feedback, setFeedback] = useState<string | null>(null);
  const ready = parts.every((p) => p.trim());
  return (
    <div className="card router-card">
      <h3>{t("router.title", { ssid: `${(run.grandma.name.split(" ").at(-1) ?? "HOME").toUpperCase()}_HOME` })}</h3>
      <form
        className="slots"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready) return;
          const res = await guess(parts.map((p) => p.trim()));
          if (!res || res.correct) return;
          setFeedback(t("router.partial", { n: res.partsCorrect ?? 0, total: res.partsTotal ?? run.slots }));
        }}
      >
        {parts.map((p, i) => (
          <span key={i} className="slot">
            {i > 0 && <span className="plus">+</span>}
            <input
              className={feedback ? "wrong" : ""}
              value={p}
              maxLength={40}
              autoFocus={i === 0}
              placeholder={t("router.slot", { n: i + 1 })}
              onChange={(e) => {
                const next = [...parts];
                next[i] = e.target.value;
                setParts(next);
                setFeedback(null);
              }}
            />
          </span>
        ))}
        {run.suffix && <span className="suffix">+ {run.suffix}</span>}
        <button disabled={busy || !ready}>{t("router.connect")}</button>
      </form>
      {feedback && <p className="partial">{feedback}</p>}
      <p>
        {t("router.attempts", { n: run.attemptsLeft })} · {t("router.formatted")}
      </p>
      <button className="ghost" onClick={() => openPanel(null)}>
        {t("close")}
      </button>
    </div>
  );
}

function ResultCard() {
  const run = useGame((s) => s.run)!;
  const leave = useGame((s) => s.leave);
  const [copied, setCopied] = useState(false);
  const r = run.result;
  if (!r) return null;
  const title = r.solved ? t("result.solved") : run.status === "bedtime" ? t("result.bedtime") : t("result.failed");
  const stars = "⭐".repeat(r.stars) || "—";
  const card = t("result.card", {
    name: run.grandma.nickname ?? run.grandma.name,
    difficulty: t(`difficulty.${run.difficulty}`),
    outcome: r.solved ? t("result.cardSolved", { n: r.questions }) : t("result.cardFailed", { n: r.questions }),
    cups: "☕".repeat(Math.min(r.questions, 12)),
    naps: r.naps,
    cookies: r.cookiesUsed,
    stars,
  });
  return (
    <div className="modal">
      <div className="card result">
        <h2>{title}</h2>
        <div className="stars">{stars}</div>
        {run.relaxed && <p className="hint">{t("result.relaxed")}</p>}
        <p>{t("result.password", { password: r.password })}</p>
        <pre>{card}</pre>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(card).then(() => setCopied(true));
          }}
        >
          {copied ? t("result.copied") : t("result.copy")}
        </button>
        <button className="ghost" onClick={leave}>
          {t("result.again")}
        </button>
      </div>
    </div>
  );
}

export function Hud() {
  const panel = useGame((s) => s.panel);
  const error = useGame((s) => s.error);
  const run = useGame((s) => s.run);
  const talking = useGame((s) => s.talking);
  if (!run) return null;
  return (
    <div className="hud">
      <div className="top-left">
        <Teacup />
        <Objectives />
        <ModeBadge />
      </div>
      <div className="top-right">
        <PinnedNote />
      </div>
      <Crosshair />
      <CarryHint />
      <HintToast />
      <AudioDirector />
      <FpsMeter />
      {panel && (
        <div className="panel-wrap">
          {panel.type === "inspect" && <InspectCard objectId={panel.objectId} />}
          {panel.type === "note" && <NoteCard />}
          {panel.type === "router" && <RouterCard />}
          {panel.type === "notebook" && <NotebookCard />}
          {panel.type === "settings" && <SettingsCard onClose={() => useGame.getState().openPanel(null)} />}
        </div>
      )}
      <div className={`bottom ${talking ? "side" : ""}`}>
        {error && <div className="error">{error}</div>}
        <ChatLog />
        <AskBar />
      </div>
      {run.status !== "playing" && <ResultCard />}
    </div>
  );
}
