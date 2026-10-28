"""反应式与批量渲染。

反应式: "CC(=O)O.OCC>>CC(=O)OCC.O" —— 反应物.反应物 >> 产物.产物
  · 各分子用同一键长渲染, 因此不同物种的尺度自动一致
  · 组分之间画 "+", 两侧之间画箭头, 箭头上方可写条件(reagents)

批量: 一组 SMILES -> 一个文件夹 (每个结构一个文件) + index.html 预览页
"""
from __future__ import annotations

import io
import os
import re

from PIL import Image, ImageDraw, ImageFont

import render

HEADER_MARK = "<!-- END OF HEADER -->"
VB_RE = re.compile(r'viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"')
TEXT_COLOR = "#000000"
_ARROW_HEAD = 1.0          # 箭头长度里箭尖占的比例系数


# --------------------------------------------------------------- 反应式解析

def parse_scheme(scheme: str):
    """'A.B>>C' -> ([A, B], [C])；组分分隔符 . 或 + 都认"""
    if ">>" not in scheme:
        raise ValueError('反应式需要 ">>" 分隔，例如 "CC(=O)O.OCC>>CC(=O)OCC.O"')
    left, right = scheme.split(">>", 1)

    def comps(s):
        return [c for c in s.replace("+", ".").split(".") if c.strip()]

    a, b = comps(left), comps(right)
    if not a or not b:
        raise ValueError("反应式两侧都要有结构")
    return a, b


# ----------------------------------------------------------------- SVG 拼装

def _mol_parts(smiles: str, bond_px: float, color: bool, annotate: bool):
    """返回 (body, x0, y0, w, h)；body 内的坐标是原始画布坐标。"""
    svg = render.render_svg(smiles, bond_px, color=color, annotate=annotate)
    m = VB_RE.search(svg)
    if not m:
        raise ValueError(f"渲染 {smiles} 失败")
    x0, y0, w, h = (float(v) for v in m.groups())
    body = svg.split(HEADER_MARK, 1)[1].rsplit("</svg>", 1)[0]
    return body, x0, y0, w, h


def _mol_size(m):
    """SVG 侧是 (body,x0,y0,w,h) 元组, PNG 侧是 PIL Image"""
    return (m[3], m[4]) if isinstance(m, tuple) else (m.width, m.height)


def _layout(blocks, bond_px: float, reagents: str | None):
    """给定块序列, 算每个块的 x 与整体尺寸。块: ('mol', parts) / ('plus',) / ('arrow',)"""
    gap = bond_px * 0.50
    widths = []
    for kind, *rest in blocks:
        if kind == "mol":
            widths.append(_mol_size(rest[0])[0])
        elif kind == "plus":
            widths.append(bond_px * 0.85)
        else:
            widths.append(bond_px * 2.4)

    max_h = max((_mol_size(r[0])[1] for k, *r in blocks if k == "mol"), default=bond_px)
    top = bond_px * (1.15 if reagents else 0.22)
    bottom = bond_px * 0.25
    total_w = sum(widths) + gap * (len(blocks) - 1) + bond_px * 0.4
    total_h = top + max_h + bottom
    y_mid = top + max_h / 2.0

    xs = []
    cursor = bond_px * 0.2
    for w in widths:
        xs.append(cursor)
        cursor += w + gap
    return xs, widths, total_w, total_h, y_mid, top, max_h


