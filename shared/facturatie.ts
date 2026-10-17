// Factuurgegevens van de organisatie (F23): op naam van wie en naar welk adres Dealtrace factureert.
// De beheerder vult ze in bij Instellingen, Abonnement; ze staan in org_settings.factuurgegevens.

export interface Factuurgegevens {
  bedrijfsnaam: string
  adres: string
  postcode: string
  plaats: string
  land: 'NL' | 'BE'
  kvk: string
  btw: string
  email: string
}

export type FactuurVeld = keyof Factuurgegevens

export const LEGE_FACTUURGEGEVENS: Factuurgegevens = { bedrijfsnaam: '', adres: '', postcode: '', plaats: '', land: 'NL', kvk: '', btw: '', email: '' }

const MAX: Record<FactuurVeld, number> = { bedrijfsnaam: 120, adres: 160, postcode: 10, plaats: 80, land: 2, kvk: 12, btw: 16, email: 160 }

/** Leest een opgeslagen waarde; wat ontbreekt, is leeg. */
export function leesFactuurgegevens(v: unknown): Factuurgegevens {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const uit = { ...LEGE_FACTUURGEGEVENS }
  for (const k of Object.keys(uit) as FactuurVeld[]) if (typeof o[k] === 'string') (uit as Record<string, string>)[k] = o[k] as string
  if (uit.land !== 'BE') uit.land = 'NL'
  return uit
}

/** Maakt de invoer schoon (spaties, hoofdletters) en controleert elk veld. Fouten per veld in gewone taal. */
export function valideerFactuurgegevens(v: unknown): { waarde: Factuurgegevens; fouten: Partial<Record<FactuurVeld, string>> } {
  const r = leesFactuurgegevens(v)
  const w: Factuurgegevens = {
    bedrijfsnaam: r.bedrijfsnaam.trim().replace(/\s+/g, ' '),
    adres: r.adres.trim().replace(/\s+/g, ' '),
    postcode: r.postcode.trim().toUpperCase().replace(/\s+/g, ''),
    plaats: r.plaats.trim().replace(/\s+/g, ' '),
    land: r.land,
    kvk: r.kvk.replace(/[\s.]/g, ''),
    btw: r.btw.toUpperCase().replace(/[\s.]/g, ''),
    email: r.email.trim().toLowerCase(),
  }
  if (w.land === 'NL' && /^\d{4}[A-Z]{2}$/.test(w.postcode)) w.postcode = `${w.postcode.slice(0, 4)} ${w.postcode.slice(4)}`
  const f: Partial<Record<FactuurVeld, string>> = {}
  for (const k of Object.keys(MAX) as FactuurVeld[]) if (w[k].length > MAX[k]) f[k] = `Hooguit ${MAX[k]} tekens`
  if (!w.bedrijfsnaam) f.bedrijfsnaam = 'Vul de naam in waarop de factuur staat'
  if (!w.adres) f.adres = 'Vul straat en huisnummer in'
  if (!w.plaats) f.plaats = 'Vul de plaats in'
  if (w.land === 'NL' && !/^\d{4} [A-Z]{2}$/.test(w.postcode)) f.postcode = 'Een Nederlandse postcode is 4 cijfers en 2 letters, zoals 1234 AB'
  if (w.land === 'BE' && !/^\d{4}$/.test(w.postcode)) f.postcode = 'Een Belgische postcode is 4 cijfers'
  if (w.kvk && w.land === 'NL' && !/^\d{8}$/.test(w.kvk)) f.kvk = 'Een KvK-nummer is 8 cijfers'
  if (w.kvk && w.land === 'BE' && !/^0?\d{9}$/.test(w.kvk)) f.kvk = 'Een ondernemingsnummer is 10 cijfers, zoals 0123456789'
  if (w.btw && w.land === 'NL' && !/^NL\d{9}B\d{2}$/.test(w.btw)) f.btw = 'Een Nederlands btw-nummer ziet eruit als NL123456789B01'
  if (w.btw && w.land === 'BE' && !/^BE0?\d{9}$/.test(w.btw)) f.btw = 'Een Belgisch btw-nummer ziet eruit als BE0123456789'
  if (!w.email) f.email = 'Vul het e-mailadres in waar de facturen heen gaan'
  else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(w.email)) f.email = 'Dit is geen geldig e-mailadres'
  return { waarde: w, fouten: f }
}

/** Zijn de gegevens compleet genoeg om op een factuur te zetten? */
export function factuurgegevensCompleet(g: Factuurgegevens): boolean {
  return !Object.keys(valideerFactuurgegevens(g).fouten).length
}

/** De adresregels zoals ze op de factuur staan. */
export function factuurAdresRegels(g: Factuurgegevens): string[] {
  return [g.bedrijfsnaam, g.adres, [g.postcode, g.plaats].filter(Boolean).join(' '), g.land === 'BE' ? 'België' : 'Nederland', g.kvk ? `${g.land === 'BE' ? 'Ondernemingsnummer' : 'KvK'} ${g.kvk}` : '', g.btw ? `Btw ${g.btw}` : ''].filter(Boolean)
}

export const FACTUUR_STATUS: Record<string, string> = { open: 'Open', betaald: 'Betaald', achterstallig: 'Achterstallig', geannuleerd: 'Geannuleerd' }
