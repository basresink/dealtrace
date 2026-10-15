// POST /api/sync/mutations: de schrijfweg van de offline wachtrij (bouwplan F24, 8.14).
//
// Per mutatie: de tabel moet op de allowlist staan (shared/syncTabellen.ts), de
// rechtenmatrix moet het toestaan, en de idempotentiesleutel zorgt dat een
// mutatie na herstel van de verbinding precies één keer aankomt. Met een
// meegegeven versie controleert de server op conflicten (409 per mutatie).

import { markeerGelezen } from '../../utils/help'
import { and, eq } from 'drizzle-orm'
import { rolMag } from '../../../shared/permissions'
import { SYNCBARE_TABELLEN, isSyncbareTabel } from '../../../shared/syncTabellen'
import { pasPatchToe } from '../../../shared/wisPatch'
import { metOrganisatie, schema } from '../../utils/db'
import { ACCOUNT_MUTATIESOORTEN, AFSPRAAK_MUTATIESOORTEN, KANS_MUTATIESOORTEN, INZICHT_MUTATIESOORTEN, SIGNAAL_MUTATIESOORTEN, TAAK_MUTATIESOORTEN } from '../../../shared/syncTabellen'
import { besluit } from '../../utils/dagritme'
import { planAfspraak, rondAfAfspraak } from '../../utils/agenda'
import { klaarzetten } from '../../utils/bezoeken'
import { OVERSLA_REDENEN } from '../../../shared/route'
import { nlMoment, plusDagen } from '../../../shared/datum'
import { sql } from 'drizzle-orm'
import { AFWIJS_REDENEN, uitstellen } from '../../../shared/taken'
import { magTaak, rondAf } from '../../utils/taken'
import { isNeeReden } from '../../../shared/nbStatus'
import { kan } from '../../utils/accounts'
import { ReisFout, pauzeer, zetNee } from '../../utils/reis'
import { vereisOrganisatie, vereisSessie } from '../../utils/sessie'

interface Mutatie {
  idempotentieSleutel: string
  tabel: string
  op: 'patch'
  recordId: string
  versie?: number
  patch: Record<string, unknown>
}

type Resultaat =
  | { status: 'ok'; recordId: string; versie: number }
  | { status: 'conflict'; recordId: string; serverVersie: number; serverStand: unknown }
  | { status: 'geweigerd'; recordId: string; code: 403 | 400 | 404 | 422; reden: string }

const NOTIFICATIE_VELDEN = new Set(['gelezenOp', 'verborgenOp'])

