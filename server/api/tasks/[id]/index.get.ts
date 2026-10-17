// GET /api/tasks/:id: de taakflyout: taak, aanleiding, "Waarom krijg ik dit?", poging,
// klant in context, de contactpersoon van de taak (contact_id), herinnering en herhaling, en het ritme
// (zodat de telefoon de volgende poging kan voorspellen). Bij een beltaak ook verslag, transcript en analyse.
import { desc, eq } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../../utils/db'
import { laadRitmes } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'
import { magTaak } from '../../../utils/taken'
import { analyseVan, transcriptVanTaak } from '../../../utils/belverslag'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, id))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Taak onbekend' })
    const [a] = t.accountId ? await tx.select().from(schema.accounts).where(eq(schema.accounts.id, t.accountId)) : []
    const contacten = a ? await tx.select().from(schema.contacts).where(eq(schema.contacts.accountId, a.id)) : []
    const primair = contacten.find((c) => c.rol === 'beslisser' && c.status !== 'vertrokken') ?? contacten.find((c) => c.status !== 'vertrokken')
    const tc = !t.contactId ? undefined : contacten.find((c) => c.id === t.contactId) ?? (await tx.select().from(schema.contacts).where(eq(schema.contacts.id, t.contactId)))[0]
    const laatste = a ? await tx.select().from(schema.activiteiten).where(eq(schema.activiteiten.accountId, a.id)).orderBy(desc(schema.activiteiten.op)).limit(5) : []
    const reizen = a?.reisId ? await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, a.reisId)) : []
    const f = reizen[0]?.data.fases.find((x) => x.id === a?.faseId)
    const stand = (a?.data as any)?.reis?.ritme ?? null
    const ritme = stand ? (await laadRitmes(tx)).find((r) => r.id === stand.ritmeId) ?? null : null
    const [regel] = t.ruleId ? await tx.select({ naam: schema.activityRules.naam, code: schema.activityRules.code }).from(schema.activityRules).where(eq(schema.activityRules.id, t.ruleId)) : []
    const [inzicht] = t.signalId ? await tx.select().from(schema.signals).where(eq(schema.signals.id, t.signalId)) : []
    const [eigenaar] = t.ownerId ? await tx.select({ naam: schema.users.name }).from(schema.users).where(eq(schema.users.id, t.ownerId)) : []
    const d = (t.data ?? {}) as any
    // Beltaak: het gespreksverslag, het transcript en de analyse van de Notulist (blok Transcript en gespreksverslag).
    const bel = t.actionType === 'bellen'
    const transcript = bel ? await transcriptVanTaak(tx, t.id, d.transcriptBestand ?? null) : null
    return {
      id: t.id, title: t.title, status: t.status, actionType: t.actionType, priority: t.priority, dueDate: t.dueDate, uitkomst: t.uitkomst, ownerId: t.ownerId, eigenaar: eigenaar?.naam ?? null,
      herkomst: typeof d.herkomst === 'string' ? d.herkomst : d.herkomst?.bron ?? (t.signalId ? 'inzicht' : t.ruleId ? 'regel' : 'handmatig'),
      waarom: d.waarom ?? null, bewijs: d.bewijs ?? [], poging: d.poging ?? null, aanleiding: d.aanleiding ?? inzicht?.data?.waarom ?? null, beschrijving: d.beschrijving ?? null, concept: d.concept ?? null,
      agent: d.agent ?? null, mandaat: d.mandaat ?? null, executorStatus: t.executorStatus ?? null,
      regel: regel ? { naam: regel.naam, code: regel.code } : null, inzicht: inzicht ? { id: inzicht.id, title: inzicht.title, bron: inzicht.bron } : null,
      account: a ? {
        id: a.id, naam: a.name, plaats: a.city ?? null, score: a.score, klasse: a.klasse, status: a.nbStatus, fase: f ? { label: f.label, kleur: f.kleur, hoofdfase: f.hoofdfase, accent: f.accent } : null,
        primair: primair ? { id: primair.id, naam: `${primair.firstName ?? ''} ${primair.lastName}`.trim(), telefoon: primair.data?.mobiel ?? primair.data?.telefoon ?? null, email: primair.email, belMeNiet: !!primair.data?.belMeNiet } : null,
        telefoon: a.data?.telefoon ?? null,
        laatste: laatste.map((x) => ({ soort: x.soort, uitkomst: x.uitkomst, op: x.op })),
      } : null,
      contactId: t.contactId ?? null,
      contact: tc ? { id: tc.id, naam: `${tc.firstName ?? ''} ${tc.lastName}`.trim(), functie: tc.data?.functie ?? null, rol: tc.rol, telefoon: tc.data?.mobiel ?? tc.data?.telefoon ?? null, email: tc.email, belMeNiet: !!tc.data?.belMeNiet } : null,
      herinnering: d.herinnering?.minuten ? { minuten: d.herinnering.minuten, kanaal: d.herinnering.kanaal ?? 'in-app' } : null,
      herhaling: d.herhaling ?? null,
      verslag: bel ? d.verslag ?? null : null, transcript, analyse: bel ? analyseVan(d.notulist) : null,
      ritme: ritme && stand ? { naam: ritme.naam, stand, def: ritme } : null,
      kan: { afronden: await magTaak(tx, ctx, t.ownerId) || t.ownerId === null, verwijderen: ctx.gebruiker.rol === 'beheerder' || (!!t.ownerId && await magTaak(tx, ctx, t.ownerId)) },
    }
  })
})
