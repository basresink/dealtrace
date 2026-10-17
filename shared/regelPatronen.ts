// De regels van de motor (F15). Eén catalogus van triggerpatronen, cadansen en
// keuzelijsten (gat 16), gebruikt door editor, Excel, droogloop en motor.
// Alle functies zijn puur en krijgen `nu` mee.
import { magBenaderen, type Kanaal } from './nbStatus'
import { dice } from './ontdubbelen'
import { AFSPRAAKMATRIX_STANDAARD, BELMATRIX_STANDAARD, geldendeCel, intervalDagen, type Matrix } from './ritmematrix'

export const PATROON_SLEUTELS = [
  'datum-drempel', 'inactiviteit', 'ritme', 'gebeurtenis', 'te-lang-in-fase', 'lead-verlopen', 'jaarplanning-venster',
  'afspraak-niet-overgedragen', 'afspraak-onvoldoende-gekwalificeerd', 'campagne-achterstand', 'hercontact-vervolg',
  'geparkeerd-terug', 'trigger-heractivatie', 'tussendoel-gehaald', 'partner-te-laat', 'reis-overgang',
] as const
export type Patroon = typeof PATROON_SLEUTELS[number]

export interface PatroonInfo { label: string; vuurtAls: string; parameters: Record<string, unknown> }

export const PATRONEN: Record<Patroon, PatroonInfo> = {
  'datum-drempel': { label: 'Datum-drempel', vuurtAls: 'een datumveld ligt 0 tot {dagen} dagen in de toekomst', parameters: { veld: 'terugOp', dagen: 60 } },
  inactiviteit: { label: 'Inactiviteit', vuurtAls: 'er {dagen} dagen of langer geen contact is geweest', parameters: { veld: 'laatsteContactOp', dagen: 30, ookZonderDatum: false } },
  ritme: { label: 'Ritme', vuurtAls: 'het ritme van de klasse aan de beurt is', parameters: { actiesoort: 'bellen', matrix: true } },
  gebeurtenis: { label: 'Gebeurtenis', vuurtAls: 'de gebeurtenis "{gebeurtenis}" plaatsvond of de fase werd betreden', parameters: { gebeurtenis: null, fase: null } },
  'te-lang-in-fase': { label: 'Te lang in fase', vuurtAls: 'het account langer in de fase staat dan verwacht', parameters: { marge: 0 } },
  'lead-verlopen': { label: 'Lead verlopen', vuurtAls: 'het dossier ouder is dan {dagen} dagen', parameters: { dagen: 30 } },
  'jaarplanning-venster': { label: 'Jaarplanning-venster', vuurtAls: 'het venster uit de jaarplanning voorbij is en het account dit verkoopjaar niet benaderd is', parameters: {} },
  'afspraak-niet-overgedragen': { label: 'Afspraak niet overgedragen', vuurtAls: 'de eerste afspraak {werkdagen} werkdag geleden gehouden is zonder overdracht of uitkomst', parameters: { werkdagen: 1 } },
  'afspraak-onvoldoende-gekwalificeerd': { label: 'Afspraak onvoldoende gekwalificeerd', vuurtAls: 'de eerste afspraak binnen {dagenVooraf} dagen is en BAND 1 of minder', parameters: { dagenVooraf: 2 } },
  'campagne-achterstand': { label: 'Campagne-achterstand', vuurtAls: 'de campagne {marge} punten achter loopt op het tempo', parameters: { marge: 10 } },
  'hercontact-vervolg': { label: 'Hercontact-vervolg', vuurtAls: 'de volgende poging in het hercontactritme aan de beurt is', parameters: {} },
  'geparkeerd-terug': { label: 'Geparkeerd terug', vuurtAls: 'de terugkomdatum bereikt is', parameters: {} },
  'trigger-heractivatie': { label: 'Trigger-heractivatie', vuurtAls: 'er een nieuw extern signaal is bij een account op wachtend of nee, buiten de afkoelperiode', parameters: { signaalsoorten: ['jubileum', 'vacature', 'directiewissel', 'verhuizing', 'subsidie'], ookInReis: false } },
  'tussendoel-gehaald': { label: 'Tussendoel gehaald', vuurtAls: 'een tussendoel van een activiteit gehaald is', parameters: {} },
  'partner-te-laat': { label: 'Partner te laat', vuurtAls: 'een doorgezette lead niet op tijd bevestigd is', parameters: {} },
  // Dealtrace: een overgang in de prospectreis als trigger (van fase, gebeurtenis, naar fase; leeg is elke).
  'reis-overgang': { label: 'Overgang in de reis', vuurtAls: 'het account in de reis een overgang maakte', parameters: { vanFase: null, naarFase: null, gebeurtenis: null } },
}

