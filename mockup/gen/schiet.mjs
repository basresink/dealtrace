// Schiet de schermen van de mock-up op 1440 en 390 breed, voor een snelle controle.
// Gebruik: node schiet.mjs [pagina ...]   (schrijft naar ../shots/)
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Projecten/dealdrive/package.json')
const { chromium } = require('@playwright/test')
const map = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const shots = path.join(map, 'shots')
fs.mkdirSync(shots, { recursive: true })
const paginas = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(map).filter(f => f.endsWith('.html') && f !== 'index.html').map(f => f.replace('.html', ''))
const browser = await chromium.launch()
const fouten = []
for (const breed of [1440, 390]) {
  const ctx = await browser.newContext({ viewport: { width: breed, height: 900 } })
  const page = await ctx.newPage()
  page.on('console', m => { if (m.type() === 'error') fouten.push(`${breed} ${page.url()} ${m.text()}`) })
  page.on('pageerror', e => fouten.push(`${breed} ${page.url()} ${e.message}`))
  for (const p of paginas) {
    await page.goto('file:///' + path.join(map, p + '.html').replace(/\\/g, '/'))
    await page.waitForTimeout(300)
    const overloop = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    const klein = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e); return e.textContent.trim() && e.children.length === 0 && parseFloat(s.fontSize) < 11 && s.display !== 'none' }).length)
    await page.screenshot({ path: path.join(shots, `${p}-${breed}.png`), fullPage: true })
    console.log(`${p} @${breed}: overloop ${overloop}px, tekst onder 11px: ${klein}`)
  }
  await ctx.close()
}
await browser.close()
if (fouten.length) console.log('FOUTEN:\n' + fouten.join('\n'))
