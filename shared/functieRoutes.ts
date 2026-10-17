// Welke functie hoort bij welk scherm (wens opdrachtgever: staat een functie uit, dan
// laat de app de functie, de knop en elke link ernaar niet zien).
//
// Eén lijst voor client en server: de client verbergt elke ingang naar een pad
// waarvan de functie uit staat (useFunctie().magNaar), de layout toont bij een
// directe URL de pagina "Nog niet aangezet", en de server laat in zoeken, help en
// e-mails geen link naar zo'n scherm zien. De zijbalkroutes uit de catalogus tellen
// automatisch mee; hieronder staan de schermen die een eigen functie bewaken.

import { FUNCTIES } from './functies'

export interface RouteFunctie {
  /** Het pad; ook elk subpad telt mee, behalve bij `exact`. */
  pad: string
  /** Minstens een van deze functies moet aanstaan. */
  eenVan: readonly string[]
  exact?: boolean
}

/** Schermen met een eigen functie, los van de zijbalk (de bewaking op de pagina zelf). */
const SCHERMEN: readonly RouteFunctie[] = [
  { pad: '/dagstart', eenVan: ['dagritme.dagstart'] },
  { pad: '/weekstart', eenVan: ['dagritme.weekstart'] },
  { pad: '/weekreview', eenVan: ['dagritme.weekreview'] },
  { pad: '/meeting-analyse', eenVan: ['agenda.meetingAnalyse'] },
  { pad: '/bezoek-analyse', eenVan: ['regio.analyse'] },
  { pad: '/analyse/regio', eenVan: ['regio.analyse'] },
  { pad: '/kennisbank', eenVan: ['nav.kennisbank'] },
  { pad: '/concepten', eenVan: ['concepten.inbox'] },
  { pad: '/belblokken', eenVan: ['belblok.uitvoeren'] },
  { pad: '/bellen', eenVan: ['belblok.uitvoeren'] },
  { pad: '/belscripts', eenVan: ['belscript.kiezen'] },
  { pad: '/data-kwaliteit', eenVan: ['data.kwaliteit'] },
  { pad: '/funnel', eenVan: ['funnel.eigen'] },
  { pad: '/campagnes', eenVan: ['campagnes.meedoen'] },
  { pad: '/campagnes/nieuw', eenVan: ['campagnes.maken'] },
  { pad: '/leadgenerator', eenVan: ['nav.leadgenerator', 'leads.overnemen', 'leads.kvk', 'leads.aiZoeker'] },
  { pad: '/prospects', eenVan: ['prospects.lijst'] },
  { pad: '/klanten', eenVan: ['prospects.lijst'] },
  { pad: '/contacten', eenVan: ['contacten.basis'] },
  { pad: '/instellingen', eenVan: ['nav.instellingen'], exact: true },
  { pad: '/instellingen/gebruikers', eenVan: ['nav.instellingen'] },
  { pad: '/instellingen/regels', eenVan: ['regels.lezen', 'regels.team', 'regels.beheer'] },
  { pad: '/instellingen/koppelingen/dealdrive', eenVan: ['koppelingen.dealdrive'] },
  { pad: '/instellingen/koppelingen/crm', eenVan: ['koppeling.crm', 'koppeling.crmSync'] },
  { pad: '/instellingen/koppelingen/salesdna', eenVan: ['koppeling.salesdna'] },
  { pad: '/instellingen/meetingsoorten', eenVan: ['instellingen.meetingsoorten'] },
  { pad: '/instellingen/kanalen', eenVan: ['instellingen.kanalen'] },
  { pad: '/instellingen/waarnemer', eenVan: ['agents.lezen'] },
  { pad: '/instellingen/agents', eenVan: ['agents.lezen', 'agents.beheer'] },
  { pad: '/instellingen/funnel-normen', eenVan: ['instellingen.funnelNormen'] },
  { pad: '/instellingen/gebieden', eenVan: ['instellingen.gebieden'] },
  { pad: '/instellingen/mailsjablonen', eenVan: ['instellingen.mailsjablonen'] },
  { pad: '/instellingen/mijn-scripts', eenVan: ['belscript.variant'] },
  { pad: '/instellingen/terugkomen', eenVan: ['verkoopverhaal.inrichten', 'verkoopverhaal.mappings', 'instellingen.afkoeling', 'ritme.beheer'] },
  { pad: '/instellingen/nee-redenen', eenVan: ['verkoopverhaal.inrichten', 'verkoopverhaal.mappings', 'instellingen.afkoeling', 'ritme.beheer'] },
  { pad: '/instellingen/mail', eenVan: ['koppeling.mail'] },
  { pad: '/instellingen/prompts', eenVan: ['instellingen.prompts'] },
  { pad: '/instellingen/help', eenVan: ['help.eigenArtikelen'] },
  { pad: '/instellingen/belscripts', eenVan: ['belscript.kiezen'] },
  { pad: '/instellingen/campagnesoorten', eenVan: ['instellingen.campagnesoorten'] },
  { pad: '/instellingen/opvolgreeksen', eenVan: ['instellingen.opvolgreeksen'] },
  { pad: '/instellingen/abonnement', eenVan: ['instellingen.abonnement'] },
  { pad: '/instellingen/audit', eenVan: ['instellingen.audit'] },
  { pad: '/instellingen/eigen-velden', eenVan: ['eigenVelden.beheren'] },
  { pad: '/instellingen/verbruik', eenVan: ['credits.verbruikLezen'] },
  { pad: '/instellingen/verkoopverhaal', eenVan: ['verkoopverhaal.inrichten'] },
]

