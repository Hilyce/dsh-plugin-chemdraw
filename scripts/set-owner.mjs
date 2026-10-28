#!/usr/bin/env node
/**
 * 把仓库里的占位符 YOUR_GITHUB_USER 换成真实 GitHub 用户名 / 仓库所有者。
 *
 *   node scripts/set-owner.mjs <github-user>
 *
 * 只改这几个文件里的占位符：package.json、README.md、market/index.json、PUBLISH.md。
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PLACEHOLDER = 'YOUR_GITHUB_USER'
const FILES = ['package.json', 'README.md', 'market/index.json', 'PUBLISH.md']

const owner = (process.argv[2] || '').trim()
if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner)) {
  console.error('用法: node scripts/set-owner.mjs <github-user>')
  console.error('github-user 必须是合法的 GitHub 用户名（字母、数字、连字符）。')
  process.exit(1)
}

let changed = 0
for (const rel of FILES) {
  const file = join(ROOT, rel)
  let text
  try {
    text = await readFile(file, 'utf8')
  } catch {
    continue // 可选文件不存在就跳过
  }
  if (!text.includes(PLACEHOLDER)) continue
  const next = text.split(PLACEHOLDER).join(owner)
  await writeFile(file, next)
  const n = text.split(PLACEHOLDER).length - 1
  changed += n
  console.log(`✔ ${rel}: 替换 ${n} 处`)
}
console.log(changed === 0 ? '没有找到占位符（可能已经替换过）。' : `完成，共 ${changed} 处 -> ${owner}`)
