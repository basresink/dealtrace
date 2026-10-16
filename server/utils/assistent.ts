// De AI-assistent (F26, P33, agent Gids met mandaat A): de server stelt het materiaal samen uit het
// helpcenter, het bevestigde verkoopverhaal en wat de gebruiker zelf mag zien over het account van
// het scherm. Het antwoord heeft bronnen (bewijsplicht: een citaat staat letterlijk in het
// materiaal) en acties die alleen een concept of een link zijn. Hij voert nooit iets uit.
import { sql } from 'drizzle-orm'
import { bronnenVoorAntwoord, kiesAssistentSoort, type AiSoort, type Bron } from '../../shared/credits'
import type { JsonSchema } from '../../shared/aiStap'
import type { Pakket } from '../../shared/types'
import { leesArtikelen, zoek } from './help'
import { leesStand } from './vvProjectie'
import { gebruikDb } from './db'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

export interface AssistentContext { route?: string | null; accountId?: string | null }
export interface Actie { soort: 'taak' | 'mailconcept' | 'artikel' | 'account'; label: string; accountId?: string | null; contactId?: string | null; titel?: string; actiesoort?: string; aanleiding?: string; onderwerp?: string; tekst?: string; slug?: string }
export interface Antwoord { tekst: string; bronnen: Bron[]; acties: Actie[]; doorgestuurd?: boolean }

export const ASSISTENT_SCHEMA: JsonSchema = {
  type: 'object', required: ['tekst', 'bronnen', 'acties'], additionalProperties: false,
  properties: {
    tekst: { type: 'string', maxLength: 4000 },
    bronnen: { type: 'array', items: { type: 'object', required: ['soort', 'label'], additionalProperties: false, properties: { soort: { type: 'string', enum: ['help', 'verhaal', 'account', 'verslag', 'taak', 'web'] }, label: { type: 'string' }, ref: { type: 'string' }, citaat: { type: 'string' } } } },
    acties: { type: 'array', items: { type: 'object', required: ['soort', 'label'], additionalProperties: false, properties: {
      soort: { type: 'string', enum: ['taak', 'mailconcept', 'artikel', 'account'] }, label: { type: 'string' }, accountId: { type: 'string' }, contactId: { type: 'string' },
      titel: { type: 'string' }, actiesoort: { type: 'string' }, aanleiding: { type: 'string' }, onderwerp: { type: 'string' }, tekst: { type: 'string' }, slug: { type: 'string' },
    } } },
    doorgestuurd: { type: 'boolean' },
  },
}

export const ASSISTENT_PROMPT = `Je bent de Gids van Dealtrace. Je legt uit, bereidt voor en stelt voor; je voert niets uit.
Gebruik alleen het meegegeven materiaal. Elke bewering over een account heeft een bron; citaten staan letterlijk in het materiaal.
Acties zijn altijd een concept of een link. Schrijf kort, in de je-vorm, zonder gedachtestreepjes.`

/** Het materiaal voor één vraag: helpcenter, bevestigd verhaal en (binnen de rechten) het account. */
export async function materiaalVoor(tx: Tx, gebruikerId: string, vraag: string, context: AssistentContext) {
  const ids = (await zoek(tx, vraag).catch(() => [] as string[])).slice(0, 3)
  // P25: eigen artikelen van de organisatie alleen als bron als de beheerder de eigen kennisbank aanzet.
  const [kb] = await rijen(tx, sql`select value from org_settings where key = 'helpKennisbank'`)
  const metEigen = kb?.value === true
  const artikelen = ids.length ? (await leesArtikelen(tx)).filter((a) => ids.includes(a.id) && (metEigen || !a.organisationId)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)) : []
  const vv = await leesStand(tx)
  let account: Rij | null = null
  if (context.accountId) {
    const [a] = await rijen(tx, sql`select id, name, city, fase_id, nb_status, vv_branche_id, huidige_leverancier_id from accounts where id = ${context.accountId}`)
    if (a) {
      // Geen privégegevens: alleen naam en rol van contacten, geen privémail of privémobiel.
      const contacten = await rijen(tx, sql`select id, first_name, last_name, rol from contacts where account_id = ${a.id} and status <> 'vertrokken'`)
      const verslagen = await rijen(tx, sql`select soort, uitkomst, op, data->>'tekst' as tekst from activiteiten where account_id = ${a.id} order by op desc limit 5`)
      account = { id: a.id, naam: a.name, plaats: a.city, fase: a.fase_id, status: a.nb_status, brancheId: a.vv_branche_id, leverancierId: a.huidige_leverancier_id, contacten: contacten.map((c) => ({ id: c.id, naam: [c.first_name, c.last_name].filter(Boolean).join(' '), rol: c.rol })), verslagen }
    }
  }
  const taken = await rijen(tx, sql`select id, title, action_type, due_date, account_id from tasks where owner_id = ${gebruikerId} and status in ('open', 'bezig') order by due_date nulls last limit 8`)
  return {
    vraag,
    helpcenter: artikelen.map((a) => ({ slug: a.slug, titel: a.titel, samenvatting: a.samenvatting, inhoud: a.inhoud.slice(0, 1500) })),
    verhaal: {
      kernzin: (vv.teksten ?? []).find((t) => t.sleutel === 'bedrijfsverhaal' && !t.brancheId)?.kernzin ?? null,
      brancheverhaal: account?.brancheId ? (vv.teksten ?? []).find((t) => t.sleutel === 'verhaal' && t.brancheId === account!.brancheId)?.tekst ?? null : null,
      kernbelofte: (vv.teksten ?? []).find((t) => t.sleutel === 'kernbelofte' && !t.brancheId)?.tekst ?? null,
      concurrenten: ((vv.concurrenten ?? []) as any[]).map((c) => ({ id: c.id, naam: c.naam, alsDeKlantZegt: c.alsDeKlantZegt ?? null, zoZegJeHet: c.zoZegJeHet ?? null })),
      winpunten: (vv.winpunten ?? []).filter((w) => w.actief).map((w) => ({ titel: w.titel, omschrijving: w.omschrijving })),
    },
    account,
    taken: taken.map((t) => ({ id: t.id, titel: t.title, soort: t.action_type, op: t.due_date, accountId: t.account_id })),
  }
}
export type Materiaal = Awaited<ReturnType<typeof materiaalVoor>>

