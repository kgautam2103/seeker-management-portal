"""Generate placeholder PWA icons without any image library. Run: npm run icons"""
import math, struct, zlib, os

INDIGO = (67, 56, 202)
WHITE = (255, 255, 255)

def png(w, h, pix):
    raw = b"".join(b"\x00" + bytes(c for x in range(w) for c in pix(x, y)) for y in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

def icon(size, maskable):
    c = size / 2
    r_bg = size * (0.5 if maskable else 0.22)  # corner radius; maskable = full bleed
    def inside_rounded(x, y):
        if maskable:
            return True
        rx, ry = abs(x - c) - (c - r_bg), abs(y - c) - (c - r_bg)
        if rx <= 0 or ry <= 0:
            return True
        return rx * rx + ry * ry <= r_bg * r_bg
    ring_outer, ring_inner, dot = size * 0.30, size * 0.19, size * 0.07
    def pix(x, y):
        px, py = x + 0.5, y + 0.5
        if not inside_rounded(px, py):
            return (0, 0, 0, 0)
        d = math.hypot(px - c, py - c)
        if d <= dot or ring_inner <= d <= ring_outer:
            return (*WHITE, 255)
        return (*INDIGO, 255)
    return png(size, size, pix)

out = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(out, exist_ok=True)
for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                             ("maskable-512.png", 512, True), ("apple-touch-icon.png", 180, True)]:
    with open(os.path.join(out, name), "wb") as f:
        f.write(icon(size, maskable))
    print("wrote", name)
