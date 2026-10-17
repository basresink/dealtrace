// De Planner (11.3, mandaat A): plant pogingen volgens het ritme en laat taken landen
// binnen de capaciteit. Landing en capaciteit komen uit shared/motor.ts (landingsmoment,
// verdeelCapaciteit); hier staat wat de Planner daarbovenop doet. Elke geplande
// contacttaak gaat eerst langs de Bewaker (magHandelen).
import { magHandelen, type Mandaat } from './mandaat'
import type { Ritme, RitmeStand } from './hercontact'
import type { Kanaal } from './nbStatus'
import type { MotorAccount } from './regelPatronen'

export const ACTIE_VAN_KANAAL: Record<string, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'bericht' }
/** SMS heeft geen eigen afkoelperiode: het valt onder het berichtkanaal (WhatsApp). */
export const KANAAL_VAN_ACTIE: Record<string, Kanaal> = { bellen: 'bellen', mailen: 'mail', linkedin: 'linkedin', bezoek: 'bezoek', bericht: 'whatsapp', sms: 'whatsapp' }

export interface PogingVoorstel { n: number; van: number; kanaal: string; actionType: string; due: string }

/**
 * De volgende poging van een lopend ritme als taakvoorstel, of null met reden:
 * ritme klaar of gestopt, nog niet aan de beurt, of het account mag via dit kanaal niet.
 */
export function planPoging(stand: RitmeStand | null | undefined, ritme: Pick<Ritme, 'stappen'>, nu: Date, account?: Pick<MotorAccount, 'nbStatus' | 'nee' | 'wachtendTot' | 'belMeNiet'>): { voorstel: PogingVoorstel | null; reden?: string } {
  if (!stand?.actief) return { voorstel: null, reden: 'Geen lopend ritme' }
  const stap = ritme.stappen[stand.stap - 1]
  if (!stap) return { voorstel: null, reden: 'Laatste stap gedaan' }
  if (stand.volgendeOp && new Date(stand.volgendeOp).getTime() > nu.getTime()) return { voorstel: null, reden: 'Nog niet aan de beurt' }
  if (account) {
    const b = magHandelen('planner', 'poging.plannen', nu, { mandaat: 'A', kanaal: stap.kanaal as Kanaal, account: { nbStatus: account.nbStatus, data: { nee: account.nee as any, wachtendTot: account.wachtendTot } }, contact: { belMeNiet: account.belMeNiet } })
    if (!b.mag) return { voorstel: null, reden: b.reden }
  }
  return { voorstel: { n: stand.stap, van: ritme.stappen.length, kanaal: stap.kanaal, actionType: ACTIE_VAN_KANAAL[stap.kanaal] ?? 'bellen', due: (stand.volgendeOp ?? nu.toISOString()) } }
}

export interface Tegengehouden { agent: string; handeling: string; accountId: string | null; ownerId: string | null; reden: string; mandaat: Mandaat; regelId?: string | null }

/**
 * De Bewaker over een lijst geplande taken: contacttaken voor een account dat via dat
 * kanaal niet benaderd mag worden op het moment van landen, vallen af met reden. Andere taken gaan door.
 */
export function bewaakTaken<T extends { accountId: string; ownerId: string; actionType: string; regelId?: string | null; due?: string }>(
  taken: T[], accounts: Map<string, Pick<MotorAccount, 'nbStatus' | 'nee' | 'wachtendTot' | 'belMeNiet'>>, nu: Date,
): { toegestaan: T[]; tegengehouden: Tegengehouden[] } {
  const toegestaan: T[] = []
  const tegengehouden: Tegengehouden[] = []
  for (const t of taken) {
    const kanaal = KANAAL_VAN_ACTIE[t.actionType]
    const a = accounts.get(t.accountId)
    if (!kanaal || !a) { toegestaan.push(t); continue }
    // Getoetst op het moment dat de taak landt: na de afkoeling mag het weer.
    const op = t.due && new Date(t.due).getTime() > nu.getTime() ? new Date(t.due) : nu
    const b = magHandelen('planner', 'taak.plannen', op, { mandaat: 'A', kanaal, account: { nbStatus: a.nbStatus, data: { nee: a.nee as any, wachtendTot: a.wachtendTot } }, contact: { belMeNiet: a.belMeNiet } })
    if (b.mag) toegestaan.push(t)
    else tegengehouden.push({ agent: 'planner', handeling: `${t.actionType} plannen`, accountId: t.accountId, ownerId: t.ownerId, reden: b.reden!, mandaat: 'A', regelId: t.regelId ?? null })
  }
  return { toegestaan, tegengehouden }
}
