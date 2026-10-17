// De funnel van de prospectreis en de overdracht (P17, F17). Alles puur: de server levert de
// reisgeschiedenis, de activiteiten en de context; deze functies rekenen. Geen deals, offertes of
// pipelinewaarde (B17, ADR-021).

export const FUNNEL_FASES = ['gevonden', 'dossier-compleet', 'gekwalificeerd', 'benaderd', 'in-gesprek', 'afspraak-gepland', 'afspraak-gehouden', 'overgedragen'] as const
export type FunnelFase = typeof FUNNEL_FASES[number]
export const FUNNEL_LABEL: Record<FunnelFase, string> = {
  gevonden: 'Gevonden', 'dossier-compleet': 'Dossier compleet', gekwalificeerd: 'Gekwalificeerd', benaderd: 'Benaderd',
  'in-gesprek': 'In gesprek', 'afspraak-gepland': 'Afspraak gepland', 'afspraak-gehouden': 'Afspraak gehouden', overgedragen: 'Overgedragen',
}
export const FUNNEL_HOOFDFASE: Record<FunnelFase, 'Vinden' | 'Bewerken' | 'Verbinden'> = {
  gevonden: 'Vinden', 'dossier-compleet': 'Vinden', gekwalificeerd: 'Bewerken', benaderd: 'Bewerken', 'in-gesprek': 'Bewerken',
  'afspraak-gepland': 'Verbinden', 'afspraak-gehouden': 'Verbinden', overgedragen: 'Verbinden',
}
const VOLGORDE = new Map<string, number>(FUNNEL_FASES.map((f, i) => [f, i]))

/** Normen per fase: conversie naar de volgende fase (procent) en doorlooptijd (dagen). Voorstel uit P17. */
export type Normen = Partial<Record<FunnelFase, { conversie?: number | null; doorlooptijd?: number | null }>>
export const NORMEN_STANDAARD: Normen = {
  gevonden: { conversie: 80, doorlooptijd: 5 }, 'dossier-compleet': { conversie: 60, doorlooptijd: 5 }, gekwalificeerd: { conversie: 90, doorlooptijd: 10 },
  benaderd: { conversie: 30, doorlooptijd: 21 }, 'in-gesprek': { conversie: 35, doorlooptijd: 21 }, 'afspraak-gepland': { conversie: 85, doorlooptijd: null },
  'afspraak-gehouden': { conversie: 60, doorlooptijd: 2 },
}
export function leesNormen(v: unknown): Normen {
  const uit: Normen = {}
  for (const f of FUNNEL_FASES) {
    const s = NORMEN_STANDAARD[f]; const e = (v as any)?.[f]
    if (!s && !e) continue
    uit[f] = { conversie: typeof e?.conversie === 'number' ? e.conversie : s?.conversie ?? null, doorlooptijd: typeof e?.doorlooptijd === 'number' ? e.doorlooptijd : s?.doorlooptijd ?? null }
  }
  return uit
}

export interface GeschRij { accountId: string; naarFaseId: string | null; gebeurtenis: string; op: string; reden?: string | null }
export interface FaseStand {
  faseId: FunnelFase; binnengekomen: number; doorgestroomd: number; uitgevallen: number; aanwezig: number
  uitval: Record<string, number>; doorlooptijdSom: number; doorlooptijdAantal: number
  accounts: { binnen: string[]; uit: { accountId: string; reden: string }[]; aanwezig: string[] }
}

const UIT_LABEL: Record<string, string> = { verloren: 'Nee', geparkeerd: 'Geparkeerd', 'afspraak-niet-verschenen': 'No-show' }
const dagenTussen = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 864e5

/**
 * De stand per fase over een periode. Een account telt in elke fase die het in de periode bereikte
 * (één keer per fase, de eerste keer); een overgeslagen fase telt niet. Per fase klopt altijd:
 * binnengekomen = doorgestroomd + uitgevallen + nog aanwezig. De eerste wissel na het binnenkomen
 * beslist: naar een latere funnelfase is doorgestroomd, anders uitgevallen (nee, geparkeerd, no-show).
 * Met uitTot telt de uitstroom tot een later moment mee (de afgeleide stand per dag).
 */
