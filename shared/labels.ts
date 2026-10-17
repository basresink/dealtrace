// Labelsysteem (mockup "Labels in Dealtrace"): één register voor elk label in de app.
// Drie stijlen: gevuld (alleen rood, alleen voor wat nu een handeling vraagt), zacht (tint en altijd
// een icoon) en rand (feit zonder oordeel); leeg is de gestippelde rand voor onbekend of ontbrekend.
// Zeven tinten: rood, oranje, groen, blauw, cyaan, paars en grijs. Paars is alleen AI; geel en zwart
// met geel zijn nooit een label. Standaardwaarden (prioriteit Middel, herkomst Handmatig, status Actief)
// krijgen geen label. Klasse heeft een lettertegel en een trap, fase een stappenpil, score een cijfer.
// Het component <Label soort="..." :waarde="..." /> (app/components/algemeen/Label.vue) leest dit register.

export const LABEL_STIJLEN = ['vol', 'zacht', 'rand', 'leeg'] as const
export type LabelStijl = (typeof LABEL_STIJLEN)[number]
export const LABEL_TINTEN = ['rood', 'oranje', 'groen', 'blauw', 'cyaan', 'paars', 'grijs'] as const
export type LabelTint = (typeof LABEL_TINTEN)[number]

export interface LabelDef {
  tekst: string
  stijl: LabelStijl
  /** Alleen bij stijl zacht. */
  tint?: LabelTint
  /** Lucide-naam voor <Icoon>. */
  icoon?: string
  /** Gestippeld: een AI-voorstel dat je nog bevestigt. */
  voorstel?: boolean
  /** Komt van AI; alleen dan mag de tint paars zijn. */
  ai?: boolean
}

const vol = (tekst: string, icoon: string): LabelDef => ({ tekst, stijl: 'vol', icoon })
const zacht = (tekst: string, tint: LabelTint, icoon: string): LabelDef => ({ tekst, stijl: 'zacht', tint, icoon })
const rand = (tekst: string, icoon?: string): LabelDef => (icoon ? { tekst, stijl: 'rand', icoon } : { tekst, stijl: 'rand' })
const leeg = (tekst: string, icoon?: string): LabelDef => (icoon ? { tekst, stijl: 'leeg', icoon } : { tekst, stijl: 'leeg' })
const ai = (tekst: string, voorstel = false): LabelDef => ({ tekst, stijl: 'zacht', tint: 'paars', icoon: 'Sparkles', ai: true, ...(voorstel ? { voorstel: true } : {}) })

/** null betekent: standaardwaarde, geen label tonen. */
type Register = Record<string, LabelDef | null>

