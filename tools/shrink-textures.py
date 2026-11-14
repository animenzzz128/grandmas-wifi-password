"""
Shrink the character textures for the web (run after tools/import-assets.mjs).

The game renders at a low pixel ratio with a retro filter, so 2048 px base-color maps are wasted
download: three of them were ~4.6 MB of a ~6 MB first load. Opaque PNGs referenced by a .gltf in the
folder are resized to at most MAX px and saved as JPEG; the .gltf files are pointed at the new files.
PNGs with real transparency are left alone.

The old PNGs are NOT deleted (the project never deletes files from scripts); the script lists them so
you can move them to the Recycle Bin yourself.

usage: python tools/shrink-textures.py apps/web/public/models/quaternius [max_px=1024] [quality=85]
needs: Pillow (pip install pillow)
"""
import json
import sys
from pathlib import Path

from PIL import Image


def opaque(im: Image.Image) -> bool:
    if "A" not in im.getbands():
        return True
    return im.getchannel("A").getextrema()[0] == 255


def main() -> None:
    folder = Path(sys.argv[1])
    max_px = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
    quality = int(sys.argv[3]) if len(sys.argv) > 3 else 85
    renamed: dict[str, str] = {}
    for gltf_path in sorted(folder.glob("*.gltf")):
        gltf = json.loads(gltf_path.read_text(encoding="utf-8"))
        changed = False
        for img in gltf.get("images", []):
            uri = img.get("uri", "")
            if not uri.lower().endswith(".png") or not (folder / uri).exists():
                continue
            if uri not in renamed:
                im = Image.open(folder / uri)
                if not opaque(im) or max(im.size) <= max_px:  # transparent, or already small
                    continue
                im = im.convert("RGB")
                if max(im.size) > max_px:
                    im.thumbnail((max_px, max_px), Image.LANCZOS)
                out = uri[:-4] + ".jpg"
                im.save(folder / out, "JPEG", quality=quality, optimize=True, progressive=True)
                renamed[uri] = out
                print(f"{uri} -> {out} {im.size[0]}x{im.size[1]} ({(folder / out).stat().st_size // 1024} KB)")
            img["uri"] = renamed[uri]
            img["mimeType"] = "image/jpeg"
            changed = True
        if changed:
            pretty = "\n" in gltf_path.read_text(encoding="utf-8").strip()
            text = json.dumps(gltf, indent=2) if pretty else json.dumps(gltf, separators=(",", ":"))
            gltf_path.write_text(text, encoding="utf-8")
            print(f"updated {gltf_path.name}")
    if renamed:
        print("No longer referenced (move to the Recycle Bin if you like):")
        for old in renamed:
            print(f"  {folder / old}")


if __name__ == "__main__":
    main()