export function funnelStand(rijen: GeschRij[], periode: { van: string; tot: string; uitTot?: string }): FaseStand[] {
  const per = new Map<string, GeschRij[]>()
  for (const r of rijen) if (r.naarFaseId) per.set(r.accountId, [...(per.get(r.accountId) ?? []), r])
  const stand = new Map<FunnelFase, FaseStand>(FUNNEL_FASES.map((f) => [f, { faseId: f, binnengekomen: 0, doorgestroomd: 0, uitgevallen: 0, aanwezig: 0, uitval: {}, doorlooptijdSom: 0, doorlooptijdAantal: 0, accounts: { binnen: [], uit: [], aanwezig: [] } }]))
  for (const [accountId, lijst] of per) {
    const tl = [...lijst].filter((r) => r.op <= (periode.uitTot ?? periode.tot)).sort((a, b) => a.op.localeCompare(b.op))
    const gehad = new Set<string>()
    for (let i = 0; i < tl.length; i++) {
      const r = tl[i]!
      const f = r.naarFaseId as FunnelFase
      if (!VOLGORDE.has(f) || gehad.has(f) || r.op < periode.van || r.op > periode.tot) continue
      gehad.add(f)
      const s = stand.get(f)!
      s.binnengekomen++; s.accounts.binnen.push(accountId)
      const volgende = tl.slice(i + 1).find((x) => x.naarFaseId !== f)
      if (!volgende) { s.aanwezig++; s.accounts.aanwezig.push(accountId); continue }
      s.doorlooptijdSom += dagenTussen(r.op, volgende.op); s.doorlooptijdAantal++
      if ((VOLGORDE.get(volgende.naarFaseId!) ?? -1) > VOLGORDE.get(f)!) { s.doorgestroomd++; continue }
      const reden = volgende.reden?.trim() || UIT_LABEL[volgende.gebeurtenis] || UIT_LABEL[volgende.naarFaseId!] || 'Terug in de reis'
      s.uitgevallen++; s.uitval[reden] = (s.uitval[reden] ?? 0) + 1; s.accounts.uit.push({ accountId, reden })
    }
  }
  return FUNNEL_FASES.map((f) => stand.get(f)!)
}

/** Conversie in procent; zonder noemer null ("n.v.t."). */
export const conversie = (van: number, naar: number): number | null => (van > 0 ? Math.round((naar / van) * 100) : null)
/** Gemiddelde doorlooptijd in kalenderdagen van wie de fase verliet; wie er nog staat, telt niet mee. */
export const doorlooptijd = (s: Pick<FaseStand, 'doorlooptijdSom' | 'doorlooptijdAantal'>): number | null => (s.doorlooptijdAantal ? Math.round((s.doorlooptijdSom / s.doorlooptijdAantal) * 10) / 10 : null)

/** De fase met de grootste achterstand op de conversienorm; bij gelijke achterstand de eerste. Alles op of boven de norm: null. */
export function stokpunt(stand: FaseStand[], normen: Normen): { faseId: FunnelFase; naarFaseId: FunnelFase; conversie: number; norm: number; achterstand: number } | null {
  let beste: ReturnType<typeof stokpunt> = null
  for (let i = 0; i < stand.length - 1; i++) {
    const s = stand[i]!
    const norm = normen[s.faseId]?.conversie
    const c = conversie(s.binnengekomen, s.doorgestroomd)
    if (norm == null || c == null) continue
    const achter = norm - c
    if (achter > 0 && (!beste || achter > beste.achterstand)) beste = { faseId: s.faseId, naarFaseId: stand[i + 1]!.faseId, conversie: c, norm, achterstand: achter }
  }
  return beste
}

/** De kopzin en de stokregel. */
export function kopTekst(stand: FaseStand[], stok: ReturnType<typeof stokpunt>): { titel: string; stok: string | null } {
  const totaal = new Set(stand.flatMap((s) => s.accounts.binnen)).size
  const afspraak = stand.find((s) => s.faseId === 'afspraak-gepland')!.binnengekomen
  return {
    titel: totaal ? `Van ${totaal} ${totaal === 1 ? 'prospect kwam' : 'prospects kwamen'} er ${afspraak} tot een eerste afspraak.` : 'Nog geen accounts in deze periode.',
    stok: stok ? `Hier stokt het: van ${FUNNEL_LABEL[stok.faseId]} naar ${FUNNEL_LABEL[stok.naarFaseId]} ${stok.conversie} procent, norm ${stok.norm} procent.` : null,
  }
}

