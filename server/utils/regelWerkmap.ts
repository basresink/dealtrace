// De Excel-werkmap van de regels: blad "Regels" met een keuzelijst per kolom en blad "Toelichting".
// Eén bouwer voor de export en het voorbeeldbestand van de import.
import ExcelJS from 'exceljs'
import { REGEL_KOLOMMEN } from '../../shared/regelExcel'
import type { Regel } from '../../shared/regelPatronen'

export async function regelWerkmap(regels: Regel[]): Promise<Buffer> {
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
  return Buffer.from(await wb.xlsx.writeBuffer())
}

/** Eén fictieve voorbeeldregel voor het voorbeeldbestand: een overgang in de reis met een taak. */
export const VOORBEELDREGEL: Regel = {
  id: '', code: null, naam: 'Na gekwalificeerd: kennismakingsbelletje', categorie: 'Bewerken', actief: true, motor: 'regel', scope: 'organisatie',
  reisId: null, faseId: null, cadansDagen: 0, prioriteit: 'middel',
  data: {
    omschrijving: 'Het account is net gekwalificeerd; bel binnen een werkdag voor een eerste kennismaking.', activiteit: 'taak', bron: 'intern',
    trigger: { patroon: 'reis-overgang', parameters: { vanFase: null, naarFase: 'gekwalificeerd', gebeurtenis: null } },
    afbakening: { accounttypes: ['prospect'], statussen: ['in reis'] },
    gevolg: { actiesoort: 'bellen', uitvoerderrol: 'eigenaar', termijnWerkdagen: 1, taaksjabloon: 'Bel {contact} van {account} over {winpunt}', winpuntIds: [], verwachtResultaat: 'Eerste gesprek' },
    herkomst: 'eigen',
  },
}
