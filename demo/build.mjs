#!/usr/bin/env node
/**
 * 把 template.html + assets/* 合成**单文件**的 index.html。
 *
 *   node demo/build.mjs
 *
 * - {{SVG:aspirin}} → 内联 <svg>（去掉根元素 width/height，保留 viewBox，交 CSS 控制）
 * - src="assets/x.svg|png" → data: URI
 *
 * 产物不依赖任何外部文件，直接把 index.html 一个文件发给别人（微信 / 邮件 / 手机）也能看。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const template = await readFile(join(HERE, 'template.html'), 'utf8')

const names = [...new Set([...template.matchAll(/\{\{SVG:([a-z0-9-]+)\}\}/g)].map((m) => m[1]))]
const inline = new Map()

for (const name of names) {
  let svg = await readFile(join(HERE, 'assets', `${name}.svg`), 'utf8')
  svg = svg.replace(/<\?xml[^>]*\?>\s*/i, '').trim()
  svg = svg.replace(/<svg([^>]*)>/, (_, attrs) => {
    const cleaned = attrs.replace(/\s(?:width|height)="[^"]*"/gi, '')
    return `<svg${cleaned} class="mol" role="img" aria-hidden="true">`
  })
  inline.set(name, svg)
}

let html = template.replace(/\{\{SVG:([a-z0-9-]+)\}\}/g, (_, name) => inline.get(name) ?? '')
html = html.replaceAll('{{YEAR}}', String(new Date().getFullYear()))

// 把剩下的 <img src="assets/..."> 全部转成 data: URI
const MIME = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }
const refs = [...new Set([...html.matchAll(/src="assets\/([a-z0-9._-]+)"/g)].map((m) => m[1]))]
for (const file of refs) {
  const ext = file.split('.').pop().toLowerCase()
  const mime = MIME[ext]
  if (!mime) throw new Error(`不认识的素材类型：${file}`)
  const bytes = await readFile(join(HERE, 'assets', file))
  html = html.split(`src="assets/${file}"`).join(`src="data:${mime};base64,${bytes.toString('base64')}"`)
}

if (/src="assets\//.test(html) || /\{\{SVG:/.test(html)) {
  throw new Error('还有没内联的外部引用，检查 template.html')
}

await writeFile(join(HERE, 'index.html'), html)
console.log(
  `✔ demo/index.html 生成完成：${(html.length / 1024).toFixed(1)} KB，` +
  `内联 ${names.length} 个结构式 + ${refs.length} 个位图/svg，无外部依赖`
)
