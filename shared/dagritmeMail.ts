// Het dagritme per e-mail: weekreview (vrijdag), weekstart (maandag) en dagstart (elke werkdag). Per
// gebruiker een schakelaar met een tijdstip in persoonlijke_instellingen.data.dagritmeMail. De
// verzender kijkt elke kwartier of een mail aan de beurt is: op de juiste dag, op of na het tijdstip,
// buiten de stille uren (valt het tijdstip erin, dan gaat hij na de stilte, maar niet meer op een
// andere dag). Puur: de inhoud van de mail en het moment, met `nu` als parameter.
import { isWerkdag, nlMoment, nlTijdstip, plusDagen, type WerkdagInstelling } from './datum'
import type { Dagplan, Weekstart } from './dagritme'
import { naStilte, type MeldingInstelling } from './meldingsregels'
import type { Weekreview } from './weekreview'

export const DAGRITME_MAILS = ['weekreview', 'weekstart', 'dagstart'] as const
export type DagritmeMail = typeof DAGRITME_MAILS[number]
export const DAGRITME_MAIL_LABEL: Record<DagritmeMail, string> = { weekreview: 'Weekreview per mail', weekstart: 'Weekstart per mail', dagstart: 'Dagstart per mail' }
export const DAGRITME_MAIL_DAG: Record<DagritmeMail, string> = { weekreview: 'Vrijdag', weekstart: 'Maandag', dagstart: 'Elke werkdag' }
export const DAGRITME_MAIL_UITLEG: Record<DagritmeMail, string> = {
  weekreview: 'Je week in vier kaarten: wat bewoog, wat werkte, wat bleef liggen en je voornemens.',
  weekstart: 'Je weekplan: afspraken, bezoeken, belblokken, voornemens en je tempo tegen je doel.',
  dagstart: 'Je dag in het kort: afspraken vast, bezoeken op route en belblokken op het beste uur.',
}
export const DAGRITME_MAIL_ROUTE: Record<DagritmeMail, string> = { weekreview: '/weekreview', weekstart: '/weekstart', dagstart: '/dagstart' }
export const DAGRITME_MAIL_STANDAARD: Record<DagritmeMail, { aan: boolean; tijd: string }> = {
  weekreview: { aan: false, tijd: '15:30' }, weekstart: { aan: false, tijd: '07:30' }, dagstart: { aan: false, tijd: '07:00' },
}
/** Hoe lang na het moment een gemiste mail nog weg mag (de verzender draait elk kwartier). */
export const MAIL_VENSTER_MIN = 180

export type DagritmeMailVoorkeuren = Record<DagritmeMail, { aan: boolean; tijd: string }>
const geldigeTijd = (t: unknown) => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t)

/** De voorkeuren met de standaard eronder; een ongeldig tijdstip valt terug op de standaard. */
export function mailVoorkeuren(data: Partial<Record<string, { aan?: unknown; tijd?: unknown }>> | null | undefined): DagritmeMailVoorkeuren {
  const uit = {} as DagritmeMailVoorkeuren
  for (const s of DAGRITME_MAILS) {
    const v = data?.[s] ?? {}
    uit[s] = { aan: v.aan === true, tijd: geldigeTijd(v.tijd) ? String(v.tijd) : DAGRITME_MAIL_STANDAARD[s].tijd }
  }
  return uit
}

/** Een tijdstip tussen 06:00 en 20:00 in kwartieren. */
export function controleerMailTijd(tijd: unknown): string | null {
  if (!geldigeTijd(tijd)) return 'Kies een tijdstip als 07:30'
  const [u, m] = String(tijd).split(':').map(Number)
  if (u! < 6 || u! > 20 || (u === 20 && m! > 0)) return 'Kies een tijdstip tussen 06:00 en 20:00'
  if (m! % 15) return 'Kies een kwartier: 00, 15, 30 of 45'
  return null
}

const wd = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay()
const maandag = (d: string) => plusDagen(d, -((wd(d) + 6) % 7))

/** De dag waarop de mail in de week van `datum` hoort: weekstart de eerste werkdag, weekreview de laatste, dagstart elke werkdag. */
export function mailDag(soort: DagritmeMail, datum: string, w: WerkdagInstelling = {}): string | null {
  if (soort === 'dagstart') return isWerkdag(datum, w) ? datum : null
  const werk = [0, 1, 2, 3, 4].map((i) => plusDagen(maandag(datum), i)).filter((d) => isWerkdag(d, w))
  if (!werk.length) return null
  return soort === 'weekstart' ? werk[0]! : werk[werk.length - 1]!
}

/** Is de mail nu aan de beurt? Geeft het moment waarop hij hoort (na de stille uren) of null. */
export function mailAanDeBeurt(soort: DagritmeMail, voorkeur: { aan: boolean; tijd: string }, nu: Date, stilte: Pick<MeldingInstelling, 'stilVan' | 'stilTot' | 'weekendStil'>, w: WerkdagInstelling = {}): Date | null {
  if (!voorkeur.aan) return null
  const vandaag = nlMoment(nu).datum
  if (mailDag(soort, vandaag, w) !== vandaag) return null
  const [u, m] = voorkeur.tijd.split(':').map(Number)
  const gepland = nlTijdstip(vandaag, u!, m!)
  const moment = naStilte(gepland, stilte)
  if (nlMoment(moment).datum !== vandaag) return null
  if (nu.getTime() < moment.getTime() || nu.getTime() >= moment.getTime() + MAIL_VENSTER_MIN * 60_000) return null
  return moment
}

