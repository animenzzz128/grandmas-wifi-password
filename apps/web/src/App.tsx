import { Component, Suspense, lazy, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SettingsCard } from "./ui/Settings.tsx";
import { applyTextSettings, useSettings } from "./settings.ts";
import { useGame } from "./store.ts";
import { t } from "./strings.ts";
import { dailyStreak, formatCountdown, loadDailyRecords } from "./daily.ts";
import { hasVisited } from "./firsts.ts";

/** The 3D game is its own chunk; started loading as soon as the title shows, so a click rarely waits. */
const loadGame = () => import("./Game.tsx");
const Game = lazy(loadGame);

/**
 * Touch-only devices: the game needs a keyboard and mouse (walk, look, type). Asks whether any fine pointer
 * exists, not the window width: a narrow desktop window or a touch-screen laptop with a trackpad can still play.
 */
const needsKeyboard = () => typeof window !== "undefined" && window.matchMedia?.("(any-pointer: fine)").matches === false;

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
      <button disabled={busy} onClick={() => void startDaily()}>
        {rec ? t("daily.again", vars) : t("daily.play", vars)}
      </button>
      {rec && (
        <p className="daily-status">
          {rec.solved ? t("daily.solved", { stars: "⭐".repeat(rec.stars), n: rec.questions }) : t("daily.failed")} · {t("daily.next", { time: formatCountdown(left) })}
        </p>
      )}
      {streak > 1 && <p className="daily-status">{t("daily.streak", { n: streak })}</p>}
      {daily.stats && <p className="daily-status">{dailyStatsLine(daily.stats)}</p>}
    </div>
  );
}

function TitleScreen() {
  const start = useGame((s) => s.start);
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  const health = useGame((s) => s.health);
  const [settings, setSettings] = useState(false);
  // First visit: one obvious button straight into an Easy visit; the daily, the other difficulties and the full
  // key list wait behind "More ways to play" (players should be playing within seconds; plan A1).
  const [firstVisit] = useState(() => !hasVisited());
  const [more, setMore] = useState(!firstVisit);
  return (
    <div className="title-screen">
      {settings && (
        <div className="panel-wrap" role="dialog" aria-labelledby="panel-title">
          <SettingsCard onClose={() => setSettings(false)} />
        </div>
      )}
      <h1>{t("title")}</h1>
      <p className="tagline">{t("tagline")}</p>
      {firstVisit && (
        <button className="primary big" autoFocus disabled={busy} onClick={() => void start("easy")}>
          {t("title.firstVisit")}
        </button>
      )}
      <p className="premise">{t("premise")}</p>
      {more ? (
        <>
          <DailyBox />
          <div className="difficulty">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button key={d} disabled={busy} onClick={() => void start(d)}>
                {t("start")} · {t(`difficulty.${d}`)}
              </button>
            ))}
          </div>
          <p className="difficulty-help">{t("difficulty.help")}</p>
        </>
      ) : (
        <button className="ghost" onClick={() => setMore(true)}>
          {t("title.moreWays")}
        </button>
      )}
      <button className="ghost" onClick={() => setSettings(true)}>
        {t("settings.title")}
      </button>
      <details className="controls">
        <summary>{t("title.controls")}</summary>
        {t("controls")}
      </details>
      {needsKeyboard() && <p className="device-note">{t("title.desktopOnly")}</p>}
      {health && import.meta.env.DEV && <div className="badge">{health.grandmaMode === "mock" ? t("mode.mock") : t("mode.llm", { model: health.model ?? "" })}</div>}
      {health?.degraded && <p className="device-note">{t(`mode.degraded.${health.degraded}`)}</p>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function App() {
  const init = useGame((s) => s.init);
  const run = useGame((s) => s.run);
  const scene = useGame((s) => s.scene);
  const textScale = useSettings((s) => s.textScale);
  const readableFont = useSettings((s) => s.readableFont);
  useEffect(() => {
    void init();
  }, [init]);
  const highContrast = useSettings((s) => s.highContrast);
  useEffect(() => applyTextSettings({ textScale, readableFont, highContrast }), [textScale, readableFont, highContrast]);
  useEffect(() => {
    void loadGame().catch(() => undefined); // prefetch; a real failure shows when the game mounts
  }, []);
  if (!run || !scene) return <TitleScreen />;
  return (
    <GameErrorBoundary key={run.runId}>
      <Suspense fallback={<div className="title-screen"><p className="tagline">{t("loading.door")}</p></div>}>
        <Game scene={scene} />
      </Suspense>
    </GameErrorBoundary>
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
