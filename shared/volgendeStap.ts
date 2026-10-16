// Volgende beste stap (F2): per account één concrete stap met de reden erbij, plus twee alternatieven. Een vaste,
// uitlegbare formule op bestaande data (geen AI): open taken, inzichten jonger dan 30 dagen, het hercontactritme en
// de terugkomregel, fase en fase-norm, bereikbaarheid uit belpogingen per uur, de klasse uit de accountmatrix en een
// lopende opvolgreeks. Daarna toetst de Bewaker (afkoeling, wachtend, bel-me-niet, afmelding en het frequentieplafond).
// "Niets doen, wacht op de reeks" kan ook de uitkomst zijn. Puur: `nu` gaat mee.
import { nlMoment, telWerkdagen, type WerkdagInstelling } from './datum'
import { magBenaderen, type Kanaal, type NeeGegevens } from './nbStatus'

export type StapSoort = 'bellen' | 'mail' | 'linkedin' | 'bezoek' | 'taak' | 'wachten'
export const STAP_SOORTEN: StapSoort[] = ['bellen', 'mail', 'linkedin', 'bezoek', 'taak', 'wachten']
export const STAP_SOORT_LABEL: Record<StapSoort, string> = { bellen: 'Bellen', mail: 'Mail', linkedin: 'LinkedIn', bezoek: 'Bezoek', taak: 'Taak', wachten: 'Wachten' }
export const NIET_NU_REDENEN = ['al-gedaan', 'klopt-niet', 'later'] as const
export type NietNuReden = typeof NIET_NU_REDENEN[number]
export const NIET_NU_LABEL: Record<NietNuReden, string> = { 'al-gedaan': 'Al gedaan', 'klopt-niet': 'Klopt niet', later: 'Later' }
/** Hoe lang een weggeklikte stap wegblijft, in werkdagen. */
export const NIET_NU_DAGEN: Record<NietNuReden, number> = { 'al-gedaan': 5, 'klopt-niet': 20, later: 2 }

export interface Factor { label: string; punten: number; bron: string }
export interface VolgContact { id: string; naam: string; rol?: string | null; belMeNiet?: boolean; afgemeld?: boolean; consentMail?: string | null }
export interface VolgTaak { id: string; titel: string; actionType: string; dueDate: string | null; priority: string; contactId: string | null; ritmePoging?: { n: number; van: number } | null; reeksId?: string | null }
export interface VolgInzicht { id: string; titel: string; relevantie: number; op: string; contactId: string | null; heeftTaak?: boolean }
export interface Belpoging { contactId: string | null; op: string; opgenomen: boolean }
export interface VolgReeks { id: string; naam: string; status: string; contactId?: string | null; volgende: { kanaal: string; titel: string; geplandOp: string } | null }
export interface VolgAccount {
  id: string
  naam: string
  nbStatus: string
  data?: { nee?: NeeGegevens | null; wachtendTot?: string | null } | null
  /** Code uit de accountmatrix (A, B, C of D), of null. */
  klasse: string | null
  fase: { label: string; dagen: number | null; norm: number | null; eind?: boolean } | null
  ritme: { actief: boolean; naam?: string | null; stap: number; van: number; kanaal: string | null; volgendeOp: string | null } | null
  terugOp: string | null
  terugkom?: { aanpak?: string | null; kanaal?: string | null } | null
}
export interface VolgInvoer {
  nu: Date
  account: VolgAccount
  contacten: VolgContact[]
  /** Op de contactkaart: de stap gaat over dit contact binnen zijn account. */
  focusContactId?: string | null
  taken: VolgTaak[]
  inzichten: VolgInzicht[]
  belpogingen: Belpoging[]
  /** Contactmomenten van een mens op het account (ISO), voor het frequentieplafond. */
  contactmomenten: string[]
  reeks: VolgReeks | null
  plafond?: { werkdagen: number; maxBerichten: number }
  /** Hoe vaak deze gebruiker een stap van deze soort "klopt niet" noemde (laatste 90 dagen): de leerlus. */
  leerlus?: Partial<Record<StapSoort, number>>
  /** Sleutels die met Niet nu tijdelijk weg zijn. */
  onderdrukt?: string[]
  inst?: WerkdagInstelling
}
export interface Oordeel { mag: boolean; tekst: string }
export interface Kandidaat {
  sleutel: string
  soort: StapSoort
  kanaal: Kanaal | null
  titel: string
  contactId: string | null
  contactNaam: string | null
  taakId: string | null
  inzichtId: string | null
  factoren: Factor[]
  score: number
  bewaker: Oordeel
}
export interface Alternatief extends Kandidaat { waarom: string }
export interface VolgUitkomst { stap: Kandidaat; alternatieven: Alternatief[]; herkomst: string[]; bereikbaarheid: Bereik | null }
export interface Bereik { contactId: string; uur: number; opgenomen: number; totaal: number }

