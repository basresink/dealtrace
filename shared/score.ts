// Score 0 tot 100 met zichtbare opbouw (F03, gat 25). Onderdelen zonder bron
// tellen 0 en staan in de opbouw als "nog geen gegevens". Geen vaste 50.

export interface ScoreContext {
  nu: Date
  aanleidingen?: { op: string; heet?: boolean }[]
  contacten: { rol: string; status: string; telefoon?: string | null; mobiel?: string | null; email?: string | null }[]
  /** Criteria uit het dossier die passen, en het totaal (fit met de doelgroep). */
  fit?: { passend: number; totaal: number }
  /** Recente uitkomsten (positief/negatief) en of er een afspraak gepland is. */
  momentum?: { positieveUitkomsten30d: number; afspraakGepland: boolean }
  laatsteContactOp: string | null
}

export interface ScoreOnderdeel { punten: number; max: number; uitleg: string; geenGegevens?: boolean }
export interface Score {
  score: number
  opbouw: { aanleiding: ScoreOnderdeel; bereikbaarheid: ScoreOnderdeel; fit: ScoreOnderdeel; momentum: ScoreOnderdeel; recentheid: ScoreOnderdeel }
}

const DAG = 24 * 3600 * 1000
const dagen = (van: string, nu: Date) => (nu.getTime() - Date.parse(van)) / DAG

export function berekenScore(ctx: ScoreContext): Score {
  // Versheid van aanleidingen (30): de jongste telt, heet geeft voorrang.
  let aanleiding: ScoreOnderdeel
  if (!ctx.aanleidingen?.length) aanleiding = { punten: 0, max: 30, uitleg: 'Nog geen gegevens', geenGegevens: true }
  else {
    const jongste = Math.min(...ctx.aanleidingen.map((a) => dagen(a.op, ctx.nu)))
    const heet = ctx.aanleidingen.some((a) => a.heet && dagen(a.op, ctx.nu) <= 14)
    const p = heet ? 30 : jongste <= 7 ? 25 : jongste <= 30 ? 18 : jongste <= 90 ? 8 : 2
    aanleiding = { punten: p, max: 30, uitleg: heet ? 'Hete aanleiding' : `Jongste aanleiding ${Math.round(jongste)} dagen oud` }
  }

  // Bereikbaarheid (25): beslisser 10, met nummer 10, e-mail 5.
  const actief = ctx.contacten.filter((c) => c.status !== 'vertrokken')
  const beslisser = actief.find((c) => c.rol === 'beslisser')
  let b = 0
  if (beslisser) b += 10
  if (beslisser && (beslisser.telefoon || beslisser.mobiel)) b += 10
  else if (actief.some((c) => c.telefoon || c.mobiel)) b += 5
  if (actief.some((c) => c.email)) b += 5
  const bereikbaarheid: ScoreOnderdeel = {
    punten: Math.min(25, b), max: 25,
    uitleg: !actief.length ? 'Nog geen contactpersoon' : beslisser ? 'Beslisser bekend' : 'Nog geen beslisser',
  }

  // Fit met de doelgroep (20).
  const fit: ScoreOnderdeel = ctx.fit && ctx.fit.totaal
    ? { punten: Math.round((20 * Math.min(ctx.fit.passend, ctx.fit.totaal)) / ctx.fit.totaal), max: 20, uitleg: `${ctx.fit.passend} van ${ctx.fit.totaal} criteria` }
    : { punten: 0, max: 20, uitleg: 'Nog geen gegevens', geenGegevens: true }

  // Momentum (15).
  const momentum: ScoreOnderdeel = ctx.momentum
    ? { punten: Math.min(15, (ctx.momentum.afspraakGepland ? 10 : 0) + Math.min(5, ctx.momentum.positieveUitkomsten30d * 2)), max: 15, uitleg: ctx.momentum.afspraakGepland ? 'Afspraak gepland' : 'Recente uitkomsten' }
    : { punten: 0, max: 15, uitleg: 'Nog geen gegevens', geenGegevens: true }

  // Recentheid van contact (10).
  let recentheid: ScoreOnderdeel
  if (!ctx.laatsteContactOp) recentheid = { punten: 0, max: 10, uitleg: 'Nog nooit contact' }
  else {
    const d = dagen(ctx.laatsteContactOp, ctx.nu)
    recentheid = { punten: d <= 14 ? 10 : d <= 30 ? 7 : d <= 90 ? 3 : 0, max: 10, uitleg: `Laatste contact ${Math.max(0, Math.round(d))} dagen geleden` }
  }

  const opbouw = { aanleiding, bereikbaarheid, fit, momentum, recentheid }
  const score = Math.max(0, Math.min(100, Object.values(opbouw).reduce((s, o) => s + o.punten, 0)))
  return { score, opbouw }
}

/** Contactmomenten: welke activiteiten tellen als contact (gat 26). */
export interface Moment { soort: string; op: string; status?: 'open' | 'afgerond' | 'gehouden' | 'gepland' | string; bron?: string }
const CONTACT_SOORTEN = new Set(['gebeld', 'bel', 'mail', 'mail_verzonden', 'mail_ontvangen', 'bericht', 'whatsapp', 'sms', 'afspraak', 'bezoek'])

/** Jongste contactmoment; open taken, toekomstige afspraken en import tellen niet. */
export function laatsteContact(momenten: Moment[], nu: Date): string | null {
  let beste: string | null = null
  for (const m of momenten) {
    if (!CONTACT_SOORTEN.has(m.soort)) continue
    if (m.bron === 'import') continue
    if (m.status === 'open' || m.status === 'gepland') continue
    if (Date.parse(m.op) > nu.getTime()) continue
    if (!beste || Date.parse(m.op) > Date.parse(beste)) beste = m.op
  }
  return beste
}

/** Open taken tellen op account- en contactkaart met dezelfde regel (gat 29). */
export function telOpenTaken(taken: { status: string; accountId?: string | null; contactId?: string | null }[], scope: { accountId?: string; contactId?: string }): number {
  return taken.filter((t) => t.status === 'open'
    && (scope.contactId ? t.contactId === scope.contactId : t.accountId === scope.accountId)).length
}
