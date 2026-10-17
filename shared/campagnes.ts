// Campagnes (P16, F12, 7.4 laag 3): een gerichte actie over 20 tot 80 accounts met soort, winpunt,
// boodschap of script, ritme, doel en einddatum. Eén definitie voor scherm, motor en rapportage
// (gat 13 en 16): soorten, tempo, "Begin hier", spreiding, capaciteit, resultaat en kolommen.
import { nlMoment, nlTijdstip, plusDagen } from './datum'

export type Kanaal = 'bellen' | 'mail' | 'linkedin' | 'bezoek' | 'kaart'
export type Uitvoerder = 'binnendienst' | 'buitendienst' | 'beide'
export interface Campagnesoort { sleutel: string; groep: string; naam: string; standaardDoel: { type: 'afspraken' | 'procent'; waarde: number }; ritme: 'koud' | 'warm' | 'winback'; kanalen: Kanaal[]; uitvoerder: Uitvoerder; werkwoord: string; startsoort: boolean; pogingen: number; weken: number }

/** De vijf groepen; de founder levert de overige achttien soorten (open vraag), de structuur is klaar voor 26. */
export const CAMPAGNEGROEPEN = ['Koud benaderen', 'Opvolgen', 'Terugwinnen', 'Evenementen', 'Netwerk'] as const
/** De acht startsoorten (F23: "8 campagnesoorten aan"). */
export const CAMPAGNESOORTEN_START: Campagnesoort[] = [
  { sleutel: 'koude-belcampagne', groep: 'Koud benaderen', naam: 'Koude belcampagne', standaardDoel: { type: 'procent', waarde: 20 }, ritme: 'koud', kanalen: ['bellen'], uitvoerder: 'binnendienst', werkwoord: 'Bel', startsoort: true, pogingen: 5, weken: 3 },
  { sleutel: 'mailreeks', groep: 'Koud benaderen', naam: 'Mailreeks', standaardDoel: { type: 'procent', waarde: 10 }, ritme: 'koud', kanalen: ['mail'], uitvoerder: 'binnendienst', werkwoord: 'Mail', startsoort: true, pogingen: 3, weken: 4 },
  { sleutel: 'linkedin-reeks', groep: 'Koud benaderen', naam: 'LinkedIn-reeks', standaardDoel: { type: 'procent', waarde: 10 }, ritme: 'koud', kanalen: ['linkedin'], uitvoerder: 'beide', werkwoord: 'Benader op LinkedIn', startsoort: true, pogingen: 3, weken: 4 },
  { sleutel: 'bezoektour', groep: 'Koud benaderen', naam: 'Bezoektour', standaardDoel: { type: 'procent', waarde: 25 }, ritme: 'koud', kanalen: ['bezoek'], uitvoerder: 'buitendienst', werkwoord: 'Bezoek', startsoort: true, pogingen: 2, weken: 4 },
  { sleutel: 'beurs-event', groep: 'Evenementen', naam: 'Beurs of event', standaardDoel: { type: 'procent', waarde: 30 }, ritme: 'warm', kanalen: ['mail', 'bellen'], uitvoerder: 'beide', werkwoord: 'Nodig uit', startsoort: true, pogingen: 3, weken: 6 },
  { sleutel: 'referral', groep: 'Netwerk', naam: 'Referral', standaardDoel: { type: 'procent', waarde: 30 }, ritme: 'warm', kanalen: ['bellen'], uitvoerder: 'beide', werkwoord: 'Bel', startsoort: true, pogingen: 3, weken: 3 },
  { sleutel: 'winback', groep: 'Terugwinnen', naam: 'Winback', standaardDoel: { type: 'procent', waarde: 15 }, ritme: 'winback', kanalen: ['bellen', 'mail'], uitvoerder: 'binnendienst', werkwoord: 'Bel', startsoort: true, pogingen: 4, weken: 4 },
  { sleutel: 'nurture', groep: 'Opvolgen', naam: 'Nurture', standaardDoel: { type: 'procent', waarde: 10 }, ritme: 'warm', kanalen: ['mail'], uitvoerder: 'binnendienst', werkwoord: 'Mail', startsoort: true, pogingen: 4, weken: 8 },
]

export const KOLOMMEN = ['gespot', 'benaderd', 'in-gesprek', 'afspraak', 'geparkeerd', 'afgewezen'] as const
export type Kolom = typeof KOLOMMEN[number]
export const KOLOM_LABEL: Record<Kolom, string> = { gespot: 'Gespot', benaderd: 'Benaderd', 'in-gesprek': 'In gesprek', afspraak: 'Afspraak', geparkeerd: 'Geparkeerd', afgewezen: 'Afgewezen' }
/** Een wissel naar deze kolommen vraagt een uitkomst (gat 38). */
export const KOLOM_MET_UITKOMST: Kolom[] = ['afspraak', 'geparkeerd', 'afgewezen']
export const EINDKOLOM: Kolom[] = ['afspraak', 'geparkeerd', 'afgewezen']

