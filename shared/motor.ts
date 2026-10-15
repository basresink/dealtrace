// De motorrun zonder database (F15, 13.3). De server laadt alles, roept motorRun aan
// en schrijft het resultaat; zo is de hele run databasevrij te testen.
// Volgorde: campagne-afsluiter (P16), regels, planner (landing en capaciteit),
// belblokvuller (P10), automatisch voorbereiden (P18). Wat nog niet bestaat, staat
// als lege stap in het verslag.
import { nlMoment, nlTijdstip, voegWerkdagenToe, volgendWerkmoment, volgendeWerkdag, type WerkdagInstelling } from './datum'
import {
  ACTIESOORT_LABEL, cadansVerstreken, evaluateTrigger, regelLevertRuis, ruleTargetsAccount, vulSjabloon, waaromTekst,
  type MotorAccount, type Regel,
} from './regelPatronen'
import { bewaakTaken, type Tegengehouden } from './planner'
import { BELMATRIX_STANDAARD, CAPACITEIT_STANDAARD, geldendeCel, intervalDagen, type Matrix } from './ritmematrix'

export interface MotorGebruiker { id: string; naam: string; rol: string; werkplek: 'binnendienst' | 'buitendienst'; niveau: string; teamId: string | null; status?: string }

export interface NieuweTaak {
  regelId: string; onderwerp: string; accountId: string; ownerId: string; title: string; actionType: string; priority: string
  due: string; waarom: string; bewijs: string[]; herkomst: 'regel' | 'ritme' | 'startactiviteit'; geschoven?: boolean
  poging?: { n: number; van: number; kanaal?: string | null }
}
export interface NieuwInzicht {
  regelId: string | null; onderwerp: string; accountId: string | null; ownerId: string; title: string; type: string; relevantie: number
  bron: 'intern' | 'extern'; waarom: string; bewijs: string[]; voorstel?: { title: string; actionType: string; priority: string } | null
}
export interface InzichtUpdate { regelId: string; onderwerp: string; waarom: string; bewijs: string[] }

export interface StartActiviteit { faseId: string; naam: string; rol: 'binnendienst' | 'buitendienst' | 'alle'; actiesoort: string; termijnWerkdagen: number }

export interface MotorInvoer {
  nu: Date
  regels: Regel[]
  accounts: MotorAccount[]
  gebruikers: MotorGebruiker[]
  /** Laatste keer dat een regel vuurde per `${regelId}|${onderwerp}` (taken en inzichten, elke status). */
  laatst: Map<string, string>
  /** Open taken en inzichten per `${regelId}|${onderwerp}`. */
  open: Set<string>
  /** Open taken per gebruiker per dag (YYYY-MM-DD), voor het plafond. */
  bezetting: Map<string, number>
  /** Accounts met een lopend ritme (hercontact of matrix) van een andere regel. */
  ritmeVan: Map<string, string>
  belmatrix?: Matrix
  capaciteit?: { binnendienst: number; buitendienst: number }
  werkdagen?: WerkdagInstelling
  /** Regiodagen per gebruiker (P14): taken voor de buitendienst landen op de regiodag van het account. */
  regiodagen?: { gebiedId: string; gebruikerId: string; datum: string }[]
  startactiviteiten?: Map<string, StartActiviteit[]>
  /** Leerlus: per regel de afloop van voorstellen van de laatste 30 dagen. */
  regelLog?: Map<string, { status: string; op: string }[]>
  beheerderId?: string | null
  /** Alleen deze accounts (gebeurtenisrun). */
  accountIds?: string[]
  aiToegestaan?: boolean
}

export interface MotorUitvoer {
  taken: NieuweTaak[]
  inzichten: NieuwInzicht[]
  updates: InzichtUpdate[]
  geraakt: number
  geschoven: { ownerId: string; aantal: number; naar: string }[]
  stappen: { stap: string; status: 'gedaan' | 'overgeslagen'; toelichting?: string }[]
  waarschuwingen: string[]
  /** Wat de Bewaker tegenhield (geen taak, wel een regel in agent_runs). */
  tegengehouden: Tegengehouden[]
}

