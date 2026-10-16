// Agenda en meetings (P13, F09): de startset van meetingsoorten (één bron voor seed en editor), het
// gevolg van een uitkomst, de eerste afspraak, "Wie is er aan de beurt?", het vormadvies, vrije
// momenten en conflicten. Puur, met `nu` als parameter. Geen deals of offertes (B17).
import { nlMoment, nlTijdstip, plusDagen } from './datum'
import { isEersteAfspraak as eersteVolgensReis } from './reis'

export type Vorm = 'bezoek' | 'online' | 'telefoon'
export type AfspraakStatus = 'gepland' | 'afgerond' | 'niet_verschenen' | 'geannuleerd'
export interface Gevolg { type: 'gehouden' | 'later' | 'contactpersoon' | 'nee' | 'afspraak' | 'geen'; meetingsoortSlug?: string; termijnDagen?: number; overdragen?: boolean }
export interface Uitkomst { code: string; label: string; gevolg: Gevolg }
export interface MeetingsoortData { doel: string; standaardLocatie?: 'account' | 'online' | null; agenda: { punt: string; verplicht: boolean }[]; voorbereiding: string[]; uitkomsten: Uitkomst[]; eersteAfspraak?: boolean; herinneringMin: number; kleur: string }
export interface Meetingsoort { id?: string; slug: string; naam: string; type: 'klant' | 'intern'; duurMin: number; vorm: Vorm; data: MeetingsoortData }

const EERSTE: Uitkomst[] = [
  { code: 'vervolg', label: 'Vervolg afgesproken', gevolg: { type: 'gehouden', overdragen: true } },
  { code: 'later', label: 'Later terugkomen', gevolg: { type: 'later', termijnDagen: 30 } },
  { code: 'andere-contactpersoon', label: 'Andere contactpersoon', gevolg: { type: 'contactpersoon' } },
  { code: 'geen-vervolg', label: 'Geen interesse', gevolg: { type: 'nee' } },
]
const BEL: Uitkomst[] = [
  { code: 'afspraak', label: 'Afspraak gemaakt', gevolg: { type: 'afspraak', meetingsoortSlug: 'kennismaking' } },
  { code: 'later', label: 'Later opnieuw', gevolg: { type: 'later', termijnDagen: 14 } },
  { code: 'geen-interesse', label: 'Geen interesse', gevolg: { type: 'nee' } },
]
const AGENDA_KENNIS = [{ punt: 'Aanleiding', verplicht: true }, { punt: 'Situatie', verplicht: true }, { punt: 'Behoefte', verplicht: true }, { punt: 'Vervolg', verplicht: true }]