/** De kolom bij een uitkomst uit 7.3; de laatste poging zonder reactie parkeert. */
export function kolomUitUitkomst(uitkomst: string | null | undefined, laatstePoging = false): Kolom | null {
  switch (uitkomst) {
    case 'afspraak': return 'afspraak'
    case 'geen_interesse': case 'niet_geschikt': return 'afgewezen'
    case 'later': case 'gesproken': case 'nieuw_contact': return 'in-gesprek'
    case 'geen_reactie': case 'voicemail': case 'verzonden': return laatstePoging ? 'geparkeerd' : 'benaderd'
    default: return null
  }
}
/** De uitkomst die hoort bij een kolomwissel op het bord (het venster vraagt hem altijd). */
export const UITKOMST_VOOR_KOLOM: Partial<Record<Kolom, string[]>> = { afspraak: ['afspraak'], geparkeerd: ['later', 'geen_reactie'], afgewezen: ['geen_interesse', 'niet_geschikt'] }

export interface Item { accountId: string; kolom: Kolom; poging: number; eigenaarId: string | null; einddoelGehaald: boolean; winpuntUitgevoerd?: boolean | null; laatsteContactOp?: string | null; aanleiding?: boolean; naam?: string }
export type TempoPil = 'Voor op schema' | 'Op schema' | 'Achter op schema'
/**
 * Het tempo (één functie voor scherm en motor, gat 13): voortgang = items met einddoel gehaald
 * gedeeld door het doel in items; verwacht = verstreken looptijd gedeeld door de totale looptijd.
 * "Voor" bij 5 punten of meer boven verwacht, "Op schema" tot 10 punten eronder, anders "Achter".
 * Alleen met start- en einddatum en minstens één account.
 */
export function campagneTempo(c: { startedAt?: string | null; endsAt?: string | null; doel?: { type: 'afspraken' | 'procent'; waarde: number } | null }, items: Pick<Item, 'einddoelGehaald'>[], nu: Date): { voortgang: number; verwacht: number; achterstand: number; pil: TempoPil } | null {
  if (!c.startedAt || !c.endsAt || !items.length) return null
  const totaal = Date.parse(c.endsAt) - Date.parse(c.startedAt)
  if (totaal <= 0) return null
  const doelItems = c.doel ? Math.max(1, c.doel.type === 'afspraken' ? c.doel.waarde : Math.ceil((items.length * c.doel.waarde) / 100)) : items.length
  const voortgang = Math.min(100, Math.round((items.filter((i) => i.einddoelGehaald).length / doelItems) * 100))
  const verwacht = Math.max(0, Math.min(100, Math.round(((nu.getTime() - Date.parse(c.startedAt)) / totaal) * 100)))
  const verschil = voortgang - verwacht
  return { voortgang, verwacht, achterstand: Math.max(0, -verschil), pil: verschil >= 5 ? 'Voor op schema' : verschil >= -10 ? 'Op schema' : 'Achter op schema' }
}

/** "Begin hier" (uitgerekend, geen AI): nooit contact eerst, dan langst stil; aanleiding als tweede sleutel. */
export function campagneAdvies<T extends Item>(items: T[], n = 3): T[] {
  return items.filter((i) => !EINDKOLOM.includes(i.kolom))
    .sort((a, b) => Number(!!a.laatsteContactOp) - Number(!!b.laatsteContactOp) || String(a.laatsteContactOp ?? '').localeCompare(String(b.laatsteContactOp ?? '')) || Number(!!b.aanleiding) - Number(!!a.aanleiding) || String(a.naam ?? '').localeCompare(String(b.naam ?? '')))
    .slice(0, n)
}

export interface Blok { datum: string; start: string; plekken: number; eigenaarId: string }
/**
 * Taken spreiden over de looptijd: binnendienst in de koude belblokken (hooguit het aantal plekken
 * per blok), buitendienst op de regiodag van het account. Wat niet past, landt op het volgende
 * werkmoment na het laatste blok (en nooit na de einddatum: dan op de einddatum).
 */
