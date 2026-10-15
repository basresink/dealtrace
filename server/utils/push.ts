// Web Push (P31, F24, 8.14): VAPID uit de omgeving (VAPID_PUBLIEK, VAPID_PRIVE, VAPID_ONDERWERP).
// Zonder sleutels blijft het bij de melding in de app. Een abonnement dat niet meer bestaat
// (404 of 410) wordt opgeruimd.
import webpush from 'web-push'
import { sql } from 'drizzle-orm'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
export const vapidPubliek = () => process.env.VAPID_PUBLIEK ?? null
let ingesteld = false
function stelIn() {
  if (ingesteld) return true
  if (!process.env.VAPID_PUBLIEK || !process.env.VAPID_PRIVE) return false
  webpush.setVapidDetails(process.env.VAPID_ONDERWERP ?? 'mailto:beheer@dealtrace.test', process.env.VAPID_PUBLIEK, process.env.VAPID_PRIVE)
  ingesteld = true
  return true
}

/** Stuur een push naar alle toestellen van een gebruiker; geeft het aantal verzonden berichten. */
export async function stuurPush(tx: Tx, gebruikerId: string, bericht: { titel: string; tekst?: string | null; link?: string | null; actie?: string | null; id: string }) {
  if (!stelIn()) return 0
  const abos = (await tx.execute(sql`select id, endpoint, data from push_subscriptions where gebruiker_id = ${gebruikerId}`)).rows as any[]
  let n = 0
  for (const a of abos) {
    try {
      await webpush.sendNotification({ endpoint: a.endpoint, keys: a.data?.keys ?? {} }, JSON.stringify({ titel: bericht.titel, tekst: bericht.tekst ?? '', link: bericht.link ?? '/', actie: bericht.actie ?? null, id: bericht.id }), { TTL: 3600 })
      await tx.execute(sql`update push_subscriptions set laatst_gebruikt = now() where id = ${a.id}`)
      n++
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await tx.execute(sql`delete from push_subscriptions where id = ${a.id}`)
    }
  }
  return n
}