export const LABELS = {
  /** Wat nu een handeling vraagt: gevuld rood, hoogstens één per rij. */
  urgentie: {
    'over-tijd': vol('Over tijd', 'Clock'),
    achterstallig: vol('Achterstallig', 'Clock'),
    'bel-me-niet': vol('Bel me niet', 'PhoneOff'),
    risico: vol('Risico', 'TriangleAlert'),
  },
  prioriteit: {
    urgent: vol('Urgent', 'TriangleAlert'),
    hoog: zacht('Hoog', 'oranje', 'ArrowUp'),
    middel: null,
    laag: rand('Laag', 'ArrowDown'),
  },
  /** Status van een account (en van taken en contacten die afwijken). */
  status: {
    nieuw: rand('Nieuw', 'CircleDot'),
    'in reis': zacht('In reis', 'blauw', 'CirclePlay'),
    wachtend: zacht('Wachtend', 'oranje', 'Hourglass'),
    'wacht op jou': zacht('Wacht op jou', 'oranje', 'Hourglass'),
    geparkeerd: zacht('Geparkeerd', 'grijs', 'CirclePause'),
    gepauzeerd: zacht('Gepauzeerd', 'grijs', 'CirclePause'),
    nee: zacht('Nee', 'grijs', 'CircleX'),
    gescoord: zacht('Gescoord', 'groen', 'CircleCheck'),
    klant: zacht('Klant', 'groen', 'CircleCheck'),
    overgedragen: zacht('Overgedragen', 'groen', 'CircleCheck'),
    afgerond: zacht('Afgerond', 'groen', 'CircleCheck'),
    gedeactiveerd: leeg('Gedeactiveerd', 'Archive'),
    vertrokken: leeg('Vertrokken', 'UserX'),
    'geen-mail': leeg('Geen mail', 'MailX'),
    'te-lang-in-fase': zacht('Te lang in fase', 'oranje', 'Clock'),
    heet: zacht('Heet', 'oranje', 'Flame'),
    actief: null,
  },
  /** Status prospect (shared/prospectStatus.ts): hoe warm de prospect is, met de hand gekozen. Zacht met icoon. */
  prospectstatus: {
    koud: zacht('Koud', 'cyaan', 'Snowflake'),
    lauw: zacht('Lauw', 'grijs', 'Thermometer'),
    warm: zacht('Warm', 'oranje', 'Sun'),
    heet: zacht('Heet', 'rood', 'Flame'),
  },
  /** Rol in het buying committee: zacht, elke rol een eigen icoon en tint. */
  rol: {
    beslisser: zacht('Beslisser', 'blauw', 'Crown'),
    beinvloeder: zacht('Beïnvloeder', 'cyaan', 'Megaphone'),
    champion: zacht('Champion', 'groen', 'Trophy'),
    poortwachter: zacht('Poortwachter', 'oranje', 'Shield'),
    gebruiker: zacht('Gebruiker', 'grijs', 'User'),
    blokkeerder: zacht('Blokkeerder', 'rood', 'Ban'),
    onbekend: leeg('Rol onbekend', 'CircleHelp'),
  },
  /** Houding op de invloedskaart: duim, streep of verbod. */
  houding: {
    voor: zacht('Voor', 'groen', 'ThumbsUp'),
    neutraal: zacht('Neutraal', 'grijs', 'Minus'),
    tegen: zacht('Tegen', 'rood', 'Ban'),
    onbekend: leeg('Onbekend', 'CircleHelp'),
  },
  /** Taaktype en kanaal: rand met icoon; het icoon draagt het onderscheid. */
  actie: {
    bellen: rand('Bellen', 'Phone'),
    mailen: rand('Mail', 'Mail'),
    linkedin: rand('LinkedIn', 'Linkedin'),
    bezoek: rand('Bezoek', 'MapPin'),
    bericht: rand('WhatsApp', 'MessageCircle'),
    sms: rand('SMS', 'MessageSquare'),
    whatsapp: rand('WhatsApp', 'MessageCircle'),
    online: rand('Online', 'Video'),
    taak: rand('Taak', 'ListTodo'),
    geen: rand('Taak', 'ListTodo'),
  },
  /** Waar een taak vandaan komt. Handmatig is de standaard; een agent is AI. */
  herkomst: {
    handmatig: null,
    regel: rand('Uit regel', 'Workflow'),
    startactiviteit: rand('Uit regel', 'Workflow'),
    inzicht: rand('Uit inzicht', 'Lightbulb'),
    campagne: rand('Campagne', 'Megaphone'),
    ritme: rand('Ritme', 'CalendarClock'),
    reeks: rand('Opvolgreeks', 'Repeat'),
    volgen: rand('Volgende stap', 'ArrowRight'),
    dagplanner: rand('Dagplanner', 'Calendar'),
    import: rand('Import', 'Upload'),
    agent: ai('Agent'),
  },
  /** Herkomst van een briefingblok: AI is paars, eigen tekst en berekend zijn feiten. */
  briefing: {
    berekend: rand('Berekend', 'ChartColumn'),
    ai: ai('Door AI geschreven'),
    eigen: rand('Eigen tekst', 'Pencil'),
  },
  /** Bron van een inzicht. */
  bron: {
    intern: rand('Intern', 'Building2'),
    extern: rand('Extern', 'Globe'),
    agenda: rand('Agenda', 'Calendar'),
  },
  /** Soort inzicht: wat het is, geen kleur. Te lang in fase is een waarschuwing. */
  inzichtsoort: {
    vacature: rand('Vacature', 'Briefcase'),
    nieuws: rand('Nieuws', 'Newspaper'),
    website: rand('Website', 'Globe'),
    social: rand('Social', 'MessageSquare'),
    kvk: rand('KvK', 'Building2'),
    aanbesteding: rand('Aanbesteding', 'ScrollText'),
    koopsignaal: rand('Koopsignaal', 'Target'),
    kansanalyse: rand('Kansanalyse', 'ChartLine'),
    branche: rand('Branche', 'Network'),
    agenda: rand('Agenda', 'Calendar'),
    'campagne-achterstand': zacht('Campagne loopt achter', 'oranje', 'Clock'),
    'te-lang-in-fase': zacht('Te lang in fase', 'oranje', 'Clock'),
    heet: zacht('Heet', 'oranje', 'Flame'),
    'regel-voorstel': rand('Regelvoorstel', 'Workflow'),
  },
  /** Contractstatus van een klantorganisatie (platformbeheer); actief is de standaard. */
  contract: {
    actief: null,
    proef: zacht('Proef', 'blauw', 'Hourglass'),
    opgezegd: zacht('Opgezegd', 'oranje', 'CircleX'),
  },
  /** AVG-verzoek van een klant (platformbeheer): open met termijn, over tijd, afgehandeld. */
  avgverzoek: {
    open: rand('Open', 'Clock'),
    over_tijd: zacht('Over tijd', 'rood', 'TriangleAlert'),
    afgehandeld: zacht('Afgehandeld', 'groen', 'CircleCheck'),
  },
  /** Waar de AI-koppeling van een klant vandaan komt (platformbeheer). */
  aikoppeling: {
    eigen: rand('Eigen koppeling', 'KeyRound'),
    platform: rand('Platformkoppeling'),
    mock: leeg('Mock'),
  },
  /** Gezondheid van een klantorganisatie (platformbeheer). */
  gezondheid: {
    gezond: zacht('Gezond', 'groen', 'CircleCheck'),
    let_op: zacht('Let op', 'oranje', 'TriangleAlert'),
    risico: vol('Risico', 'TriangleAlert'),
    leeg: leeg('Nog geen stand'),
  },
  /** Stand van een accountplan. */
  plan: {
    actueel: zacht('Actueel', 'blauw', 'CirclePlay'),
    verlopen: zacht('Verlopen', 'rood', 'Clock'),
    afgerond: zacht('Afgerond', 'groen', 'CircleCheck'),
    concept: leeg('Concept', 'Pencil'),
  },
  /** Tempo van een campagne: op schema is de standaard en blijft een rand. */
  tempo: {
    voor: zacht('Voor op schema', 'groen', 'ArrowUp'),
    op: rand('Op schema', 'CircleCheck'),
    achter: zacht('Achter op schema', 'oranje', 'Clock'),
  },
  /** Status van een campagne. */
  campagne: {
    concept: leeg('Concept', 'Pencil'),
    wacht: zacht('Wacht op bevestiging', 'oranje', 'Hourglass'),
    actief: zacht('Actief', 'blauw', 'CirclePlay'),
    gepauzeerd: zacht('Gepauzeerd', 'grijs', 'CirclePause'),
    afgerond: zacht('Afgerond', 'groen', 'CircleCheck'),
  },
  /** Status van een concept van een agent: klaar is een AI-voorstel dat je nog bevestigt. */
  concept: {
    klaar: ai('Klaar', true),
    goedgekeurd: zacht('Goedgekeurd', 'groen', 'CircleCheck'),
    verstuurd: rand('Verstuurd', 'ArrowRight'),
    afgewezen: leeg('Afgewezen', 'CircleX'),
    mislukt: zacht('Mislukt', 'rood', 'TriangleAlert'),
  },
  /** Soort melding. */
  melding: {
    kritiek: vol('Kritiek', 'TriangleAlert'),
    hot: zacht('Hete aanleiding', 'oranje', 'Flame'),
    dagstart: rand('Dagstart', 'Sunrise'),
    herinnering: rand('Herinnering', 'Bell'),
    inzicht: rand('Inzicht', 'Lightbulb'),
    systeem: rand('Dealtrace', 'Info'),
  },
  /** Overdracht naar DealDrive of het CRM. */
  overdracht: {
    klaar: rand('Klaar', 'CircleDot'),
    verstuurd: zacht('Verstuurd', 'blauw', 'ArrowRight'),
    bevestigd: zacht('Bevestigd', 'groen', 'CircleCheck'),
    mislukt: zacht('Mislukt', 'rood', 'TriangleAlert'),
    gewonnen: zacht('Gewonnen na overdracht', 'groen', 'Trophy'),
  },
  /** Terug in beeld: waar een verloren prospect staat. Over tijd is urgentie over-tijd (gevuld rood). */
  terug: {
    klaar: zacht('Klaar om te starten', 'blauw', 'CirclePlay'),
    afkoeling: zacht('Nog in afkoeling', 'oranje', 'Hourglass'),
    gepland: zacht('Gepland', 'grijs', 'CalendarClock'),
    gestart: zacht('Gestart', 'groen', 'CircleCheck'),
  },
  /** Soort account: een feit. */
  account: {
    prospect: rand('Prospect'),
    klant: rand('Klant'),
  },
  /** AI: zacht paars met de vonk; een voorstel heeft een gestippelde rand. */
  ai: {
    ai: ai('AI'),
    agent: ai('Agent'),
    context: ai('AI-context'),
    concept: ai('AI-concept'),
    voorstel: ai('Voorstel', true),
  },
} satisfies Record<string, Register>

