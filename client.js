/**
 * dsh-chemdraw — SMILES -> 键线式（Client 半侧）
 *
 * 右侧栏的一个 tab，三种模式：
 *   单分子  每行一个 SMILES，逐张预览
 *   反应式  "A.B>>C"，箭头上方可写条件
 *   批量    一串 SMILES 导出成文件夹 + index.html 预览页
 *
 * 渲染在 Host 侧完成（RDKit），这里只负责界面与 fetch。
 */
window.__ModuleLoader__.load({
  // 必须与 package.json 的 name 完全一致：客户端模块按包名登记工厂，
  // 名字对不上时 immediately 的模块在启动阶段找不到工厂，整页会起不来。
  id: 'dsh-plugin-chemdraw',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'chemdraw'
    const TAB_ID = 'dsh-chemdraw/panel'
    const TAB_KIND = 'dsh-chemdraw-panel'
    const ROUTE_RENDER = '/chemdraw/render'
    const ROUTE_REACTION = '/chemdraw/reaction'
    const ROUTE_BATCH = '/chemdraw/batch'

    const zh = {
      'tab.title': '结构式',
      'panel.title': 'SMILES → 键线式',
      'mode.single': '单分子',
      'mode.rxn': '反应式',
      'mode.batch': '批量',
      'panel.placeholder': '每行一个 SMILES，例如\nCC(=O)Oc1ccccc1C(=O)O',
      'rxn.placeholder': '每行一个反应式，用 >> 分隔，组分用 . 分隔，例如\nCC(=O)O.OCC>>CC(=O)OCC.O',
      'rxn.reagents': '箭头条件（可选）',
      'rxn.reagentsPh': '例如 H2SO4, cat.',
      'batch.placeholder': '每行一个 SMILES',
      'batch.outDir': '输出目录',
      'batch.outDirPh': '绝对路径，例如 D:\\out\\batch1',
      'batch.export': '导出到文件夹',
      'batch.exporting': '导出中…',
      'batch.done': '已导出 {n} 个文件 → {dir}',
      'batch.doneHint': '预览页：{index}',
      'panel.render': '渲染',
      'panel.rendering': '渲染中…',
      'panel.bond': '键长',
      'panel.color': '彩色杂原子',
      'panel.annotate': '标注 R/S',
      'panel.clear': '清空',
      'panel.hint': '透明底、紧裁边，可直接放进 Word；同一张图里多个结构用同一键长就能对齐。',
      'panel.empty': '输入 SMILES 后点「渲染」。',
      'panel.downloadPng': '下载 PNG',
      'panel.downloadSvg': '下载 SVG',
      'panel.copy': '复制 PNG',
      'panel.copied': '已复制，去 Word 里 Ctrl+V',
      'panel.copyFailed': '复制失败，请用「下载 PNG」',
      'panel.failed': '渲染失败：{msg}',
      'mode.draw': '手绘',
      'draw.tool.select': '选择',
      'draw.tool.carbon': '碳',
      'draw.tool.erase': '擦除',
      'draw.bond.1': '单键',
      'draw.bond.2': '双键',
      'draw.bond.3': '三键',
      'draw.undo': '撤销',
      'draw.redo': '重做',
      'draw.clear': '清空',
      'draw.palette': '模板',
      'draw.hint': '点「碳」再点空白 = 放一个碳；从已有原子往空白拖 = 画碳链；把 N / O / 苯环拖到画板 = 直接放上去。',
      'draw.empty': '空白画板：选「碳」后点一下，或从左边模板拖一个苯环进来',
      'draw.copy': '复制 PNG',
      'draw.png': '下载 PNG',
      'draw.svg': '下载 SVG',
      'draw.copied': '已复制，去 Word 里 Ctrl+V',
      'draw.copyFail': '复制失败，请用「下载 PNG」',
      'draw.needAtoms': '画板还是空的',
      'draw.status': '{n} 原子 · {m} 键',
      'draw.identifying': '识别中…',
      'draw.rendering': '渲染中…',
      'draw.unnameable': '—（无法命名）',
      'draw.noCommon': '—（未收录）',
      'draw.skeleton': '（按骨架匹配）',
      'draw.copiedSmiles': '已复制 SMILES',
      'draw.rendered': 'RDKit 渲染',
      'draw.ring': '苯环',
    }
    const en = {
      'tab.title': 'Structure',
      'panel.title': 'SMILES → skeletal formula',
      'mode.single': 'Molecules',
      'mode.rxn': 'Reaction',
      'mode.batch': 'Batch',
      'panel.placeholder': 'One SMILES per line, e.g.\nCC(=O)Oc1ccccc1C(=O)O',
      'rxn.placeholder': 'One scheme per line, ">>" between sides, "." between components, e.g.\nCC(=O)O.OCC>>CC(=O)OCC.O',
      'rxn.reagents': 'Conditions over the arrow (optional)',
      'rxn.reagentsPh': 'e.g. H2SO4, cat.',
      'batch.placeholder': 'One SMILES per line',
      'batch.outDir': 'Output folder',
      'batch.outDirPh': 'Absolute path, e.g. D:\\out\\batch1',
      'batch.export': 'Export to folder',
      'batch.exporting': 'Exporting…',
      'batch.done': 'Exported {n} files → {dir}',
      'batch.doneHint': 'Preview page: {index}',
      'panel.render': 'Render',
      'panel.rendering': 'Rendering…',
      'panel.bond': 'Bond',
      'panel.color': 'Colored heteroatoms',
      'panel.annotate': 'R/S labels',
      'panel.clear': 'Clear',
      'panel.hint': 'Transparent background, tight crop — drop straight into Word. One bond length keeps multi-structure figures aligned.',
      'panel.empty': 'Type SMILES, then Render.',
      'panel.downloadPng': 'PNG',
      'panel.downloadSvg': 'SVG',
      'panel.copy': 'Copy PNG',
      'panel.copied': 'Copied — paste into Word',
      'panel.copyFailed': 'Copy failed, use Download PNG',
      'panel.failed': 'Render failed: {msg}',
      'mode.draw': 'Draw',
      'draw.tool.select': 'Select',
      'draw.tool.carbon': 'Carbon',
      'draw.tool.erase': 'Eraser',
      'draw.bond.1': 'Single',
      'draw.bond.2': 'Double',
      'draw.bond.3': 'Triple',
      'draw.undo': 'Undo',
      'draw.redo': 'Redo',
      'draw.clear': 'Clear',
      'draw.palette': 'Templates',
      'draw.hint': 'Pick Carbon and click empty space to drop one; drag from an atom to grow a chain; drag N / O / benzene onto the board.',
      'draw.empty': 'Empty board: pick Carbon and click, or drag a benzene ring in',
      'draw.copy': 'Copy PNG',
      'draw.png': 'PNG',
      'draw.svg': 'SVG',
      'draw.copied': 'Copied — paste into Word',
      'draw.copyFail': 'Copy failed, use PNG',
      'draw.needAtoms': 'The board is empty',
      'draw.status': '{n} atoms · {m} bonds',
      'draw.identifying': 'Naming…',
      'draw.rendering': 'Rendering…',
      'draw.unnameable': '— (unnamed)',
      'draw.noCommon': '— (not listed)',
      'draw.skeleton': ' (skeleton match)',
      'draw.copiedSmiles': 'SMILES copied',
      'draw.rendered': 'RDKit render',
      'draw.ring': 'Benzene',
    }

    const S = {
      root: {
        display: 'flex', flexDirection: 'column', gap: 10, padding: 12,
        height: '100%', boxSizing: 'border-box', overflowY: 'auto',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'var(--dsw-font-s-14)',
      },
      title: { font: 'var(--dsw-font-m-18)', margin: 0 },
      modes: {
        display: 'flex', gap: 2, padding: 2,
        background: 'var(--dsw-alias-bg-layer-2)',
        borderRadius: 'var(--dsw-radius-sm)',
        border: '1px solid var(--dsw-alias-border-l1)',
      },
      mode: (active) => ({
        flex: 1, padding: '5px 8px', cursor: 'pointer', border: 'none',
        borderRadius: 'var(--dsw-radius-xs)',
        background: active ? 'var(--dsw-alias-bg-layer-1)' : 'transparent',
        color: active ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
        font: 'var(--dsw-font-xxs-12)',
        boxShadow: active ? 'var(--dsw-shadow-lv1)' : 'none',
      }),
      area: {
        width: '100%', boxSizing: 'border-box', resize: 'vertical',
        minHeight: 74, padding: '8px 10px',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'var(--dsw-font-xs-13)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        outline: 'none',
      },
      input: {
        width: '100%', boxSizing: 'border-box', padding: '6px 8px',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'var(--dsw-font-xxs-12)', outline: 'none',
      },
      row: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
      col: { display: 'flex', flexDirection: 'column', gap: 4 },
      label: { color: 'var(--dsw-alias-label-secondary)', font: 'var(--dsw-font-xxs-12)' },
      num: {
        width: 56, padding: '4px 6px', boxSizing: 'border-box',
        background: 'var(--dsw-alias-bg-layer-2)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-xs)',
        color: 'var(--dsw-alias-label-primary)', font: 'var(--dsw-font-xxs-12)',
      },
      btn: {
        padding: '6px 12px', cursor: 'pointer', border: 'none',
        borderRadius: 'var(--dsw-radius-sm)',
        background: 'var(--dsw-alias-button-primary-fill)',
        color: 'var(--dsw-alias-label-primary-inverted)',
        font: 'var(--dsw-font-xs-strong-13)',
      },
      btnGhost: {
        padding: '5px 10px', cursor: 'pointer',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 'var(--dsw-radius-sm)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        font: 'var(--dsw-font-xxs-12)',
      },
      check: { display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' },
      hint: { color: 'var(--dsw-alias-label-tertiary)', font: 'var(--dsw-font-xxs-12)', lineHeight: 1.5 },
      error: { color: 'var(--dsw-alias-state-error-primary)', font: 'var(--dsw-font-xxs-12)' },
      ok: { color: 'var(--dsw-alias-state-success-primary)', font: 'var(--dsw-font-xxs-12)', wordBreak: 'break-all' },
      card: {
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: 'var(--dsw-radius-md)',
        padding: 8, display: 'flex', flexDirection: 'column', gap: 6,
      },
      // “纸面”预览：结构图是黑线，必须放白底上才看得清
      paper: {
        background: '#ffffff', borderRadius: 'var(--dsw-radius-sm)',
        padding: 6, display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: 60, overflow: 'auto',
      },
      img: { maxWidth: '100%', height: 'auto', display: 'block' },
      mono: {
        color: 'var(--dsw-alias-label-tertiary)',
        font: 'var(--dsw-font-xxs-12)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        wordBreak: 'break-all',
      },
    }

    /** 把 SVG 画进 canvas，导出任意倍率 PNG */
    function svgToPngBlob(svg, scale) {
      return new Promise((resolve, reject) => {
        const m = /<svg[^>]*\swidth="([\d.]+)"[^>]*\sheight="([\d.]+)"/.exec(svg)
        const w = m ? parseFloat(m[1]) : 300
        const hgt = m ? parseFloat(m[2]) : 200
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
        const img = new Image()
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = Math.max(1, Math.round(w * scale))
            canvas.height = Math.max(1, Math.round(hgt * scale))
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(url)
              if (blob) resolve(blob)
              else reject(new Error('toBlob failed'))
            }, 'image/png')
          } catch (err) {
            URL.revokeObjectURL(url)
            reject(err)
          }
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('SVG 载入失败'))
        }
        img.src = url
      })
    }

    function download(blob, name) {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }

    function stem(text, i) {
      const cleaned = String(text).replace(/[^A-Za-z0-9]+/g, '_').slice(0, 28) || 'structure'
      return `${String(i + 1).padStart(2, '0')}_${cleaned}`
    }

    /* ===================================================================
     * 手绘键线式：一个不依赖 React 的 DOM 组件
     *  - 点「碳」→ 点空白 = 一个碳（孤立碳显示 CH₄）
     *  - 按住已有原子往空白拖 = 沿 30° 方向长碳链（一次拖动可以画多个键）
     *  - 把 N/O/苯环从模板拖到画板 = 直接放置；拖到已有原子上 = 改元素
     *  - 导出透明底 PNG / SVG，和 SMILES 渲染出来的图一样能进 Word
     * =================================================================== */
    const DB_STYLE = `
.cdb{display:flex;flex-direction:column;gap:8px;color:var(--dsw-alias-label-primary,#e8ecf4)}
.cdb-row{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cdb-btn{display:inline-flex;align-items:center;gap:4px;padding:4px 9px;border-radius:7px;
  border:1px solid var(--dsw-alias-border-l2,#2a3242);background:transparent;
  color:var(--dsw-alias-label-secondary,#9aa4b8);cursor:pointer;font:inherit;line-height:1.5;
  transition:background .15s,color .15s,border-color .15s}
.cdb-btn:hover{background:var(--dsw-alias-bg-layer-2,#161b24);color:var(--dsw-alias-label-primary,#e8ecf4)}
.cdb-btn.on{background:var(--dsw-alias-bg-layer-1,#1d2430);border-color:var(--dsw-alias-border-l1,#3a465c);
  color:var(--dsw-alias-label-primary,#e8ecf4);box-shadow:var(--dsw-shadow-lv1,0 1px 2px rgba(0,0,0,.35))}
.cdb-btn:disabled{opacity:.35;cursor:default}
.cdb-sep{width:1px;height:18px;background:var(--dsw-alias-border-l1,#2a3242);margin:0 3px}
.cdb-palette{padding:2px 0 1px}
.cdb-chip{min-width:30px;padding:4px 9px;border-radius:7px;border:1px solid var(--dsw-alias-border-l2,#2a3242);
  background:rgba(255,255,255,.02);color:var(--dsw-alias-label-secondary,#c9d2e3);cursor:pointer;
  font:inherit;line-height:1.5;transition:background .15s,border-color .15s,color .15s}
.cdb-chip:hover{background:rgba(255,255,255,.07);color:var(--dsw-alias-label-primary,#fff)}
.cdb-chip.on{background:rgba(91,157,255,.18);border-color:rgba(91,157,255,.65);color:#cfe2ff}
.cdb-chip.ring{font-weight:600;letter-spacing:.02em}
.cdb-stage{position:relative;width:100%;aspect-ratio:4/3;min-height:250px;background:#fff;
  border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#2a3242);overflow:hidden;
  touch-action:none;cursor:crosshair;user-select:none}
.cdb-svg{display:block;width:100%;height:100%}
.cdb-clear-float{position:absolute;top:8px;right:8px;z-index:2;padding:3px 9px;border-radius:6px;border:1px solid rgba(0,0,0,.12);background:rgba(255,255,255,.9);color:#4b5563;font:11px/1.6 system-ui,sans-serif;cursor:pointer;opacity:.8}
.cdb-clear-float:hover{opacity:1}
.cdb-clear-float[disabled]{display:none}
.cdb-empty{position:absolute;inset:0;display:grid;place-items:center;padding:0 18px;
  color:#9aa4b8;font:12px/1.6 system-ui,sans-serif;text-align:center;pointer-events:none}
.cdb-status{margin-left:auto;color:var(--dsw-alias-label-tertiary,#6b7488);font-size:11.5px;white-space:nowrap}
.cdb-info{display:flex;flex-direction:column;gap:6px;padding:9px 10px;
  border:1px solid var(--dsw-alias-border-l1,#2a3242);border-radius:8px;background:rgba(255,255,255,.025)}
.cdb-info[hidden]{display:none}
.cdb-line{display:flex;gap:8px;align-items:baseline;min-width:0}
.cdb-k{flex:none;width:54px;font-size:11px;color:var(--dsw-alias-label-tertiary,#6b7488)}
.cdb-v{font-size:12.5px;line-height:1.45;color:var(--dsw-alias-label-primary,#e8ecf4);word-break:break-word;min-width:0}
.cdb-meta{font-size:11.5px;color:var(--dsw-alias-label-secondary,#9aa4b8);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.cdb-info-actions{flex-wrap:wrap;gap:6px}
.cdb-render{margin-top:4px;display:flex;flex-direction:column;gap:6px}
.cdb-render[hidden]{display:none}
.cdb-render-canvas{background:#fff;border-radius:6px;min-height:110px;max-height:240px;display:grid;place-items:center;overflow:hidden;padding:8px}
.cdb-render-canvas svg{max-width:100%;max-height:224px;width:auto;height:auto;display:block}
.cdb-render-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#6b7488)}
.cdb-err{color:var(--dsw-alias-state-error-primary,#f87171);font-size:11.5px;line-height:1.5}
`

    function ensureDrawStyle() {
      if (document.getElementById('dsh-chemdraw-draw-style')) return
      const el = document.createElement('style')
      el.id = 'dsh-chemdraw-draw-style'
      el.textContent = DB_STYLE
      document.head.appendChild(el)
    }

    const DB_BOND = 42
    const DB_GRID = 21
    const DB_COLORS = {
      C: '#111111', N: '#0000ff', O: '#ff0000', S: '#a07c00',
      P: '#ff8000', F: '#0a9e0a', Cl: '#0a9e0a', Br: '#0a9e0a', I: '#0a9e0a',
    }
    const DB_PALETTE = [
      { brush: 'benzene', label: 'ring', ring: true },
      { brush: 'C', label: 'C' },
      { brush: 'N', label: 'N' },
      { brush: 'O', label: 'O' },
      { brush: 'S', label: 'S' },
      { brush: 'P', label: 'P' },
      { brush: 'F', label: 'F' },
      { brush: 'Cl', label: 'Cl' },
      { brush: 'Br', label: 'Br' },
      { brush: 'I', label: 'I' },
      { brush: 'OH', label: 'OH', el: 'O' },
      { brush: 'NH₂', label: 'NH₂', el: 'N' },
      { brush: 'CH₃', label: 'CH₃', el: 'C' },
    ]

    class DrawBoard {
      constructor(host, opts = {}) {
        this.t = typeof opts.t === 'function' ? opts.t : (k) => k
        this.host = host
        this.atoms = []
        this.bonds = []
        this.seq = 1
        this.tool = 'draw'
        this.brush = 'C'
        this.order = 1
        this.selectedId = null
        this.drag = null
        this.pending = null
        this.ghost = null
        this.history = []
        this.future = []
        this.note = ''
        this._build()
        this._wire()
        this.render()
      }

      /* ---------- DOM ---------- */
      _build() {
        ensureDrawStyle()
        const root = document.createElement('div')
        root.className = 'cdb'
        root.innerHTML =
          '<div class="cdb-row" data-role="tools"></div>' +
          '<div class="cdb-row cdb-palette" data-role="palette"></div>' +
          '<div class="cdb-stage" data-role="stage">' +
          '  <svg class="cdb-svg" viewBox="0 0 420 315" preserveAspectRatio="xMidYMid meet"></svg>' +
          '  <div class="cdb-empty" data-role="empty"></div>' +
          '  <button type="button" class="cdb-clear-float" data-role="clear-float" title="清空画板">清空</button>' +
          '</div>' +
          '<div class="cdb-info" data-role="info" hidden>' +
          '  <div class="cdb-line"><span class="cdb-k">IUPAC</span><span class="cdb-v" data-role="iupac">—</span></div>' +
          '  <div class="cdb-line"><span class="cdb-k">常用名</span><span class="cdb-v" data-role="common">—</span></div>' +
          '  <div class="cdb-meta" data-role="meta"></div>' +
          '  <div class="cdb-err" data-role="err" hidden></div>' +
          '  <div class="cdb-row cdb-info-actions">' +
          '    <button type="button" class="cdb-btn" data-role="copy-smiles">复制 SMILES</button>' +
          '    <button type="button" class="cdb-btn" data-role="rdkit">重新渲染</button>' +
          '    <span class="cdb-status" data-role="info-status"></span>' +
          '  </div>' +
          '  <div class="cdb-render" data-role="render" hidden>' +
          '    <div class="cdb-render-label" data-role="render-label">RDKit 渲染</div>' +
          '    <div class="cdb-render-canvas" data-role="render-canvas"></div>' +
          '    <div class="cdb-row">' +
          '      <button type="button" class="cdb-btn" data-role="copy-png">复制 PNG</button>' +
          '      <button type="button" class="cdb-btn" data-role="save-png">下载 PNG</button>' +
          '      <button type="button" class="cdb-btn" data-role="save-svg">下载 SVG</button>' +
          '    </div>' +
          '  </div>' +
          '</div>' +
          '<div class="cdb-row" data-role="actions"></div>'
        this.host.appendChild(root)
        this.root = root
        this.svg = root.querySelector('.cdb-svg')
        this.stage = root.querySelector('[data-role="stage"]')
        this.emptyEl = root.querySelector('[data-role="empty"]')
        this.clearFloat = root.querySelector('[data-role="clear-float"]')
        this.clearFloat.addEventListener('click', () => this.clear())
        this.statusEl = null

        this.infoEl = root.querySelector('[data-role="info"]')
        this.info = {
          iupac: root.querySelector('[data-role="iupac"]'),
          common: root.querySelector('[data-role="common"]'),
          meta: root.querySelector('[data-role="meta"]'),
          err: root.querySelector('[data-role="err"]'),
          status: root.querySelector('[data-role="info-status"]'),
          render: root.querySelector('[data-role="render"]'),
          canvas: root.querySelector('[data-role="render-canvas"]'),
          label: root.querySelector('[data-role="render-label"]'),
          smiles: '',
        }

        const tools = root.querySelector('[data-role="tools"]')
        this.toolBtns = {}
        const mk = (label, onClick, cls = 'cdb-btn') => {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = cls
          b.textContent = label
          b.addEventListener('click', onClick)
          tools.appendChild(b)
          return b
        }
        this.toolBtns.select = mk(this.t('draw.tool.select'), () => this.setTool('select'))
        this.toolBtns.carbon = mk(this.t('draw.tool.carbon'), () => this.setTool('draw', 'C'))
        this.toolBtns.erase = mk(this.t('draw.tool.erase'), () => this.setTool('erase'))
        tools.appendChild(Object.assign(document.createElement('span'), { className: 'cdb-sep' }))
        this.bondBtns = {}
        for (const order of [1, 2, 3]) {
          this.bondBtns[order] = mk(this.t(`draw.bond.${order}`), () => this.setOrder(order))
        }
        const palette = root.querySelector('[data-role="palette"]')
        this.chipBtns = {}
        for (const item of DB_PALETTE) {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'cdb-chip' + (item.ring ? ' ring' : '')
          b.textContent = item.ring ? this.t('draw.ring') : item.label
          b.dataset.brush = item.brush
          b.draggable = true
          b.addEventListener('click', () => this.setTool('draw', item.brush))
          b.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/plain', item.brush)
            ev.dataTransfer.effectAllowed = 'copy'
          })
          palette.appendChild(b)
          this.chipBtns[item.brush] = b
        }

        const actions = root.querySelector('[data-role="actions"]')
        const act = (label, fn) => {
          const b = document.createElement('button')
          b.type = 'button'
          b.className = 'cdb-btn'
          b.textContent = label
          b.addEventListener('click', fn)
          actions.appendChild(b)
          return b
        }
        this.undoBtn = act(this.t('draw.undo'), () => this.undo())
        this.redoBtn = act(this.t('draw.redo'), () => this.redo())
        act(this.t('draw.clear'), () => this.clear())
        actions.appendChild(Object.assign(document.createElement('span'), { className: 'cdb-sep' }))
        this.copyBtn = act(this.t('draw.copy'), () => this.copyPng())
        this.pngBtn = act(this.t('draw.png'), () => this.downloadPng())
        this.svgBtn = act(this.t('draw.svg'), () => this.downloadSvg())
        this.statusEl = document.createElement('span')
        this.statusEl.className = 'cdb-status'
        actions.appendChild(this.statusEl)

        this.emptyEl.textContent = this.t('draw.empty')
      }

      _wire() {
        const svg = this.svg
        svg.addEventListener('pointerdown', (ev) => this._onDown(ev))
        svg.addEventListener('pointermove', (ev) => this._onMove(ev))
        svg.addEventListener('pointerup', (ev) => this._onUp(ev))
        svg.addEventListener('pointercancel', () => this._endDrag())
        svg.addEventListener('pointerleave', () => { if (!this.drag) this.ghost = null })
        this.stage.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy' })
        this.stage.addEventListener('drop', (ev) => {
          ev.preventDefault()
          const brush = ev.dataTransfer.getData('text/plain')
          if (!brush) return
          this.setTool('draw', brush)
          this.pushHistory()
          this.placeBrush(this._local(ev), brush)
          this.render()
        })
        this._onKey = (ev) => {
          if (ev.key === 'Escape') { this.setTool('select'); this.selectedId = null; this.render() }
        }
        document.addEventListener('keydown', this._onKey)

        const infoBtn = (role, fn) => {
          const el = this.infoEl.querySelector(`[data-role="${role}"]`)
          if (el) el.addEventListener('click', fn)
        }
        infoBtn('copy-smiles', () => this.copySmiles())
        infoBtn('rdkit', () => this.rdkitRender())
        infoBtn('copy-png', () => this.copyRenderedPng())
        infoBtn('save-png', () => this.saveRenderedPng())
        infoBtn('save-svg', () => this.saveRenderedSvg())
      }

      destroy() {
        document.removeEventListener('keydown', this._onKey)
        clearTimeout(this._idTimer)
        if (this._renderUrl) URL.revokeObjectURL(this._renderUrl)
        if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root)
      }

      /* ---------- 工具 ---------- */
      setTool(tool, brush) {
        this.tool = tool
        if (brush) this.brush = brush
        this.selectedId = null
        this.render()
      }

      setOrder(order) {
        this.order = order
        this.render()
      }

      /* ---------- 几何 ---------- */
      _local(ev) {
        const pt = this.svg.createSVGPoint()
        pt.x = ev.clientX
        pt.y = ev.clientY
        const m = this.svg.getScreenCTM()
        if (!m) return { x: 0, y: 0 }
        const p = pt.matrixTransform(m.inverse())
        return { x: p.x, y: p.y }
      }

      _atomAt(p, tol = 16) {
        let best = null
        let bestD = tol
        for (const a of this.atoms) {
          const d = Math.hypot(a.x - p.x, a.y - p.y)
          if (d <= bestD) { best = a; bestD = d }
        }
        return best
      }

      _bondAt(p, tol = 8) {
        for (const b of this.bonds) {
          const A = this.atom(b.a)
          const B = this.atom(b.b)
          if (!A || !B) continue
          const dx = B.x - A.x
          const dy = B.y - A.y
          const len2 = dx * dx + dy * dy || 1
          let t = ((p.x - A.x) * dx + (p.y - A.y) * dy) / len2
          t = Math.max(0, Math.min(1, t))
          const d = Math.hypot(p.x - (A.x + dx * t), p.y - (A.y + dy * t))
          if (d <= tol) return b
        }
        return null
      }

      _snapFree(p) {
        const near = this._atomAt(p, 20)
        if (near) return { x: near.x, y: near.y, atom: near }
        return { x: Math.round(p.x / DB_GRID) * DB_GRID, y: Math.round(p.y / DB_GRID) * DB_GRID }
      }

      atom(id) { return this.atoms.find((a) => a.id === id) }

      /** 去掉这条键后 A→B 的最短路径（用来判断“这条键是不是环的一部分”） */
      _ringPath(aId, bId, bondId) {
        const adj = new Map()
        for (const b of this.bonds) {
          if (b.id === bondId) continue
          if (!adj.has(b.a)) adj.set(b.a, [])
          if (!adj.has(b.b)) adj.set(b.b, [])
          adj.get(b.a).push(b.b)
          adj.get(b.b).push(b.a)
        }
        const prev = new Map([[aId, null]])
        const queue = [aId]
        while (queue.length) {
          const cur = queue.shift()
          if (cur === bId) {
            const path = []
            let n = bId
            while (n !== null && n !== undefined) { path.push(n); n = prev.get(n) }
            return path.reverse()
          }
          for (const nb of adj.get(cur) || []) {
            if (!prev.has(nb)) { prev.set(nb, cur); queue.push(nb) }
          }
        }
        return null
      }

      /* ---------- 变更 ---------- */
      addAtom(x, y, el = 'C', label = '') {
        const a = { id: this.seq++, x, y, el, label }
        this.atoms.push(a)
        return a
      }

      addBond(a, b, order = this.order) {
        if (!a || !b || a.id === b.id) return null
        if (this.bonds.some((t) => (t.a === a.id && t.b === b.id) || (t.a === b.id && t.b === a.id))) return null
        const bond = { id: this.seq++, a: a.id, b: b.id, order }
        this.bonds.push(bond)
        return bond
      }

      removeAtom(a) {
        this.atoms = this.atoms.filter((x) => x.id !== a.id)
        this.bonds = this.bonds.filter((b) => b.a !== a.id && b.b !== a.id)
        if (this.selectedId === a.id) this.selectedId = null
      }

      removeBond(b) {
        this.bonds = this.bonds.filter((x) => x.id !== b.id)
      }

      degree(id) {
        return this.bonds.reduce((n, b) => n + (b.a === id || b.b === id ? 1 : 0), 0)
      }

      placeBrush(p, brush = this.brush) {
        if (brush === 'benzene') {
          this.addBenzene(p)
          return
        }
        const snap = this._snapFree(p)
        if (snap.atom) {
          this.applyBrush(snap.atom, brush)
          this.selectedId = snap.atom.id
          return
        }
        const item = DB_PALETTE.find((x) => x.brush === brush)
        const el = item && item.el ? item.el : (item ? item.label : 'C')
        const label = item && item.el ? item.label : ''
        const a = this.addAtom(snap.x, snap.y, el, label)
        this.selectedId = a.id
      }

      applyBrush(atom, brush) {
        if (!atom || brush === 'benzene') return
        const item = DB_PALETTE.find((x) => x.brush === brush)
        atom.el = item && item.el ? item.el : (item ? item.label : 'C')
        atom.label = item && item.el ? item.label : ''
      }

      addBenzene(center) {
        const cx = Math.round(center.x / DB_GRID) * DB_GRID
        const cy = Math.round(center.y / DB_GRID) * DB_GRID
        const ring = []
        for (let i = 0; i < 6; i += 1) {
          const ang = (-90 + i * 60) * Math.PI / 180
          ring.push(this.addAtom(
            Math.round((cx + DB_BOND * Math.cos(ang)) * 10) / 10,
            Math.round((cy + DB_BOND * Math.sin(ang)) * 10) / 10,
            'C',
          ))
        }
        for (let i = 0; i < 6; i += 1) {
          this.addBond(ring[i], ring[(i + 1) % 6], i % 2 === 0 ? 2 : 1)
        }
      }

      clear() {
        if (!this.atoms.length && !this.bonds.length) return
        this.pushHistory()
        this.atoms = []
        this.bonds = []
        this.selectedId = null
        this.seq = 1
        this._idMolblock = ''
        this._renderSvg = null
        this.render()
      }

      /* ---------- 历史 ---------- */
      snapshot() {
        return JSON.stringify({ atoms: this.atoms, bonds: this.bonds, seq: this.seq })
      }

      pushHistory() {
        this.history.push(this.snapshot())
        if (this.history.length > 100) this.history.shift()
        this.future.length = 0
      }

      restore(json) {
        const s = JSON.parse(json)
        this.atoms = s.atoms
        this.bonds = s.bonds
        this.seq = s.seq
        this.selectedId = null
      }

      undo() {
        if (!this.history.length) return
        this.future.push(this.snapshot())
        this.restore(this.history.pop())
        this.render()
      }

      redo() {
        if (!this.future.length) return
        this.history.push(this.snapshot())
        this.restore(this.future.pop())
        this.render()
      }

      /* ---------- 交互 ---------- */
      _onDown(ev) {
        if (ev.button !== undefined && ev.button !== 0) return
        ev.preventDefault()
        const p = this._local(ev)
        try { this.svg.setPointerCapture?.(ev.pointerId) } catch { /* 合成事件没有真实 pointerId */ }
        const atom = this._atomAt(p)

        if (this.tool === 'erase') {
          this.pushHistory()
          if (atom) this.removeAtom(atom)
          else {
            const bond = this._bondAt(p)
            if (bond) this.removeBond(bond)
          }
          this.render()
          return
        }

        if (this.tool === 'select') {
          if (!atom) { this.selectedId = null; this.render(); return }
          this.selectedId = atom.id
          this.pushHistory()
          this.drag = { mode: 'move', atom, moved: false }
          this.render()
          return
        }

        // 绘制：普通碳原子上按下 = 直接拖碳链；
        // 元素模板按在原子上一律先记成 pending，松手没移动才算“换元素”，移动了就是从这个原子长链
        if (atom) {
          if (this.brush === 'C' && atom.el === 'C' && !atom.label) {
            this.selectedId = atom.id
            this.pushHistory()
            this.drag = { mode: 'chain', tip: atom, brush: this.brush, created: 0, origin: { x: atom.x, y: atom.y } }
            this.render()
            return
          }
          this.selectedId = atom.id
          this.pendingAtom = { atom, p, brush: this.brush }
          this.render()
          return
        }
        this.pending = { p, moved: false }
      }

      _onMove(ev) {
        const p = this._local(ev)
        if (this.pendingAtom) {
          const pa = this.pendingAtom
          if (Math.hypot(p.x - pa.p.x, p.y - pa.p.y) <= 8) return
          this.pendingAtom = null
          this.pushHistory()
          this.drag = { mode: 'chain', tip: pa.atom, brush: pa.brush, created: 0, origin: { x: pa.atom.x, y: pa.atom.y } }
        }
        if (this.pending) {
          if (Math.hypot(p.x - this.pending.p.x, p.y - this.pending.p.y) > 6) this.pending.moved = true
          return
        }
        if (!this.drag) return

        if (this.drag.mode === 'move') {
          this.drag.moved = true
          const snap = this._snapFree(p)
          this.drag.atom.x = snap.x
          this.drag.atom.y = snap.y
          this.render()
          return
        }

        if (this.drag.mode === 'chain') {
          const tip = this.drag.tip
          const dx = p.x - tip.x
          const dy = p.y - tip.y
          if (Math.hypot(dx, dy) < DB_BOND * 0.7) {
            this.ghost = null
            this.render()
            return
          }
          const step = Math.PI / 6
          // 链的整体方向跟着拖动走，具体键在整体方向两侧 ±30° 交替 → 标准锯齿链
          const origin = this.drag.origin || tip
          const base = Math.round(Math.atan2(p.y - origin.y, p.x - origin.x) / step) * step
          const ang = this.drag.created === 0
            ? base
            : base + (this.drag.created % 2 === 0 ? -1 : 1) * step
          const nx = tip.x + Math.cos(ang) * DB_BOND
          const ny = tip.y + Math.sin(ang) * DB_BOND
          this.ghost = { x1: tip.x, y1: tip.y, x2: nx, y2: ny }
          this.drag.moved = true

          const existing = this._atomAt({ x: nx, y: ny }, 16)
          if (existing && existing.id !== tip.id) {
            // 拖回已有原子 = 闭环
            this.addBond(tip, existing, this.order)
            this.drag = null
            this.ghost = null
            this.render()
            return
          }

          if (this.atoms.length > 250) { this.drag = null; this.ghost = null; return }
          const item = DB_PALETTE.find((x) => x.brush === (this.drag.created === 0 ? this.drag.brush : 'C'))
          const el = item && item.el ? item.el : (item && item.label !== 'benzene' ? item.label : 'C')
          const label = item && item.el ? item.label : ''
          const fresh = this.addAtom(nx, ny, el, label)
          this.addBond(tip, fresh, this.order)
          this.drag.tip = fresh
          this.drag.created += 1
          this.drag.lastAngle = ang
          this.selectedId = fresh.id
          this.render()
        }
      }

      _onUp(ev) {
        if (this.pendingAtom) {
          const pa = this.pendingAtom
          this.pendingAtom = null
          this.pushHistory()
          this.applyBrush(pa.atom, pa.brush)
          this.selectedId = pa.atom.id
          this.render()
          return
        }
        if (this.pending) {
          const wasClick = !this.pending.moved
          const p = this.pending.p
          this.pending = null
          if (wasClick) {
            this.pushHistory()
            this.placeBrush(p)
            this.render()
          }
          return
        }
        this._endDrag()
      }

      _endDrag() {
        this.pendingAtom = null
        if (!this.drag) return
        this.drag = null
        this.ghost = null
        this.render()
      }

      /* ---------- 结构识别 / IUPAC 命名 / 常用名 ---------- */

      /** 把画板转成 V2000 molblock（坐标按键长归一化，y 轴翻正） */
      toMolblock() {
        if (!this.atoms.length) return ''
        const order = new Map(this.atoms.map((a, i) => [a.id, i + 1]))
        const lines = ['DSH ChemDraw', '  DSHdraw  2D', '']
        lines.push(
          `${String(this.atoms.length).padStart(3)}${String(this.bonds.length).padStart(3)}` +
          '  0  0  0  0  0  0  0  0999 V2000',
        )
        for (const a of this.atoms) {
          const x = (a.x / DB_BOND).toFixed(4).padStart(10)
          const y = (-a.y / DB_BOND).toFixed(4).padStart(10)
          const el = String(a.el || 'C').padEnd(3)
          lines.push(`${x}${y}    0.0000 ${el} 0  0  0  0  0  0  0  0  0  0  0  0`)
        }
        for (const b of this.bonds) {
          lines.push(
            `${String(order.get(b.a)).padStart(3)}${String(order.get(b.b)).padStart(3)}` +
            `${String(b.order).padStart(3)}  0  0  0  0`,
          )
        }
        lines.push('M  END')
        return lines.join('\n')
      }

      _clearInfo() {
        this.infoEl.hidden = true
        this.info.smiles = ''
        this.info.err.hidden = true
        this.info.render.hidden = true
      }

      _setInfoStatus(text) { this.info.status.textContent = text || '' }

      _scheduleIdentify() {
        if (!this.atoms.length) { this._clearInfo(); return }
        clearTimeout(this._idTimer)
        this._idTimer = setTimeout(() => { this._identify() }, 650)
      }

      async _identify() {
        const molblock = this.toMolblock()
        if (!molblock) { this._clearInfo(); return }
        if (molblock === this._idMolblock && this.info.smiles) return
        const seq = (this._idSeq = (this._idSeq || 0) + 1)
        this.infoEl.hidden = false
        this.info.err.hidden = true
        this._setInfoStatus(this.t('draw.identifying'))
        try {
          const res = await fetch('/chemdraw/identify', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ molblock }),
          })
          const data = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
          if (seq !== this._idSeq) return
          if (!data || data.ok !== true) {
            this._showInfoError((data && data.error) || `HTTP ${res.status}`)
            return
          }
          this._idMolblock = molblock
          this._showInfo(data)
        } catch (err) {
          if (seq !== this._idSeq) return
          this._showInfoError(String(err.message || err))
        }
      }

      _showInfo(data) {
        this.infoEl.hidden = false
        this.info.err.hidden = true
        this.info.iupac.textContent = data.iupac || this.t('draw.unnameable')
        const c = data.common
        this.info.common.textContent = c
          ? `${c.zh}${c.en && c.en !== c.zh ? ` · ${c.en}` : ''}${c.match === 'skeleton' ? this.t('draw.skeleton') : ''}`
          : this.t('draw.noCommon')
        this.info.meta.textContent = `${data.formula || ''} · ${data.mw || ''} g/mol`
        this.info.smiles = data.smiles || ''
        this.info.label.textContent = this.t('draw.rendered')
        this._setInfoStatus('')
        this.rdkitRender()
      }

      _showInfoError(message) {
        this.infoEl.hidden = false
        this.info.iupac.textContent = '—'
        this.info.common.textContent = '—'
        this.info.meta.textContent = ''
        this.info.err.hidden = false
        this.info.err.textContent = message
        this.info.smiles = ''
        this._setInfoStatus('')
      }

      async _copy(text) {
        try { await navigator.clipboard.writeText(text); return true } catch { /* 继续降级 */ }
        try {
          const ta = document.createElement('textarea')
          ta.value = text
          ta.style.position = 'fixed'
          ta.style.top = '-1000px'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          ta.setSelectionRange(0, text.length)
          const ok = document.execCommand('copy')
          ta.remove()
          return ok
        } catch { return false }
      }

      async copySmiles() {
        if (!this.info.smiles) return
        const ok = await this._copy(this.info.smiles)
        this._setInfoStatus(ok ? this.t('draw.copiedSmiles') : this.info.smiles)
        if (ok) setTimeout(() => this._setInfoStatus(''), 2000)
      }

      /** 把识别出的 SMILES 交给 Host 的 RDKit 渲染，样式与「单分子」模式完全一致 */
      async rdkitRender() {
        const smiles = this.info.smiles
        if (!smiles) return
        this._setInfoStatus(this.t('draw.rendering'))
        try {
          const qs = new URLSearchParams({ smiles, format: 'svg', bond: '42', color: '1' })
          const res = await fetch(`/chemdraw/render?${qs.toString()}`, { credentials: 'same-origin' })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const svg = await res.text()
          this._renderSvg = svg
          this.info.canvas.innerHTML = svg.replace(/<\?xml[^>]*\?>\s*/i, '')
          this.info.render.hidden = false
          this._setInfoStatus('')
        } catch (err) {
          this._setInfoStatus(String(err.message || err))
        }
      }

      async copyRenderedPng() {
        if (!this._renderSvg) return
        try {
          if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard unavailable')
          const blob = await svgToPngBlob(this._renderSvg, 4)
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
          this._setInfoStatus(this.t('draw.copied'))
          setTimeout(() => this._setInfoStatus(''), 2000)
        } catch {
          this._setInfoStatus(this.t('draw.copyFail'))
        }
      }

      async saveRenderedPng() {
        if (!this._renderSvg) return
        try {
          download(await svgToPngBlob(this._renderSvg, 4), 'structure.png')
        } catch (err) {
          this._setInfoStatus(String(err.message || err))
        }
      }

      saveRenderedSvg() {
        if (!this._renderSvg) return
        download(new Blob([this._renderSvg], { type: 'image/svg+xml;charset=utf-8' }), 'structure.svg')
      }

      /* ---------- 绘制 ---------- */
      /** 把 CH₄ / NH₂ 里的 Unicode 下标拆成 tspan，排版才像正经化学式 */
      _fillLabel(el, label) {
        const SUB = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' }
        const SVGNS = 'http://www.w3.org/2000/svg'
        let run = ''
        let sub = false
        let lower = false
        const flush = () => {
          if (!run) return
          const span = document.createElementNS(SVGNS, 'tspan')
          if (sub) {
            span.setAttribute('font-size', '0.62em')
            span.setAttribute('dy', '0.32em')
            lower = true
          } else if (lower) {
            span.setAttribute('dy', '-0.32em')
            lower = false
          }
          span.textContent = run
          el.appendChild(span)
          run = ''
        }
        for (const ch of label) {
          const isSub = Object.prototype.hasOwnProperty.call(SUB, ch)
          if (isSub !== sub) { flush(); sub = isSub }
          run += isSub ? SUB[ch] : ch
        }
        flush()
      }

      labelOf(a) {
        if (a.label) return a.label
        if (a.el !== 'C') return a.el
        return this.degree(a.id) === 0 ? 'CH₄' : ''
      }

      colorOf(a) {
        const key = (a.label || a.el || 'C').replace(/[^A-Za-z].*$/, '')
        return DB_COLORS[key] || DB_COLORS[a.el] || '#111111'
      }

      _el(name, attrs) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', name)
        for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v))
        return node
      }

      _line(parent, x1, y1, x2, y2, width = 2.5, extra = {}) {
        parent.appendChild(this._el('line', {
          x1, y1, x2, y2, stroke: '#111111', 'stroke-width': width, 'stroke-linecap': 'round', ...extra,
        }))
      }

      render() {
        const svg = this.svg
        while (svg.firstChild) svg.removeChild(svg.firstChild)

        for (const bond of this.bonds) {
          const A = this.atom(bond.a)
          const B = this.atom(bond.b)
          if (!A || !B) continue
          const dx = B.x - A.x
          const dy = B.y - A.y
          const len = Math.hypot(dx, dy) || 1
          const ux = dx / len
          const uy = dy / len
          const px = -uy
          const py = ux
          const trimA = this.labelOf(A) ? this.labelOf(A).length * 4.6 + 4 : 0
          const trimB = this.labelOf(B) ? this.labelOf(B).length * 4.6 + 4 : 0
          const x1 = A.x + ux * trimA
          const y1 = A.y + uy * trimA
          const x2 = B.x - ux * trimB
          const y2 = B.y - uy * trimB
          const off = 3.4
          if (bond.order === 1) {
            this._line(svg, x1, y1, x2, y2)
          } else if (bond.order === 2) {
            const ring = this._ringPath(bond.a, bond.b, bond.id)
            if (ring && ring.length >= 3 && ring.length <= 8) {
              // 环里的双键：一条沿边，一条朝环内、缩短（和 RDKit / ChemDraw 一致）
              this._line(svg, x1, y1, x2, y2)
              const cx = ring.reduce((s, id) => s + this.atom(id).x, 0) / ring.length
              const cy = ring.reduce((s, id) => s + this.atom(id).y, 0) / ring.length
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              const side = ((cx - mx) * px + (cy - my) * py) >= 0 ? 1 : -1
              const gap = 4.6 * side
              const inset = 0.3
              const seg = Math.hypot(x2 - x1, y2 - y1) || 1
              this._line(svg,
                x1 + ux * seg * inset + px * gap, y1 + uy * seg * inset + py * gap,
                x2 - ux * seg * inset + px * gap, y2 - uy * seg * inset + py * gap, 2)
            } else {
              this._line(svg, x1 + px * off, y1 + py * off, x2 + px * off, y2 + py * off, 2)
              this._line(svg, x1 - px * off, y1 - py * off, x2 - px * off, y2 - py * off, 2)
            }
          } else {
            this._line(svg, x1, y1, x2, y2, 2)
            this._line(svg, x1 + px * off * 1.6, y1 + py * off * 1.6, x2 + px * off * 1.6, y2 + py * off * 1.6, 1.7)
            this._line(svg, x1 - px * off * 1.6, y1 - py * off * 1.6, x2 - px * off * 1.6, y2 - py * off * 1.6, 1.7)
          }
        }

        if (this.ghost) {
          this._line(svg, this.ghost.x1, this.ghost.y1, this.ghost.x2, this.ghost.y2, 2, {
            stroke: '#5b9dff', 'stroke-dasharray': '6 5', class: 'cdb-overlay',
          })
        }

        if (this.selectedId) {
          const a = this.atom(this.selectedId)
          if (a) {
            svg.appendChild(this._el('circle', {
              cx: a.x, cy: a.y, r: 13, fill: 'none', stroke: '#5b9dff', 'stroke-width': 1.6,
              'stroke-dasharray': '3 3', class: 'cdb-overlay',
            }))
          }
        }
        for (const a of this.atoms) {
          const label = this.labelOf(a)
          if (!label) continue
          const t = this._el('text', {
            x: a.x, y: a.y, 'text-anchor': 'middle', 'dominant-baseline': 'central',
            'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 16, 'font-weight': 500,
            fill: this.colorOf(a), 'paint-order': 'stroke', stroke: '#ffffff', 'stroke-width': 3.5,
            'stroke-linejoin': 'round',
          })
          this._fillLabel(t, label)
          svg.appendChild(t)
        }


        const has = this.atoms.length > 0
        this.emptyEl.style.display = has ? 'none' : 'grid'
        if (this.statusEl) {
          this.statusEl.textContent = this.note
            || this.t('draw.status', { n: this.atoms.length, m: this.bonds.length })
        }
        this._syncButtons()
        this._scheduleIdentify()
      }

      _syncButtons() {
        this.toolBtns.select.classList.toggle('on', this.tool === 'select')
        this.toolBtns.carbon.classList.toggle('on', this.tool === 'draw' && this.brush === 'C')
        this.toolBtns.erase.classList.toggle('on', this.tool === 'erase')
        for (const order of [1, 2, 3]) this.bondBtns[order].classList.toggle('on', this.order === order)
        for (const [brush, btn] of Object.entries(this.chipBtns)) {
          btn.classList.toggle('on', this.tool === 'draw' && this.brush === brush)
        }
        this.undoBtn.disabled = this.history.length === 0
        this.redoBtn.disabled = this.future.length === 0
        if (this.clearFloat) this.clearFloat.disabled = this.atoms.length === 0
      }

      /* ---------- 导出 ---------- */
      bounds() {
        if (!this.atoms.length) return { x: 0, y: 0, w: 320, h: 240 }
        let minX = Infinity
        let minY = Infinity
        let maxX = -Infinity
        let maxY = -Infinity
        if (this.selectedId) {
          const a = this.atom(this.selectedId)
          if (a) {
            svg.appendChild(this._el('circle', {
              cx: a.x, cy: a.y, r: 13, fill: 'none', stroke: '#5b9dff', 'stroke-width': 1.6,
              'stroke-dasharray': '3 3', class: 'cdb-overlay',
            }))
          }
        }
        for (const a of this.atoms) {
          const label = this.labelOf(a)
          const halfW = label ? Math.max(9, label.length * 4.6) : 3
          minX = Math.min(minX, a.x - halfW)
          maxX = Math.max(maxX, a.x + halfW)
          minY = Math.min(minY, a.y - 10)
          maxY = Math.max(maxY, a.y + 10)
        }
        const pad = 14
        return {
          x: Math.round(minX - pad),
          y: Math.round(minY - pad),
          w: Math.round(maxX - minX + pad * 2),
          h: Math.round(maxY - minY + pad * 2),
        }
      }

      toSvgString() {
        const box = this.bounds()
        const clone = this.svg.cloneNode(true)
        clone.querySelectorAll('.cdb-overlay').forEach((n) => n.remove())
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
        clone.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`)
        clone.setAttribute('width', box.w)
        clone.setAttribute('height', box.h)
        clone.removeAttribute('class')
        clone.querySelectorAll('text').forEach((t) => {
          t.setAttribute('font-family', 'Arial, Helvetica, sans-serif')
        })
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
      }

      async exportPng(scale = 4) {
        if (!this.atoms.length) throw new Error(this.t('draw.needAtoms'))
        return svgToPngBlob(this.toSvgString(), scale)
      }

      async downloadPng() {
        try {
          download(await this.exportPng(4), 'structure.png')
          this.note = ''
          this.render()
        } catch (err) {
          this.note = String(err.message || err)
          this.render()
        }
      }

      downloadSvg() {
        if (!this.atoms.length) { this.note = this.t('draw.needAtoms'); this.render(); return }
        download(new Blob([this.toSvgString()], { type: 'image/svg+xml;charset=utf-8' }), 'structure.svg')
      }

      async copyPng() {
        try {
          if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard unavailable')
          const blob = await this.exportPng(4)
          await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
          this.note = this.t('draw.copied')
        } catch {
          this.note = this.t('draw.copyFail')
        }
        this.render()
        setTimeout(() => { this.note = ''; if (this.statusEl) this.render() }, 2400)
      }
    }
    /* ==== DRAW-BOARD:END ==== */

    /** React 薄壳：只负责把画板挂到面板上，画板本身是纯 DOM */
    function DrawPanel({ t, active = true }) {
      const hostRef = React.useRef(null)
      const tRef = React.useRef(t)
      tRef.current = t
      React.useEffect(() => {
        const board = new DrawBoard(hostRef.current, { t: (k, v) => tRef.current(k, v) })
        return () => board.destroy()
      }, [])
      return h('div', {
        ref: hostRef,
        style: {
          display: active ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 430,
        },
      })
    }

    function Card({ t, item, onCopy }) {
      const [note, setNote] = React.useState('')
      const [busy, setBusy] = React.useState(false)

      const savePng = async () => {
        setBusy(true)
        try {
          download(await svgToPngBlob(item.svg, 4), `${stem(item.label, item.index)}.png`)
        } catch (err) {
          setNote(String(err.message || err))
        } finally {
          setBusy(false)
        }
      }
      const copy = async () => {
        setBusy(true)
        try {
          await onCopy(item)
          setNote(t('panel.copied'))
        } catch {
          setNote(t('panel.copyFailed'))
        } finally {
          setBusy(false)
        }
      }

      return h('div', { style: S.card },
        h('div', { style: S.paper },
          h('img', { style: S.img, src: item.url, alt: item.label, draggable: false })),
        h('div', { style: S.mono }, item.label),
        h('div', { style: S.row },
          h('button', { style: S.btnGhost, onClick: copy, disabled: busy }, t('panel.copy')),
          h('button', { style: S.btnGhost, onClick: savePng, disabled: busy }, t('panel.downloadPng')),
          h('button', {
            style: S.btnGhost, disabled: busy,
            onClick: () => download(new Blob([item.svg], { type: 'image/svg+xml;charset=utf-8' }),
              `${stem(item.label, item.index)}.svg`),
          }, t('panel.downloadSvg'))),
        note ? h('div', { style: S.hint }, note) : null)
    }

    function Panel({ t }) {
      const [mode, setMode] = React.useState('single')
      const [text, setText] = React.useState('CC(=O)Oc1ccccc1C(=O)O')
      const [rxnText, setRxnText] = React.useState('CC(=O)O.OCC>>CC(=O)OCC.O')
      const [reagents, setReagents] = React.useState('')
      const [batchText, setBatchText] = React.useState('CC(=O)Oc1ccccc1C(=O)O\nCn1cnc2c1c(=O)n(C)c(=O)n2C')
      const [outDir, setOutDir] = React.useState('')
      const [batchFormat, setBatchFormat] = React.useState('svg')
      const [bond, setBond] = React.useState(42)
      const [color, setColor] = React.useState(false)
      const [annotate, setAnnotate] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [items, setItems] = React.useState([])
      const [error, setError] = React.useState('')
      const [batchMsg, setBatchMsg] = React.useState(null)
      const [touched, setTouched] = React.useState(false)
      const urls = React.useRef([])

      const release = React.useCallback(() => {
        for (const u of urls.current) URL.revokeObjectURL(u)
        urls.current = []
      }, [])

      React.useEffect(() => () => release(), [release])

      const fetchSvg = React.useCallback(async (kind, payload) => {
        const qs = new URLSearchParams({ format: 'svg', bond: String(bond) })
        if (kind === 'rxn') qs.set('scheme', payload.scheme)
        else qs.set('smiles', payload.smiles)
        if (kind === 'rxn' && payload.reagents) qs.set('reagents', payload.reagents)
        if (color) qs.set('color', '1')
        if (annotate) qs.set('annotate', '1')
        const url = kind === 'rxn' ? ROUTE_REACTION : ROUTE_RENDER
        const res = await fetch(`${url}?${qs.toString()}`, { credentials: 'same-origin' })
        if (!res.ok) {
          let msg = `HTTP ${res.status}`
          try {
            msg = (await res.json()).error || msg
          } catch { /* 非 JSON */ }
          throw new Error(msg)
        }
        return res.text()
      }, [bond, color, annotate])

      const renderAll = React.useCallback(async (kind) => {
        const source = kind === 'rxn' ? rxnText : text
        const lines = String(source).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
        if (!lines.length) {
          release()
          setItems([])
          setError('')
          return
        }
        setBusy(true)
        setError('')
        setBatchMsg(null)
        const next = []
        const fresh = []
        try {
          for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i]
            const svg = await fetchSvg(kind, kind === 'rxn'
              ? { scheme: line, reagents: reagents.trim() || undefined }
              : { smiles: line })
            const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
            fresh.push(url)
            next.push({ index: i, label: line, svg, url })
          }
          release()
          urls.current = fresh
          setItems(next)
        } catch (err) {
          for (const u of fresh) URL.revokeObjectURL(u)
          release()
          setItems([])
          setError(String(err.message || err))
        } finally {
          setBusy(false)
        }
      }, [text, rxnText, reagents, fetchSvg, release])

      const exportBatch = React.useCallback(async () => {
        const list = String(batchText).split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)
        if (!list.length) {
          setError('')
          setBatchMsg(null)
          return
        }
        if (!outDir.trim()) {
          setError('请填写输出目录（绝对路径）')
          return
        }
        setBusy(true)
        setError('')
        setBatchMsg(null)
        try {
          const res = await fetch(ROUTE_BATCH, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              items: list.map((smiles) => ({ smiles })),
              outDir: outDir.trim(),
              format: batchFormat,
              bond,
              color,
              annotate,
            }),
          })
          const data = await res.json()
          if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
          setBatchMsg(data)
        } catch (err) {
          setError(String(err.message || err))
        } finally {
          setBusy(false)
        }
      }, [batchText, outDir, batchFormat, bond, color, annotate])

      // 首次打开自动渲一张，面板不至于空白
      React.useEffect(() => {
        if (touched) return
        setTouched(true)
        renderAll('single')
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      const copyPng = async (item) => {
        if (!navigator.clipboard || !window.ClipboardItem) throw new Error('clipboard unavailable')
        const blob = await svgToPngBlob(item.svg, 4)
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
      }

      const modeBtn = (key) => h('button', {
        key, style: S.mode(mode === key),
        onClick: () => { setMode(key); setError(''); setItems([]); setBatchMsg(null) },
      }, t(`mode.${key}`))

      const opts = h('div', { style: S.row },
        h('span', { style: S.label }, t('panel.bond')),
        h('input', {
          style: S.num, type: 'number', min: 16, max: 240, value: bond,
          onChange: (e) => setBond(Number(e.target.value) || 42),
        }),
        h('label', { style: S.check },
          h('input', { type: 'checkbox', checked: color, onChange: (e) => setColor(e.target.checked) }),
          h('span', { style: S.label }, t('panel.color'))),
        h('label', { style: S.check },
          h('input', { type: 'checkbox', checked: annotate, onChange: (e) => setAnnotate(e.target.checked) }),
          h('span', { style: S.label }, t('panel.annotate'))))

      let body
      if (mode === 'draw') {
        body = []
      } else if (mode === 'batch') {
        body = [
          h('textarea', {
            key: 'ta', style: S.area, value: batchText, spellCheck: false,
            placeholder: t('batch.placeholder'),
            onChange: (e) => setBatchText(e.target.value),
          }),
          h('div', { key: 'fmt', style: S.row },
            h('span', { style: S.label }, '格式'),
            h('select', {
              style: { ...S.num, width: 72 },
              value: batchFormat,
              onChange: (e) => setBatchFormat(e.target.value),
            }, h('option', { value: 'svg' }, 'SVG'), h('option', { value: 'png' }, 'PNG'))),
          opts,
          h('div', { key: 'dir', style: S.col },
            h('span', { style: S.label }, t('batch.outDir')),
            h('input', {
              style: S.input, value: outDir, spellCheck: false,
              placeholder: t('batch.outDirPh'),
              onChange: (e) => setOutDir(e.target.value),
            })),
          h('div', { key: 'go', style: S.row },
            h('button', { style: S.btn, disabled: busy, onClick: exportBatch },
              busy ? t('batch.exporting') : t('batch.export'))),
          error ? h('div', { key: 'err', style: S.error }, t('panel.failed', { msg: error })) : null,
          batchMsg ? h('div', { key: 'ok', style: S.ok },
            t('batch.done', { n: batchMsg.count, dir: batchMsg.dir }),
            h('div', { style: S.hint }, t('batch.doneHint', { index: batchMsg.index }))) : null,
        ]
      } else {
        body = [
          mode === 'rxn'
            ? h('textarea', {
              key: 'ta', style: S.area, value: rxnText, spellCheck: false,
              placeholder: t('rxn.placeholder'),
              onChange: (e) => setRxnText(e.target.value),
              onKeyDown: (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') renderAll('rxn')
              },
            })
            : h('textarea', {
              key: 'ta', style: S.area, value: text, spellCheck: false,
              placeholder: t('panel.placeholder'),
              onChange: (e) => setText(e.target.value),
              onKeyDown: (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') renderAll('single')
              },
            }),
          mode === 'rxn'
            ? h('div', { key: 'rg', style: S.col },
              h('span', { style: S.label }, t('rxn.reagents')),
              h('input', {
                style: S.input, value: reagents, spellCheck: false,
                placeholder: t('rxn.reagentsPh'),
                onChange: (e) => setReagents(e.target.value),
              }))
            : null,
          h('div', { key: 'go', style: S.row },
            h('button', {
              style: S.btn, disabled: busy,
              onClick: () => renderAll(mode === 'rxn' ? 'rxn' : 'single'),
            }, busy ? t('panel.rendering') : t('panel.render')),
            h('button', {
              style: S.btnGhost,
              onClick: () => {
                if (mode === 'rxn') setRxnText('')
                else setText('')
                release(); setItems([]); setError('')
              },
            }, t('panel.clear'))),
          opts,
          error ? h('div', { key: 'err', style: S.error }, t('panel.failed', { msg: error })) : null,
          !error && !busy && !items.length
            ? h('div', { key: 'empty', style: S.hint }, t('panel.empty'))
            : null,
          ...items.map((item) => h(Card, {
            key: `${item.index}-${item.label.slice(0, 12)}`, t, item, onCopy: copyPng,
          })),
        ]
      }

      return h('div', { style: S.root },
        h('h2', { style: S.title }, t('panel.title')),
        h('div', { style: S.modes }, ['single', 'rxn', 'batch', 'draw'].map(modeBtn)),
        ...body,
        h(DrawPanel, { key: 'draw', t, active: mode === 'draw' }),
        mode === 'draw'
          ? h('div', { style: S.hint }, t('draw.hint'))
          : mode === 'batch' ? null : h('div', { style: S.hint }, t('panel.hint')))
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs'],
      // 暴露给测试/调试：手绘画板是纯 DOM 组件，可以脱离 React 单独实例化
      DrawBoard,
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-chemdraw: copy')

        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          title: () => {
            const lang = ctx.locale.getSnapshot().active || ''
            return lang.startsWith('en') ? 'Structure' : '结构式'
          },
          guide: [{
            order: 40,
            title: () => {
              const lang = ctx.locale.getSnapshot().active || ''
              return lang.startsWith('en') ? 'Structure renderer' : '结构式渲染'
            },
          }],
        }), 'dsh-chemdraw: sidebar tab type')

        ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
        }, Panel)), 'dsh-chemdraw: panel body')
      },
    }
  },
})










