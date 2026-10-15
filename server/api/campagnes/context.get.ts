// GET /api/campagnes/context: wat de wizard nodig heeft. Soorten (acht startsoorten, alle soorten vanaf
// Expert), doelgroepen, fases, importbatches, leadrondes, branches, belscripts, verkopers en wat mag.
import { sql } from 'drizzle-orm'
import { kan } from '../../utils/accounts'
import { soorten } from '../../utils/campagnes'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'
import { leesStand } from '../../utils/vvProjectie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'campagnes.meedoen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = async (q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as any[]
    const alle = kan(ctx, 'campagnes.alleSoorten')
    const stand = await leesStand(tx)
    const reizen = await r(sql`select id, naam, data from reistemplates where status <> 'gearchiveerd' order by is_standaard desc, naam`)
    return {
      soorten: (await soorten(tx)).filter((s) => s.actief && (alle || s.startsoort)),
      doelgroepen: await r(sql`select id, naam from doelgroepen where status <> 'gearchiveerd' order by prioriteit, naam`),
      fases: reizen.flatMap((x) => (x.data?.fases ?? []).map((f: any) => ({ id: f.id, naam: `${x.naam}: ${f.label}` }))),
      importbatches: await r(sql`select id, bestandsnaam as naam from import_batches where status = 'verwerkt' order by created_at desc limit 20`),
      leadrondes: (await r(sql`select id, gestart_op, aantal from lead_rondes order by gestart_op desc limit 20`)).map((x) => ({ id: x.id, naam: `Leadronde ${new Date(x.gestart_op).toLocaleDateString('nl-NL')} (${x.aantal})` })),
      branches: (stand.branches ?? []).map((b: any) => ({ id: b.id, naam: b.naam })),
      belscripts: await r(sql`select id, naam from belscripts where status = 'actief' and not is_persoonlijk order by naam`),
      verkopers: await r(sql`select id, name as naam, werkplek from users where status = 'actief' and role in ('accountmanager', 'salesmanager') order by name`),
      kan: { maken: kan(ctx, 'campagnes.maken'), alleSoorten: alle, tussendoelen: kan(ctx, 'campagnes.tussendoelen'), dynamisch: kan(ctx, 'campagnes.dynamisch'), mailreeksB: kan(ctx, 'campagnes.mailreeksB'), boodschapAI: kan(ctx, 'campagnes.boodschapAI'), team: kan(ctx, 'campagnes.team') },
    }
  })
})
