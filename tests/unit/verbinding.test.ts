import { describe, expect, it } from 'vitest'
import { normaliseerUrl, verbindingsopties } from '../../shared/verbinding'

const HOST = 'aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

describe('normaliseerUrl', () => {
  it('laat een goede regel staan', () => {
    expect(normaliseerUrl(`postgresql://postgres.abc:Zomer2026@${HOST}`)).toBe(`postgresql://postgres.abc:Zomer2026@${HOST}`)
  })
  it('codeert lastige tekens in het wachtwoord', () => {
    const u = new URL(normaliseerUrl(`postgresql://postgres.abc:a@b#c/d?e%@${HOST}`))
    expect(decodeURIComponent(u.password)).toBe('a@b#c/d?e%')
    expect(u.hostname).toBe('aws-0-eu-central-1.pooler.supabase.com')
  })
  it('haalt spaties, aanhalingstekens, NAAM= en [ ] weg', () => {
    const u = new URL(normaliseerUrl(` DATABASE_URL_BEHEER="postgresql://postgres.abc:[Geheim1]@${HOST}" `))
    expect(u.password).toBe('Geheim1')
    expect(u.username).toBe('postgres.abc')
  })
  it('meldt [YOUR-PASSWORD] zonder de regel te tonen', () => {
    expect(() => normaliseerUrl(`postgresql://postgres.abc:[YOUR-PASSWORD]@${HOST}`, 'X')).toThrow(/X bevat nog \[YOUR-PASSWORD\]/)
  })
  it('meldt een regel die niet met postgresql:// begint', () => {
    expect(() => normaliseerUrl('https://supabase.com/dashboard', 'X')).toThrow(/begint niet met postgresql/)
  })
  it('lokaal zonder ssl, Supabase met ssl', () => {
    expect(verbindingsopties('postgresql://a:b@127.0.0.1:5432/x')).not.toHaveProperty('ssl')
    expect(verbindingsopties(`postgresql://a:b@${HOST}?sslmode=require`).connectionString).not.toContain('sslmode')
  })
})

describe('foutmelding', () => {
  it('toont gebruiker en host maar nooit het wachtwoord', () => {
    let melding = ''
    try { normaliseerUrl('postgresql://postgres.abc:GeheimXYZ@host met fout:5432/postgres'.replace(' met fout', ':poort'), 'X') } catch (e) { melding = (e as Error).message }
    expect(melding).toContain('postgres.abc:***@')
    expect(melding).not.toContain('GeheimXYZ')
  })
  it('meldt een ontbrekende @', () => {
    expect(() => normaliseerUrl('postgresql://postgres.abc:wachtwoord', 'X')).toThrow(/geen @/)
  })
})
