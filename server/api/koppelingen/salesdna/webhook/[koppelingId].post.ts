// POST /api/koppelingen/salesdna/webhook/:koppelingId: gesigneerde berichten van SalesDNA; geen sessie.
import { webhook } from '../../../../utils/salesdnaOntvanger'

export default defineEventHandler((event) => webhook(event, getRouterParam(event, 'koppelingId')))
