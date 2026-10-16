// Wie mag een afspraak wijzigen (verslag, transcript, analyse, verplaatsen, afronden): de eigenaar, wie
// hem plande, een uitgenodigde collega, de salesmanager van het team, de beheerder en wie voor een
// collega mag plannen. Dezelfde regel als bij "Rond af".
import { sql } from 'drizzle-orm'
import { kan } from './accounts'
import { gebruikDb } from './db'
import { eigenTeams } from './gebruikers'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]

export async function vereisAfspraak(tx: Tx, ctx: any, id: string) {
  const [ap] = (await tx.execute(sql`select ap.id, ap.owner_id, ap.gepland_door, ap.account_id, ap.status, ap.data, u.team_id from appointments ap join users u on u.id = ap.owner_id where ap.id = ${id}`)).rows as any[]
  if (!ap) throw createError({ statusCode: 404, statusMessage: 'Afspraak niet gevonden' })
  const eigen = ap.owner_id === ctx.gebruiker.id || ap.gepland_door === ctx.gebruiker.id || (ap.data?.uitgenodigd ?? []).includes(ctx.gebruiker.id)
  const team = ctx.gebruiker.rol === 'beheerder' || (ctx.gebruiker.rol === 'salesmanager' && ap.team_id && (await eigenTeams(tx, ctx.gebruiker.id)).includes(ap.team_id))
  if (!eigen && !team && !kan(ctx, 'agenda.voorCollega')) throw createError({ statusCode: 403, statusMessage: 'Dit is niet jouw afspraak' })
  return ap as { id: string; owner_id: string; gepland_door: string | null; account_id: string | null; status: string; data: any; team_id: string | null }
}
