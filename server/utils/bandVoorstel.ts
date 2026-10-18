// BAND uit de gespreksverslagen (accountkaart, venster Kwalificatie): leest de analyses van de Notulist bij de
// afspraken en beltaken van het account en maakt per BAND-letter een voorstel met het citaat en de herkomst
// (welk verslag, welke datum). Daarvoor is geen nieuwe AI-aanroep: de analyses staan al bij het verslag. Daarnaast
// "Vul in met AI" (bandMetAi, soort bandInvulling via de AI-schil met credits): de AI leest alle gespreksverslagen
// (taken, afspraken, transcripten, samenvattingen van de Notulist) en zet per onderdeel een voorstel klaar in
// accounts.data.bandAi. De gebruiker bevestigt, bewerkt of verwerpt per letter; een ingevulde letter blijft leidend.
import { sql } from 'drizzle-orm'
import { BAND_LETTERS, bandGekwalificeerd, type Band, type BandLetter } from '../../shared/bandKwalificatie'
import { creditsVoor } from '../../shared/credits'
import { BAND_AI_PROMPT, BAND_AI_SCHEMA, BAND_UITLEG, bandAiUitAntwoord, bandVoorstellenMetAi, type BandAiStand, type BandAiVerslag, type BandVerworpen, type VerslagBron } from '../../shared/bandUitVerslag'
import { schrijfAudit } from './audit'
import { platformCredits } from './credits'
import { voerAiStapUit } from './llm-provider'
import { gebruikDb } from './db'
import { magAccount } from './overdracht'
import { alsHttpFout, meldGebeurtenis } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? new Date(0).toISOString() : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const fout = (s: number, m: string): never => { throw createError({ statusCode: s, statusMessage: m }) }

/** De verslagen met een analyse van de Notulist, nieuwste eerst (hoogstens twintig). */
/**
 * BAND bewerken staat los van Kwalificeer: de eigenaar, zijn salesmanager en de beheerder (de bestaande rechten op
 * het account, zoals bij "Vul in met AI") vullen BAND in of werken het bij, ook als de prospect al voorbij status
 * nieuw is. Kwalificeren als gebeurtenis gebeurt alleen bij status nieuw (zie bandMeldtKwalificatie).
 */
export async function magBandBewerken(tx: Tx, g: { id: string; rol: string }, accountId: string): Promise<boolean> {
  return magAccount(tx, g, accountId)
}

export async function vereisBandRecht(tx: Tx, g: { id: string; rol: string }, accountId: string) {
  if (!(await magBandBewerken(tx, g, accountId))) fout(403, 'Alleen de eigenaar, zijn salesmanager of de beheerder werkt BAND bij')
}

/** Alleen bij status nieuw meldt BAND minimaal 3 van 4 `gekwalificeerd`; daarna is bijwerken geen gebeurtenis in de reis. */
export function bandMeldtKwalificatie(band: Band, a: { nbStatus: string | null; accountKind: string | null }): boolean {
  return bandGekwalificeerd(band) && a.nbStatus === 'nieuw' && a.accountKind === 'prospect'
}