/** De meetingsoorten van de startset (F09, F23): zes uit P13 plus Ongepland bezoek (P30). Geen offertebespreking (B17). */
export const MEETINGSOORTEN_START: Meetingsoort[] = [
  { slug: 'kennismaking', naam: 'Kennismaking', type: 'klant', duurMin: 30, vorm: 'online', data: { doel: 'Kennismaken en de behoefte verkennen.', standaardLocatie: 'online', agenda: AGENDA_KENNIS, voorbereiding: ['Lees het dossier en de aanleiding', 'Kies één winpunt'], uitkomsten: EERSTE, eersteAfspraak: true, herinneringMin: 30, kleur: 'geel' } },
  { slug: 'inventarisatie', naam: 'Inventarisatie', type: 'klant', duurMin: 60, vorm: 'bezoek', data: { doel: 'Ter plaatse de situatie en het project bekijken.', standaardLocatie: 'account', agenda: [...AGENDA_KENNIS, { punt: 'Rondgang', verplicht: false }], voorbereiding: ['Plan de route', 'Neem het leverplan mee'], uitkomsten: EERSTE, eersteAfspraak: true, herinneringMin: 60, kleur: 'paars' } },
  { slug: 'demo', naam: 'Demo', type: 'klant', duurMin: 45, vorm: 'online', data: { doel: 'Laten zien hoe het werkt in hun situatie.', standaardLocatie: 'online', agenda: [{ punt: 'Situatie', verplicht: true }, { punt: 'Demo', verplicht: true }, { punt: 'Vragen', verplicht: false }, { punt: 'Vervolg', verplicht: true }], voorbereiding: ['Zet de demo klaar met hun voorbeeld'], uitkomsten: EERSTE, eersteAfspraak: true, herinneringMin: 30, kleur: 'blauw' } },
  { slug: 'belafspraak', naam: 'Belafspraak', type: 'klant', duurMin: 15, vorm: 'telefoon', data: { doel: 'Een kort gesprek op een afgesproken moment.', standaardLocatie: null, agenda: [{ punt: 'Aanleiding', verplicht: true }, { punt: 'Vervolg', verplicht: true }], voorbereiding: ['Lees de laatste notitie'], uitkomsten: BEL, herinneringMin: 15, kleur: 'groen' } },
  { slug: 'terugbelafspraak', naam: 'Terugbelafspraak', type: 'klant', duurMin: 10, vorm: 'telefoon', data: { doel: 'Terugbellen zoals afgesproken.', standaardLocatie: null, agenda: [{ punt: 'Vraag van de klant', verplicht: true }], voorbereiding: [], uitkomsten: BEL, herinneringMin: 15, kleur: 'groen' } },
  // P30: inloopbezoek langs de route; dezelfde uitkomsten als Kennismaking, telt niet als eerste afspraak.
  { slug: 'ongepland-bezoek', naam: 'Ongepland bezoek', type: 'klant', duurMin: 30, vorm: 'bezoek', data: { doel: 'Binnenlopen langs de route.', standaardLocatie: 'account', agenda: [{ punt: 'Aanleiding', verplicht: false }, { punt: 'Vervolg', verplicht: true }], voorbereiding: [], uitkomsten: EERSTE, herinneringMin: 0, kleur: 'oranje' } },
  { slug: 'weekoverleg', naam: 'Weekoverleg new business', type: 'intern', duurMin: 30, vorm: 'online', data: { doel: 'De pijplijn van de week doornemen.', standaardLocatie: 'online', agenda: [{ punt: 'Cijfers', verplicht: false }, { punt: 'Wat knelt', verplicht: false }], voorbereiding: [], uitkomsten: [], herinneringMin: 10, kleur: 'grijs' } },
]

export interface AfspraakKort { id: string; accountId: string | null; status: AfspraakStatus; start: string; meetingsoortType?: 'klant' | 'intern' }
/** Alleen de eerste niet-geannuleerde klantafspraak met dit account (gat 3). */
export function isEersteAfspraak(afspraken: AfspraakKort[], accountId: string, afspraakId: string): boolean {
  const eigen = afspraken.filter((a) => a.accountId === accountId && a.meetingsoortType !== 'intern')
  return eersteVolgensReis(afspraakId, eigen.map((a) => ({ id: a.id, op: a.start, status: a.status === 'afgerond' ? 'gehouden' : a.status === 'niet_verschenen' ? 'niet-verschenen' : a.status })))
}

export interface UitkomstMutaties {
  afspraak: { status: 'afgerond'; uitkomstCode: string }
  gebeurtenis: 'eerste-afspraak-gehouden' | 'geen-vervolg' | null
  nee: { reden: string; toelichting?: string | null; verlorenAan?: string | null } | null
  wachtendTot: string | null
  taken: { titel: string; actiesoort: 'bellen' | 'taak' | 'bezoek'; dueDatum: string }[]
  planAfspraak: string | null
  overdragen: boolean
  klantcontact: boolean
  fout?: string
}
/**
 * Het gevolg van een uitkomst: één handeling zet status, stuurvelden, gevolg en taken. `vervolg`
 * na de eerste afspraak meldt eerste-afspraak-gehouden en vraagt "Overdragen?"; tot P17 is dat een
 * overdrachtstaak met het verslag. Intern overleg is nooit klantcontact.
 */