/** Leesbare naam en uitleg per triggerparameter (de editor toont nooit een kale sleutel). */
export const PARAM_INFO: Record<string, { label: string; uitleg: string; eenheid?: string }> = {
  veld: { label: 'Datumveld', uitleg: 'Het veld van het account waarop de drempel rekent.' },
  dagen: { label: 'Drempel', uitleg: 'Het aantal dagen van de drempel.', eenheid: 'dagen' },
  ookZonderDatum: { label: 'Ook zonder datum', uitleg: 'Telt vanaf het aanmaken als het veld nog leeg is.' },
  alleenZonderDatum: { label: 'Alleen zonder datum', uitleg: 'Vuurt alleen zolang het veld nog leeg is.' },
  actiesoort: { label: 'Ritme van', uitleg: 'Bellen volgt de belmatrix, bezoek de rij Bezoek van de afspraakmatrix.' },
  matrix: { label: 'Matrix als poort', uitleg: 'Neemt poort en interval uit de accountmatrix per klasse.' },
  gebeurtenis: { label: 'Gebeurtenis', uitleg: 'Leeg is elke gebeurtenis.' },
  fase: { label: 'Fase betreden', uitleg: 'Vuurt als het account deze fase betrad. Leeg is geen fase.' },
  marge: { label: 'Marge', uitleg: 'Ruimte boven de norm voordat de regel vuurt.' },
  werkdagen: { label: 'Na werkdagen', uitleg: 'Aantal werkdagen na de afspraak.', eenheid: 'werkdagen' },
  dagenVooraf: { label: 'Dagen vooraf', uitleg: 'Zoveel dagen voor de eerste afspraak.', eenheid: 'dagen' },
  signaalsoorten: { label: 'Signaalsoorten', uitleg: 'Welke externe signalen tellen.' },
  ookInReis: { label: 'Ook in de reis', uitleg: 'Ook voor accounts die nu in de reis zitten, niet alleen wachtend of nee.' },
  vanFase: { label: 'Van fase', uitleg: 'De fase waar het account vandaan kwam. Leeg is elke fase.' },
  naarFase: { label: 'Naar fase', uitleg: 'De fase waar het account naartoe ging. Leeg is elke fase.' },
}

/** De datumvelden van een prospect waarop een datum- of inactiviteitsregel kan rekenen. */
export const DATUM_VELDEN: { code: string; label: string; patronen: Patroon[] }[] = [
  { code: 'laatsteContactOp', label: 'Laatste contact', patronen: ['inactiviteit', 'datum-drempel'] },
  { code: 'terugOp', label: 'Terugkomdatum', patronen: ['datum-drempel'] },
  { code: 'dossierOp', label: 'Dossier compleet', patronen: ['inactiviteit', 'datum-drempel'] },
  { code: 'faseSinds', label: 'In de fase sinds', patronen: ['inactiviteit'] },
  { code: 'aangemaaktOp', label: 'Aangemaakt', patronen: ['inactiviteit'] },
]

/** Cadans in dagen; 0 = Continu (elke run, alleen begrensd door ontdubbelen). */
export const CADANSEN: { dagen: number; label: string }[] = [
  { dagen: 0, label: 'Continu' }, { dagen: 1, label: 'Dagelijks' }, { dagen: 2, label: '2 dagen' }, { dagen: 3, label: '3 dagen' },
  { dagen: 7, label: 'Wekelijks' }, { dagen: 14, label: '2 weken' }, { dagen: 30, label: 'Maandelijks' }, { dagen: 61, label: '2 maanden' },
  { dagen: 91, label: 'Kwartaal' }, { dagen: 182, label: 'Half jaar' }, { dagen: 365, label: 'Jaarlijks' },
]
/** `bericht` is WhatsApp; `sms` is SMS. */
export const ACTIESOORTEN = ['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht', 'sms', 'geen'] as const
export const ACTIESOORT_LABEL: Record<string, string> = { bellen: 'Bellen', mailen: 'Mailen', linkedin: 'LinkedIn', bezoek: 'Bezoek', bericht: 'WhatsApp', sms: 'SMS', geen: 'Geen' }
export const UITVOERDERROLLEN = ['binnendienst', 'buitendienst', 'eigenaar', 'salesmanager'] as const
export const CATEGORIEEN = ['Vinden', 'Bewerken', 'Verbinden', 'Ritme', 'Signalen', 'Kwaliteit'] as const
export const PRIORITEITEN = ['hoog', 'middel', 'laag'] as const
export const TERMIJNEN = [{ werkdagen: 0, label: 'binnen 24 uur' }, { werkdagen: 1, label: 'binnen 1 werkdag' }, { werkdagen: 3, label: 'binnen 3 werkdagen' }, { werkdagen: 5, label: 'binnen 5 werkdagen' }, { werkdagen: 10, label: 'binnen 2 weken' }]
export const SJABLOON_VARIABELEN = ['account', 'contact', 'afspraak', 'winpunt'] as const
export const ONDERWERPEN = ['account'] as const

