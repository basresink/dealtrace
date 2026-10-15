// GET /api/belscripts/voorbeeld?accountId=: de variabelen voor het voorbeeld in de editor,
// ingevuld voor een account (kernzin, belofte, winpunt, concurrent), plus een keuzelijst.
import { verkoopverhaal } from '../../utils/reis'
import { asc, eq, sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { belmodusItems, laadScripts } from '../../utils/bellen'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const q = getQuery(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const accounts = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.accountKind, 'prospect')).orderBy(sql`${schema.accounts.huidigeLeverancierId} is null`, asc(schema.accounts.name)).limit(40)
    const accountId = typeof q.accountId === 'string' && q.accountId ? q.accountId : accounts[0]?.id
    if (!accountId) return { accounts, waarden: {}, extraBezwaren: [], meldingen: [] }
    const [c] = await tx.select({ id: schema.contacts.id }).from(schema.contacts).where(eq(schema.contacts.accountId, accountId)).limit(1)
    const [a] = await tx.select({ naam: schema.accounts.name }).from(schema.accounts).where(eq(schema.accounts.id, accountId))
    const [item] = await belmodusItems(tx, { gebruiker: { id: ctx.gebruiker.id, naam: ctx.gebruiker.naam, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }, organisatie: ctx.organisatie },
      [{ accountId, accountNaam: a?.naam ?? '', contactId: c?.id ?? null, score: 0, herkomst: 'koud', reden: '' }], { scripts: await laadScripts(tx) })
    const vv = await verkoopverhaal(tx)
    return { accounts, accountId, waarden: item?.waarden ?? {}, meldingen: item?.meldingen ?? [], concurrentId: item?.concurrentId ?? null, concurrenten: (vv?.concurrenten ?? []).map((x: any) => ({ id: x.id, naam: x.naam, alsDeKlantZegt: x.alsDeKlantZegt, zoZegJeHet: x.zoZegJeHet })) }
  })
})
