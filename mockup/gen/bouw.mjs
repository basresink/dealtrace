// Bouwt alle schermen van de mock-up naar ../ (de map mockup).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as start from './paginas-start.mjs'
import * as prospects from './paginas-prospects.mjs'
import * as verkoop from './paginas-verkoop.mjs'
import * as richting from './paginas-richting.mjs'
import * as sturen from './paginas-sturen.mjs'

const uit = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const paginas = {
  vandaag: start.vandaag, taken: start.taken, inzichten: start.inzichten,
  leadgenerator: prospects.leadgenerator, prospects: prospects.prospects, jaarplanning: prospects.jaarplanning,
  campagnes: prospects.campagnes, 'campagne-bord': prospects.campagneBord, 'campagne-wizard': prospects.campagneWizard, belblokken: prospects.belblokken,
  pipeline: verkoop.pipeline, offertes: verkoop.offertes, account: verkoop.account, klanten: verkoop.klanten, contacten: verkoop.contacten,
  richting: richting.richting, winpunten: richting.winpunten, prospectmix: richting.prospectmix, hercontact: richting.hercontact, meetings: richting.meetings, kanalen: richting.kanalen,
  dashboard: sturen.dashboard, instellingen: sturen.instellingen, agents: sturen.agents,
}
let n = 0
for (const [naam, html] of Object.entries(paginas)) {
  fs.writeFileSync(path.join(uit, naam + '.html'), html)
  n++
}
fs.writeFileSync(path.join(uit, 'index.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./vandaag.html"><title>DealDrive New Business</title><a href="./vandaag.html">Open Vandaag</a>')
const alles = Object.values(paginas).join('\n')
console.log('schermen:', n, '| gedachtestreepjes:', (alles.match(/—/g) || []).length, '| tekens:', alles.length)
