import { wisSessie } from '../../utils/sessie'
import { wisWerkIn } from '../../utils/werkIn'

export default defineEventHandler((event) => {
  wisSessie(event)
  wisWerkIn(event)
  return { ok: true }
})