/** Bij welke poging de eerste afspraak ontstaat. Pogingen per account in tijdsvolgorde; een afspraak zonder poging ervoor telt als 1. */
export function pogingTotAfspraak(pogingen: { accountId: string; op: string; uitkomst?: string | null }[]): Record<'1' | '2' | '3' | '4' | '5' | 'later', number> {
  const uit = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, later: 0 } as Record<'1' | '2' | '3' | '4' | '5' | 'later', number>
  const per = new Map<string, typeof pogingen>()
  for (const p of pogingen) per.set(p.accountId, [...(per.get(p.accountId) ?? []), p])
  for (const lijst of per.values()) {
    const tl = [...lijst].sort((a, b) => a.op.localeCompare(b.op))
    const i = tl.findIndex((p) => p.uitkomst === 'afspraak')
    if (i < 0) continue
    const n = i + 1
    uit[n > 5 ? 'later' : (String(n) as '1')]++
  }
  return uit
}

export type EersteAfspraakBak = '1' | '2' | '3' | '4+'
export interface EersteAfspraakPoging { accounts: number; gemiddeld: number | null; verdeling: Record<EersteAfspraakBak, number>; meest: EersteAfspraakBak | null }
/**
 * Bij welke poging de eerste afspraak kwam, per account: de pogingen (activiteiten en afgeronde taken)
 * op volgorde tot en met de eerste met uitkomst afspraak. Gemiddelde op één decimaal en de verdeling
 * bij poging 1, 2, 3 of 4 en later. Accounts zonder afspraak tellen niet mee. `vanaf` beperkt tot
 * eerste afspraken vanaf dat moment (de pogingen ervoor tellen wel).
 */
export function eersteAfspraakPoging(pogingen: { accountId: string; op: string; uitkomst?: string | null }[], vanaf?: string): EersteAfspraakPoging {
  const verdeling: Record<EersteAfspraakBak, number> = { 1: 0, 2: 0, 3: 0, '4+': 0 }
  const per = new Map<string, typeof pogingen>()
  for (const p of pogingen) per.set(p.accountId, [...(per.get(p.accountId) ?? []), p])
  let som = 0; let n = 0
  for (const lijst of per.values()) {
    const tl = [...lijst].sort((a, b) => a.op.localeCompare(b.op))
    const i = tl.findIndex((p) => p.uitkomst === 'afspraak')
    if (i < 0 || (vanaf && tl[i]!.op < vanaf)) continue
    som += i + 1; n++
    verdeling[i + 1 >= 4 ? '4+' : (String(i + 1) as '1')]++
  }
  const top = (Object.entries(verdeling) as [EersteAfspraakBak, number][]).reduce<[EersteAfspraakBak, number] | null>((m, x) => (x[1] > (m?.[1] ?? 0) ? x : m), null)
  return { accounts: n, gemiddeld: n ? Math.round((som / n) * 10) / 10 : null, verdeling, meest: top?.[0] ?? null }
}

/** De top drie uitvalredenen van een fase, meest eerst; gelijk aantal op naam. */
export const uitvalPerReden = (s: Pick<FaseStand, 'uitval'>, n = 3) => Object.entries(s.uitval).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n).map(([reden, aantal]) => ({ reden, aantal }))

// ── Overdracht ──────────────────────────────────────────────────────────────

