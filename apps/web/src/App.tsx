import { Component, Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SettingsCard } from "./ui/Settings.tsx";
import { applyTextSettings, useSettings } from "./settings.ts";
import { useGame } from "./store.ts";
import { t } from "./strings.ts";
import { dailyStreak, formatCountdown, loadDailyRecords } from "./daily.ts";
import { hasVisited } from "./firsts.ts";
import { loadNoteStars } from "./noteStars.ts";
import { Smudged } from "./ui/Smudged.tsx";

/** The 3D room and HUD are their own chunk; the title screen shows while it loads. */
const loadGame = () => import("./Game.tsx");
const Game = lazy(loadGame);

/** "12 of 30 visits today solved it, in 9 questions (median)". */
export function dailyStatsLine(s: { finished: number; solved: number; medianQuestions?: number }): string {
  const base = t("daily.stats", { solved: s.solved, finished: s.finished, pct: Math.round((100 * s.solved) / s.finished) });
  return s.medianQuestions !== undefined ? `${base} ${t("daily.statsMedian", { n: s.medianQuestions })}` : base;
}

/** Today's Daily Grandma: play it, or see how you did and when the next one comes. */
function DailyBox() {
  const daily = useGame((s) => s.daily);
  const dailyAt = useGame((s) => s.dailyAt);
  const startDaily = useGame((s) => s.startDaily);
  const busy = useGame((s) => s.busy);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const left = daily ? Math.max(0, daily.resetsInSeconds - Math.floor((now - dailyAt) / 1000)) : 1;
  useEffect(() => {
    if (daily && left === 0) useGame.getState().refreshDaily(); // a new Grandma is up
  }, [daily, left]);
  if (!daily) return null;
  const records = loadDailyRecords();
  const rec = records[daily.number];
  const streak = dailyStreak(records, daily.number);
  const vars = { n: daily.number, difficulty: t(`difficulty.${daily.difficulty}`), name: daily.grandma.nickname ?? daily.grandma.name };
  return (
    <div className="daily-box">
      <button className="secondary" disabled={busy} onClick={() => void startDaily()}>
        {rec ? t("daily.again", vars) : t("daily.play", vars)}
      </button>
      {rec && (
        <p className="daily-status">
          {rec.solved ? t("daily.solved", { stars: "★".repeat(rec.stars), n: rec.questions }) : t("daily.failed")} · {t("daily.next", { time: formatCountdown(left) })}
        </p>
      )}
      {streak > 1 && <p className="daily-status">{t("daily.streak", { n: streak })}</p>}
      {daily.stats && <p className="daily-status">{dailyStatsLine(daily.stats)}</p>}
    </div>
  );
}

/** Stars as text with a spoken label (never colour alone). */
function Stars({ n, of = 3 }: { n: number; of?: number }) {
  return (
    <span className="note-stars" role="img" aria-label={t("result.starsLabel", { n })}>
      {"★".repeat(n)}
      <span className="dim">{"☆".repeat(Math.max(0, of - n))}</span>
    </span>
  );
}

/** "Which sticky note today?" Every note, Easy first, with your best stars (ported from the Godot edition). */
function NotePicker({ onBack }: { onBack: () => void }) {
  const notes = useGame((s) => s.notes);
  const startNote = useGame((s) => s.startNote);
  const busy = useGame((s) => s.busy);
  const [stars] = useState(loadNoteStars);
  return (
    <div className="picker" role="dialog" aria-labelledby="picker-title">
      <div className="picker-head">
        <div>
          <h2 id="picker-title">{t("title.pick")}</h2>
          <p className="picker-help">{t("title.pickHelp")}</p>
        </div>
        <button className="secondary" onClick={onBack}>
          {t("title.back")}
        </button>
      </div>
      <div className="note-grid">
        {(notes ?? []).map((n, i) => (
          <button key={n.id} className={`note-choice ${n.difficulty}`} disabled={busy} autoFocus={i === 0} onClick={() => void startNote(n.id)} style={{ ["--tilt" as string]: `${((i * 37) % 5) - 2}deg` }}>
            <span className="note-meta">
              <span>{t(`difficulty.${n.difficulty}`)}</span>
              <Stars n={stars[n.id] ?? 0} />
            </span>
            <span className="note-text">
              {n.text.split("+").map((p, k) => (
                <span key={k}>
                  {k > 0 && "+ "}
                  <Smudged text={p.trim()} />
                </span>
              ))}
            </span>
          </button>
        ))}
        {notes === null && <p>{t("loading.door")}</p>}
      </div>
      <DailyBox />
    </div>
  );
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="card howto" role="dialog" aria-labelledby="howto-title">
      <h3 id="howto-title">{t("howto.title")}</h3>
      <ol>
        <li>{t("howto.1")}</li>
        <li>{t("howto.2")}</li>
        <li>{t("howto.3")}</li>
        <li>{t("howto.4")}</li>
        <li>{t("howto.5")}</li>
      </ol>
      <p className="hint">{t("howto.keys")}</p>
      <button autoFocus onClick={onClose}>
        {t("close")}
      </button>
    </div>
  );
}