export function meetingUitkomst(afspraak: { accountNaam?: string | null; start: string; eerste: boolean }, soort: Pick<Meetingsoort, 'type' | 'data' | 'naam'>, code: string, opties: { reden?: string | null; toelichting?: string | null; laterOp?: string | null; verlorenAan?: string | null; vervolgstap?: string | null; nu: Date }): UitkomstMutaties {
  const leeg: UitkomstMutaties = { afspraak: { status: 'afgerond', uitkomstCode: code }, gebeurtenis: null, nee: null, wachtendTot: null, taken: [], planAfspraak: null, overdragen: false, klantcontact: soort.type === 'klant' }
  if (soort.type === 'intern') return { ...leeg, klantcontact: false }
  const u = soort.data.uitkomsten.find((x) => x.code === code)
  if (!u) return { ...leeg, fout: soort.data.uitkomsten.length ? 'Kies een uitkomst' : 'Deze meetingsoort heeft geen uitkomsten' }
  const vandaag = nlMoment(opties.nu).datum
  const naam = afspraak.accountNaam ?? 'de klant'
  switch (u.gevolg.type) {
    case 'gehouden':
      if (!afspraak.eerste) return { ...leeg, taken: [{ titel: `Vervolg met ${naam}: ${opties.vervolgstap?.trim() || 'afgesproken vervolgstap'}`, actiesoort: 'taak', dueDatum: plusDagen(vandaag, 1) }] }
      return { ...leeg, gebeurtenis: 'eerste-afspraak-gehouden', overdragen: !!u.gevolg.overdragen, taken: [{ titel: `Overdragen: ${naam}${opties.vervolgstap?.trim() ? ` (${opties.vervolgstap.trim()})` : ''}`, actiesoort: 'taak', dueDatum: plusDagen(vandaag, 1) }] }
    case 'later': {
      const tot = opties.laterOp ?? plusDagen(vandaag, u.gevolg.termijnDagen ?? 30)
      return { ...leeg, wachtendTot: tot, taken: [{ titel: `Terugkomen bij ${naam}`, actiesoort: 'bellen', dueDatum: tot }] }
    }
    case 'contactpersoon':
      return { ...leeg, taken: [{ titel: `Nieuwe contactpersoon bij ${naam} benaderen`, actiesoort: 'bellen', dueDatum: plusDagen(vandaag, 1) }] }
    case 'nee':
      if (!opties.reden) return { ...leeg, fout: 'Kies een reden' }
      return { ...leeg, gebeurtenis: afspraak.eerste || code === 'geen-vervolg' ? 'geen-vervolg' : null, nee: { reden: opties.reden, toelichting: opties.toelichting ?? null, verlorenAan: opties.verlorenAan ?? null } }
    case 'afspraak':
      return { ...leeg, planAfspraak: u.gevolg.meetingsoortSlug ?? 'kennismaking' }
    default:
      return leeg
  }
}

export type VoorstelAdvies = 'belafspraak' | 'online' | 'fysiek' | 'belblok'
export interface Voorstel {
  accountId: string; naam: string; reden: string; vormAdvies: string; dagenAchter: number
  soort: 'no-show' | 'na-eerste-afspraak' | 'eerste-gesprek' | 'terugkomen' | 'ritme'
  /** Een zin waarom dit account nu aan de beurt is (Meetinglijst op /meetings). */
  uitleg: string
  /** De vorm uit het advies als code, voor de planknop. */
  advies: VoorstelAdvies
  /** Label voor de tag, bijvoorbeeld "Belafspraak vandaag". */
  adviesLabel: string
}
const REDEN_VOLGORDE: Voorstel['soort'][] = ['no-show', 'na-eerste-afspraak', 'eerste-gesprek', 'terugkomen', 'ritme']
/** Het vormadvies (tekst uit vormAdvies) als code voor de planknop. */
export function adviesCode(vorm: string): VoorstelAdvies {
  if (vorm.startsWith('Fysiek')) return 'fysiek'
  if (vorm.startsWith('Online')) return 'online'
  if (vorm.startsWith('Taak in belblok')) return 'belblok'
  return 'belafspraak'
}
const dagLabel = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagenTekst = (n: number) => (n === 0 ? 'vandaag' : n === 1 ? 'gisteren' : `${n} dagen geleden`)
/**
 * "Wie is er aan de beurt?" (hooguit 8): no-show opnieuw inplannen, eerste afspraak gehouden zonder
 * vervolg, eerste gesprek nog niet ingepland (positief contact zonder afspraak), terugkomdatum bereikt
 * en verlopen ritmes. Prospects zonder historie of klasse doen mee (gat 33). Elk voorstel krijgt een
 * uitleg en een adviescode met label, zodat de Meetinglijst meteen de juiste planknop toont.
 */
