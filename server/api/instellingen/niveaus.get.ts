// GET /api/instellingen/niveaus: leesoverzicht voor de beheerder. Per functie of hij voor Beginner,
// Gevorderd en Expert aanstaat in deze organisatie (met de afwijkingen die de founder voor jullie zette)
// en "Wie mag wat" per rol. Alleen lezen: de indeling zet de founder op /platform/features.
import { niveauOverzicht, wieMagWat } from '../../../shared/niveauOverzicht'
import { vereisBeheerder } from '../../utils/beheerder'

export default defineEventHandler(async (event) => {
  const { organisatie, stand } = await vereisBeheerder(event, 'niveaus.iedereenAlles')
  return { ...niveauOverzicht(organisatie, stand), rechten: wieMagWat() }
})