/** Eén BAND-letter zelf zetten (PUT /band). */
export async function zetBandLetter(tx: Tx, door: { id: string; rol: string }, accountId: string, invoer: { letter?: string; ja?: boolean; bron?: string }, nu = new Date()) {
  if (!(BAND_LETTERS as readonly string[]).includes(invoer?.letter ?? '')) fout(422, 'Kies behoefte, autoriteit, noodzaak of draagvlak')
  const [a] = await rijen(tx, sql`select data, nb_status, account_kind from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  await vereisBandRecht(tx, door, accountId)
  const band: Band = { ...(a!.data?.band ?? {}), [invoer.letter!]: { ja: !!invoer.ja, bron: invoer.bron?.slice(0, 200) || 'hand', op: nu.toISOString() } }
  await tx.execute(sql`update accounts set data = jsonb_set(coalesce(data, '{}'::jsonb), '{band}', ${JSON.stringify(band)}::jsonb), updated_at = now() where id = ${accountId}`)
  let gemeld = null
  if (bandMeldtKwalificatie(band, { nbStatus: a!.nb_status, accountKind: a!.account_kind })) {
    gemeld = await meldGebeurtenis(tx, { accountId, gebeurtenis: 'gekwalificeerd', door: door.id, reden: 'BAND minimaal 3 van 4' }).catch(alsHttpFout)
  }
  return { band, gemeld }
}

export async function verslagBronnen(tx: Tx, accountId: string): Promise<VerslagBron[]> {
  const afspraken = await rijen(tx, sql`select ap.id, ap.start_at, ap.data->>'titel' as titel, m.naam as soort, ap.data->'notulist' as analyse
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id where ap.account_id = ${accountId} and ap.data ? 'notulist' order by ap.start_at desc limit 10`)
  const taken = await rijen(tx, sql`select id, title, coalesce(data->'verslag'->>'op', data->'notulist'->>'op') as op, data->'notulist' as analyse
    from tasks where account_id = ${accountId} and data ? 'notulist' order by updated_at desc limit 10`)
  return [
    ...afspraken.map((a) => ({ id: a.id as string, soort: 'afspraak' as const, titel: (a.titel || a.soort || 'Afspraak') as string, datum: iso(a.start_at), analyse: a.analyse })),
    ...taken.map((t) => ({ id: t.id as string, soort: 'taak' as const, titel: (t.title || 'Belgesprek') as string, datum: iso(t.op), analyse: t.analyse })),
  ].sort((x, y) => Date.parse(y.datum) - Date.parse(x.datum))
}

const kortTekst = (t: string, n = 4000) => (t.length > n ? `${t.slice(0, n)}...` : t)

/** Alle gespreksverslagen van de prospect voor "Vul in met AI", nieuwste eerst (hoogstens twintig), genummerd V1, V2, ... */
export async function aiVerslagen(tx: Tx, accountId: string): Promise<BandAiVerslag[]> {
  const aps = await rijen(tx, sql`select ap.id, ap.start_at, ap.data->>'titel' as titel, m.naam as soort, ap.data->'verslag'->>'tekst' as verslag, ap.data->'notulist'->>'samenvatting' as samenvatting
    from appointments ap left join meetingsoorten m on m.id = ap.meetingsoort_id
    where ap.account_id = ${accountId} and (coalesce(ap.data->'verslag'->>'tekst', '') <> '' or coalesce(ap.data->'notulist'->>'samenvatting', '') <> '') order by ap.start_at desc limit 10`)
  const taken = await rijen(tx, sql`select id, title, coalesce(data->'verslag'->>'op', data->'notulist'->>'op', updated_at::text) as op, data->'verslag'->>'tekst' as verslag, data->'notulist'->>'samenvatting' as samenvatting
    from tasks where account_id = ${accountId} and (coalesce(data->'verslag'->>'tekst', '') <> '' or coalesce(data->'notulist'->>'samenvatting', '') <> '') order by updated_at desc limit 10`)
  const tr = await rijen(tx, sql`select t.id, t.tekst, t.op, coalesce(ap.data->>'titel', tk.title) as titel from transcripten t
    left join appointments ap on t.record_soort = 'appointments' and ap.id = t.record_id left join tasks tk on t.record_soort = 'tasks' and tk.id = t.record_id
    where coalesce(ap.account_id, tk.account_id) = ${accountId} and coalesce(t.tekst, '') <> '' order by t.op desc limit 10`)
  const tekst = (r: Rij) => [r.verslag, r.samenvatting ? `Samenvatting: ${r.samenvatting}` : null].filter(Boolean).join('\n')
  const lijst = [
    ...aps.map((a) => ({ bron: { id: a.id as string, soort: 'afspraak' as const, titel: (a.titel || a.soort || 'Afspraak') as string, datum: iso(a.start_at) }, tekst: tekst(a) })),
    ...taken.map((t) => ({ bron: { id: t.id as string, soort: 'taak' as const, titel: (t.title || 'Belgesprek') as string, datum: iso(t.op) }, tekst: tekst(t) })),
    ...tr.map((t) => ({ bron: { id: t.id as string, soort: 'transcript' as const, titel: (t.titel || 'Opname') as string, datum: iso(t.op) }, tekst: String(t.tekst) })),
  ].sort((x, y) => Date.parse(y.bron.datum) - Date.parse(x.bron.datum)).slice(0, 20)
  return lijst.map((v, i) => ({ nr: `V${i + 1}`, bron: v.bron, tekst: kortTekst(v.tekst) }))
}

async function aantalAiVerslagen(tx: Tx, accountId: string): Promise<number> {
  const [r] = await rijen(tx, sql`select
    (select count(*) from appointments where account_id = ${accountId} and (coalesce(data->'verslag'->>'tekst', '') <> '' or coalesce(data->'notulist'->>'samenvatting', '') <> ''))
    + (select count(*) from tasks where account_id = ${accountId} and (coalesce(data->'verslag'->>'tekst', '') <> '' or coalesce(data->'notulist'->>'samenvatting', '') <> ''))
    + (select count(*) from transcripten t left join appointments ap on t.record_soort = 'appointments' and ap.id = t.record_id left join tasks tk on t.record_soort = 'tasks' and tk.id = t.record_id
       where coalesce(ap.account_id, tk.account_id) = ${accountId}) as n`)
  return Number(r?.n ?? 0)
}

export async function leesBandVoorstellen(tx: Tx, accountId: string) {
  const [a] = await rijen(tx, sql`select data from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  const bronnen = await verslagBronnen(tx, accountId)
  const verworpen = (a!.data?.bandVerworpen ?? {}) as Partial<Record<BandLetter, BandVerworpen>>
  const { prijzen } = await platformCredits(tx)
  return {
    voorstellen: bandVoorstellenMetAi(bronnen, a!.data?.band as Band, verworpen, a!.data?.bandAi as BandAiStand | undefined),
    verslagen: bronnen.length,
    // "Vul in met AI": hoeveel gespreksverslagen er zijn en wat het kost (de prijs uit shared/credits.ts of van de founder).
    ai: { verslagen: await aantalAiVerslagen(tx, accountId), credits: creditsVoor('bandInvulling', { prijzen }), op: (a!.data?.bandAi as BandAiStand | undefined)?.op ?? null },
  }
}

/**
 * "Vul in met AI": de AI leest de gespreksverslagen en stelt per open BAND-onderdeel een voorstel voor met citaat en
 * bron. Alleen een citaat dat letterlijk in het verslag staat telt. Er wordt niets ingevuld: de voorstellen wachten in
 * accounts.data.bandAi op het besluit van de gebruiker. Credits via voerAiStapUit (402 als ze op zijn).
 */
export async function bandMetAi(tx: Tx, org: string, gebruiker: { id: string; niveau: string; data?: any }, accountId: string, nu = new Date()) {
  const [a] = await rijen(tx, sql`select data from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  const band = (a!.data?.band ?? {}) as Band
  const open = BAND_LETTERS.filter((l) => !band[l])
  if (!open.length) fout(409, 'Alle vier onderdelen van BAND zijn al ingevuld')
  const verslagen = await aiVerslagen(tx, accountId)
  if (!verslagen.length) fout(422, 'Nog geen gespreksverslagen')
  const r = await voerAiStapUit<any>(tx, org, {
    soort: 'bandInvulling', schema: BAND_AI_SCHEMA, prompt: BAND_AI_PROMPT, gebruiker, accountId,
    materiaal: { bandInvulling: true, onderdelen: open.map((l) => ({ onderdeel: l, uitleg: BAND_UITLEG[l] })), verslagen: verslagen.map((v) => ({ nr: v.nr, soort: v.bron.soort, datum: v.bron.datum.slice(0, 10), tekst: v.tekst })) },
  }, nu)
  if (!r.ok) return fout(502, r.reden)
  const voorstellen = bandAiUitAntwoord(r.antwoord, verslagen, band)
  const stand: BandAiStand = { op: nu.toISOString(), door: gebruiker.id, verslagen: verslagen.length, voorstellen }
  await tx.execute(sql`update accounts set data = jsonb_set(data, '{bandAi}', ${JSON.stringify(stand)}::jsonb), updated_at = now() where id = ${accountId}`)
  await schrijfAudit(tx, { organisationId: org, actorId: gebruiker.id, action: 'band.ai.voorgesteld', resourceType: 'accounts', resourceId: accountId, changes: { onderdelen: Object.keys(voorstellen), verslagen: verslagen.length } })
  return { voorstellen: Object.keys(voorstellen).length, verslagen: verslagen.length }
}

export interface BandBesluit { letter: string; besluit: 'bevestig' | 'bewerk' | 'verwerp' | 'ongedaan'; ja?: boolean; toelichting?: string; bronId?: string }

/** Bevestigen of bewerken zet de letter (met citaat en herkomst); verwerpen onthoudt het; ongedaan haalt een letter uit een verslag weer weg. */
export async function besluitBandVoorstel(tx: Tx, org: string, gebruiker: { id: string; rol: string }, accountId: string, b: BandBesluit, nu = new Date()) {
  const door = gebruiker.id
  if (!(BAND_LETTERS as readonly string[]).includes(b.letter)) fout(422, 'Kies behoefte, autoriteit, noodzaak of draagvlak')
  if (!['bevestig', 'bewerk', 'verwerp', 'ongedaan'].includes(b.besluit)) fout(422, 'Kies bevestig, bewerk of verwerp')
  const letter = b.letter as BandLetter
  const [a] = await rijen(tx, sql`select data, nb_status, account_kind from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  await vereisBandRecht(tx, gebruiker, accountId)
  const data = { ...(a!.data ?? {}) }
  const band: Band = { ...(data.band ?? {}) }
  const verworpen = { ...(data.bandVerworpen ?? {}) } as Partial<Record<BandLetter, BandVerworpen>>
  const bandAi = data.bandAi ? { ...data.bandAi, voorstellen: { ...(data.bandAi.voorstellen ?? {}) } } as BandAiStand : null
  let gemeld = null
  if (b.besluit === 'ongedaan') {
    // Alleen een letter die uit een verslag kwam; met de hand ingevuld blijft leidend.
    if (band[letter]?.herkomst) delete band[letter]
    delete verworpen[letter]
  } else {
    const bronnen = await verslagBronnen(tx, accountId)
    const voorstel = bandVoorstellenMetAi(bronnen, band, verworpen, bandAi).find((v) => v.letter === letter && (!b.bronId || v.bron.id === b.bronId))
    if (!voorstel) fout(409, band[letter] ? 'Deze letter is al ingevuld' : 'Er is geen voorstel meer voor deze letter')
    if (b.besluit === 'verwerp') verworpen[letter] = { bronId: voorstel!.bron.id, op: nu.toISOString() }
    else {
      const dag = new Date(voorstel!.bron.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
      const ja = b.besluit === 'bewerk' && typeof b.ja === 'boolean' ? b.ja : voorstel!.ja
      const toelichting = (b.besluit === 'bewerk' && typeof b.toelichting === 'string' ? b.toelichting : voorstel!.citaat).trim().slice(0, 300)
      const soort = voorstel!.bron.soort === 'afspraak' ? 'Verslag' : voorstel!.bron.soort === 'transcript' ? 'Transcript' : 'Belverslag'
      band[letter] = { ja, bron: `${soort} ${dag}${voorstel!.ai ? ' (AI)' : ''}`, op: nu.toISOString(), toelichting, herkomst: { ...voorstel!.bron, ...(voorstel!.ai ? { ai: true } : {}) } }
      delete verworpen[letter]
    }
    // Een besluit over een voorstel van "Vul in met AI" ruimt dat voorstel op.
    if (voorstel!.ai && bandAi) delete bandAi.voorstellen[letter]
  }
  data.band = band
  data.bandVerworpen = verworpen
  if (bandAi) data.bandAi = bandAi
  await tx.execute(sql`update accounts set data = ${JSON.stringify(data)}::jsonb, updated_at = now() where id = ${accountId}`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: `band.voorstel.${b.besluit}`, resourceType: 'accounts', resourceId: accountId, changes: { letter, ja: band[letter]?.ja ?? null, bronId: b.bronId ?? null } })
  if (b.besluit !== 'verwerp' && b.besluit !== 'ongedaan' && bandMeldtKwalificatie(band, { nbStatus: a!.nb_status, accountKind: a!.account_kind })) {
    gemeld = await meldGebeurtenis(tx, { accountId, gebeurtenis: 'gekwalificeerd', door, reden: 'BAND minimaal 3 van 4' }).catch(alsHttpFout)
  }
  return { band, gemeld }
}