/** Zijbalkroutes: Vandaag alleen exact, Instellingen staat hierboven, Platformbeheer hangt niet aan een organisatie. */
const ZIJBALK: readonly RouteFunctie[] = FUNCTIES
  .filter((f) => f.zijbalk && f.sleutel !== 'nav.platform' && f.sleutel !== 'nav.instellingen')
  .map((f) => ({ pad: f.zijbalk!.route, eenVan: [f.sleutel], ...(f.zijbalk!.route === '/' ? { exact: true } : {}) }))

export const ROUTE_FUNCTIES: readonly RouteFunctie[] = [...ZIJBALK, ...SCHERMEN]

/** Alleen het pad: zonder query, hash en slotslash. Externe links en lege paden geven null. */
export function kaalPad(link: string | null | undefined): string | null {
  if (!link || !link.startsWith('/') || link.startsWith('//')) return null
  const pad = link.split(/[?#]/)[0]!
  return pad.length > 1 ? pad.replace(/\/+$/, '') : pad
}

function past(r: RouteFunctie, pad: string): boolean {
  return pad === r.pad || (!r.exact && pad.startsWith(`${r.pad}/`))
}

/** De regels die voor dit pad gelden; elke regel moet kloppen. */
export function functiesVoorPad(link: string | null | undefined): RouteFunctie[] {
  const pad = kaalPad(link)
  if (!pad) return []
  return ROUTE_FUNCTIES.filter((r) => past(r, pad))
}

/**
 * Mag een link naar dit pad getoond worden? Elke regel die past, moet minstens een
 * functie hebben die aanstaat. Een pad zonder regel (Account, help, platform) mag altijd.
 */
export function magNaarPad(link: string | null | undefined, aan: (sleutel: string) => boolean): boolean {
  return functiesVoorPad(link).every((r) => r.eenVan.some(aan))
}

/** De eerste functie die uit staat voor dit pad, voor de pagina "Nog niet aangezet". */
export function uitgezetVoorPad(link: string | null | undefined, aan: (sleutel: string) => boolean): string | null {
  const r = functiesVoorPad(link).find((x) => !x.eenVan.some(aan))
  return r ? r.eenVan[0]! : null
}
