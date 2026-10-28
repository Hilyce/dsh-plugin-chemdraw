#!/usr/bin/env node
/**
 * 把 template.html + assets/*.svg 合成自包含的 index.html。
 *
 *   node demo/build.mjs
 *
 * 模板里的 {{SVG:aspirin}} 会被替换成 assets/aspirin.svg 的内联内容，
 * 同时去掉根元素的 width/height，交给 CSS 控制尺寸（保留 viewBox，比例不变）。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
let template = await readFile(join(HERE, 'template.html'), 'utf8')

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

await writeFile(join(HERE, 'index.html'), html)
console.log(`✔ demo/index.html 生成完成：${(html.length / 1024).toFixed(1)} KB，内联 ${names.length} 个结构式`)
