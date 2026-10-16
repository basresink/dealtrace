// GET /api/campagnes?status=&soort=&eigenaar=mij|<id>: de campagnes met tempo (F12). Lezen kan iedereen
// met "meedoen"; het tempo komt uit de ene functie in shared/campagnes.ts. Status mag een lijst zijn
// (actief,concept); perStatus telt per status met de andere filters erop, voor de tellers en het filter.
import { lijst } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  const q = getQuery(event)
  const tekst = (v: unknown) => (typeof v === 'string' && v && v !== 'alle' ? v : null)
  const eigenaar = q.eigenaar === 'mij' ? ctx.gebruiker.id : tekst(q.eigenaar)
  const statussen = (tekst(q.status) ?? '').split(',').filter(Boolean)
  const r = await metOrganisatie(ctx.organisatie.id, (tx) => lijst(tx, { soort: tekst(q.soort), eigenaar }))
  const perStatus: Record<string, number> = {}
  for (const c of r.campagnes) perStatus[c.status] = (perStatus[c.status] ?? 0) + 1
  return { ...r, perStatus, campagnes: statussen.length ? r.campagnes.filter((c) => statussen.includes(c.status)) : r.campagnes }
})