const DAG = 864e5
const KANAAL_VAN: Partial<Record<StapSoort, Kanaal>> = { bellen: 'bellen', mail: 'mail', linkedin: 'linkedin', bezoek: 'bezoek' }
const SOORT_VAN_ACTIE: Record<string, StapSoort> = { bellen: 'bellen', mailen: 'mail', linkedin: 'linkedin', bezoek: 'bezoek', bericht: 'mail' }
const SOORT_VAN_KANAAL: Record<string, StapSoort> = { bellen: 'bellen', mail: 'mail', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'mail' }
const PRIO_PUNTEN: Record<string, number> = { urgent: 20, hoog: 12, middel: 5, laag: 0 }
const KLASSE_PUNTEN: Record<string, number> = { A: 10, B: 6, C: 3 }
const ROL_VOLGORDE: Record<string, number> = { beslisser: 0, champion: 1, beinvloeder: 2 }
const datumKort = (iso: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(iso))
const dagVan = (iso: string) => nlMoment(new Date(iso)).datum
const uur = (n: number) => `${String(n).padStart(2, '0')}:00`
const voornaam = (n: string | null | undefined) => (n ?? '').split(/\s+/)[0] || 'het contact'

/** Het uur waarop een contact het vaakst opneemt (minstens twee pogingen in dat uur). */
export function besteUur(pogingen: Belpoging[], contactId: string): Bereik | null {
  const per = new Map<number, { opgenomen: number; totaal: number }>()
  for (const p of pogingen.filter((x) => x.contactId === contactId)) {
    const u = nlMoment(new Date(p.op)).uur
    const r = per.get(u) ?? { opgenomen: 0, totaal: 0 }
    r.totaal++
    if (p.opgenomen) r.opgenomen++
    per.set(u, r)
  }
  let beste: Bereik | null = null
  for (const [u, r] of per) {
    if (r.totaal < 2 || !r.opgenomen) continue
    const score = r.opgenomen / r.totaal
    if (!beste || score > beste.opgenomen / beste.totaal || (score === beste.opgenomen / beste.totaal && r.totaal > beste.totaal)) beste = { contactId, uur: u, ...r }
  }
  return beste
}

/** Het frequentieplafond: hoeveel contactmomenten in de laatste werkdagen, en mag er nog een bij? */
export function plafondStand(momenten: string[], plafond: { werkdagen: number; maxBerichten: number }, nu: Date, inst: WerkdagInstelling = {}) {
  const vandaag = nlMoment(nu).datum
  const binnen = momenten.filter((m) => { const d = dagVan(m); return d <= vandaag && telWerkdagen(d, vandaag, inst) <= plafond.werkdagen }).sort()
  return { aantal: binnen.length, vol: binnen.length >= plafond.maxBerichten, laatste: binnen.at(-1) ?? null }
}

