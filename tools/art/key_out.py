"""綠幕去背：把模型產出的「純色背景」圖轉成透明背景 PNG。

背景色取自四個角落的中位數（不假設一定是 #00ff00），只移除「與邊界相連」的背景，
角色內部若有相近色（例如手臂圍出的空隙）另以較嚴的門檻處理，避免誤傷角色本身。

用法（在專案根目錄）：
    .venv/bin/python tools/art/key_out.py 輸入.png 輸出.png [--pad 8] [--preview]
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageFilter

NEAR = 70.0  # 與邊界相連時，距背景色這麼近就算背景
FAR = 36.0  # 不與邊界相連時，要更接近背景色才算背景（處理被手臂圍住的空隙）


def corner_color(img: Image.Image, size: int = 10) -> tuple[int, int, int]:
    w, h = img.size
    px = img.load()
    samples: list[tuple[int, int, int]] = []
    for ox in (0, w - size):
        for oy in (0, h - size):
            for x in range(ox, ox + size):
                for y in range(oy, oy + size):
                    samples.append(px[x, y])
    return tuple(sorted(c[i] for c in samples)[len(samples) // 2] for i in range(3))  # type: ignore[return-value]


def distance(a: tuple[int, int, int], b: tuple[int, int, int]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def background_mask(img: Image.Image, bg: tuple[int, int, int]) -> list[list[bool]]:
    w, h = img.size
    px = img.load()
    mask = [[False] * w for _ in range(h)]
    seen = [[False] * w for _ in range(h)]
    queue: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not seen[y][x]:
            seen[y][x] = True
            if distance(px[x, y], bg) <= NEAR:
                mask[y][x] = True
                queue.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)
    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            try_push(x + dx, y + dy)

    for y in range(h):  # 內部空隙：只移除非常接近背景色的像素
        for x in range(w):
            if not mask[y][x] and distance(px[x, y], bg) <= FAR:
                mask[y][x] = True
    return mask


def despill(r: int, g: int, b: int) -> tuple[int, int, int]:
    """邊緣帶的綠色溢色：把 G 壓到不高於 R、B 的較大者。"""
    return r, min(g, max(r, b)), b


def key_out(src: Path, dst: Path, pad: int, preview: bool) -> None:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    bg = corner_color(img)
    mask = background_mask(img, bg)

    alpha = Image.new("L", (w, h), 255)
    apx = alpha.load()
    for y in range(h):
        for x in range(w):
            if mask[y][x]:
                apx[x, y] = 0
    # 內縮 1 px 去掉殘留邊緣，再輕微模糊讓邊緣自然。
    alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))

    px = img.load()
    out = Image.new("RGBA", (w, h))
    opx = out.load()
    band = alpha.filter(ImageFilter.MaxFilter(7))  # 離透明區 3 px 內視為邊緣帶
    bpx, apx = band.load(), alpha.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            if bpx[x, y] < 255:
                r, g, b = despill(r, g, b)
            opx[x, y] = (r, g, b, apx[x, y])

    box = out.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    if box is None:
        sys.exit(f"{src}: 去背後沒有任何不透明像素，請檢查背景色")
    left, top, right, bottom = box
    out = out.crop((max(0, left - pad), max(0, top - pad), min(w, right + pad), min(h, bottom + pad)))
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst)
    if preview:  # 放在灰底上看邊緣有沒有綠邊
        flat = Image.new("RGBA", out.size, (150, 160, 155, 255))
        flat.alpha_composite(out)
        flat.convert("RGB").save(dst.with_name(dst.stem + "_preview.png"))
    print(f"{src.name}: 背景色 {bg}，輸出 {out.size[0]}×{out.size[1]} → {dst}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("src", type=Path)
    parser.add_argument("dst", type=Path)
    parser.add_argument("--pad", type=int, default=8, help="裁切後四周保留的像素")
    parser.add_argument("--preview", action="store_true", help="另存一張灰底預覽")
    args = parser.parse_args()
    key_out(args.src, args.dst, args.pad, args.preview)


if __name__ == "__main__":
    main()
