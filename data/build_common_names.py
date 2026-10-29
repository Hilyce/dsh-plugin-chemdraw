# 生成 data/common-names.json：常用名 → InChIKey 前 14 位（骨架，忽略立体）
import json
import os
import sys

from rdkit import Chem, RDLogger
from rdkit.Chem.inchi import MolToInchiKey

RDLogger.DisableLog("rdApp.*")

COMPOUNDS = [
    ("水", "water", "O"),
    ("甲烷", "methane", "C"),
    ("乙烷", "ethane", "CC"),
    ("丙烷", "propane", "CCC"),
    ("丁烷", "butane", "CCCC"),
    ("异丁烷", "isobutane", "CC(C)C"),
    ("环丙烷", "cyclopropane", "C1CC1"),
    ("环戊烷", "cyclopentane", "C1CCCC1"),
    ("过氧化氢", "hydrogen peroxide", "OO"),
    ("甲醇", "methanol", "CO"),
    ("乙醇", "ethanol", "CCO"),
    ("丙醇", "propan-1-ol", "CCCO"),
    ("异丙醇", "propan-2-ol", "CC(C)O"),
    ("乙二醇", "ethylene glycol", "OCCO"),
    ("甘油", "glycerol", "OCC(O)CO"),
    ("甲醚", "dimethyl ether", "COC"),
    ("乙醚", "diethyl ether", "CCOCC"),
    ("甲醛", "formaldehyde", "C=O"),
    ("乙醛", "acetaldehyde", "CC=O"),
    ("丙酮", "acetone", "CC(C)=O"),
    ("丁酮", "butan-2-one", "CCC(C)=O"),
    ("甲酸", "formic acid", "OC=O"),
    ("乙酸", "acetic acid", "CC(=O)O"),
    ("丙酸", "propionic acid", "CCC(=O)O"),
    ("丁酸", "butyric acid", "CCCC(=O)O"),
    ("草酸", "oxalic acid", "OC(=O)C(=O)O"),
    ("乳酸", "lactic acid", "CC(O)C(=O)O"),
    ("苹果酸", "malic acid", "OC(=O)CC(O)C(=O)O"),
    ("酒石酸", "tartaric acid", "OC(=O)C(O)C(O)C(=O)O"),
    ("柠檬酸", "citric acid", "OC(=O)CC(O)(CC(=O)O)C(=O)O"),
    ("琥珀酸", "succinic acid", "OC(=O)CCC(=O)O"),
    ("苯甲酸", "benzoic acid", "OC(=O)c1ccccc1"),
    ("水杨酸", "salicylic acid", "OC(=O)c1ccccc1O"),
    ("阿司匹林", "aspirin", "CC(=O)Oc1ccccc1C(=O)O"),
    ("对乙酰氨基酚", "paracetamol", "CC(=O)Nc1ccc(O)cc1"),
    ("布洛芬", "ibuprofen", "CC(C)Cc1ccc(cc1)C(C)C(=O)O"),
    ("咖啡因", "caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C"),
    ("香草醛", "vanillin", "COc1cc(C=O)ccc1O"),
    ("苯", "benzene", "c1ccccc1"),
    ("甲苯", "toluene", "Cc1ccccc1"),
    ("苯酚", "phenol", "Oc1ccccc1"),
    ("苯胺", "aniline", "Nc1ccccc1"),
    ("硝基苯", "nitrobenzene", "O=[N+]([O-])c1ccccc1"),
    ("苯甲醛", "benzaldehyde", "O=Cc1ccccc1"),
    ("苯乙酮", "acetophenone", "CC(=O)c1ccccc1"),
    ("苯甲醇", "benzyl alcohol", "OCc1ccccc1"),
    ("苯乙烯", "styrene", "C=Cc1ccccc1"),
    ("邻甲酚", "o-cresol", "Cc1ccccc1O"),
    ("间甲酚", "m-cresol", "Cc1cccc(O)c1"),
    ("对甲酚", "p-cresol", "Cc1ccc(O)cc1"),
    ("苯甲酸乙酯", "ethyl benzoate", "CCOC(=O)c1ccccc1"),
    ("水杨酸甲酯", "methyl salicylate", "COC(=O)c1ccccc1O"),
    ("邻苯二甲酸", "phthalic acid", "OC(=O)c1ccccc1C(=O)O"),
    ("萘", "naphthalene", "c1ccc2ccccc2c1"),
    ("蒽", "anthracene", "c1ccc2cc3ccccc3cc2c1"),
    ("吡啶", "pyridine", "c1ccncc1"),
    ("呋喃", "furan", "c1ccoc1"),
    ("噻吩", "thiophene", "c1ccsc1"),
    ("咪唑", "imidazole", "c1c[nH]cn1"),
    ("吡咯", "pyrrole", "c1cc[nH]c1"),
    ("环氧乙烷", "oxirane", "C1CO1"),
    ("氯仿", "chloroform", "ClC(Cl)Cl"),
    ("四氯化碳", "carbon tetrachloride", "ClC(Cl)(Cl)Cl"),
    ("乙烯", "ethylene", "C=C"),
    ("乙炔", "acetylene", "C#C"),
    ("丙烯", "propene", "CC=C"),
    ("环己烷", "cyclohexane", "C1CCCCC1"),
    ("环己醇", "cyclohexanol", "OC1CCCCC1"),
    ("环己酮", "cyclohexanone", "O=C1CCCCC1"),
    ("樟脑", "camphor", "CC1(C)C2CCC1(C)C(=O)C2"),
    ("薄荷醇", "menthol", "CC(C)C1CCC(C)CC1O"),
    ("甘氨酸", "glycine", "NCC(=O)O"),
    ("丙氨酸", "alanine", "CC(N)C(=O)O"),
    ("谷氨酸", "glutamic acid", "OC(=O)CCC(N)C(=O)O"),
    ("半胱氨酸", "cysteine", "SC[C@@H](N)C(=O)O"),
    ("葡萄糖（开链）", "glucose (open chain)", "OCC(O)C(O)C(O)C(O)C=O"),
    ("葡萄糖（吡喃环）", "glucose (pyranose)", "OCC1OC(O)C(O)C(O)C1O"),
    ("果糖", "fructose", "OCC(O)C(O)C(=O)CO"),
    ("尿素", "urea", "NC(N)=O"),
    ("烟酸", "nicotinic acid", "OC(=O)c1cccnc1"),
    ("肉桂酸", "cinnamic acid", "OC(=O)/C=C/c1ccccc1"),
    ("咖啡酸", "caffeic acid", "OC(=O)/C=C/c1ccc(O)c(O)c1"),
    ("马来酸", "maleic acid", "OC(=O)/C=C\\C(=O)O"),
    ("富马酸", "fumaric acid", "OC(=O)/C=C/C(=O)O"),
    ("抗坏血酸", "ascorbic acid", "OC[C@H](O)[C@H]1OC(=O)C(O)=C1O"),
    ("三硝基甲苯", "TNT", "Cc1ccc([N+](=O)[O-])cc1[N+](=O)[O-]"),
    ("乙酰苯胺", "acetanilide", "CC(=O)Nc1ccccc1"),
    ("二苯醚", "diphenyl ether", "c1ccc(Oc2ccccc2)cc1"),
    ("苯磺酸", "benzenesulfonic acid", "OS(=O)(=O)c1ccccc1"),
    ("乙二胺", "ethylenediamine", "NCCN"),
    ("三乙胺", "triethylamine", "CCN(CC)CC"),
    ("乙酸酐", "acetic anhydride", "CC(=O)OC(C)=O"),
    ("乙酰氯", "acetyl chloride", "CC(=O)Cl"),
]

entries = {}
skipped = []
collided = []

for zh, en, smiles in COMPOUNDS:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        skipped.append((zh, smiles))
        continue
    key = MolToInchiKey(mol)
    if not key:
        skipped.append((zh, smiles))
        continue
    entries[key] = {
        "zh": zh,
        "en": en,
        "smiles": Chem.MolToSmiles(mol),
    }

out = {
    "version": 1,
    "note": "Full InChIKey entries; lookup falls back to the first 14 chars (connectivity, stereo-insensitive).",
    "entries": [{"key": k, **v} for k, v in sorted(entries.items())],
}

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "common-names.json")
with open(path, "w", encoding="utf-8") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)

print(f"wrote {len(entries)} entries -> {path}")
print("skipped:", skipped)
print("collided:", collided)