/** De weging: kandidaten verzamelen, punten per factor, de Bewaker en de leerlus. */
export function volgendeStap(inv: VolgInvoer): VolgUitkomst {
  const { nu, account: a } = inv
  const inst = inv.inst ?? {}
  const vandaag = nlMoment(nu).datum
  const focus = inv.focusContactId ?? null
  const contacten = inv.contacten
  const naamVan = (id: string | null) => contacten.find((c) => c.id === id)?.naam ?? null
  const doel = (focus ? contacten.find((c) => c.id === focus) : null)
    ?? [...contacten].sort((x, y) => (ROL_VOLGORDE[x.rol ?? ''] ?? 9) - (ROL_VOLGORDE[y.rol ?? ''] ?? 9))[0] ?? null
  const voorFocus = (contactId: string | null) => !focus || contactId === focus
  const plafond = inv.plafond ?? { werkdagen: 3, maxBerichten: 1 }
  const ps = plafondStand(inv.contactmomenten, plafond, nu, inst)
  const reeksLoopt = inv.reeks?.status === 'loopt' && voorFocus(inv.reeks.contactId ?? null) ? inv.reeks : null
  const kandidaten: Omit<Kandidaat, 'score' | 'bewaker'>[] = []
  const nieuw = (k: Partial<Omit<Kandidaat, 'score' | 'bewaker'>> & Pick<Kandidaat, 'sleutel' | 'soort' | 'titel'>) => {
    const contactId = k.contactId ?? null
    kandidaten.push({ kanaal: KANAAL_VAN[k.soort] ?? null, contactId, contactNaam: naamVan(contactId), taakId: null, inzichtId: null, factoren: [], ...k })
  }

  // 1. Open taken.
  const openPogingen = new Set<number>()
  for (const t of inv.taken.filter((x) => voorFocus(x.contactId))) {
    const f: Factor[] = []
    if (t.dueDate) {
      const d = dagVan(t.dueDate)
      const over = Math.floor((Date.parse(`${vandaag}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / DAG)
      if (over > 0) f.push({ label: `Taak staat ${over} ${over === 1 ? 'dag' : 'dagen'} over tijd`, punten: 20 + Math.min(10, over * 2), bron: 'Taken' })
      else if (over === 0) f.push({ label: 'Taak staat voor vandaag', punten: 15, bron: 'Taken' })
      else if (over >= -3) f.push({ label: `Taak staat voor ${datumKort(t.dueDate)}`, punten: 5, bron: 'Taken' })
    } else f.push({ label: 'Taak zonder datum', punten: 3, bron: 'Taken' })
    if (PRIO_PUNTEN[t.priority]) f.push({ label: `Prioriteit ${t.priority}`, punten: PRIO_PUNTEN[t.priority]!, bron: 'Taken' })
    if (t.ritmePoging) { openPogingen.add(t.ritmePoging.n); f.push({ label: `Hercontactritme: poging ${t.ritmePoging.n} van ${t.ritmePoging.van}`, punten: 10, bron: 'Ritme' }) }
    if (t.reeksId) f.push({ label: 'Stap uit de lopende opvolgreeks', punten: 10, bron: 'Opvolgreeks' })
    nieuw({ sleutel: `taak:${t.id}`, soort: SOORT_VAN_ACTIE[t.actionType] ?? 'taak', titel: t.titel, contactId: t.contactId ?? (SOORT_VAN_ACTIE[t.actionType] ? doel?.id ?? null : null), taakId: t.id, factoren: f })
  }

  // 2. Inzichten jonger dan 30 dagen zonder taak: een verse aanleiding om te bellen.
  for (const i of inv.inzichten.filter((x) => !x.heeftTaak && voorFocus(x.contactId))) {
    const dagen = Math.max(0, Math.floor((nu.getTime() - Date.parse(i.op)) / DAG))
    if (dagen >= 30) continue
    const punten = Math.max(5, Math.round(40 * (Math.min(100, i.relevantie) / 100) * (1 - dagen / 30)))
    const c = i.contactId ?? doel?.id ?? null
    nieuw({ sleutel: `inzicht:${i.id}`, soort: 'bellen', titel: `Bel ${voornaam(naamVan(c))} over: ${i.titel}`, contactId: c, inzichtId: i.id,
      factoren: [{ label: `Verse aanleiding: ${i.titel}, ${dagen === 0 ? 'van vandaag' : `${dagen} ${dagen === 1 ? 'dag' : 'dagen'} oud`}`, punten, bron: `Inzicht ${new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(i.op)).replace('.', '')}` }] })
  }

  // 3. Hercontactritme: de volgende poging als er nog geen taak voor staat.
  const r = a.ritme
  if (r?.actief && r.volgendeOp && r.kanaal && !openPogingen.has(r.stap)) {
    const d = dagVan(r.volgendeOp)
    const over = Math.floor((Date.parse(`${vandaag}T12:00:00Z`) - Date.parse(`${d}T12:00:00Z`)) / DAG)
    if (over >= -1) {
      const soort = SOORT_VAN_KANAAL[r.kanaal] ?? 'bellen'
      const label = over > 0 ? `${over} ${over === 1 ? 'dag' : 'dagen'} over tijd` : over === 0 ? 'staat voor vandaag' : 'staat voor morgen'
      nieuw({ sleutel: `ritme:${r.stap}`, soort, titel: `${STAP_SOORT_LABEL[soort]}: poging ${r.stap} van ${r.van} naar ${voornaam(doel?.naam)}`, contactId: doel?.id ?? null,
        factoren: [{ label: `Ritme${r.naam ? ` ${r.naam}` : ''}: poging ${r.stap} ${label}`, punten: over > 0 ? 20 + Math.min(10, over * 2) : over === 0 ? 15 : 8, bron: `Ritme${r.naam ? ` ${r.naam}` : ''}` }] })
    }
  }

  // 4. Terugkomregel: de terugkomdatum is bereikt.
  if (a.terugOp && a.terugOp <= vandaag) {
    const soort = SOORT_VAN_KANAAL[a.terugkom?.kanaal ?? 'bellen'] ?? 'bellen'
    nieuw({ sleutel: `terugkom:${a.terugOp}`, soort, titel: `${STAP_SOORT_LABEL[soort]}: terugkomen bij ${voornaam(doel?.naam)}${a.terugkom?.aanpak ? `, ${a.terugkom.aanpak.charAt(0).toLowerCase()}${a.terugkom.aanpak.slice(1)}` : ''}`, contactId: doel?.id ?? null,
      factoren: [{ label: `Terugkomdatum ${a.terugOp} is bereikt`, punten: 25, bron: 'Terugkomregel' }] })
  }

  // 5. Een lopende opvolgreeks: niets doen kan de beste stap zijn.
  if (reeksLoopt?.volgende) {
    const v = reeksLoopt.volgende
    const werk = v.kanaal === 'bellen' ? 'belt' : v.kanaal === 'mail' ? 'mailt' : v.kanaal === 'linkedin' ? 'zet LinkedIn klaar' : 'gaat terug naar het ritme'
    nieuw({ sleutel: `reeks:${reeksLoopt.id}`, soort: 'wachten', titel: `Niets doen: de opvolgreeks ${werk} ${datumKort(v.geplandOp)}`,
      factoren: [{ label: `Opvolgreeks ${reeksLoopt.naam} loopt; volgende stap ${datumKort(v.geplandOp)}`, punten: 45, bron: 'Opvolgreeks' }] })
  }

  // 6. Standaardkandidaten, zodat er altijd alternatieven zijn: elk kanaal naar het doelcontact.
  if (doel && !['overgedragen'].includes(a.nbStatus)) {
    for (const [soort, punten, label] of [['bellen', 6, 'Een gesprek brengt het snelst duidelijkheid'], ['mail', 4, 'Een mail met het winpunt kan het gesprek voorbereiden'], ['linkedin', 2, 'Verbonden zijn maakt het volgende contact warmer']] as const) {
      if (kandidaten.some((k) => k.soort === soort && k.contactId === doel.id)) continue
      const titel = soort === 'bellen' ? `Bel ${voornaam(doel.naam)}` : soort === 'mail' ? `Mail ${voornaam(doel.naam)} met het winpunt` : `LinkedIn-connectie met ${voornaam(doel.naam)}`
      nieuw({ sleutel: `std:${soort}:${doel.id}`, soort, titel, contactId: doel.id, factoren: [{ label, punten, bron: 'Kanaal' }] })
    }
  }

  // Gedeelde factoren voor contactstappen: klasse, fase-norm, bereikbaarheid, reeks en leerlus.
  const bereik = doel ? besteUur(inv.belpogingen, doel.id) : null
  const uitkomst: Kandidaat[] = []
  for (const k of kandidaten) {
    if (inv.onderdrukt?.includes(k.sleutel)) continue
    const f = [...k.factoren]
    const contactstap = !!KANAAL_VAN[k.soort]
    if (contactstap) {
      if (a.klasse && KLASSE_PUNTEN[a.klasse]) f.push({ label: `Klasse ${a.klasse} in de accountmatrix`, punten: KLASSE_PUNTEN[a.klasse]!, bron: 'Accountmatrix' })
      if (a.fase && !a.fase.eind && a.fase.norm != null && a.fase.dagen != null && a.fase.dagen > a.fase.norm) f.push({ label: `${a.fase.dagen} dagen in ${a.fase.label}, norm ${a.fase.norm}`, punten: 15, bron: 'Fase-norm' })
      const vanReeks = !!k.taakId && !!inv.taken.find((t) => t.id === k.taakId)?.reeksId
      if (reeksLoopt && !vanReeks) f.push({ label: 'Opvolgreeks loopt: een extra contact verstoort de reeks', punten: -20, bron: 'Opvolgreeks' })
      if (k.soort === 'bellen' && k.contactId) {
        const b = k.contactId === doel?.id ? bereik : besteUur(inv.belpogingen, k.contactId)
        const pogingen = inv.belpogingen.filter((p) => p.contactId === k.contactId)
        if (b) {
          f.push({ label: `${voornaam(naamVan(k.contactId))} nam ${b.opgenomen} van ${b.totaal} keer op tussen ${uur(b.uur)} en ${uur(b.uur + 1)}`, punten: Math.round(25 * b.opgenomen / b.totaal), bron: 'Belpogingen' })
          const later = nlMoment(nu).uur > b.uur
          k.titel = `${k.titel} ${later ? 'morgen' : 'vandaag'} tussen ${uur(b.uur)} en ${uur(b.uur + 1)}`
        } else if (pogingen.length >= 3 && !pogingen.some((p) => p.opgenomen)) f.push({ label: `${voornaam(naamVan(k.contactId))} nam 0 van ${pogingen.length} keer op`, punten: -10, bron: 'Belpogingen' })
      }
    }
    const n = inv.leerlus?.[k.soort] ?? 0
    const sub = f.reduce((s, x) => s + x.punten, 0)
    if (n > 0 && sub > 0) f.push({ label: `Leerlus: ${n} keer "klopt niet" bij ${STAP_SOORT_LABEL[k.soort].toLowerCase()}`, punten: -Math.round(sub * Math.min(0.5, 0.1 * n)), bron: 'Leerlus' })
    const score = Math.max(0, f.reduce((s, x) => s + x.punten, 0))
    uitkomst.push({ ...k, factoren: f, score, bewaker: oordeel(k, inv, ps, plafond) })
  }

  const toegestaan = uitkomst.filter((k) => k.bewaker.mag).sort((x, y) => y.score - x.score || x.sleutel.localeCompare(y.sleutel))
  const geblokkeerd = uitkomst.filter((k) => !k.bewaker.mag).sort((x, y) => y.score - x.score)
  let stap = toegestaan[0]
  if (!stap || stap.score <= 0) stap = wachtStap(inv, geblokkeerd[0], ps) ?? stap ?? wachtStap(inv, undefined, ps, true)!
  const rest = [...toegestaan.filter((k) => k !== stap && k.soort !== 'wachten'), ...geblokkeerd.filter((k) => k.score > 0)]
  const alternatieven: Alternatief[] = rest.slice(0, 2).map((k) => ({
    ...k,
    waarom: !k.bewaker.mag ? `De Bewaker houdt dit tegen: ${k.bewaker.tekst.replace(/^Tegengehouden: /, '')}` : k.score >= stap.score ? `Even sterk; ${k.factoren[0]?.label.charAt(0).toLowerCase()}${k.factoren[0]?.label.slice(1) ?? ''}` : `${stap.score - k.score} punten minder${k.factoren[0] ? `: ${k.factoren[0].label.charAt(0).toLowerCase()}${k.factoren[0].label.slice(1)}` : ''}`,
  }))
  const herkomst = [...new Set([...stap.factoren.map((x) => x.bron), 'Bewaker'])]
  return { stap, alternatieven, herkomst, bereikbaarheid: bereik }
}

/** Het oordeel van de Bewaker over één stap. */
function oordeel(k: Omit<Kandidaat, 'score' | 'bewaker'>, inv: VolgInvoer, ps: ReturnType<typeof plafondStand>, plafond: { werkdagen: number; maxBerichten: number }): Oordeel {
  if (!k.kanaal) return { mag: true, tekst: 'Mag: dit is geen contact met de prospect.' }
  const c = inv.contacten.find((x) => x.id === k.contactId)
  const b = magBenaderen({ nbStatus: inv.account.nbStatus, data: inv.account.data ?? {} }, k.kanaal, inv.nu, { belMeNiet: c?.belMeNiet })
  if (!b.mag) return { mag: false, tekst: `Tegengehouden: ${b.reden!.charAt(0).toLowerCase()}${b.reden!.slice(1)}.` }
  if (k.kanaal === 'mail' && c?.afgemeld) return { mag: false, tekst: 'Tegengehouden: dit contact meldde zich af voor mail.' }
  if (k.kanaal === 'mail' && c?.consentMail === 'nee') return { mag: false, tekst: 'Tegengehouden: geen consent voor e-mail.' }
  const regel = `plafond ${plafond.maxBerichten} per ${plafond.werkdagen} werkdagen`
  if (ps.vol) return { mag: false, tekst: `Tegengehouden: laatste contact was ${datumKort(ps.laatste!)} (${regel}).` }
  return { mag: true, tekst: `Mag: geen afkoeling, ${ps.aantal} ${ps.aantal === 1 ? 'contact' : 'contacten'} in de laatste ${plafond.werkdagen} werkdagen (${regel}).` }
}

/** Niets doen: wachten op de reeks, op de afkoeling of op het plafond. */
function wachtStap(inv: VolgInvoer, geblokkeerd: Kandidaat | undefined, ps: ReturnType<typeof plafondStand>, altijd = false): Kandidaat | null {
  const a = inv.account
  const basis = { kanaal: null, contactId: null, contactNaam: null, taakId: null, inzichtId: null, soort: 'wachten' as const }
  if (a.nbStatus === 'overgedragen') return { ...basis, sleutel: 'wachten:overgedragen', titel: 'Niets doen: het vervolg loopt in DealDrive of het CRM', factoren: [{ label: 'Het account is overgedragen', punten: 0, bron: 'Reis' }], score: 0, bewaker: { mag: true, tekst: 'Mag: niets doen raakt de prospect niet.' } }
  if (geblokkeerd) {
    const reden = geblokkeerd.bewaker.tekst.replace(/^Tegengehouden: /, '').replace(/\.$/, '')
    return { ...basis, sleutel: `wachten:${geblokkeerd.sleutel}`, titel: `Niets doen: ${reden}`, factoren: [{ label: `De sterkste stap (${geblokkeerd.titel}) mag nu niet`, punten: 0, bron: 'Bewaker' }], score: 0, bewaker: { mag: true, tekst: geblokkeerd.bewaker.tekst } }
  }
  if (!altijd) return null
  return { ...basis, sleutel: 'wachten:rust', titel: 'Niets doen: er is nu geen sterke aanleiding', factoren: [{ label: 'Geen open taken, verse inzichten of ritmepogingen', punten: 0, bron: 'Taken' }], score: 0, bewaker: { mag: true, tekst: ps.vol ? 'Het plafond is bereikt.' : 'Mag: niets doen raakt de prospect niet.' } }
}
