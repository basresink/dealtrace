// De leadstroom op de server (F02, ADR-015): een ronde met de bronnen AI-zoeker en KvK,
// ontdubbelen tegen het bestand en DealDrive, beoordelen, het dossier, overnemen als
// prospect met eerste taak en afwijzen met reden. Rekenregels staan in shared/leadGenerator.ts.
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { normaliseerTelefoon } from '../../shared/contactgegevens'
import { creditsVoor, magVragen } from '../../shared/credits'
import { nlTijdstip, nlMoment, plusDagen } from '../../shared/datum'
import { volgendVastBlok } from '../../shared/belblokken'
import {
  alleenEchteUrls, beoordeelLead, bijsturing, brancheUitSbi, controleerBewijs, controleerContacten, GRENZEN, groepeerLead, klasseUitMedewerkers,
  leadSleutels, magRonde, pastNaBijsturing, sbiVoorBranche, zoekopdrachtHash,
  type Bewijs, type BrancheMapping, type LeadContact, type LeadFeiten, type LeadGroep, type Zoekopdracht,
} from '../../shared/leadGenerator'
import { normaliseerDomein, zoekDuplicaat, type AccountKandidaat } from '../../shared/ontdubbelen'
import { instapFase } from '../../shared/reis'
import { klasseCode, type Klasse } from '../../shared/ritmematrix'
import type { Pakket } from '../../shared/types'
import type { JsonSchema } from '../../shared/aiStap'
import { schrijfAudit } from './audit'
import { herbereken } from './accounts'
import { creditsStandVoor } from './agents/bewaker'
import { blokkenVan, sessieOp } from './bellen'
import { kvkContext, kvkMutaties, kvkProfiel, kvkStatus, kvkZoek, KvkFout, type KvkContext, type KvkProfiel } from './bronnen/kvk'
import { schema } from './db'
import { zoekAccounts } from './dealdriveAdapter'
import { voerAiStapUit } from './llm-provider'
import { draaiMotor } from './motor'
import { alsDoelgroepAccount, instapVelden, laadInstapContext, schrijfInstap, verkoopverhaal } from './reis'
import { haalPagina, zoekWeb } from './webBron'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type LeadRij = typeof schema.leads.$inferSelect
export interface LeadGebruiker { id: string; rol: string; niveau: string; werkplek?: string | null; data?: any }

export async function klassenVan(tx: Tx): Promise<Klasse[]> {
  const [k] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'klassen'))
  return ((k?.value ?? []) as Klasse[])
}
export async function brancheMapping(tx: Tx): Promise<BrancheMapping[]> {
  return (await verkoopverhaal(tx)).brancheMapping ?? []
}

const fout = (status: number, bericht: string): never => { throw createError({ statusCode: status, statusMessage: bericht }) }
const kvkFout = (e: unknown) => { if (e instanceof KvkFout) fout(e.statusCode, e.message); throw e }

/** Begin van de dag in Nederland, voor de daggrens. */
function dagBegin(nu: Date): Date {
  return new Date(nlTijdstip(nlMoment(nu).datum, 0, 0))
}

export async function rondesVandaag(tx: Tx, gebruikerId: string, nu = new Date()): Promise<number> {
  const [r] = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.leadRondes)
    .where(and(eq(schema.leadRondes.gebruikerId, gebruikerId), eq(schema.leadRondes.automatisch, false), gte(schema.leadRondes.gestartOp, dagBegin(nu).toISOString())))
  return r?.n ?? 0
}

const ZOEKRONDE: JsonSchema = {
  type: 'object', required: ['bedrijven'], additionalProperties: false,
  properties: { bedrijven: { type: 'array', items: { type: 'object', required: ['naam', 'plaats', 'website', 'url', 'bronzin'], additionalProperties: false, properties: {
    naam: { type: 'string', maxLength: 200 }, plaats: { type: 'string', maxLength: 100 }, website: { type: 'string', maxLength: 300 }, kvk: { type: 'string', maxLength: 12 },
    url: { type: 'string', maxLength: 500 }, bronzin: { type: 'string', maxLength: 600 },
  } } } },
}
const DOSSIER: JsonSchema = {
  type: 'object', required: ['bewijs', 'contacten'], additionalProperties: false,
  properties: {
    bewijs: { type: 'array', items: { type: 'object', required: ['criterium', 'oordeel', 'zin', 'bron'], additionalProperties: false, properties: {
      criterium: { type: 'string', enum: ['klasse', 'branche', 'werkgebied', 'aanleiding', 'groei', 'bereikbaar'] }, oordeel: { type: 'string', enum: ['ja', 'nee', 'onbekend'] },
      zin: { type: 'string', maxLength: 600 }, bron: { type: 'string', maxLength: 40 }, url: { type: 'string', maxLength: 500 }, datum: { type: 'string', maxLength: 30 },
    } } },
    contacten: { type: 'array', items: { type: 'object', required: ['naam', 'bron'], additionalProperties: false, properties: {
      naam: { type: 'string', maxLength: 120 }, functie: { type: 'string', maxLength: 120 }, email: { type: 'string', maxLength: 200 }, telefoon: { type: 'string', maxLength: 40 },
      linkedin: { type: 'string', maxLength: 300 }, bron: { type: 'string', maxLength: 40 },
    } } },
  },
}

const feitenUitProfiel = (p: KvkProfiel, op: string): LeadFeiten => ({
  naam: p.naam, kvk: p.kvk, plaats: p.plaats, postcode: p.postcode, adres: p.adres, lat: p.lat, lng: p.lng, medewerkers: p.medewerkers,
  sbi: p.sbi.map((s) => s.code), website: p.website, domein: normaliseerDomein(p.website),
  contacten: [], zinnen: [],
  herkomst: Object.fromEntries(['naam', 'kvk', 'adres', 'medewerkers', 'sbi'].map((v) => [v, { bron: 'kvk', op }])),
})

