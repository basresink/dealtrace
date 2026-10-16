// De importwizard op de server (F02): controle (validatie, MX, ontdubbelen tegen
// het bestand, binnen het bestand en optioneel tegen DealDrive) en verwerken
// (aanmaken, samenvoegen volgens bronprioriteit, onderdrukking, herkomst).
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { alsDoelgroepAccount, instapVelden, laadInstapContext, schrijfInstap } from './reis'
import { dubbelInBestand, valideerImportRij, type ImportDoel, type ImportRij } from '../../shared/leadGenerator'
import { magOverschrijven, type Bron } from '../../shared/herkomst'
import { contactDuplicaat, normaliseerDomein, zoekDuplicaat } from '../../shared/ontdubbelen'
import { websiteUitEmail } from '../../shared/logo'
import { berekenScore } from '../../shared/score'
import { schema } from './db'
import type { DealDriveTreffer } from './dealdriveAdapter'
import { zoekInDealdrive } from './dealdrive'
import { heeftMx } from './mx'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export type Categorie = 'nieuw' | 'alInBestand' | 'mogelijk' | 'dubbelInBestand' | 'fouten' | 'dealdriveKlant' | 'dealdriveProspect'
export type Keuze = 'nieuw' | 'samenvoegen' | 'overslaan' | 'kiezen'
export interface Regel {
  rij: number
  naam: string
  categorie: Categorie
  keuze: Keuze
  match?: { id: string; naam: string; soort?: string; op?: string }
  dubbelVan?: number
  fouten: { veld: string; reden: string }[]
  dealdrive?: DealDriveTreffer
  accountId?: string
  voor?: Record<string, unknown>
}

export const MAX_RIJEN = 10_000
export const MAX_BYTES = 10 * 1024 * 1024

export const emailHash = (e: string) => createHash('sha256').update(e.trim().toLowerCase()).digest('hex')

export async function controleer(tx: Tx, rijen: string[][], koppeling: ImportDoel[], velden: any[]) {
  if (!koppeling.includes('naam')) throw createError({ statusCode: 422, statusMessage: 'Koppel een kolom aan Bedrijfsnaam om verder te gaan' })
  const gelezen: ImportRij[] = rijen.map((r, i) => valideerImportRij(r, i + 2, koppeling, velden))
  // MX op e-maildomeinen (per domein één keer).
  for (const r of gelezen) {
    for (const [veld, adres] of [['E-mail bedrijf', r.account.email], ['Contact e-mail', r.contact?.email]] as const) {
      if (!adres) continue
      if ((await heeftMx(adres.split('@')[1]!)) === false) r.fouten.push({ veld, reden: `Het domein van ${adres} ontvangt geen mail` })
    }
  }
  const bestand = await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, city: schema.accounts.city, postcode: schema.accounts.postcode, accountKind: schema.accounts.accountKind }).from(schema.accounts)
  const dubbel = dubbelInBestand(gelezen.filter((r) => r.account.naam))
  const dubbelVan = new Map<number, number>()
  for (const g of dubbel) for (const r of g.slice(1)) dubbelVan.set(r, g[0]!)
  let dealdriveFout = false
  const regels: Regel[] = []
  for (const r of gelezen) {
    const regel: Regel = { rij: r.rij, naam: r.account.naam || '(zonder naam)', categorie: 'nieuw', keuze: 'nieuw', fouten: r.fouten }
    if (!r.account.naam) { regel.categorie = 'fouten'; regel.keuze = 'overslaan' }
    else if (dubbelVan.has(r.rij)) { regel.categorie = 'dubbelInBestand'; regel.keuze = 'overslaan'; regel.dubbelVan = dubbelVan.get(r.rij) }
    else {
      const d = zoekDuplicaat({ name: r.account.naam, kvk: r.account.kvk, domein: r.account.domein, postcode: r.account.postcode }, bestand)
      if (d.soort === 'zeker') { regel.categorie = 'alInBestand'; regel.keuze = 'samenvoegen'; regel.match = { id: d.match!.id!, naam: d.match!.name, soort: d.match!.accountKind, op: d.op } }
      else if (d.soort === 'mogelijk') { regel.categorie = 'mogelijk'; regel.keuze = 'kiezen'; regel.match = { id: d.match!.id!, naam: d.match!.name, soort: d.match!.accountKind, op: d.op } }
      else if (r.fouten.length) { regel.categorie = 'fouten'; regel.keuze = 'overslaan' }
      if (regel.categorie === 'nieuw' && !dealdriveFout) {
        try {
          const t = await zoekInDealdrive(tx, { kvk: r.account.kvk, domein: r.account.domein, naam: r.account.naam })
          const treffer = t?.[0]
          if (treffer) { regel.dealdrive = treffer; regel.categorie = treffer.soort === 'klant' ? 'dealdriveKlant' : 'dealdriveProspect'; regel.keuze = treffer.soort === 'klant' ? 'overslaan' : 'nieuw' }
        } catch { dealdriveFout = true }
      }
    }
    regels.push(regel)
  }
  const tel = (c: Categorie) => regels.filter((x) => x.categorie === c).length
  return {
    regels, gelezen,
    rapport: {
      nieuw: tel('nieuw'), alInBestand: tel('alInBestand'), mogelijk: tel('mogelijk'), dubbelInBestand: tel('dubbelInBestand'), fouten: tel('fouten'),
      dealdriveKlant: tel('dealdriveKlant'), dealdriveProspect: tel('dealdriveProspect'),
      dealdriveMelding: dealdriveFout ? 'DealDrive was niet bereikbaar; niet gecontroleerd tegen DealDrive.' : null,
    },
  }
}