/** Alle teksten uit het materiaal, voor de bewijsplicht op citaten. */
export function materiaalTeksten(m: Materiaal): string[] {
  return [
    ...m.helpcenter.flatMap((a) => [a.titel, a.samenvatting, a.inhoud]),
    m.verhaal.kernzin, m.verhaal.brancheverhaal, m.verhaal.kernbelofte,
    ...m.verhaal.concurrenten.flatMap((c) => [c.naam, c.alsDeKlantZegt, c.zoZegJeHet]), ...m.verhaal.winpunten.flatMap((w) => [w.titel, w.omschrijving]),
    ...(m.account ? [m.account.naam, ...m.account.verslagen.map((v: any) => v.tekst)] : []), ...m.taken.map((t) => t.titel),
  ].filter(Boolean) as string[]
}

/**
 * De mock van de Gids (13.5): een vast, controleerbaar antwoord uit het materiaal. Bezwaren uit de
 * concurrenten, een opening uit het verhaal, het werk van vandaag of het beste helpartikel.
 */
export function mockGids(m: Materiaal): Antwoord {
  const v = m.vraag.toLowerCase()
  const acc = m.account
  const accActies: Actie[] = acc ? [
    { soort: 'taak', label: 'Zet als taak klaar', accountId: acc.id, titel: `Bel ${acc.naam}`, actiesoort: 'bellen', aanleiding: `Voorbereid met de AI-assistent: ${m.vraag.slice(0, 120)}` },
    { soort: 'mailconcept', label: 'Maak mailconcept', accountId: acc.id, onderwerp: `Kennismaking ${acc.naam}`, tekst: `Goedemorgen,\n\n${m.verhaal.kernzin ?? ''}\n\nZullen we een kort moment plannen om uw project door te nemen?\n\nMet vriendelijke groet` },
    { soort: 'account', label: 'Open het account', accountId: acc.id },
  ] : []
  if (/bezwa|tegenwerping|zeggen ze/.test(v) && m.verhaal.concurrenten.some((c) => c.alsDeKlantZegt)) {
    const lijst = m.verhaal.concurrenten.filter((c) => c.alsDeKlantZegt).slice(0, 2)
    return {
      tekst: `Dit hoor je vaak:\n${lijst.map((c) => `${c.alsDeKlantZegt}`).join('\n')}`,
      bronnen: lijst.map((c) => ({ soort: 'verhaal' as const, label: `Verhaal: ${c.naam}`, ref: c.id, citaat: c.alsDeKlantZegt })),
      acties: accActies,
    }
  }
  if (/begin|opening|openen|gesprek/.test(v) && (m.verhaal.brancheverhaal || m.verhaal.kernzin)) {
    const t = m.verhaal.brancheverhaal ?? m.verhaal.kernzin!
    return { tekst: `Begin met één zin over wat jullie doen: ${t} Stel daarna één vraag over hun lopende project.`, bronnen: [{ soort: 'verhaal', label: m.verhaal.brancheverhaal ? 'Verhaal: verhaal van de branche' : 'Verhaal: kernzin', citaat: t }], acties: accActies }
  }
  if (/vandaag|klaar|wat moet ik/.test(v) && m.taken.length) {
    return { tekst: `Voor jou staan ${m.taken.length} acties klaar. De eerste: ${m.taken[0]!.titel}.`, bronnen: m.taken.slice(0, 3).map((t) => ({ soort: 'taak' as const, label: `Taak: ${t.titel}`, ref: t.id, citaat: t.titel })), acties: [] }
  }
  const a = m.helpcenter[0]
  if (a) return { tekst: `${a.samenvatting} Lees het hele artikel voor de stappen.`, bronnen: [{ soort: 'help', label: `Helpcenter: ${a.titel}`, ref: a.slug, citaat: a.samenvatting }], acties: [{ soort: 'artikel', label: 'Open het artikel', slug: a.slug }, ...accActies] }
  return { tekst: 'Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd.', bronnen: [], acties: accActies, doorgestuurd: true }
}

/** Vangrails na het antwoord: citaten letterlijk (anders weg), geen bewering over een account zonder bron. */
export function controleerAntwoord(m: Materiaal, a: Antwoord): Antwoord {
  const { geldig } = bronnenVoorAntwoord(materiaalTeksten(m), a.bronnen ?? [])
  const acties = (a.acties ?? []).filter((x) => !x.accountId || x.accountId === m.account?.id)
  if (m.account && !geldig.length && !a.doorgestuurd && a.tekst.includes(m.account.naam)) {
    return { tekst: 'Daar kan ik geen bron voor vinden in jullie gegevens. Kijk op de accountkaart of vraag het anders.', bronnen: [], acties }
  }
  return { ...a, bronnen: geldig, acties }
}

export function soortVoor(vraag: string, context: AssistentContext, pakket: Pakket): { soort: AiSoort; nietInPakket?: boolean } {
  return kiesAssistentSoort(vraag, context, pakket)
}