/** Het bestand om tegen te ontdubbelen. */
async function bestand(tx: Tx): Promise<AccountKandidaat[]> {
  return (await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, city: schema.accounts.city, postcode: schema.accounts.postcode, accountKind: schema.accounts.accountKind }).from(schema.accounts))
}

// ── Ronde ─────────────────────────────────────────────────────────────────────

export interface RondeUitkomst { rondeId: string; bewaard: boolean; aantal: number; credits: number; kvk: number; melding?: string | null }

/**
 * Eén ronde. Dezelfde zoekopdracht binnen 24 uur geeft het bewaarde resultaat zonder kosten.
 * De grenzen gelden op de server: 10 rondes per gebruiker per dag, 25 bedrijven per ronde,
 * credits vóór de aanroep gecontroleerd en alleen na een geslaagde aanroep geboekt.
 */
export async function draaiRonde(tx: Tx, org: { id: string; pakket: Pakket }, g: LeadGebruiker, z: Zoekopdracht, bronnen: string[], opties: { automatisch?: boolean; nu?: Date } = {}): Promise<RondeUitkomst> {
  const nu = opties.nu ?? new Date()
  const bron = [...new Set(bronnen.filter((b) => b === 'ai' || b === 'kvk'))]
  const mapping = await brancheMapping(tx)
  const branche = sbiVoorBranche(z.brancheId, mapping)
  // De branche uit het verkoopverhaal levert de SBI-codes als de zoekopdracht er geen noemt.
  if (!z.sbi?.length && branche.sbi.length) z = { ...z, sbi: branche.sbi }
  const sbi = z.sbi ?? []
  const hash = zoekopdrachtHash(z, bron)
  const [eerder] = await tx.select().from(schema.leadRondes).where(and(eq(schema.leadRondes.hash, hash), gte(schema.leadRondes.gestartOp, new Date(nu.getTime() - GRENZEN.cacheUren * 3600_000).toISOString()))).orderBy(desc(schema.leadRondes.gestartOp)).limit(1)
  if (eerder) return { rondeId: eerder.id, bewaard: true, aantal: eerder.aantal, credits: 0, kvk: 0 }

  const status = await kvkStatus(tx, org.pakket, nu)
  const stand = await creditsStandVoor(tx, org.id, nu)
  const m = magRonde({ rondesVandaag: opties.automatisch ? 0 : await rondesVandaag(tx, g.id, nu), stand, kvk: { gekoppeld: status.gekoppeld, gebruikt: status.gebruikt, plafond: status.plafond } }, org.pakket, bron)
  if (!m.mag) fout(m.status!, m.reden!)

  const [ronde] = await tx.insert(schema.leadRondes).values({ organisationId: org.id, gebruikerId: g.id, zoekopdracht: z, hash, bronnen: bron, automatisch: !!opties.automatisch, gestartOp: nu.toISOString() }).returning()
  const op = nu.toISOString()
  const kandidaten = new Map<string, { feiten: LeadFeiten; bron: 'ai' | 'kvk'; bronzin?: string; url?: string }>()
  const voegToe = (f: LeadFeiten, b: 'ai' | 'kvk', extra: { bronzin?: string; url?: string } = {}) => {
    const s = leadSleutels(f)
    const bestaand = [...kandidaten.values()].find((k) => leadSleutels(k.feiten).some((x) => s.includes(x)))
    if (bestaand) { bestaand.feiten = { ...f, ...bestaand.feiten, contacten: bestaand.feiten.contacten, zinnen: [...(bestaand.feiten.zinnen ?? []), ...(f.zinnen ?? [])] }; return }
    if (kandidaten.size < GRENZEN.bedrijvenPerRonde) kandidaten.set(s[0]!, { feiten: f, bron: b, ...extra })
  }
  let kvk: KvkContext | null = null
  let melding: string | null = null
  let credits = 0
  let kvkVoor = status.gebruikt
  try {
    if (bron.includes('kvk') || bron.includes('ai')) kvk = await kvkContext(tx, org.pakket)
    // KvK: zoeken op SBI en werkgebied, daarna het basisprofiel (30 dagen gecachet).
    if (bron.includes('kvk') && kvk) {
      for (const r of await kvkZoek(tx, org.id, kvk, { sbi, postcode: z.werkgebied?.postcodes?.length === 1 ? z.werkgebied.postcodes[0] : undefined })) {
        const p = await kvkProfiel(tx, org.id, kvk, r.kvk)
        if (p) voegToe(feitenUitProfiel(p, op), 'kvk')
      }
    }
    // AI-zoeker: hooguit drie webzoekopdrachten; KvK-feiten gaan als feiten het materiaal in.
    if (bron.includes('ai')) {
      const onderwerp = [branche.trefwoorden.join(' '), z.aanleiding, ...(sbi ?? [])].filter(Boolean).join(' ') || 'installatiebedrijf'
      const vragen = [onderwerp, z.aanleiding ? `${z.aanleiding} vacature` : '', z.concurrentId ? `overstappen ${z.concurrentId}` : ''].filter(Boolean)
      const resultaten = await zoekWeb(vragen)
      const kvkFeiten = [...kandidaten.values()].map((k) => ({ naam: k.feiten.naam, kvk: k.feiten.kvk, plaats: k.feiten.plaats, sbi: k.feiten.sbi, medewerkers: k.feiten.medewerkers }))
      const uit = await voerAiStapUit<{ bedrijven: { naam: string; plaats: string; website: string; kvk?: string; url: string; bronzin: string }[] }>(tx, org.id, {
        soort: 'zoekronde', agent: opties.automatisch ? 'zoeker' : null, boekAls: 'zoeker', gebruiker: { id: g.id, niveau: g.niveau as any, data: g.data },
        prompt: `Vind hooguit ${GRENZEN.bedrijvenPerRonde} bedrijven die passen bij deze zoekopdracht. Gebruik alleen bedrijven en URL's uit de zoekresultaten; bronzin is een letterlijk fragment.`,
        schema: ZOEKRONDE, materiaal: { zoekopdracht: z, trefwoorden: branche.trefwoorden, kvkFeiten, zoekresultaten: resultaten },
      }, nu)
      if (uit.ok) {
        credits = creditsVoor('zoekronde')
        for (const b of alleenEchteUrls(uit.antwoord.bedrijven, resultaten)) {
          const fragment = resultaten.find((r) => r.url === b.url)?.fragment ?? ''
          // Een bronzin die niet in het fragment staat, telt niet als bewijs.
          const zin = fragment && fragment.toLowerCase().includes(b.bronzin.toLowerCase().slice(0, 40)) ? fragment : null
          let f: LeadFeiten = { naam: b.naam, plaats: b.plaats || null, website: b.website, domein: normaliseerDomein(b.website), kvk: b.kvk ?? null, contacten: [],
            zinnen: zin ? [{ tekst: zin, bron: 'web', url: b.url, datum: op }] : [], dossierOp: op, herkomst: { naam: { bron: 'ai', op, url: b.url }, website: { bron: 'web', op, url: b.url } } }
          // Verrijken met KvK-feiten als de koppeling er is (KvK gaat boven web en AI).
          if (kvk) {
            try {
              const nr = b.kvk ?? (await kvkZoek(tx, org.id, kvk, { naam: b.naam, plaats: b.plaats || undefined }))[0]?.kvk
              const p = nr ? await kvkProfiel(tx, org.id, kvk, nr) : null
              if (p) f = { ...feitenUitProfiel(p, op), website: p.website ?? f.website, domein: normaliseerDomein(p.website ?? f.website), zinnen: f.zinnen, dossierOp: op, herkomst: { ...f.herkomst, ...feitenUitProfiel(p, op).herkomst } }
            } catch (e) { if (!(e instanceof KvkFout)) throw e; melding = e.message }
          }
          voegToe(f, 'ai', { bronzin: zin ?? undefined, url: b.url })
        }
      } else melding = uit.reden
    }
  } catch (e) { kvkFout(e) }
  kvkVoor = (kvk?.gebruikt ?? kvkVoor) - status.gebruikt

  // Afgewezen komt nooit terug; afwijsredenen sturen bij.
  const afgewezen = await tx.select({ kvk: schema.leads.kvk, naam: schema.leads.naam, domein: schema.leads.domein, postcode: schema.leads.postcode, data: schema.leads.data }).from(schema.leads).where(eq(schema.leads.status, 'afgewezen'))
  const weg = new Set(afgewezen.flatMap((a) => leadSleutels({ naam: a.naam, kvk: a.kvk, domein: a.domein, postcode: a.postcode })))
  const stuur = bijsturing(afgewezen.map((a) => ({ reden: a.data.afwijsreden, medewerkers: a.data.medewerkers, sbi: a.data.sbi, plaats: a.data.plaats })))
  const klassen = await klassenVan(tx)
  let aantal = 0
  for (const k of kandidaten.values()) {
    if (leadSleutels(k.feiten).some((s) => weg.has(s)) || !pastNaBijsturing(k.feiten, stuur)) continue
    const dd = await ddTreffer(k.feiten)
    const b = beoordeelLead(k.feiten, z, klassen, nu)
    const tekst = [k.feiten.naam, ...(k.feiten.zinnen ?? []).map((x) => x.tekst)].join(' ')
    const data = { ...k.feiten, bewijs: b.bewijs, score: b.score, beoordeeld: b.beoordeeld, vvBrancheId: brancheUitSbi(k.feiten.sbi, mapping, tekst), bronzin: k.bronzin ?? null, url: k.url ?? null, dealdrive: dd }
    const bestaand = await zoekLead(tx, k.feiten)
    if (bestaand?.status === 'afgewezen') continue
    if (bestaand) {
      await tx.update(schema.leads).set({ rondeId: ronde!.id, data: { ...bestaand.data, ...data, contacten: bestaand.data.contacten?.length ? bestaand.data.contacten : data.contacten }, dossierOp: bestaand.dossierOp ?? data.dossierOp ?? null, updatedAt: op }).where(eq(schema.leads.id, bestaand.id))
    } else {
      await tx.insert(schema.leads).values({
        organisationId: org.id, naam: k.feiten.naam, kvk: k.feiten.kvk ?? null, domein: k.feiten.domein ?? null, postcode: k.feiten.postcode ?? null, plaats: k.feiten.plaats ?? null,
        bron: k.bron, bronRef: ronde!.id, rondeId: ronde!.id, gevondenDoor: g.id, gevondenOp: op, dossierOp: k.feiten.dossierOp ?? null, data,
      })
    }
    aantal++
  }
  await tx.update(schema.leadRondes).set({ aantal, kosten: { credits, kvk: kvkVoor, ...(melding ? { fout: melding } : {}) } }).where(eq(schema.leadRondes.id, ronde!.id))
  await tx.execute(sql`insert into lead_verbruik (organisation_id, maand, soort, aantal) values (${org.id}, ${op.slice(0, 7)}, 'ronde', 1)
    on conflict (organisation_id, maand, soort) do update set aantal = lead_verbruik.aantal + 1`)
  return { rondeId: ronde!.id, bewaard: false, aantal, credits, kvk: kvkVoor, melding }
}

