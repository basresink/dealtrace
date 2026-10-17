// Pure kern voor de managerpagina's /team, /coaching en /analyse: de verbale kop (wat zegt de stand),
// wie een coachingsgesprek nodig heeft en waarom, en wat er in een analysetabblad opvalt. Alles rekent
// met de cijfers die de server al geeft; hier wordt niets verzonnen.
import { NORMEN } from './team'

export const kortNaam = (naam: string) => naam.replace(/^Testgebruiker /, '')
export const voornaam = (naam: string) => kortNaam(naam).split(' ')[0] ?? naam
const nl = (n: number) => n.toLocaleString('nl-NL')
const meervoud = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

/** Een opsomming in gewone taal: "Eva", "Eva en Sanne", "Anouk, Bram en Eva". */
export function opsomming(namen: string[]): string {
  if (namen.length <= 1) return namen[0] ?? ''
  return `${namen.slice(0, -1).join(', ')} en ${namen[namen.length - 1]}`
}

// ── Team ────────────────────────────────────────────────────────────────────
export interface TeamRijLite { id: string; naam: string; tempo: { stand: 'op schema' | 'achter' | 'geen'; procent: number; norm: number }; achterstallig: number; kpi: { pogingen: number; gesprekken: number; afspraken: number; werkdagen: number } }

/** Titel van /team: "1 van de 2 accountmanagers ligt op tempo." of de stand zonder werkdag. */
export function teamKop(rijen: TeamRijLite[]): string {
  if (!rijen.length) return 'Er zit nog niemand in dit team.'
  const meetbaar = rijen.filter((r) => r.tempo.stand !== 'geen')
  if (!meetbaar.length) return 'In deze periode valt nog geen werkdag.'
  const op = meetbaar.filter((r) => r.tempo.stand === 'op schema').length
  if (op === meetbaar.length) return meetbaar.length === 1 ? `${voornaam(meetbaar[0]!.naam)} ligt op tempo.` : 'Iedereen ligt op tempo.'
  const achter = meetbaar.filter((r) => r.tempo.stand === 'achter').sort((a, b) => a.tempo.procent - b.tempo.procent).map((r) => voornaam(r.naam))
  if (!op) return meetbaar.length === 1 ? `${achter[0]} ligt achter op tempo.` : meetbaar.length <= 3 ? `${opsomming(achter)} liggen ${meetbaar.length === 2 ? 'allebei' : 'alle drie'} achter op tempo.` : `Niemand van de ${meetbaar.length} ligt op tempo.`
  if (achter.length === 1) return `${op} van de ${meetbaar.length} op tempo; ${achter[0]} ligt achter.`
  return `${op} van de ${meetbaar.length} ${op === 1 ? 'ligt' : 'liggen'} op tempo.`
}

/** Eén regel onder de titel: wie het verst achter ligt en wie de meeste achterstand heeft. */
export function teamLede(rijen: TeamRijLite[]): string {
  const achter = rijen.filter((r) => r.tempo.stand === 'achter').sort((a, b) => a.tempo.procent - b.tempo.procent)
  const delen: string[] = []
  if (achter.length) delen.push(`${voornaam(achter[0]!.naam)} haalt ${achter[0]!.tempo.procent} procent van de pogingennorm (${nl(achter[0]!.kpi.pogingen)} van ${nl(achter[0]!.tempo.norm)}).`)
  const taken = [...rijen].sort((a, b) => b.achterstallig - a.achterstallig)[0]
  if (taken && taken.achterstallig >= 5) delen.push(`${voornaam(taken.naam)} heeft ${meervoud(taken.achterstallig, 'taak', 'taken')} over tijd.`)
  return delen.join(' ') || 'Pogingen, gesprekken en afspraken per accountmanager tegen de norm van zijn werkplek. Klik op een getal om te zien wat erachter zit.'
}

// ── Coaching ────────────────────────────────────────────────────────────────
export type CoachingStand = 'nooit' | 'te-laat' | 'binnenkort' | 'op-ritme'
export interface CoachingLid {
  id: string; naam: string; niveau: string; werkplek: string; team?: { id: string; naam: string } | null
  laatsteGesprek: string | null; dagenSindsGesprek: number | null; openAfspraken: number
  afspraken?: { id: string; tekst: string; termijn: string | null; overTermijn: boolean }[]
  tempo?: { stand: 'op schema' | 'achter' | 'geen'; procent: number; norm: number }; pogingen?: number; afsprakenGemaakt?: number; achterstallig?: number
}

