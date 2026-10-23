"""把地面或透明物件圖處理成 64 px 格子的 RGBA8888 素材。

地形（草、土、路、木板、水…）要能無縫鋪滿格子，所以加 --seamless：
    先把圖的左右、上下各錯開半張，再以羽化遮罩把原本的接縫融掉（只在圖的中間區域混色，
    四個邊緣與錯開後的接縫完全吻合）。物件（樹、箱子、床…）是獨立的一格，不加 --seamless。

每個素材只輸出遊戲載入的 2x 母版：
    <輸出前綴>-2x.png   畫格為設計尺寸（64 px）的兩倍（遊戲顯示時縮成 0.5 倍）

地面是不透明、可無縫拼接的整格圖；物件以 --overlay 輸出透明圖層，保留來源 alpha。

用法（在專案根目錄）：
    .venv/bin/python tools/art/tile_finalize.py 大圖.png 輸出前綴 --seamless
    .venv/bin/python tools/art/tile_finalize.py 透明物件.png 輸出前綴 --overlay
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageOps

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


def finalize_tile(src: Path, prefix: Path, seamless: bool, overlay: bool) -> None:
    source = Image.open(src)
    if overlay:
        img = source.convert("RGBA")
        contained = ImageOps.contain(img, (CELL_1X * 2, CELL_1X * 2), method=Image.Resampling.NEAREST)
        two_x = Image.new("RGBA", (CELL_1X * 2, CELL_1X * 2), (0, 0, 0, 0))
        two_x.alpha_composite(contained, ((two_x.width - contained.width) // 2, (two_x.height - contained.height) // 2))
    else:
        img = ImageOps.fit(source.convert("RGB"), (SOURCE_SIZE, SOURCE_SIZE), method=Image.Resampling.NEAREST)
        if seamless:
            img = make_seamless(img)
        two_x = img.resize((CELL_1X * 2, CELL_1X * 2), Image.Resampling.NEAREST).convert("RGBA")

    target = prefix.with_name(prefix.name + "-2x.png")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents an approved asset from being silently replaced.
    with target.open("xb") as output:
        two_x.save(output, format="PNG")
    mode = "物件透明層" if overlay else "無縫地面" if seamless else "地面"
    print(f"{src.name} → {prefix.name}-2x.png（{mode}，RGBA8888）")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src", type=Path)
    parser.add_argument("prefix", type=Path)
    parser.add_argument("--seamless", action="store_true", help="地形：讓圖能無縫鋪滿格子")
    parser.add_argument("--overlay", action="store_true", help="物件：保留 alpha 並置中到透明格子")
    args = parser.parse_args()
    finalize_tile(args.src, args.prefix, args.seamless, args.overlay)


if __name__ == "__main__":
    main()
