// Verbindingsopties voor Postgres. Lokaal zonder SSL; daarbuiten (Supabase) met SSL.
// sslmode in de URL halen we weg, anders gaat die voor de ssl-optie hieronder.

export function isLokaleUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === '127.0.0.1' || host === 'localhost' || host === 'db'
  } catch {
    return false
  }
}

export function verbindingsopties(url: string) {
  if (isLokaleUrl(url)) return { connectionString: url }
  const u = new URL(url)
  for (const p of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'uselibpqcompat']) u.searchParams.delete(p)
  // Supabase gebruikt een eigen certificaatketen; de verbinding is versleuteld,
  // het certificaat controleren we niet tegen de standaard-CA-lijst van Node.
  return { connectionString: u.toString(), ssl: { rejectUnauthorized: false } }
}
