// Richting (F25, mockup "Richting verbeterd"): de vaste teksten en de pure afleidingen voor de pagina
// /richting. Zeven tabbladen met per tabblad een kop en het blok "Waarom dit ertoe doet", de kop
// "Waar we voor staan" met vier kerncijfers en de voetregel, de filter per soort concurrent en de
// tijdlijn van de terugkomregels. De pagina leest alleen het leesmodel (GET /api/richting).

export type RichtingTab = 'verhaal' | 'richting' | 'belofte' | 'branches' | 'concurrenten' | 'winpunten' | 'terugkomen'

export interface RichtingTabDef {
  k: RichtingTab
  /** Naam van het tabblad. */
  t: string
  /** Onderdeel in de inrichting waar de status van dit tabblad vandaan komt. */
  o: 'bedrijfsverhaal' | 'ambitie' | 'waarde' | 'branches' | 'concurrenten' | 'winpunten' | 'terugkomregels'
  titel: string
  waarom: string
}

export const RICHTING_TABS: readonly RichtingTabDef[] = [
  { k: 'verhaal', t: 'Verhaal', o: 'bedrijfsverhaal', titel: 'Het verhaal dat je vertelt',
    waarom: 'Dit is het verhaal achter elke opening. Je belscript begint met de kernzin, je briefing toont de versie voor de branche van het account. Ken je dit verhaal, dan klink je als één bedrijf, of je nu belt, mailt of op bezoek gaat.' },
  { k: 'richting', t: 'Richting', o: 'ambitie', titel: 'Waar we heen willen',
    waarom: 'De ambitie zegt welke klanten en welk werk het meest waard zijn. Twijfel je of je tijd steekt in een account, toets het hier: past het bij de ambitie, dan is het de moeite waard.' },
  { k: 'belofte', t: 'Belofte', o: 'waarde', titel: 'Wat we beloven',
    waarom: 'De belofte is de ene zin die de prospect moet onthouden. Zeg hem zoals hij hier staat en beloof niets wat er niet in staat. Vraagt de prospect door, dan heb je het waardestatement als antwoord.' },
  { k: 'branches', t: 'Branches', o: 'branches', titel: 'Voor wie we er zijn',
    waarom: 'Hier zie je waar het team zijn tijd in steekt. Primaire branches krijgen nu de meeste aandacht; secundaire bouwen we op voor later. De leadgenerator zoekt nieuwe prospects in deze branches en je accountkaart toont de branche erbij.' },
  { k: 'concurrenten', t: 'Concurrenten', o: 'concurrenten', titel: 'Tegen wie we verkopen',
    waarom: 'Een prospect vergelijkt je altijd met iets: een keten, een webshop, de fabrikant, zijn eigen magazijn of gewoon niets doen. Hier staat per alternatief wat ze goed doen, waar wij anders zijn en wat je zegt. Je praat een concurrent nooit naar beneden.' },
  { k: 'winpunten', t: 'Winpunten', o: 'winpunten', titel: 'Waarom klanten voor ons kiezen',
    waarom: 'Een winpunt is de reden waarom een klant in een bepaalde fase voor ons kiest. Noem er één per gesprek, op het juiste moment: je belscript en briefing kiezen het winpunt van de fase waarin het account zit.' },
  { k: 'terugkomen', t: 'Terugkomen', o: 'terugkomregels', titel: 'Wanneer we iemand terugbellen',
    waarom: 'Een nee is geen nee voor altijd. Deze regels zeggen wanneer je opnieuw contact opneemt, via welk kanaal en met welke aanleiding. Dealtrace zet de taak op die datum vanzelf voor je klaar, zodat niemand te vroeg of nooit meer belt.' },
] as const

/** Vaste teksten van de pagina. */
export const RICHTING_TEKST = {
  kicker: 'Richting · SalesDNA',
  titel: 'Ons verhaal',
  heldKicker: 'Waar we voor staan',
  belofteLabel: 'Onze belofte.',
  waaromKop: 'Waarom dit ertoe doet',
  gebruik: 'Belscripts, briefings en opvolging gebruiken deze versie',
  leeg: 'Jullie SalesDNA is nog niet vastgelegd.',
  kernzinUitleg: 'Gemarkeerd: de kernzin. Die gebruikt je belscript als opening.',
  geenBrancheVerhaal: 'Nog geen eigen verhaal. Je belscript en briefing gebruiken het algemene verhaal.',
  geenBrancheBelofte: 'De algemene belofte geldt.',
  verliesUitleg: 'Na een verlies of nee',
  slapendUitleg: 'Na een slapende periode',
} as const

