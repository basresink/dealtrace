// GET /api/mij/functies: wat er voor mij aanstaat, wat nog niet aangezet is, wat buiten
// het pakket valt en wat ik verborg, plus de functies die de laatste 7 dagen aangingen.
// De versie verandert zodra de stand verandert; de client haalt dan opnieuw op.
import { createHash } from 'node:crypto'
import { werkFunctiesGezienBij } from '../../utils/functiesGezien'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const { gebruiker, organisatie, stand } = await vereisOrganisatie(event)
  const r = await werkFunctiesGezienBij(gebruiker, organisatie, stand)
  const versie = createHash('sha1').update(JSON.stringify([r.aan, r.nietAangezet, r.verborgen, gebruiker.niveau])).digest('hex').slice(0, 12)
  return { aan: r.aan, nietAangezet: r.nietAangezet, buitenPakket: r.buitenPakket, verborgen: r.verborgen, nieuw: r.nieuw, versie }
})
