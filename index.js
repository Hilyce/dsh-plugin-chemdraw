/**
 * dsh-plugin-chemdraw — SMILES -> 键线式（Host 半侧）
 *
 * 三个 HTTP 路由 + 三个 agent 工具，共用一个常驻 Python worker：
 *   GET  /chemdraw/render?smiles=...&format=svg|png&bond=42&color=0&annotate=0&white=0
 *   GET  /chemdraw/reaction?scheme=A.B>>C&reagents=H2SO4&format=svg|png
 *   POST /chemdraw/batch   {items:[{name,smiles}], outDir, format, bond, color, annotate}
 *
 * 本文件不 import 任何 @deepseek-ai/* 包，纯 ESM + node 内置模块。
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

export const name = 'dsh-plugin-chemdraw'
export const inject = ['tools', 'webServer']

/* ------------------------------------------------------------------ 路径 */

/** 与 @deepseek-ai/dsh-home-paths 同义：非空 DSH_HOME，否则 ~/.dsh */
function resolveDshHome() {
  const env = process.env.DSH_HOME
  return env !== undefined && env.trim() !== '' ? env : join(homedir(), '.dsh')
}

function bundledPython() {
  const root = join(resolveDshHome(), 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'python')
  return process.platform === 'win32' ? join(root, 'python.exe') : join(root, 'bin', 'python3')
}

/** rdkit 搜索路径：插件自带的 runtime/ 优先，其次用户配置 */
function resolvePyPath(config) {
  const candidates = []
  for (const p of (config.pyPath || '').split(';')) {
    const t = p.trim()
    if (t) candidates.push(t)
  }
  candidates.push(join(HERE, 'runtime'))
  return candidates.filter((p) => existsSync(p)).join(process.platform === 'win32' ? ';' : ':')
}

/* ------------------------------------------------------------------ worker */

class RenderWorker {
  constructor(config) {
    this.config = config
    this.child = null
    this.pending = []
    this.queue = Promise.resolve()
    this.lastStderr = ''
  }

  python() {
    const configured = (this.config.pythonPath || '').trim()
    if (configured) return configured
    const bundled = bundledPython()
    if (existsSync(bundled)) return bundled
    throw new Error(`找不到 Python 解释器。请设置插件配置 pythonPath，或安装到 ${bundled}`)
  }

  start() {
    if (this.child) return this.child
    // -B: 不写 .pyc。插件装在哪就在哪编译，不该往安装目录里丢 __pycache__
    const child = spawn(this.python(), ['-B', join(HERE, 'worker.py')], {
      cwd: HERE,
      windowsHide: true,
      env: {
        ...process.env,
        PYTHONPATH: resolvePyPath(this.config),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        PYTHONDONTWRITEBYTECODE: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    let buf = ''
    child.stdout.on('data', (chunk) => {
      buf += chunk
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        const waiter = this.pending.shift()
        if (!waiter) continue
        try {
          waiter.resolve(JSON.parse(line))
        } catch {
          waiter.reject(new Error('渲染进程返回了非法内容'))
        }
      }
    })
    child.stderr.on('data', (chunk) => {
      this.lastStderr = String(chunk).slice(-2000)
    })
    child.on('exit', (code) => {
      this.child = null
      const pending = this.pending
      this.pending = []
      for (const w of pending) w.reject(new Error(`渲染进程退出 (code ${code}) ${this.lastStderr}`))
    })
    child.on('error', (err) => {
      this.child = null
      const pending = this.pending
      this.pending = []
      for (const w of pending) w.reject(err)
    })
    this.child = child
    return child
  }

  /** worker 一次处理一行，串行化请求 */
  request(req) {
    const run = () => new Promise((resolvePromise, rejectPromise) => {
      let child
      try {
        child = this.start()
      } catch (err) {
        rejectPromise(err)
        return
      }
      const timeout = Number(this.config.timeoutMs) || 25000
      let settled = false
      const finish = (fn) => (v) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const i = this.pending.indexOf(waiter)
        if (i >= 0) this.pending.splice(i, 1)
        fn(v)
      }
      const waiter = { resolve: finish(resolvePromise), reject: finish(rejectPromise) }
      const timer = setTimeout(() => {
        waiter.reject(new Error(`渲染超时 (${timeout}ms)`))
        this.kill()
      }, timeout)
      this.pending.push(waiter)
      child.stdin.write(`${JSON.stringify(req)}\n`, 'utf8')
    })
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => {})
    return next
  }

