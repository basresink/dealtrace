// POST /api/import/voorbeeld (multipart: bestand, soort, label): leest Excel of CSV,
// bewaart de rijen tijdelijk in een conceptbatch en geeft kolommen, koppelvoorstel
// en 10 voorbeeldrijen terug.
import readXlsxFile from 'read-excel-file/node'
import { leesCsv } from '../../../shared/csv'
import { importKoppeling } from '../../../shared/leadGenerator'
import { effectiefNiveau, eigenVeldenVoor } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { MAX_BYTES, MAX_RIJEN } from '../../utils/importer'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.uitvoeren')
  const delen = await readMultipartFormData(event)
  const bestand = delen?.find((d) => d.name === 'bestand' && d.filename)
  const veld = (n: string) => delen?.find((d) => d.name === n)?.data.toString('utf8').trim() ?? ''
  if (!bestand) throw createError({ statusCode: 400, statusMessage: 'Kies een bestand (.xlsx of .csv)' })
  if (bestand.data.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'Het bestand is groter dan 10 MB. Splits het in kleinere delen.' })
  const label = veld('label')
  if (!label) throw createError({ statusCode: 400, statusMessage: 'Geef de import een bron en label, bijvoorbeeld "Beurs Vakdagen 2026"' })
  const soort = veld('soort') === 'bedrijven_contacten' ? 'bedrijven_contacten' : 'bedrijven'
  const naam = bestand.filename ?? 'bestand'
  let alles: string[][]
  try {
    if (/\.xlsx$/i.test(naam)) alles = (await readXlsxFile(bestand.data)).map((r) => r.map((c) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))))
    else if (/\.(csv|txt)$/i.test(naam)) alles = leesCsv(bestand.data.toString('utf8'))
    else throw createError({ statusCode: 415, statusMessage: 'Alleen Excel (.xlsx) of CSV' })
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 422, statusMessage: 'Het bestand kon niet worden gelezen. Sla het op als .xlsx of .csv en probeer opnieuw.' })
  }
  const [kop, ...rijen] = alles
  if (!kop || !rijen.length) throw createError({ statusCode: 422, statusMessage: 'Het bestand heeft geen rijen onder de kopregel' })
  if (rijen.length > MAX_RIJEN) throw createError({ statusCode: 422, statusMessage: `Het bestand heeft ${rijen.length} rijen; het maximum is ${MAX_RIJEN}. Splits het in kleinere delen.` })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const koppeling = importKoppeling(kop, velden)
    const [b] = await tx.insert(schema.importBatches).values({ organisationId: ctx.organisatie.id, gebruikerId: ctx.gebruiker.id, bestandsnaam: naam, soort, bronLabel: label, rijen, koppeling: Object.fromEntries(kop.map((k, i) => [String(i), koppeling[i] ?? ''])) }).returning({ id: schema.importBatches.id })
    return {
      batchId: b!.id, kolommen: kop, koppeling, voorbeeld: rijen.slice(0, 10), aantalRijen: rijen.length,
      eigenVelden: velden.map((v) => ({ sleutel: v.sleutel, naam: v.naam, type: v.type })),
      naamGevonden: koppeling.includes('naam'),
    }
  })
})