async function ddTreffer(f: LeadFeiten): Promise<LeadRij['data']['dealdrive']> {
  try {
    const t = await zoekAccounts({ kvk: f.kvk, domein: f.domein, naam: f.naam })
    const h = t?.[0]
    return h ? { soort: h.soort, eigenaar: h.eigenaar, accountId: h.accountId } : null
  } catch {
    // DealDrive onbereikbaar: de ronde loopt door zonder deze controle (B21).
    return null
  }
}

async function zoekLead(tx: Tx, f: Pick<LeadFeiten, 'naam' | 'kvk' | 'domein' | 'postcode'>): Promise<LeadRij | undefined> {
  if (f.kvk) { const [l] = await tx.select().from(schema.leads).where(eq(schema.leads.kvk, f.kvk)); if (l) return l }
  if (f.domein) { const [l] = await tx.select().from(schema.leads).where(eq(schema.leads.domein, f.domein)); if (l) return l }
  const s = leadSleutels(f).at(-1)
  return (await tx.select().from(schema.leads).where(eq(schema.leads.naam, f.naam))).find((l) => leadSleutels(l).at(-1) === s)
}

// ── Lezen ─────────────────────────────────────────────────────────────────────

export interface LeadVoorScherm {
  id: string; naam: string; plaats: string | null; status: string; bron: string; bronLabel: string; accountId: string | null
  klasse: string | null; feiten: LeadFeiten; bewijs: Bewijs[]; score: number; groep: LeadGroep; dossierOp: string | null
  alBekend: { accountId?: string; naam?: string; dealdrive?: { soort: string; eigenaar?: string } } | null
  vvBrancheId: string | null; gevondenOp: string
}

