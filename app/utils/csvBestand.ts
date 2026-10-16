// Een CSV-bestand in de browser bewaren (analyses): dezelfde opmaak als de exports van Analyse
// (puntkomma, aanhalingstekens waar nodig) met een BOM zodat Excel de tekens goed leest.
import { naarCsv } from '~~/shared/team'

export function bewaarCsv(bestandsnaam: string, kolommen: { sleutel: string; label: string }[], rijen: Record<string, unknown>[]) {
  const blob = new Blob(['﻿', naarCsv(kolommen, rijen)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = bestandsnaam
  a.click()
  URL.revokeObjectURL(url)
}
