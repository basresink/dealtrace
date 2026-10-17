// GET /api/instellingen/overzicht: per kaart op Instellingen de stand in woorden (F22), bijvoorbeeld
// "23 regels, 19 door de motor" of "Nog niet ingericht", en per groep een samenvatting ("3 van 5
// koppelingen actief"). Alleen voor de kaarten die de kijker mag zien; zelfde rechten als het scherm.
import { instellingenOverzicht } from '../../utils/instellingenOverzicht'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => instellingenOverzicht(await vereisFunctie(event, 'nav.instellingen')))
