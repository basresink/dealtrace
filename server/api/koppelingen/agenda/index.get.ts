// GET /api/koppelingen/agenda: de eigen gekoppelde agenda's (Microsoft 365, Google) en of de beheerder
// de koppeling voor de organisatie heeft aangezet. Tokens komen nooit terug in een antwoord.
import { sql } from 'drizzle-orm'
import { kan } from '../../../utils/accounts'
import { koppelingAan } from '../../../utils/agenda'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = (await tx.execute(sql`select provider, status, laatste_sync, data->>'fout' as fout from agenda_koppelingen where gebruiker_id = ${ctx.gebruiker.id}`)).rows as any[]
    return {
      aanDoorBeheerder: await koppelingAan(tx), magKoppelen: kan(ctx, 'agenda.koppeling'), beheerder: ['beheerder'].includes(ctx.gebruiker.rol),
      providers: (['microsoft', 'google'] as const).map((p) => {
        const r = rijen.find((x) => x.provider === p)
        return { provider: p, naam: p === 'microsoft' ? 'Microsoft 365' : 'Google', status: r?.status ?? 'uit', laatsteSync: r?.laatste_sync ? new Date(r.laatste_sync).toISOString() : null, fout: r?.fout ?? null }
      }),
    }
  })
})
