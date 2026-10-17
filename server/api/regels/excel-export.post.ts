// POST /api/regels/excel-export: werkmap met blad "Regels" (keuzelijsten per kolom) en "Toelichting".
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { regelUitRij } from '../../utils/motor'
import { regelWerkmap } from '../../utils/regelWerkmap'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'regels.team') && !kan(ctx, 'regels.beheer')) weigerFunctie('regels.beheer', 'rol')
  const regels = await metOrganisatie(ctx.organisatie.id, async (tx) => (await tx.select().from(schema.activityRules)).map(regelUitRij))
  regels.sort((a, b) => (a.code ?? 'ZZ').localeCompare(b.code ?? 'ZZ') || a.naam.localeCompare(b.naam))
  setHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'content-disposition', 'attachment; filename="dealtrace-regels.xlsx"')
  return regelWerkmap(regels)
})