const feitenVan = (l: LeadRij): LeadFeiten => ({ ...l.data, naam: l.naam, kvk: l.kvk, domein: l.domein, postcode: l.postcode, plaats: l.plaats, dossierOp: l.dossierOp })

export async function leadsVoorScherm(tx: Tx, rijen: LeadRij[], z: Zoekopdracht, nu = new Date()): Promise<LeadVoorScherm[]> {
  const klassen = await klassenVan(tx)
  const accounts = await bestand(tx)
  const batches = new Map((await tx.select({ id: schema.importBatches.id, label: schema.importBatches.bronLabel }).from(schema.importBatches)).map((b) => [b.id, b.label]))
  return rijen.map((l) => {
    const f = feitenVan(l)
    const d = l.status === 'overgenomen' ? null : zoekDuplicaat({ name: l.naam, kvk: l.kvk, domein: l.domein, postcode: l.postcode }, accounts)
    const eigen = l.accountId ? accounts.find((a) => a.id === l.accountId) : d?.soort === 'zeker' ? d.match : undefined
    const alBekend = eigen ? { accountId: eigen.id, naam: eigen.name } : l.data.dealdrive ? { dealdrive: { soort: l.data.dealdrive.soort, eigenaar: l.data.dealdrive.eigenaar } } : null
    const b = beoordeelLead(f, z, klassen, nu)
    const klasse = klasseUitMedewerkers(f.medewerkers, klassen)
    return {
      id: l.id, naam: l.naam, plaats: l.plaats, status: l.status, bron: l.bron, accountId: l.accountId,
      bronLabel: l.bron === 'import' ? `Import: ${batches.get(l.bronRef ?? '') ?? 'bestand'}` : l.bron === 'kvk' ? 'KvK' : l.bron === 'ai' ? 'AI-zoeker' : l.bron,
      klasse: klasse ? klasseCode(klassen.find((k) => k.id === klasse) ?? { id: klasse, naam: klasse }) : null,
      feiten: f, bewijs: b.bewijs, score: b.score, groep: groepeerLead({ alBekend: !!alBekend, bewijs: b.bewijs, dossierOp: l.dossierOp }, nu), dossierOp: l.dossierOp, alBekend,
      vvBrancheId: l.data.vvBrancheId ?? null, gevondenOp: l.gevondenOp,
    }
  })
}

// ── Dossier ───────────────────────────────────────────────────────────────────

/**
 * Een nieuw dossier ("Opnieuw uitzoeken", "Toch uitzoeken"): de website en zoekresultaten als
 * materiaal, KvK als feiten. Een citaat moet letterlijk in het materiaal staan; een nummer of
 * e-mail dat niet op een bron staat, wordt niet ingevuld.
 */
export async function maakDossier(tx: Tx, org: { id: string; pakket: Pakket }, g: LeadGebruiker, leadId: string, nu = new Date()) {
  const [l] = await tx.select().from(schema.leads).where(eq(schema.leads.id, leadId))
  if (!l) fout(404, 'Lead onbekend')
  if (l!.status !== 'nieuw') fout(409, 'Deze lead is al afgehandeld')
  const v = magVragen(await creditsStandVoor(tx, org.id, nu), 'dossier', org.pakket)
  if (!v.mag) fout(v.status!, v.reden!)
  const f = feitenVan(l!)
  const resultaten = await zoekWeb([`${f.naam} ${f.plaats ?? ''}`.trim()])
  // Alleen pagina's van dit bedrijf: de eigen website en treffers op hetzelfde domein of met de naam in de titel.
  const eigen = (u: string) => (f.domein && normaliseerDomein(u) === f.domein) || resultaten.some((r) => r.url === u && r.titel.toLowerCase().startsWith(f.naam.toLowerCase()))
  const paginas = (await Promise.all([f.website, ...resultaten.map((r) => r.url)].filter((u): u is string => !!u && (u === f.website || eigen(u))).map((u) => haalPagina(u))))
    .filter((p): p is NonNullable<typeof p> => !!p).filter((p, i, a) => a.findIndex((x) => x.url === p.url) === i)
  const uit = await voerAiStapUit<{ bewijs: Bewijs[]; contacten: LeadContact[] }>(tx, org.id, {
    soort: 'dossier', boekAls: 'zoeker', gebruiker: { id: g.id, niveau: g.niveau as any, data: g.data },
    prompt: 'Zoek per criterium bewijs. Een citaat staat letterlijk in het materiaal; noem alleen URL\'s uit het materiaal; geen verzonnen nummers of adressen.',
    schema: DOSSIER, materiaal: { bedrijf: { naam: f.naam, website: f.website }, kvkFeiten: { kvk: f.kvk, sbi: f.sbi, medewerkers: f.medewerkers, plaats: f.plaats }, paginas: paginas.map((p) => ({ url: p.url, tekst: p.tekst })), zoekresultaten: resultaten },
  }, nu)
  if (!uit.ok) fout(502, 'Het dossier kon niet worden gemaakt. Er zijn geen credits afgeschreven.')
  const op = nu.toISOString()
  const bewijs = controleerBewijs(uit.antwoord!.bewijs, paginas).map((b) => ({ ...b, datum: b.datum ?? op }))
  const contacten = controleerContacten(uit.antwoord!.contacten, paginas.map((p) => p.tekst).join('\n'))
  const zinnen = [...(f.zinnen ?? []).filter((z) => !bewijs.some((b) => b.zin === z.tekst)), ...bewijs.map((b) => ({ tekst: b.zin, bron: b.bron, url: b.url ?? null, datum: b.datum }))]
  const bekend = new Set((f.contacten ?? []).map((c) => c.naam.toLowerCase()))
  const data = { ...l!.data, zinnen, dossierBewijs: bewijs, contacten: [...(f.contacten ?? []), ...contacten.filter((c) => !bekend.has(c.naam.toLowerCase()))] }
  await tx.update(schema.leads).set({ data, dossierOp: op, updatedAt: op }).where(eq(schema.leads.id, l!.id))
  await tx.execute(sql`insert into lead_verbruik (organisation_id, maand, soort, aantal) values (${org.id}, ${op.slice(0, 7)}, 'dossier', 1)
    on conflict (organisation_id, maand, soort) do update set aantal = lead_verbruik.aantal + 1`)
  const [nieuw] = await tx.select().from(schema.leads).where(eq(schema.leads.id, l!.id))
  return nieuw!
}