export function spreidTaken(items: { accountId: string; eigenaarId: string; werkplek: 'binnendienst' | 'buitendienst'; regioId?: string | null }[], blokken: Blok[], regiodagen: { gebiedId: string; gebruikerId: string; datum: string }[], looptijd: { start: string; eind: string }, feestdagen: string[] = []): Map<string, string> {
  const uit = new Map<string, string>()
  const vrij = new Map(blokken.map((b, i) => [i, b.plekken]))
  const werkdag = (d: string) => { const w = new Date(`${d}T12:00:00Z`).getUTCDay(); return w !== 0 && w !== 6 && !feestdagen.includes(d) }
  const binnen = (d: string) => d >= looptijd.start && d <= looptijd.eind
  let reserve = looptijd.start
  for (const it of items) {
    if (it.werkplek === 'buitendienst') {
      const r = regiodagen.filter((x) => x.gebruikerId === it.eigenaarId && (!it.regioId || x.gebiedId === it.regioId) && binnen(x.datum) && werkdag(x.datum)).sort((a, b) => a.datum.localeCompare(b.datum))
      // Verdeel over de regiodagen: telkens de dag met de minste taken.
      const telling = (d: string) => [...uit.values()].filter((v) => v.startsWith(d)).length
      const dag = r.sort((a, b) => telling(a.datum) - telling(b.datum) || a.datum.localeCompare(b.datum))[0]
      if (dag) { uit.set(it.accountId, nlTijdstip(dag.datum, 9).toISOString()); continue }
    } else {
      const i = blokken.findIndex((b, k) => b.eigenaarId === it.eigenaarId && (vrij.get(k) ?? 0) > 0 && binnen(b.datum) && werkdag(b.datum))
      if (i >= 0) { vrij.set(i, vrij.get(i)! - 1); const b = blokken[i]!; uit.set(it.accountId, nlTijdstip(b.datum, Number(b.start.slice(0, 2)), Number(b.start.slice(3, 5))).toISOString()); continue }
    }
    // Geen blok of regiodag: gelijkmatig over de looptijd, op werkdagen.
    while (!werkdag(reserve) && reserve < looptijd.eind) reserve = plusDagen(reserve, 1)
    uit.set(it.accountId, nlTijdstip(binnen(reserve) ? reserve : looptijd.eind, 9).toISOString())
    reserve = plusDagen(reserve, 1)
    if (reserve > looptijd.eind) reserve = looptijd.start
  }
  return uit
}

/** Minuten per poging per kanaal (schatting voor de capaciteit). */
export const MINUTEN_PER_POGING: Record<Kanaal, number> = { bellen: 6, mail: 4, linkedin: 4, bezoek: 75, kaart: 5 }
/** Capaciteit: benodigde uren per week tegen beschikbaar (koude belblokken of regiodagen). */
export function capaciteit(aantalItems: number, soort: Pick<Campagnesoort, 'kanalen' | 'pogingen' | 'weken'>, beschikbaarUrenPerWeek: number): { nodigUren: number; beschikbaarUren: number; boven: boolean; tekst: string } {
  const kanaal = soort.kanalen[0] ?? 'bellen'
  const nodig = Math.round(((aantalItems * soort.pogingen * MINUTEN_PER_POGING[kanaal]) / 60 / Math.max(1, soort.weken)) * 10) / 10
  const fmt = (n: number) => n.toLocaleString('nl-NL', { maximumFractionDigits: 1 })
  const woord = kanaal === 'bezoek' ? 'bezoeken' : kanaal === 'bellen' ? 'bellen' : kanaal
  return { nodigUren: nodig, beschikbaarUren: beschikbaarUrenPerWeek, boven: nodig > beschikbaarUrenPerWeek, tekst: `${fmt(nodig)} uur ${woord} per week tegen ${fmt(beschikbaarUrenPerWeek)} beschikbaar` }
}

export interface Resultaat { accounts: number; bereikt: number; gesprekken: number; afsprakenGepland: number; afsprakenGehouden: number; overgedragen: number; conversie: number; winpuntUitgevoerd: number | null }
/** Het resultaat van een campagne. Geen deals of pipelinewaarde (B17). */
export function campagneResultaat(items: Pick<Item, 'accountId' | 'kolom' | 'winpuntUitgevoerd'>[], activiteiten: { accountId: string; soort: string; uitkomst?: string | null; gebeurtenis?: string | null }[]): Resultaat {
  const ids = new Set(items.map((i) => i.accountId))
  const per = (f: (a: (typeof activiteiten)[number]) => boolean) => new Set(activiteiten.filter((a) => ids.has(a.accountId) && f(a)).map((a) => a.accountId)).size
  const bereikt = per((a) => !!a.uitkomst && !['geen_reactie', 'voicemail', 'verzonden'].includes(a.uitkomst))
  const gesprekken = per((a) => ['gesproken', 'afspraak', 'later', 'nieuw_contact', 'geen_interesse', 'niet_geschikt'].includes(a.uitkomst ?? ''))
  const gepland = Math.max(per((a) => a.gebeurtenis === 'eerste-afspraak-gepland' || a.uitkomst === 'afspraak'), items.filter((i) => i.kolom === 'afspraak').length)
  const gehouden = per((a) => a.gebeurtenis === 'eerste-afspraak-gehouden')
  const overgedragen = per((a) => a.gebeurtenis === 'overgedragen')
  const beantwoord = items.filter((i) => i.winpuntUitgevoerd != null)
  return { accounts: items.length, bereikt, gesprekken, afsprakenGepland: gepland, afsprakenGehouden: gehouden, overgedragen, conversie: items.length ? Math.round((gepland / items.length) * 100) : 0, winpuntUitgevoerd: beantwoord.length ? Math.round((beantwoord.filter((i) => i.winpuntUitgevoerd).length / beantwoord.length) * 100) : null }
}

