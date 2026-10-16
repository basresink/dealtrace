// POST /api/koppelingen/dealdrive/v1/webhook: terugmeldingen van DealDrive (contract hoofdstuk 5), zonder
// sessie. De handtekening gaat vóór alles; de organisatie komt uit X-Koppeling-Organisatie en geldt pas
// als de handtekening met het geheim van die koppeling klopt. Antwoordt meteen (202, of 200 bij een
// gebeurtenis die al binnen was); de verwerking loopt daarna als job.
import { metOrganisatie } from '../../../../utils/db'
import { ontvangTerugmelding, verwerkTerugmeldingen } from '../../../../utils/dealdrive'

export default defineEventHandler(async (event) => {
  const rauw = (await readRawBody(event, 'utf8')) ?? ''
  const r = await ontvangTerugmelding(getHeader(event, 'x-koppeling-organisatie'), rauw, { handtekening: getHeader(event, 'x-koppeling-handtekening'), tijd: getHeader(event, 'x-koppeling-tijd') })
  if (r.status === 202 && r.org) {
    const org = r.org
    const job = metOrganisatie(org, (tx) => verwerkTerugmeldingen(tx, org)).catch(() => undefined)
    event.waitUntil?.(job)
  }
  setResponseStatus(event, r.status)
  return r.body
})
