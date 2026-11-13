import { useEffect, useState } from "react";
import { SettingsCard } from "./ui/Settings.tsx";
import { useGame } from "./store.ts";
import { t } from "./strings.ts";
import { GameCanvas } from "./scene/GameCanvas.tsx";
import { Hud } from "./ui/Hud.tsx";

function TitleScreen() {
  const start = useGame((s) => s.start);
  const busy = useGame((s) => s.busy);
  const error = useGame((s) => s.error);
  const health = useGame((s) => s.health);
  const [settings, setSettings] = useState(false);
  return (
    <div className="title-screen">
      {settings && (
        <div className="panel-wrap">
          <SettingsCard onClose={() => setSettings(false)} />
        </div>
      )}
      <h1>{t("title")}</h1>
      <p className="tagline">{t("tagline")}</p>
      <p className="premise">{t("premise")}</p>
      <div className="difficulty">
        {(["easy", "medium", "hard"] as const).map((d) => (
          <button key={d} disabled={busy} onClick={() => void start(d)}>
            {t("start")} · {t(`difficulty.${d}`)}
          </button>
        ))}
      </div>
      <p className="difficulty-help">{t("difficulty.help")}</p>
      <button className="ghost" onClick={() => setSettings(true)}>
        {t("settings.title")}
      </button>
      <p className="controls">{t("controls")}</p>
      {health && import.meta.env.DEV && <div className="badge">{health.grandmaMode === "mock" ? t("mode.mock") : t("mode.llm", { model: health.model ?? "" })}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}

export function App() {
  const init = useGame((s) => s.init);
  const run = useGame((s) => s.run);
  const scene = useGame((s) => s.scene);
  useEffect(() => {
    void init();
  }, [init]);
  if (!run || !scene) return <TitleScreen />;
  return (
    <>
      <GameCanvas scene={scene} />
      <Hud />
    </>
  );
}
