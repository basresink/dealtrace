// PUT /api/mij/rijmodus {aan}: de rijmodus (Expert, 8.6). Aan: meldingen wachten. Uit: wat bleef liggen,
// komt meteen gebundeld binnen (één push).
import { sql } from 'drizzle-orm'
import { metOrganisatie } from '../../utils/db'
import { verzendMeldingen } from '../../utils/meldingVerzender'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'meldingen.rijmodus')
  const aan = !!(await readBody<any>(event))?.aan
  const org = ctx.gebruiker.organisationId!
  return metOrganisatie(org, async (tx) => {
    const nu = new Date()
    await tx.execute(aan
      ? sql`update users set data = jsonb_set(data, '{rijmodus}', ${JSON.stringify({ aan: true, sinds: nu.toISOString() })}::jsonb) where id = ${ctx.gebruiker.id}`
      : sql`update users set data = data - 'rijmodus' where id = ${ctx.gebruiker.id}`)
    const tel = aan ? null : await verzendMeldingen(tx, org, nu, ctx.gebruiker.id)
    return { aan, tekst: aan ? 'Rijmodus aan. Meldingen wachten tot je stopt.' : tel && tel.inApp ? `Rijmodus uit. ${tel.inApp} ${tel.inApp === 1 ? 'melding' : 'meldingen'} bijgewerkt.` : 'Rijmodus uit.' }
  })
})
