// PUT /api/settings/:key: alleen de beheerder; sleutels van de leverancier geven 403,
// onbekende sleutels 400. Elke wijziging is een auditregel.
import { and, eq } from 'drizzle-orm'
import { isSettingKey, isVerborgen } from '../../../shared/settingKeys'
import { rolMag } from '../../../shared/permissions'
import { KANALEN } from '../../../shared/nbStatus'
import { AGENT_INSTELLINGEN } from '../../../shared/mandaat'
import { BELMATRIX_RIJEN, klasseGrensFouten, valideerMatrix } from '../../../shared/ritmematrix'
import { overlap, valideerRegios, type Regio } from '../../../shared/gebieden'
import { schrijfAudit } from '../../utils/audit'
import { wijsRegiosToe } from '../../utils/bezoeken'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisOrganisatie } from '../../utils/sessie'
import { vergeetOrganisaties } from '../../utils/kortGeheugen'

export default defineEventHandler(async (event) => {
  // De organisatiecontext staat in het korte geheugen; na deze wijziging opnieuw lezen.
  event.node.res.once('finish', vergeetOrganisaties)
  const { gebruiker, organisatie } = await vereisOrganisatie(event)
  const key = getRouterParam(event, 'key') ?? ''
  if (isVerborgen(key)) throw createError({ statusCode: 403, statusMessage: 'Deze instelling beheert de leverancier' })
  if ((AGENT_INSTELLINGEN as readonly string[]).includes(key)) throw createError({ statusCode: 403, statusMessage: 'Mandaten en pauze zet je op de pagina Agents en mandaten' })
  if (!isSettingKey(key)) throw createError({ statusCode: 400, statusMessage: 'Onbekende instelling' })
  if (!rolMag(gebruiker.rol, 'instellingen', 'schrijven')) throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder wijzigt instellingen' })
  const { value } = await readBody<{ value: unknown }>(event)
  if (value === undefined) throw createError({ statusCode: 400, statusMessage: 'value ontbreekt' })
  if (key === 'belmatrix' || key === 'afspraakmatrix') {
    const fouten = valideerMatrix(value)
    if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
    // De belmatrix kent alleen prospects: een oude rij (zoals klant) bewaren we niet meer.
    if (key === 'belmatrix' && value && typeof value === 'object') for (const rij of Object.keys(value)) if (!(BELMATRIX_RIJEN as readonly string[]).includes(rij)) delete (value as Record<string, unknown>)[rij]
  }
  if (key === 'capaciteit') {
    const v = value as any
    if (!v || ![v.binnendienst, v.buitendienst].every((n) => Number.isInteger(n) && n >= 0 && n <= 200)) throw createError({ statusCode: 422, statusMessage: 'Geef per werkplek een aantal tussen 0 en 200' })
    if (v.startactiviteiten != null && !(Number.isInteger(v.startactiviteiten) && v.startactiviteiten >= 1 && v.startactiviteiten <= 200)) throw createError({ statusCode: 422, statusMessage: 'Het dagplafond voor startactiviteiten is 1 tot 200' })
  }
  if (key === 'klassen') {
    const v = value as any[]
    if (!Array.isArray(v) || v.some((k) => !k?.id || !String(k.naam ?? '').trim() || (k.code && String(k.code).length > 2))) throw createError({ statusCode: 422, statusMessage: 'Elke klasse heeft een naam en een code van hooguit 2 tekens' })
    // B02: grenzen per klasse (vanaf en tot, in medewerkers).
    const fouten = klasseGrensFouten(v)
    if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten.join('; ') })
  }
  if (key === 'afkoeling') {
    // Afkoelperiode per kanaal in dagen (7.2): elk kanaal een geheel getal van 0 tot 730.
    const v = value as Record<string, unknown>
    if (!v || typeof v !== 'object' || KANALEN.some((k) => !Number.isInteger(v[k]) || (v[k] as number) < 0 || (v[k] as number) > 730)) {
      throw createError({ statusCode: 422, statusMessage: 'Geef per kanaal een aantal dagen tussen 0 en 730' })
    }
  }

  if (key === 'spraak') {
    const v = value as any
    if (!v || typeof v !== 'object' || (v.bewaartermijnDagen != null && !(Number.isInteger(v.bewaartermijnDagen) && v.bewaartermijnDagen >= 1 && v.bewaartermijnDagen <= 365))) throw createError({ statusCode: 422, statusMessage: 'De bewaartermijn is 1 tot 365 dagen' })
  }
  if (key === 'meldingsregels') {
    const v = value as any
    const uur = (n: unknown) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 23
    if (!v || !(Number.isInteger(v.dagplafond) && v.dagplafond >= 0 && v.dagplafond <= 20) || !uur(v.stilVan) || !uur(v.stilTot)) throw createError({ statusCode: 422, statusMessage: 'Dagplafond 0 tot 20 en stille uren als heel uur' })
  }
  if (key === 'gebieden') {
    // P14: regio's controleren; overlap wordt bij invoer geblokkeerd (gat 45).
    const regios = (Array.isArray(value) ? value : []) as Regio[]
    const fouten = valideerRegios(regios)
    if (!Array.isArray(value) || fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0] ?? 'Geef een lijst met regio\'s' })
    const o = overlap(regios)
    if (o.length) throw createError({ statusCode: 409, statusMessage: o[0]!.tekst })
  }
  return metOrganisatie(organisatie.id, async (tx) => {
    const [oud] = await tx.select().from(schema.orgSettings).where(and(eq(schema.orgSettings.organisationId, organisatie.id), eq(schema.orgSettings.key, key)))
    await tx.insert(schema.orgSettings)
      .values({ organisationId: organisatie.id, key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value, updatedAt: new Date().toISOString() } })
    await schrijfAudit(tx, {
      organisationId: organisatie.id, actorId: gebruiker.id, action: 'instelling.wijzigen',
      resourceType: 'org_settings', resourceId: key, changes: { van: oud?.value ?? null, naar: value },
    })
    if (key === 'gebieden' || key === 'plaatsSynoniemen') await wijsRegiosToe(tx)
    return { key, value }
  })
})