/** Ritme van het coachingsgesprek: elke 14 dagen (NORMEN.coachingDagen); vanaf dag 11 binnenkort. */
export function coachingStand(l: Pick<CoachingLid, 'dagenSindsGesprek'>): CoachingStand {
  if (l.dagenSindsGesprek == null) return 'nooit'
  if (l.dagenSindsGesprek > NORMEN.coachingDagen) return 'te-laat'
  if (l.dagenSindsGesprek >= NORMEN.coachingDagen - 3) return 'binnenkort'
  return 'op-ritme'
}
export const heeftGesprekNodig = (l: Pick<CoachingLid, 'dagenSindsGesprek'>) => ['nooit', 'te-laat'].includes(coachingStand(l))

/** Waarom deze persoon aandacht vraagt, uit de cijfers van de laatste twee weken; hoogstens drie redenen. */
export function coachingRedenen(l: CoachingLid): string[] {
  const uit: string[] = []
  const stand = coachingStand(l)
  if (stand === 'nooit') uit.push('Nog nooit een coachingsgesprek')
  else if (stand === 'te-laat') uit.push(`Laatste gesprek ${l.dagenSindsGesprek} dagen geleden`)
  if (l.tempo?.stand === 'achter') uit.push(`Tempo ${l.tempo.procent} procent van de norm`)
  if ((l.achterstallig ?? 0) >= 5) uit.push(`${l.achterstallig} taken over tijd`)
  const laat = (l.afspraken ?? []).filter((a) => a.overTermijn).length
  if (laat) uit.push(`${meervoud(laat, 'afspraak', 'afspraken')} over de termijn`)
  return uit.slice(0, 3)
}

/** Volgorde op /coaching: eerst wie nooit of te lang niet sprak, dan wie het verst achter ligt. */
export function sorteerCoaching<T extends CoachingLid>(leden: T[]): T[] {
  const rang: Record<CoachingStand, number> = { nooit: 0, 'te-laat': 1, binnenkort: 2, 'op-ritme': 3 }
  return [...leden].sort((a, b) => rang[coachingStand(a)] - rang[coachingStand(b)] || (a.tempo?.procent ?? 999) - (b.tempo?.procent ?? 999) || kortNaam(a.naam).localeCompare(kortNaam(b.naam)))
}

/** Titel van /coaching: "3 van de 5 accountmanagers wachten op een coachingsgesprek." */
export function coachingKop(leden: CoachingLid[]): string {
  if (!leden.length) return 'Je hebt nog geen accountmanagers om te coachen.'
  const nodig = leden.filter(heeftGesprekNodig)
  if (!nodig.length) return 'Iedereen is de afgelopen twee weken gecoacht.'
  if (nodig.length === leden.length) return leden.length === 1 ? `${voornaam(leden[0]!.naam)} wacht op een coachingsgesprek.` : `Alle ${leden.length} accountmanagers wachten op een coachingsgesprek.`
  return `${nodig.length} van de ${leden.length} accountmanagers ${nodig.length === 1 ? 'wacht' : 'wachten'} op een coachingsgesprek.`
}

export function coachingLede(leden: CoachingLid[]): string {
  const open = leden.reduce((s, l) => s + l.openAfspraken, 0)
  const laat = leden.reduce((s, l) => s + (l.afspraken ?? []).filter((a) => a.overTermijn).length, 0)
  const basis = 'Eén gesprek per accountmanager per twee weken.'
  if (!open) return `${basis} Er staan geen afspraken uit eerdere gesprekken open.`
  return `${basis} ${meervoud(open, 'afspraak', 'afspraken')} uit eerdere gesprekken ${open === 1 ? 'staat' : 'staan'} open${laat ? `, waarvan ${laat} over de termijn` : ''}.`
}

