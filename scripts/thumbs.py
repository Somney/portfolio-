"""Small WebP previews for every picture the site shows in a carousel or card.

assets/social/instagram/123.jpg  ->  assets/thumbs/social/instagram/123.webp
The full-size file is still used in the full-screen viewer. Run after a sync:
    python3 scripts/thumbs.py
Only missing or out-of-date previews are made, so it's quick to re-run."""
import os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAX = 640          # longest side, px (cards are ~300 css px wide)
paths = set()
for f in ("social/feed.json", "content.js"):
    txt = open(os.path.join(ROOT, f), encoding="utf-8").read()
    paths |= set(re.findall(r'assets/[^"\'\s)]+?\.(?:jpe?g|png|webp)', txt, re.I))

made = 0
for rel in sorted(paths):
    src = os.path.join(ROOT, rel)
    if rel.startswith("assets/thumbs/") or not os.path.isfile(src):
        continue
    dst = os.path.join(ROOT, "assets/thumbs", os.path.splitext(rel[len("assets/"):])[0] + ".webp")
    if os.path.isfile(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        continue
    try:
        im = ImageOps.exif_transpose(Image.open(src))
        im = im.convert("RGBA" if im.mode in ("RGBA", "LA", "P") else "RGB")
        im.thumbnail((MAX, MAX), Image.LANCZOS)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im.save(dst, "WEBP", quality=74, method=6)
        made += 1
    except Exception as e:
        print("skip", rel, e, file=sys.stderr)
print(f"{made} previews made, {len(paths)} pictures checked")
