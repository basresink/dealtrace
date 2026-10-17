// Briefings (P18, F11): één soortbepaling voor elke ingang (gat 34) en de berekende blokken zonder AI.
// Eigen tekst wint van AI, AI van berekend. De briefing "Overdracht" is dezelfde die met de overdracht
// meegaat (P17). Geen offertebriefing (B17).
import { beloftevoor, kiesWinpunt, leesAlsDeKlantZegt, verhaalVoor, type Concurrent, type VerkoopverhaalStand, type Winpunt } from './verkoopverhaal'

export const BRIEFING_SOORTEN = ['eerste-gesprek', 'behoefte', 'verdieping', 'overdracht', 'bezoek'] as const
export type BriefingSoort = typeof BRIEFING_SOORTEN[number]
export const SOORT_LABEL: Record<BriefingSoort, string> = { 'eerste-gesprek': 'Eerste gesprek', behoefte: 'Behoefte, probleem, oplossing', verdieping: 'Verdieping', overdracht: 'Overdracht', bezoek: 'Bezoek' }

export interface SoortContext {
  vastgezet?: BriefingSoort | null
  meetingsoortVorm?: string | null
  eersteAfspraakGehoudenMetVervolg?: boolean
  faseId?: string | null
  gesprekken: number
  beslisserGesproken?: boolean
}
/**
 * Eén soortbepaling (gat 34): eerst vastgezet (Expert), dan een gehouden eerste afspraak met vervolg
 * (Overdracht), dan de meetingsoort (bezoek), dan fase en aantal gesprekken. Een taak of afspraak, op
 * tijd of achterstallig, krijgt dezelfde soort voor hetzelfde gesprek.
 */
export function kiesBriefingSoort(c: SoortContext): BriefingSoort {
  if (c.vastgezet && BRIEFING_SOORTEN.includes(c.vastgezet)) return c.vastgezet
  if (c.eersteAfspraakGehoudenMetVervolg) return 'overdracht'
  if (c.meetingsoortVorm === 'bezoek') return 'bezoek'
  if (c.gesprekken >= 3 || c.faseId === 'in-gesprek') return 'verdieping'
  // Nog geen gesprek met een beslisser: eerste gesprek; daarna 1 of 2 gesprekken: behoefte.
  if (!c.beslisserGesproken) return 'eerste-gesprek'
  return c.gesprekken >= 1 ? 'behoefte' : 'eerste-gesprek'
}

/** Waarom de soort zo staat, in woorden (dezelfde volgorde als kiesBriefingSoort), voor "Automatisch gekozen: ...". */
export function soortReden(c: SoortContext): string {
  const n = c.gesprekken
  const gesprekken = n === 1 ? 'er is één gesprek geweest' : `er zijn ${n} gesprekken geweest`
  if (c.vastgezet && BRIEFING_SOORTEN.includes(c.vastgezet)) return 'je hebt de soort vastgezet'
  if (c.eersteAfspraakGehoudenMetVervolg) return 'de eerste afspraak is gehouden en er is een vervolg'
  if (c.meetingsoortVorm === 'bezoek') return 'de afspraak is op locatie'
  if (n >= 3) return gesprekken
  if (c.faseId === 'in-gesprek') return 'de prospect staat in de fase In gesprek'
  if (!c.beslisserGesproken) return 'je sprak nog geen beslisser'
  return n >= 1 ? `je sprak de beslisser en ${gesprekken}` : 'er is nog geen gesprek geweest'
}

export type Herkomst = 'berekend' | 'ai' | 'eigen'
export interface Blok { sleutel: string; titel: string; tekst: string; herkomst: Herkomst; bron?: string | null; gat?: string | null }

export interface BriefingContext {
  account: { naam: string; branche?: string | null; plaats?: string | null; klasse?: string | null; vvBrancheId?: string | null; huidigeLeverancierId?: string | null; adres?: string | null; aanleiding?: { tekst: string; bron: string } | null; dossierFeiten?: string[]; band?: Record<string, { ja?: boolean } | undefined> }
  contacten: { naam: string; functie?: string | null; rol: string }[]
  verslagen: { tekst: string; op: string }[]
  faseId?: string | null
  faseAccent?: string | null
  doel?: string | null
  afspraak?: { soort: string; vorm?: string | null; start: string; verslag?: string | null; vervolgstap?: string | null; locatie?: string | null } | null
  geschiedenis?: { fase: string; op: string }[]
  stand: Pick<VerkoopverhaalStand, 'teksten' | 'branches' | 'winpunten' | 'concurrenten'>
  eerderGebruikteWinpunten?: string[]
}

const ROLLEN = ['beslisser', 'beinvloeder', 'champion', 'gebruiker'] as const
const ROL_LABEL: Record<string, string> = { beslisser: 'beslisser', beinvloeder: 'beïnvloeder', champion: 'champion', gebruiker: 'gebruiker' }
const zinnen = (t: string, n: number) => (t.match(/[^.!?]+[.!?]?/g) ?? [t]).map((x) => x.trim()).filter(Boolean).slice(0, n).join(' ')
const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))

