"""接觸表：把多張去背後的素材並排在同一張圖上，方便比較同一組素材是否一致。

用法（在專案根目錄）：
    .venv/bin/python tools/art/contact_sheet.py 輸出.png 圖1.png 圖2.png ... [--height 420]
檔名（不含副檔名）會標在每格下方。
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw

GAP = 24
LABEL_H = 28
BG = (150, 160, 155)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("dst", type=Path)
    parser.add_argument("srcs", type=Path, nargs="+")
    parser.add_argument("--height", type=int, default=420, help="每格圖的高度")
    parser.add_argument("--nearest", action="store_true", help="用最近鄰放大，檢查實際像素（預設為平滑縮放）")
    args = parser.parse_args()
    resample = Image.NEAREST if args.nearest else Image.LANCZOS

    tiles: list[tuple[str, Image.Image]] = []
    for src in args.srcs:
        img = Image.open(src).convert("RGBA")
        scale = args.height / img.height
        tiles.append((src.stem, img.resize((max(1, round(img.width * scale)), args.height), resample)))

    width = GAP + sum(t.width + GAP for _, t in tiles)
    sheet = Image.new("RGBA", (width, args.height + LABEL_H + GAP * 2), BG + (255,))
    draw = ImageDraw.Draw(sheet)
    x = GAP
    for name, tile in tiles:
        sheet.alpha_composite(tile, (x, GAP))
        draw.text((x, GAP + args.height + 6), name, fill=(20, 30, 25, 255))
        x += tile.width + GAP
    args.dst.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert("RGB").save(args.dst)
    print(f"{len(tiles)} 張 → {args.dst}（{sheet.width}×{sheet.height}）")


if __name__ == "__main__":
    main()