// ── Analyse ─────────────────────────────────────────────────────────────────
export interface AnalyseKolom { sleutel: string; label: string; getal?: boolean }
export interface AnalyseTabel { titel: string; kolommen: AnalyseKolom[]; rijen: Record<string, unknown>[] }
export interface AnalyseRegel { label: string; waarde: string; meta?: string }
export interface AnalyseTegel { sleutel: string; waarde: string; label: string; voet?: string; rood?: boolean; titel: string; regels: AnalyseRegel[] }
export interface AnalyseBeeld { titel: string; lede: string; tegels: AnalyseTegel[]; opvallend: string[] }

export const KANAAL_LABEL: Record<string, string> = { gebeld: 'Bellen', mail: 'Mail', bericht: 'WhatsApp', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', bezoek: 'Bezoek', sms: 'SMS', kaart: 'Kaartje' }
const getal = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^-?\d+([.,]\d+)?$/.test(v) ? Number(v.replace(',', '.')) : null)
const som = (rijen: Record<string, unknown>[], k: string) => rijen.reduce((s, r) => s + (getal(r[k]) ?? 0), 0)
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null)
const pctTekst = (n: number | null) => (n == null ? '-' : `${n}%`)

const LEDE: Record<string, string> = {
  funnel: 'Per fase van de prospectreis hoeveel accounts er waren, hoeveel doorstroomden en hoe lang dat duurde.',
  activiteit: 'Pogingen, gesprekken en afspraken per accountmanager en kanaal, en bij welke poging de afspraak ontstaat.',
  campagnes: 'Wat elke campagne opleverde: hoeveel accounts, hoeveel bereikt en hoeveel afspraken.',
  scripts: 'Gesprekken en afspraken per belscript in de belblokken. Onder de 30 gesprekken is een vergelijking nog niet eerlijk.',
  regels: 'Wat de regels en agents deden: taken, inzichten, wat je ermee deed en wat het kostte.',
  reizen: 'Per reisversie hoeveel accounts tot een afspraak kwamen. Onder de 20 accounts is een vergelijking nog niet eerlijk.',
  bronnen: 'Waar je leads vandaan komen en hoeveel er tot een afspraak of overdracht kwamen.',
  prospectmix: 'De afgesproken mix van koude, warme, referral- en winbackgesprekken tegen wat het team werkelijk deed.',
}

function tegel(sleutel: string, waarde: string | number, label: string, titel: string, regels: AnalyseRegel[], extra: Partial<AnalyseTegel> = {}): AnalyseTegel {
  return { sleutel, waarde: typeof waarde === 'number' ? nl(waarde) : waarde, label, titel, regels, ...extra }
}

