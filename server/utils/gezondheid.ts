// Gezondheid per klant, vooraf berekend in org_gezondheid (F23). Wordt bijgewerkt
// als de stand ouder is dan een uur (bij het openen van Klanten), tot er een
// geplande taak is. Hier ook de proefperiode: melding 7 dagen vooraf en
// automatische afwaardering naar Starter na afloop (zonder Stripe).
import { sql } from 'drizzle-orm'
import { gezondheid } from '../../shared/gezondheid'
import { schema } from './db'
import type { alsPlatform } from './platform'
import { meldBeheerders } from './platform'

type Tx = Parameters<Parameters<typeof alsPlatform>[0]>[0]

export async function herberekenGezondheid(tx: Tx, nu = new Date()) {
  const res = await tx.execute(sql`select * from dealtrace_platform_tellingen()`)
  for (const r of res.rows as any[]) {
    const tijden = [r.laatste_inlog, r.laatste_activiteit].filter(Boolean).map((t: any) => new Date(t).getTime())
    const laatstActief = tijden.length ? new Date(Math.max(...tijden)).toISOString() : null
    const g = gezondheid({ gebruikers: r.gebruikers, metLogin: r.met_login, laatstActief }, nu)
    await tx.insert(schema.orgGezondheid).values({
      organisationId: r.organisation_id, stand: g.stand, redenen: g.redenen, gebruikers: r.gebruikers, metLogin: r.met_login,
      laatstActief, berekendOp: nu.toISOString(),
    }).onConflictDoUpdate({
      target: schema.orgGezondheid.organisationId,
      set: { stand: g.stand, redenen: g.redenen, gebruikers: r.gebruikers, metLogin: r.met_login, laatstActief, berekendOp: nu.toISOString() },
    })
  }
}

export async function verwerkProefperiodes(tx: Tx, nu = new Date()) {
  const orgs = await tx.select().from(schema.organisations)
  for (const o of orgs) {
    const c = o.contract ?? {}
    if (c.status !== 'proef' || !c.proefTot) continue
    const tot = Date.parse(c.proefTot)
    if (tot <= nu.getTime()) {
      const contract = { ...c, status: 'actief' as const }
      await tx.update(schema.organisations).set({ pakket: 'starter', contract, updatedAt: nu.toISOString() }).where(sql`id = ${o.id}`)
      await tx.insert(schema.platformAudit).values({ actorId: 'systeem', actieveOrganisatie: o.id, handeling: 'proef.afgelopen', object: o.id, voor: { pakket: o.pakket }, na: { pakket: 'starter' } })
      await meldBeheerders(tx, o.id, 'Je proefperiode is afgelopen', 'Je organisatie staat nu op Starter. Vraag een upgrade aan bij Abonnement.', '/instellingen/abonnement')
    } else if (tot - nu.getTime() <= 7 * 24 * 3600 * 1000 && !c.proefMeldingOp) {
      await tx.update(schema.organisations).set({ contract: { ...c, proefMeldingOp: nu.toISOString() } }).where(sql`id = ${o.id}`)
      await meldBeheerders(tx, o.id, 'Je proefperiode loopt bijna af', `Je proef loopt tot ${c.proefTot.slice(0, 10)}. Daarna ga je naar Starter, tenzij je een upgrade aanvraagt.`, '/instellingen/abonnement')
    }
  }
}