const RITME_PATRONEN = new Set(['ritme', 'hercontact-vervolg'])
const CONTACT = new Set(['bellen', 'bezoek'])
const CONTACT_ACTIE = new Set(['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht'])
const ACTIE_VAN_KANAAL: Record<string, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'bericht' }

/** De eigenaar van werk voor een account: accounteigenaar, anders een salesmanager van het team, anders de beheerder. */
export function eigenaarVoor(a: MotorAccount, regel: Pick<Regel, 'data'> | null, gebruikers: MotorGebruiker[], beheerderId?: string | null): string | null {
  const actief = gebruikers.filter((g) => g.status !== 'gearchiveerd')
  const rol = regel?.data.gevolg.uitvoerderrol
  if (rol === 'salesmanager') {
    const sm = actief.find((g) => g.rol === 'salesmanager' && (!a.ownerTeamId || g.teamId === a.ownerTeamId)) ?? actief.find((g) => g.rol === 'salesmanager')
    if (sm) return sm.id
  }
  if (a.ownerId && actief.some((g) => g.id === a.ownerId)) return a.ownerId
  return actief.find((g) => g.rol === 'salesmanager' && g.teamId === a.ownerTeamId)?.id ?? actief.find((g) => g.rol === 'salesmanager')?.id ?? beheerderId ?? null
}

/**
 * Landing: binnendienst op het eerstvolgende passende belblok, buitendienst op de
 * regiodag van het account. Zonder belblokken en regiodagen het volgende werkmoment,
 * en nooit voor de termijn.
 */
export function landingsmoment(
  taak: { termijnWerkdagen: number; gebiedId?: string | null },
  gebruiker: Pick<MotorGebruiker, 'werkplek'>,
  blokken: { start: string }[],
  regiodagen: { gebiedId: string; datum: string }[],
  nu: Date,
  inst: WerkdagInstelling = {},
): Date {
  const basis = volgendWerkmoment(nu, inst)
  if (gebruiker.werkplek === 'binnendienst') {
    const blok = blokken.map((b) => new Date(b.start)).filter((d) => d.getTime() >= nu.getTime()).sort((x, y) => x.getTime() - y.getTime())[0]
    if (blok) return blok
  } else {
    const vandaag = nlMoment(nu).datum
    const dag = regiodagen.filter((r) => r.gebiedId === taak.gebiedId && (r.datum > vandaag || (r.datum === vandaag && nlMoment(nu).uur < 9))).sort((x, y) => x.datum.localeCompare(y.datum))[0]
    if (dag) return nlTijdstip(dag.datum, 9)
  }
  return basis
}

/** De uiterste datum volgens de termijn ("binnen 3 werkdagen"); de vervaldatum zelf is de landing. */
export function uitersteDatum(termijnWerkdagen: number, nu: Date, inst: WerkdagInstelling = {}): string {
  return voegWerkdagenToe(nlMoment(nu).datum, Math.max(0, termijnWerkdagen), inst)
}

/**
 * Dagplafond per uitvoerder (standaard binnendienst 40 beltaken, buitendienst 6 bezoeken):
 * wat erboven valt schuift naar de volgende werkdag.
 */