def render_scheme_svg(scheme: str, bond_px: float = 42.0, *, color=False,
                      annotate=False, reagents: str | None = None) -> str:
    left, right = parse_scheme(scheme)

    blocks = []
    for i, smi in enumerate(left):
        if i:
            blocks.append(("plus",))
        blocks.append(("mol", _mol_parts(smi, bond_px, color, annotate)))
    blocks.append(("arrow",))
    for i, smi in enumerate(right):
        if i:
            blocks.append(("plus",))
        blocks.append(("mol", _mol_parts(smi, bond_px, color, annotate)))

    xs, widths, total_w, total_h, y_mid, _top, _max_h = _layout(blocks, bond_px, reagents)

    stroke = max(1.2, bond_px * 0.055)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{total_w:.1f}" '
        f'height="{total_h:.1f}" viewBox="0 0 {total_w:.1f} {total_h:.1f}">',
    ]

    for (kind, *rest), x, w in zip(blocks, xs, widths):
        if kind == "mol":
            body, x0, y0, _w, h = rest[0]
            dy = y_mid - h / 2.0
            out.append(f'<g transform="translate({x - x0:.2f} {dy - y0:.2f})">{body}</g>')
        elif kind == "plus":
            cx, cy = x + w / 2.0, y_mid
            r = bond_px * 0.22
            out.append(
                f'<path d="M {cx - r:.2f},{cy:.2f} L {cx + r:.2f},{cy:.2f}" stroke="{TEXT_COLOR}" '
                f'stroke-width="{stroke:.2f}" stroke-linecap="butt"/>'
                f'<path d="M {cx:.2f},{cy - r:.2f} L {cx:.2f},{cy + r:.2f}" stroke="{TEXT_COLOR}" '
                f'stroke-width="{stroke:.2f}" stroke-linecap="butt"/>')
        else:  # arrow
            y = y_mid
            head = bond_px * 0.42
            out.append(
                f'<path d="M {x:.2f},{y:.2f} L {x + w - head * 0.3:.2f},{y:.2f}" '
                f'stroke="{TEXT_COLOR}" stroke-width="{stroke:.2f}" stroke-linecap="butt"/>'
                f'<path d="M {x + w:.2f},{y:.2f} L {x + w - head:.2f},{y - head * 0.42:.2f} '
                f'L {x + w - head:.2f},{y + head * 0.42:.2f} Z" fill="{TEXT_COLOR}"/>')

    if reagents:
        arrow_i = next(i for i, b in enumerate(blocks) if b[0] == "arrow")
        ax, aw = xs[arrow_i], widths[arrow_i]
        fs = bond_px * 0.52
        out.append(
            f'<text x="{ax + aw / 2:.2f}" y="{y_mid - bond_px * 0.45:.2f}" '
            f'text-anchor="middle" font-family="Arial, Helvetica, sans-serif" '
            f'font-size="{fs:.2f}" fill="{TEXT_COLOR}">{_esc(reagents)}</text>')

    out.append("</svg>")
    return "".join(out)


def _esc(s: str) -> str:
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ----------------------------------------------------------------- PNG 拼装

