// GET /api/ritme: alles voor /instellingen/ritme (F16). Iedereen kan meekijken; de
// beheerder wijzigt (via PUT /api/settings/:key). Gevorderd ziet "Wat betekent dit voor mij".
import { eq, sql } from 'drizzle-orm'
import { AFKOELING_STANDAARD, KANAAL_LABEL, KANALEN } from '../../shared/nbStatus'
import { pastInDoelgroep } from '../../shared/reis'
import {
  AFSPRAAKMATRIX_STANDAARD, BELMATRIX_STANDAARD, CAPACITEIT_STANDAARD, FREQUENTIEPLAFOND_STANDAARD, KLASSEN_STANDAARD,
  geldendeCel, jaartotaal, klasseCode, leesMatrix, ritmeLabel, type Klasse,
} from '../../shared/ritmematrix'
import { kan } from '../utils/accounts'
import { metOrganisatie, schema } from '../utils/db'
import { alsDoelgroepAccount } from '../utils/reis'
import { vereisOrganisatie } from '../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const instellingen = new Map((await tx.select().from(schema.orgSettings)).map((r) => [r.key, r.value]))
    const klassen = ((instellingen.get('klassen') as Klasse[]) ?? []).map((k) => ({ ...k, code: klasseCode(k) ?? undefined }))
    // Alleen de kolommen die hier nodig zijn; de doelgroepvelden (met een klein deel van data) alleen als er segmenten zijn (B09).
    const a = schema.accounts
    const accounts = await tx.select({ id: a.id, klasse: a.klasse, accountKind: a.accountKind, ownerId: a.ownerId }).from(a)
    const segmentDefs = (instellingen.get('segmenten') as any[]) ?? []
    const doelgroepRijen = segmentDefs.length
      ? await tx.select({ klasse: a.klasse, postcode: a.postcode, gebiedId: a.gebiedId, nbBron: a.nbBron, vvBrancheId: a.vvBrancheId, data: sql<any>`jsonb_build_object('customFields', ${a.data}->'customFields', 'medewerkers', ${a.data}->'medewerkers', 'sbi', ${a.data}->'sbi', 'tags', ${a.data}->'tags')` }).from(a)
      : []
    const bel = leesMatrix(instellingen.get('belmatrix'), {})
    const afspraak = leesMatrix(instellingen.get('afspraakmatrix'), {})
    const codes = [...new Set([...klassen.map((k) => k.code!), ...KLASSEN_STANDAARD.map((k) => k.code!)])].sort()
    const doelgroepAccounts = doelgroepRijen.map((r) => alsDoelgroepAccount(r))
    const segmenten = segmentDefs.map((s) => ({ ...s, leden: doelgroepAccounts.filter((d) => pastInDoelgroep(d, { data: { eigenVeldFilters: s.filters ?? [] } })).length }))
    const reizen = await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, data: schema.reistemplates.data }).from(schema.reistemplates)
    // Wat betekent dit voor mij: verwachte belmomenten en bezoeken deze week voor je eigen accounts.
    const eigen = accounts.filter((x) => x.ownerId === ctx.gebruiker.id)
    const codeVan = (id: string | null) => klasseCode(klassen.find((k) => k.id === id) ?? null)
    let bellen = 0
    let bezoeken = 0
    for (const x of eigen) {
      const type = x.accountKind as 'prospect' | 'klant'
      bellen += (jaartotaal(geldendeCel(bel.matrix, type, codeVan(x.klasse), BELMATRIX_STANDAARD)) ?? 0) / 52
      bezoeken += (jaartotaal(geldendeCel(afspraak.matrix, 'bezoek', codeVan(x.klasse), AFSPRAAKMATRIX_STANDAARD)) ?? 0) / 52
    }
    const cap = (instellingen.get('capaciteit') as typeof CAPACITEIT_STANDAARD) ?? CAPACITEIT_STANDAARD
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
      belmatrix: Object.fromEntries(['prospect', 'klant'].map((rij) => [rij, Object.fromEntries(codes.map((c) => [c, cel(bel.matrix, BELMATRIX_STANDAARD, rij, c)]))])),
      afspraakmatrix: Object.fromEntries(['meeting', 'bezoek'].map((rij) => [rij, Object.fromEntries(codes.map((c) => [c, cel(afspraak.matrix, AFSPRAAKMATRIX_STANDAARD, rij, c)]))])),
      afkoeling: KANALEN.map((k) => ({ id: k, label: KANAAL_LABEL[k], dagen: ((instellingen.get('afkoeling') as any) ?? AFKOELING_STANDAARD)[k] ?? AFKOELING_STANDAARD[k] })),
      frequentieplafond: (instellingen.get('frequentieplafond') as typeof FREQUENTIEPLAFOND_STANDAARD) ?? FREQUENTIEPLAFOND_STANDAARD,
      capaciteit: cap,
      segmenten,
      reizen: reizen.map((r) => ({ id: r.id, naam: r.naam, eigenRitme: !!r.data.overschrijvingen && Object.keys(r.data.overschrijvingen).length > 0 })),
      voorMij: kan(ctx, 'regels.lezen') || ctx.gebruiker.niveau !== 'beginner'
        ? { bellen: Math.round(bellen), bezoeken: Math.round(bezoeken), capaciteit: mij?.werkplek === 'buitendienst' ? cap.buitendienst * 2 : cap.binnendienst * 5, werkplek: mij?.werkplek ?? 'binnendienst', accounts: eigen.length }
        : null,
      waarschuwingen: [...bel.waarschuwingen, ...afspraak.waarschuwingen],
      kan: { beheer: kan(ctx, 'matrix.beheer'), voorstellen: kan(ctx, 'matrix.voorstellen') },
    }
  })
})