// ── Overnemen en afwijzen ─────────────────────────────────────────────────────

export type EersteStap = 'belblok' | 'bellen' | 'bezoek'
const BESLISSER = /eigenaar|directeur|dga|bedrijfsleider/i

/**
 * Een prospect uit feiten (overnemen van een lead, KvK opzoeken): account, contacten, herkomst
 * per veld, instap in de reis met `lead-overgenomen`, en de klasse in accounts.klasse (gat 2).
 */
export async function maakProspect(tx: Tx, org: string, door: string, eigenaar: string, f: LeadFeiten, opties: { nbBron: string; reisId?: string | null; notitie?: string | null; leadId?: string | null } ) {
  const accounts = await bestand(tx)
  const d = zoekDuplicaat({ name: f.naam, kvk: f.kvk, domein: f.domein, postcode: f.postcode }, accounts)
  if (d.soort === 'zeker') {
    if (d.match!.accountKind === 'klant') fout(422, `${d.match!.name} is al klant. Een klant wordt nooit terug een prospect.`)
    throw createError({ statusCode: 409, statusMessage: `${d.match!.name} staat al in je bestand.`, data: { accountId: d.match!.id } })
  }
  const klassen = await klassenVan(tx)
  const mapping = await brancheMapping(tx)
  const klasse = klasseUitMedewerkers(f.medewerkers, klassen)
  const nu = new Date().toISOString()
  const herkomst: Record<string, any> = { ...(f.herkomst ?? {}) }
  for (const v of ['naam', 'kvk', 'plaats', 'postcode', 'adres', 'sbi', 'medewerkers', 'website']) if ((f as any)[v] != null && !herkomst[v]) herkomst[v] = { bron: opties.nbBron === 'kvk' ? 'kvk' : 'ai', op: nu }
  if (klasse) herkomst.klasse = { bron: herkomst.medewerkers?.bron ?? 'kvk', op: nu }
  const id = crypto.randomUUID()
  const rij = {
    id, organisationId: org, name: f.naam, accountKind: 'prospect', nbStatus: 'nieuw', ownerId: eigenaar, klasse,
    city: f.plaats ?? null, postcode: f.postcode ?? null, kvk: f.kvk?.replace(/\D/g, '') || null, domein: f.domein ?? normaliseerDomein(f.website), lat: f.lat ?? null, lng: f.lng ?? null,
    nbBron: opties.nbBron, vvBrancheId: brancheUitSbi(f.sbi, mapping, [f.naam, ...(f.zinnen ?? []).map((z) => z.tekst)].join(' ')),
    data: { sbi: f.sbi ?? [], medewerkers: f.medewerkers ?? undefined, adres: f.adres ?? undefined, website: f.website ?? undefined, customFields: {}, herkomst, leadId: opties.leadId ?? undefined } as any,
  }
  let iv = instapVelden(await laadInstapContext(tx), alsDoelgroepAccount({ klasse: rij.klasse, postcode: rij.postcode, gebiedId: null, nbBron: rij.nbBron, vvBrancheId: rij.vvBrancheId, data: rij.data }), 'lead-overgenomen')
  if (opties.reisId && opties.reisId !== iv.reisId) {
    const [r] = await tx.select().from(schema.reistemplates).where(eq(schema.reistemplates.id, opties.reisId))
    if (!r || r.status !== 'actief') fout(422, 'Deze reis bestaat niet of is niet actief')
    iv = { ...iv, reisId: r!.id, versie: r!.versie, faseId: instapFase(r!.data as any, 'lead-overgenomen') }
  }
  await tx.insert(schema.accounts).values({ ...rij, reisId: iv.reisId, faseId: iv.faseId, doelgroepId: iv.doelgroepId, faseSinds: nu })
  await schrijfInstap(tx, org, [{ accountId: id, reisId: iv.reisId, faseId: iv.faseId, versie: iv.versie }], 'lead-overgenomen', door)
  const contacten = (f.contacten ?? []).filter((c) => c.naam?.trim())
  for (const c of contacten) {
    const delen = c.naam.trim().split(/\s+/)
    const tel = c.telefoon ? normaliseerTelefoon(c.telefoon) : null
    const h = { bron: c.bron === 'kvk' ? 'kvk' : 'web', op: nu }
    await tx.insert(schema.contacts).values({
      organisationId: org, accountId: id, firstName: delen.length > 1 ? delen[0]! : null, lastName: delen.length > 1 ? delen.slice(1).join(' ') : delen[0]!,
      email: c.aanname ? null : c.email ?? null, rol: c.functie && BESLISSER.test(c.functie) ? 'beslisser' : 'onbekend',
      data: { functie: c.functie ?? undefined, telefoon: tel?.ok ? tel.e164 : undefined, linkedin: c.linkedin ?? undefined, emailVoorstel: c.aanname ? c.email : undefined, bron: 'leadgenerator', herkomst: { naam: h, ...(c.functie ? { functie: h } : {}), ...(tel?.ok ? { telefoon: h } : {}) }, consent: { email: { status: 'onbekend' }, whatsapp: { status: 'onbekend' } } } as any,
    })
  }
  if (opties.notitie) await tx.insert(schema.activiteiten).values({ organisationId: org, accountId: id, soort: 'notitie', door, data: { tekst: opties.notitie, bron: 'leadgenerator', leadId: opties.leadId ?? null } })
  const s = await herbereken(tx, id)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'account.aanmaken', resourceType: 'accounts', resourceId: id, changes: { naam: f.naam, bron: opties.nbBron } })
  return { id, naam: f.naam, klasse: klasse ? klasseCode(klassen.find((k) => k.id === klasse) ?? { id: klasse, naam: klasse }) : null, score: s?.score ?? 0, contacten: contacten.length }
}

