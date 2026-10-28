"""SMILES -> 键线式 渲染核心（v2）

关键设计:
  1. 手性 H 的方位重算 —— 绘制库默认把 H 放在环内方向, 稠环处会压到键线
  2. 透明底 + 按墨迹紧裁 —— 放进 Word 不留白块
  3. 画布按分子尺寸成比例 —— 键长在任何分子/任何 DPI 下都精确一致,
     同一张反应式里各分子同尺度 (RDKit 的 fixedBondLength 会因标签过大
     而回缩, 不能用)
"""
from __future__ import annotations

import io
import math
import re

from rdkit import Chem
from rdkit.Chem import rdDepictor
from rdkit.Chem.Draw import rdMolDraw2D


# ---------- 解析与布局 -----------------------------------------------------

def parse(smiles: str) -> Chem.Mol:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"SMILES 无法解析: {smiles!r}")
    return mol


def layout(mol: Chem.Mol) -> Chem.Mol:
    m = Chem.Mol(mol)
    rdDepictor.SetPreferCoordGen(True)
    rdDepictor.Compute2DCoords(m)
    rdDepictor.StraightenDepiction(m)
    return m


# ---------- 手性 H 位置修正 ------------------------------------------------

def _norm(v):
    n = math.hypot(*v)
    return (v[0] / n, v[1] / n) if n else (0.0, 0.0)


def _seg_dist(p, a, b) -> float:
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy
    t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2))
    return math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))


def _clearance(p, mol, conf, skip_atom, skip_bonds) -> float:
    best = 1e9
    for at in mol.GetAtoms():
        i = at.GetIdx()
        if i == skip_atom:
            continue
        q = conf.GetAtomPosition(i)
        best = min(best, math.hypot(p[0] - q.x, p[1] - q.y))
    for b in mol.GetBonds():
        bi, ei = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        if (bi, ei) in skip_bonds:
            continue
        a, e = conf.GetAtomPosition(bi), conf.GetAtomPosition(ei)
        best = min(best, _seg_dist(p, (a.x, a.y), (e.x, e.y)))
        if best < 0.15:
            break
    return best


def fix_chiral_h(mol: Chem.Mol, radius_scale: float = 1.0) -> Chem.Mol:
    """把手性 H 挪到周围最空的方向。

    绘制库补加的手性 H 只按「背离邻居质心」放置: 在稠环/桥环的环并位置,
    这个方向正好插进环内, 压在相邻键线与原子标签上。这里对每个手性 H
    采样 72 个方向, 取与其它原子、键段距离最大的位置; 楔形属性不变,
    因此立体化学的读法不变。
    """
    m = Chem.Mol(mol)
    conf = m.GetConformer()
    lens = []
    for b in m.GetBonds():
        a = conf.GetAtomPosition(b.GetBeginAtomIdx())
        e = conf.GetAtomPosition(b.GetEndAtomIdx())
        lens.append(math.hypot(a.x - e.x, a.y - e.y))
    if not lens:
        return m
    r = (sum(lens) / len(lens)) * radius_scale

    for at in m.GetAtoms():
        if at.GetAtomicNum() != 1:
            continue
        nb = at.GetNeighbors()
        if len(nb) != 1:
            continue
        c = nb[0]
        if c.GetChiralTag() == Chem.ChiralType.CHI_UNSPECIFIED:
            continue
        ci, hi = c.GetIdx(), at.GetIdx()
        skip = {(ci, hi), (hi, ci)}
        pc = conf.GetAtomPosition(ci)
        dirs = [_norm((conf.GetAtomPosition(n.GetIdx()).x - pc.x,
                       conf.GetAtomPosition(n.GetIdx()).y - pc.y))
                for n in c.GetNeighbors() if n.GetIdx() != hi]

        best_p, best_s = None, -1.0
        for k in range(72):
            ang = 2 * math.pi * k / 72
            cand = (pc.x + r * math.cos(ang), pc.y + r * math.sin(ang))
            s = _clearance(cand, m, conf, ci, skip)
            ux, uy = math.cos(ang), math.sin(ang)
            for d in dirs:
                if ux * d[0] + uy * d[1] > 0.94:      # 与已有键夹角 < ~20°
                    s *= 0.35
                    break
            if s > best_s:
                best_s, best_p = s, cand
        if best_p is not None:
            conf.SetAtomPosition(hi, (best_p[0], best_p[1], 0.0))
    return m


# ---------- 画布规划 -------------------------------------------------------

def _coords_box(mol: Chem.Mol):
    conf = mol.GetConformer()
    xs = [conf.GetAtomPosition(i).x for i in range(mol.GetNumAtoms())]
    ys = [conf.GetAtomPosition(i).y for i in range(mol.GetNumAtoms())]
    return min(xs), min(ys), max(xs), max(ys)


