"""SMILES -> 键线式 常驻 worker。

宿主插件启动它一次, 之后每行一个 JSON 请求 / 一行响应。

单分子:
  {"op": "render", "smiles": "CCO", "format": "svg|png", "bond": 42,
   "color": false, "annotate": false, "white": false}
反应式:
  {"op": "scheme", "scheme": "A.B>>C", "format": "svg|png", "bond": 42, "reagents": "H2SO4"}
批量:
  {"op": "batch", "items": [{"name": "...", "smiles": "..."}], "outDir": "D:\\x",
   "format": "svg|png", "bond": 42, "color": false, "annotate": false}

响应: {"ok": true, ...} / {"ok": false, "error": "..."}
常驻是为了避开每条请求重新 import RDKit 的 ~0.6s 开销。
"""
import base64
import io
import json
import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import render  # noqa: E402
import scheme as schemes  # noqa: E402
import identify as identify_mod  # noqa: E402


def _bool(v) -> bool:
    return v is True or v == 1 or v == "1"


def _opts(req):
    return dict(
        bond_px=float(req.get("bond") or 42),
        color=_bool(req.get("color")),
        annotate=_bool(req.get("annotate")),
    )


def handle(req: dict) -> dict:
    op = (req.get("op") or "render").lower()
    fmt = (req.get("format") or "svg").lower()
    fmt = "png" if fmt == "png" else "svg"
    opts = _opts(req)

    if op == "scheme":
        sch = (req.get("scheme") or "").strip()
        if not sch:
            return {"ok": False, "error": "缺少 scheme"}
        reagents = (req.get("reagents") or "").strip() or None
        if fmt == "svg":
            return {"ok": True, "format": "svg",
                    "data": schemes.render_scheme_svg(sch, opts["bond_px"],
                                                     color=opts["color"],
                                                     annotate=opts["annotate"],
                                                     reagents=reagents)}
        buf = io.BytesIO()
        schemes.render_scheme_png(sch, buf, opts["bond_px"], color=opts["color"],
                                  annotate=opts["annotate"], reagents=reagents)
        return {"ok": True, "format": "png",
                "data": base64.b64encode(buf.getvalue()).decode("ascii")}

    if op == "identify":
        return identify_mod.identify(
            molblock=(req.get("molblock") or "").strip() or None,
            smiles=(req.get("smiles") or "").strip() or None,
        )

    if op == "batch":
        out_dir = (req.get("outDir") or "").strip()
        if not out_dir:
            return {"ok": False, "error": "缺少 outDir"}
        raw = req.get("items") or []
        items = []
        for i, it in enumerate(raw):
            if isinstance(it, str):
                items.append((schemes.safe_name(i + 1, it), it))
            else:
                smi = (it.get("smiles") or "").strip()
                if not smi:
                    continue
                items.append(((it.get("name") or "").strip()
                              or schemes.safe_name(i + 1, smi), smi))
        if not items:
            return {"ok": False, "error": "没有可渲染的结构"}
        try:
            files = schemes.render_batch(items, out_dir, fmt, **opts)
        except OSError as exc:
            return {"ok": False, "error": f"写入失败: {exc}"}
        return {"ok": True, "op": "batch", "format": fmt, "dir": out_dir,
                "files": files, "count": len(files),
                "index": os.path.join(out_dir, "index.html")}

    # op == render
    smiles = (req.get("smiles") or "").strip()
    if not smiles:
        return {"ok": False, "error": "缺少 smiles"}
    if fmt == "svg":
        return {"ok": True, "format": "svg",
                "data": render.render_svg(smiles, opts["bond_px"],
                                          color=opts["color"], annotate=opts["annotate"])}
    buf = io.BytesIO()
    render.render_png(smiles, buf, opts["bond_px"], color=opts["color"],
                      annotate=opts["annotate"],
                      margin_px=int(req.get("margin") or 4),
                      transparent=not _bool(req.get("white")))
    return {"ok": True, "format": "png",
            "data": base64.b64encode(buf.getvalue()).decode("ascii")}


def main() -> None:
    from rdkit import RDLogger
    RDLogger.DisableLog("rdApp.*")            # 别把 RDKit 告警混进协议流
    for line in sys.stdin:
        # Windows 管道/带 BOM 的文件会在行首塞一个 \ufeff，json 解析会直接失败
        line = line.lstrip("\ufeff").strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            print(json.dumps({"ok": False, "error": "请求不是合法 JSON"}), flush=True)
            continue
        try:
            res = handle(req)
        except Exception as exc:               # noqa: BLE001
            res = {"ok": False, "error": str(exc) or exc.__class__.__name__,
                   "trace": traceback.format_exc(limit=3)}
        print(json.dumps(res), flush=True)


if __name__ == "__main__":
    main()
