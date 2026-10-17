// De vaste lijst instellingssleutels (bouwplan F22). Een onbekende sleutel
// wordt geweigerd. VERBORGEN_KEYS beheert de leverancier: ze worden aan de
// leeskant gefilterd en aan de schrijfkant geweigerd.

export const SETTING_KEYS = [
  'organisatie', // {naam, logo, land, verkoopjaarStartmaand}
  'werkdagen', // WerkdagInstelling
  'niveaus', // {iedereenAlles, standaardNiveauNieuweGebruiker}
  'klassen', // [{id, naam, omschrijving, tabblad}] (F03, gat 2)
  'afkoeling', // {bellen, mail, linkedin, whatsapp, bezoek, kaart} in dagen (7.2, P05)
  // P06: accountmatrix (F16). De accountklassen zijn 'klassen'.
  'belmatrix', // {prospect: {A: {aantal, periode}}}; geen rij klant (onderhoud loopt in DealDrive); null = niet ingesteld, 0 = bewust uit
  'afspraakmatrix', // {meeting: {...}, bezoek: {...}}
  'frequentieplafond', // {werkdagen, maxBerichten}
  'segmenten', // [{id, naam, filters: [{sleutel, vergelijking, waarde}]}]
  'capaciteit', // {binnendienst, buitendienst}
  'helpVerborgen', // artikel-id's van platformartikelen die de beheerder verbergt (P09)
  'prospectplanning', // PlanningInstelling uit shared/planning.ts (P12)
  'agendaKoppeling', // {aan: boolean}: de beheerder zet de agendakoppeling aan (P13)
  'gebieden', // Regio[] uit shared/gebieden.ts: reeksen, plaatsen, eigenaren, regiodagen (P14)
  'plaatsSynoniemen', // {"den bosch": "'s-hertogenbosch"}: eigen synoniemen voor plaatsnamen (P14)
  'spraak', // {opnamesBewaren, bewaartermijnDagen, browserherkenning}: spraak per organisatie (P31)
  'meldingsregels', // Partial<MeldingInstelling> uit shared/meldingsregels.ts: dagplafond en stilte (P31)
  'kansRegels', // KansRegels uit shared/route.ts: gewichten, maximale omrijtijd, aantal (P14)
  'funnelNormen', // Normen uit shared/funnel.ts: {faseId: {conversie, doorlooptijd}} (P17)
  'overdracht', // {vasteOntvanger}: vaste ontvanger in DealDrive of het CRM (P17)
  'dagritme', // DagInstelling en SignaalInstelling uit shared/dag.ts en shared/signalen.ts (P32)
  'kanalenUit', // Kanaal[] uit shared/nbStatus.ts die de beheerder uitzet (P26)
  // Van de leverancier:
  'pakket',
  'aiCredits',
  'features',
  'platformprompts',
  'agentmaxima', // platformmaxima per agent; staan in platform_agentmaxima, de sleutel is gereserveerd (P08)
] as const
export type SettingKey = typeof SETTING_KEYS[number]

export const VERBORGEN_KEYS: readonly SettingKey[] = ['pakket', 'aiCredits', 'features', 'platformprompts', 'agentmaxima']

export function isSettingKey(v: unknown): v is SettingKey {
  return typeof v === 'string' && (SETTING_KEYS as readonly string[]).includes(v)
}

export function isVerborgen(k: string): boolean {
  return (VERBORGEN_KEYS as readonly string[]).includes(k)
}