/** Het winpunt met één bewijs (de concurrentregel van de huidige leverancier of de omschrijving). */
export function winpuntMetBewijs(c: Pick<BriefingContext, 'account' | 'faseId' | 'stand' | 'eerderGebruikteWinpunten'>): { winpunt: Winpunt | null; bewijs: string | null } {
  const w = kiesWinpunt(c.stand.winpunten ?? [], { faseId: c.faseId, concurrentId: c.account.huidigeLeverancierId ?? null, eerderGebruikt: c.eerderGebruikteWinpunten })
  const conc = (c.stand.concurrenten ?? []).find((x) => x.id === c.account.huidigeLeverancierId)
  return { winpunt: w, bewijs: conc?.bewijs ?? conc?.onderscheid ?? w?.omschrijving ?? null }
}

/** Bezwaren met gewicht: de huidige leverancier eerst (gewicht 3), dan andere concurrenten (1). */
export function gewogenBezwaren(c: Pick<BriefingContext, 'account' | 'stand'>): { bezwaar: string; antwoord: string; gewicht: number; concurrent: string }[] {
  return (c.stand.concurrenten ?? []).map((x: Concurrent) => ({ k: leesAlsDeKlantZegt(x.alsDeKlantZegt), x }))
    .filter((y) => y.k).map((y) => ({ bezwaar: y.k!.bezwaar, antwoord: y.k!.antwoord, gewicht: y.x.id === c.account.huidigeLeverancierId ? 3 : 1, concurrent: y.x.naam }))
    .sort((a, b) => b.gewicht - a.gewicht || a.concurrent.localeCompare(b.concurrent)).slice(0, 3)
}

