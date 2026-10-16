// GET /api/koppelingen/dealdrive/v1/ping: DealDrive test de koppeling (contract hoofdstuk 6). Ondertekend
// over "<tijd>." (lege body); zonder geldige handtekening 401.
import { ontvangPing } from '../../../../utils/dealdrive'

export default defineEventHandler(async (event) => {
  const r = await ontvangPing(getHeader(event, 'x-koppeling-organisatie'), { handtekening: getHeader(event, 'x-koppeling-handtekening'), tijd: getHeader(event, 'x-koppeling-tijd') })
  setResponseStatus(event, r.status)
  return r.body
})
