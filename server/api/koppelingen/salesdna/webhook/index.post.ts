// POST /api/koppelingen/salesdna/webhook: gesigneerde berichten van SalesDNA; geen sessie. De koppeling
// staat in de header X-SalesDNA-Koppeling (of gebruik /webhook/:koppelingId).
import { webhook } from '../../../../utils/salesdnaOntvanger'

export default defineEventHandler((event) => webhook(event, getHeader(event, 'x-salesdna-koppeling')))
