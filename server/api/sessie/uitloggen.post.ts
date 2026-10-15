import { wisSessie } from '../../utils/sessie'

export default defineEventHandler((event) => {
  wisSessie(event)
  return { ok: true }
})