const DAGNAAM = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', timeZone: 'Europe/Amsterdam' })
const TIJD = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })

/**
 * De eerste taak volgens het werkplekprofiel: binnendienst de eerste belpoging in het
 * eerstvolgende acquisitieblok, buitendienst een bezoek of eerst bellen. De motor draait eerst
 * (regels per gebeurtenis); bestaat er daarna al een contacttaak, dan komt er geen tweede.
 */
export async function eersteTaak(tx: Tx, org: string, eigenaar: { id: string; werkplek?: string | null; data?: any }, account: { id: string; naam: string }, stap: EersteStap, nu = new Date()): Promise<{ taskId: string; tekst: string }> {
  await draaiMotor(tx, org, { soort: 'gebeurtenis', door: eigenaar.id, accountIds: [account.id], nu })
  // Maakte de motor al een contacttaak (bijvoorbeeld SR07), dan wordt die de eerste taak.
  const [open] = await tx.select().from(schema.tasks).where(and(eq(schema.tasks.accountId, account.id), inArray(schema.tasks.status, ['open', 'bezig']), inArray(schema.tasks.actionType, ['bellen', 'bezoek'])))
  if (open && !(stap === 'belblok' && open.actionType === 'bellen')) return { taskId: open.id, tekst: 'De eerste taak staat klaar.' }
  const tijd = nu.toISOString()
  const herkomst = { bron: 'leadgenerator', actiesoort: stap === 'bezoek' ? 'bezoek' : 'bellen', uitvoerder: eigenaar.id }
  if (stap === 'belblok') {
    const { blokken } = blokkenVan(eigenaar)
    const v = volgendVastBlok(blokken.filter((b) => b.soort === 'koud' || b.soort === 'gemengd'), nu)
    if (v) {
      const start = v.start.toISOString()
      const s = await sessieOp(tx, org, eigenaar.id, start, new Date(v.start.getTime() + v.blok.minuten * 60_000).toISOString(), { plek: v.blok.plek, soort: v.blok.soort, verhouding: v.blok.verhouding, scriptId: v.blok.scriptId ?? null, gesprekken: [] }, v.blok.id)
      if (open) {
        await tx.update(schema.tasks).set({ title: `Poging 1: ${account.naam}`, dueDate: start, belblokId: s.status === 'gepland' ? s.id : null, data: { ...(open.data as any), poging: { n: 1, van: 5, kanaal: 'bellen' }, ...(s.status === 'gepland' ? { belblokId: s.id } : {}) }, updatedAt: tijd }).where(eq(schema.tasks.id, open.id))
        return { taskId: open.id, tekst: `Eerste belpoging staat in je blok van ${DAGNAAM.format(v.start)} ${TIJD.format(v.start)}.` }
      }
      const [t] = await tx.insert(schema.tasks).values({
        organisationId: org, ownerId: eigenaar.id, accountId: account.id, actionType: 'bellen', title: `Poging 1: ${account.naam}`, priority: 'middel', dueDate: start, executor: 'mens',
        belblokId: s.status === 'gepland' ? s.id : null, onderwerp: `${account.id}:eerste`, data: { waarom: 'Nieuwe lead uit de leadgenerator', herkomst, poging: { n: 1, van: 5, kanaal: 'bellen' }, ...(s.status === 'gepland' ? { belblokId: s.id } : {}) }, createdAt: tijd, updatedAt: tijd,
      }).returning({ id: schema.tasks.id })
      return { taskId: t!.id, tekst: `Eerste belpoging staat in je blok van ${DAGNAAM.format(v.start)} ${TIJD.format(v.start)}.` }
    }
  }
  const dag = plusDagen(nlMoment(nu).datum, 1)
  const due = nlTijdstip(dag, 9, 0).toISOString()
  const [t] = await tx.insert(schema.tasks).values({
    organisationId: org, ownerId: eigenaar.id, accountId: account.id, actionType: stap === 'bezoek' ? 'bezoek' : 'bellen', title: `${stap === 'bezoek' ? 'Bezoek' : 'Poging 1'}: ${account.naam}`, priority: 'middel',
    dueDate: due, executor: 'mens', onderwerp: `${account.id}:eerste`, data: { waarom: 'Nieuwe lead uit de leadgenerator', herkomst, ...(stap === 'bezoek' ? {} : { poging: { n: 1, van: 5, kanaal: 'bellen' } }) }, createdAt: tijd, updatedAt: tijd,
  }).returning({ id: schema.tasks.id })
  return { taskId: t!.id, tekst: stap === 'bezoek' ? 'Het bezoek staat morgen op je lijst.' : 'De eerste belpoging staat morgen op je lijst.' }
}