const KANAAL_VAN_ACTIE: Record<string, Kanaal | null> = { bellen: 'bellen', mailen: 'mail', linkedin: 'linkedin', bezoek: 'bezoek', bericht: 'whatsapp', sms: 'whatsapp', geen: null }

export interface Afbakening {
  accounttypes?: ('prospect' | 'klant')[]
  statussen?: string[]
  reisIds?: string[]
  faseIds?: string[]
  doelgroepIds?: string[]
  campagneIds?: string[]
  klassen?: string[]
}

export interface Gevolg {
  actiesoort: typeof ACTIESOORTEN[number]
  uitvoerderrol: typeof UITVOERDERROLLEN[number]
  termijnWerkdagen: number
  taaksjabloon: string
  belscriptId?: string | null
  automatischVoorbereiden?: boolean
  signaaltype?: string | null
  verwachtResultaat?: string | null
  /** Winpunten uit het verkoopverhaal die de taak als gespreksonderwerp meekrijgt (Dealtrace). */
  winpuntIds?: string[]
}

export interface RegelData {
  subcategorie?: string
  omschrijving: string
  activiteit: 'inzicht' | 'taak'
  bron: 'intern' | 'extern'
  specifiekeBron?: string
  trigger: { patroon: Patroon; parameters: Record<string, any> }
  afbakening: Afbakening
  gevolg: Gevolg
  herkomst?: 'starterset' | 'eigen' | 'import'
}

export interface Regel {
  id: string
  code?: string | null
  naam: string
  categorie: string
  actief: boolean
  motor: 'regel' | 'ai'
  scope: 'organisatie' | 'team' | 'persoonlijk'
  teamId?: string | null
  eigenaarId?: string | null
  reisId?: string | null
  faseId?: string | null
  cadansDagen: number
  prioriteit: typeof PRIORITEITEN[number]
  versie?: number
  data: RegelData
}

/** Wat de motor van een account weet. Bronnen die nog niet bestaan zijn lege lijsten. */
export interface MotorAccount {
  id: string
  naam: string
  type: 'prospect' | 'klant'
  nbStatus: string
  reisId?: string | null
  faseId?: string | null
  faseSinds?: string | null
  verwachtVerblijfDagen?: number | null
  doelgroepId?: string | null
  campagneIds?: string[]
  klasse?: string | null
  klasseCode?: string | null
  ownerId?: string | null
  ownerTeamId?: string | null
  ownerWerkplek?: 'binnendienst' | 'buitendienst' | null
  gebiedId?: string | null
  aangemaaktOp: string
  laatsteContactOp?: string | null
  terugOp?: string | null
  dossierOp?: string | null
  bandScore?: number
  belMeNiet?: boolean
  nee?: any
  wachtendTot?: string | null
  contactNaam?: string | null
  /** Het primaire contact (de beslisser, anders het eerste actieve contact): de motor geeft het mee als contact_id. */
  contactId?: string | null
  /** Hoofdfase van de huidige fase (vinden, bewerken, verbinden), voor de keuze van het winpunt. */
  hoofdfase?: string | null
  gebeurtenissen?: { id: string; gebeurtenis: string; vanFaseId?: string | null; naarFaseId: string | null; op: string }[]
  afspraken?: { id: string; eerste: boolean; status: 'gepland' | 'gehouden' | 'geannuleerd' | 'niet-verschenen'; op: string; overgedragen?: boolean; uitkomst?: string | null }[]
  campagnes?: { id: string; achterstand: number; naam?: string }[]
  ritme?: { actief: boolean; volgendePogingOp?: string | null; poging?: number; van?: number; kanaal?: string | null } | null
  signalen?: { id: string; soort: string; op: string; extern: boolean }[]
  tussendoelen?: { id: string; gehaaldOp: string }[]
  partnerLeads?: { id: string; deadline: string; bevestigd: boolean }[]
  jaarplanning?: { vensterEind: string; benaderdDitJaar: boolean } | null
  kvkMutaties?: { id: string; soort: string; op: string }[]
  /** 0064: gedeactiveerd; de motor en de droogloop slaan het account over. */
  gedeactiveerd?: boolean
  [k: string]: unknown
}

export interface TriggerUitslag { vuurt: boolean; reden: string; bewijs: string[]; sleutel?: string }

