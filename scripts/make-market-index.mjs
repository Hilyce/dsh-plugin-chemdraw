#!/usr/bin/env node
/**
 * 生成 DSH 插件市场索引 market/index.json（format 1）。
 *
 *   node scripts/make-market-index.mjs
 *
 * - 版本号、描述来自 package.json
 * - publishTimestamp 优先取 npm registry 上的真实发布时间，取不到才用当前时间
 * - icon 内联成 data: URL，索引文件自包含，不依赖相对资源
 *
 * 每次 npm publish 之后重跑一次并 commit，Discover 里就能看到新版本。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))

const owner =
  (pkg.repository?.url || '').match(/github\.com[/:]([^/]+)\//)?.[1] || 'YOUR_GITHUB_USER'
const repoUrl = `https://github.com/${owner}/${pkg.name}`
const iconSvg = await readFile(join(ROOT, 'icon.svg'), 'utf8')
const icon = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`

async function publishedAt(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = await response.json()
    const seconds = Math.floor(Date.parse(body.time || '') / 1000)
    if (Number.isInteger(seconds) && seconds > 0) return seconds
  } catch (error) {
    console.warn(`! 读取 npm 发布时间失败（${error.message}），改用当前时间`)
  }
  return Math.floor(Date.now() / 1000)
}

const timestamp = await publishedAt(pkg.name, pkg.version)

const index = {
  format: 1,
  title: { en: 'ChemDraw Tools', zh: '化学结构式工具' },
  description: {
    en: 'Third-party DSH bundles for drawing chemical structures from SMILES.',
    zh: '第三方 DSH 插件索引：把 SMILES 画成可用于论文与 Word 的结构式。'
  },
  metadata: {
    categories: { chemistry: { title: { en: 'Chemistry', zh: '化学' } } },
    labels: {
      rdkit: { title: { en: 'RDKit', zh: 'RDKit' } },
      offline: { title: { en: 'Works offline', zh: '离线可用' } }
    }
  },
  plugins: [
    {
      name: pkg.name,
      title: { en: 'ChemDraw structures', zh: '结构式 / 反应式渲染' },
      description: {
        en: 'SMILES to skeletal structure images: transparent PNG/SVG, uniform bond length, reaction schemes, batch export. Ships its own RDKit runtime.',
        zh: '把 SMILES 渲染成键线式结构图：透明底 PNG/SVG、键长统一、反应式排版、批量导出，自带 RDKit 运行时。'
      },
      icon,
      author: owner,
      homepage: `${repoUrl}#readme`,
      repository: { url: repoUrl },
      metadata: {
        category: 'chemistry',
        keywords: ['smiles', 'structure', 'reaction', '化学', '结构式', '反应式'],
        labels: ['rdkit', 'offline']
      },
      versions: [
        {
          version: pkg.version,
          publishTimestamp: timestamp,
          source: { type: 'npm' }
        }
      ]
    }
  ]
}

await mkdir(join(ROOT, 'market'), { recursive: true })
await writeFile(join(ROOT, 'market', 'index.json'), `${JSON.stringify(index, null, 2)}\n`)
console.log(`✔ market/index.json 已生成：${pkg.name}@${pkg.version}（${new Date(timestamp * 1000).toISOString()}）`)
