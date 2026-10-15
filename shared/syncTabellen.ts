// Tabellen die de client via de sync-wachtrij (POST /api/sync/mutations) mag
// schrijven. Eén lijst voor de server, check:rechten en de tests. `users` staat
// hier nooit in. Latere prompts voegen hun tabellen toe, met het onderdeel uit
// de rechtenmatrix waaronder ze vallen.

export const SYNCBARE_TABELLEN = {
  notificaties: 'notificaties',
  persoonlijke_instellingen: 'persoonlijk',
  // P05: alleen de mutatiesoorten account.nee en account.pauzeer, zodat "Zet nee"
  // offline kan (8.8). Een fasewissel gaat nooit rechtstreeks, alleen via het meldpunt.
  accounts: 'prospects',
  // P07: taken (taak.afronden, taak.uitstellen) en inzichten (gelezen, afwijzen).
  tasks: 'taken',
  signals: 'taken',
  // P09: "Markeer als gelezen" in het helpcenter, ook offline (recordId = artikel-id).
  help_gelezen: 'persoonlijk',
  // P32: signaalbesluiten op Vandaag (Gedaan, Later, Weg), ook offline; recordId = signaalsleutel.
  signaal_besluiten: 'persoonlijk',
  // P13: afspraak plannen (afspraak.nieuw) en afronden (afspraak.afronden), ook offline; recordId = afspraak-id.
  appointments: 'afspraken',
  // P14: een kans overslaan (recordId = account-id) en klaarzetten voor de buitendienst (recordId = account-id).
  kans_overslaan: 'prospects',
  klaargezet_voor: 'prospects',
  // P31: een spraakopdracht bewaren (recordId = conceptsleutel) of een offline opname laten verwerken;
  // een contact uit een visitekaartje (recordId = account-id).
  spraak_concepten: 'taken',
  contacts: 'prospects',
  // P16: een kolomwissel op het campagnebord (campagne.kolom), ook offline; recordId = campagne-id:account-id.
  campagne_items: 'campagnes',
  // P18: een concept goedkeuren of verwerpen (concept.besluit, recordId = concept-id) en eigen briefingtekst
  // (briefing.tekst, recordId = onderwerp:id:blok). Versturen wacht op verbinding.
  concepten: 'taken',
  briefing_teksten: 'taken',
} as const

export const ACCOUNT_MUTATIESOORTEN = ['account.nee', 'account.pauzeer'] as const
export const TAAK_MUTATIESOORTEN = ['taak.afronden', 'taak.uitstellen'] as const
export const INZICHT_MUTATIESOORTEN = ['inzicht.gelezen', 'inzicht.afwijzen'] as const
export const SIGNAAL_MUTATIESOORTEN = ['signaal.besluit'] as const
export const AFSPRAAK_MUTATIESOORTEN = ['afspraak.nieuw', 'afspraak.afronden', 'bezoek.afronden', 'inloop.vastleggen'] as const
export const SPRAAK_MUTATIESOORTEN = ['spraak.opdracht', 'contact.uitVisitekaartje'] as const
export const CAMPAGNE_MUTATIESOORTEN = ['campagne.kolom'] as const
export const CONCEPT_MUTATIESOORTEN = ['concept.besluit', 'briefing.tekst'] as const
export const KANS_MUTATIESOORTEN = ['kans.overslaan', 'kans.klaarzetten'] as const

export type SyncbareTabel = keyof typeof SYNCBARE_TABELLEN

export function isSyncbareTabel(v: unknown): v is SyncbareTabel {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SYNCBARE_TABELLEN, v)
}
