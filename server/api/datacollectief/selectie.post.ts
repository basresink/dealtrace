// POST /api/datacollectief/selectie {doelgroepId?, selectie}: een ronde met alleen Datacollectief als bron,
// op een doelgroep of een losse selectie (branche, SBI, omvang, postcodes). 429 bij een vol plafond.
import { eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { draaiRonde, schoonZoekopdracht } from '../../utils/leads'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leadgenerator.datacollectief')
  const b = await readBody<{ doelgroepId?: string; selectie?: Record<string, unknown> }>(event)
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    let basis: Record<string, unknown> = { ...(b?.selectie ?? {}) }
    if (b?.doelgroepId) {
      const [d] = await tx.select().from(schema.doelgroepen).where(eq(schema.doelgroepen.id, b.doelgroepId))
      if (!d) throw createError({ statusCode: 404, statusMessage: 'Doelgroep niet gevonden' })
      const dd = d.data as any
      basis = { doelgroepId: d.id, doelgroepNaam: d.naam, sbi: dd?.sbi ?? [], klassen: dd?.klassen ?? [], omvang: dd?.omvang ?? {}, werkgebied: { postcodes: dd?.postcodes ?? [] }, brancheId: dd?.vvBrancheId ?? null, ...basis }
    }
    const z = schoonZoekopdracht(basis)
    const r = await draaiRonde(tx, { id: ctx.organisatie!.id, pakket: ctx.organisatie!.pakket }, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, werkplek: ctx.gebruiker.werkplek, data: ctx.gebruiker.data }, z, ['datacollectief'])
    return { rondeId: r.rondeId, aantal: r.aantal, records: r.dc ?? 0, bewaard: r.bewaard, melding: r.melding ?? null }
  })
})