const DAG = 864e5
const dagenTussen = (a: string | Date, b: Date) => Math.floor((b.getTime() - (typeof a === 'string' ? Date.parse(a) : a.getTime())) / DAG)
const datumKort = (t: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', timeZone: 'Europe/Amsterdam' }).format(new Date(t))
const nee = (reden = ''): TriggerUitslag => ({ vuurt: false, reden, bewijs: [] })

/**
 * Vuurt de trigger van de regel voor dit onderwerp? Met een reden in gewone taal en
 * bewijs. `sleutel` maakt het onderwerp fijner dan het account (één opvolging per
 * afspraak, per gebeurtenis, per signaal).
 */
export function evaluateTrigger(regel: Pick<Regel, 'data'>, a: MotorAccount, nu: Date): TriggerUitslag {
  const p = { ...PATRONEN[regel.data.trigger.patroon]?.parameters, ...regel.data.trigger.parameters }
  switch (regel.data.trigger.patroon) {
    case 'datum-drempel': {
      const w = a[p.veld] as string | null | undefined
      if (!w) return nee()
      const d = -dagenTussen(w, nu)
      return d >= 0 && d <= Number(p.dagen) ? { vuurt: true, reden: `Over ${d} ${d === 1 ? 'dag' : 'dagen'}: ${datumKort(w)}`, bewijs: [`${p.veld} = ${w.slice(0, 10)}`] } : nee()
    }
    case 'inactiviteit': {
      if (p.alleenZonderDatum && a[p.veld]) return nee()
      const w = (a[p.veld] as string | null | undefined) ?? (p.ookZonderDatum || p.alleenZonderDatum ? a.aangemaaktOp : null)
      if (!w) return nee()
      const d = dagenTussen(w, nu)
      if (d < Number(p.dagen)) return nee()
      const zonder = !a[p.veld]
      return { vuurt: true, reden: zonder ? `Nog geen contact sinds het account er ${d} dagen geleden bij kwam` : `Al ${d} dagen geen contact`, bewijs: [zonder ? `aangemaakt ${a.aangemaaktOp.slice(0, 10)}` : `${p.veld} = ${w.slice(0, 10)}`] }
    }
    case 'ritme':
      return { vuurt: true, reden: a.klasseCode ? `Volgens de matrix voor klasse ${a.klasseCode}` : 'Volgens het ritme, zonder klasse', bewijs: [a.klasseCode ? `klasse ${a.klasseCode}` : 'zonder klasse'] }
    case 'gebeurtenis': {
      const hit = [...(a.gebeurtenissen ?? [])].sort((x, y) => y.op.localeCompare(x.op)).find((g) => (p.gebeurtenis ? g.gebeurtenis === p.gebeurtenis : true) && (p.fase ? g.naarFaseId === p.fase : !!p.gebeurtenis))
      return hit ? { vuurt: true, reden: p.fase ? `Fase betreden op ${datumKort(hit.op)}` : `Gebeurtenis "${hit.gebeurtenis}" op ${datumKort(hit.op)}`, bewijs: [`${hit.gebeurtenis} ${hit.op.slice(0, 10)}`], sleutel: `${a.id}:${hit.id}` } : nee()
    }
    case 'te-lang-in-fase': {
      if (!a.faseSinds || a.verwachtVerblijfDagen == null) return nee()
      const d = dagenTussen(a.faseSinds, nu)
      return d > a.verwachtVerblijfDagen + Number(p.marge ?? 0) ? { vuurt: true, reden: `Al ${d} dagen in deze fase; verwacht ${a.verwachtVerblijfDagen}`, bewijs: [`fase sinds ${a.faseSinds.slice(0, 10)}`], sleutel: `${a.id}:${a.faseId}` } : nee()
    }
    case 'lead-verlopen': {
      if (!a.dossierOp) return nee()
      const d = dagenTussen(a.dossierOp, nu)
      return d > Number(p.dagen) ? { vuurt: true, reden: `Het dossier is ${d} dagen oud`, bewijs: [`dossier ${a.dossierOp.slice(0, 10)}`] } : nee()
    }
    case 'jaarplanning-venster': {
      const j = a.jaarplanning
      return j && !j.benaderdDitJaar && Date.parse(j.vensterEind) < nu.getTime() ? { vuurt: true, reden: `Het venster liep tot ${datumKort(j.vensterEind)} en het account is dit jaar niet benaderd`, bewijs: [`venster tot ${j.vensterEind}`] } : nee()
    }
    case 'afspraak-niet-overgedragen': {
      const af = (a.afspraken ?? []).find((x) => x.eerste && x.status === 'gehouden' && !x.overgedragen && !x.uitkomst && dagenTussen(x.op, nu) >= Number(p.werkdagen))
      return af ? { vuurt: true, reden: `De eerste afspraak van ${datumKort(af.op)} is nog niet overgedragen`, bewijs: [`afspraak ${af.op.slice(0, 10)}`], sleutel: `${a.id}:${af.id}` } : nee()
    }
    case 'afspraak-onvoldoende-gekwalificeerd': {
      const af = (a.afspraken ?? []).find((x) => x.eerste && x.status === 'gepland' && -dagenTussen(x.op, nu) <= Number(p.dagenVooraf) && -dagenTussen(x.op, nu) >= 0)
      return af && (a.bandScore ?? 0) <= 1 ? { vuurt: true, reden: `Eerste afspraak op ${datumKort(af.op)} en BAND ${a.bandScore ?? 0} van 4`, bewijs: [`BAND ${a.bandScore ?? 0}/4`], sleutel: `${a.id}:${af.id}` } : nee()
    }
    case 'campagne-achterstand': {
      const ca = (a.campagnes ?? []).find((x) => x.achterstand >= Number(p.marge))
      // Eén inzicht per campagne (niet per account), met het advies "Begin hier" op het bord.
      return ca ? { vuurt: true, reden: `De campagne ${ca.naam ? `${ca.naam} ` : ''}loopt ${ca.achterstand} punten achter. Begin met de drie accounts onder Begin hier`, bewijs: [`campagne ${ca.id}`], sleutel: `campagne:${ca.id}` } : nee()
    }
    case 'hercontact-vervolg': {
      const r = a.ritme
      return r?.actief && r.volgendePogingOp && Date.parse(r.volgendePogingOp) <= nu.getTime() ? { vuurt: true, reden: `Poging ${r.poging ?? '?'} van ${r.van ?? '?'} is aan de beurt`, bewijs: [`volgende poging ${r.volgendePogingOp.slice(0, 10)}`], sleutel: `${a.id}:poging-${r.poging}` } : nee()
    }
    case 'geparkeerd-terug':
      return a.terugOp && a.terugOp <= nu.toISOString().slice(0, 10) && ['wachtend', 'nee'].includes(a.nbStatus)
        ? { vuurt: true, reden: `De terugkomdatum (${datumKort(a.terugOp)}) is bereikt`, bewijs: [`terug op ${a.terugOp}`], sleutel: `${a.id}:terug-${a.terugOp}` } : nee()
    case 'trigger-heractivatie': {
      if (!p.ookInReis && !['wachtend', 'nee'].includes(a.nbStatus)) return nee()
      const soorten: string[] = p.signaalsoorten ?? []
      const s = (a.signalen ?? []).find((x) => x.extern && soorten.includes(x.soort) && dagenTussen(x.op, nu) <= 30)
      if (!s) return nee()
      if (!magBenaderen({ nbStatus: a.nbStatus, data: { nee: a.nee, wachtendTot: a.wachtendTot } }, 'bellen', nu).mag && a.nbStatus === 'nee') return nee('afkoeling loopt')
      return { vuurt: true, reden: `Nieuw signaal: ${s.soort} (${datumKort(s.op)})`, bewijs: [`${s.soort} ${s.op.slice(0, 10)}`], sleutel: `${a.id}:${s.id}` }
    }
    case 'tussendoel-gehaald': {
      const t = (a.tussendoelen ?? [])[0]
      return t ? { vuurt: true, reden: `Tussendoel gehaald op ${datumKort(t.gehaaldOp)}`, bewijs: [t.id], sleutel: `${a.id}:${t.id}` } : nee()
    }
    case 'partner-te-laat': {
      const l = (a.partnerLeads ?? []).find((x) => !x.bevestigd && Date.parse(x.deadline) < nu.getTime())
      return l ? { vuurt: true, reden: `De partner bevestigde de lead niet voor ${datumKort(l.deadline)}`, bewijs: [l.id], sleutel: `${a.id}:${l.id}` } : nee()
    }
    case 'reis-overgang': {
      // Eén keer per overgang (de regel in de reisgeschiedenis); de nieuwste telt.
      const hit = [...(a.gebeurtenissen ?? [])].sort((x, y) => y.op.localeCompare(x.op)).find((g) => g.naarFaseId && g.naarFaseId !== g.vanFaseId
        && (!p.vanFase || g.vanFaseId === p.vanFase) && (!p.naarFase || g.naarFaseId === p.naarFase) && (!p.gebeurtenis || g.gebeurtenis === p.gebeurtenis))
      return hit ? { vuurt: true, reden: `Overgang in de reis op ${datumKort(hit.op)}`, bewijs: [`${hit.vanFaseId ?? 'instap'} > ${hit.naarFaseId} (${hit.gebeurtenis}) ${hit.op.slice(0, 10)}`], sleutel: `${a.id}:${hit.id}` } : nee()
    }
  }
  return nee('onbekend patroon')
}

/** Raakt de regel dit account? Elke afbakening filtert echt (gat 6), plus scope en afkoeling. */
export function ruleTargetsAccount(regel: Pick<Regel, 'data' | 'scope' | 'eigenaarId' | 'teamId' | 'reisId' | 'faseId'>, a: MotorAccount, nu = new Date()): boolean {
  // Dealtrace is new business: de motor maakt nooit taken of inzichten voor klanten. Het
  // onderhoudsritme en winback van klanten lopen in DealDrive (testronde, Prospects of klanten).
  if (a.type === 'klant') return false
  const b = regel.data.afbakening ?? {}
  if (b.accounttypes?.length && !b.accounttypes.includes(a.type)) return false
  if (b.statussen?.length && !b.statussen.includes(a.nbStatus)) return false
  const reisIds = [...(b.reisIds ?? []), ...(regel.reisId ? [regel.reisId] : [])]
  if (reisIds.length && (!a.reisId || !reisIds.includes(a.reisId))) return false
  const faseIds = [...(b.faseIds ?? []), ...(regel.faseId ? [regel.faseId] : [])]
  if (faseIds.length && (!a.faseId || !faseIds.includes(a.faseId))) return false
  if (b.doelgroepIds?.length && (!a.doelgroepId || !b.doelgroepIds.includes(a.doelgroepId))) return false
  if (b.campagneIds?.length && !(a.campagneIds ?? []).some((c) => b.campagneIds!.includes(c))) return false
  if (b.klassen?.length && !b.klassen.includes(a.klasseCode ?? '') && !b.klassen.includes(a.klasse ?? '')) return false
  // Uitvoerderrol binnendienst of buitendienst: alleen accounts van iemand met die werkplek.
  const rol = regel.data.gevolg?.uitvoerderrol
  if ((rol === 'binnendienst' || rol === 'buitendienst') && a.ownerWerkplek && a.ownerWerkplek !== rol) return false
  if (regel.scope === 'persoonlijk' && (!regel.eigenaarId || a.ownerId !== regel.eigenaarId)) return false
  if (regel.scope === 'team' && (!regel.teamId || a.ownerTeamId !== regel.teamId)) return false
  // Geen contacttaak in afkoeling op dat kanaal (7.2).
  const kanaal = KANAAL_VAN_ACTIE[regel.data.gevolg?.actiesoort]
  if (kanaal && regel.data.activiteit === 'taak' && !magBenaderen({ nbStatus: a.nbStatus, data: { nee: a.nee, wachtendTot: a.wachtendTot } }, kanaal, nu, { belMeNiet: a.belMeNiet }).mag) return false
  return true
}

/** Mag de regel weer vuren voor dit onderwerp? 0 = Continu. Precies op de grens: ja. */
export function cadansVerstreken(cadansDagen: number, laatst: string | Date | null | undefined, nu: Date): boolean {
  if (!laatst || cadansDagen <= 0) return true
  return dagenTussen(laatst, nu) >= cadansDagen
}

/** Onbekende variabelen in een taaksjabloon (fout bij opslaan). */
export function sjabloonFouten(sjabloon: string): string[] {
  return [...sjabloon.matchAll(/\{([^}]*)\}/g)].map((m) => m[1]!).filter((v) => !(SJABLOON_VARIABELEN as readonly string[]).includes(v)).map((v) => `Onbekende variabele {${v}}`)
}