const bewijsNotitie = (l: LeadRij) => ['Gevonden met de leadgenerator.', ...(l.data.bewijs ?? []).filter((b) => b.oordeel !== 'onbekend').map((b) => `${b.oordeel === 'ja' ? 'Ja' : 'Nee'}: ${b.zin} (${b.bron}${b.datum ? `, ${b.datum.slice(0, 10)}` : ''})`)].join('\n')

export async function neemOver(tx: Tx, org: string, door: LeadGebruiker, leadId: string, b: { eigenaar?: string | null; reisId?: string | null; eersteStap?: EersteStap | null }) {
  const [l] = await tx.select().from(schema.leads).where(eq(schema.leads.id, leadId))
  if (!l) fout(404, 'Lead onbekend')
  if (l!.status !== 'nieuw') fout(409, l!.status === 'overgenomen' ? 'Deze lead is al overgenomen' : 'Deze lead is afgewezen')
  const eigenaarId = b.eigenaar || door.id
  if (eigenaarId !== door.id && !['salesmanager', 'beheerder', 'founder'].includes(door.rol)) fout(403, 'Alleen een salesmanager zet leads klaar voor een ander')
  const [eigenaar] = await tx.select({ id: schema.users.id, werkplek: schema.users.werkplek, data: schema.users.data, naam: schema.users.name }).from(schema.users).where(eq(schema.users.id, eigenaarId))
  if (!eigenaar) fout(422, 'Deze eigenaar bestaat niet in je organisatie')
  const f = feitenVan(l!)
  const p = await maakProspect(tx, org, door.id, eigenaar!.id, f, { nbBron: 'leadgenerator', reisId: b.reisId, notitie: bewijsNotitie(l!), leadId: l!.id })
  const stap: EersteStap = b.eersteStap ?? (eigenaar!.werkplek === 'buitendienst' ? 'bezoek' : 'belblok')
  const taak = await eersteTaak(tx, org, eigenaar!, { id: p.id, naam: p.naam }, stap)
  await tx.update(schema.leads).set({ status: 'overgenomen', accountId: p.id, updatedAt: new Date().toISOString() }).where(eq(schema.leads.id, l!.id))
  return { ...p, eersteTaak: taak, tekst: `${p.naam} staat nu bij ${eigenaar!.id === door.id ? 'je' : `de`} prospects${eigenaar!.id === door.id ? '' : ` van ${eigenaar!.naam}`}${p.klasse ? `, klasse ${p.klasse}` : ''}. ${taak.tekst}` }
}

export async function wijsAf(tx: Tx, door: string, leadId: string, reden: string) {
  const [l] = await tx.select().from(schema.leads).where(eq(schema.leads.id, leadId))
  if (!l) fout(404, 'Lead onbekend')
  if (l!.status === 'overgenomen') fout(409, 'Deze lead is al overgenomen')
  await tx.update(schema.leads).set({ status: 'afgewezen', data: { ...l!.data, afwijsreden: reden, afgewezenDoor: door }, updatedAt: new Date().toISOString() }).where(eq(schema.leads.id, l!.id))
  const [n] = await tx.select().from(schema.leads).where(eq(schema.leads.id, l!.id))
  return n!
}

// ── Onderhoud in de motorrun ──────────────────────────────────────────────────

/**
 * Na elke geplande motorrun: automatische rondes per opgeslagen zoekopdracht (wekelijks,
 * agents stoppen onder 10 procent credits), opruimen (niet overgenomen 60 dagen, afgewezen
 * 120 dagen) en maandelijks de KvK-mutatiecontrole voor accounts in reis (signaal voor SR23).
 */
export async function leadOnderhoud(tx: Tx, org: string, nu = new Date()) {
  const uit = { automatisch: 0, opgeruimd: 0, mutaties: 0 }
  const grens = (d: number) => new Date(nu.getTime() - d * 864e5).toISOString()
  const weg1 = await tx.delete(schema.leads).where(and(eq(schema.leads.status, 'nieuw'), sql`${schema.leads.updatedAt} < ${grens(GRENZEN.opruimenNietOvergenomen)}`)).returning({ id: schema.leads.id })
  const weg2 = await tx.delete(schema.leads).where(and(eq(schema.leads.status, 'afgewezen'), sql`${schema.leads.updatedAt} < ${grens(GRENZEN.opruimenAfgewezen)}`)).returning({ id: schema.leads.id })
  uit.opgeruimd = weg1.length + weg2.length
  const [o] = await tx.select({ pakket: schema.organisations.pakket }).from(schema.organisations).where(eq(schema.organisations.id, org))
  if (!o) return uit
  const pakket = o.pakket as Pakket
  const zo = await tx.select().from(schema.leadZoekopdrachten).where(and(eq(schema.leadZoekopdrachten.automatisch, 'wekelijks'), sql`(${schema.leadZoekopdrachten.laatstOp} is null or ${schema.leadZoekopdrachten.laatstOp} < ${grens(7)})`))
  for (const z of zo) {
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, z.gebruikerId))
    if (!u) continue
    try {
      const r = await draaiRonde(tx, { id: org, pakket }, { id: u.id, rol: u.role, niveau: u.niveau, werkplek: u.werkplek, data: u.data }, z.zoekopdracht, z.bronnen, { automatisch: true, nu })
      uit.automatisch++
      if (!r.bewaard && r.aantal) {
        await tx.insert(schema.notificaties).values({ id: crypto.randomUUID(), organisationId: org, gebruikerId: u.id, soort: 'systeem', titel: `${r.aantal} leads uit "${z.naam}"`, tekst: 'De wekelijkse ronde is klaar.', link: `/leadgenerator?ronde=${r.rondeId}`, op: nu.toISOString(), data: {} })
      }
    } catch (e) {
      // Een geweigerde ronde (credits, plafond, koppeling) slaat deze week over.
      if (!(e as any)?.statusCode) throw e
    }
    await tx.update(schema.leadZoekopdrachten).set({ laatstOp: nu.toISOString() }).where(eq(schema.leadZoekopdrachten.id, z.id))
  }
  const [k] = await tx.select().from(schema.koppelingen).where(eq(schema.koppelingen.soort, 'kvk'))
  const vorige = k?.instellingen?.mutatiesOp as string | undefined
  if (vorige && Date.parse(vorige) > Date.parse(grens(30))) return uit
  const ctx = await kvkContext(tx, pakket)
  if (!ctx) return uit
  const inReis = await tx.select({ id: schema.accounts.id, kvk: schema.accounts.kvk, data: schema.accounts.data }).from(schema.accounts).where(and(eq(schema.accounts.nbStatus, 'in reis'), sql`${schema.accounts.kvk} is not null`))
  try {
    const m = await kvkMutaties(tx, org, ctx, inReis.map((a) => a.kvk!), vorige ? new Date(vorige) : new Date(grens(30)))
    for (const x of m) {
      const a = inReis.find((r) => r.kvk === x.kvk)
      if (!a) continue
      const signalen = [...((a.data as any)?.signalen ?? []), { id: `kvk-${x.kvk}-${x.op.slice(0, 10)}`, soort: 'kvk-mutatie', op: x.op, extern: true, tekst: x.tekst, bron: 'kvk' }]
      await tx.update(schema.accounts).set({ data: { ...(a.data as any), signalen } }).where(eq(schema.accounts.id, a.id))
      uit.mutaties++
    }
  } catch (e) { if (!(e instanceof KvkFout)) throw e }
  if (k) await tx.update(schema.koppelingen).set({ instellingen: { ...k.instellingen, mutatiesOp: nu.toISOString() } }).where(eq(schema.koppelingen.id, k.id))
  return uit
}

