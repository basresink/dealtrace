// PUT /api/instellingen/terugkomen/afkoeling {afkoeling: {bellen, mail, linkedin, whatsapp, bezoek, kaart}}: de enige
// plek waar de afkoeling per kanaal verandert. Alleen de beheerder; elk kanaal 0 tot 730 dagen. Wachtende
// prospects die nog niet gestart zijn en geen aangepaste datum hebben, verschuiven.
import { leesAfkoeling } from '../../../../shared/terugkomBeheer'
import { metOrganisatie } from '../../../utils/db'
import { vergeetOrganisaties } from '../../../utils/kortGeheugen'
import { vereisFunctie } from '../../../utils/sessie'
import { bewaarAfkoeling } from '../../../utils/terugkomBeheer'

export default defineEventHandler(async (event) => {
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await vereisFunctie(event, 'instellingen.afkoeling')
  const b = await readBody<any>(event)
  const a = leesAfkoeling(b?.afkoeling)
  if (!a) throw createError({ statusCode: 422, statusMessage: 'Geef per kanaal een aantal dagen tussen 0 en 730' })
  return metOrganisatie(ctx.organisatie.id, (tx) => bewaarAfkoeling(tx, ctx.organisatie.id, ctx.gebruiker.id, a))
})
