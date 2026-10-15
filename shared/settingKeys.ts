// De vaste lijst instellingssleutels (bouwplan F22). Een onbekende sleutel
// wordt geweigerd. VERBORGEN_KEYS beheert de leverancier: ze worden aan de
// leeskant gefilterd en aan de schrijfkant geweigerd.

export const SETTING_KEYS = [
  'organisatie', // {naam, logo, land, verkoopjaarStartmaand}
  'werkdagen', // WerkdagInstelling
  'niveaus', // {iedereenAlles, standaardNiveauNieuweGebruiker}
  'klassen', // [{id, naam, omschrijving, tabblad}] (F03, gat 2)
  'afkoeling', // {bellen, mail, linkedin, whatsapp, bezoek, kaart} in dagen (7.2, P05)
  // Van de leverancier:
  'pakket',
  'aiCredits',
  'features',
  'platformprompts',
] as const
export type SettingKey = typeof SETTING_KEYS[number]

export const VERBORGEN_KEYS: readonly SettingKey[] = ['pakket', 'aiCredits', 'features', 'platformprompts']

export function isSettingKey(v: unknown): v is SettingKey {
  return typeof v === 'string' && (SETTING_KEYS as readonly string[]).includes(v)
}

export function isVerborgen(k: string): boolean {
  return (VERBORGEN_KEYS as readonly string[]).includes(k)
}