def _median_bond(mol: Chem.Mol) -> float:
    conf = mol.GetConformer()
    lens = []
    for b in mol.GetBonds():
        a = conf.GetAtomPosition(b.GetBeginAtomIdx())
        e = conf.GetAtomPosition(b.GetEndAtomIdx())
        d = math.hypot(a.x - e.x, a.y - e.y)
        if d > 0.1:
            lens.append(d)
    lens.sort()
    return lens[len(lens) // 2] if lens else 1.5


def plan(mol: Chem.Mol, bond_px: float, margin_units: float = 1.2):
    """画布尺寸。

    实测: RDKit 在「画布 / (键长 × 字号)」过小时会整体回缩, 键长就悄悄变了
    (示例: 键长 120 px 的画在 2000 px 画布上只剩 14 px)。要求
    画布 >= 2.8 * 键长 * 字号 才能保证键长精确。
    """
    x0, y0, x1, y1 = _coords_box(mol)
    ex, ey = max(x1 - x0, 0.5), max(y1 - y0, 0.5)
    bl = _median_bond(mol)
    scale = bond_px / bl
    m = margin_units * bond_px
    w = ex * scale + 2 * m
    h = ey * scale + 2 * m
    need = 2.8 * bond_px * max(8, int(bond_px * 0.50))
    return int(round(max(w, need))), int(round(max(h, need)))


def _prepare(smiles: str) -> Chem.Mol:
    mol = layout(parse(smiles))
    pre = rdMolDraw2D.PrepareMolForDrawing(mol, kekulize=True,
                                          addChiralHs=True, wedgeBonds=True)
    return fix_chiral_h(pre)


def make_opts(bond_px: float, color: bool, annotate: bool):
    o = rdMolDraw2D.MolDrawOptions()
    if not color:
        o.useBWAtomPalette()
    o.addStereoAnnotation = annotate
    o.padding = 0.0
    o.fixedBondLength = bond_px              # 钉死键长 -> 各分子同尺度
    o.bondLineWidth = max(1.5, round(bond_px * 0.06, 2))
    o.explicitMethyl = False
    o.additionalAtomLabelPadding = 0.10
    o.clearBackground = False                # 透明底
    # 字号必须 <= ~0.55*键长: 超过时 RDKit 会为塞下标签而整体回缩, 键长就不准了
    o.baseFontSize = int(bond_px * 0.50)
    o.minFontSize = max(8, int(bond_px * 0.40))
    o.maxFontSize = max(10, int(bond_px * 0.55))
    return o


def _measure_bond(d, mol) -> float | None:
    bs = mol.GetBonds()
    if not bs:
        return None
    b = bs[0]
    p0 = d.GetDrawCoords(b.GetBeginAtomIdx())
    p1 = d.GetDrawCoords(b.GetEndAtomIdx())
    return math.hypot(p0.x - p1.x, p0.y - p1.y)


def _draw_to_size(mol, bond_px, color, annotate, svg: bool, grow: float = 1.0):
    """画一次并校验键长; RDKit 在画布装不下标签时会整体回缩, 此时放大画布重画。"""
    cls = rdMolDraw2D.MolDraw2DSVG if svg else rdMolDraw2D.MolDraw2DCairo
    last = None
    for k in range(4):
        w, h = plan(mol, bond_px, 1.2 + 0.8 * k)
        w = int(min(w * grow, 20000))
        h = int(min(h * grow, 20000))
        d = cls(max(w, 40), max(h, 40))
        d.SetDrawOptions(make_opts(bond_px, color, annotate))
        d.DrawMolecule(mol)
        d.FinishDrawing()
        last = d
        got = _measure_bond(d, mol)
        if got is None or abs(got - bond_px) < 0.75:
            break
    return last


# ---------- SVG ------------------------------------------------------------

_SVG_TAG = re.compile(r"<svg\b[^>]*>")


def render_svg(smiles: str, bond_px: float = 42.0, *,
               color: bool = False, annotate: bool = False) -> str:
    mol = _prepare(smiles)
    d = _draw_to_size(mol, bond_px, color, annotate, svg=True)
    svg = d.GetDrawingText()
    box = _ink_box(d, mol, bond_px)
    if box is None:
        return svg
    x0, y0, x1, y1 = box
    m = _SVG_TAG.search(svg)
    if not m:
        return svg
    tag = re.sub(r"""\s(?:width|height|viewBox)=("[^"]*"|'[^']*')""", "", m.group(0))
    tag = tag.replace(
        "<svg",
        f'<svg width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" '
        f'viewBox="{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}"',
        1)
    return svg.replace(m.group(0), tag, 1)


def _ink_box(d, mol, bond_px):
    try:
        pts = [d.GetDrawCoords(i) for i in range(mol.GetNumAtoms())]
    except Exception:
        return None
    if not pts:
        return None
    pad = bond_px * 0.62
    return (min(p.x for p in pts) - pad, min(p.y for p in pts) - pad,
            max(p.x for p in pts) + pad, max(p.y for p in pts) + pad)


# ---------- PNG ------------------------------------------------------------

def render_png(smiles: str, path: str, bond_px: float = 42.0, *,
               color: bool = False, annotate: bool = False,
               margin_px: int = 6, transparent: bool = True) -> str:
    from PIL import Image

    mol = _prepare(smiles)
    d = _draw_to_size(mol, bond_px, color, annotate, svg=False)
    im = Image.open(io.BytesIO(d.GetDrawingText())).convert("RGBA")
    box = im.getbbox()
    if box:
        im = im.crop(box)
    if margin_px:
        cw, ch = im.size
        canvas = Image.new("RGBA", (cw + 2 * margin_px, ch + 2 * margin_px), (0, 0, 0, 0))
        canvas.paste(im, (margin_px, margin_px))
        im = canvas
    if not transparent:
        bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
        bg.alpha_composite(im)
        im = bg
    im.save(path, "PNG")
    return path
