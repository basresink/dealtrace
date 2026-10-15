// Inloggen met een code per mail (P27): aanvragen met limiet, verifiëren, TOTP-stap.
import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { CODE_GELDIG_MINUTEN, magCodeAanvragen, normaliseerEmail, POGINGEN_PER_CODE } from '../../shared/inloggen'
import { gebruikDb, schema } from './db'
import { stuurInlogcode } from './mailer'

export const hash = (s: string) => createHash('sha256').update(`${useRuntimeConfig().sessieGeheim}|${s}`).digest('hex')

export interface InlogGebruiker { id: string; organisation_id: string | null; role: string; status: string; totp: { geheim?: string; aan?: boolean } | null }
export async function gebruikerOpEmail(email: string): Promise<InlogGebruiker | null> {
  const r = await gebruikDb().execute(sql`select * from dealtrace_gebruiker_op_email(${normaliseerEmail(email)})`)
  return (r.rows[0] as unknown as InlogGebruiker) ?? null
}

/** Altijd dezelfde uitkomst voor bekend en onbekend adres; 429 boven de limiet (geen mail). */
export async function vraagCodeAan(email: string, nu = new Date()): Promise<'verstuurd' | 'limiet'> {
  const db = gebruikDb()
  const eh = hash(normaliseerEmail(email))
  await db.delete(schema.inlogAanvragen).where(lt(schema.inlogAanvragen.op, new Date(nu.getTime() - 24 * 3600_000).toISOString()))
  const eerder = await db.select({ op: schema.inlogAanvragen.op }).from(schema.inlogAanvragen).where(and(eq(schema.inlogAanvragen.emailHash, eh), gte(schema.inlogAanvragen.op, new Date(nu.getTime() - 3600_000).toISOString())))
  if (!magCodeAanvragen(eerder.map((e) => e.op), nu)) return 'limiet'
  await db.insert(schema.inlogAanvragen).values({ emailHash: eh, op: nu.toISOString() } as any)
  const g = await gebruikerOpEmail(email)
  if (!g) return 'verstuurd'
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  await db.update(schema.inlogCodes).set({ gebruiktOp: nu.toISOString() }).where(and(eq(schema.inlogCodes.emailHash, eh), isNull(schema.inlogCodes.gebruiktOp)))
  await db.insert(schema.inlogCodes).values({ emailHash: eh, codeHash: hash(`code|${code}`), verlooptOp: new Date(nu.getTime() + CODE_GELDIG_MINUTEN * 60_000).toISOString(), op: nu.toISOString() })
  await stuurInlogcode(normaliseerEmail(email), code)
  return 'verstuurd'
}

/** Controleert de code: één keer bruikbaar, 10 minuten geldig, hooguit 5 pogingen. */
export async function controleerCode(email: string, code: string, nu = new Date()): Promise<boolean> {
  const db = gebruikDb()
  const eh = hash(normaliseerEmail(email))
  const [c] = await db.select().from(schema.inlogCodes).where(and(eq(schema.inlogCodes.emailHash, eh), isNull(schema.inlogCodes.gebruiktOp))).orderBy(desc(schema.inlogCodes.op)).limit(1)
  if (!c || Date.parse(c.verlooptOp) < nu.getTime() || c.pogingen >= POGINGEN_PER_CODE) return false
  const goed = /^\d{6}$/.test(code) && timingSafeEqual(Buffer.from(c.codeHash), Buffer.from(hash(`code|${code}`)))
  await db.update(schema.inlogCodes).set(goed ? { gebruiktOp: nu.toISOString() } : { pogingen: c.pogingen + 1 }).where(eq(schema.inlogCodes.id, c.id))
  return goed
}

/** TOTP is verplicht voor de founder en optioneel (als hij hem aanzette) voor de beheerder. */
export const totpNodig = (g: InlogGebruiker) => g.role === 'founder' || (g.role === 'beheerder' && !!g.totp?.aan)

