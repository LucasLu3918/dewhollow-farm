"""把透明角色圖處理成遊戲用 RGBA8888 素材：縮到指定畫格並補強像素外輪廓。

每個素材只輸出遊戲載入的 2x 母版：
    <輸出前綴>-2x.png   畫格為設計尺寸的兩倍（遊戲顯示時縮成 0.5 倍）

流程：最近鄰縮放（保持比例、腳底置中貼齊畫格底部）→ 在外圍補一圈硬邊輪廓色。
保留完整 RGBA8888 色彩與來源 alpha；陰影由遊戲內另外畫橢圓，不烤進素材。

用法（在專案根目錄）：
    .venv/bin/python tools/art/finalize.py 去背圖.png 輸出前綴 --frame 64x80
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageFilter

RING_1X = 1  # 外圍補強輪廓的粗細（1x 像素）；加上原圖自帶的輪廓，視覺上約 2 px
MARGIN_1X = 1  # 輪廓外再留的透明邊（1x 像素），避免貼到畫格邊緣被裁掉


def load_outline(path: Path) -> tuple[int, int, int]:
    data = json.loads(path.read_text(encoding="utf-8"))
    o = data["anchors"]["outline"]
    return (int(o[1:3], 16), int(o[3:5], 16), int(o[5:7], 16))


def fit_into_frame(src: Image.Image, frame: tuple[int, int], inset: int) -> Image.Image:
    """縮放並貼到畫格：保持比例，水平置中，腳底貼齊底部（留 inset 的邊）。"""
    fw, fh = frame
    box_w, box_h = fw - 2 * inset, fh - 2 * inset
    scale = min(box_w / src.width, box_h / src.height)
    size = (max(1, round(src.width * scale)), max(1, round(src.height * scale)))
    sprite = src.resize(size, Image.Resampling.NEAREST)
    canvas = Image.new("RGBA", frame, (0, 0, 0, 0))
    canvas.alpha_composite(sprite, ((fw - size[0]) // 2, fh - inset - size[1]))
    return canvas


def add_outline(img: Image.Image, ring: int, color: tuple[int, int, int]) -> Image.Image:
    """在不透明區域外圍補一圈輪廓色（圓角膨脹），再把原圖疊回去。"""
    mask = img.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    grown = mask.filter(ImageFilter.MaxFilter(ring * 2 + 1))
    base = Image.new("RGBA", img.size, color + (0,))
    base.putalpha(grown)
    base.alpha_composite(img)
    return base


def process(src: Path, prefix: Path, frame: tuple[int, int], palette_path: Path) -> None:
    outline = load_outline(palette_path)
    source = Image.open(src).convert("RGBA")

    fw, fh = frame
    ring2, margin2 = RING_1X * 2, MARGIN_1X * 2
    master = fit_into_frame(source, (fw * 2, fh * 2), inset=ring2 + margin2)
    master = add_outline(master, ring2, outline)

    target = prefix.with_name(prefix.name + "-2x.png")
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive creation prevents an approved asset from being silently replaced.
    with target.open("xb") as output:
        master.save(output, format="PNG")
    print(f"{target.name}: {master.width}×{master.height}，RGBA8888")


def parse_frame(text: str) -> tuple[int, int]:
    w, _, h = text.lower().partition("x")
    return int(w), int(h)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src", type=Path)
    parser.add_argument("prefix", type=Path)
    parser.add_argument("--frame", type=parse_frame, required=True, help="1x 畫格，例如 64x80")
    parser.add_argument("--palette", type=Path, default=Path("content/palette.json"))
    args = parser.parse_args()
    process(args.src, args.prefix, args.frame, args.palette)


if __name__ == "__main__":
    main()
