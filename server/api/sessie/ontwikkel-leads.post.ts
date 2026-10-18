// POST /api/sessie/ontwikkel-leads: zet de leadgenerator van de eigen organisatie terug naar de beginstand,
// voor de e2e-tests; alleen in AUTH_MODUS=ontwikkel en alleen voor de beheerder. De KvK-mock heeft een vaste
// set bedrijven: elke testrun neemt er een paar over (Voeg toe) en wijst er een paar af (Niet relevant), en
// afgewezen komt nooit terug. Zonder deze stap is er na een paar runs niets meer te vinden.
// Wat er gebeurt: de leads en leadrondes van de organisatie gaan weg, en prospects die uit de mock kwamen (geen seed-id)
// worden losgekoppeld van hun KvK-bedrijf (eigen naam, geen KvK-nummer, domein, postcode, website of e-mail).
// Prospects verwijderen kan niet in de app; hun historie blijft staan.
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { MOCK_BEDRIJVEN } from '../../utils/bronnen/kvkMock'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  if (useRuntimeConfig().authModus !== 'ontwikkel') throw createError({ statusCode: 404 })
  const ctx = await vereisOrganisatie(event)
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder' })
  const kvks = MOCK_BEDRIJVEN.map((b) => b.kvk).join(',')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const leads = await tx.execute(sql`delete from leads where organisation_id = ${ctx.organisatie.id}`)
    // Ook de rondes: een bewaard resultaat (24 uur) zou anders een lege ronde teruggeven.
    await tx.execute(sql`delete from lead_rondes where organisation_id = ${ctx.organisatie.id}`)
    const accounts = await tx.execute(sql`update accounts set name = 'Opgeruimde testlead ' || left(id, 8), kvk = null, domein = null, postcode = null,
        data = data - 'website' - 'email' - 'leadId', updated_at = now()
      where organisation_id = ${ctx.organisatie.id} and id ~ '^[0-9a-f-]{36}$'
        and (kvk = any(string_to_array(${kvks}, ',')) or data ? 'leadId')`)
    return { leads: leads.rowCount ?? 0, accounts: accounts.rowCount ?? 0 }
  })
})