  kill() {
    if (this.child) {
      try {
        this.child.kill()
      } catch {
        /* 忽略 */
      }
      this.child = null
    }
  }
}

function makeRenderer(config) {
  const worker = new RenderWorker(config)
  return async function render(req) {
    const res = await worker.request(req)
    if (!res || res.ok !== true) throw new Error((res && res.error) || '渲染失败')
    return res
  }
}

/* ---------------------------------------------------------------- 响应工具 */

function send(res, status, type, body) {
  res.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(body)
}

function sendJson(res, status, obj) {
  send(res, status, 'application/json; charset=utf-8', JSON.stringify(obj))
}

function sendImage(res, result) {
  if (result.format === 'png') {
    send(res, 200, 'image/png', Buffer.from(result.data, 'base64'))
  } else {
    send(res, 200, 'image/svg+xml; charset=utf-8', result.data)
  }
}

async function readJson(req, limit = 2 * 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

/* ------------------------------------------------------------------ 路由 */

function queryOpts(url) {
  const out = {
    format: (url.searchParams.get('format') || 'svg').toLowerCase(),
    bond: Number(url.searchParams.get('bond')) || undefined,
    color: url.searchParams.get('color') === '1',
    annotate: url.searchParams.get('annotate') === '1',
  }
  return out
}

function makeRoutes(render) {
  const single = (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const smiles = (url.searchParams.get('smiles') ?? '').trim()
    if (!smiles) return sendJson(res, 400, { error: '缺少 smiles 参数' })
    if (smiles.length > 4000) return sendJson(res, 413, { error: 'SMILES 过长' })
    const o = queryOpts(url)
    render({ op: 'render', smiles, format: o.format, bond: o.bond,
      color: o.color, annotate: o.annotate,
      white: url.searchParams.get('white') === '1' }).then(
      (r) => sendImage(res, r),
      (e) => sendJson(res, 400, { error: String(e.message || e) }))
  }

  const reaction = (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const schemeStr = (url.searchParams.get('scheme') ?? '').trim()
    if (!schemeStr) return sendJson(res, 400, { error: '缺少 scheme 参数' })
    if (!schemeStr.includes('>>')) return sendJson(res, 400, { error: '反应式需要 ">>" 分隔' })
    if (schemeStr.length > 8000) return sendJson(res, 413, { error: '反应式过长' })
    const o = queryOpts(url)
    render({ op: 'scheme', scheme: schemeStr, format: o.format, bond: o.bond,
      color: o.color, annotate: o.annotate,
      reagents: url.searchParams.get('reagents') || undefined }).then(
      (r) => sendImage(res, r),
      (e) => sendJson(res, 400, { error: String(e.message || e) }))
  }

  const batch = async (req, res) => {
    let body
    try {
      body = await readJson(req)
    } catch (err) {
      return sendJson(res, 400, { error: String(err.message || err) })
    }
    const outDir = String(body.outDir || '').trim()
    if (!outDir) return sendJson(res, 400, { error: '缺少 outDir' })
    if (!isAbsolute(outDir)) return sendJson(res, 400, { error: 'outDir 必须是绝对路径' })
    const items = Array.isArray(body.items) ? body.items : []
    if (!items.length) return sendJson(res, 400, { error: '没有可渲染的结构' })
    render({ op: 'batch', items, outDir, format: (body.format || 'svg').toLowerCase(),
      bond: Number(body.bond) || undefined, color: body.color === true,
      annotate: body.annotate === true }).then(
      (r) => sendJson(res, 200, { ok: true, dir: r.dir, count: r.count,
        files: r.files, index: r.index }),
      (e) => sendJson(res, 400, { error: String(e.message || e) }))
  }

  const identify = async (req, res) => {
    let body
    try {
      body = await readJson(req, 512 * 1024)
    } catch (err) {
      return sendJson(res, 400, { error: String(err.message || err) })
    }
    const molblock = typeof body.molblock === 'string' ? body.molblock.trim() : ''
    const smiles = typeof body.smiles === 'string' ? body.smiles.trim() : ''
    if (!molblock && !smiles) return sendJson(res, 400, { error: '缺少 molblock 或 smiles' })
    if (molblock.length > 200000 || smiles.length > 4000) {
      return sendJson(res, 413, { error: '输入过长' })
    }
    try {
      const r = await render({ op: 'identify', molblock: molblock || undefined, smiles: smiles || undefined })
      sendJson(res, 200, r)
    } catch (err) {
      // 结构不合法属于“正常回答”，用 200 + ok:false 交给客户端展示
      sendJson(res, 200, { ok: false, error: String(err.message || err) })
    }
  }

  return { single, reaction, batch, identify }
}

/* ------------------------------------------------------------------- 插件 */

export function apply(ctx, config = {}) {
  const render = makeRenderer(config || {})
  const routes = makeRoutes(render)

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/chemdraw/render',
    handler: (req, res) => (req.method === 'GET' ? routes.single(req, res) : sendJson(res, 405, { error: 'GET only' })),
  }), 'dsh-chemdraw: render route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/chemdraw/reaction',
    handler: (req, res) => (req.method === 'GET' ? routes.reaction(req, res) : sendJson(res, 405, { error: 'GET only' })),
  }), 'dsh-chemdraw: reaction route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/chemdraw/batch',
    handler: (req, res) => (req.method === 'POST' ? routes.batch(req, res) : sendJson(res, 405, { error: 'POST only' })),
  }), 'dsh-chemdraw: batch route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/chemdraw/identify',
    handler: (req, res) => (req.method === 'POST' ? routes.identify(req, res) : sendJson(res, 405, { error: 'POST only' })),
  }), 'dsh-chemdraw: identify route')

  /* -------------------------------------------------------------- 工具 1 */

  ctx.tools.register({
    name: 'smiles_to_structure',
    description:
      '把 SMILES 渲染成二维键线式结构图（透明底、按内容紧裁、键长统一）并保存到文件。'
      + '返回保存的文件路径。适合插入 Word 文档。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        smiles: { type: 'string', description: 'SMILES 字符串，例如 "CC(=O)Oc1ccccc1C(=O)O"' },
        out: { type: 'string', description: '输出文件的绝对路径，以 .svg 或 .png 结尾（必填）' },
        format: { type: 'string', enum: ['svg', 'png'], description: 'svg 是矢量图（推荐，Word 2016+ 可直接插入）；png 是位图。默认按 out 的扩展名' },
        bond: { type: 'integer', description: '键长像素，默认 42。同一张图里多个分子用同一个值就能对齐尺度' },
        color: { type: 'boolean', description: '杂原子用颜色（默认黑白，适合印刷）' },
        annotate: { type: 'boolean', description: '标注 R/S 立体描述符' },
      },
      required: ['smiles', 'out'],
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const smiles = String(args.smiles ?? '').trim()
      if (!smiles) throw new Error('smiles 不能为空')
      const out = String(args.out ?? '').trim()
      if (!out) throw new Error('缺少 out：请给出绝对路径')
      const target = isAbsolute(out) ? out : resolve(process.cwd(), out)
      const format = args.format === 'png' || /\.png$/i.test(target) ? 'png' : 'svg'

      const result = await render({
        op: 'render', smiles, format,
        bond: args.bond ? Number(args.bond) : undefined,
        color: args.color === true, annotate: args.annotate === true,
      })
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, result.format === 'png'
        ? Buffer.from(result.data, 'base64')
        : result.data, result.format === 'png' ? undefined : 'utf8')
      return target
    },
  })

  /* -------------------------------------------------------------- 工具 2 */

  ctx.tools.register({
    name: 'smiles_reaction',
    description:
      '把反应式渲染成一张图（底物 + 箭头 + 产物，自动对齐、键长统一）。'
      + '格式 "底物.底物>>产物.产物"，组分用 . 分隔；可给出箭头上方的条件文字。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        scheme: { type: 'string', description: '反应式，例如 "CC(=O)O.OCC>>CC(=O)OCC.O"' },
        out: { type: 'string', description: '输出文件绝对路径（.svg/.png，必填）' },
        reagents: { type: 'string', description: '箭头上方的条件文字，例如 "H2SO4, cat."' },
        format: { type: 'string', enum: ['svg', 'png'] },
        bond: { type: 'integer', description: '键长像素，默认 42' },
        color: { type: 'boolean' },
        annotate: { type: 'boolean' },
      },
      required: ['scheme', 'out'],
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const schemeStr = String(args.scheme ?? '').trim()
      if (!schemeStr.includes('>>')) throw new Error('反应式需要 ">>" 分隔')
      const out = String(args.out ?? '').trim()
      if (!out) throw new Error('缺少 out：请给出绝对路径')
      const target = isAbsolute(out) ? out : resolve(process.cwd(), out)
      const format = args.format === 'png' || /\.png$/i.test(target) ? 'png' : 'svg'

      const result = await render({
        op: 'scheme', scheme: schemeStr, format,
        reagents: args.reagents ? String(args.reagents) : undefined,
        bond: args.bond ? Number(args.bond) : undefined,
        color: args.color === true, annotate: args.annotate === true,
      })
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, result.format === 'png'
        ? Buffer.from(result.data, 'base64')
        : result.data, result.format === 'png' ? undefined : 'utf8')
      return target
    },
  })

  /* -------------------------------------------------------------- 工具 3 */

  ctx.tools.register({
    name: 'smiles_batch',
    description:
      '批量把一串 SMILES 渲染成文件，写进一个目录，并生成 index.html 预览页。'
      + '每行一个 SMILES（也接受逗号分隔），返回目录、文件数和预览页路径。',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        smiles: { type: 'string', description: '多个 SMILES，每行一个' },
        outDir: { type: 'string', description: '输出目录绝对路径（必填，不存在会创建）' },
        format: { type: 'string', enum: ['svg', 'png'], description: '默认 svg' },
        bond: { type: 'integer', description: '键长像素，默认 42' },
        color: { type: 'boolean' },
        annotate: { type: 'boolean' },
      },
      required: ['smiles', 'outDir'],
    },
    output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
    async execute(args) {
      const raw = String(args.smiles ?? '')
      const list = raw.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean)
      if (!list.length) throw new Error('没有可渲染的 SMILES')
      const outDir = String(args.outDir ?? '').trim()
      if (!outDir) throw new Error('缺少 outDir：请给出绝对目录')
      const dir = isAbsolute(outDir) ? outDir : resolve(process.cwd(), outDir)

      const result = await render({
        op: 'batch',
        items: list.map((smiles) => ({ smiles })),
        outDir: dir,
        format: args.format === 'png' ? 'png' : 'svg',
        bond: args.bond ? Number(args.bond) : undefined,
        color: args.color === true, annotate: args.annotate === true,
      })
      if (typeof result.dir === 'string') {
        await mkdir(result.dir, { recursive: true })
      }
      return `${result.dir}\n${result.count} 个文件 (${result.format})，预览页：${result.index}`
    },
  })
}
