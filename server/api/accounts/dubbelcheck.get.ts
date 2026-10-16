// GET /api/accounts/dubbelcheck?naam=&kvk=&domein=&plaats=: "Bedoel je ...? Al in je bestand." (15.1)
// Een andere plaats of een ander getal in de naam is hooguit mogelijk dubbel (B12).
import { zoekDuplicaat } from '../../../shared/ontdubbelen'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const q = getQuery(event)
  const naam = String(q.naam ?? '').trim()
  if (naam.length < 3 && !q.kvk && !q.domein) return { soort: 'geen' }
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bestand = await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, city: schema.accounts.city }).from(schema.accounts)
    return zoekDuplicaat({ name: naam, kvk: (q.kvk as string) || null, domein: (q.domein as string) || null, city: String(q.plaats ?? '').trim() || null }, bestand)
  })
})
