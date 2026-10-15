// Invoercontrole en telling voor doelgroepen (P05).
import { eq } from 'drizzle-orm'
import { pastInDoelgroep, type DoelgroepData } from '../../shared/reis'
import { schema } from './db'
import { alsDoelgroepAccount } from './reis'

const lijst = (v: unknown) => (Array.isArray(v) ? v.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 200) : [])

export function schoonDoelgroep(b: any): { naam: string; status: 'concept' | 'actief' | 'gearchiveerd'; prioriteit: number; data: DoelgroepData } {
  const naam = String(b?.naam ?? '').trim()
  if (!naam) throw createError({ statusCode: 422, statusMessage: 'Geef de doelgroep een naam' })
  const status = (['concept', 'actief', 'gearchiveerd'] as const).find((s) => s === b?.status) ?? 'concept'
  const prioriteit = Math.max(1, Math.min(99, Math.round(Number(b?.prioriteit) || 10)))
  const d = b?.data ?? {}
  const num = (v: unknown) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v))
  const data: DoelgroepData = {
    omschrijving: String(d.omschrijving ?? '').slice(0, 1000) || undefined,
    sbi: lijst(d.sbi), brancheIds: lijst(d.brancheIds), klassen: lijst(d.klassen), gebiedIds: lijst(d.gebiedIds), postcodes: lijst(d.postcodes),
    omvang: { min: num(d.omvang?.min), max: num(d.omvang?.max) },
    bron: (['koud', 'warm', 'referral', 'winback'] as const).find((x) => x === d.bron) ?? null,
    eigenVeldFilters: (Array.isArray(d.eigenVeldFilters) ? d.eigenVeldFilters : []).filter((f: any) => /^[a-z][a-z0-9_]{0,62}$/.test(f?.sleutel) && ['is', 'niet', 'min', 'max', 'bevat'].includes(f?.vergelijking)).slice(0, 20),
    uitsluitingen: { segmenten: lijst(d.uitsluitingen?.segmenten), tags: lijst(d.uitsluitingen?.tags) },
    ambitieToets: (['ja', 'deels', 'nee'] as const).find((x) => x === d.ambitieToets),
  }
  return { naam: naam.slice(0, 120), status, prioriteit, data }
}

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

/** Aantal prospects in de doelgroep en hoeveel daarvan al in een andere (niet-standaard) reis zitten. */
export async function telDoelgroep(tx: Tx, data: DoelgroepData, doelgroepId: string | null) {
  const accounts = await tx.select().from(schema.accounts).where(eq(schema.accounts.accountKind, 'prospect'))
  const reizen = await tx.select({ id: schema.reistemplates.id, doelgroepId: schema.reistemplates.doelgroepId, isStandaard: schema.reistemplates.isStandaard }).from(schema.reistemplates)
  const eigen = new Set(reizen.filter((r) => r.isStandaard || (doelgroepId && r.doelgroepId === doelgroepId)).map((r) => r.id))
  const passend = accounts.filter((a) => pastInDoelgroep(alsDoelgroepAccount(a), { data }))
  return { aantal: passend.length, inAndereReis: passend.filter((a) => a.reisId && !eigen.has(a.reisId)).length }
}
