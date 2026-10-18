// GET /api/instellingen/niveaus: het overzicht voor de beheerder. Per functie of hij voor Beginner,
// Gevorderd en Expert aanstaat in deze organisatie, met de standaard, de keuze van de beheerder en wat
// Dealtrace uitzette, en "Wie mag wat" per rol. Wijzigen: PUT /api/instellingen/niveaus/functie.
import { wieMagWat } from '../../../shared/niveauOverzicht'
import { metOrganisatie } from '../../utils/db'
import { vereisBeheerder } from '../../utils/beheerder'
import { overzichtNu } from '../../utils/functieKeuzes'

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'niveaus.iedereenAlles')
  const overzicht = await metOrganisatie(ctx.organisatie.id, (tx) => overzichtNu(tx, ctx))
  return { ...overzicht, rechten: wieMagWat() }
})