/** De sleutel in melding_log: één mail per soort per dag. */
export const mailSleutel = (soort: DagritmeMail, datum: string) => `mail:${soort}:${datum}`

const voet = (soort: DagritmeMail) => `Je krijgt deze mail omdat ${DAGRITME_MAIL_LABEL[soort]} aanstaat. Je zet hem uit bij Notificaties, Voorkeuren, of in Mijn instellingen.`
const regel = (l: (string | null | undefined)[]) => l.filter((x) => x != null && x !== '').join('\n')

/** De weekreview als mail: de vier kaarten in het kort en de link om te beginnen. */
export function weekreviewMail(r: Weekreview, link: string): { onderwerp: string; tekst: string } {
  const cijfers = r.bewoog.cijfers.map((c) => `- ${c.label}: ${c.waarde}${c.eenheid} (${c.tekst})`)
  const blijvers = r.liggen.blijvers.filter((b) => !b.besluit).slice(0, 5).map((b) => `- ${b.titel} (${b.tekst})`)
  return {
    onderwerp: `Je weekreview van week ${r.week.nummer} staat klaar`,
    tekst: regel([
      r.titel, '',
      'Wat bewoog', r.bewoog.kop, ...cijfers, r.bewoog.melding, '',
      'Wat werkte', r.werkte.kop, ...r.werkte.patronen.map((p) => `- ${p.titel}: ${p.tekst}`), r.werkte.melding, '',
      'Wat bleef liggen', r.liggen.kop, ...blijvers, '',
      'Volgende week', r.volgende.ingepland.length ? r.volgende.kop : `Kies tot ${r.volgende.max} voornemens. Ze komen meteen in je week: een belblok, een taak of een regiodag.`,
      ...(r.lopend.length ? ['', 'Wat je je vorige week voornam', ...r.lopend.map((v) => `- ${v.tekst}: ${v.stand.tekst}`)] : []),
      '', `Begin je weekreview: ${link}`, '', voet('weekreview'),
    ]),
  }
}

/** De weekstart als mail: per dag de afspraken en belblokken, voornemens, wat openstaat, tempo en aanleidingen. */
/** Met `extra` de blokken van de week kort (shared/ritmeBlokken.ts ritmeBlokkenMail). */
export function weekstartMail(w: Weekstart, link: string, extra: string[] = []): { onderwerp: string; tekst: string } {
  const dagen = w.dagen.filter((d) => d.items.length).flatMap((d) => [d.label, ...d.items.map((i) => `- ${i.tijd} ${i.titel}${i.sub ? ` (${i.sub})` : ''}`)])
  return {
    onderwerp: `Je week ${w.week.nummer}: ${w.samenvatting.replace(/\.$/, '')}`,
    tekst: regel([
      w.titel, w.samenvatting, '',
      'Je week', ...(dagen.length ? dagen : ['Nog niets gepland deze week.']), '',
      'Je voornemens', ...(w.voornemens.length ? w.voornemens.map((v) => `- ${v.tekst}: ${v.stand.tekst}`) : ['Geen voornemens uit de weekreview.']), '',
      'Wat openstaat', w.open.tekst, '',
      'Tempo', w.tempo.tekst,
      ...(w.aanleidingen.length ? ['', 'Belangrijkste aanleidingen', ...w.aanleidingen.map((a) => `- ${a.accountNaam ? `${a.accountNaam}: ` : ''}${a.titel}`)] : []),
      ...extra,
      '', `Open je weekstart: ${link}`, '', voet('weekstart'),
    ]),
  }
}

/** De dagstart als mail: de indeling van de dag en waarom het belblok op dat uur ligt. */
export function dagstartMail(d: { titel: string; plan: Dagplan; schoof: string[]; doelgroep: string | null }, link: string, extra: string[] = []): { onderwerp: string; tekst: string } {
  const hh = (iso: string) => { const m = nlMoment(new Date(iso)); return `${String(m.uur).padStart(2, '0')}:${String(m.minuut).padStart(2, '0')}` }
  const blokken = d.plan.blokken.filter((b) => b.soort !== 'reis').map((b) => `- ${hh(b.start)} ${b.titel}${b.sub ? ` (${b.sub})` : ''}${b.voorstel ? ' · voorstel' : ''}`)
  return {
    onderwerp: `Je dag: ${d.plan.samenvatting}`,
    tekst: regel([
      d.titel, d.plan.samenvatting, '',
      ...(blokken.length ? blokken : ['Niets gepland. Een lege agenda is het beste moment om te prospecteren.']), '',
      d.doelgroep ? `Belmoment voor ${d.doelgroep}` : 'Belmoment', d.plan.belUitleg,
      ...(d.schoof.length ? ['', 'Wat schoof', ...d.schoof.map((s) => `- ${s}`)] : []),
      ...extra,
      '', `Open je dagstart: ${link}`, '', voet('dagstart'),
    ]),
  }
}