export function verdeelCapaciteit<T extends { ownerId: string; due: string; actionType: string }>(
  taken: T[], gebruikers: Pick<MotorGebruiker, 'id' | 'werkplek'>[], plafonds = CAPACITEIT_STANDAARD,
  bezetting: Map<string, number> = new Map(), inst: WerkdagInstelling = {},
): { geland: T[]; geschoven: T[] } {
  const telling = new Map(bezetting)
  const geland: T[] = []
  const geschoven: T[] = []
  for (const t of taken) {
    const g = gebruikers.find((x) => x.id === t.ownerId)
    const telt = g && CONTACT.has(t.actionType) && (g.werkplek === 'binnendienst' ? t.actionType === 'bellen' : t.actionType === 'bezoek')
    if (!telt) { geland.push(t); continue }
    const plafond = g!.werkplek === 'binnendienst' ? plafonds.binnendienst : plafonds.buitendienst
    let dag = nlMoment(new Date(t.due)).datum
    let verschoven = false
    for (let i = 0; i < 60 && (telling.get(`${t.ownerId}|${dag}`) ?? 0) >= plafond; i++) { dag = volgendeWerkdag(dag, inst); verschoven = true }
    telling.set(`${t.ownerId}|${dag}`, (telling.get(`${t.ownerId}|${dag}`) ?? 0) + 1)
    if (verschoven) { const n = { ...t, due: nlTijdstip(dag, 9).toISOString(), geschoven: true }; geschoven.push(n); geland.push(n) } else geland.push(t)
  }
  return { geland, geschoven }
}

const RELEVANTIE: Record<string, number> = { hoog: 85, middel: 65, laag: 45 }

