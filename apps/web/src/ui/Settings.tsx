/** Settings: look, text size and font, voice, retro filter, relaxed mode. Saved in this browser. */
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
      <label>
        {t("settings.textScale")} <b>{Math.round(s.textScale * 100)}%</b>
        <input type="range" min={0.85} max={1.6} step={0.05} value={s.textScale} onChange={(e) => s.set({ textScale: Number(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={s.readableFont} onChange={(e) => s.set({ readableFont: e.target.checked })} /> {t("settings.readableFont")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} /> {t("settings.invertY")}
      </label>
      <label>
        {t("settings.voice")}
        <select value={s.voice} onChange={(e) => s.set({ voice: e.target.value as "spoken" | "blips" | "off" })}>
          <option value="spoken">{t("settings.voice.spoken")}</option>
          <option value="blips">{t("settings.voice.blips")}</option>
          <option value="off">{t("settings.voice.off")}</option>
        </select>
      </label>
      <p className="hint">{t("settings.micHint")}</p>
      <label className="check">
        <input type="checkbox" checked={s.typeOut} onChange={(e) => s.set({ typeOut: e.target.checked })} /> {t("settings.typeOut")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.roomSound} onChange={(e) => s.set({ roomSound: e.target.checked })} /> {t("settings.roomSound")}
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