export function vulSjabloon(sjabloon: string, ctx: { account?: string | null; contact?: string | null; afspraak?: string | null; winpunt?: string | null }): string {
  const leeg: Record<string, string> = { account: 'het account', contact: 'de contactpersoon', afspraak: 'de afspraak', winpunt: 'het winpunt' }
  return sjabloon.replace(/\{(account|contact|afspraak|winpunt)\}/g, (_, k: string) => (ctx as any)[k] || leeg[k]!).trim()
}

/** Een winpunt zoals de motor het kent: met de hoofdfase van de reis waar het bij hoort (uit de fase van het verkoopverhaal). */
export interface RegelWinpunt { id: string; titel: string; omschrijving?: string | null; hoofdfase?: string | null; actief?: boolean }

/**
 * Het winpunt dat de taak van deze regel voor dit account als gespreksonderwerp meekrijgt: van de gekoppelde
 * winpunten (in de volgorde van de regel) het eerste dat bij de hoofdfase van het account past, anders het eerste.
 * Zonder gekoppelde of nog actieve winpunten: null.
 */
export function winpuntVoorRegel(regel: Pick<Regel, 'data'>, a: Pick<MotorAccount, 'hoofdfase'>, winpunten: RegelWinpunt[]): RegelWinpunt | null {
  const ids = regel.data.gevolg?.winpuntIds ?? []
  if (!ids.length) return null
  const per = new Map(winpunten.filter((w) => w.actief !== false).map((w) => [w.id, w]))
  const gekoppeld = ids.map((id) => per.get(id)).filter((w): w is RegelWinpunt => !!w)
  if (!gekoppeld.length) return null
  return (a.hoofdfase && gekoppeld.find((w) => w.hoofdfase === a.hoofdfase)) || gekoppeld[0]!
}

