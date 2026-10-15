// GET /api/doelgroepen: doelgroepen met aantal accounts en hun reis (lezen: iedereen).
import { sql } from 'drizzle-orm'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.lijst')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = await tx.select().from(schema.doelgroepen).orderBy(schema.doelgroepen.prioriteit, schema.doelgroepen.naam)
    const tellingen = (await tx.execute(sql`select doelgroep_id, count(*)::int as n from accounts where doelgroep_id is not null group by doelgroep_id`)).rows as { doelgroep_id: string; n: number }[]
    const reizen = await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, doelgroepId: schema.reistemplates.doelgroepId, isStandaard: schema.reistemplates.isStandaard }).from(schema.reistemplates)
    const standaard = reizen.find((r) => r.isStandaard)
    const [vv] = await tx.select().from(schema.orgSettings).where(sql`${schema.orgSettings.key} = 'verkoopverhaal'`)
    return {
      doelgroepen: rijen.map((d) => {
        const reis = reizen.find((r) => r.doelgroepId === d.id) ?? standaard
        return { id: d.id, naam: d.naam, status: d.status, prioriteit: d.prioriteit, versie: d.versie, data: d.data, aantal: tellingen.find((t) => t.doelgroep_id === d.id)?.n ?? 0, reis: reis ? { id: reis.id, naam: reis.naam } : null }
      }),
      branches: ((vv?.value as any)?.branches ?? []) as { id: string; naam: string; focus: string }[],
      ambitie: ((vv?.value as any)?.ambitie ?? null) as string | null,
      klassen: (((await tx.select().from(schema.orgSettings).where(sql`${schema.orgSettings.key} = 'klassen'`))[0]?.value as any[]) ?? []).filter((k) => k.tabblad !== 'Klanten'),
    }
  })
})
