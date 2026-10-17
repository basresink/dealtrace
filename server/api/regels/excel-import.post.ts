// POST /api/regels/excel-import (multipart: bestand, modus = samenvoegen|vervangen, proef?):
// tot 5 MB en 2.000 rijen; per rij fouten en waarschuwingen. Alleen de beheerder. Met proef=1 alleen
// lezen en tellen (bruikbaar, overgeslagen, bestaande regels geraakt); daarna toepassen met alleen de
// bruikbare rijen. Een rij met een fout wordt overgeslagen, nooit half bewaard.
import ExcelJS from 'exceljs'
import { eq } from 'drizzle-orm'
import { MAX_BYTES, MAX_RIJEN, regelUitRij as rijNaarRegel } from '../../../shared/regelExcel'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie, schema } from '../../utils/db'
import { schoonRegel } from '../../utils/regels'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'regels.beheer')
  const delen = await readMultipartFormData(event)
  const bestand = delen?.find((d) => d.name === 'bestand')
  if (!bestand?.data?.length) throw createError({ statusCode: 422, statusMessage: 'Kies een Excel-bestand' })
  if (bestand.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Het bestand is groter dan 5 MB. Maak het kleiner en probeer het opnieuw.' })
  const modus = delen?.find((d) => d.name === 'modus')?.data.toString() === 'vervangen' ? 'vervangen' : 'samenvoegen'
  const proef = delen?.find((d) => d.name === 'proef')?.data.toString() === '1'
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(bestand.data as any) } catch { throw createError({ statusCode: 422, statusMessage: 'Dit is geen leesbaar Excel-bestand' }) }
  const blad = wb.getWorksheet('Regels') ?? wb.worksheets[0]
  if (!blad) throw createError({ statusCode: 422, statusMessage: 'Het blad "Regels" ontbreekt' })
  const rijen: string[][] = []
  blad.eachRow({ includeEmpty: false }, (row) => { rijen.push((row.values as any[]).slice(1).map((v) => (v === null || v === undefined ? '' : typeof v === 'object' && 'text' in v ? String(v.text) : String(v)))) })
  if (rijen.length - 1 > MAX_RIJEN) throw createError({ statusCode: 422, statusMessage: `Het bestand heeft ${rijen.length - 1} rijen; het maximum is 2.000.` })
  const koppen = (rijen[0] ?? []).map((k) => k.trim())
  const rapport = rijen.slice(1).map((c, i) => ({ rij: i + 2, ...rijNaarRegel(koppen, c) }))
  const goed = rapport.filter((r) => !r.fouten.length)
  const rijenUit = rapport.map((r) => ({ rij: r.rij, naam: r.regel.naam, fouten: r.fouten, waarschuwingen: r.waarschuwingen }))
  if (proef) {
    const bestaand = await metOrganisatie(ctx.organisatie.id, async (tx) => new Set((await tx.select({ id: schema.activityRules.id }).from(schema.activityRules)).map((x) => x.id)))
    return { modus, toegepast: false, bruikbaar: goed.length, overgeslagen: rapport.length - goed.length, geraakt: goed.filter((r) => r.regel.id && bestaand.has(r.regel.id)).length, rijen: rijenUit }
  }
  if (!goed.length) return { modus, toegepast: false, bruikbaar: 0, overgeslagen: rapport.length, geraakt: 0, rijen: rijenUit }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    if (modus === 'vervangen') await tx.delete(schema.activityRules)
    let nieuw = 0
    let bijgewerkt = 0
    for (const r of goed) {
      const s = schoonRegel(r.regel)
      const [bestaand] = r.regel.id && modus === 'samenvoegen' ? await tx.select().from(schema.activityRules).where(eq(schema.activityRules.id, r.regel.id)) : []
      if (bestaand) { await tx.update(schema.activityRules).set({ ...s, versie: bestaand.versie + 1, updatedAt: new Date().toISOString() }).where(eq(schema.activityRules.id, bestaand.id)); bijgewerkt++ }
      else { await tx.insert(schema.activityRules).values({ ...s, ...(r.regel.id ? { id: r.regel.id } : {}), organisationId: ctx.organisatie.id }); nieuw++ }
    }
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'regels.import', resourceType: 'activity_rules', changes: { modus, nieuw, bijgewerkt, overgeslagen: rapport.length - goed.length } })
    return { modus, toegepast: true, nieuw, bijgewerkt, bruikbaar: goed.length, overgeslagen: rapport.length - goed.length, rijen: rijenUit }
  })
})
