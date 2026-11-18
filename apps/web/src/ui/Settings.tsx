/** Settings: graphics, look, text size and font, voice, relaxed mode. Saved in this browser. */
import { useEffect, useState } from "react";
import { ACTIONS, DEFAULT_KEYS, keyLabel, rebind, useSettings } from "../settings.ts";
import type { Action, Quality } from "../settings.ts";

/** Keys the player can move (the walking keys went with first-person walking in iteration 54). */
const REBINDABLE: Action[] = ["notebook", "speak"];
import { t } from "../strings.ts";

/** Click an action, then press the key you want for it (Esc cancels). A key already in use swaps over. */
function KeyBindings() {
  const keys = useSettings((s) => s.keys);
  const set = useSettings((s) => s.set);
  const [waiting, setWaiting] = useState<Action | null>(null);
  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape" && e.code !== "Enter" && !e.code.startsWith("Arrow")) set({ keys: rebind(keys, waiting, e.code) });
      setWaiting(null);
    };
    window.addEventListener("keydown", onKey, true); // capture: the room never sees this key
    return () => window.removeEventListener("keydown", onKey, true);
  }, [waiting, keys, set]);
  return (
    <fieldset className="key-bindings">
      <legend>{t("settings.keys")}</legend>
      {ACTIONS.filter((a) => REBINDABLE.includes(a)).map((a) => (
        <label key={a} className="key-row">
          <span>{t(`settings.key.${a}`)}</span>
          <button type="button" className={waiting === a ? "waiting" : ""} onClick={() => setWaiting(waiting === a ? null : a)}>
            {waiting === a ? t("settings.keys.press") : keyLabel(keys[a])}
          </button>
        </label>
      ))}
      <button type="button" className="ghost" onClick={() => set({ keys: DEFAULT_KEYS })}>
        {t("settings.keys.reset")}
      </button>
    </fieldset>
  );
}

export function SettingsCard({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  return (
    <div className="card settings-card">
      <h3 id="panel-title">{t("settings.title")}</h3>
      <label>
        {t("settings.sensitivity")} <b>{s.sensitivity.toFixed(1)}×</b>
        <input type="range" min={0.3} max={2.5} step={0.1} value={s.sensitivity} onChange={(e) => s.set({ sensitivity: Number(e.target.value) })} />
      </label>
      <label>
        {t("settings.quality")}
        <select value={s.quality} onChange={(e) => s.set({ quality: e.target.value as Quality, autoQuality: false })}>
          <option value="low">{t("settings.quality.low")}</option>
          <option value="medium">{t("settings.quality.medium")}</option>
          <option value="high">{t("settings.quality.high")}</option>
        </select>
      </label>
      <p className="hint">{t("settings.qualityHint")}</p>
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
      {(["musicVolume", "sfxVolume", "voiceVolume"] as const).map((key) => (
        <label key={key}>
          {t(`settings.${key}`)} <b>{Math.round(s[key] * 100)}%</b>
          <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => s.set({ [key]: Number(e.target.value) })} />
        </label>
      ))}
      <label className="check">
        <input type="checkbox" checked={s.roomSound} onChange={(e) => s.set({ roomSound: e.target.checked })} /> {t("settings.roomSound")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.calmCamera} onChange={(e) => s.set({ calmCamera: e.target.checked })} /> {t("settings.calmCamera")}
      </label>
      <label className="check">
        <input type="checkbox" checked={s.highContrast} onChange={(e) => s.set({ highContrast: e.target.checked })} /> {t("settings.highContrast")}
      </label>
      <KeyBindings />
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
