// Taken (F06): één afrondfunctie voor elk pad (gat 11), ordenen, horizon (gat 39),
// uitstellen en een taak uit een inzicht. Puur; `nu` gaat mee.
import { nlMoment, nlTijdstip, voegWerkdagenToe, volgendeWerkdag, type WerkdagInstelling } from './datum'
import { UITKOMST_LABEL, verwerkUitkomst, type Ritme, type RitmeStand, type UitkomstCode, type UitkomstResultaat } from './hercontact'

/**
 * Geldige actietypes van een taak. `bericht` is WhatsApp (de waarde bleef, het label werd WhatsApp); `sms` is SMS.
 * `bezoek` blijft geldig voor bestaande bezoektaken en de motor, maar staat niet meer in de taakkiezer: een
 * bezoek plan je met + Afspraak.
 */
export const ACTIETYPES = ['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht', 'sms', 'taak'] as const
export const ACTIE_LABEL: Record<string, string> = { bellen: 'BEL', mailen: 'MAIL', linkedin: 'LINKEDIN', bezoek: 'BEZOEK', bericht: 'WHATSAPP', sms: 'SMS', taak: 'TAAK', geen: 'TAAK' }
export const CONTACT_ACTIES = new Set(['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht', 'sms'])
export const HERKOMST_LABEL: Record<string, string> = { regel: 'Uit regel', inzicht: 'Uit inzicht', campagne: 'Campagne', ritme: 'Ritme', handmatig: 'Handmatig', startactiviteit: 'Uit regel', agent: 'Agent', reeks: 'Opvolgreeks', volgen: 'Volgende stap', dagplanner: 'Dagplanner' }
export const AFWIJS_REDENEN = ['Niet relevant', 'Al bekend', 'Verkeerd account', 'Te oud'] as const
export const PRIO_VOLGORDE: Record<string, number> = { urgent: 0, hoog: 1, middel: 2, laag: 3 }
/** Prioriteit van een taak: vier niveaus zoals DealDrive. Regels kennen er drie; urgent zet je zelf. */
export const PRIORITEITEN = ['laag', 'middel', 'hoog', 'urgent'] as const
export type Prioriteit = (typeof PRIORITEITEN)[number]
export const PRIO_LABEL: Record<string, string> = { laag: 'Laag', middel: 'Middel', hoog: 'Hoog', urgent: 'Urgent' }
/** Klasse van de gekleurde stip (laag grijs, middel geel, hoog oranje, urgent rood). */
export const PRIO_STIP: Record<string, string> = { laag: 'prio-stip--low', middel: 'prio-stip--medium', hoog: 'prio-stip--high', urgent: 'prio-stip--urgent' }
export const isPrioriteit = (p: unknown): p is Prioriteit => typeof p === 'string' && (PRIORITEITEN as readonly string[]).includes(p)
/** Hoog en urgent krijgen in rijen het rode icoon en tellen als risico als ze over tijd zijn. */
export const isDringend = (p: string | null | undefined) => p === 'hoog' || p === 'urgent'
/**
 * Type van een taak als knop met icoon (de taakkiezer): Te doen, Bellen, Mailen, WhatsApp, SMS en LinkedIn.
 * WhatsApp heeft de waarde `bericht`. Bezoek staat er niet in: een bezoek plan je met + Afspraak.
 */