export type LabelSoort = keyof typeof LABELS | 'klasse' | 'fase' | 'score'

/** De definitie van een label, of null als de waarde de standaard is of onbekend. */
export function labelDef(soort: string, waarde: unknown): LabelDef | null {
  const reg = (LABELS as Record<string, Register>)[soort]
  if (!reg || waarde === null || waarde === undefined || waarde === '') return null
  return reg[String(waarde)] ?? null
}

// ---------- Klasse: rand, lettertegel en trap (A vier streepjes, D een) ----------

export interface KlasseLabel { letter: string; tekst: string; trap: number }
const TRAP: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 }

/** "A · Corporate (vanaf 50 mw)" wordt letter A, tekst Corporate, trap 4. Zonder naam: null (Geen klasse). */
export function klasseDef(naam: string | null | undefined): KlasseLabel | null {
  if (!naam) return null
  const schoon = naam.replace(/\s*\([^)]*\)\s*$/, '').trim()
  const [voor, ...na] = schoon.split('·')
  const letter = (voor ?? '').trim()
  const tekst = na.join('·').trim()
  if (!tekst) {
    // Alleen een letter ("B") of alleen een naam ("Strategisch").
    const kort = letter.length <= 2 ? letter.toUpperCase() : letter.charAt(0).toUpperCase()
    return { letter: kort, tekst: letter.length <= 2 ? '' : letter, trap: TRAP[kort] ?? 0 }
  }
  const l = letter.length <= 2 ? letter.toUpperCase() : letter.charAt(0).toUpperCase()
  return { letter: l, tekst, trap: TRAP[l] ?? 0 }
}

