// GET /api/belscripts: de scripts met statkaarten en resultaten. Wie beheert ziet alles
// (ook concepten en gearchiveerde); een gebruiker ziet de actieve scripts van zijn team en,
// vanaf Gevorderd, zijn eigen varianten ("Mijn scripts").
import { and, eq, or } from 'drizzle-orm'
import { DOEL_LABEL, conversieLabel, scriptVergelijking, zichtbareScripts } from '../../../shared/belscripts'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { gebruikt30, naarScript, scriptResultaten } from '../../utils/belscripts'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.kiezen')
  const beheer = kan(ctx, 'belscript.beheer')
  const variant = kan(ctx, 'belscript.variant')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = (await tx.select().from(schema.belscripts).where(or(eq(schema.belscripts.isPersoonlijk, false), and(eq(schema.belscripts.isPersoonlijk, true), eq(schema.belscripts.gebruikerId, ctx.gebruiker.id))))).map(naarScript)
    const g = { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, teamId: ctx.gebruiker.teamId }
    const zicht = beheer ? rijen.filter((s) => !s.isPersoonlijk) : (zichtbareScripts(rijen, g) as typeof rijen)
    const eigen = variant ? rijen.filter((s) => s.isPersoonlijk && s.gebruikerId === ctx.gebruiker.id) : []
    const res = await scriptResultaten(tx)
    const gebruikt = await gebruikt30(tx)
    const resVan = (s: { id: string; versie: number }) => res.find((r) => r.scriptId === s.id && r.versie === s.versie)
    const metRes = (s: ReturnType<typeof naarScript>) => {
      const basis = s.basisScriptId ? rijen.find((x) => x.id === s.basisScriptId) : undefined
      return { ...s, doelLabel: DOEL_LABEL[s.doel], gesprekken30: gebruikt.get(s.id) ?? 0, resultaat: resVan(s) ?? null, conversie: variant || beheer ? conversieLabel(resVan(s)) : null,
        origineelGewijzigd: !!basis && ((s.data as any).basisVersie ?? 0) < basis.versie }
    }
    const lijst = [...new Map([...zicht, ...eigen].map((s) => [s.id, s])).values()].map(metRes)
    const beste = [...lijst].filter((s) => s.resultaat && s.resultaat.gesprekken >= 30).sort((a, b) => b.resultaat!.afspraken / b.resultaat!.gesprekken - a.resultaat!.afspraken / a.resultaat!.gesprekken)[0]
    return {
      scripts: lijst.filter((s) => !s.isPersoonlijk), mijn: lijst.filter((s) => s.isPersoonlijk),
      tellers: { actief: lijst.filter((s) => s.status === 'actief' && !s.isPersoonlijk).length, concept: lijst.filter((s) => s.status === 'concept').length, gebruikt30: [...gebruikt.values()].reduce((a, b) => a + b, 0), beste: beste ? { naam: beste.naam, conversie: conversieLabel(beste.resultaat) } : null },
      vergelijking: kan(ctx, 'belscript.vergelijken') ? scriptVergelijking(res.filter((r) => lijst.some((s) => s.id === r.scriptId))) : null,
      teams: beheer ? await tx.select({ id: schema.teams.id, naam: schema.teams.naam }).from(schema.teams) : [],
      kan: { beheer, variant, vergelijken: kan(ctx, 'belscript.vergelijken'), ai: kan(ctx, 'belscript.ai') },
    }
  })
})