export const TAAK_TYPES: { id: string; label: string; icoon: string }[] = [
  { id: 'taak', label: 'Te doen', icoon: 'ListTodo' }, { id: 'bellen', label: 'Bellen', icoon: 'Phone' }, { id: 'mailen', label: 'Mailen', icoon: 'Mail' },
  { id: 'bericht', label: 'WhatsApp', icoon: 'MessageCircle' }, { id: 'sms', label: 'SMS', icoon: 'MessageSquare' }, { id: 'linkedin', label: 'LinkedIn', icoon: 'Linkedin' },
]
/** Bestaande bezoektaken (motor, /bezoeken, Onderweg) tonen nog als Bezoek. */
export const BEZOEK_TYPE = { id: 'bezoek', label: 'Bezoek', icoon: 'MapPin' }
/** Het type van een taak voor weergave; onbekend wordt Te doen. */
export const taakTypeVan = (id: string | null | undefined) => (id === 'bezoek' ? BEZOEK_TYPE : TAAK_TYPES.find((x) => x.id === id) ?? TAAK_TYPES[0]!)
/** De keuzes in een bewerkstand: de taakkiezer, plus Bezoek als de taak al een bezoektaak is (anders verdwijnt het type stil). */
export const taakTypesVoor = (huidig: string | null | undefined) => (huidig === 'bezoek' ? [...TAAK_TYPES, BEZOEK_TYPE] : TAAK_TYPES)
/** Het kanaal van een `bericht`-activiteit als woord (WhatsApp, SMS, LinkedIn); anders null. */
export const berichtKanaalLabel = (soort: string | null | undefined, kanaal: string | null | undefined): string | null =>
  soort === 'bericht' || soort === 'sms' || soort === 'whatsapp' ? ({ whatsapp: 'WhatsApp', sms: 'SMS', linkedin: 'LinkedIn' } as Record<string, string>)[kanaal ?? (soort === 'bericht' ? '' : soort)] ?? null : null
export const STATUS_LABEL: Record<string, string> = { open: 'Open', bezig: 'Bezig', klaar: 'Klaar', geannuleerd: 'Geannuleerd' }
export const HERHALING_LABEL: Record<string, string> = { werkdag: 'Elke werkdag', wekelijks: 'Wekelijks', omdeweek: 'Om de week', maandelijks: 'Maandelijks' }
export const HERINNERING_KANAAL: Record<string, string> = { 'in-app': 'In de app', email: 'E-mail', beide: 'In de app en e-mail' }
const KANAAL_ACTIVITEIT: Record<string, { soort: string; kanaal: string }> = {
  bellen: { soort: 'gebeld', kanaal: 'telefoon' }, mailen: { soort: 'mail', kanaal: 'email' }, linkedin: { soort: 'bericht', kanaal: 'linkedin' },
  bezoek: { soort: 'bezoek', kanaal: 'bezoek' }, bericht: { soort: 'bericht', kanaal: 'whatsapp' }, sms: { soort: 'bericht', kanaal: 'sms' }, taak: { soort: 'taak', kanaal: 'intern' },
}
const ACTIE_VAN_KANAAL: Record<string, string> = { bellen: 'bellen', mail: 'mailen', linkedin: 'linkedin', bezoek: 'bezoek', whatsapp: 'bericht', sms: 'sms' }

export interface Taak {
  id: string
  title: string
  status: string
  actionType: string
  priority: string
  dueDate: string | null
  ownerId?: string | null
  accountId?: string | null
  ruleId?: string | null
  signalId?: string | null
  data?: { herkomst?: string | { bron?: string } | null; poging?: { n: number; van: number; kanaal?: string; vorige?: string } | null; herhaling?: { soort: string; teller: number; max: number } | null; afronding?: { sleutel?: string; uitkomst?: string } | null; [k: string]: unknown }
}

export interface AfrondInvoer {
  uitkomst?: UitkomstCode | 'verstuurd' | 'gedaan' | null
  laterOp?: string | null
  reden?: string | null
  toelichting?: string | null
  sleutel?: string | null
}

