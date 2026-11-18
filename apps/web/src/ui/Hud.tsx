/** HTML overlay on top of the 3D canvas. Text comes from data/i18n via t(). */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGame } from "../store.ts";
import { api } from "../api.ts";
import { t } from "../strings.ts";
import { babble, chime, snore, startClock, startMusic, stopClock, stopMusic, toggleMute } from "../audio.ts";
import { canListen, listen, speak, stopSpeaking } from "../voice.ts";
import { useSettings } from "../settings.ts";
import { SettingsCard } from "./Settings.tsx";
import { CardStrip } from "./Cards.tsx";
import { Smudged } from "./Smudged.tsx";
import { HoverLabel, KeyboardControls, TopButtons, ViewTabs } from "./Controls.tsx";
import { saveNoteStars } from "../noteStars.ts";
import { ExamineCard } from "./Examine.tsx";
import { saveDailyRecord } from "../daily.ts";
import { revealPlan, typedLength } from "../typeout.ts";

function Teacup() {
  const run = useGame((s) => s.run)!;
  const pct = Math.max(0, Math.min(100, (run.stamina / run.maxStamina) * 100));
  return (
    <div className="hud-panel stats">
      <div className="tea">
        <span className="cup" aria-hidden="true">
          <span className="cup-fill" style={{ height: `${pct}%` }} />
        </span>
        <span>{t("hud.tea")}</span>
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
      <div><Smudged text={run.note.text} /></div>
      <small>
        {run.note.rules.join(" · ")} · {t("note.length", { n: run.passwordLength })}
      </small>
    </div>
  );
}

/** One line under the view tabs saying how to play, until the player has asked and looked at something. */
function HowLine() {
  const asked = useGame((s) => (s.run?.questionCount ?? 0) > 0);
  const looked = useGame((s) => s.inspected.length > 0);
  if (asked && looked) return null;
  return <div className="how-line">{t("hud.how")}</div>;
}

