// GET /api/reekssjablonen?accountId=&alle=1: de actieve sjablonen van de organisatie (voor Start reeks, Rond af en de
// belmodus), met de uitkomsten waarbij ze passen. Met accountId ook of daar al een reeks loopt of het account
// gedeactiveerd is. Met alle=1 (beheer, instellingen.opvolgreeksen) ook de uitgezette sjablonen met het aantal
// lopende reeksen.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { isGedeactiveerd, sjablonen } from '../../utils/opvolgreeks'
import { sjablonenBeheer } from '../../utils/opvolgreeksOverzicht'
import { vereisFunctie } from '../../utils/sessie'
import { kan } from '../../utils/accounts'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.volgen')
  const q = getQuery(event)
  const alle = q.alle === '1'
  if (alle && !kan(ctx, 'instellingen.opvolgreeksen')) throw createError({ statusCode: 403, statusMessage: 'Alleen de salesmanager en de beheerder beheren de sjablonen', data: { reden: 'rol' } })
  const accountId = typeof q.accountId === 'string' && q.accountId ? q.accountId : null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const lijst = alle ? await sjablonenBeheer(tx, ctx.organisatie.id) : await sjablonen(tx, ctx.organisatie.id)
    let account: { lopend: { id: string; naam: string } | null; gedeactiveerd: boolean } | null = null
    if (accountId) {
      const [r] = (await tx.execute(sql`select id, naam from reeksen where account_id = ${accountId} and status in ('loopt', 'gepauzeerd') limit 1`)).rows as any[]
      account = { lopend: r ? { id: r.id, naam: r.naam } : null, gedeactiveerd: await isGedeactiveerd(tx, accountId) }
    }
    return { sjablonen: lijst, account, kan: { beheren: kan(ctx, 'instellingen.opvolgreeksen') } }
  })
})