/** De berekende blokken per soort (geen AI). Een gat in het verkoopverhaal is zichtbaar (C.9 geval 1). */
export function vulBriefing(soort: BriefingSoort, c: BriefingContext): Blok[] {
  const b = (sleutel: string, titel: string, tekst: string | null | undefined, extra: Partial<Blok> = {}): Blok => ({ sleutel, titel, tekst: tekst?.trim() || 'Nog niet bekend.', herkomst: 'berekend', ...extra })
  const verhaal = verhaalVoor({ vvBrancheId: c.account.vvBrancheId }, c.stand)
  const belofte = beloftevoor({ vvBrancheId: c.account.vvBrancheId }, c.stand)
  const { winpunt, bewijs } = winpuntMetBewijs(c)
  const wie = c.contacten.length ? c.contacten.map((k) => `${k.naam}${k.functie ? `, ${k.functie}` : ''}${ROL_LABEL[k.rol] ? ` (${ROL_LABEL[k.rol]})` : ''}`).join('; ') : 'Nog geen contactpersoon.'
  const ontbreekt = ROLLEN.filter((r) => !c.contacten.some((k) => k.rol === r)).map((r) => ROL_LABEL[r])
  const bedrijf = [`${c.account.naam}${c.account.branche ? `, ${c.account.branche}` : ''}${c.account.plaats ? ` in ${c.account.plaats}` : ''}.`, c.account.klasse ? `Klasse ${c.account.klasse}.` : '', ...(c.account.dossierFeiten ?? []).slice(0, 1)].filter(Boolean).join(' ')
  const vorigVerslag = c.verslagen[0]?.tekst ?? null
  const winpuntTekst = winpunt ? `${winpunt.titel}. Bewijs: ${bewijs ?? winpunt.omschrijving}` : null
  const doel = b('doel', 'Doel van dit gesprek', c.doel ?? (soort === 'eerste-gesprek' || soort === 'bezoek' ? 'Een eerste afspraak, of weten wie er beslist.' : soort === 'overdracht' ? 'De collega kan morgen verder zonder iets na te vragen.' : 'De volgende stap afspreken.'))
  const band = c.account.band ?? {}
  const bandTekst = ['behoefte', 'autoriteit', 'noodzaak', 'draagvlak'].map((k) => `${k[0]!.toUpperCase()}${k.slice(1)}: ${band[k]?.ja ? 'ja' : 'ontbreekt'}`).join(' · ')
  const bezwaren = gewogenBezwaren(c)
  const eerste: Blok[] = [
    b('bedrijf', 'Bedrijf in drie zinnen', zinnen(bedrijf, 3)),
    b('waaromNu', 'Waarom nu', c.account.aanleiding?.tekst, { bron: c.account.aanleiding?.bron ?? null }),
    b('wie', 'Wie zit er tegenover je', wie),
    b('ontbreekt', 'Wie ontbreekt nog', ontbreekt.length ? `Nog geen ${ontbreekt.join(', ')}.` : 'Het buying committee is compleet.'),
    b('opening', 'Openingsvraag', c.account.aanleiding ? `${verhaal.kernzin ?? ''} Ik zag ${c.account.aanleiding.tekst.replace(/\.$/, '').toLowerCase()}; hoe kijken jullie daarnaar?`.trim() : verhaal.kernzin ? `${verhaal.kernzin} Hoe pakken jullie dat nu aan?` : null),
    b('winpunt', 'Winpunt en één bewijs', winpuntTekst),
    doel,
    b('verhaal', 'Ons verhaal voor deze branche', [verhaal.tekst ? zinnen(verhaal.tekst, 2) : null, belofte.kernbelofte].filter(Boolean).join(' '), { gat: verhaal.gat ?? belofte.gat }),
  ]
  switch (soort) {
    case 'eerste-gesprek': return eerste
    case 'bezoek': return [...eerste, b('bezoek', 'Bij aankomst', [c.afspraak?.locatie ?? c.account.adres ? `Adres: ${c.afspraak?.locatie ?? c.account.adres}.` : null, c.contacten[0] ? `Vraag bij de receptie naar ${c.contacten[0].naam}.` : null, 'Neem een voorbeeld van je winpunt mee.'].filter(Boolean).join(' '))]
    case 'behoefte': return [
      b('pijn', 'Pijnpunt', vorigVerslag ? zinnen(vorigVerslag, 2) : null, { bron: c.verslagen[0] ? `Verslag van ${datum(c.verslagen[0].op)}` : null }),
      b('huidig', 'Huidige situatie', c.account.huidigeLeverancierId ? `Werkt nu met ${(c.stand.concurrenten ?? []).find((x) => x.id === c.account.huidigeLeverancierId)?.naam ?? 'een andere leverancier'}.` : null),
      b('gewenst', 'Gewenste situatie', belofte.kernbelofte),
      b('oplossing', 'Onze oplossing en winpunt', winpuntTekst),
      b('bezwaren', 'Te verwachten bezwaren', bezwaren.map((x) => `"${x.bezwaar}" Antwoord: ${x.antwoord}`).join('\n')),
      doel,
    ]
    case 'verdieping': return [
      b('samenvatting', 'Samenvatting vorige gesprekken', c.verslagen.slice(0, 3).map((v) => `${datum(v.op)}: ${zinnen(v.tekst, 1)}`).join('\n')),
      b('band', 'BAND en wat ontbreekt', bandTekst),
      b('stakeholders', 'Stakeholders', wie),
      b('criteria', 'Vergelijkingscriteria', winpunt ? `Leg de nadruk op: ${winpunt.titel}.` : null),
      doel,
    ]
    case 'overdracht': return [
      b('wie', 'Wie het account is en waarom nu', [zinnen(bedrijf, 2), c.account.aanleiding?.tekst].filter(Boolean).join(' ')),
      b('verslag', 'Wat er in het eerste gesprek is gezegd', c.afspraak?.verslag ?? vorigVerslag),
      b('committee', 'Buying committee en BAND', `${wie}\n${bandTekst}`),
      b('vervolg', 'Afgesproken vervolgstap', c.afspraak?.vervolgstap ?? null),
      b('bezwaren', 'Bezwaren en concurrent', bezwaren.map((x) => `"${x.bezwaar}" (${x.concurrent}) Antwoord: ${x.antwoord}`).join('\n')),
      b('winpunt', 'Winpunt dat aansloeg', winpuntTekst),
      b('reis', 'Reisgeschiedenis', (c.geschiedenis ?? []).slice(-5).map((g) => `${g.fase} op ${datum(g.op)}`).join('\n')),
      b('risico', 'Belofte en risico', [belofte.kernbelofte, (c.stand.concurrenten ?? []).find((x) => x.id === c.account.huidigeLeverancierId) ? `Wanneer we verliezen van de huidige leverancier: ${(c.stand.concurrenten ?? []).find((x) => x.id === c.account.huidigeLeverancierId)?.zoZegJeHet ?? 'zie de concurrentkaart'}.` : null].filter(Boolean).join(' '), { gat: belofte.gat }),
    ]
  }
}

/** Eigen tekst wint van AI, AI van berekend. */
export function combineer(berekend: Blok[], ai: Record<string, string>, eigen: Record<string, string>): Blok[] {
  return berekend.map((b) => (eigen[b.sleutel]?.trim() ? { ...b, tekst: eigen[b.sleutel]!, herkomst: 'eigen' as const } : ai[b.sleutel]?.trim() ? { ...b, tekst: ai[b.sleutel]!, herkomst: 'ai' as const } : b))
}

/** Drie regels voor de briefingmelding, "Lees voor" en de compacte kaart. */
export function pitstopDrieRegels(blokken: Blok[]): string[] {
  const kies = (...s: string[]) => s.map((k) => blokken.find((b) => b.sleutel === k)).find((b) => b && b.tekst !== 'Nog niet bekend.')
  return [kies('waaromNu', 'wie', 'pijn', 'samenvatting'), kies('winpunt', 'oplossing'), kies('doel', 'vervolg')].filter(Boolean).map((b) => `${b!.titel}: ${b!.tekst.split('\n')[0]}`)
}

export const HERKOMST_LABEL: Record<Herkomst, string> = { berekend: 'Berekend', ai: 'Door AI geschreven', eigen: 'Eigen tekst' }