export default defineEventHandler(async (event) => {
  // De syncbare tabellen zijn nu alleen eigen gegevens van de gebruiker (meldingen,
  // persoonlijke instellingen): die staan in zijn eigen organisatie. Klantdata
  // die later syncbaar wordt, gebruikt de actieve organisatie (en valt onder meekijken).
  const { gebruiker } = await vereisSessie(event)
  const organisatie = { id: gebruiker.organisationId! }
  const { mutaties } = await readBody<{ mutaties?: Mutatie[] }>(event)
  if (!Array.isArray(mutaties) || mutaties.length > 200) throw createError({ statusCode: 400, statusMessage: 'Geef tussen 1 en 200 mutaties' })
  // Klantdata (accounts) gebruikt de actieve organisatie en de functierechten.
  const KLANTDATA = new Set(['accounts', 'tasks', 'signals', 'appointments', 'kans_overslaan', 'klaargezet_voor'])
  const klant = mutaties.some((m) => KLANTDATA.has(m?.tabel)) ? await vereisOrganisatie(event) : null

  const resultaten: Resultaat[] = []
  for (const m of mutaties) {
    const orgId = KLANTDATA.has(m?.tabel) && klant ? klant.organisatie.id : organisatie.id
    resultaten.push(await metOrganisatie(orgId, async (tx): Promise<Resultaat> => {
      if (!m?.idempotentieSleutel || !m.recordId) return { status: 'geweigerd', recordId: m?.recordId ?? '', code: 400, reden: 'idempotentieSleutel en recordId zijn verplicht' }

      // Al verwerkt? Dan hetzelfde antwoord, zonder iets opnieuw te doen.
      const [eerder] = await tx.select().from(schema.mutaties).where(eq(schema.mutaties.id, m.idempotentieSleutel))
      if (eerder) return eerder.resultaat as Resultaat

      if (!isSyncbareTabel(m.tabel)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: `Tabel ${m.tabel} staat niet op de allowlist` }
      const onderdeel = SYNCBARE_TABELLEN[m.tabel]

      const sleutel = `${m.tabel}:${m.recordId}`
      const [rec] = await tx.select().from(schema.serverRecords).where(eq(schema.serverRecords.key, sleutel))
      const huidigeVersie = rec?.version ?? 0

      let resultaat: Resultaat
      if (m.tabel === 'accounts') {
        // Alleen "Zet nee" en "Pauzeer tot", via dezelfde regels als de knoppen.
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(ACCOUNT_MUTATIESOORTEN as readonly string[]).includes(p.soort)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen account.nee en account.pauzeer mogen via de wachtrij' }
        if (!klant || !kan(klant, 'account.nee')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
        const op = p.op && !Number.isNaN(Date.parse(p.op)) ? new Date(p.op) : new Date()
        try {
          if (p.soort === 'account.nee') {
            if (!isNeeReden(p.reden) || (p.reden === 'Anders' && !String(p.toelichting ?? '').trim())) return { status: 'geweigerd', recordId: m.recordId, code: 422, reden: 'Reden ontbreekt of is onbekend' }
            await zetNee(tx, m.recordId, { reden: p.reden, toelichting: p.toelichting, verlorenAan: p.verlorenAan ?? null, terugOp: p.terugOp, afkoeling: p.afkoeling }, gebruiker.id, op)
          } else {
            await pauzeer(tx, m.recordId, String(p.tot ?? ''), p.reden ?? null, gebruiker.id, op)
          }
        } catch (e) {
          if (e instanceof ReisFout) return { status: 'geweigerd', recordId: m.recordId, code: e.statusCode === 404 ? 404 : 422, reden: e.message }
          throw e
        }
      } else if (m.tabel === 'tasks') {
        // Afronden gaat door hetzelfde pad als de flyout (gat 11); idempotent op de sleutel.
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(TAAK_MUTATIESOORTEN as readonly string[]).includes(p.soort)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen taak.afronden en taak.uitstellen mogen via de wachtrij' }
        if (!klant || !kan(klant, 'taken.basis')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
        const [t] = await tx.select().from(schema.tasks).where(eq(schema.tasks.id, m.recordId))
        if (!t) return { status: 'geweigerd', recordId: m.recordId, code: 404, reden: 'Taak onbekend' }
        if (t.ownerId && !(await magTaak(tx, klant, t.ownerId))) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Dit is niet jouw taak' }
        const op = p.op && !Number.isNaN(Date.parse(p.op)) ? new Date(p.op) : new Date()
        try {
          if (p.soort === 'taak.afronden') await rondAf(tx, m.recordId, { uitkomst: p.uitkomst ?? null, laterOp: p.laterOp ?? null, reden: p.reden ?? null, toelichting: p.toelichting ?? null, sleutel: m.idempotentieSleutel }, gebruiker.id, op)
          else await tx.update(schema.tasks).set({ dueDate: uitstellen(t, p.periode === 'week' ? 'week' : 'werkdag', op), updatedAt: new Date().toISOString() }).where(eq(schema.tasks.id, m.recordId))
        } catch (e) {
          if (e instanceof ReisFout) return { status: 'geweigerd', recordId: m.recordId, code: e.statusCode === 404 ? 404 : 422, reden: e.message }
          throw e
        }
      } else if (m.tabel === 'signals') {
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(INZICHT_MUTATIESOORTEN as readonly string[]).includes(p.soort)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen inzicht.gelezen en inzicht.afwijzen mogen via de wachtrij' }
        const [s] = await tx.select().from(schema.signals).where(eq(schema.signals.id, m.recordId))
        if (!s) return { status: 'geweigerd', recordId: m.recordId, code: 404, reden: 'Inzicht onbekend' }
        if (p.soort === 'inzicht.afwijzen') {
          if (!klant || !kan(klant, 'inzichten.afwijzen')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
          if (!(AFWIJS_REDENEN as readonly string[]).includes(p.reden)) return { status: 'geweigerd', recordId: m.recordId, code: 422, reden: 'Kies een reden om af te wijzen' }
          await tx.update(schema.signals).set({ status: 'afgewezen', data: { ...(s.data ?? {}), afwijsReden: p.reden }, updatedAt: new Date().toISOString() }).where(eq(schema.signals.id, m.recordId))
        } else if (s.status === 'nieuw') await tx.update(schema.signals).set({ status: 'gelezen', updatedAt: new Date().toISOString() }).where(eq(schema.signals.id, m.recordId))
      } else if (m.tabel === 'appointments') {
        // P13: plannen (afspraak.nieuw, recordId = nieuw id) en afronden (afspraak.afronden) via
        // dezelfde regels als de flyout; idempotent op de sleutel, afronden ook op afspraak en uitkomst.
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(AFSPRAAK_MUTATIESOORTEN as readonly string[]).includes(p.soort)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen afspraak.nieuw en afspraak.afronden mogen via de wachtrij' }
        if (!klant || !kan(klant, 'agenda.basis')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
        const op = p.op && !Number.isNaN(Date.parse(p.op)) ? new Date(p.op) : new Date()
        try {
          if (p.soort === 'afspraak.nieuw') await planAfspraak(tx, klant.organisatie.id, { id: gebruiker.id, naam: klant.gebruiker.naam, rol: klant.gebruiker.rol, mag: { voorCollega: kan(klant, 'agenda.voorCollega') } }, { ...p, id: m.recordId } as any, op)
          else await rondAfAfspraak(tx, klant.organisatie.id, m.recordId, gebruiker.id, { uitkomst: String(p.uitkomst ?? ''), verslag: p.verslag ?? null, agendapunten: p.agendapunten ?? [], laterOp: p.laterOp ?? null, reden: p.reden ?? null, toelichting: p.toelichting ?? null, verlorenAan: p.verlorenAan ?? null, vervolgstap: p.vervolgstap ?? null, sleutel: m.idempotentieSleutel }, op)
        } catch (e: any) {
          if (e instanceof ReisFout) return { status: 'geweigerd', recordId: m.recordId, code: e.statusCode === 404 ? 404 : 422, reden: e.message }
          if (e?.statusCode && [400, 403, 404, 409, 422].includes(e.statusCode)) return { status: 'geweigerd', recordId: m.recordId, code: e.statusCode === 409 ? 422 : e.statusCode, reden: e.message }
          throw e
        }
      } else if (m.tabel === 'kans_overslaan' || m.tabel === 'klaargezet_voor') {
        // P14: overslaan en klaarzetten, ook offline; recordId is het account.
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(KANS_MUTATIESOORTEN as readonly string[]).includes(p.soort)) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen kans.overslaan en kans.klaarzetten mogen via de wachtrij' }
        if (p.soort === 'kans.overslaan') {
          if (!klant || !kan(klant, 'bezoeken.route')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
          if (!OVERSLA_REDENEN.includes(p.reden)) return { status: 'geweigerd', recordId: m.recordId, code: 422, reden: 'Kies een reden om over te slaan' }
          await tx.execute(sql`insert into kans_overslaan (organisation_id, gebruiker_id, account_id, tot, reden) values (${klant.organisatie.id}, ${gebruiker.id}, ${m.recordId}, ${plusDagen(nlMoment(new Date()).datum, 7)}, ${p.reden})`)
        } else {
          if (!klant || !kan(klant, 'bezoeken.klaarzetten')) return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Functie niet beschikbaar' }
          try { await klaarzetten(tx, klant.organisatie.id, { id: gebruiker.id, naam: klant.gebruiker.naam }, m.recordId, { voorGebruiker: String(p.voorGebruiker ?? ''), regioId: p.regioId ?? null, datum: p.datum ?? null, reden: String(p.reden ?? '').slice(0, 300) }) } catch (e: any) {
            if (e?.statusCode && [400, 404].includes(e.statusCode)) return { status: 'geweigerd', recordId: m.recordId, code: e.statusCode, reden: e.message }
            throw e
          }
        }
      } else if (m.tabel === 'signaal_besluiten') {
        // P32: Gedaan, Later of Weg; recordId is de signaalsleutel. Het besluit telt op de dag waarop het viel.
        const p = (m.patch ?? {}) as Record<string, any>
        if (!(SIGNAAL_MUTATIESOORTEN as readonly string[]).includes(p.soort) || !['gedaan', 'later', 'weg'].includes(p.besluit)) return { status: 'geweigerd', recordId: m.recordId, code: 422, reden: 'Alleen signaal.besluit met Gedaan, Later of Weg' }
        await besluit(tx, organisatie.id, gebruiker.id, m.recordId.slice(0, 200), p.besluit, p.op && !Number.isNaN(Date.parse(p.op)) ? new Date(p.op) : new Date())
      } else if (m.tabel === 'help_gelezen') {
        if (!(await markeerGelezen(tx, organisatie.id, gebruiker.id, m.recordId))) return { status: 'geweigerd', recordId: m.recordId, code: 404, reden: 'Artikel onbekend' }
      } else if (m.tabel === 'notificaties') {
        const [n] = await tx.select().from(schema.notificaties).where(eq(schema.notificaties.id, m.recordId))
        if (!n) return { status: 'geweigerd', recordId: m.recordId, code: 404, reden: 'Melding onbekend' }
        if (!rolMag(gebruiker.rol, onderdeel, 'schrijven', { eigen: n.gebruikerId === gebruiker.id })) {
          return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Niet je eigen melding' }
        }
        if (m.versie !== undefined && m.versie !== huidigeVersie) {
          return { status: 'conflict', recordId: m.recordId, serverVersie: huidigeVersie, serverStand: { gelezenOp: n.gelezenOp, verborgenOp: n.verborgenOp } }
        }
        const set: Record<string, string | null> = {}
        for (const [k, v] of Object.entries(m.patch ?? {})) if (NOTIFICATIE_VELDEN.has(k)) set[k] = v === null ? null : String(v)
        if (Object.keys(set).length) {
          await tx.update(schema.notificaties).set(set).where(and(eq(schema.notificaties.id, m.recordId), eq(schema.notificaties.gebruikerId, gebruiker.id)))
        }
      } else {
        // persoonlijke_instellingen: één rij per gebruiker, id = gebruikers-id.
        if (!rolMag(gebruiker.rol, onderdeel, 'schrijven', { eigen: m.recordId === gebruiker.id })) {
          return { status: 'geweigerd', recordId: m.recordId, code: 403, reden: 'Alleen je eigen instellingen' }
        }
        const [p] = await tx.select().from(schema.persoonlijkeInstellingen).where(eq(schema.persoonlijkeInstellingen.id, m.recordId))
        if (m.versie !== undefined && m.versie !== huidigeVersie) {
          return { status: 'conflict', recordId: m.recordId, serverVersie: huidigeVersie, serverStand: p?.data ?? {} }
        }
        const data = pasPatchToe(p?.data ?? {}, m.patch ?? {})
        await tx.insert(schema.persoonlijkeInstellingen)
          .values({ id: m.recordId, organisationId: organisatie.id, data, updatedAt: new Date().toISOString() })
          .onConflictDoUpdate({ target: schema.persoonlijkeInstellingen.id, set: { data, updatedAt: new Date().toISOString() } })
      }

      const versie = huidigeVersie + 1
      await tx.insert(schema.serverRecords)
        .values({ key: sleutel, organisationId: orgId, version: versie, updatedAt: new Date().toISOString(), updatedBy: gebruiker.id })
        .onConflictDoUpdate({ target: schema.serverRecords.key, set: { version: versie, updatedAt: new Date().toISOString(), updatedBy: gebruiker.id } })
      resultaat = { status: 'ok', recordId: m.recordId, versie }
      await tx.insert(schema.mutaties).values({
        id: m.idempotentieSleutel, organisationId: orgId, userId: gebruiker.id, tabel: m.tabel, op: m.op ?? 'patch',
        recordId: m.recordId, resultaat, appliedAt: new Date().toISOString(),
      })
      return resultaat
    }))
  }
  return { resultaten }
})
