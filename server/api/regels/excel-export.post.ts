// POST /api/regels/excel-export: werkmap met blad "Regels" (keuzelijsten per kolom) en "Toelichting".
import ExcelJS from 'exceljs'
import { REGEL_KOLOMMEN } from '../../../shared/regelExcel'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { regelUitRij } from '../../utils/motor'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'regels.team') && !kan(ctx, 'regels.beheer')) weigerFunctie('regels.beheer', 'rol')
  const regels = await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select().from(schema.activityRules)).map(regelUitRij))
  regels.sort((a, b) => (a.code ?? 'ZZ').localeCompare(b.code ?? 'ZZ') || a.naam.localeCompare(b.naam))
  const wb = new ExcelJS.Workbook()
  const blad = wb.addWorksheet('Regels')
  blad.addRow(REGEL_KOLOMMEN.map((k) => k.kop))
  blad.getRow(1).font = { bold: true }
  for (const r of regels) blad.addRow(REGEL_KOLOMMEN.map((k) => String(k.uit(r))))
  REGEL_KOLOMMEN.forEach((k, i) => {
    blad.getColumn(i + 1).width = Math.min(40, Math.max(12, k.kop.length + 2))
    if (!k.keuzes) return
    const kolom = blad.getColumn(i + 1).letter
    for (let rij = 2; rij <= Math.max(regels.length + 1, 200); rij++) {
      blad.getCell(`${kolom}${rij}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${k.keuzes.join(',')}"`] }
    }
  })
  const uitleg = wb.addWorksheet('Toelichting')
  uitleg.addRow(['Kolom', 'Toelichting'])
  for (const k of REGEL_KOLOMMEN) uitleg.addRow([k.kop, k.toelichting + (k.keuzes ? ` Keuzes: ${k.keuzes.join(', ')}.` : '')])
  setHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'content-disposition', 'attachment; filename="dealtrace-regels.xlsx"')
  return Buffer.from(await wb.xlsx.writeBuffer())
})