/** The title over the live room (the camera drifts behind it), as in the Godot edition. */
function TitleScreen() {
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  const health = useGame((s) => s.health);
  const start = useGame((s) => s.start);
  const [step, setStep] = useState<"home" | "pick">("home");
  const [panel, setPanel] = useState<"settings" | "howto" | null>(null);
  const [firstVisit] = useState(() => !hasVisited());
  return (
    <div className="title-screen over-room">
      {panel && (
        <div className="panel-wrap" role="dialog" aria-labelledby="panel-title">
          {panel === "settings" ? <SettingsCard onClose={() => setPanel(null)} /> : <HowToPlay onClose={() => setPanel(null)} />}
        </div>
      )}
      {step === "home" ? (
        <div className="title-column">
          <p className="kicker">{t("title.kicker")}</p>
          {/* A non-breaking hyphen: "Wi-Fi" never splits across lines. */}
          <h1>{t("title").replace("-", "‑")}</h1>
          <p className="premise">{t("premise")}</p>
          <div className="title-buttons">
            {/* The very first visit goes straight in on Easy: playing within seconds (plan A1). */}
            <button className="primary big" autoFocus disabled={busy} onClick={() => (firstVisit ? void start("easy") : setStep("pick"))}>
              {t("title.firstVisit")}
            </button>
            {firstVisit && (
              <button className="secondary" onClick={() => setStep("pick")}>
                {t("title.chooseNote")}
              </button>
            )}
            <button className="secondary" onClick={() => setPanel("howto")}>
              {t("howto.title")}
            </button>
            <button className="secondary" onClick={() => setPanel("settings")}>
              {t("settings.title")}
            </button>
          </div>
          {health && import.meta.env.DEV && <div className="badge">{health.grandmaMode === "mock" ? t("mode.mock") : t("mode.llm", { model: health.model ?? "" })}</div>}
          {health?.degraded && <p className="device-note">{t(`mode.degraded.${health.degraded}`)}</p>}
          {error && <div className="error">{error}</div>}
        </div>
      ) : (
        <NotePicker onBack={() => setStep("home")} />
      )}
    </div>
  );
}

export function App() {
  const init = useGame((s) => s.init);
  const run = useGame((s) => s.run);
  const scene = useGame((s) => s.scene);
  const textScale = useSettings((s) => s.textScale);
  const readableFont = useSettings((s) => s.readableFont);
  const highContrast = useSettings((s) => s.highContrast);
  useEffect(() => {
    void init();
  }, [init]);
  useEffect(() => applyTextSettings({ textScale, readableFont, highContrast }), [textScale, readableFont, highContrast]);
  useEffect(() => {
    void loadGame().catch(() => undefined); // prefetch; a real failure shows when the game mounts
  }, []);
  return (
    <>
      {scene && (
        <GameErrorBoundary>
          <Suspense fallback={run ? <div className="title-screen"><p className="tagline">{t("loading.door")}</p></div> : null}>
            <Game scene={scene} />
          </Suspense>
        </GameErrorBoundary>
      )}
      {!run && <TitleScreen />}
    </>
  );
}

/**
 * If the 3D room can't start (no WebGL, a failed download, a crash while drawing), say so in plain words
 * with a way back, instead of a blank page (review, iteration 39).
 */
class GameErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(err: unknown) {
    console.error("[game] the room failed to start:", err);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="title-screen" role="alert">
        <h1>{t("title")}</h1>
        <p className="tagline">{t("error.room")}</p>
        <div className="difficulty">
          <button onClick={() => window.location.reload()}>{t("error.reload")}</button>
          <button className="ghost" onClick={() => useGame.getState().leave()}>
            {t("error.back")}
          </button>
        </div>
      </div>
    );
  }
}
