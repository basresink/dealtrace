// GET /api/contacten/export?...filters: CSV van de gefilterde contactlijst (Expert, zelfde functie als de accountexport).
import { contactFiltersUitQuery, pasContactFiltersToe, sorteerContacten } from '../../../shared/contactFilters'
import { CONTACTROL_LABEL, type ContactRol } from '../../../shared/contactgegevens'
import { effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { contactExtra, contactRijen, laatsteActiviteit } from '../../utils/contactLijst'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const csv = (v: unknown) => { const t = v === null || v === undefined ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t }

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.export')
  const q = getQuery(event) as Record<string, string>
  const f = contactFiltersUitQuery(q)
  if (!kan(ctx, 'contacten.filters')) { f.bereikbaarheid = []; f.laatsteContact = []; f.toestemming = [] }
  const { rijen, velden } = await metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const lijst = pasContactFiltersToe(await contactRijen(tx, velden), f, { gebruikerId: ctx.gebruiker.id })
    const extra = await contactExtra(tx, lijst.map((c) => c.accountId))
    return { velden, rijen: sorteerContacten(lijst.map((c) => ({ ...c, laatsteActiviteitOp: laatsteActiviteit(extra.activiteit.get(c.accountId), c.laatsteContactOp) })), q.sort ?? 'rol') }
  })
  const kop = ['naam', 'functie', 'rol', 'bedrijf', 'soort', 'email', 'telefoon', 'mobiel', 'bel_me_niet', 'toestemming_email', 'status', 'laatste_activiteit', ...velden.map((v) => `cf:${v.sleutel}`)]
  const regels = rijen.map((c) => [
    c.naam, c.functie, CONTACTROL_LABEL[c.rol as ContactRol] ?? c.rol, c.bedrijf, c.soort, c.email, c.telefoon, c.mobiel, c.belMeNiet ? 'ja' : 'nee',
    (c.consent as any)?.email?.status ?? 'onbekend', c.status, c.laatsteActiviteitOp?.slice(0, 10), ...velden.map((v) => c.customFields[v.sleutel]),
  ].map(csv).join(';'))
  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition', 'attachment; filename="dealtrace-contacten.csv"')
  return '﻿' + [kop.join(';'), ...regels].join('\n')
})
