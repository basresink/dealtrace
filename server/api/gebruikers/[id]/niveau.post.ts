// POST /api/gebruikers/:id/niveau {niveau, reden}: beheerder voor iedereen,
// salesmanager voor zijn eigen teams (anders 403). Verlagen vraagt een reden.
// Functies die daardoor aangaan, krijgen een week de pil "nieuw" en één toast.
import { eq } from 'drizzle-orm'
import { catalogusVoor } from '../../../../shared/functies'
import { NIVEAUS, NIVEAU_LABEL, type Niveau, type Rol } from '../../../../shared/types'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie, schema } from '../../../utils/db'
import { magGebruiker } from '../../../utils/gebruikers'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'gebruikers.niveau')
  const { gebruiker, organisatie, stand } = ctx
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ niveau?: string; reden?: string }>(event)
  if (!b.niveau || !(NIVEAUS as readonly string[]).includes(b.niveau)) throw createError({ statusCode: 400, statusMessage: 'Onbekend niveau' })
  const naar = b.niveau as Niveau

  return metOrganisatie(organisatie.id, async (tx) => {
    const [doel] = await tx.select().from(schema.users).where(eq(schema.users.id, id))
    if (!doel) throw createError({ statusCode: 404, statusMessage: 'Gebruiker onbekend' })
    if (doel.id === gebruiker.id && gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Je kiest je eigen niveau niet' })
    if (!(await magGebruiker(tx, ctx, { id: doel.id, teamId: doel.teamId }, 'schrijven'))) {
      throw createError({ statusCode: 403, statusMessage: 'Deze gebruiker zit niet in een van je teams' })
    }
    const van = doel.niveau as Niveau
    if (van === naar) return { niveau: naar }
    const verlagen = NIVEAUS.indexOf(naar) < NIVEAUS.indexOf(van)
    if (verlagen && !b.reden?.trim()) throw createError({ statusCode: 400, statusMessage: 'Geef een reden bij het verlagen van het niveau' })
    if (doel.role === 'salesmanager' && naar === 'beginner') throw createError({ statusCode: 400, statusMessage: 'Een salesmanager is minimaal Gevorderd' })

    const rol = doel.role as Rol
    const voor = new Set(catalogusVoor({ rol, niveau: van }, organisatie, stand).filter((f) => f.beschikbaar).map((f) => f.sleutel))
    const nieuwAan = catalogusVoor({ rol, niveau: naar }, organisatie, stand).filter((f) => f.beschikbaar && !voor.has(f.sleutel)).map((f) => f.sleutel)

    const nu = new Date()
    const weekLater = new Date(nu.getTime() + 7 * 24 * 3600 * 1000).toISOString()
    const data = { ...(doel.data ?? {}) } as any
    data.niveauHistorie = [...(data.niveauHistorie ?? []), { van, naar, op: nu.toISOString(), door: gebruiker.id, ...(b.reden ? { reden: b.reden.trim() } : {}) }]
    data.nieuwTot = { ...(data.nieuwTot ?? {}) }
    for (const s of nieuwAan) data.nieuwTot[s] = weekLater
    data.nogTonen = [...new Set([...(data.nogTonen ?? []), ...nieuwAan])]

    await tx.update(schema.users).set({ niveau: naar, data, updatedAt: nu.toISOString() }).where(eq(schema.users.id, id))
    await schrijfAudit(tx, {
      organisationId: organisatie.id, actorId: gebruiker.id, action: 'gebruiker.niveau', resourceType: 'users', resourceId: id,
      changes: { van, naar }, metadata: b.reden ? { reden: b.reden.trim() } : null,
    })
    return { niveau: naar, label: NIVEAU_LABEL[naar], nieuwAan }
  })
})