const zinVan = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
/** Herhaalt de reden de omschrijving? Letterparen (Dice) van 70 procent of meer tellen als herhaling (B16). */
const herhaalt = (omschrijving: string, reden: string) => dice(zinVan(omschrijving), zinVan(reden)) >= 0.7

/** "Waarom krijg ik dit?" in gewone taal: omschrijving plus de trigger, zonder dezelfde reden twee keer. */
export function waaromTekst(regel: Pick<Regel, 'naam' | 'data'>, uitslag: Pick<TriggerUitslag, 'reden'>): string {
  const basis = regel.data.omschrijving || regel.naam
  const reden = uitslag.reden && !herhaalt(basis, uitslag.reden) ? ` ${uitslag.reden}.` : ''
  return `${basis}${reden}`.replace(/\.\./g, '.').trim().replace(/([^.!?])$/, '$1.')
}

export function triggerInWoorden(regel: Pick<Regel, 'data'>): string {
  const info = PATRONEN[regel.data.trigger.patroon]
  if (!info) return ''
  const p = { ...info.parameters, ...regel.data.trigger.parameters }
  return `Vuurt als ${info.vuurtAls.replace(/\{(\w+)\}/g, (_, k) => String(p[k] ?? ''))}.`
}

/** Controle bij opslaan: trigger, sjabloon en keuzelijsten. */
export function valideerRegel(r: Partial<Regel>): string[] {
  const f: string[] = []
  if (!r.naam?.trim()) f.push('Naam ontbreekt')
  if (!r.data?.trigger?.patroon || !(PATROON_SLEUTELS as readonly string[]).includes(r.data.trigger.patroon)) f.push('Kies een triggerpatroon')
  if (r.data?.gevolg) {
    if (!(ACTIESOORTEN as readonly string[]).includes(r.data.gevolg.actiesoort)) f.push('Onbekende actiesoort')
    if (!(UITVOERDERROLLEN as readonly string[]).includes(r.data.gevolg.uitvoerderrol)) f.push('Onbekende uitvoerderrol')
    f.push(...sjabloonFouten(r.data.gevolg.taaksjabloon ?? ''))
  } else f.push('Gevolg ontbreekt')
  if (r.data && !['inzicht', 'taak'].includes(r.data.activiteit)) f.push('Activiteit is Inzicht of Taak')
  if (r.cadansDagen !== undefined && !CADANSEN.some((c) => c.dagen === r.cadansDagen)) f.push('Onbekende cadans')
  if (r.motor === 'ai' && r.cadansDagen !== undefined && r.cadansDagen < 7) f.push('AI-regels draaien minimaal wekelijks')
  if (r.prioriteit && !(PRIORITEITEN as readonly string[]).includes(r.prioriteit)) f.push('Onbekende prioriteit')
  if (r.data?.trigger?.patroon === 'reis-overgang') {
    const p = r.data.trigger.parameters ?? {}
    if (!p.vanFase && !p.naarFase && !p.gebeurtenis) f.push('Kies bij een overgang in de reis minstens een fase of gebeurtenis')
  }
  if ((r.data?.gevolg?.winpuntIds?.length ?? 0) > 5) f.push('Koppel hooguit vijf winpunten')
  return f
}

