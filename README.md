# dsh-plugin-chemdraw

把 SMILES 渲染成**键线式**结构图，专为放进 Word 文档、画反应式和批量出图设计。

- **透明底**：没有白块、没有边框，压在 Word 白页上自然融合
- **紧裁边**：按墨迹范围裁切，四周只有几个像素
- **键长统一**：`bond` 相同的结构在任何尺寸下键长都精确一致，一张图里多个分子自动对齐
- **矢量输出**：SVG 任意缩放不糊（Word 2016+ 直接插入），需要位图时给 PNG
- **立体化学画对**：手性 H 的位置经过几何重算，稠环/桥环上不再压住相邻键线

适用 DSH 桌面版；自带 RDKit 运行时，本机不需要装 Python 或化学库。

## 安装

**方式一（界面，推荐）**：侧栏「插件」→ **添加插件** → 输入包名 `dsh-plugin-chemdraw` → 安装 → 立即启用。

**方式二（命令行）**：

```bash
dsh plugin --profile desktop add dsh-plugin-chemdraw
```

**方式三（本地目录，开发时用）**：

```bash
dsh plugin --profile desktop add "D:\path\to\dsh-plugin-chemdraw"
```

装完**重启 DeepSeek Harness**（完全退出再打开），Host 才会加载新的插件代码。
面板只需刷新页面（F5）。

### 在 Discover 里搜到

DSH 的 **Discover** 标签读的不是 npm 搜索，而是**插件市场索引**（一份 format 1 的 JSON）。
本仓库自带一份索引：`market/index.json`。把它发布到 GitHub Pages 后，在
「插件 → Discover → 添加索引源」里填：

```
https://Hilyce.github.io/dsh-plugin-chemdraw/market/index.json
```

之后就能在 Discover 里搜 `chemdraw` / `smiles` / `结构式` 并直接安装。
索引随 `npm run market:index` 重新生成，详见 [PUBLISH.md](PUBLISH.md)。

## 三个入口

### 1. 右侧栏面板

侧栏「+」→ **结构式**，三种模式：

| 模式 | 输入 | 用途 |
|---|---|---|
| **单分子** | 每行一个 SMILES | 逐张预览；**复制 PNG** 后直接在 Word 里 Ctrl+V，或下载 PNG/SVG |
| **反应式** | `底物.底物>>产物.产物`，可填箭头条件 | 自动排版箭头与「+」，各组分同尺度 |
| **批量** | 每行一个 SMILES + 输出目录 | 导出成文件夹，附带 `index.html` 预览页 |

PNG 是 4 倍超采样后从矢量重绘的，粘进 Word 或放大看都不糊。

### 2. Agent 工具

```
smiles_to_structure(smiles="CC(=O)Oc1ccccc1C(=O)O", out="D:\\x\\aspirin.svg", bond=42)
smiles_reaction(scheme="CC(=O)O.OCC>>CC(=O)OCC.O", out="D:\\x\\rxn.svg", reagents="H2SO4, cat.")
smiles_batch(smiles="CCO\nc1ccccc1O", outDir="D:\\x\\batch", format="png")
```

`out` / `outDir` 必须是绝对路径（Host 的工作目录是 profile 目录，不适合当默认输出位置）。

### 3. HTTP 路由

```
GET  /chemdraw/render?smiles=CCO&format=svg&bond=42&color=0&annotate=0&white=0
GET  /chemdraw/reaction?scheme=A.B>>C&reagents=H2SO4&format=svg
POST /chemdraw/batch  {items:[{smiles}], outDir:"D:\\x", format:"svg"}
```

`color=1` 彩色杂原子，`annotate=1` 标 R/S，`white=1` 白底不透明（默认透明）。

## 依赖

插件自带 RDKit 运行时（`runtime/`，cp312 wheel，约 57 MB），使用 DSH 桌面版内置的
Python 3.12，不需要你本机装任何东西。

要换解释器或加搜索路径，在 profile 的 `cordis.patch.yml` 里覆盖：

```yaml
- id: chemdraw
  name: dsh-plugin-chemdraw
  config:
    pythonPath: 'C:\Python312\python.exe'    # 默认用内置 runtime
    pyPath: 'D:\somewhere\site-packages'     # 额外 PYTHONPATH（rdkit 所在目录）
    timeoutMs: 25000
```

## 实现

```
index.js     Host 半侧：3 个 HTTP 路由 + 3 个 agent 工具 + Python worker 管理
client.js    浏览器半侧：右侧栏 tab（三种模式），只用 --dsw-alias-* 主题变量
worker.py    常驻渲染进程，一行请求一行响应，避免每条请求重新 import RDKit
render.py    单分子渲染：布局、手性 H 修正、透明底、紧裁、固定键长
scheme.py    反应式拼装（SVG 用 <g transform> 拼、PNG 用 PIL 拼）与批量导出
runtime/     RDKit（cp312）
scripts/     发布辅助：生成市场索引、替换仓库占位符
market/      插件市场索引（Discover 用）
```

### 两个值得记下的坑

**1. RDKit 的 `fixedBondLength` 会静默回缩。**
当「画布 /（键长 × 字号）」过小时，RDKit 为了塞下原子标签会把整张画缩放，
键长就不准了（实测键长 120 px 的画在 2000 px 画布上只剩 14 px）。
现在画布按 `2.8 × 键长 × 字号` 兜底，绘制后用 `GetDrawCoords` 实测键长校验，
不一致就放大画布重画。这是「多分子同尺度」能成立的前提。

**2. 手性 H 默认会压键线。**
`PrepareMolForDrawing` 补出来的手性 H 只按「背离邻居质心」定位，在稠环/桥环的
环并处那个方向正好插进环内。现在对每个手性 H 采样 72 个方向，按「到其它原子、
到其它键段」的最小距离打分取最空旷处；楔形属性不动，立体化学读法不变。

## 发布

推 GitHub、发 npm、更新市场索引的完整步骤见 [PUBLISH.md](PUBLISH.md)。

## 许可

MIT。`runtime/` 内是未修改的 RDKit wheel（BSD 3-Clause，见 `runtime/rdkit/license.txt`）。