export function aanDeBeurt(accounts: { id: string; naam: string; faseId?: string | null; nbStatus?: string | null; klasse?: string | null; laatsteContactOp?: string | null; ritmeVolgendeOp?: string | null; laatsteUitkomst?: string | null; plaats?: string | null; terugOp?: string | null }[], afspraken: AfspraakKort[], nu: Date, advies: (a: { id: string; plaats?: string | null }) => string): Voorstel[] {
  const uit: Voorstel[] = []
  const vandaag = nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' })
  for (const a of accounts) {
    const eigen = afspraken.filter((x) => x.accountId === a.id)
    const toekomst = eigen.some((x) => x.status === 'gepland' && Date.parse(x.start) >= nu.getTime())
    if (toekomst || ['nee', 'overgedragen', 'klant'].includes(a.nbStatus ?? '')) continue
    const laatste = (status: AfspraakStatus) => eigen.filter((x) => x.status === status).sort((x, y) => y.start.localeCompare(x.start))[0]
    const dagen = (iso: string | null | undefined) => (iso ? Math.max(0, Math.floor((nu.getTime() - Date.parse(iso)) / 864e5)) : 0)
    const voeg = (soort: Voorstel['soort'], reden: string, dagenAchter: number, uitleg: string, nuNodig: boolean) => {
      const vorm = advies(a)
      const code = adviesCode(vorm)
      // Fysiek op de regiodag heeft zijn eigen dag; de andere vormen krijgen hoe snel het moet.
      const adviesLabel = code === 'fysiek' ? vorm : `${vorm} ${nuNodig ? 'vandaag' : 'deze week'}`
      uit.push({ accountId: a.id, naam: a.naam, reden, vormAdvies: vorm, dagenAchter, soort, uitleg, advies: code, adviesLabel })
    }
    const noShow = laatste('niet_verschenen')
    if (noShow) { voeg('no-show', 'No-show opnieuw inplannen', dagen(noShow.start), `De afspraak van ${dagLabel(noShow.start)} ging niet door. Plan een nieuw moment voordat het contact afkoelt.`, true); continue }
    const gehouden = laatste('afgerond')
    if (gehouden && a.faseId === 'afspraak-gehouden') { const n = dagen(gehouden.start); voeg('na-eerste-afspraak', 'Eerste afspraak gehouden, nog geen vervolg', n, `De eerste afspraak was ${dagenTekst(n)}, maar er staat nog geen vervolg in de agenda. Zet de volgende stap vast zolang het gesprek vers is.`, n >= 3); continue }
    if (['afspraak', 'gesproken'].includes(a.laatsteUitkomst ?? '') && !['afspraak-gepland', 'afspraak-gehouden', 'overgedragen', 'verloren', 'geparkeerd'].includes(a.faseId ?? '')) { const n = dagen(a.laatsteContactOp); voeg('eerste-gesprek', 'Eerste gesprek nog niet ingepland', n, `Het laatste contact ${n ? `${dagenTekst(n)} ` : ''}was positief, maar er staat nog geen eerste afspraak. Leg het moment vast.`, n >= 2); continue }
    if (a.terugOp && a.terugOp <= vandaag) { const n = dagen(`${a.terugOp}T08:00:00Z`); voeg('terugkomen', 'Terugkomdatum bereikt', n, `Je zou op ${dagLabel(`${a.terugOp}T12:00:00Z`)} terugkomen op dit account. Zoek opnieuw contact.`, true); continue }
    if (a.ritmeVolgendeOp && Date.parse(a.ritmeVolgendeOp) <= nu.getTime()) { const n = dagen(a.ritmeVolgendeOp); voeg('ritme', a.klasse ? 'Ritme loopt af' : 'Ritme loopt af (nog geen klasse)', n, a.klasse ? `Klasse ${/^kl-([a-z])-/i.test(a.klasse) ? a.klasse.slice(3, 4).toUpperCase() : a.klasse}: het contactritme liep ${dagenTekst(n)} af. Plan het volgende gesprek.` : `Het contactritme liep ${dagenTekst(n)} af. Dit account heeft nog geen klasse.`, n >= 1) }
  }
  return uit.sort((x, y) => REDEN_VOLGORDE.indexOf(x.soort) - REDEN_VOLGORDE.indexOf(y.soort) || y.dagenAchter - x.dagenAchter).slice(0, 8)
}

