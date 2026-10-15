// POST /api/kvk/zoek {naam, plaats, postcode, sbi, kvk}: zoeken in het handelsregister, met per
// resultaat "Al in je bestand". Voor iedereen die een prospect mag toevoegen ("Zoek in KvK"
// in de flyout) en op de telefoon (KvK opzoeken). 503 zonder verbinding met KvK.
import { zoekDuplicaat } from '../../../shared/ontdubbelen'
import { KVK_NIET_GEKOPPELD } from '../../../shared/leadGenerator'
import { metOrganisatie, schema } from '../../utils/db'
import { kvkContext, kvkZoek, KvkFout } from '../../utils/bronnen/kvk'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const b = await readBody<{ naam?: string; plaats?: string; postcode?: string; sbi?: string[]; kvk?: string }>(event)
  const vraag = { naam: b?.naam?.trim().slice(0, 100) || undefined, plaats: b?.plaats?.trim().slice(0, 60) || undefined, postcode: b?.postcode?.trim().slice(0, 7) || undefined, kvk: b?.kvk?.replace(/\D/g, '').slice(0, 8) || undefined, sbi: Array.isArray(b?.sbi) ? b!.sbi.map(String).slice(0, 3) : undefined }
  if (!vraag.naam && !vraag.kvk && !vraag.postcode && !vraag.sbi?.length) throw createError({ statusCode: 422, statusMessage: 'Typ een naam, KvK-nummer of postcode' })
  if (vraag.naam && vraag.naam.length < 2) throw createError({ statusCode: 422, statusMessage: 'Typ minstens twee letters' })
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const k = await kvkContext(tx, ctx.organisatie!.pakket)
    if (!k) throw createError({ statusCode: 400, statusMessage: KVK_NIET_GEKOPPELD })
    try {
      const r = await kvkZoek(tx, ctx.organisatie!.id, k, vraag)
      const bestand = await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, postcode: schema.accounts.postcode, accountKind: schema.accounts.accountKind }).from(schema.accounts)
      return {
        resultaten: r.map((x) => {
          const d = zoekDuplicaat({ name: x.naam, kvk: x.kvk, postcode: x.postcode }, bestand)
          return { ...x, alBekend: d.soort === 'zeker' ? { accountId: d.match!.id, naam: d.match!.name, soort: d.match!.accountKind } : null }
        }),
      }
    } catch (e) {
      if (e instanceof KvkFout) throw createError({ statusCode: e.statusCode, statusMessage: e.message })
      throw e
    }
  })
})