export interface AfrondResultaat {
  fout?: string
  alAfgerond?: boolean
  taakPatch: { status: 'klaar'; uitkomst: string | null; laterOp: string | null; data: Record<string, unknown> }
  activiteit: { soort: string; kanaal: string; uitkomst: string | null; data: Record<string, unknown> }
  /** Stuurvelden: laatste actie, en laatste call of bezoek. */
  stuur: { laatsteActie: string; laatsteCall?: string; laatsteBezoek?: string; contactmoment: boolean }
  gebeurtenissen: ('eerste-contact' | 'gesprek-gevoerd' | 'eerste-afspraak-gepland' | 'geparkeerd')[]
  ritme?: UitkomstResultaat
  vervolgtaak?: { title: string; actionType: string; priority: string; due: string; data: Record<string, unknown> } | null
  nee?: { reden: string; toelichting?: string | null } | null
  later?: string | null
}

function herkomstVan(t: Taak): Record<string, unknown> {
  const h = t.data?.herkomst
  const bron = typeof h === 'string' ? h : h?.bron ?? (t.signalId ? 'inzicht' : t.ruleId ? 'regel' : 'handmatig')
  return { bron, inzichtId: t.signalId ?? null, regelId: t.ruleId ?? null, actiesoort: t.actionType, uitvoerder: t.ownerId ?? null }
}

/**
 * Rond een taak af. Elk pad (flyout, lijst, vegen, bulk, belmodus, offline sync) roept
 * deze functie aan en krijgt dezelfde stuurvelden, activiteit en volgende poging.
 */
