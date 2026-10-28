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
  id: 'dsh-chemdraw',
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
      if (mode === 'batch') {
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
        h('div', { style: S.modes }, ['single', 'rxn', 'batch'].map(modeBtn)),
        ...body,
        mode === 'batch' ? null : h('div', { style: S.hint }, t('panel.hint')))
    }

    return {
      inject: ['slots', 'locale', 'sidebarRightTabs'],
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