export function motorRun(inv: MotorInvoer): MotorUitvoer {
  const { nu } = inv
  const waarschuwingen: string[] = []
  const taken: NieuweTaak[] = []
  const inzichten: NieuwInzicht[] = []
  const updates: InzichtUpdate[] = []
  const nieuwOpen = new Set<string>()
  const ritmeNu = new Map(inv.ritmeVan)
  let geraakt = 0
  const accounts = inv.accountIds ? inv.accounts.filter((a) => inv.accountIds!.includes(a.id)) : inv.accounts
  const gebruiker = new Map(inv.gebruikers.map((g) => [g.id, g]))
  const blokken: { start: string }[] = []
  const regiodagenVan = (owner: string | null | undefined) => (inv.regiodagen ?? []).filter((r) => r.gebruikerId === owner)

  const regels = [...inv.regels].filter((r) => r.actief && (r.motor === 'regel' || inv.aiToegestaan))
    .sort((a, b) => ['hoog', 'middel', 'laag'].indexOf(a.prioriteit) - ['hoog', 'middel', 'laag'].indexOf(b.prioriteit) || (a.code ?? a.naam).localeCompare(b.code ?? b.naam))

  for (const regel of regels) {
    for (const a of accounts) {
      if (!ruleTargetsAccount(regel, a, nu)) continue
      // Een lopend hercontactritme regelt de pogingen: geen losse contacttaken ernaast.
      if (a.ritme?.actief && regel.data.activiteit === 'taak' && CONTACT_ACTIE.has(regel.data.gevolg.actiesoort) && !RITME_PATRONEN.has(regel.data.trigger.patroon)) continue
      if (a.ritme?.actief && regel.data.trigger.patroon === 'ritme' && regel.data.activiteit === 'taak') continue
      // Ritme: een ingevulde matrix is de poort; 0 is bewust uit, niet ingesteld valt terug op de standaard (gat 8, 43).
      let cadans = regel.cadansDagen
      if (regel.data.trigger.patroon === 'ritme' && regel.data.trigger.parameters?.matrix !== false) {
        const cel = geldendeCel(inv.belmatrix, a.type, a.klasseCode ?? null, BELMATRIX_STANDAARD)
        const interval = intervalDagen(cel)
        if (!interval) continue
        cadans = interval
      }
      const u = evaluateTrigger(regel, a, nu)
      if (!u.vuurt) continue
      geraakt++
      const sleutel = u.sleutel ?? a.id
      const k = `${regel.id}|${sleutel}`
      if (inv.open.has(k) || nieuwOpen.has(k)) {
        // Open inzicht bijwerken zonder terug naar ongelezen.
        if (regel.data.activiteit === 'inzicht') updates.push({ regelId: regel.id, onderwerp: sleutel, waarom: waaromTekst(regel, u), bewijs: u.bewijs })
        continue
      }
      if (!cadansVerstreken(cadans, inv.laatst.get(k), nu)) continue
      // Nooit twee ritmes tegelijk op één account.
      if (RITME_PATRONEN.has(regel.data.trigger.patroon) && regel.data.activiteit === 'taak') {
        const ander = ritmeNu.get(a.id)
        // Het hercontactritme zelf ("hercontact") hoort bij de regel Hercontact-vervolg.
        const eigen = ander === regel.id || (ander === 'hercontact' && regel.data.trigger.patroon === 'hercontact-vervolg')
        if (ander && !eigen) continue
        if (!ander) ritmeNu.set(a.id, regel.id)
      }
      const owner = eigenaarVoor(a, regel, inv.gebruikers, inv.beheerderId)
      if (!owner) { waarschuwingen.push(`Geen eigenaar voor ${a.naam}`); continue }
      const titel = vulSjabloon(regel.data.gevolg.taaksjabloon || `${ACTIESOORT_LABEL[regel.data.gevolg.actiesoort] ?? 'Opvolgen'}: {account}`, { account: a.naam, contact: a.contactNaam })
      const waarom = waaromTekst(regel, u)
      // Een Beginner krijgt motorvoorstellen als inzicht ter goedkeuring, behalve ritmepogingen (F06).
      const alsInzicht = regel.data.activiteit === 'inzicht' || (gebruiker.get(owner)?.niveau === 'beginner' && !RITME_PATRONEN.has(regel.data.trigger.patroon))
      nieuwOpen.add(k)
      if (alsInzicht) {
        inzichten.push({
          regelId: regel.id, onderwerp: sleutel, accountId: a.id, ownerId: owner, title: titel, type: regel.data.gevolg.signaaltype || regel.data.trigger.patroon,
          relevantie: RELEVANTIE[regel.prioriteit] ?? 60, bron: regel.data.bron, waarom, bewijs: u.bewijs,
          voorstel: regel.data.gevolg.actiesoort !== 'geen' ? { title: titel, actionType: regel.data.gevolg.actiesoort, priority: regel.prioriteit } : null,
        })
      } else {
        const g = gebruiker.get(owner)
        const landing = landingsmoment({ termijnWerkdagen: regel.data.gevolg.termijnWerkdagen, gebiedId: a.gebiedId }, { werkplek: g?.werkplek ?? 'binnendienst' }, blokken, regiodagenVan(a.ownerId), nu, inv.werkdagen)
        const vervolg = regel.data.trigger.patroon === 'hercontact-vervolg' && a.ritme
        taken.push({
          regelId: regel.id, onderwerp: sleutel, accountId: a.id, ownerId: owner,
          title: vervolg ? `Poging ${a.ritme!.poging}: ${a.naam}` : titel,
          actionType: vervolg ? ACTIE_VAN_KANAAL[a.ritme!.kanaal ?? 'bellen'] ?? 'bellen' : regel.data.gevolg.actiesoort, priority: regel.prioriteit,
          due: landing.toISOString(), waarom, bewijs: u.bewijs,
          herkomst: RITME_PATRONEN.has(regel.data.trigger.patroon) ? 'ritme' : 'regel',
          ...(vervolg ? { poging: { n: a.ritme!.poging ?? 1, van: a.ritme!.van ?? 1, kanaal: a.ritme!.kanaal } } : {}),
        })
      }
    }
  }

  // Startactiviteiten bij "fase betreden" (F05): één taak per account, fase en activiteit.
  if (inv.startactiviteiten) {
    for (const a of accounts) {
      for (const ev of (a.gebeurtenissen ?? []).filter((g) => g.naarFaseId)) {
        for (const s of inv.startactiviteiten.get(`${a.reisId}|${ev.naarFaseId}`) ?? []) {
          const owner = eigenaarVoor(a, null, inv.gebruikers, inv.beheerderId)
          const g = owner ? gebruiker.get(owner) : undefined
          if (!owner || (s.rol !== 'alle' && g?.werkplek !== s.rol)) continue
          // Pogingen tot een afspraak lopen via het hercontactritme.
          if (a.ritme?.actief && (s.actiesoort === 'bellen' || s.actiesoort === 'bezoek')) continue
          const sleutel = `${a.id}:${ev.id}:${s.naam}`
          const k = `start|${sleutel}`
          if (inv.open.has(k) || inv.laatst.has(k) || nieuwOpen.has(k)) continue
          nieuwOpen.add(k)
          const landing = landingsmoment({ termijnWerkdagen: s.termijnWerkdagen, gebiedId: a.gebiedId }, { werkplek: g?.werkplek ?? 'binnendienst' }, blokken, regiodagenVan(a.ownerId), nu, inv.werkdagen)
          const actionType = s.actiesoort === 'bellen' || s.actiesoort === 'bezoek' ? s.actiesoort : s.actiesoort === 'mail' ? 'mailen' : 'taak'
          taken.push({
            regelId: 'start', onderwerp: sleutel, accountId: a.id, ownerId: owner, title: `${s.naam}: ${a.naam}`, actionType, priority: 'middel',
            due: landing.toISOString(), waarom: `Startactiviteit bij het betreden van de fase.`, bewijs: [`${ev.gebeurtenis} ${ev.op.slice(0, 10)}`], herkomst: 'startactiviteit',
          })
        }
      }
    }
  }

  // Bewaker: elke geplande contacttaak vooraf getoetst (afkoeling, wachtend, bel-me-niet).
  const { toegestaan, tegengehouden } = bewaakTaken(taken, new Map(accounts.map((a) => [a.id, a])), nu)

  // Planner: capaciteit per uitvoerder per dag.
  const { geland, geschoven } = verdeelCapaciteit(toegestaan, inv.gebruikers, inv.capaciteit ?? CAPACITEIT_STANDAARD, inv.bezetting, inv.werkdagen)
  const perPersoon = new Map<string, { aantal: number; naar: string }>()
  for (const t of geschoven) {
    const p = perPersoon.get(t.ownerId) ?? { aantal: 0, naar: t.due }
    p.aantal++; if (t.due > p.naar) p.naar = t.due
    perPersoon.set(t.ownerId, p)
  }

  // Leerlus: onder 20 procent acceptatie krijgt de eigenaar van de regel een inzicht.
  if (inv.regelLog && !inv.accountIds) {
    for (const r of regels) {
      const l = regelLevertRuis(inv.regelLog.get(r.id) ?? [], nu)
      const k = `ruis|${r.id}`
      if (!l.ruis || inv.open.has(k)) continue
      const owner = r.eigenaarId ?? inv.beheerderId
      if (!owner) continue
      inzichten.push({ regelId: null, onderwerp: k, accountId: null, ownerId: owner, title: `Regel levert vooral ruis: ${r.naam}`, type: 'regel-ruis', relevantie: 70, bron: 'intern',
        waarom: `Van de laatste ${l.aantal} voorstellen werd ${Math.round(l.acceptatie * 100)} procent opgevolgd.`, bewijs: [r.code ?? r.id], voorstel: null })
    }
  }

  return {
    taken: geland, inzichten, updates, geraakt,
    geschoven: [...perPersoon].map(([ownerId, p]) => ({ ownerId, aantal: p.aantal, naar: p.naar })),
    stappen: [
      { stap: 'campagne-afsluiter', status: 'overgeslagen', toelichting: 'Alleen bij een geplande of handmatige run' },
      { stap: 'regels', status: 'gedaan', toelichting: `${regels.length} regels, ${taken.length} taken, ${inzichten.length} inzichten` },
      { stap: 'bewaker', status: 'gedaan', toelichting: `${tegengehouden.length} tegengehouden` },
      { stap: 'planner', status: 'gedaan', toelichting: `${geschoven.length} taken doorgeschoven` },
      { stap: 'belblokvuller', status: 'overgeslagen', toelichting: 'Belblokken komen later' },
      { stap: 'automatisch voorbereiden', status: 'overgeslagen', toelichting: 'Briefings komen later' },
    ],
    waarschuwingen,
    tegengehouden,
  }
}
