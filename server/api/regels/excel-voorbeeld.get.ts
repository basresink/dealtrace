// GET /api/regels/excel-voorbeeld: het voorbeeldbestand voor de import (alle kolommen, uitleg,
// keuzelijsten en één fictieve voorbeeldregel). Alleen de beheerder importeert.
import { regelWerkmap, VOORBEELDREGEL } from '../../utils/regelWerkmap'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  await vereisFunctie(event, 'regels.beheer')
  setHeader(event, 'content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  setHeader(event, 'content-disposition', 'attachment; filename="dealtrace-regels-voorbeeld.xlsx"')
  return regelWerkmap([VOORBEELDREGEL])
})