/** Invoercontrole voor een zoekopdracht uit het scherm. */
export function schoonZoekopdracht(z: any): Zoekopdracht {
  const lijst = (v: unknown, max: number) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim()).filter(Boolean))].slice(0, max) : [])
  const num = (v: unknown) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
  const s = z?.werkgebied?.straal
  const straal = s && [s.lat, s.lng, s.km].every((x) => Number.isFinite(Number(x))) ? { lat: Number(s.lat), lng: Number(s.lng), km: Math.max(1, Math.min(300, Number(s.km))) } : null
  return {
    doelgroepId: z?.doelgroepId ? String(z.doelgroepId) : null, doelgroepNaam: z?.doelgroepNaam ? String(z.doelgroepNaam).slice(0, 120) : null, lijktOpKlanten: !!z?.lijktOpKlanten,
    klassen: lijst(z?.klassen, 6).map((k) => k.toUpperCase().slice(0, 2)), omvang: { min: num(z?.omvang?.min), max: num(z?.omvang?.max) },
    sbi: lijst(z?.sbi, 3).filter((x) => /^\d{2,5}$/.test(x)), brancheId: z?.brancheId ? String(z.brancheId) : null,
    werkgebied: { postcodes: lijst(z?.werkgebied?.postcodes, 12).map((p) => p.replace(/\s/g, '').toUpperCase()).filter((p) => /^\d{1,4}[A-Z]{0,2}$/.test(p)), straal },
    aanleiding: String(z?.aanleiding ?? '').trim().slice(0, 200), concurrentId: z?.concurrentId ? String(z.concurrentId) : null,
  }
}

/**
 * "Verrijk na import via KvK" (P04 stap 4): accounts met een KvK-nummer krijgen SBI, medewerkers,
 * adres en klasse uit het basisprofiel. KvK gaat boven import (10.1); wat met de hand is gezet
 * blijft staan. Stopt netjes bij het plafond.
 */
export async function verrijkViaKvk(tx: Tx, org: string, pakket: Pakket, accountIds: string[]): Promise<{ verrijkt: number; gestopt: string | null }> {
  const ctx = await kvkContext(tx, pakket)
  if (!ctx || !accountIds.length) return { verrijkt: 0, gestopt: ctx ? null : 'KvK is niet gekoppeld' }
  const klassen = await klassenVan(tx)
  const rijen = await tx.select().from(schema.accounts).where(and(inArray(schema.accounts.id, accountIds), sql`${schema.accounts.kvk} is not null`))
  const op = new Date().toISOString()
  let verrijkt = 0
  for (const a of rijen) {
    let p: KvkProfiel | null
    try { p = await kvkProfiel(tx, org, ctx, a.kvk!) } catch (e) { if (e instanceof KvkFout) return { verrijkt, gestopt: e.message }; throw e }
    if (!p) continue
    const data = { ...(a.data as any) }
    const h = { ...(data.herkomst ?? {}) }
    const magZetten = (veld: string, huidig: unknown) => huidig == null || huidig === '' || (h[veld]?.bron !== 'hand')
    const kol: Partial<typeof schema.accounts.$inferInsert> = {}
    if (p.sbi.length && magZetten('sbi', data.sbi?.length ? data.sbi : null)) { data.sbi = p.sbi.map((s) => s.code); h.sbi = { bron: 'kvk', op } }
    if (p.medewerkers != null && magZetten('medewerkers', data.medewerkers)) { data.medewerkers = p.medewerkers; h.medewerkers = { bron: 'kvk', op } }
    if (p.adres && magZetten('adres', data.adres)) { data.adres = p.adres; h.adres = { bron: 'kvk', op } }
    if (p.postcode && magZetten('postcode', a.postcode)) { kol.postcode = p.postcode; h.postcode = { bron: 'kvk', op } }
    if (p.plaats && magZetten('plaats', a.city)) { kol.city = p.plaats; h.plaats = { bron: 'kvk', op } }
    if (p.lat != null && a.lat == null) { kol.lat = p.lat; kol.lng = p.lng }
    const k = klasseUitMedewerkers(data.medewerkers, klassen)
    if (!a.klasse && k) { kol.klasse = k; h.klasse = { bron: 'kvk', op } }
    data.herkomst = h
    await tx.update(schema.accounts).set({ ...kol, data, updatedAt: op }).where(eq(schema.accounts.id, a.id))
    verrijkt++
  }
  return { verrijkt, gestopt: null }
}