const RITME_PATRONEN = new Set(['ritme', 'hercontact-vervolg'])
const CONTACT_ACTIE = new Set(['bellen', 'mailen', 'linkedin', 'bezoek', 'bericht', 'sms'])

/** De matrices en lopende ritmes die de poort van een regel nodig heeft. */
export interface PoortContext {
  belmatrix?: Matrix | null
  afspraakmatrix?: Matrix | null
  /** Accounts met een lopend ritme (hercontact of matrix) van een regel. */
  ritmeVan?: Map<string, string>
}

/**
 * De poort van de motor voor één regel en één account, gedeeld door motor en droogloop (B05): afbakening,
 * geen losse contacttaak naast een lopend hercontactritme, de matrix als poort en cadans voor een
 * ritmeregel (bellen uit de belmatrix, bezoek uit de rij Bezoek van de afspraakmatrix, B06) en nooit
 * twee ritmes op één account. Geeft de cadans in dagen, of null als de regel dit account overslaat.
 */
export function regelPoort(regel: Regel, a: MotorAccount, nu: Date, ctx: PoortContext = {}): { cadans: number } | null {
  if (a.gedeactiveerd) return null
  if (!ruleTargetsAccount(regel, a, nu)) return null
  const patroon = regel.data.trigger.patroon
  if (a.ritme?.actief && regel.data.activiteit === 'taak' && CONTACT_ACTIE.has(regel.data.gevolg.actiesoort) && !RITME_PATRONEN.has(patroon)) return null
  if (a.ritme?.actief && patroon === 'ritme' && regel.data.activiteit === 'taak') return null
  let cadans = regel.cadansDagen
  // Ritme: een ingevulde matrix is de poort; 0 is bewust uit, niet ingesteld valt terug op de standaard (gat 8, 43).
  if (patroon === 'ritme' && regel.data.trigger.parameters?.matrix !== false) {
    const soort = regel.data.trigger.parameters?.actiesoort ?? regel.data.gevolg.actiesoort
    const cel = soort === 'bezoek'
      ? geldendeCel(ctx.afspraakmatrix, 'bezoek', a.klasseCode ?? null, AFSPRAAKMATRIX_STANDAARD)
      : geldendeCel(ctx.belmatrix, a.type, a.klasseCode ?? null, BELMATRIX_STANDAARD)
    const interval = intervalDagen(cel)
    if (!interval) return null
    cadans = interval
  }
  if (RITME_PATRONEN.has(patroon) && regel.data.activiteit === 'taak') {
    const ander = ctx.ritmeVan?.get(a.id)
    const eigen = ander === regel.id || (ander === 'hercontact' && patroon === 'hercontact-vervolg')
    if (ander && !eigen) return null
  }
  return { cadans }
}

