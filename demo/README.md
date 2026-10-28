# 演示页

一个自包含的动画演示页，线上地址：

**<https://Hilyce.github.io/dsh-plugin-chemdraw/demo/>**

![预览](preview.png)

## 内容

- 首屏：阿司匹林结构式逐笔画出（SVG 用 `stroke-dashoffset` 描边动画）
- 输入 → 输出：模拟右侧栏面板，打字机循环四个 SMILES，右侧同步出图
- 反应式：酯化反应从左到右揭示，带重播按钮
- 特性卡片：透明底（棋盘格）、紧裁边、键长统一、立体化学
- 三个入口：面板 / Agent 工具 / HTTP 路由
- 六个真实渲染的分子 + 安装命令（带复制）

页面里所有结构式都是插件自己渲染出来的，不是示意图。

## 结构

```
demo/
├─ index.html     ← 生成物，直接部署（GitHub Pages 用这个）
├─ template.html  ← 手写模板，结构 / 样式 / 交互都在这里
├─ build.mjs      ← 把模板 + assets 里的 SVG 内联成一个单文件
└─ assets/        ← 插件输出的 SVG / PNG 素材
```

## 改内容

改 `template.html`，然后重新生成：

```bash
node demo/build.mjs
```

`{{SVG:aspirin}}` 这类占位符会被换成 `assets/aspirin.svg` 的内联内容，并去掉根元素的
`width` / `height`（保留 `viewBox`），这样动画和自适应都交给 CSS 控制。

## 换素材

素材是用插件自己生成的，例如：

```bash
# 单个分子（SVG，透明底）
smiles_to_structure(smiles="CC(=O)Oc1ccccc1C(=O)O", out="demo/assets/aspirin.svg", bond=42, color=true)

# 反应式
smiles_reaction(scheme="CC(=O)O.OCC>>CC(=O)OCC.O", reagents="H2SO4, cat.", out="demo/assets/esterification.svg", color=true)

# 位图（棋盘格那张要用 PNG 才能体现透明）
smiles_to_structure(smiles="CC(=O)Oc1ccccc1C(=O)O", out="demo/assets/aspirin.png", bond=42, color=true)
```

所有单分子都用 `bond=42`，这样放在一起键长是一致的。

## 注意

- 页面不依赖任何 CDN / 字体 / JS 库，`file://` 直接打开也能用；
- 动画全部尊重 `prefers-reduced-motion`，系统开了“减少动态”就只剩静态版；
- `index.html` 是生成物，改样式请改 `template.html`，否则下次 `build` 会被覆盖。