const WEEKDAG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
/** Vormadvies: binnendienst belt (taak in belblok of belafspraak); buitendienst fysiek op de regiodag als die er is. */
export function vormAdvies(account: { plaats?: string | null; regioId?: string | null }, gebruiker: { werkplek?: string | null }, regiodagen: { regioId: string; naam: string; weekdag: number; plaatsen?: string[] }[], nu: Date): string {
  if (gebruiker.werkplek === 'binnendienst') return account.plaats ? 'Belafspraak' : 'Taak in belblok'
  const r = regiodagen.find((x) => (account.regioId && x.regioId === account.regioId) || (account.plaats && (x.plaatsen ?? []).some((p) => p.toLowerCase() === account.plaats!.toLowerCase())))
  if (r) return `Fysiek · ${WEEKDAG[r.weekdag]} ${r.naam}`
  return gebruiker.werkplek === 'buitendienst' ? 'Online' : 'Belafspraak'
}

export interface Blok { start: string; eind: string }
/** Vrije momenten op een dag binnen de werkdag, met bezet uit de eigen afspraken en de gekoppelde agenda. */
export function vrijeMomentenAgenda(bezet: Blok[], dag: string, duurMin: number, werkdag: { start: number; eind: number } = { start: 8, eind: 18 }, stapMin = 30): Blok[] {
  const begin = nlTijdstip(dag, werkdag.start).getTime()
  const einde = nlTijdstip(dag, werkdag.eind).getTime()
  const uit: Blok[] = []
  for (let t = begin; t + duurMin * 60_000 <= einde; t += stapMin * 60_000) {
    const e = t + duurMin * 60_000
    if (bezet.every((b) => Date.parse(b.eind) <= t || Date.parse(b.start) >= e)) uit.push({ start: new Date(t).toISOString(), eind: new Date(e).toISOString() })
  }
  return uit
}

/** Overlap tussen geplande afspraken van dezelfde persoon: rode rand in de agenda. */
export function conflicten(afspraken: { id: string; ownerId: string; start: string; eind: string; status: AfspraakStatus }[]): Set<string> {
  const uit = new Set<string>()
  const actief = afspraken.filter((a) => a.status === 'gepland').sort((a, b) => a.start.localeCompare(b.start))
  for (let i = 0; i < actief.length; i++) for (let j = i + 1; j < actief.length; j++) {
    const a = actief[i]!; const b = actief[j]!
    if (b.start >= a.eind) break
    if (a.ownerId === b.ownerId) { uit.add(a.id); uit.add(b.id) }
  }
  return uit
}
