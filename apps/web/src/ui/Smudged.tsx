/**
 * Note text with its smudged parts drawn as ink smudges. The server marks a smudge with █ characters (one per
 * hidden letter); handwriting fonts don't have that glyph, so it showed as solid blocks or empty boxes (the Godot
 * edition's web build had the same problem). Screen readers hear "smudged" instead.
 */
import { t } from "../strings.ts";

export function Smudged({ text }: { text: string }) {
  const parts = text.split(/(█+)/);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("█") ? (
          <span key={i} className="smudge" style={{ width: `${Math.min(8, p.length) * 0.5}em` }} role="img" aria-label={t("note.smudged")} />
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