export function rondTaakAf(
  taak: Taak, invoer: AfrondInvoer,
  ctx: { nu: Date; ritme?: Ritme | null; stand?: RitmeStand | null; eersteContact?: boolean; inst?: WerkdagInstelling },
): AfrondResultaat {
  const nu = ctx.nu
  const leeg = { taakPatch: { status: 'klaar' as const, uitkomst: null, laterOp: null, data: {} }, activiteit: { soort: 'taak', kanaal: 'intern', uitkomst: null, data: {} }, stuur: { laatsteActie: nu.toISOString(), contactmoment: false }, gebeurtenissen: [] }
  if (taak.status === 'klaar') {
    const zelfde = !invoer.sleutel || taak.data?.afronding?.sleutel === invoer.sleutel
    return { ...leeg, alAfgerond: true, fout: zelfde ? undefined : 'Deze taak is al afgerond' }
  }
  if (taak.status === 'geannuleerd') return { ...leeg, fout: 'Deze taak is geannuleerd' }
  const contact = CONTACT_ACTIES.has(taak.actionType)
  const uitkomst = invoer.uitkomst ?? null
  if (contact && !uitkomst) return { ...leeg, fout: 'Kies een uitkomst' }
  if (uitkomst === 'later' && !invoer.laterOp) return { ...leeg, fout: 'Kies een datum bij "Gesproken, later"' }
  if (uitkomst === 'geen_interesse' && !invoer.reden) return { ...leeg, fout: 'Kies een reden bij "Geen interesse"' }
  if (uitkomst === 'geen_interesse' && invoer.reden === 'Anders' && !invoer.toelichting?.trim()) return { ...leeg, fout: 'Geef een toelichting bij "Anders"' }

  const k = KANAAL_ACTIVITEIT[taak.actionType] ?? KANAAL_ACTIVITEIT.taak!
  const herkomst = herkomstVan(taak)
  const gesproken = uitkomst === 'afspraak' || uitkomst === 'later'
  const bereikt = !!uitkomst && !['geen_reactie', 'voicemail'].includes(uitkomst)
  const gebeurtenissen: AfrondResultaat['gebeurtenissen'] = []
  if (contact && bereikt && ctx.eersteContact) gebeurtenissen.push('eerste-contact')
  if (gesproken) gebeurtenissen.push('gesprek-gevoerd')
  if (uitkomst === 'afspraak') gebeurtenissen.push('eerste-afspraak-gepland')

  // Hercontactritme: na elke poging de volgende stap of parkeren.
  let ritme: UitkomstResultaat | undefined
  let vervolgtaak: AfrondResultaat['vervolgtaak'] = null
  const ritmeUitkomst = uitkomst && uitkomst !== 'verstuurd' && uitkomst !== 'gedaan' ? uitkomst : contact ? 'geen_reactie' : null
  if (ctx.ritme && ctx.stand?.actief && contact && ritmeUitkomst) {
    ritme = verwerkUitkomst(ctx.stand, ctx.ritme, ritmeUitkomst as UitkomstCode, nu, { laterOp: invoer.laterOp, stap: taak.data?.poging?.n ?? ctx.stand.stap, inst: ctx.inst })
    if (ritme.actie === 'parkeren') gebeurtenissen.push('geparkeerd')
    if (ritme.volgende && !ritme.alVerwerkt) {
      const actie = ACTIE_VAN_KANAAL[ritme.volgende.kanaal] ?? 'bellen'
      vervolgtaak = {
        title: `Poging ${ritme.volgende.stap}: ${taak.title.replace(/^Poging \d+:\s*/, '')}`,
        actionType: actie, priority: taak.priority, due: ritme.volgende.op,
        data: { herkomst: { ...herkomst, bron: 'ritme' }, poging: { n: ritme.volgende.stap, van: ritme.volgende.van, kanaal: ritme.volgende.kanaal, vorige: `${taak.actionType}, ${(UITKOMST_LABEL[uitkomst as UitkomstCode] ?? 'gedaan').toLowerCase()} (${new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(nu)})` } },
      }
    }
  }
  // Herhaling: het vervolg pas na afronden, met dezelfde herkomst (gat 12).
  const h = taak.data?.herhaling
  if (!vervolgtaak && h && h.teller < h.max) {
    vervolgtaak = { title: taak.title, actionType: taak.actionType, priority: taak.priority, due: volgendeHerhaling(taak.dueDate ?? nu.toISOString(), h.soort, ctx.inst).toISOString(), data: { herkomst, herhaling: { ...h, teller: h.teller + 1 } } }
  }

  return {
    taakPatch: { status: 'klaar', uitkomst, laterOp: uitkomst === 'later' ? invoer.laterOp ?? null : null, data: { afronding: { sleutel: invoer.sleutel ?? null, uitkomst, op: nu.toISOString() }, ...(invoer.reden ? { reden: invoer.reden } : {}) } },
    activiteit: { soort: k.soort, kanaal: k.kanaal, uitkomst, data: { taakId: taak.id, herkomst, ...(taak.data?.poging ? { poging: taak.data.poging } : {}), ...(invoer.toelichting ? { tekst: invoer.toelichting } : {}) } },
    stuur: { laatsteActie: nu.toISOString(), ...(taak.actionType === 'bellen' ? { laatsteCall: nu.toISOString() } : {}), ...(taak.actionType === 'bezoek' ? { laatsteBezoek: nu.toISOString() } : {}), contactmoment: contact && bereikt },
    gebeurtenissen,
    ritme,
    vervolgtaak,
    nee: uitkomst === 'niet_geschikt' ? { reden: 'Niet geschikt' } : uitkomst === 'geen_interesse' ? { reden: invoer.reden!, toelichting: invoer.toelichting } : null,
    later: uitkomst === 'later' ? invoer.laterOp ?? null : null,
  }
}

function volgendeHerhaling(vanaf: string, soort: string, inst: WerkdagInstelling = {}): Date {
  const d = nlMoment(new Date(vanaf))
  const dagen: Record<string, number> = { wekelijks: 7, omdeweek: 14, maandelijks: 30 }
  if (soort === 'werkdag') return nlTijdstip(volgendeWerkdag(d.datum, inst), d.uur)
  const n = new Date(Date.parse(`${d.datum}T12:00:00Z`) + (dagen[soort] ?? 7) * 864e5).toISOString().slice(0, 10)
  return nlTijdstip(voegWerkdagenToe(n, 0, inst), d.uur)
}