export type OverdrachtNaar = 'dealdrive' | 'crm' | 'collega'
/** Mag dit account worden overgedragen? Alleen na een gehouden eerste afspraak met een uitkomst met vervolg. */
export function magOverdragen(account: { nbStatus: string }, afspraak: { eerste: boolean; status: string; overdragen: boolean } | null, lopend: boolean): { ja: true } | { ja: false; reden: string } {
  if (lopend || account.nbStatus === 'overgedragen') return { ja: false, reden: 'Er loopt al een overdracht voor dit account' }
  if (!afspraak || !afspraak.eerste) return { ja: false, reden: 'Er is nog geen eerste afspraak' }
  if (afspraak.status !== 'afgerond') return { ja: false, reden: 'De eerste afspraak is nog niet gehouden en afgerond' }
  if (!afspraak.overdragen) return { ja: false, reden: 'De eerste afspraak had geen vervolg' }
  return { ja: true }
}

export interface PakketContext {
  overdrachtId: string; op: string; door: { email: string; naam: string }; nieuweEigenaar?: string | null
  account: { id: string; naam: string; kvk?: string | null; website?: string | null; telefoon?: string | null; klasse?: string | null; branche?: string | null; plaats?: string | null; postcode?: string | null; huidigeLeverancier?: string | null; eigenVelden?: Record<string, unknown> }
  contacten: { id: string; voornaam?: string | null; achternaam: string; functie?: string | null; email?: string | null; telefoon?: string | null; mobiel?: string | null; rol?: string | null; prive?: string[] }[]
  afspraak: { id: string; datum: string; soort: string; vorm?: string | null; uitkomst: string; verslag?: string | null }
  vervolgstap: { omschrijving: string; datum?: string | null; soort?: string | null }
  reis?: { naam: string; geschiedenis: { fase: string; op: string }[]; pogingenTotAfspraak?: number | null; bron?: string | null }
  winpunt?: string | null; briefing: string; alsNieuweKansBijKlant?: boolean
}
/**
 * Het pakket voor POST /overdrachten (docs/api/dealdrive-koppeling.md, hoofdstuk 3). Minstens één
 * contact; privégegevens (velden in `prive`) gaan nooit mee; geen deals of offertes, alleen een
 * dealVoorstel. Contacten op id gesorteerd, zodat de hash vastligt.
 */
export function overdrachtPakket(c: PakketContext): Record<string, unknown> {
  if (!c.contacten.length) throw new Error('Minstens één contact is verplicht voor een overdracht')
  if (!c.vervolgstap.omschrijving.trim()) throw new Error('Beschrijf de vervolgstap')
  const contacten = [...c.contacten].sort((a, b) => a.id.localeCompare(b.id)).map((k) => zonderLeeg({
    dealtraceId: k.id, voornaam: k.voornaam ?? '', achternaam: k.achternaam, functie: k.functie,
    email: k.prive?.includes('email') ? null : k.email ?? null, telefoon: k.prive?.includes('telefoon') ? null : k.telefoon ?? null, mobiel: k.prive?.includes('mobiel') ? null : k.mobiel ?? null,
    rol: ROLLEN.includes(k.rol as any) ? k.rol : 'onbekend', beslisser: k.rol === 'beslisser',
  }, ['email', 'telefoon', 'mobiel'], ['voornaam']))
  return zonderLeeg({
    overdrachtId: c.overdrachtId, overgedragenOp: c.op, overgedragenDoor: zonderLeeg(c.door), nieuweEigenaar: c.nieuweEigenaar ? { email: c.nieuweEigenaar } : null,
    alsNieuweKansBijKlant: c.alsNieuweKansBijKlant ? true : null,
    account: zonderLeeg({
      dealtraceId: c.account.id, naam: c.account.naam, kvkNummer: c.account.kvk && /^[0-9]{8}$/.test(c.account.kvk) ? c.account.kvk : null, branche: c.account.branche, klasse: c.account.klasse,
      website: c.account.website, telefoon: c.account.telefoon, adres: c.account.plaats || c.account.postcode ? zonderLeeg({ postcode: c.account.postcode, plaats: c.account.plaats, land: 'NL' }) : null,
      huidigeLeverancier: c.account.huidigeLeverancier ?? null, eigenVelden: c.account.eigenVelden ?? {},
    }, ['huidigeLeverancier']),
    contacten,
    eersteAfspraak: zonderLeeg({ dealtraceId: c.afspraak.id, datum: c.afspraak.datum, soort: c.afspraak.soort, vorm: ['bezoek', 'online', 'telefoon'].includes(c.afspraak.vorm ?? '') ? c.afspraak.vorm : null, uitkomst: c.afspraak.uitkomst, verslag: c.afspraak.verslag }),
    vervolgstap: zonderLeeg({ omschrijving: c.vervolgstap.omschrijving.trim(), datum: c.vervolgstap.datum?.slice(0, 10), soort: VERVOLG_SOORTEN.includes(c.vervolgstap.soort as any) ? c.vervolgstap.soort : null }),
    verkoopverhaal: zonderLeeg({ branche: c.account.branche, winpuntIngezet: c.winpunt }),
    briefing: c.briefing,
    reis: c.reis ? zonderLeeg({ naam: c.reis.naam, geschiedenis: c.reis.geschiedenis.map((g) => ({ fase: g.fase, op: g.op.slice(0, 10) })), pogingenTotAfspraak: c.reis.pogingenTotAfspraak, bron: c.reis.bron }) : null,
    dealVoorstel: { titel: `Eerste afspraak ${c.account.naam}`, fase: 'behoefte', verwachteWaarde: null },
  })
}
const ROLLEN = ['beslisser', 'beinvloeder', 'champion', 'gebruiker', 'onbekend'] as const
const VERVOLG_SOORTEN = ['bellen', 'mail', 'bezoek', 'afspraak', 'taak'] as const
/** Lege velden vallen weg (het contract kent ze dan niet); alleen de genoemde velden mogen null zijn. */
function zonderLeeg<T extends Record<string, unknown>>(o: T, magNull: string[] = [], altijd: string[] = []): Record<string, unknown> {
  return Object.fromEntries(Object.entries(o).filter(([k, v]) => altijd.includes(k) || (v !== undefined && v !== '' && (v !== null || magNull.includes(k)))))
}