export interface Kandidaat { id: string; naam: string; gedeactiveerd?: boolean; ritmeActief?: boolean; afkoelingTot?: string | null; partner?: string | null; nbStatus?: string | null; campagneIds?: string[] }
const MEERVOUD: Record<string, string> = { 'is gedeactiveerd': 'zijn gedeactiveerd', 'zit al in een ritme': 'zitten al in een ritme', 'zit al in een campagne': 'zitten al in een campagne', 'zei nee': 'zeiden nee', 'in afkoelperiode': 'in afkoelperiode', 'hoort bij een partner': 'horen bij een partner' }
/** Wie overgeslagen wordt, met reden: al in een ritme of andere campagne, in afkoeling, nee, of bij een partner (bij direct). */
export function overslagen(accounts: Kandidaat[], kanaalVia: 'direct' | 'partner', nu: Date): { mee: Kandidaat[]; over: { account: Kandidaat; reden: string }[]; samenvatting: string[] } {
  const mee: Kandidaat[] = []; const over: { account: Kandidaat; reden: string }[] = []
  for (const a of accounts) {
    const reden = a.gedeactiveerd ? 'is gedeactiveerd' : a.ritmeActief ? 'zit al in een ritme' : a.campagneIds?.length ? 'zit al in een campagne' : a.nbStatus === 'nee' ? 'zei nee' : a.afkoelingTot && Date.parse(a.afkoelingTot) > nu.getTime() ? 'in afkoelperiode' : kanaalVia === 'direct' && a.partner ? 'hoort bij een partner' : null
    if (reden) over.push({ account: a, reden }); else mee.push(a)
  }
  const tel = new Map<string, number>()
  for (const o of over) tel.set(o.reden, (tel.get(o.reden) ?? 0) + 1)
  return { mee, over, samenvatting: [...tel.entries()].map(([r, n]) => `${n} ${n === 1 ? r : MEERVOUD[r] ?? r}`) }
}

/** Kanaaldekking (15.1): het deel van de accounts dat het kanaal van de eerste stap kan. Onder 80 procent start de campagne niet. */
export function kanaalDekking(accounts: { telefoon?: boolean; email?: boolean; linkedin?: boolean; adres?: boolean }[], kanaal: Kanaal): { met: number; totaal: number; procent: number; mag: boolean; tekst: string | null } {
  const veld = kanaal === 'bellen' ? 'telefoon' : kanaal === 'mail' ? 'email' : kanaal === 'linkedin' ? 'linkedin' : 'adres'
  const met = accounts.filter((a) => a[veld as keyof typeof a]).length
  const procent = accounts.length ? Math.round((met / accounts.length) * 100) : 100
  const naam = { telefoon: 'een telefoonnummer', email: 'een e-mailadres', linkedin: 'een LinkedIn-profiel', adres: 'een adres' }[veld]
  const mag = procent >= 80
  return { met, totaal: accounts.length, procent, mag, tekst: mag ? null : `${met} van de ${accounts.length} accounts hebben ${naam}. Vul eerst de ${veld === 'telefoon' ? 'nummers' : 'gegevens'} aan of kies een ander kanaal voor de eerste stap.` }
}

/** De titel van een campagnetaak: "{werkwoord} {account} ({campagne})". */
export const taakTitel = (werkwoord: string, account: string, campagne: string) => `${werkwoord} ${account} (${campagne})`
/** Omvang: buiten 20 tot 80 een waarschuwing, geen blokkade. */
export const omvangMelding = (n: number) => (n < 20 ? `Een campagne werkt het best met 20 tot 80 accounts; dit zijn er ${n}.` : n > 80 ? `Dit zijn ${n} accounts. Overweeg te splitsen: een campagne werkt het best met 20 tot 80.` : null)
/** Is de einddatum voorbij (afsluiter)? */
export const isAfgelopen = (c: { endsAt?: string | null; status: string }, nu: Date) => c.status === 'actief' && !!c.endsAt && nlMoment(nu).datum > c.endsAt.slice(0, 10)
