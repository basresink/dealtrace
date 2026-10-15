// GET /api/import: de importbatches (zonder rijen en regels).
import { desc } from 'drizzle-orm'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.uitvoeren')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select({ id: schema.importBatches.id, bestandsnaam: schema.importBatches.bestandsnaam, label: schema.importBatches.bronLabel, gebruikerId: schema.importBatches.gebruikerId, status: schema.importBatches.status, rapport: schema.importBatches.rapport, op: schema.importBatches.createdAt, verwerktOp: schema.importBatches.verwerktOp })
      .from(schema.importBatches).orderBy(desc(schema.importBatches.createdAt)).limit(100)
    const namen = new Map((await tx.select({ id: schema.users.id, naam: schema.users.name }).from(schema.users)).map((u) => [u.id, u.naam]))
    const allesTerug = ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)
    return rijen.filter((r) => r.status !== 'concept' || r.gebruikerId === ctx.gebruiker.id).map((r) => ({
      id: r.id, bestandsnaam: r.bestandsnaam, label: r.label, door: namen.get(r.gebruikerId) ?? r.gebruikerId, status: r.status, op: r.verwerktOp ?? r.op,
      aantallen: { nieuw: r.rapport?.nieuw ?? 0, samengevoegd: r.rapport?.samengevoegd ?? 0, overgeslagen: r.rapport?.overgeslagen ?? 0, fouten: r.rapport?.fouten ?? 0 },
      magTerugdraaien: r.status === 'verwerkt' && kan(ctx, 'import.terugdraaien') && (allesTerug || r.gebruikerId === ctx.gebruiker.id),
    }))
  })
})
