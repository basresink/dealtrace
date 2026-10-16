// Toegang tot de kennisbank: de pagina Kennisbank vraagt de functie nav.kennisbank; het tabblad Documenten op de
// account- en contactkaart en de flyout van een document werken voor wie de accountkaart mag zien.
import type { H3Event } from 'h3'
import { beschikbaar } from '../../shared/functies'
import { vereisOrganisatie, weigerFunctie } from './sessie'

export async function vereisDocumenten(event: H3Event) {
  const ctx = await vereisOrganisatie(event)
  const mag = (f: string) => beschikbaar(f, ctx.gebruiker, ctx.organisatie, ctx.stand)
  const kb = mag('nav.kennisbank')
  if (!kb.ok && !mag('prospects.kaart').ok) weigerFunctie('nav.kennisbank', kb.reden)
  return ctx
}
