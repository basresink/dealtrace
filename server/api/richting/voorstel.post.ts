// POST /api/richting/voorstel {onderdeel, ref, soort, tekst}: een Expert stelt iets voor (antwoord,
// bezwaar, winpunt per branche, bewijs, variant); het voorstel gaat naar de salesmanager.
import { ONDERDELEN } from '../../../shared/verkoopverhaal'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'richting.voorstellen')
  const b = await readBody<{ onderdeel?: string; ref?: string; soort?: string; tekst?: string }>(event)
  const onderdeel = ONDERDELEN.find((o) => o === b?.onderdeel)
  if (!onderdeel || !b?.tekst?.trim()) throw createError({ statusCode: 422, statusMessage: 'Beschrijf je voorstel' })
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await tx.insert(schema.vvVoorstellen).values({ organisationId: ctx.organisatie.id, onderdeel, ref: b.ref ?? null, soort: (b.soort ?? 'tekst').slice(0, 40), tekst: b.tekst!.trim().slice(0, 2000), door: ctx.gebruiker.id })
    const users = await tx.select().from(schema.users)
    const ontvanger = users.find((u) => u.role === 'salesmanager' && u.status !== 'gearchiveerd') ?? users.find((u) => u.role === 'beheerder')
    if (ontvanger) await tx.insert(schema.notificaties).values({ id: crypto.randomUUID(), organisationId: ctx.organisatie.id, gebruikerId: ontvanger.id, soort: 'systeem', titel: 'Voorstel voor het verkoopverhaal', tekst: `${ctx.gebruiker.naam.replace(/^Testgebruiker /, '')}: ${b.tekst!.trim().slice(0, 140)}`, link: '/instellingen/verkoopverhaal', op: new Date().toISOString(), data: {} })
    return { ok: true }
  })
})
