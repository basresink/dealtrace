// POST /api/import/verwerk {batchId, keuzes, eigenaar}: verwerkt de batch in één
// transactie. Eigenaar: vast (jezelf; een manager kan iemand kiezen) of gelijk
// verdelen over het team (salesmanager, beheerder). De rijen worden daarna gewist.
import { and, eq, ne } from 'drizzle-orm'
import type { ImportDoel } from '../../../shared/leadGenerator'
import { schrijfAudit } from '../../utils/audit'
import { effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { controleer, verwerk, type Regel } from '../../utils/importer'
import { verrijkImportViaDc, verrijkViaKvk } from '../../utils/leads'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'import.uitvoeren')
  const b = await readBody<{ batchId?: string; keuzes?: Record<string, string>; eigenaar?: { soort?: 'vast' | 'team'; gebruikerId?: string }; verrijkKvk?: boolean; verrijkDc?: boolean }>(event)
  if (!b.batchId) throw createError({ statusCode: 400, statusMessage: 'batchId ontbreekt' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [batch] = await tx.select().from(schema.importBatches).where(eq(schema.importBatches.id, b.batchId!))
    if (!batch) throw createError({ statusCode: 404, statusMessage: 'Import onbekend' })
    if (batch.status !== 'concept' || !batch.rijen) throw createError({ statusCode: 409, statusMessage: 'Deze import is al verwerkt' })
    let eigenaars = [ctx.gebruiker.id]
    if (b.eigenaar?.soort === 'team') {
      if (!kan(ctx, 'import.teamVerdelen')) throw createError({ statusCode: 403, statusMessage: 'Verdelen over het team kan een salesmanager of beheerder' })
      const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
      const leden = await tx.select({ id: schema.users.id, teamId: schema.users.teamId }).from(schema.users).where(and(eq(schema.users.role, 'accountmanager'), ne(schema.users.status, 'gearchiveerd')))
      eigenaars = leden.filter((l) => ctx.gebruiker.rol === 'beheerder' || (l.teamId && teams.includes(l.teamId))).map((l) => l.id)
      if (!eigenaars.length) throw createError({ statusCode: 400, statusMessage: 'Er zijn geen accountmanagers in je team' })
    } else if (b.eigenaar?.gebruikerId && b.eigenaar.gebruikerId !== ctx.gebruiker.id) {
      if (!kan(ctx, 'import.teamVerdelen')) throw createError({ statusCode: 403, statusMessage: 'Je importeert op je eigen naam' })
      eigenaars = [b.eigenaar.gebruikerId]
    }
    const koppeling = Object.keys(batch.koppeling).sort((x, y) => Number(x) - Number(y)).map((k) => batch.koppeling[k] as ImportDoel)
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const { gelezen, regels } = await controleer(tx, batch.rijen, koppeling, velden)
    // Keuzes uit de controle blijven gelden voor regels die de gebruiker niet aanpaste.
    const eerdere = new Map(((batch.rapport?.regels ?? []) as Regel[]).map((r) => [r.rij, r]))
    for (const r of regels) { const e = eerdere.get(r.rij); if (e?.dealdrive && !r.dealdrive) { r.dealdrive = e.dealdrive; r.categorie = e.categorie; r.keuze = e.keuze } }
    const tel = await verwerk(tx, { organisatieId: ctx.organisatie.id, gebruikerId: ctx.gebruiker.id, batchId: batch.id, gelezen, regels, keuzes: b.keuzes ?? {}, eigenaars })
    // P11: verrijken via KvK, alleen accounts met een KvK-nummer; stopt bij het plafond.
    const kvk = b.verrijkKvk ? await verrijkViaKvk(tx, ctx.organisatie.id, ctx.organisatie.pakket, regels.filter((r) => r.keuze === 'nieuw' && r.accountId).map((r) => r.accountId!)) : null
    // P15: contactpersonen via Datacollectief voor nieuwe accounts (na KvK, zodat het KvK-nummer er is); stopt bij het plafond.
    const dc = b.verrijkDc && kan(ctx, 'datacollectief.verrijken') ? await verrijkImportViaDc(tx, ctx.organisatie.id, ctx.organisatie.pakket, regels.filter((r) => r.keuze === 'nieuw' && r.accountId).map((r) => r.accountId!), ctx.gebruiker.id) : null
    const rapport = { ...(batch.rapport ?? {}), ...tel, ...(kvk ? { kvkVerrijkt: kvk.verrijkt } : {}), ...(dc ? { dcContacten: dc.contacten } : {}), regels: regels.map(({ rij, naam, categorie, keuze, accountId, match, fouten, voor }) => ({ rij, naam, categorie, keuze, accountId, match, fouten, voor })) }
    await tx.update(schema.importBatches).set({ status: 'verwerkt', verwerktOp: new Date().toISOString(), rijen: null, rapport }).where(eq(schema.importBatches.id, batch.id))
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'import.verwerken', resourceType: 'import_batches', resourceId: batch.id, changes: { label: batch.bronLabel, ...tel } })
    return { batchId: batch.id, ...tel, ...(kvk ? { kvkVerrijkt: kvk.verrijkt, kvkMelding: kvk.gestopt } : {}), ...(dc ? { dcContacten: dc.contacten, dcMelding: dc.gestopt } : {}) }
  })
})