_FONT_CANDIDATES = [
    r"C:\Windows\Fonts\arial.ttf",
    r"C:\Windows\Fonts\segoeui.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]


def _font(size: int):
    for p in _FONT_CANDIDATES:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:      # noqa: BLE001
                continue
    return ImageFont.load_default()


def _mol_png(smiles: str, bond_px: float, color: bool, annotate: bool) -> Image.Image:
    buf = io.BytesIO()
    render.render_png(smiles, buf, bond_px, color=color, annotate=annotate, margin_px=0)
    buf.seek(0)
    return Image.open(buf).convert("RGBA")


def render_scheme_png(scheme: str, path, bond_px: float = 42.0, *, color=False,
                      annotate=False, reagents: str | None = None, scale: float = 1.0):
    left, right = parse_scheme(scheme)
    b = bond_px * scale

    blocks = []
    for i, smi in enumerate(left):
        if i:
            blocks.append(("plus",))
        blocks.append(("mol", _mol_png(smi, b, color, annotate)))
    blocks.append(("arrow",))
    for i, smi in enumerate(right):
        if i:
            blocks.append(("plus",))
        blocks.append(("mol", _mol_png(smi, b, color, annotate)))

    xs, widths, total_w, total_h, y_mid, _top, _max_h = _layout(blocks, b, reagents)
    canvas = Image.new("RGBA", (int(total_w) + 2, int(total_h) + 2), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)

    stroke = max(2, int(round(b * 0.055)))
    for (kind, *rest), x, w in zip(blocks, xs, widths):
        if kind == "mol":
            im = rest[0]
            canvas.alpha_composite(im, (int(x), int(y_mid - im.height / 2.0)))
        elif kind == "plus":
            cx, cy, r = x + w / 2.0, y_mid, b * 0.22
            draw.line([(cx - r, cy), (cx + r, cy)], fill=TEXT_COLOR, width=stroke)
            draw.line([(cx, cy - r), (cx, cy + r)], fill=TEXT_COLOR, width=stroke)
        else:
            head = b * 0.42
            y = y_mid
            draw.line([(x, y), (x + w - head * 0.3, y)], fill=TEXT_COLOR, width=stroke)
            draw.polygon([(x + w, y), (x + w - head, y - head * 0.42),
                          (x + w - head, y + head * 0.42)], fill=TEXT_COLOR)

    if reagents:
        i = next(k for k, blk in enumerate(blocks) if blk[0] == "arrow")
        f = _font(max(10, int(b * 0.52)))
        tw = draw.textlength(reagents, font=f)
        draw.text((xs[i] + widths[i] / 2 - tw / 2, y_mid - b * 0.95), reagents,
                  fill=TEXT_COLOR, font=f)

    canvas.save(path, "PNG")
    return path


# -------------------------------------------------------------------- 批量

def render_batch(items, outdir: str, fmt: str = "svg", *, bond_px: float = 42.0,
                 color=False, annotate=False, make_index: bool = True):
    """items: [(name, smiles)]；返回写出的文件路径列表。"""
    fmt = "png" if str(fmt).lower() == "png" else "svg"
    os.makedirs(outdir, exist_ok=True)
    files = []
    for i, (name, smiles) in enumerate(items):
        p = os.path.join(outdir, f"{name}.{fmt}")
        if fmt == "svg":
            with open(p, "w", encoding="utf-8") as f:
                f.write(render.render_svg(smiles, bond_px, color=color, annotate=annotate))
        else:
            render.render_png(smiles, p, bond_px, color=color, annotate=annotate, margin_px=4)
        files.append(p)

    if make_index:
        write_index(outdir, items, fmt)
    return files


def write_index(outdir: str, items, fmt: str) -> str:
    cells = []
    for name, smiles in items:
        cells.append(
            '<figure class="cell">'
            f'<img src="{name}.{fmt}" alt="{_esc(smiles)}">'
            f'<figcaption><b>{_esc(name)}</b><br><code>{_esc(smiles)}</code></figcaption>'
            "</figure>")
    html = f"""<!doctype html>
<meta charset="utf-8">
<title>structures</title>
<style>
  body {{ margin: 0; padding: 28px; background: #fff; color: #111;
         font: 14px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }}
  .grid {{ display: flex; flex-wrap: wrap; gap: 18px; }}
  .cell {{ margin: 0; padding: 12px; border: 1px solid #e5e5e5; border-radius: 10px;
           width: 230px; text-align: center; }}
  .cell img {{ max-width: 100%; height: auto; }}
  figcaption {{ margin-top: 8px; color: #555; font-size: 12px; word-break: break-all; }}
  code {{ color: #888; font-size: 11px; }}
</style>
<h3>structures ({len(items)})</h3>
<div class="grid">{''.join(cells)}</div>
"""
    p = os.path.join(outdir, "index.html")
    with open(p, "w", encoding="utf-8") as f:
        f.write(html)
    return p


def safe_name(i: int, smiles: str) -> str:
    """按序号 + SMILES 片段命名, 避免中文/特殊字符导致的路径问题"""
    frag = re.sub(r"[^A-Za-z0-9]+", "", smiles)[:12] or "mol"
    return f"{i:02d}_{frag}"