/**
 * Aantal taken in een herhaalde reeks: de eerste plus elke herhaling tot en met `tot` (YYYY-MM-DD),
 * hooguit 52. Dezelfde stap als het vervolg na afronden, zodat het getal in het venster klopt.
 */
export function herhalingAantal(eerste: string, soort: string, tot: string, inst: WerkdagInstelling = {}): number {
  if (!eerste || Number.isNaN(Date.parse(eerste)) || !/^\d{4}-\d{2}-\d{2}$/.test(tot)) return 1
  let n = 1
  let d = eerste
  while (n < 52) {
    const v = volgendeHerhaling(d, soort, inst)
    if (nlMoment(v).datum > tot) break
    n++
    d = v.toISOString()
  }
  return n
}

/** "Volgende stap" in het taakvenster (DealDrive): één zin die zegt wat je nu met de taak doet. */
export function volgendeStap(t: { priority: string; dueDate: string | null; herkomst?: string | null; status?: string; agent?: string | null; poging?: { n: number; van: number } | null }, nu: Date): string {
  if (t.status === 'klaar') return 'Deze taak is afgerond. Kijk op de accountkaart wat er daarna gebeurde.'
  if (t.priority === 'urgent') return 'Pak deze nu op. Urgent betekent niet doorschuiven.'
  if (isAchterstallig(t, nu)) return 'Deze taak is over tijd. Beslis nu: doen, uitstellen of annuleren met een reden.'
  if (t.poging && t.poging.n >= t.poging.van) return 'Laatste poging uit het ritme. Zonder reactie gaat het account daarna naar Geparkeerd.'
  if (t.agent || t.herkomst === 'agent') return 'Voorbereid door een agent: lees het concept na en keur het goed of pas het aan.'
  if (t.herkomst === 'inzicht') return 'Gemaakt uit een inzicht. Noem de aanleiding in je eerste zin.'
  if (t.poging) return `Poging ${t.poging.n} van ${t.poging.van}. Leg de uitkomst vast, dan zet Dealtrace de volgende poging klaar.`
  return 'Plan een concreet moment en leg de uitkomst vast zodra het gedaan is.'
}