/** De briefing "Overdracht" (F11): berekende tekst, geen AI. Markdown. */
export function overdrachtBriefing(c: Pick<PakketContext, 'account' | 'contacten' | 'afspraak' | 'vervolgstap' | 'winpunt'> & { geschiedenis?: { fase: string; op: string }[] }): string {
  const datum = (iso: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
  const wie = [c.account.branche, c.account.plaats].filter(Boolean).join(', ')
  const regels = [
    `## Overdracht ${c.account.naam}`, '',
    `**Wie**: ${c.account.naam}${wie ? ` (${wie})` : ''}${c.account.klasse ? `, klasse ${c.account.klasse}` : ''}.`,
    `**Contacten**: ${c.contacten.map((k) => `${[k.voornaam, k.achternaam].filter(Boolean).join(' ')}${k.functie ? `, ${k.functie}` : ''}${k.rol === 'beslisser' ? ' (beslisser)' : ''}`).join('; ') || 'geen'}.`,
    `**Eerste afspraak**: ${c.afspraak.soort} op ${datum(c.afspraak.datum)}.`,
    c.afspraak.verslag ? `**Verslag**: ${c.afspraak.verslag}` : '**Verslag**: niet vastgelegd.',
    `**Vervolgstap**: ${c.vervolgstap.omschrijving}${c.vervolgstap.datum ? ` (${datum(c.vervolgstap.datum)})` : ''}.`,
  ]
  if (c.winpunt) regels.push(`**Winpunt ingezet**: ${c.winpunt}.`)
  if (c.geschiedenis?.length) regels.push('', '**Reis**:', ...c.geschiedenis.slice(-5).map((g) => `- ${g.fase} op ${datum(g.op)}`))
  return regels.join('\n')
}

export const NAAR_LABEL: Record<OverdrachtNaar, string> = { dealdrive: 'DealDrive', crm: 'het CRM', collega: 'een collega' }
/** Schema van herhalen na een mislukte verzending (contract, hoofdstuk 2): 1, 5 en 30 minuten, 2 en 12 uur. */
export const OPNIEUW_MINUTEN = [1, 5, 30, 120, 720] as const
export function volgendePoging(pogingen: number, nu: Date): Date | null {
  const m = OPNIEUW_MINUTEN[pogingen - 1]
  return m == null ? null : new Date(nu.getTime() + m * 60_000)
}
