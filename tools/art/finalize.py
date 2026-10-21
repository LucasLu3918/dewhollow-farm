"""把去背後的大圖處理成遊戲用素材：縮到指定畫格、量化到共用調色盤、補強外輪廓。

每個素材輸出兩個尺寸：
    <輸出前綴>-2x.png   母版，畫格為 1x 的兩倍（遊戲在高解析度螢幕上用它）
    <輸出前綴>.png      1x，由母版縮小後再量化，畫格就是設計尺寸

流程：縮放（保持比例、腳底置中貼齊畫格底部）→ 在外圍補一圈輪廓色 → 所有像素量化到
content/palette.json 的 48 色（不做抖色）→ 驗證輸出的顏色都在調色盤內。
透明度保留柔邊（卡通風不做硬邊像素）；陰影由遊戲內另外畫橢圓，不烤進素材。

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


def load_palette(path: Path) -> tuple[list[tuple[int, int, int]], tuple[int, int, int]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    colors = [(int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16)) for h in data["colors"]]
    o = data["anchors"]["outline"]
    return colors, (int(o[1:3], 16), int(o[3:5], 16), int(o[5:7], 16))


def palette_image(colors: list[tuple[int, int, int]]) -> Image.Image:
    pal = Image.new("P", (1, 1))
    # 只放調色盤本身的顏色；用 0 補滿 256 色會把黑色也變成可選顏色。
    pal.putpalette([c for rgb in colors for c in rgb])
    return pal


def quantize(img: Image.Image, colors: list[tuple[int, int, int]]) -> Image.Image:
    """只量化 RGB，保留原本的 alpha。"""
    rgb = img.convert("RGB").quantize(palette=palette_image(colors), dither=Image.Dither.NONE).convert("RGB")
    out = rgb.convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def fit_into_frame(src: Image.Image, frame: tuple[int, int], inset: int) -> Image.Image:
    """縮放並貼到畫格：保持比例，水平置中，腳底貼齊底部（留 inset 的邊）。"""
    fw, fh = frame
    box_w, box_h = fw - 2 * inset, fh - 2 * inset
    scale = min(box_w / src.width, box_h / src.height)
    size = (max(1, round(src.width * scale)), max(1, round(src.height * scale)))
    sprite = src.resize(size, Image.LANCZOS)  # RGBA 在 Pillow 內以預乘 alpha 縮放，不會有暗邊
    canvas = Image.new("RGBA", frame, (0, 0, 0, 0))
    canvas.alpha_composite(sprite, ((fw - size[0]) // 2, fh - inset - size[1]))
    return canvas


def add_outline(img: Image.Image, ring: int, color: tuple[int, int, int]) -> Image.Image:
    """在不透明區域外圍補一圈輪廓色（圓角膨脹），再把原圖疊回去。"""
    mask = img.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
    grown = mask.filter(ImageFilter.GaussianBlur(ring * 0.8)).point(lambda v: 255 if v >= 24 else 0)
    base = Image.new("RGBA", img.size, color + (0,))
    base.putalpha(grown)
    base.alpha_composite(img)
    return base


def process(src: Path, prefix: Path, frame: tuple[int, int], palette_path: Path) -> None:
    colors, outline = load_palette(palette_path)
    source = Image.open(src).convert("RGBA")

    fw, fh = frame
    ring2, margin2 = RING_1X * 2, MARGIN_1X * 2
    master = fit_into_frame(source, (fw * 2, fh * 2), inset=ring2 + margin2)
    master = quantize(add_outline(master, ring2, outline), colors)

    small = master.resize((fw, fh), Image.LANCZOS)
    small = quantize(small, colors)

    allowed = set(colors)
    for name, img in (("-2x", master), ("", small)):
        used = {px[:3] for px in img.getdata() if px[3] > 0}
        stray = used - allowed
        if stray:
            raise SystemExit(f"{src.name} {name or '1x'}：有 {len(stray)} 個顏色不在調色盤內")
        target = prefix.with_name(prefix.name + name + ".png")
        target.parent.mkdir(parents=True, exist_ok=True)
        img.save(target)
        print(f"{target.name}: {img.width}×{img.height}，用了 {len(used)} 色")


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