/** Achterstallig, dan vandaag, dan prioriteit, dan tijd; zonder datum achteraan. */
export function ordenTaken<T extends Pick<Taak, 'dueDate' | 'priority' | 'id'>>(taken: T[], nu: Date): T[] {
  const vandaag = nlMoment(nu).datum
  const rang = (t: T) => (!t.dueDate ? 3 : Date.parse(t.dueDate) < nu.getTime() && nlMoment(new Date(t.dueDate)).datum < vandaag ? 0 : nlMoment(new Date(t.dueDate)).datum <= vandaag ? 1 : 2)
  return [...taken].sort((a, b) => rang(a) - rang(b) || (rang(a) === 2 ? (a.dueDate ?? '').localeCompare(b.dueDate ?? '') : 0)
    || (PRIO_VOLGORDE[a.priority] ?? 2) - (PRIO_VOLGORDE[b.priority] ?? 2) || (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.id.localeCompare(b.id))
}

export function isAchterstallig(t: Pick<Taak, 'dueDate'>, nu: Date): boolean {
  return !!t.dueDate && nlMoment(new Date(t.dueDate)).datum < nlMoment(nu).datum
}

export type Groep = 'Achterstallig' | 'Vandaag' | 'Morgen' | 'Deze week' | 'Later' | 'Geen vervaldatum'
export const GROEPEN: Groep[] = ['Achterstallig', 'Vandaag', 'Morgen', 'Deze week', 'Later', 'Geen vervaldatum']

export function groepVan(t: Pick<Taak, 'dueDate'>, nu: Date): Groep {
  if (!t.dueDate) return 'Geen vervaldatum'
  const d = nlMoment(new Date(t.dueDate)).datum
  const v = nlMoment(nu).datum
  if (d < v) return 'Achterstallig'
  if (d === v) return 'Vandaag'
  const morgen = new Date(Date.parse(`${v}T12:00:00Z`) + 864e5).toISOString().slice(0, 10)
  if (d === morgen) return 'Morgen'
  const wd = new Date(`${v}T12:00:00Z`).getUTCDay() || 7
  const zondag = new Date(Date.parse(`${v}T12:00:00Z`) + (7 - wd) * 864e5).toISOString().slice(0, 10)
  return d <= zondag ? 'Deze week' : 'Later'
}

/** Horizon: Vandaag (met achterstallig en ongedateerd bovenaan), Komende week, Week 2 en 3 (gat 39). */
export function horizon<T extends Pick<Taak, 'dueDate' | 'priority' | 'id'>>(taken: T[], nu: Date): { vandaag: T[]; komendeWeek: T[]; week23: T[] } {
  const v = nlMoment(nu).datum
  const plus = (n: number) => new Date(Date.parse(`${v}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
  const uit = { vandaag: [] as T[], komendeWeek: [] as T[], week23: [] as T[] }
  for (const t of ordenTaken(taken, nu)) {
    const d = t.dueDate ? nlMoment(new Date(t.dueDate)).datum : null
    if (!d || d <= v) uit.vandaag.push(t)
    else if (d <= plus(7)) uit.komendeWeek.push(t)
    else if (d <= plus(21)) uit.week23.push(t)
  }
  return uit
}

/** Uitstellen houdt het tijdstip en telt vanaf de oude vervaldatum als die in de toekomst ligt. */
export function uitstellen(t: Pick<Taak, 'dueDate'>, periode: 'werkdag' | 'week', nu: Date, inst: WerkdagInstelling = {}): string {
  const basis = t.dueDate && Date.parse(t.dueDate) > nu.getTime() ? new Date(t.dueDate) : nu
  const m = nlMoment(basis)
  const uur = t.dueDate ? nlMoment(new Date(t.dueDate)).uur : 9
  const minuut = t.dueDate ? nlMoment(new Date(t.dueDate)).minuut : 0
  const dag = periode === 'werkdag' ? volgendeWerkdag(m.datum, inst) : voegWerkdagenToe(new Date(Date.parse(`${m.datum}T12:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10), 0, inst)
  return nlTijdstip(dag, uur, minuut).toISOString()
}

/** "3 dagen over tijd", "vandaag 10:00", "morgen", "do 16 okt". */
export function vervalLabel(due: string | null, nu: Date): string {
  if (!due) return 'geen vervaldatum'
  const d = nlMoment(new Date(due))
  const v = nlMoment(nu).datum
  const dagen = Math.round((Date.parse(`${d.datum}T12:00:00Z`) - Date.parse(`${v}T12:00:00Z`)) / 864e5)
  const tijd = `${String(d.uur).padStart(2, '0')}:${String(d.minuut).padStart(2, '0')}`
  if (dagen < 0) return `${-dagen} ${dagen === -1 ? 'dag' : 'dagen'} over tijd`
  if (dagen === 0) return `vandaag ${tijd}`
  if (dagen === 1) return `morgen ${tijd}`
  return new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(due))
}

/** "Maak taak" uit een inzicht: titel, prioriteit en actiesoort erven (F06). */
export function voorinvullingUitInzicht(i: { title: string; type: string; relevanceScore: number; ruleId?: string | null; id: string; accountNaam?: string | null; data?: { voorstel?: { title: string; actionType: string; priority: string } | null } }) {
  const v = i.data?.voorstel
  return {
    title: v?.title ?? `Volg op: ${i.type} bij ${i.accountNaam ?? 'het account'}`,
    priority: v?.priority ?? (i.relevanceScore >= 80 ? 'hoog' : 'middel'),
    actionType: v?.actionType && v.actionType !== 'geen' ? v.actionType : 'taak',
    signalId: i.id,
    ruleId: i.ruleId ?? null,
    herkomst: 'inzicht',
  }
}
