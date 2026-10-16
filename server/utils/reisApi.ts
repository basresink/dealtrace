// Gedeeld door de reis-endpoints (P22): wie bewerkt (Expert met maatwerk of een manager).
import { kan } from './accounts'
import type { Bewerker } from './reisEditor'

export function bewerker(ctx: any): Bewerker {
  const manager = ['salesmanager', 'beheerder'].includes(ctx.gebruiker.rol)
  if (!manager && !kan(ctx, 'reizen.maatwerk')) throw createError({ statusCode: 403, statusMessage: 'Een eigen reis bouwen staat aan vanaf Expert', data: { functie: 'reizen.maatwerk', reden: 'niveau' } })
  return { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, manager }
}
