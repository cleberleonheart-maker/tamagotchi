#!/usr/bin/env python3
"""Gera os ícones PNG do Tamagotchi sem dependências externas."""

import math
import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"
GRID = 64


def new_canvas(size=GRID):
    return [[(0, 0, 0, 0) for _ in range(size)] for _ in range(size)]


def put(px, x, y, color):
    if 0 <= x < GRID and 0 <= y < GRID:
        px[y][x] = color


def ellipse(px, cx, cy, rx, ry, color):
    for y in range(GRID):
        for x in range(GRID):
            if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1:
                put(px, x, y, color)


def rect(px, x0, y0, x1, y1, color):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(px, x, y, color)


def shade(px, cx, cy, radius, color, strength=0.12):
    for y in range(GRID):
        for x in range(GRID):
            r, g, b, a = px[y][x]
            if a and (x - cx) ** 2 + (y - cy) ** 2 < radius ** 2:
                k = 1 + strength
                px[y][x] = (min(255, int(r * k)), min(255, int(g * k)), min(255, int(b * k)), a)


def draw(full_bleed=False):
    px = new_canvas()

    for y in range(GRID):
        for x in range(GRID):
            t = y / GRID
            r = int(22 + 60 * t)
            g = int(18 + 24 * t)
            b = int(58 + 90 * (1 - t))
            d = math.hypot(x - 31.5, y - 31.5)
            if d < 31.5 or full_bleed:
                px[y][x] = (r, g, b, 255)

    ellipse(px, 32, 36, 19, 20, (255, 226, 174, 255))
    ellipse(px, 32, 32, 19, 19, (255, 241, 211, 255))
    rect(px, 19, 12, 22, 20, (255, 241, 211, 255))
    rect(px, 42, 12, 45, 20, (255, 241, 211, 255))
    ellipse(px, 20, 12, 4, 4, (255, 121, 168, 255))
    ellipse(px, 44, 12, 4, 4, (255, 121, 168, 255))
    ellipse(px, 22, 55, 7, 4, (255, 205, 135, 255))
    ellipse(px, 42, 55, 7, 4, (255, 205, 135, 255))

    rect(px, 23, 26, 27, 31, (36, 27, 52, 255))
    rect(px, 37, 26, 41, 31, (36, 27, 52, 255))
    rect(px, 24, 27, 25, 28, (255, 255, 255, 255))
    rect(px, 38, 27, 39, 28, (255, 255, 255, 255))
    ellipse(px, 18, 35, 4, 3, (255, 145, 175, 255))
    ellipse(px, 46, 35, 4, 3, (255, 145, 175, 255))
    rect(px, 29, 35, 35, 35, (110, 58, 82, 255))
    rect(px, 28, 34, 28, 34, (110, 58, 82, 255))
    rect(px, 36, 34, 36, 34, (110, 58, 82, 255))

    for sx, sy in ((7, 9), (55, 17), (10, 48)):
        rect(px, sx, sy - 2, sx + 1, sy + 2, (255, 240, 170, 255))
        rect(px, sx - 2, sy, sx + 3, sy, (255, 240, 170, 255))

    shade(px, 28, 25, 10, (255, 255, 255), 0.06)
    return px


def write_png(path, pixels, size):
    scale = size / GRID
    rows = []
    for y in range(size):
        row = pixels[min(GRID - 1, int(y / scale))]
        scaled = []
        for x in range(size):
            scaled.append(row[min(GRID - 1, int(x / scale))])
        rows.append(b"".join(struct.pack("BBBB", *c) for c in scaled))

    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    px = draw()
    for size in (180, 192, 512):
        write_png(OUT / f"icon-{size}.png", px, size)
    write_png(OUT / "icon-maskable-512.png", draw(full_bleed=True), 512)
    print("Ícones gerados em", OUT)


if __name__ == "__main__":
    main()
