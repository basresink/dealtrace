// Audit (P21, F23): soorten om op te filteren, leesbare teksten per handeling en de CSV-export.
// Server en scherm gebruiken dezelfde lijst; /audit (salesmanager) en /instellingen/audit (beheerder)
// tonen dezelfde lijst met dezelfde filters.

/** Soort -> patronen voor `action like`. */
export const AUDIT_SOORTEN: Record<string, string[]> = {
  fase: ['reis.%', 'account.fase%'],
  eigenaar: ['account.eigenaar'],
  niveau: ['gebruiker.niveau%', 'gebruikers.niveau%'],
  gebruikers: ['gebruiker.%', 'gebruikers.%', 'team.%'],
  instellingen: ['instelling.%', 'mailsjabloon.%', 'koppeling.%', 'agent.%', 'agents.%', 'eigenVeld.%', 'reekssjabloon.%', 'verkoopverhaal.%', 'toegang%'],
  regels: ['regel%'],
  scripts: ['belscript%'],
  reizen: ['reis%'],
  verwijderingen: ['%verwijder%', '%.archiveer%', '%.deactiveren'],
  leverancier: ['leverancier.%'],
}
export const AUDIT_SOORT_LABEL: Record<string, string> = {
  fase: 'Fase', eigenaar: 'Eigenaar', niveau: 'Niveau', gebruikers: 'Gebruikers en teams', instellingen: 'Instellingen',
  regels: 'Regels', scripts: 'Scripts', reizen: 'Reizen', verwijderingen: 'Verwijderen en archiveren', leverancier: 'Wat Dealtrace deed',
}

/** Perioden voor het filter; `van` is een datum (yyyy-mm-dd) die het scherm uitrekent. */
export const AUDIT_PERIODEN = [
  { sleutel: '7', label: '7 dagen', dagen: 7 },
  { sleutel: '30', label: '30 dagen', dagen: 30 },
  { sleutel: '90', label: '90 dagen', dagen: 90 },
] as const

/** Regels per pagina; met `voor=` haal je de volgende pagina. */
export const AUDIT_PAGINA = 50
/** Meer regels dan dit gaan niet in één CSV. */
export const AUDIT_CSV_MAX = 10_000

const VAST: Record<string, string> = {
  'leverancier.werkin.start': 'Dealtrace begon te werken in je organisatie',
  'leverancier.werkin.modus': 'Dealtrace wisselde van modus',
  'leverancier.werkin.einde': 'Dealtrace stopte met werken in je organisatie',
  'leverancier.werkin.verzoek': 'Dealtrace vroeg toegang',
  'leverancier.pakket.wijzigen': 'Pakket gewijzigd door Dealtrace',
  'leverancier.contract.wijzigen': 'Contract gewijzigd door Dealtrace',
  'leverancier.gebruikersstand.wijzigen': 'Stand voor nieuwe gebruikers gewijzigd',
  'leverancier.klant.aanmaken': 'Organisatie aangemaakt',
  'leverancier.startset.aanvullen': 'Startset aangevuld',
  'leverancier.aanvraag.goedkeuren': 'Gebruikersaanvraag goedgekeurd',
  'leverancier.aanvraag.afwijzen': 'Gebruikersaanvraag afgewezen',
  'leverancier.feature.zetten': 'Functie per niveau gewijzigd door Dealtrace',
  'leverancier.feature.standaard': 'Functie per niveau teruggezet door Dealtrace',
  'toegangLeverancier.wijzigen': 'Toegang leverancier gewijzigd',
  'toegangsverzoek.goedkeuren': 'Toegangsverzoek goedgekeurd',
  'toegangsverzoek.afwijzen': 'Toegangsverzoek afgewezen',
  'gebruiker.aanvragen': 'Gebruiker aangevraagd',
  'gebruiker.toevoegen': 'Gebruiker toegevoegd',
  'instelling.wijzigen': 'Instelling gewijzigd',
  'abonnement.upgradeAanvragen': 'Upgrade aangevraagd',
  'mailsjabloon.bewaren': 'Mailsjabloon bewaard',
  'mailsjabloon.aan': 'Mailsjabloon aangezet',
  'mailsjabloon.uit': 'Mailsjabloon uitgezet',
  'koppeling.agenda': 'Agendakoppeling voor de organisatie gewijzigd',
  'agents.pauzeren': 'Agents gepauzeerd',
  'agents.hervatten': 'Agents hervat',
  'agent.mandaat': 'Mandaat van een agent gewijzigd',
}

