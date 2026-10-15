// Verbindingsopties voor Postgres. Lokaal zonder SSL; daarbuiten (Supabase) met SSL.
// sslmode in de URL halen we weg, anders gaat die voor de ssl-optie hieronder.

/**
 * Maakt een geplakte verbindingsregel bruikbaar: spaties, aanhalingstekens en
 * "NAAM=" ervoor gaan weg, [ ] rond het wachtwoord ook, en tekens als @ # / ?
 * in het wachtwoord worden gecodeerd. Lukt dat niet, dan een foutmelding die
 * zegt wat er mis is, zonder de waarde (en dus het wachtwoord) te tonen.
 */
export function normaliseerUrl(ruw: string, naam = 'De databaseregel'): string {
  let t = ruw.trim().replace(/^[A-Z_]+\s*=\s*/, '').trim().replace(/^["']|["']$/g, '').trim()
  if (/\s/.test(t)) throw new Error(`${naam} bevat een spatie of regeleinde. Plak hem opnieuw als één regel.`)
  const m = /^(postgres(?:ql)?:\/\/)(.*)$/i.exec(t)
  if (!m) throw new Error(`${naam} begint niet met postgresql://. Kopieer de regel opnieuw uit Supabase (Connect, Session pooler).`)
  if (/YOUR-PASSWORD/i.test(t)) throw new Error(`${naam} bevat nog [YOUR-PASSWORD]. Vervang dat door je databasewachtwoord, zonder [ ].`)
  const rest = m[2]!
  const at = rest.lastIndexOf('@')
  if (at > 0) {
    const gebruikersdeel = rest.slice(0, at)
    const hostdeel = rest.slice(at + 1)
    const dubbele = gebruikersdeel.indexOf(':')
    if (dubbele > 0) {
      const gebruiker = gebruikersdeel.slice(0, dubbele)
      let wachtwoord = gebruikersdeel.slice(dubbele + 1).replace(/^\[(.*)\]$/, '$1')
      try { wachtwoord = decodeURIComponent(wachtwoord) } catch { /* al ongecodeerd */ }
      t = `${m[1]}${gebruiker}:${encodeURIComponent(wachtwoord)}@${hostdeel}`
    }
  }
  try {
    const u = new URL(t)
    if (!u.hostname) throw new Error('geen host')
  } catch {
    throw new Error(`${naam} is geen geldig adres. ${beschrijf(m[1]!, rest)} Verwacht: postgresql://postgres.PROJECTCODE:WACHTWOORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`)
  }
  return t
}

/** Hoe de regel gelezen is, met het wachtwoord als ***. Gebruiker en host zijn geen geheimen. */
function beschrijf(schema: string, rest: string): string {
  const at = rest.lastIndexOf('@')
  if (at < 0) return `Er staat geen @ in de regel (${rest.length} tekens na ${schema}).`
  const gebruiker = rest.slice(0, at).split(':')[0]
  return `Gelezen als: ${schema}${gebruiker}:***@${rest.slice(at + 1)}.`
}

export function isLokaleUrl(url: string): boolean {
  try {
    const host = new URL(normaliseerUrl(url)).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === 'db'
  } catch {
    return false
  }
}

export function verbindingsopties(url: string, naam?: string) {
  const schoon = normaliseerUrl(url, naam)
  if (isLokaleUrl(schoon)) return { connectionString: schoon }
  const u = new URL(schoon)
  for (const p of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) u.searchParams.delete(p)
  // Supabase gebruikt een eigen certificaatketen; de verbinding is versleuteld,
  // het certificaat controleren we niet tegen de standaard-CA-lijst van Node.
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } }
}
