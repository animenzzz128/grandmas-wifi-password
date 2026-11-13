/** Settings: mouse sensitivity, field of view, invert Y, relaxed mode. Saved in this browser. */
import { useSettings } from "../settings.ts";
import { t } from "../strings.ts";

export function SettingsCard({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  return (
    <div className="card settings-card">
      <h3>{t("settings.title")}</h3>
      <label>
        {t("settings.sensitivity")} <b>{s.sensitivity.toFixed(1)}×</b>
        <input type="range" min={0.3} max={2.5} step={0.1} value={s.sensitivity} onChange={(e) => s.set({ sensitivity: Number(e.target.value) })} />
      </label>
      <label>
        {t("settings.fov")} <b>{s.fov}°</b>
        <input type="range" min={60} max={95} step={1} value={s.fov} onChange={(e) => s.set({ fov: Number(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} /> {t("settings.invertY")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.retro} onChange={(e) => s.set({ retro: e.target.checked })} /> {t("settings.retro")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.relaxed} onChange={(e) => s.set({ relaxed: e.target.checked })} /> {t("settings.relaxed")}
      </label>
      <p className="hint">{t("settings.relaxedHint")}</p>
      <button className="ghost" onClick={onClose}>
        {t("close")}
      </button>
    </div>
  );
}
