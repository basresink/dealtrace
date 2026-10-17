// BAND uit de gespreksverslagen (accountkaart, venster Kwalificatie): leest de analyses van de Notulist bij de
// afspraken en beltaken van het account en maakt per BAND-letter een voorstel met het citaat en de herkomst
// (welk verslag, welke datum). Er is geen nieuwe AI-aanroep: de analyses staan al bij het verslag. De gebruiker
// bevestigt, bewerkt of verwerpt per letter; een letter die al is ingevuld blijft leidend.
import { sql } from 'drizzle-orm'
import { BAND_LETTERS, bandGekwalificeerd, type Band, type BandLetter } from '../../shared/bandKwalificatie'
import { bandVoorstellen, type BandVerworpen, type VerslagBron } from '../../shared/bandUitVerslag'
import { schrijfAudit } from './audit'
import { gebruikDb } from './db'
import { alsHttpFout, meldGebeurtenis } from './reis'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v == null ? new Date(0).toISOString() : v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString())
const fout = (s: number, m: string): never => { throw createError({ statusCode: s, statusMessage: m }) }

/** De verslagen met een analyse van de Notulist, nieuwste eerst (hoogstens twintig). */
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

export async function leesBandVoorstellen(tx: Tx, accountId: string) {
  const [a] = await rijen(tx, sql`select data from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  const bronnen = await verslagBronnen(tx, accountId)
  const verworpen = (a!.data?.bandVerworpen ?? {}) as Partial<Record<BandLetter, BandVerworpen>>
  return { voorstellen: bandVoorstellen(bronnen, a!.data?.band as Band, verworpen), verslagen: bronnen.length }
}

export interface BandBesluit { letter: string; besluit: 'bevestig' | 'bewerk' | 'verwerp' | 'ongedaan'; ja?: boolean; toelichting?: string; bronId?: string }

/** Bevestigen of bewerken zet de letter (met citaat en herkomst); verwerpen onthoudt het; ongedaan haalt een letter uit een verslag weer weg. */
export async function besluitBandVoorstel(tx: Tx, org: string, door: string, accountId: string, b: BandBesluit, nu = new Date()) {
  if (!(BAND_LETTERS as readonly string[]).includes(b.letter)) fout(422, 'Kies behoefte, autoriteit, noodzaak of draagvlak')
  if (!['bevestig', 'bewerk', 'verwerp', 'ongedaan'].includes(b.besluit)) fout(422, 'Kies bevestig, bewerk of verwerp')
  const letter = b.letter as BandLetter
  const [a] = await rijen(tx, sql`select data, nb_status, account_kind from accounts where id = ${accountId}`)
  if (!a) fout(404, 'Account onbekend')
  const data = { ...(a!.data ?? {}) }
  const band: Band = { ...(data.band ?? {}) }
  const verworpen = { ...(data.bandVerworpen ?? {}) } as Partial<Record<BandLetter, BandVerworpen>>
  let gemeld = null
  if (b.besluit === 'ongedaan') {
    // Alleen een letter die uit een verslag kwam; met de hand ingevuld blijft leidend.
    if (band[letter]?.herkomst) delete band[letter]
    delete verworpen[letter]
  } else {
    const bronnen = await verslagBronnen(tx, accountId)
    const voorstel = bandVoorstellen(bronnen, band, verworpen).find((v) => v.letter === letter && (!b.bronId || v.bron.id === b.bronId))
    if (!voorstel) fout(409, band[letter] ? 'Deze letter is al ingevuld' : 'Er is geen voorstel meer voor deze letter')
    if (b.besluit === 'verwerp') verworpen[letter] = { bronId: voorstel!.bron.id, op: nu.toISOString() }
    else {
      const dag = new Date(voorstel!.bron.datum).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' })
      const ja = b.besluit === 'bewerk' && typeof b.ja === 'boolean' ? b.ja : voorstel!.ja
      const toelichting = (b.besluit === 'bewerk' && typeof b.toelichting === 'string' ? b.toelichting : voorstel!.citaat).trim().slice(0, 300)
      band[letter] = { ja, bron: `${voorstel!.bron.soort === 'afspraak' ? 'Verslag' : 'Belverslag'} ${dag}`, op: nu.toISOString(), toelichting, herkomst: { ...voorstel!.bron } }
      delete verworpen[letter]
    }
  }
  data.band = band
  data.bandVerworpen = verworpen
  await tx.execute(sql`update accounts set data = ${JSON.stringify(data)}::jsonb, updated_at = now() where id = ${accountId}`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: `band.voorstel.${b.besluit}`, resourceType: 'accounts', resourceId: accountId, changes: { letter, ja: band[letter]?.ja ?? null, bronId: b.bronId ?? null } })
  if (b.besluit !== 'verwerp' && b.besluit !== 'ongedaan' && bandGekwalificeerd(band) && a!.nb_status === 'nieuw' && a!.account_kind === 'prospect') {
    gemeld = await meldGebeurtenis(tx, { accountId, gebeurtenis: 'gekwalificeerd', door, reden: 'BAND minimaal 3 van 4' }).catch(alsHttpFout)
  }
  return { band, gemeld }
}