// ---------- Fase: rand met vier stappen (vinden, bewerken, verbinden, overgedragen) ----------

const FASE_STAP: Record<string, number> = { vinden: 1, bewerken: 2, verbinden: 3, overgedragen: 4 }

/** Stap 1 tot 4 van de hoofdfase; verloren (ook geparkeerd) staat buiten de reis en is gestippeld. */
export function faseDef(hoofdfase: string | null | undefined): { stap: number; uit: boolean } {
  if (hoofdfase === 'verloren') return { stap: 0, uit: true }
  return { stap: FASE_STAP[hoofdfase ?? ''] ?? 0, uit: false }
}

// ---------- Score: rand met cijfer; vanaf 75 zacht oranje met een vlam ----------

export const SCORE_HEET = 75
export function scoreDef(score: number | null | undefined): LabelDef | null {
  if (score === null || score === undefined || Number.isNaN(Number(score))) return null
  const n = Math.round(Number(score))
  return n >= SCORE_HEET ? zacht(String(n), 'oranje', 'Flame') : rand(String(n))
}

// ---------- Volgorde in een rij ----------

/** Urgentie, fase of status, rol, soort of kanaal, herkomst, AI. */
export const LABEL_VOLGORDE: string[] = ['urgentie', 'prioriteit', 'fase', 'status', 'prospectstatus', 'klasse', 'rol', 'houding', 'actie', 'inzichtsoort', 'bron', 'account', 'herkomst', 'score', 'ai']
export const MAX_LABELS_IN_RIJ = 4