const VELDEN_DATA = ['website', 'adres', 'telefoon', 'email', 'medewerkers', 'sbi'] as const

/** Verwerkt de batch in één transactie. Geeft de regels met uitkomst terug. */
export async function verwerk(tx: Tx, opties: {
  organisatieId: string; gebruikerId: string; batchId: string; gelezen: ImportRij[]; regels: Regel[]; keuzes: Record<string, string>; eigenaars: string[]
}) {
  const nu = new Date().toISOString()
  const herkomst = { bron: 'import' as Bron, op: nu, door: opties.gebruikerId, batchId: opties.batchId }
  const onderdrukt = new Set((await tx.select({ h: schema.onderdrukkingslijst.emailHash }).from(schema.onderdrukkingslijst)).map((x) => x.h))
  const belMeNiet = new Set((await tx.select({ t: schema.belMeNiet.telefoonE164 }).from(schema.belMeNiet)).map((x) => x.t))
  const bestaandeContacten = await tx.select({ id: schema.contacts.id, accountId: schema.contacts.accountId, firstName: schema.contacts.firstName, lastName: schema.contacts.lastName, email: schema.contacts.email }).from(schema.contacts)
  const perRij = new Map(opties.gelezen.map((r) => [r.rij, r]))
  const accountVoorRij = new Map<number, string>()
  const nieuweAccounts: (typeof schema.accounts.$inferInsert)[] = []
  const nieuweContacten: (typeof schema.contacts.$inferInsert)[] = []
  const activiteiten: (typeof schema.activiteiten.$inferInsert)[] = []
  let eigenaarIndex = 0
  const tel = { nieuw: 0, samengevoegd: 0, overgeslagen: 0, contacten: 0, verhuisd: 0 }

  for (const regel of opties.regels) {
    const r = perRij.get(regel.rij)!
    const k = opties.keuzes[String(regel.rij)]
    const keuze: Keuze = k === 'nieuw' || k === 'overslaan' ? k : k?.startsWith('samenvoegen:') || k === 'samenvoegen' ? 'samenvoegen' : regel.keuze
    if (keuze === 'kiezen') throw createError({ statusCode: 400, statusMessage: `Rij ${regel.rij} (${regel.naam}) vraagt een keuze` })
    if (keuze === 'overslaan' || (keuze === 'nieuw' && !r.account.naam)) { regel.keuze = 'overslaan'; tel.overgeslagen++; continue }
    const matchId = k?.startsWith('samenvoegen:') ? k.slice(12) : regel.match?.id
    if (keuze === 'samenvoegen' && matchId) {
      const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, matchId))
      if (!a) { regel.keuze = 'overslaan'; tel.overgeslagen++; continue }
      const data = { ...(a.data ?? {}) } as any
      const h = { ...(data.herkomst ?? {}) }
      const voor: Record<string, unknown> = {}
      const zet = (veld: string, waarde: unknown, set: (w: unknown) => void, huidig: unknown) => {
        if (waarde === undefined || waarde === null || waarde === '') return
        if (huidig !== undefined && huidig !== null && huidig !== '' && !magOverschrijven(h[veld]?.bron, 'import')) return
        if (huidig !== undefined && huidig !== null && huidig !== '') return // import is de laagste bron: alleen lege velden
        voor[veld] = huidig ?? null
        set(waarde); h[veld] = herkomst
      }
      const kolommen: Partial<typeof schema.accounts.$inferInsert> = {}
      zet('kvk', r.account.kvk, (w) => { kolommen.kvk = w as string }, a.kvk)
      zet('domein', r.account.domein, (w) => { kolommen.domein = w as string }, a.domein)
      zet('postcode', r.account.postcode, (w) => { kolommen.postcode = w as string }, a.postcode)
      zet('plaats', r.account.plaats, (w) => { kolommen.city = w as string }, a.city)
      for (const v of VELDEN_DATA) zet(v, (r.account as any)[v], (w) => { data[v] = w }, data[v])
      const cf = { ...(data.customFields ?? {}) }
      for (const [s, w] of Object.entries(r.account.customFields)) zet(`cf.${s}`, w, (x) => { cf[s] = x }, cf[s])
      data.customFields = cf
      data.herkomst = h
      // Nooit van klant terug naar prospect: account_kind en status blijven zoals ze waren.
      await tx.update(schema.accounts).set({ ...kolommen, data, updatedAt: nu }).where(eq(schema.accounts.id, a.id))
      regel.keuze = 'samenvoegen'; regel.accountId = a.id; regel.voor = voor
      accountVoorRij.set(regel.rij, a.id)
      activiteiten.push({ organisationId: opties.organisatieId, accountId: a.id, soort: 'import', door: opties.gebruikerId, data: { batchId: opties.batchId, samengevoegd: true } })
      tel.samengevoegd++
    } else {
      const id = crypto.randomUUID()
      const data: any = { importBatchId: opties.batchId, customFields: r.account.customFields, herkomst: {} }
      for (const v of VELDEN_DATA) if ((r.account as any)[v] !== undefined) { data[v] = (r.account as any)[v]; data.herkomst[v] = herkomst }
      // Logo en website (opzet uit DealDrive): zonder website komt die uit het e-maildomein van bedrijf of contact.
      let domein = r.account.domein ?? null
      if (!data.website) {
        const web = websiteUitEmail(r.account.email, r.contact?.email)
        if (web) { data.website = web; data.herkomst.website = { ...herkomst, bron: 'web' }; domein = domein ?? normaliseerDomein(web) }
      }
      for (const v of ['naam', 'kvk', 'domein', 'postcode', 'plaats']) if ((r.account as any)[v === 'domein' ? 'domein' : v]) data.herkomst[v] = herkomst
      for (const s of Object.keys(r.account.customFields)) data.herkomst[`cf.${s}`] = herkomst
      const eigenaar = opties.eigenaars[eigenaarIndex++ % opties.eigenaars.length]!
      nieuweAccounts.push({
        id, organisationId: opties.organisatieId, name: r.account.naam, accountKind: 'prospect', nbStatus: 'nieuw', ownerId: eigenaar, nbBron: 'import',
        kvk: r.account.kvk ?? null, domein, postcode: r.account.postcode ?? null, city: r.account.plaats ?? null, data,
        // Geen contactmoment uit een import (F03): laatste_contact_op blijft leeg.
        laatsteContactOp: null,
      })
      regel.keuze = 'nieuw'; regel.accountId = id
      accountVoorRij.set(regel.rij, id)
      activiteiten.push({ organisationId: opties.organisatieId, accountId: id, soort: 'import', door: opties.gebruikerId, data: { batchId: opties.batchId } })
      tel.nieuw++
    }
  }
  // Dubbele rijen in het bestand worden één account: hun contacten gaan naar het account van de eerste rij.
  for (const regel of opties.regels) if (regel.categorie === 'dubbelInBestand' && regel.dubbelVan && accountVoorRij.has(regel.dubbelVan) && !accountVoorRij.has(regel.rij)) accountVoorRij.set(regel.rij, accountVoorRij.get(regel.dubbelVan)!)

  // Instap in de reis (F05): kiesReis per account, fase Gevonden, meldpunt `import`.
  const instapContext = await laadInstapContext(tx)
  const instap: { accountId: string; reisId: string; faseId: string | null; versie: number }[] = []
  for (const a of nieuweAccounts) {
    const iv = instapVelden(instapContext, alsDoelgroepAccount({ klasse: null, postcode: a.postcode ?? null, gebiedId: null, nbBron: 'import', vvBrancheId: null, data: a.data as any }), 'import')
    Object.assign(a, { reisId: iv.reisId, faseId: iv.faseId, doelgroepId: iv.doelgroepId, faseSinds: nu })
    instap.push({ accountId: a.id!, reisId: iv.reisId, faseId: iv.faseId, versie: iv.versie })
  }
  for (let i = 0; i < nieuweAccounts.length; i += 500) await tx.insert(schema.accounts).values(nieuweAccounts.slice(i, i + 500))
  await schrijfInstap(tx, opties.organisatieId, instap, 'import', opties.gebruikerId)

  for (const [rij, accountId] of accountVoorRij) {
    const c = perRij.get(rij)?.contact
    if (!c?.achternaam) continue
    const dubbel = contactDuplicaat({ accountId, firstName: c.voornaam, lastName: c.achternaam, email: c.email }, [...bestaandeContacten, ...nieuweContacten.map((x) => ({ id: x.id!, accountId: x.accountId, firstName: x.firstName ?? null, lastName: x.lastName, email: x.email ?? null }))])
    if (dubbel) {
      if (dubbel.accountId !== accountId && dubbel.id && bestaandeContacten.some((b) => b.id === dubbel.id)) {
        // Bestaat bij een ander bedrijf: verhuizen met datum, niet dubbel aanmaken (15.1).
        const [oud] = await tx.select().from(schema.contacts).where(eq(schema.contacts.id, dubbel.id))
        await tx.update(schema.contacts).set({ accountId, data: { ...oud!.data, verhuisd: [...((oud!.data as any)?.verhuisd ?? []), { van: dubbel.accountId, op: nu.slice(0, 10), batchId: opties.batchId }] }, updatedAt: nu }).where(eq(schema.contacts.id, dubbel.id))
        tel.verhuisd++
      }
      continue
    }
    const afgemeld = c.email ? onderdrukt.has(emailHash(c.email)) : false
    const geblokkeerd = [c.telefoon, c.mobiel].some((n) => n && belMeNiet.has(n))
    const herk: Record<string, any> = {}
    for (const v of ['voornaam', 'achternaam', 'functie', 'email', 'telefoon', 'mobiel']) if ((c as any)[v]) herk[v] = herkomst
    nieuweContacten.push({
      id: crypto.randomUUID(), organisationId: opties.organisatieId, accountId, firstName: c.voornaam ?? null, lastName: c.achternaam, email: c.email ?? null, rol: 'onbekend',
      data: {
        functie: c.functie, telefoon: c.telefoon, mobiel: c.mobiel, importBatchId: opties.batchId, bron: 'import', herkomst: herk, belMeNiet: geblokkeerd || undefined,
        consent: { email: afgemeld ? { status: 'nee', op: nu, bron: 'afgemeld' } : { status: 'onbekend' }, whatsapp: { status: 'onbekend' } },
      } as any,
    })
    tel.contacten++
  }
  for (let i = 0; i < nieuweContacten.length; i += 500) await tx.insert(schema.contacts).values(nieuweContacten.slice(i, i + 500))
  for (let i = 0; i < activiteiten.length; i += 500) await tx.insert(schema.activiteiten).values(activiteiten.slice(i, i + 500))

  // Score voor de nieuwe accounts (geen vaste 50, gat 25), zonder extra queries per account.
  const perAccount = new Map<string, typeof nieuweContacten>()
  for (const c of nieuweContacten) (perAccount.get(c.accountId) ?? perAccount.set(c.accountId, []).get(c.accountId)!).push(c)
  for (const a of nieuweAccounts) {
    const s = berekenScore({ nu: new Date(), laatsteContactOp: null, contacten: (perAccount.get(a.id!) ?? []).map((c) => ({ rol: c.rol ?? 'onbekend', status: 'actief', telefoon: (c.data as any).telefoon, mobiel: (c.data as any).mobiel, email: c.email })) })
    if (s.score) await tx.update(schema.accounts).set({ score: s.score, data: { ...(a.data as any), scoreOpbouw: s.opbouw } }).where(eq(schema.accounts.id, a.id!))
  }
  return tel
}