const OBJECT: Record<string, string> = {
  account: 'Prospect', reis: 'Reis', reeks: 'Opvolgreeks', taak: 'Taak', belblok: 'Belblok', verkoopverhaal: 'Verkoopverhaal',
  document: 'Document', afspraak: 'Afspraak', eigenVeld: 'Eigen veld', planning: 'Planning', belscript: 'Belscript', contact: 'Contact',
  weekreview: 'Weekreview', import: 'Import', campagne: 'Campagne', gebruiker: 'Gebruiker', reekssjabloon: 'Reekssjabloon', agent: 'Agent',
  accountplan: 'Accountplan', doelgroep: 'Doelgroep', regel: 'Regel', regels: 'Regels', team: 'Team', mailsjabloon: 'Mailsjabloon',
}
const WERKWOORD: Record<string, string> = {
  aanmaken: 'aangemaakt', maken: 'gemaakt', toevoegen: 'toegevoegd', hernoemen: 'hernoemd', heractiveer: 'weer actief', gemaakt: 'gemaakt', wijzigen: 'gewijzigd', gewijzigd: 'gewijzigd', verwijderen: 'verwijderd',
  archiveren: 'gearchiveerd', archiveer: 'gearchiveerd', deactiveren: 'gedeactiveerd', heractiveren: 'weer actief', gestart: 'gestart',
  gestopt: 'gestopt', gepauzeerd: 'gepauzeerd', hervat: 'hervat', uploaden: 'geüpload', plannen: 'gepland', verplaatsen: 'verplaatst',
  geannuleerd: 'geannuleerd', activeren: 'actief gezet', inplannen: 'ingepland', bevestig: 'bevestigd', verslag: 'verslag vastgelegd',
  transcript: 'transcript vastgelegd', terugdraaien: 'teruggedraaid', verwerken: 'verwerkt', gevuld: 'gevuld', niveau: 'niveau gewijzigd',
  eigenaar: 'eigenaar gewijzigd', klasse: 'klasse gewijzigd', profiel: 'profiel gewijzigd', starterset: 'starterset geladen', startset: 'startset geladen',
}

/** Leesbare tekst voor een handeling; onbekend blijft de technische naam. */
export function actieTekst(actie: string): string {
  if (VAST[actie]) return VAST[actie]!
  const [obj, ww] = actie.split('.')
  if (obj && ww && OBJECT[obj] && WERKWOORD[ww]) return `${OBJECT[obj]} ${WERKWOORD[ww]}`
  return actie
}

export interface AuditRegel {
  id: string
  op: string
  actie: string
  object: string | null
  objectId: string | null
  door: string
  doorId: string | null
  leverancier: boolean
  reden: string | null
}

/** Een veld voor CSV: puntkomma als scheiding (Excel in het Nederlands), aanhalingstekens en geen formules. */
export function csvVeld(v: unknown): string {
  let s = v == null ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** De CSV van een auditlijst, met een BOM zodat Excel de tekens goed leest. */
export function auditCsv(regels: AuditRegel[]): string {
  const kop = ['Wanneer', 'Wie', 'Door Dealtrace', 'Handeling', 'Omschrijving', 'Object', 'Object-id', 'Reden']
  const rijen = regels.map((r) => [r.op, r.door, r.leverancier ? 'ja' : 'nee', r.actie, actieTekst(r.actie), r.object ?? '', r.objectId ?? '', r.reden ?? ''])
  return `﻿${[kop, ...rijen].map((rij) => rij.map(csvVeld).join(';')).join('\r\n')}\r\n`
}

/** Cursor voor de volgende pagina: tijdstip en id van de laatste regel. */
export const auditCursor = (r: Pick<AuditRegel, 'op' | 'id'>) => `${r.op}|${r.id}`
export function leesCursor(v: unknown): { op: string; id: string } | null {
  if (typeof v !== 'string') return null
  const i = v.lastIndexOf('|')
  if (i < 1) return null
  const op = v.slice(0, i)
  if (Number.isNaN(Date.parse(op))) return null
  return { op, id: v.slice(i + 1) }
}
