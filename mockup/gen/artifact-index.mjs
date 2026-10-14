// Maakt artifact-index.html: de Vandaag-pagina zonder doctype, html, head en body
// (de artifact-publicatie zet die er zelf omheen), met titel en stylesheets bovenaan.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const map = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bron = fs.readFileSync(path.join(map, 'vandaag.html'), 'utf8')
const body = bron.slice(bron.indexOf('<body>') + 6, bron.lastIndexOf('</body>'))
const kop = `<title>DealDrive New Business</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<link rel="stylesheet" href="./stijl.css">
<link rel="stylesheet" href="./mockup.css">
`
fs.writeFileSync(path.join(map, 'artifact-index.html'), kop + body)
console.log('artifact-index.html', (kop + body).length, 'tekens')
