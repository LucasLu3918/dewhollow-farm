"""把地形與物件的大圖（768 px 方形）處理成格子素材：可選的無縫接圖、縮到格子、量化到共用調色盤。

地形（草、土、路、木板、水…）要能無縫鋪滿格子，所以加 --seamless：
    先把圖的左右、上下各錯開半張，再以羽化遮罩把原本的接縫融掉（只在圖的中間區域混色，
    四個邊緣與錯開後的接縫完全吻合）。物件（樹、箱子、床…）是獨立的一格，不加 --seamless。

每個素材輸出兩個尺寸，與 finalize.py（角色）相同：
    <輸出前綴>-2x.png   母版，畫格為 1x 的兩倍（遊戲在高解析度螢幕上用它，顯示時縮成 0.5 倍）
    <輸出前綴>.png      1x，由母版縮小後再量化，畫格就是設計尺寸（64 px）

不補輪廓、不去背：地形是整格不透明的，物件的深棕輪廓由模型畫出（見 docs/art/scene-briefs.md）。

用法（在專案根目錄）：
    .venv/bin/python tools/art/tile_finalize.py 大圖.png 輸出前綴 --seamless
    .venv/bin/python tools/art/tile_finalize.py 大圖.png 輸出前綴
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops

from finalize import load_palette, quantize

CELL_1X = 64  # 1x 的格子邊長（與 TILE_SIZE 一致）
SOURCE_SIZE = 768  # 模型輸出的方形邊長；所有地形與物件都用同一個尺寸生成


def ramp_mask(size: int, vertical: bool) -> Image.Image:
    """羽化遮罩：中央為 255、四邊為 0（沿一個方向的三角形斜坡）。"""
    mask = Image.new("L", (size, size))
    values = [round(255 * (1 - abs(2 * i / size - 1))) for i in range(size)]
    pixels = [values[y] if vertical else values[x] for y in range(size) for x in range(size)]
    mask.putdata(pixels)
    return mask


def make_seamless(img: Image.Image) -> Image.Image:
    """讓圖能無縫重複：先在 x 方向、再在 y 方向，把原本的接縫（移到中央）與錯開後的圖混色。
    錯開半張後，邊緣變成原圖的中央（彼此相鄰、連續），中央則是原圖的接縫；遮罩在中央取原圖、在邊緣取錯開的圖。"""
    size = img.width
    half = size // 2
    shifted_x = ImageChops.offset(img, half, 0)
    blended = Image.composite(img, shifted_x, ramp_mask(size, vertical=False))
    shifted_y = ImageChops.offset(blended, 0, half)
    return Image.composite(blended, shifted_y, ramp_mask(size, vertical=True))


def finalize_tile(src: Path, prefix: Path, seamless: bool, palette_path: Path) -> None:
    colors, _outline = load_palette(palette_path)
    img = Image.open(src).convert("RGB")
    if img.size != (SOURCE_SIZE, SOURCE_SIZE):
        img = img.resize((SOURCE_SIZE, SOURCE_SIZE), Image.LANCZOS)
    if seamless:
        img = make_seamless(img)

    rgba = img.convert("RGBA")
    two_x = quantize(rgba.resize((CELL_1X * 2, CELL_1X * 2), Image.LANCZOS), colors)
    one_x = quantize(two_x.resize((CELL_1X, CELL_1X), Image.LANCZOS), colors)
    two_x.save(prefix.with_name(prefix.name + "-2x.png"))
    one_x.save(prefix.with_name(prefix.name + ".png"))
    print(f"{src.name} → {prefix.name}-2x.png / {prefix.name}.png（{'無縫' if seamless else '單格'}）")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src", type=Path)
    parser.add_argument("prefix", type=Path)
    parser.add_argument("--seamless", action="store_true", help="地形：讓圖能無縫鋪滿格子")
    parser.add_argument("--palette", type=Path, default=Path("content/palette.json"))
    args = parser.parse_args()
    finalize_tile(args.src, args.prefix, args.seamless, args.palette)


if __name__ == "__main__":
    main()