/** First-visit objectives, ticked off as the player does them (onboarding by doing). */
function Objectives() {
  const run = useGame((s) => s.run)!;
  const noteSeen = useGame((s) => s.noteSeen);
  const inspected = useGame((s) => s.inspected);
  const steps = [
    { done: noteSeen, label: t("goal.note") },
    { done: run.questionCount > 0, label: t("goal.ask") },
    { done: inspected.length > 0, label: t("goal.proof") },
    { done: run.attemptsLeft < run.maxAttempts || run.status === "solved", label: t("goal.router") },
  ];
  if (run.status !== "playing" || steps.every((s) => s.done)) return null;
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
  const pins = useGame((s) => s.pins);
  const unpin = useGame((s) => s.unpin);
  const openPanel = useGame((s) => s.openPanel);
  const groups = (["name", "year", "place", "number"] as const).map((kind) => ({ kind, items: notebook.filter((n) => n.kind === kind) }));
  return (
    <div className="card notebook-card">
      <h3 id="panel-title">{t("notebook.title")}</h3>
      <p className="riddle"><Smudged text={run.note.text} /></p>
      {pins.length > 0 && (
        <div className="group pins">
          <h4>{t("notebook.pinned")}</h4>
          {pins.map((p, i) => (
            <div key={p} className="entry pin">
              📌 <span>{p}</span>
              <button className="ghost unpin" title={t("notebook.unpin")} aria-label={t("notebook.unpin")} onClick={() => unpin(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {notebook.length === 0 && pins.length === 0 && <p>{t("notebook.empty")}</p>}
      {pins.length === 0 && <p className="hint">{t("notebook.pinHint")}</p>}
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

/** Room ambience and Grandma's snoring (GDD §8.2–8.3). Text carries the same information (the "z z z" bubble). */
function Ambience() {
  const playing = useGame((s) => s.run?.status === "playing");
  const roomSound = useSettings((s) => s.roomSound);
  const stamina = useGame((s) => s.run?.stamina ?? 100);
  const status = useGame((s) => s.run?.status);
  const busy = useGame((s) => s.busy);
  const speaking = useGame((s) => s.grandmaSpeaking);
  const dozing = (stamina <= 20 || status === "bedtime") && !busy && !speaking;
  useEffect(() => {
    if (!playing || !roomSound) return;
    startClock();
    return stopClock;
  }, [playing, roomSound]);
  const musicOn = useSettings((s) => s.musicVolume > 0);
  useEffect(() => {
    if (!playing || !musicOn) return;
    startMusic();
    return stopMusic;
  }, [playing, musicOn]);
  useEffect(() => {
    if (!dozing) return;
    const first = setTimeout(snore, 1200);
    const every = setInterval(snore, 4200);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [dozing]);
  return null;
}

/** Router confetti on a solve (GDD §8.3). Decoration only; skipped when the player prefers reduced motion. */
const CONFETTI_COLORS = ["#e8b04a", "#c0563b", "#6fa8a0", "#f3e2c0", "#8c6bb1"];
function Confetti() {
  const solved = useGame((s) => s.run?.status === "solved");
  const [pieces] = useState(() =>
    Array.from({ length: 90 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2.2 + Math.random() * 1.6,
      drift: (Math.random() - 0.5) * 160,
      spin: (Math.random() - 0.5) * 1440,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
      wide: Math.random() < 0.5,
    })),
  );
  if (!solved || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.wide ? 10 : 6,
            height: p.wide ? 6 : 12,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ["--drift" as string]: `${p.drift}px`,
            ["--spin" as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

/** Plays sounds for game events: Grandma's lines, notebook entries, router results. M toggles sound. */
function AudioDirector() {
  const lastSeq = useGame((s) => s.log.at(-1)?.seq ?? 0);
  const notes = useGame((s) => s.notebook.length);
  const status = useGame((s) => s.run?.status);
  const attempts = useGame((s) => s.run?.attemptsLeft ?? 0);
  // Starts at 0 so the greeting (already in the log when the HUD mounts) is voiced too.
  const prev = useRef({ seq: 0, notes, status, attempts });
  useEffect(() => {
    const p = prev.current;
    if (lastSeq !== p.seq) {
      // Every Grandma line since last time (a reply can come with a nap line or a nudge), as one utterance.
      const fresh = useGame.getState().log.filter((l) => l.who === "grandma" && (l.seq ?? 0) > p.seq);
      if (fresh.length) {
        const text = fresh.map((l) => l.text).join(" ");
        const mood = fresh[0]!.mood;
        const mode = useSettings.getState().voice;
        if (mode === "spoken") speak(fresh.map((l) => l.text), mood);
        else if (mode === "blips") babble(text, mood);
      }
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
      const muted = toggleMute();
      if (muted) stopSpeaking();
      useGame.getState().showHint(muted ? t("audio.muted") : t("audio.on"));
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  return null;
}

/** Voice mode: what Grandma misheard, big, for a moment (game design §8.3: "Pass the SWORD?!"). */
function MishearBanner() {
  const mishear = useGame((s) => s.mishear);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!mishear) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(id);
  }, [mishear]);
  return visible && mishear ? (
    <div className="mishear" role="status">
      {t("mishear.big", { as: mishear.as.toUpperCase() })}
    </div>
  ) : null;
}

/**
 * For screen readers: one polite live region that reads each new line from Grandma or the game (in full,
 * not as it types out) and each hint. The visible chat and toasts change too often to be live regions
 * themselves (review, iteration 40).
 */
function Announcer() {
  const log = useGame((s) => s.log);
  const hint = useGame((s) => s.hint);
  const [message, setMessage] = useState("");
  const seen = useRef(log.length);
  useEffect(() => {
    if (log.length < seen.current) seen.current = 0; // a new visit
    const fresh = log.slice(seen.current).filter((l) => l.who !== "player");
    seen.current = log.length;
    if (fresh.length) setMessage(fresh.map((l) => (l.who === "grandma" ? `${t("a11y.grandmaSays")} ${l.text}` : l.text)).join(" "));
  }, [log]);
  useEffect(() => {
    if (hint) setMessage(hint.text);
  }, [hint]);
  return (
    <div className="sr-only" role="status" aria-live="polite">
      {message}
    </div>
  );
}

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

/** One of Grandma's lines appearing word by word. A timer, not animation frames, so it also finishes in a background tab. */
function TypingText({ text, onDone, onGrow }: { text: string; onDone: () => void; onGrow: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const k = typedLength(text, performance.now() - start);
      setN(k);
      onGrow();
      if (k >= text.length) {
        clearInterval(id);
        onDone();
      }
    }, 30);
    return () => clearInterval(id);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {text.slice(0, n)}
      <span className="caret" aria-hidden="true" />
    </>
  );
}

const prefersReducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

function ChatLog() {
  const log = useGame((s) => s.log);
  const busy = useGame((s) => s.busy);
  const ref = useRef<HTMLDivElement>(null);
  const typeOut = useSettings((s) => s.typeOut) && !prefersReducedMotion();
  /** Grandma's lines up to this seq are fully shown; newer ones type out in turn. */
  const [revealed, setRevealed] = useState(() => useGame.getState().log.reduce((m, l) => Math.max(m, l.seq ?? 0), 0));
  const plan = typeOut ? revealPlan(log, revealed) : log.map(() => "full" as const);
  const showAll = () => setRevealed(log.reduce((m, l) => Math.max(m, l.seq ?? 0), 0));
  const toBottom = () => ref.current?.scrollTo({ top: ref.current.scrollHeight });
  /** A highlighted bit of Grandma's words, and where to show the pin button for it. */
  const [picked, setPicked] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [log, busy]);
  // The pin button goes away with its highlight: when the selection is cleared (a click in the room, Esc) or
  // the mouse is captured again. It used to stay floating over the room and pin stale text (review, iteration 40).
  useEffect(() => {
    if (!picked) return;
    const onChange = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) setPicked(null);
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [picked]);
  const pinIt = (text: string) => {
    const ok = useGame.getState().pin(text);
    if (ok) chime("pin");
    useGame.getState().showHint(ok ? t("notebook.pinnedHint") : t("notebook.pinSkipped"));
    window.getSelection()?.removeAllRanges();
    setPicked(null);
  };
  /** Highlighting text inside one of Grandma's lines offers a pin (game design §5). */
  const onSelect = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    const line = sel?.anchorNode?.parentElement?.closest(".line.grandma");
    if (!sel || sel.rangeCount === 0 || text.length < 3 || !line || !ref.current?.contains(line)) return setPicked(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setPicked({ text, x: r.left + r.width / 2, y: r.top });
  };
  return (
    <div className="chat-log" aria-label={t("a11y.chat")} ref={ref} onMouseUp={onSelect} onKeyUp={onSelect} onClick={() => plan.includes("typing") && showAll()} title={plan.includes("typing") ? t("chat.skipTyping") : undefined}>
      {log.map((l, i) => plan[i] === "hidden" ? null : (
        <div key={i} className={`line ${l.who}`}>
          {l.who === "grandma" ? "👵 " : l.who === "player" ? "🧑 " : l.who === "michael" ? "📞 " : ""}
          {plan[i] === "typing" ? <TypingText text={l.text} onGrow={toBottom} onDone={() => setRevealed((r) => Math.max(r, l.seq ?? 0))} /> : l.text}
          {l.cost ? <span className="cost">{t("ask.cost", { cost: l.cost })}{l.costWhy ? ` (${l.costWhy})` : ""}</span> : null}
          {l.who === "grandma" && (
            <button className="pin-line" title={t("notebook.pinLine")} aria-label={t("notebook.pinLine")} onClick={() => pinIt(l.text)}>
              📌
            </button>
          )}
        </div>
      ))}
      {busy && <div className="line system">{t("ask.thinking")}</div>}
      {/* In a portal: the chat panel is transformed, which would anchor a fixed button to it. */}
      {picked &&
        createPortal(
          <button className="pin-pick" style={{ left: picked.x, top: picked.y }} onMouseDown={(e) => e.preventDefault()} onClick={() => pinIt(picked.text)}>
            📌 {t("notebook.pinIt")}
          </button>,
          document.body,
        )}
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
  const listening = useGame((s) => s.listening);
  const voiceTick = useGame((s) => s.voiceTick);
  const input = useRef<HTMLInputElement>(null);
  /** Ask by voice: interim words fill the box; the final words are sent. */
  const startListening = () => {
    listen({
      onInterim: (words) => setText(words),
      onFinal: (words, confidence) => {
        setText("");
        void ask(words, { confidence }).then((ok) => !ok && setText(words));
      },
      onError: (code) => useGame.getState().showHint(code === "not-allowed" ? t("talk.micDenied") : code === "unsupported" ? t("talk.micUnsupported") : t("talk.micError")),
    });
  };
  const seenVoice = useRef(voiceTick);
  useEffect(() => {
    if (voiceTick !== seenVoice.current) {
      seenVoice.current = voiceTick;
      startListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceTick]);
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
    if (!q || useGame.getState().busy) return; // live state: two quick Enters in one tick send once
    setText("");
    if (!(await ask(q))) setText(q); // didn't reach her: keep the question so Enter retries it
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
        aria-label={t("ask.label")}
        disabled={!playing}
        placeholder={listening ? t("ask.listening") : t("ask.placeholderTyped")}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          setTalking(true);
          useGame.getState().goView("grandma");
        }}
        onBlur={() => setTalking(false)}
      />
      {canListen() && (
        <button type="button" className={`mic ${listening ? "on" : ""}`} title={t("ask.mic")} disabled={!playing} onClick={startListening}>
          {listening ? "●" : "🎤"}
        </button>
      )}
      <button disabled={busy || !text.trim() || !playing}>{t("ask.send")}</button>
    </form>
  );
}

function NoteCard() {
  const run = useGame((s) => s.run)!;
  const openPanel = useGame((s) => s.openPanel);
  return (
    <div className="card note-card">
      <h3 id="panel-title">{t("note.title")}</h3>
      <div className="sticky big">
        <div><Smudged text={run.note.text} /></div>
        <small>
          {run.note.rules.join(" · ")} · {t("note.length", { n: run.passwordLength })}
        </small>
      </div>
      {run.note.smudged && <p className="hint">{t("note.smudgedHint")}</p>}
      {run.glasses && <p className="hint">{t("note.glassesHint")}</p>}
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
  /** Easy/Medium: which boxes the last try got right (green) or wrong (red); cleared when that box changes. */
  const [marks, setMarks] = useState<(boolean | null)[]>(() => parts.map(() => null));
  const ready = parts.every((p) => p.trim());
  return (
    <div className="card router-card">
      <h3 id="panel-title">{t("router.title", { ssid: `${(run.grandma.name.split(" ").at(-1) ?? "HOME").toUpperCase()}_HOME` })}</h3>
      <form
        className="slots"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!ready) return;
          const res = await guess(parts.map((p) => p.trim()));
          if (!res || res.correct) return;
          setFeedback(t("router.partial", { n: res.partsCorrect ?? 0, total: res.partsTotal ?? run.slots }));
          setMarks(res.partsRight ?? parts.map(() => false));
        }}
      >
        {parts.map((p, i) => (
          <span key={i} className="slot">
            {i > 0 && <span className="plus">+</span>}
            <input
              className={marks[i] === true ? "right" : marks[i] === false ? "wrong" : ""}
              aria-invalid={marks[i] === false ? true : undefined}
              aria-label={`${t("router.slot", { n: i + 1 })}${marks[i] === true ? ` (${t("router.partRight", { n: i + 1 })})` : ""}`}
              value={p}
              maxLength={40}
              autoFocus={i === 0}
              placeholder={t("router.slot", { n: i + 1 })}
              onChange={(e) => {
                const next = [...parts];
                next[i] = e.target.value;
                setParts(next);
                setFeedback(null);
                setMarks((m) => m.map((x, j) => (j === i ? null : x)));
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
  const [copied, setCopied] = useState<"no" | "yes" | "manual">("no");
  const preRef = useRef<HTMLPreElement>(null);
  const r = run.result;
  // The first finished visit of a daily is the one that counts; later ones are practice.
  // (`prev ?? saved`: React's dev double-run of effects must not turn the first save into "practice".)
  const [firstDaily, setFirstDaily] = useState<boolean | null>(null);
  const finished = Boolean(r);
  useEffect(() => {
    if (run.noteId && run.result?.solved) saveNoteStars(run.noteId, run.result.stars);
  }, [run.runId, finished]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run.daily || !run.result) return;
    const res = run.result;
    const saved = saveDailyRecord({ number: run.daily, solved: res.solved, stars: res.stars, questions: res.questions });
    setFirstDaily((prev) => prev ?? saved);
  }, [run.runId, finished]); // eslint-disable-line react-hooks/exhaustive-deps
  // The card needs the mouse: let go of it if the visit ended while the player was looking around.
  useEffect(() => {
    if (finished && document.pointerLockElement) document.exitPointerLock();
  }, [finished]);
  const copy = (text: string, pre: HTMLPreElement | null) => {
    const fallback = () => {
      // No clipboard (an insecure page or a refused permission): select the text so Ctrl+C works.
      if (pre) window.getSelection()?.selectAllChildren(pre);
      setCopied("manual");
    };
    if (!navigator.clipboard) return fallback();
    navigator.clipboard.writeText(text).then(() => setCopied("yes"), fallback);
  };
  if (!r) return null;
  const title = r.solved ? t("result.solved") : run.status === "bedtime" ? t("result.bedtime") : t("result.failed");
  const stars = "★".repeat(r.stars) + "☆".repeat(3 - r.stars);
  const card = t("result.card", {
    name: run.daily ? t("daily.cardName", { n: run.daily }) : (run.grandma.nickname ?? run.grandma.name),
    difficulty: t(`difficulty.${run.difficulty}`),
    outcome: r.solved ? t("result.cardSolved", { n: r.questions }) : t("result.cardFailed", { n: r.questions }),
    cups: "☕".repeat(Math.min(r.questions, 12)),
    naps: r.naps,
    cookies: r.cookiesUsed,
    stars,
  });
  return (
    <div className="modal">
      <div className="card result" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <h2 id="result-title">{title}</h2>
        <div className="stars" role="img" aria-label={t("result.starsLabel", { n: r.stars })}>
          {stars}
        </div>
        {run.relaxed && <p className="hint">{t("result.relaxed")}</p>}
        {run.daily !== undefined && firstDaily === false && <p className="hint">{t("daily.practice")}</p>}
        <p>{r.password ? t("result.password", { password: r.password }) : t("result.passwordHidden")}</p>
        <pre ref={preRef}>{card}</pre>
        {copied === "manual" && (
          <p className="hint" role="status">
            {t("result.copyManual")}
          </p>
        )}
        <button
          autoFocus
          onClick={() => {
            copy(card, preRef.current);
            api.event(run.runId, "share");
          }}
        >
          {copied === "yes" ? t("result.copied") : t("result.copy")}
        </button>
        <button onClick={() => void useGame.getState().another()}>{t("result.another", { difficulty: t(`difficulty.${run.difficulty}`) })}</button>
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
      <div className="top-center">
        <ViewTabs />
        <HowLine />
      </div>
      <div className="top-right">
        <TopButtons />
        <PinnedNote />
      </div>
      <HoverLabel />
      <KeyboardControls />
      <HintToast />
      <Announcer />
      <MishearBanner />

      <AudioDirector />
      <FpsMeter />
      {panel && (
        <div className="panel-wrap" role="dialog" aria-labelledby="panel-title">
          {panel.type === "inspect" && <ExamineCard key={panel.objectId} objectId={panel.objectId} />}
          {panel.type === "note" && <NoteCard />}
          {panel.type === "router" && <RouterCard />}
          {panel.type === "notebook" && <NotebookCard />}
          {panel.type === "settings" && <SettingsCard onClose={() => useGame.getState().openPanel(null)} />}
        </div>
      )}
      <div className={`bottom ${talking ? "side" : ""}`}>
        {error && <div className="error" role="alert">{error}</div>}
        <CardStrip />
        <div className="dialog">
          <ChatLog />
          <AskBar />
        </div>
      </div>
      <Ambience />
      <Confetti />
      {run.status !== "playing" && <ResultCard />}
    </div>
  );
}
