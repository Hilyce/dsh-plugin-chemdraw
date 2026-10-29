"""结构识别：molblock / SMILES -> 规范 SMILES、分子式、分子量、InChI、IUPAC 名、常用名。

- IUPAC 名由 openclatura（离线、确定性、按 IUPAC 蓝皮书规则）生成；
- 常用名来自 data/common-names.json：先按完整 InChIKey 精确匹配，再退回前 14 位（骨架，忽略立体）；
- 手绘的 molblock 会被 RDKit 做价态检查，原子价态超了会明确报错。
"""
import json
import os

from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors, rdMolDescriptors
from rdkit.Chem.inchi import MolToInchi, MolToInchiKey

RDLogger.DisableLog("rdApp.*")

_DATA = None
_NAMER = None
_DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "common-names.json")


def _data():
    global _DATA
    if _DATA is None:
        full, skel = {}, {}
        try:
            with open(_DATA_PATH, encoding="utf-8") as fh:
                doc = json.load(fh)
            for entry in doc.get("entries", []):
                key = entry.get("key") or ""
                if len(key) < 14:
                    continue
                full[key] = entry
                skel.setdefault(key[:14], entry)
        except OSError:
            pass
        _DATA = (full, skel)
    return _DATA


def _namer():
    global _NAMER
    if _NAMER is None:
        from openclatura import name_smiles  # 懒加载：第一次命名时才 import

        _NAMER = name_smiles
    return _NAMER


def identify(molblock=None, smiles=None) -> dict:
    mol = None
    if molblock:
        try:
            mol = Chem.MolFromMolBlock(molblock, sanitize=True, removeHs=False)
        except Exception:
            mol = None
        if mol is None:
            return {
                "ok": False,
                "error": "结构不合法：RDKit 无法解析。常见原因是某个原子的键数超过了它的价态（例如碳连了 5 根键）。",
            }
    elif smiles:
        try:
            mol = Chem.MolFromSmiles(smiles)
        except Exception:
            mol = None
        if mol is None:
            return {"ok": False, "error": "SMILES 解析失败"}
    else:
        return {"ok": False, "error": "缺少 molblock 或 smiles"}

    canonical = Chem.MolToSmiles(mol)
    try:
        inchi = MolToInchi(mol)
    except Exception:
        inchi = ""
    try:
        inchikey = MolToInchiKey(mol)
    except Exception:
        inchikey = ""

    full, skel = _data()
    common = None
    match = "none"
    if inchikey:
        hit = full.get(inchikey)
        if hit is not None:
            common, match = hit, "exact"
        else:
            hit = skel.get(inchikey[:14])
            if hit is not None:
                common, match = hit, "skeleton"

    iupac = None
    try:
        iupac = _namer()(canonical)
    except Exception:
        iupac = None

    return {
        "ok": True,
        "smiles": canonical,
        "formula": rdMolDescriptors.CalcMolFormula(mol),
        "mw": round(Descriptors.MolWt(mol), 2),
        "inchi": inchi,
        "inchikey": inchikey,
        "iupac": iupac,
        "common": None if common is None else {
            "zh": common.get("zh", ""),
            "en": common.get("en", ""),
            "match": match,
        },
        "atoms": mol.GetNumAtoms(),
    }
