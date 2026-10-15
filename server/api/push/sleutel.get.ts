// GET /api/push/sleutel: de publieke VAPID-sleutel, of null als push nog niet is ingericht.
import { vapidPubliek } from '../../utils/push'
import { vereisSessie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  await vereisSessie(event)
  return { sleutel: vapidPubliek() }
})
