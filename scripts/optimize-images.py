"""Convert generated PNGs into web-ready JPEGs plus a small srcset variant."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "public" / "images"
SMALL_W = 420

for png in sorted(ROOT.rglob("*.png")):
    img = Image.open(png).convert("RGB")
    w, h = img.size

    full = png.with_suffix(".jpg")
    img.save(full, "JPEG", quality=78, optimize=True, progressive=True)

    if w > SMALL_W + 60:
        sh = round(h * SMALL_W / w)
        small = img.resize((SMALL_W, sh), Image.LANCZOS)
        small.save(png.with_name(f"{png.stem}-{SMALL_W}.jpg"), "JPEG", quality=76, optimize=True, progressive=True)

    png.unlink()
    print(f"{png.relative_to(ROOT.parent)} -> {full.stat().st_size // 1024} KB")
