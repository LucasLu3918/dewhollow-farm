"""從已核准的素材產生共用調色盤 content/palette.json。

調色盤共 48 色：4 個固定的錨點色（輪廓、高光、兩位角色的標誌色），
其餘 44 色由輸入素材的所有不透明像素以中位切分法（median cut）取得。
之後加入地形等素材時，在這裡加入輸入並重新產生；調色盤一變，所有素材都要重新量化。

調色盤只擴充、不重排：加新素材（例如工具、地形）時用 `--base` 保留既有顏色、再從新素材補到 `--size` 色，
這樣已經量化入庫的素材不需要重做。

用法（在專案根目錄）：
    # 第一次：從素材產生 48 色
    .venv/bin/python tools/art/build_palette.py 素材1.png 素材2.png ... [--out content/palette.json]
    # 之後擴充：保留 content/palette.json 既有的顏色，從新素材補到 64 色
    .venv/bin/python tools/art/build_palette.py 新素材.png ... --base content/palette.json --size 64
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image

SIZE = 48  # 沒有 --base 時的預設顏色數

# 錨點色：不管素材怎麼變，這幾個顏色都必須在調色盤裡。
ANCHORS = {
    "outline": "#3b2418",  # 深棕輪廓，不用純黑
    "highlight": "#f7f3ec",  # 偏暖的白，取代純白
    "maomao": "#4aa3ff",  # CHARACTERS.md：毛毛標誌色
    "xiaohan": "#ff6fa8",  # CHARACTERS.md：小涵標誌色
}

SAMPLE_HEIGHT = 128  # 每張素材縮到同樣高度再取樣，避免大圖的顏色壓過小圖
MIN_DISTANCE = 9.0  # 衍生色與錨點色、彼此之間至少相差這麼多，才算不同的顏色


def hex_of(rgb: tuple[int, int, int]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*rgb)


def rgb_of(hex_color: str) -> tuple[int, int, int]:
    return (int(hex_color[1:3], 16), int(hex_color[3:5], 16), int(hex_color[5:7], 16))


def distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def luma(rgb: tuple[int, int, int]) -> float:
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def opaque_pixels(path: Path) -> list[tuple[int, int, int]]:
    img = Image.open(path).convert("RGBA")
    scale = SAMPLE_HEIGHT / img.height
    img = img.resize((max(1, round(img.width * scale)), SAMPLE_HEIGHT), Image.LANCZOS)
    return [(r, g, b) for r, g, b, a in img.getdata() if a >= 250]


def build(paths: list[Path], base: list[str] | None = None, size: int = SIZE) -> list[str]:
    """第一次（base 為 None）：4 個錨點色＋從素材取的顏色，共 size 色。
    擴充（有 base）：保留 base 的每一個顏色，再從新素材補到 size 色。"""
    pixels: list[tuple[int, int, int]] = []
    for path in paths:
        pixels.extend(opaque_pixels(path))
    if not pixels:
        raise SystemExit("輸入素材沒有任何不透明像素")

    strip = Image.new("RGB", (len(pixels), 1))
    strip.putdata(pixels)
    # 多取一些候選，之後挑出彼此夠不同的顏色。
    candidates = strip.quantize(colors=200, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    raw = candidates.getpalette() or []
    counts = sorted(candidates.getcolors() or [], reverse=True)  # (像素數, 索引)，由多到少

    chosen = [rgb_of(h) for h in (base if base is not None else ANCHORS.values())]
    needed = size - len(chosen)
    if needed < 0:
        raise SystemExit(f"目標 {size} 色比既有的 {len(chosen)} 色還少；調色盤只能擴充")
    derived: list[tuple[int, int, int]] = []
    for _, index in counts:
        if len(derived) == needed:
            break
        rgb = (raw[index * 3], raw[index * 3 + 1], raw[index * 3 + 2])
        if all(distance(rgb, other) >= MIN_DISTANCE for other in chosen + derived):
            derived.append(rgb)
    if len(derived) < needed:
        raise SystemExit(f"只找到 {len(derived)} 個夠不同的顏色，需要 {needed} 個；請放入更多素材")

    return [hex_of(c) for c in sorted(chosen + derived, key=luma)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("srcs", type=Path, nargs="+")
    parser.add_argument("--out", type=Path, default=Path("content/palette.json"))
    parser.add_argument("--base", type=Path, help="擴充：保留這個既有調色盤的所有顏色")
    parser.add_argument("--size", type=int, default=None, help="目標顏色數（預設：第一次 48，擴充時必填）")
    args = parser.parse_args()

    base_data = json.loads(args.base.read_text(encoding="utf-8")) if args.base else None
    if base_data is not None and args.size is None:
        raise SystemExit("擴充調色盤時必須指定 --size")
    size = args.size if args.size is not None else SIZE

    colors = build(args.srcs, base_data["colors"] if base_data else None, size)
    data = {
        "version": 1,
        "size": size,
        "note": "由 tools/art/build_palette.py 產生；只擴充、不重排，請勿手改。",
        "generatedFrom": (base_data["generatedFrom"] if base_data else []) + [p.stem for p in args.srcs],
        "anchors": base_data["anchors"] if base_data else ANCHORS,
        "colors": colors,
    }
    args.out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(colors)} 色 → {args.out}")


if __name__ == "__main__":
    main()