export interface RijLabel { soort: string; waarde: unknown; tekst?: string; [k: string]: unknown }

/** Is dit label gevuld? Voor klasse, fase en score nooit. */
export const isVol = (l: RijLabel) => labelDef(l.soort, l.waarde)?.stijl === 'vol'

/**
 * Labels voor één rij: zonder standaardwaarden, in vaste volgorde, met hoogstens één gevuld label
 * (het eerste wint: Over tijd gaat voor Urgent) en hoogstens vier labels.
 */
export function ordenLabels<T extends RijLabel>(labels: (T | null | undefined | false)[], max = MAX_LABELS_IN_RIJ): T[] {
  const toont = (l: T) => {
    if (l.soort === 'fase') return !!l.tekst
    if (l.soort === 'klasse') return true
    if (l.soort === 'score') return scoreDef(l.waarde as number) !== null
    return labelDef(l.soort, l.waarde) !== null
  }
  const zichtbaar = labels.filter((l): l is T => !!l && toont(l))
  const rang = (s: string) => { const i = LABEL_VOLGORDE.indexOf(s); return i < 0 ? LABEL_VOLGORDE.length : i }
  const gesorteerd = zichtbaar.map((l, i) => ({ l, i })).sort((a, b) => rang(a.l.soort) - rang(b.l.soort) || a.i - b.i).map((x) => x.l)
  let volGezien = false
  const uit: T[] = []
  for (const l of gesorteerd) {
    if (isVol(l)) { if (volGezien) continue; volGezien = true }
    uit.push(l)
  }
  return uit.slice(0, max)
}

// ---------- Tokens (lichte waarden; gelijk aan de sectie Labels in ui-standaard.css) ----------

export const LABEL_KLEUREN = {
  vol: { tekst: '#ffffff', vlak: '#b42d20' },
  rood: { tekst: '#9f2a1f', vlak: '#fbe9e7', rand: '#efc4bf' },
  oranje: { tekst: '#8a4204', vlak: '#fdf0dc', rand: '#f1d3a6' },
  groen: { tekst: '#17643c', vlak: '#e5f3ea', rand: '#b9dcc6' },
  blauw: { tekst: '#194c8f', vlak: '#e7eef8', rand: '#bccde6' },
  cyaan: { tekst: '#0b5e68', vlak: '#e1f2f3', rand: '#b1d9dd' },
  paars: { tekst: '#4c1d95', vlak: '#efe9f9', rand: '#d2c4ee' },
  grijs: { tekst: '#4d4c47', vlak: '#efeee9', rand: '#d6d3ca' },
  rand: { tekst: '#0a0a0a', lijn: '#c8c5bc', zacht: '#5c5b57' },
} as const