export const CONCURRENT_FILTERS = [
  { k: 'alle', t: 'Alle' }, { k: 'direct', t: 'Direct' }, { k: 'indirect', t: 'Indirect' }, { k: 'intern', t: 'Intern' }, { k: 'niets', t: 'Niets doen' },
] as const

export interface Kerncijfer { cijfer: string; tekst: string; sleutel: string }

interface StandLike {
  branches?: { horizon?: string | null }[]
  concurrenten?: { zoZegJeHet?: string | null; alsDeKlantZegt?: string | null }[]
  winpunten?: { actief: boolean }[]
  fasen?: unknown[]
  terugkomregels?: unknown[]
}

/** De vier kerncijfers in de kop: branches nu en later, concurrenten met antwoord, winpunten in fasen, terugkomregels. */
export function kerncijfers(stand: StandLike): Kerncijfer[] {
  const br = stand.branches ?? []
  const nu = br.filter((b) => b.horizon !== 'toekomstig').length
  const later = br.length - nu
  const conc = (stand.concurrenten ?? []).filter((c) => (c.zoZegJeHet ?? '').trim() || (c.alsDeKlantZegt ?? '').trim()).length
  const wp = (stand.winpunten ?? []).filter((w) => w.actief).length
  const fasen = (stand.fasen ?? []).length
  const regels = (stand.terugkomregels ?? []).length
  return [
    later ? { sleutel: 'branches', cijfer: `${nu} + ${later}`, tekst: 'branches nu en later' } : { sleutel: 'branches', cijfer: String(nu), tekst: nu === 1 ? 'branche' : 'branches' },
    { sleutel: 'concurrenten', cijfer: String(conc), tekst: conc === 1 ? 'concurrent met antwoord' : 'concurrenten met antwoord' },
    { sleutel: 'winpunten', cijfer: String(wp), tekst: `${wp === 1 ? 'winpunt' : 'winpunten'} in ${fasen} ${fasen === 1 ? 'fase' : 'fasen'}` },
    { sleutel: 'terugkomregels', cijfer: String(regels), tekst: regels === 1 ? 'terugkomregel' : 'terugkomregels' },
  ]
}

/** Voetregel van de kop: hoeveel onderdelen bevestigd zijn en de laatste bevestiging. */
export function bevestigdStand(status: Record<string, { status: string; bevestigdOp?: string | null }> | null | undefined): { aantal: number; totaal: number; tekst: string; laatst: string | null } {
  const lijst = Object.values(status ?? {})
  const aantal = lijst.filter((s) => s.status === 'bevestigd').length
  const laatst = lijst.map((s) => s.bevestigdOp).filter((d): d is string => !!d).sort().at(-1) ?? null
  return { aantal, totaal: lijst.length, tekst: `${aantal} van ${lijst.length} onderdelen bevestigd`, laatst }
}

/** Tijdlijn van de terugkomregels: positie in procenten op een as van minstens een jaar. */
export function tijdlijn(regels: { termijnDagen: number }[]): { max: number; positie: (dagen: number) => number; schaal: { dagen: number; tekst: string }[] } {
  const max = Math.max(365, ...regels.map((r) => r.termijnDagen || 0))
  const positie = (dagen: number) => Math.round((Math.min(Math.max(dagen, 0), max) / max) * 1000) / 10
  const schaal = [{ dagen: 0, tekst: 'direct' }, { dagen: 91, tekst: '3 mnd' }, { dagen: 182, tekst: '6 mnd' }, { dagen: 365, tekst: '1 jaar' }]
  if (max > 365) schaal.push({ dagen: max, tekst: `${Math.round(max / 30)} mnd` })
  return { max, positie, schaal }
}

/** Icoon bij het kanaal van een terugkomregel. */
export function kanaalIcoon(kanaal: string | null | undefined): string {
  const k = (kanaal ?? '').toLowerCase()
  if (k.includes('mail')) return 'Mail'
  if (k.includes('bezoek')) return 'MapPin'
  if (k.includes('linkedin')) return 'Linkedin'
  return 'Phone'
}

/** Voortgang van een ambitiedoel in procenten (0 tot 100), of null zonder stand. */
export function doelVoortgang(d: { stand: number | null; doel: number }): number | null {
  if (d.stand == null || !d.doel) return null
  return Math.max(0, Math.min(100, Math.round((d.stand / d.doel) * 100)))
}

/** Eenheid achter een getal: "aantal" toont niets, "procent" wordt " procent". */
export const eenheidTekst = (e: string | null | undefined) => (!e || e === 'aantal' ? '' : ` ${e}`)
