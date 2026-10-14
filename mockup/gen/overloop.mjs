// Zoekt op 390 breed welke elementen buiten het venster steken.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Projecten/dealdrive/package.json')
const { chromium } = require('@playwright/test')
const map = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
for (const p of process.argv.slice(2)) {
  await page.goto('file:///' + path.join(map, p + '.html').replace(/\\/g, '/'))
  const uit = await page.evaluate(() => {
    const w = document.documentElement.clientWidth
    return [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.right > w + 1 && r.width > 0 }).slice(0, 12).map(e => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} right=${Math.round(e.getBoundingClientRect().right)} w=${Math.round(e.getBoundingClientRect().width)}`)
  })
  console.log(p, uit.join('\n  ') || 'geen overloop')
}
await browser.close()
