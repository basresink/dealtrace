// De AI-voorzet per blok van een accountplan (de Pitstop, soort concept, via de AI-schil met credits). Het
// materiaal is alleen wat Dealtrace al van de prospect weet: account, contactpersonen met rol en functie, de
// laatste taken, afspraken en verslagen, en de andere blokken van het plan (opgeslagen of nog in het formulier).
// Het antwoord is altijd een voorstel: het scherm toont het met "Gebaseerd op" en de gebruiker neemt het over
// of laat het liggen. Er wordt hier niets in het plan geschreven.
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { nlMoment } from '../../shared/datum'
import {
  SECTIE_SLEUTELS, VOORZET_DOELEN, VOORZET_PROMPT, VOORZET_SCHEMA, schoonVoorzet, sectieTitel,
  type AccountplanSectie, type PlanVoorzet, type VoorzetDoel,
} from '../../shared/accountplannen'
import { promptKeten } from '../../shared/platform'
import { metOrganisatie, schema } from './db'
import { MOCK_GENERATOREN, voerAiStapMetCredits } from './llm-provider'
import type { PlanGebruiker } from './accountplannen'

const fout = (statusCode: number, statusMessage: string) => createError({ statusCode, statusMessage })
const plusDagen = (dag: string, n: number) => { const d = new Date(`${dag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

// De mock (lokaal en in tests) schrijft alleen uit het materiaal, zodat een voorstel nooit iets verzint.
const vorigeConcept = MOCK_GENERATOREN.concept
MOCK_GENERATOREN.concept = (m) => (m?.accountplanVoorzet ? mockVoorzet(m) : vorigeConcept ? vorigeConcept(m) : { tekst: 'Mock-antwoord voor concept' })
export function mockVoorzet(m: any): PlanVoorzet {
  const a = m.account ?? {}
  const contacten: any[] = m.contacten ?? []
  const beslisser = contacten.find((c) => c.rol === 'beslisser')
  const wie = contacten.map((c) => `${c.naam} (${c.rolLabel}${c.functie ? `, ${c.functie}` : ''})`).join(', ')
  const vragen = beslisser ? [] : ['Wie neemt bij deze prospect de beslissing?']
  const laatste = (m.taken ?? [])[0]?.titel
  const teksten: Record<AccountplanSectie, string> = {
    klantinformatie: `${a.naam}${a.plaats ? ` in ${a.plaats}` : ''}.${wie ? ` Aan tafel: ${wie}.` : ''}`,
    doelstellingen: `Voor ${m.plan?.geldigTot ?? 'het einde van de periode'} een eerste opdracht bij ${a.naam}${beslisser ? `, met ${beslisser.naam} als beslisser aan tafel` : ''}.`,
    kansen: laatste ? `Er loopt al contact: ${laatste}. Bouw daarop voort.` : `Nog geen lopend contact met ${a.naam}. Een eerste gesprek is de kans.`,
    bedreigingen: beslisser ? `Alles hangt nu aan ${beslisser.naam}. Valt die weg, dan staat het plan stil.` : 'De beslisser is nog niet bekend.',
    strategieen: `Eerst ${contacten.find((c) => c.rol !== 'beslisser')?.naam ?? 'een gebruiker'} spreken over de dagelijkse praktijk, daarna ${beslisser?.naam ?? 'de beslisser'} met een concreet voorstel.`,
    evaluatie: `${m.voortgang?.klaar ?? 0} van ${m.voortgang?.totaal ?? 0} acties zijn klaar. Noteer wat werkte en wat je bijstelt.`,
  }
  if (m.doel === 'actieplan') {
    return {
      tekst: '', vragen,
      acties: [
        { titel: `Plan een kennismaking met ${beslisser?.naam ?? a.naam}`, dagen: 5 },
        { titel: `Stuur ${beslisser?.naam ?? a.naam} een korte samenvatting van het gesprek`, dagen: 10 },
        { titel: `Bespreek het voorstel met ${a.naam}`, dagen: 30 },
      ],
    }
  }
  return { tekst: teksten[m.doel as AccountplanSectie] ?? '', acties: [], vragen }
}

const ROL_LABEL: Record<string, string> = { beslisser: 'beslisser', beinvloeder: 'beïnvloeder', champion: 'champion', gebruiker: 'gebruiker', poortwachter: 'poortwachter', blokkeerder: 'blokkeerder', onbekend: 'rol onbekend' }

/**
 * Een voorzet voor één blok (of het actieplan). `planId` voor een bestaand plan, anders `accountId` met de
 * blokken uit het formulier (`concept`). Credits via voerAiStapMetCredits; 402 als de pot op is.
 */
export async function planVoorzet(org: string, g: PlanGebruiker, b: { accountId?: unknown; planId?: unknown; doel?: unknown; concept?: unknown }, nu = new Date()) {
  const doel = String(b.doel ?? '') as VoorzetDoel
  if (!VOORZET_DOELEN.includes(doel)) throw fout(422, 'Onbekend blok')
  const vandaag = nlMoment(nu).datum
  const voor = await metOrganisatie(org, async (tx) => {
    let accountId = typeof b.accountId === 'string' ? b.accountId : ''
    let plan: { titel: string; geldigTot: string | null; secties: Partial<Record<AccountplanSectie, string>>; notities: string[]; voortgang?: { klaar: number; totaal: number } } | null = null
    if (typeof b.planId === 'string' && b.planId) {
      const [p] = await tx.select().from(schema.accountplannen).where(eq(schema.accountplannen.id, b.planId))
      if (!p) throw fout(404, 'Accountplan onbekend')
      accountId = p.accountId
      const acties = (await tx.execute(sql`select status from tasks where accountplan_id = ${p.id} and status <> 'geannuleerd'`)).rows as any[]
      plan = { titel: p.titel, geldigTot: p.geldigTot, secties: p.data?.secties ?? {}, notities: (p.data?.notities ?? []).slice(0, 5).map((n) => n.tekst), voortgang: { klaar: acties.filter((x) => x.status === 'klaar').length, totaal: acties.length } }
    }
    const [a] = accountId ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, plaats: schema.accounts.city, soort: schema.accounts.accountKind }).from(schema.accounts).where(eq(schema.accounts.id, accountId)) : []
    if (!a) throw fout(422, 'Kies eerst een prospect')
    if (a.soort === 'klant') throw fout(422, 'Een plan voor een klant maak je in DealDrive')
    // De blokken uit het formulier gaan voor op wat opgeslagen is (de gebruiker schrijft nog).
    const concept = b.concept && typeof b.concept === 'object' ? b.concept as Record<string, unknown> : {}
    const secties: Partial<Record<AccountplanSectie, string>> = { ...(plan?.secties ?? {}) }
    for (const s of SECTIE_SLEUTELS) if (typeof concept[s] === 'string') secties[s] = String(concept[s]).slice(0, 4000)
    const contacten = (await tx.select({ firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, rol: schema.contacts.rol, data: schema.contacts.data })
      .from(schema.contacts).where(and(eq(schema.contacts.accountId, a.id), sql`${schema.contacts.status} <> 'vertrokken'`)).orderBy(asc(schema.contacts.lastName)).limit(15))
      .map((c) => ({ naam: [c.firstName, c.lastName].filter(Boolean).join(' '), rol: c.rol, rolLabel: ROL_LABEL[c.rol] ?? c.rol, functie: (c.data as any)?.functie ?? null }))
    const taken = (await tx.select({ titel: schema.tasks.title, status: schema.tasks.status, dueDate: schema.tasks.dueDate }).from(schema.tasks)
      .where(and(eq(schema.tasks.accountId, a.id), sql`${schema.tasks.status} <> 'geannuleerd'`)).orderBy(desc(schema.tasks.dueDate)).limit(8))
      .map((t) => ({ titel: t.titel, status: t.status, datum: t.dueDate ? nlMoment(new Date(t.dueDate)).datum : null }))
    const afspraken = ((await tx.execute(sql`select start_at, data->'verslag'->>'tekst' as verslag from appointments where account_id = ${a.id} order by start_at desc limit 5`)).rows as any[])
      .map((x) => ({ datum: x.start_at ? nlMoment(new Date(x.start_at)).datum : null, verslag: x.verslag ? String(x.verslag).slice(0, 600) : null }))
    const bronnen = [
      { soort: 'account', label: a.naam },
      ...(contacten.length ? [{ soort: 'contacten', label: `${contacten.length} contactpersonen met rol` }] : []),
      ...(taken.length ? [{ soort: 'taken', label: `${taken.length} taken` }] : []),
      ...(afspraken.length ? [{ soort: 'afspraken', label: `${afspraken.length} afspraken${afspraken.some((x) => x.verslag) ? ' met verslag' : ''}` }] : []),
      ...Object.entries(secties).filter(([k, v]) => k !== doel && v?.trim()).map(([k]) => ({ soort: 'blok', label: sectieTitel(k as AccountplanSectie) })),
    ]
    const materiaal = {
      accountplanVoorzet: true, doel, doelTitel: doel === 'actieplan' ? 'Actieplan' : sectieTitel(doel), vandaag,
      account: { naam: a.naam, plaats: a.plaats }, contacten, taken, afspraken,
      plan: { titel: plan?.titel ?? null, geldigTot: plan?.geldigTot ?? (typeof concept.geldigTot === 'string' ? concept.geldigTot : null), secties, notities: plan?.notities ?? [] },
      voortgang: plan?.voortgang ?? null,
    }
    return { materiaal, accountId: a.id, bronnen }
  })
  const uit = await voerAiStapMetCredits<PlanVoorzet>(org, {
    soort: 'concept', prompt: promptKeten({ code: VOORZET_PROMPT }), zonderKeten: true, schema: VOORZET_SCHEMA as any,
    materiaal: voor.materiaal, agent: 'pitstop', accountId: voor.accountId, gebruiker: null,
  }, { gebruikerId: g.id, automatisch: false })
    .catch((e: any) => { throw createError({ statusCode: e?.statusCode ?? 500, statusMessage: e?.statusMessage ?? 'De Pitstop is even niet bereikbaar', data: e?.data }) })
  if (!uit.ok) return { doel, tekst: '', acties: [], vragen: [], bronnen: voor.bronnen, credits: 0, mislukt: 'De Pitstop kon nu geen bruikbare voorzet schrijven. Er zijn geen credits afgeschreven.' }
  const v = schoonVoorzet(uit.waarde, doel)
  return { doel, tekst: v.tekst, acties: v.acties.map((x) => ({ titel: x.titel, datum: plusDagen(vandaag, x.dagen) })), vragen: v.vragen, bronnen: voor.bronnen, credits: uit.credits, mislukt: null }
}
