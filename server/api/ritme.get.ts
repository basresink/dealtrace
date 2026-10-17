// GET /api/ritme: alles voor /instellingen/ritme (F16). Iedereen kan meekijken; de
// beheerder wijzigt (via PUT /api/settings/:key). Gevorderd ziet "Wat betekent dit voor mij".
import { eq, sql } from 'drizzle-orm'
import { AFKOELING_STANDAARD, KANAAL_LABEL, KANALEN } from '../../shared/nbStatus'
import { pastInDoelgroep } from '../../shared/reis'
import {
  AFSPRAAKMATRIX_STANDAARD, BELMATRIX_RIJEN, BELMATRIX_STANDAARD, CAPACITEIT_STANDAARD, KLANT_TABBLAD, FREQUENTIEPLAFOND_STANDAARD, KLASSEN_STANDAARD, STARTPLAFOND_STANDAARD,
  klasseCode, klasseGrenzen, leesMatrix, ritmeLabel, verwachtingVoorMij, type Klasse,
} from '../../shared/ritmematrix'
import { kan } from '../utils/accounts'
import { metOrganisatie, schema } from '../utils/db'
import { alsDoelgroepAccount } from '../utils/reis'
import { vereisOrganisatie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const instellingen = new Map((await tx.select().from(schema.orgSettings)).map((r) => [r.key, r.value]))
    // B02: elke klasse met zijn grenzen (vanaf en tot, in medewerkers); zonder eigen grenzen de standaard voor die code.
    const klassen = ((instellingen.get('klassen') as Klasse[]) ?? []).map((k) => {
      const g = klasseGrenzen(k)
      return { ...k, code: klasseCode(k) ?? undefined, standaardGrenzen: k.minMedewerkers == null ? g : null }
    })
    // Alleen de kolommen die hier nodig zijn; de doelgroepvelden (met een klein deel van data) alleen als er segmenten zijn (B09).
    const a = schema.accounts
    const accounts = await tx.select({ id: a.id, klasse: a.klasse, accountKind: a.accountKind, ownerId: a.ownerId, nbStatus: a.nbStatus }).from(a)
    const segmentDefs = (instellingen.get('segmenten') as any[]) ?? []
    const doelgroepRijen = segmentDefs.length
      ? await tx.select({ klasse: a.klasse, postcode: a.postcode, gebiedId: a.gebiedId, nbBron: a.nbBron, vvBrancheId: a.vvBrancheId, data: sql<any>`jsonb_build_object('customFields', ${a.data}->'customFields', 'medewerkers', ${a.data}->'medewerkers', 'sbi', ${a.data}->'sbi', 'tags', ${a.data}->'tags')` }).from(a)
      : []
    const bel = leesMatrix(instellingen.get('belmatrix'), {})
    const afspraak = leesMatrix(instellingen.get('afspraakmatrix'), {})
    // Alleen de klassen die de organisatie heeft; zonder eigen klassen de standaard (A tot D). Klassen op het
    // tabblad Klanten (uit DealDrive of het CRM) horen niet bij de accountmatrix: geen ritme voor klanten.
    const prospectKlassen = klassen.filter((k) => k.tabblad !== KLANT_TABBLAD)
    const codes = [...new Set((prospectKlassen.length ? prospectKlassen : KLASSEN_STANDAARD).map((k) => k.code!).filter(Boolean))].sort()
    const doelgroepAccounts = doelgroepRijen.map((r) => alsDoelgroepAccount(r))
    const segmenten = segmentDefs.map((s) => ({ ...s, leden: doelgroepAccounts.filter((d) => pastInDoelgroep(d, { data: { eigenVeldFilters: s.filters ?? [] } })).length }))
    const reizen = await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, data: schema.reistemplates.data }).from(schema.reistemplates)
    // Wat betekent dit voor mij: verwachte belmomenten en bezoeken deze week, met dezelfde afbakening als
    // de ritmeregels (B07): alleen eigen prospects in reis, geen nee, overgedragen of klanten.
    const eigen = accounts.filter((a) => a.ownerId === ctx.gebruiker.id)
    const codeVan = (id: string | null) => klasseCode(klassen.find((k) => k.id === id) ?? null)
    const verwachting = verwachtingVoorMij(eigen.map((a) => ({ type: a.accountKind as 'prospect' | 'klant', nbStatus: a.nbStatus, klasseCode: codeVan(a.klasse) })), bel.matrix, afspraak.matrix)
    const cap = { ...CAPACITEIT_STANDAARD, startactiviteiten: STARTPLAFOND_STANDAARD, ...((instellingen.get('capaciteit') as object | undefined) ?? {}) } as typeof CAPACITEIT_STANDAARD & { startactiviteiten: number }
    const [mij] = await tx.select({ werkplek: schema.users.werkplek }).from(schema.users).where(eq(schema.users.id, ctx.gebruiker.id))
    const cel = (m: typeof bel.matrix, standaard: typeof BELMATRIX_STANDAARD, rij: string, code: string) => {
      const eigen = m[rij]?.[code]
      const waarde = eigen === undefined ? null : eigen
      return { waarde, standaard: standaard[rij]?.[code] ?? null, label: waarde && waarde.aantal !== null ? ritmeLabel(waarde) : `niet ingesteld (standaard ${ritmeLabel(standaard[rij]?.[code])})` }
    }
    return {
      klassen: klassen.map((k) => ({ ...k, aantal: accounts.filter((x) => x.klasse === k.id).length })),
      zonderKlasse: accounts.filter((x) => x.accountKind === 'prospect' && !x.klasse).length,
      codes,
      belmatrix: Object.fromEntries(BELMATRIX_RIJEN.map((rij) => [rij, Object.fromEntries(codes.map((c) => [c, cel(bel.matrix, BELMATRIX_STANDAARD, rij, c)]))])),
      afspraakmatrix: Object.fromEntries(['meeting', 'bezoek'].map((rij) => [rij, Object.fromEntries(codes.map((c) => [c, cel(afspraak.matrix, AFSPRAAKMATRIX_STANDAARD, rij, c)]))])),
      afkoeling: KANALEN.map((k) => ({ id: k, label: KANAAL_LABEL[k], dagen: ((instellingen.get('afkoeling') as any) ?? AFKOELING_STANDAARD)[k] ?? AFKOELING_STANDAARD[k] })),
      frequentieplafond: (instellingen.get('frequentieplafond') as typeof FREQUENTIEPLAFOND_STANDAARD) ?? FREQUENTIEPLAFOND_STANDAARD,
      capaciteit: cap,
      segmenten,
      reizen: reizen.map((r) => ({ id: r.id, naam: r.naam, eigenRitme: !!r.data.overschrijvingen && Object.keys(r.data.overschrijvingen).length > 0 })),
      voorMij: kan(ctx, 'regels.lezen') || ctx.gebruiker.niveau !== 'beginner'
        ? { bellen: Math.round(verwachting.bellen), bezoeken: Math.round(verwachting.bezoeken), capaciteit: mij?.werkplek === 'buitendienst' ? cap.buitendienst * 2 : cap.binnendienst * 5, werkplek: mij?.werkplek ?? 'binnendienst', accounts: verwachting.accounts }
        : null,
      waarschuwingen: [...bel.waarschuwingen, ...afspraak.waarschuwingen],
      kan: { beheer: kan(ctx, 'matrix.beheer'), voorstellen: kan(ctx, 'matrix.voorstellen') },
    }
  })
})