/** Kop, tegels en wat opvalt voor één analysetabblad, uit precies de tabellen die de server gaf. */
export function analyseBeeld(tab: string, tabellen: AnalyseTabel[], melding?: string | null): AnalyseBeeld {
  const lede = LEDE[tab] ?? ''
  const t0 = tabellen[0]
  if (!t0 || !t0.rijen.length) return { titel: 'Nog niets om te analyseren in deze periode.', lede, tegels: [], opvallend: [] }
  const r0 = t0.rijen

  if (tab === 'funnel') {
    const rij = (label: string) => r0.find((r) => String(r.label).toLowerCase() === label)
    const lijst = (k: string, eenheid: string): AnalyseRegel[] => r0.map((r) => ({ label: String(r.label), waarde: `${r[k] === '' || r[k] == null ? '-' : nl(getal(r[k]) ?? 0)}${r[k] === '' || r[k] == null ? '' : eenheid}`, meta: `${nl(getal(r.aantal) ?? 0)} accounts · ${nl(getal(r.doorgestroomd) ?? 0)} door · ${nl(getal(r.uitgevallen) ?? 0)} uitgevallen` }))
    const metConversie = r0.filter((r) => getal(r.conversie) != null && (getal(r.aantal) ?? 0) > 0)
    const stok = [...metConversie].sort((a, b) => getal(a.conversie)! - getal(b.conversie)!)[0]
    const uitval = [...r0].sort((a, b) => (getal(b.uitgevallen) ?? 0) - (getal(a.uitgevallen) ?? 0))[0]
    const traag = [...r0].filter((r) => getal(r.doorlooptijd) != null).sort((a, b) => getal(b.doorlooptijd)! - getal(a.doorlooptijd)!)[0]
    const gepland = rij('afspraak gepland')
    const over = rij('overgedragen') ?? r0[r0.length - 1]
    const verloren = tabellen[1]?.rijen ?? []
    const opvallend: string[] = []
    if (stok) opvallend.push(`Het stokpunt zit in de fase ${String(stok.label).toLowerCase()}: daar stroomt ${stok.conversie} procent door naar de volgende fase.`)
    if (uitval && (getal(uitval.uitgevallen) ?? 0) > 0) opvallend.push(`De meeste uitval zit in ${String(uitval.label).toLowerCase()}: ${meervoud(getal(uitval.uitgevallen)!, 'account', 'accounts')}.`)
    if (traag) opvallend.push(`${traag.label} duurt het langst: gemiddeld ${String(traag.doorlooptijd).replace('.', ',')} dagen.`)
    if (verloren.length) { const v = [...verloren].sort((a, b) => (getal(b.n) ?? 0) - (getal(a.n) ?? 0))[0]!; opvallend.push(`Het vaakst verloren aan ${String(v.concurrent).toLowerCase()}: ${meervoud(som(verloren.filter((x) => x.concurrent === v.concurrent), 'n'), 'account', 'accounts')}.`) }
    return {
      titel: melding || 'De funnel van je team in deze periode.', lede, opvallend,
      tegels: [
        tegel('instroom', getal(r0[0]!.aantal) ?? 0, `In ${String(r0[0]!.label).toLowerCase()}`, 'Accounts per fase', lijst('aantal', ''), { voet: `${nl(getal(r0[0]!.doorgestroomd) ?? 0)} door naar de volgende fase` }),
        ...(gepland ? [tegel('gepland', getal(gepland.aantal) ?? 0, 'Afspraak gepland', 'Doorgestroomd per fase', lijst('doorgestroomd', ''), { voet: `${nl(getal(gepland.doorgestroomd) ?? 0)} door naar de volgende fase` })] : []),
        ...(over ? [tegel('over', getal(over.aantal) ?? 0, String(over.label), 'Uitgevallen per fase', lijst('uitgevallen', ''), { voet: `${nl(som(r0, 'uitgevallen'))} uitgevallen onderweg` })] : []),
        ...(stok ? [tegel('stok', `${stok.conversie}%`, `Stokpunt: ${String(stok.label).toLowerCase()}`, 'Conversie per fase', lijst('conversie', '%'), { rood: true, voet: 'laagste doorstroom naar de volgende fase' })] : []),
      ],
    }
  }

  if (tab === 'activiteit') {
    const personen = new Map<string, { pogingen: number; gesprekken: number; afspraken: number }>()
    for (const r of r0) { const p = personen.get(String(r.persoon)) ?? { pogingen: 0, gesprekken: 0, afspraken: 0 }; p.pogingen += getal(r.pogingen) ?? 0; p.gesprekken += getal(r.gesprekken) ?? 0; p.afspraken += getal(r.afspraken) ?? 0; personen.set(String(r.persoon), p) }
    const per = [...personen.entries()].map(([naam, p]) => ({ naam, ...p, conversie: pct(p.afspraken, p.gesprekken) }))
    const regels = (k: 'pogingen' | 'gesprekken' | 'afspraken' | 'conversie'): AnalyseRegel[] => [...per].sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1)).map((p) => ({ label: p.naam, waarde: k === 'conversie' ? pctTekst(p.conversie) : nl(p[k]), meta: `${nl(p.pogingen)} pogingen · ${nl(p.gesprekken)} gesprekken · ${nl(p.afspraken)} afspraken` }))
    const P = som(r0, 'pogingen'); const G = som(r0, 'gesprekken'); const A = som(r0, 'afspraken')
    const opvallend: string[] = []
    const vergelijkbaar = per.filter((p) => p.gesprekken >= 10 && p.conversie != null)
    if (vergelijkbaar.length >= 2) {
      const s = [...vergelijkbaar].sort((a, b) => b.conversie! - a.conversie!)
      opvallend.push(`${voornaam(s[0]!.naam)} maakt van de meeste gesprekken een afspraak (${s[0]!.conversie} procent), ${voornaam(s[s.length - 1]!.naam)} van de minste (${s[s.length - 1]!.conversie} procent).`)
    }
    const kanalen = new Map<string, { p: number; a: number }>()
    for (const r of r0) { const k = kanalen.get(String(r.kanaal)) ?? { p: 0, a: 0 }; k.p += getal(r.pogingen) ?? 0; k.a += getal(r.afspraken) ?? 0; kanalen.set(String(r.kanaal), k) }
    const leeg = [...kanalen.entries()].filter(([, k]) => k.p >= 20 && !k.a).map(([k]) => KANAAL_LABEL[k] ?? k)
    if (leeg.length) opvallend.push(`${opsomming(leeg)} ${leeg.length === 1 ? 'leverde' : 'leverden'} veel pogingen maar geen afspraak op.`)
    const bij = tabellen[1]?.rijen ?? []
    const totBij = som(bij, 'afspraken')
    if (totBij) { const top = [...bij].sort((a, b) => (getal(b.afspraken) ?? 0) - (getal(a.afspraken) ?? 0))[0]!; const laat = som(bij.filter((r) => ['4', '5', '6 of later'].includes(String(r.poging))), 'afspraken'); opvallend.push(`De meeste afspraken ontstaan bij poging ${top.poging} (${top.afspraken} van ${totBij}); ${laat} ${laat === 1 ? 'kwam' : 'kwamen'} pas na drie pogingen.`) }
    return {
      titel: A ? `${meervoud(A, 'afspraak', 'afspraken')} uit ${meervoud(G, 'gesprek', 'gesprekken')} en ${nl(P)} pogingen.` : `${nl(P)} pogingen en nog geen afspraak.`, lede, opvallend,
      tegels: [
        tegel('pogingen', P, 'Pogingen', 'Pogingen per accountmanager', regels('pogingen')),
        tegel('gesprekken', G, 'Gesprekken', 'Gesprekken per accountmanager', regels('gesprekken')),
        tegel('afspraken', A, 'Afspraken', 'Afspraken per accountmanager', regels('afspraken')),
        tegel('conversie', pctTekst(pct(A, G)), 'Gesprek naar afspraak', 'Gesprek naar afspraak per accountmanager', regels('conversie'), { rood: (pct(A, G) ?? 100) < NORMEN.gesprekNaarAfspraak * 100, voet: `norm ${NORMEN.gesprekNaarAfspraak * 100}%` }),
      ],
    }
  }

  // De andere tabbladen: de eerste kolom is de naam van de rij, de getallen tellen op.
  const naamK = t0.kolommen.find((k) => !k.getal)?.sleutel ?? t0.kolommen[0]!.sleutel
  const getalK = t0.kolommen.filter((k) => k.getal && !/procent|dagen/i.test(k.label)).slice(0, 4)
  const tegels = getalK.map((k) => tegel(k.sleutel, som(r0, k.sleutel), k.label, `${k.label} per ${t0.kolommen.find((x) => x.sleutel === naamK)?.label.toLowerCase() ?? 'rij'}`,
    [...r0].sort((a, b) => (getal(b[k.sleutel]) ?? 0) - (getal(a[k.sleutel]) ?? 0)).map((r) => ({ label: String(r[naamK] ?? '-'), waarde: nl(getal(r[k.sleutel]) ?? 0), meta: t0.kolommen.filter((x) => x.sleutel !== naamK && x.sleutel !== k.sleutel && r[x.sleutel] !== '' && r[x.sleutel] != null).slice(0, 3).map((x) => `${x.label}: ${r[x.sleutel]}`).join(' · ') }))))
  const opvallend: string[] = []
  let titel = `${meervoud(r0.length, 'regel', 'regels')} in ${t0.titel.toLowerCase()}.`
  if (tab === 'campagnes') {
    const A = som(r0, 'afspraken')
    titel = `${meervoud(r0.length, 'campagne', 'campagnes')} ${r0.length === 1 ? 'leverde' : 'leverden'} ${meervoud(A, 'afspraak', 'afspraken')} op.`
    const met = r0.filter((r) => getal(r.conversie) != null && (getal(r.accounts) ?? 0) >= 5).sort((a, b) => getal(b.conversie)! - getal(a.conversie)!)
    if (met.length >= 2) opvallend.push(`${met[0]!.naam} zet het best om (${met[0]!.conversie} procent), ${met[met.length - 1]!.naam} het slechtst (${met[met.length - 1]!.conversie} procent).`)
  } else if (tab === 'scripts') {
    const G = som(r0, 'gesprekken'); const A = som(r0, 'afspraken')
    titel = `${meervoud(G, 'gesprek', 'gesprekken')} in belblokken, ${meervoud(A, 'afspraak', 'afspraken')}.`
    const zonder = r0.find((r) => r.script === 'Zonder script')
    if (zonder && (getal(zonder.gesprekken) ?? 0) > 0) opvallend.push(`${meervoud(getal(zonder.gesprekken)!, 'gesprek', 'gesprekken')} ${getal(zonder.gesprekken) === 1 ? 'ging' : 'gingen'} zonder belscript. Die tellen niet mee in een vergelijking.`)
    if (r0.some((r) => r.conversie === 'Te weinig om te vergelijken')) opvallend.push('Nog niet elk script heeft 30 gesprekken; wacht met conclusies.')
  } else if (tab === 'regels') {
    const T = som(r0, 'taken'); const I = som(tabellen[1]?.rijen ?? [], 'inzichten'); const O = som(tabellen[1]?.rijen ?? [], 'omgezet'); const W = som(tabellen[1]?.rijen ?? [], 'afgewezen')
    titel = `Regels maakten ${meervoud(T, 'taak', 'taken')} en ${meervoud(I, 'inzicht', 'inzichten')}.`
    if (I && !O && !W) opvallend.push(`Van de ${meervoud(I, 'inzicht', 'inzichten')} is er nog geen enkele omgezet of afgewezen.`)
    else if (I) opvallend.push(`${O} van de ${I} inzichten ${O === 1 ? 'werd' : 'werden'} omgezet, ${W} afgewezen.`)
    const top = [...r0].sort((a, b) => (getal(b.taken) ?? 0) - (getal(a.taken) ?? 0))[0]
    if (top) opvallend.push(`${top.regel} maakt de meeste taken (${top.taken}); daarvan ${top.afgerond} afgerond.`)
    const credits = som(tabellen[3]?.rijen ?? [], 'credits')
    if (credits) tegels.push(tegel('credits', credits, 'Credits van agents', 'Credits per agent', [...(tabellen[3]?.rijen ?? [])].sort((a, b) => (getal(b.credits) ?? 0) - (getal(a.credits) ?? 0)).map((r) => ({ label: String(r.agent), waarde: nl(getal(r.credits) ?? 0), meta: `${r.uitgevoerd} uitgevoerd · ${r.geblokkeerd} tegengehouden` }))))
  } else if (tab === 'reizen') {
    const top = [...r0].sort((a, b) => (getal(b.accounts) ?? 0) - (getal(a.accounts) ?? 0))[0]!
    titel = getal(top.conversie) != null ? `${top.naam} brengt ${top.conversie} procent van de accounts tot een afspraak.` : `${top.naam} heeft nog te weinig accounts om te vergelijken.`
    if (r0.length === 1) opvallend.push('Er is één actieve reisversie; een vergelijking volgt zodra er een tweede versie loopt.')
  } else if (tab === 'bronnen') {
    const L = som(r0, 'leads'); const O = som(r0, 'overgenomen')
    titel = `${meervoud(L, 'lead', 'leads')} uit ${meervoud(r0.length, 'bron', 'bronnen')}, ${O} overgenomen.`
    if (melding) opvallend.push(melding)
    if (L && !som(r0, 'afspraken')) opvallend.push('Nog geen enkele lead uit deze periode kwam tot een eerste afspraak.')
  } else if (tab === 'prospectmix') {
    const af = r0.filter((r) => r.voorstel)
    titel = af.length ? `${af.length} van de ${r0.length} accountmanagers ${af.length === 1 ? 'wijkt' : 'wijken'} af van de afgesproken mix.` : 'Iedereen zit dicht bij de afgesproken mix.'
    if (af.length) opvallend.push(`Te weinig warme gesprekken bij ${opsomming(af.map((r) => voornaam(String(r.persoon))))}. Voorstel: ${String(af[0]!.voorstel).toLowerCase()}.`)
  }
  return { titel, lede, tegels, opvallend: opvallend.slice(0, 4) }
}