export interface DroogloopAccount { id: string; naam: string; ownerId: string | null; reden: string; maaktTaak: boolean; winpuntId: string | null }
export interface Droogloop { geraakt: number; taken: number; perPersoon: Record<string, number>; vraagtBevestiging: boolean; accounts: DroogloopAccount[] }

/** Wat de regel nu zou doen: hoeveel accounts hij raakt en hoeveel taken de volgende run maakt, met dezelfde poort als de motor. */
export function droogloop(
  regel: Regel, accounts: MotorAccount[], nu: Date,
  geschiedenis: { laatst: Map<string, string>; open: Set<string> } = { laatst: new Map(), open: new Set() },
  eigenaarVan: (a: MotorAccount) => string | null = (a) => a.ownerId ?? null,
  poort: PoortContext = {},
  winpunten: RegelWinpunt[] = [],
): Droogloop {
  let geraakt = 0
  let taken = 0
  const perPersoon: Record<string, number> = {}
  const lijst: DroogloopAccount[] = []
  for (const a of accounts) {
    const p = regelPoort(regel, a, nu, poort)
    if (!p) continue
    const u = evaluateTrigger(regel, a, nu)
    if (!u.vuurt) continue
    geraakt++
    const sleutel = u.sleutel ?? a.id
    const maaktTaak = !(geschiedenis.open.has(`${regel.id}|${sleutel}`) || !cadansVerstreken(p.cadans, geschiedenis.laatst.get(`${regel.id}|${sleutel}`), nu))
    lijst.push({ id: a.id, naam: a.naam, ownerId: eigenaarVan(a), reden: u.reden, maaktTaak, winpuntId: winpuntVoorRegel(regel, a, winpunten)?.id ?? null })
    if (!maaktTaak) continue
    taken++
    const wie = eigenaarVan(a) ?? 'niemand'
    perPersoon[wie] = (perPersoon[wie] ?? 0) + 1
  }
  // Eerst wat de volgende run echt maakt, dan op naam.
  lijst.sort((x, y) => Number(y.maaktTaak) - Number(x.maaktTaak) || x.naam.localeCompare(y.naam))
  return { geraakt, taken, perPersoon, vraagtBevestiging: Object.values(perPersoon).some((n) => n > 50), accounts: lijst }
}

/** Leerlus: onder 20 procent acceptatie over 30 dagen (bij minstens 10 voorstellen) is ruis. */
export function regelLevertRuis(log: { status: string; op: string }[], nu: Date): { ruis: boolean; acceptatie: number; aantal: number } {
  const recent = log.filter((x) => dagenTussen(x.op, nu) <= 30 && ['omgezet', 'afgewezen', 'genegeerd', 'klaar', 'geannuleerd'].includes(x.status))
  const goed = recent.filter((x) => x.status === 'omgezet' || x.status === 'klaar').length
  const acceptatie = recent.length ? goed / recent.length : 1
  return { ruis: recent.length >= 10 && acceptatie < 0.2, acceptatie, aantal: recent.length }
}
