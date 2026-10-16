// GET /api/instellingen/kanalen (beheerder): per kanaal de afkoelperiode en aan of uit, het frequentieplafond,
// de mailvoorwaarden (SPF, DKIM, DMARC, afmeldlink, onderdrukkingslijst), WhatsApp (koppeling, sjablonen,
// opt-in-tekst) en de bel-me-niet-lijst (aantal). Geheimen gaan nooit mee.
import { sql } from 'drizzle-orm'
import { KANALEN } from '../../../../shared/nbStatus'
import { kanaalInstelling } from '../../../../shared/kanalen'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'
import { OPT_IN_STANDAARD, sjablonen, waKoppeling } from '../../../utils/whatsapp'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.kanalen')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const r = async (q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as any[]
    const [s] = await r(sql`select (select value from org_settings where key = 'afkoeling') as afk, (select value from org_settings where key = 'frequentieplafond') as fp, (select value from org_settings where key = 'kanalenUit') as uit`)
    const ki = kanaalInstelling(s?.afk, s?.fp)
    const uit: string[] = Array.isArray(s?.uit) ? s.uit : []
    const [mail] = await r(sql`select status, instellingen, getest_op from koppelingen where soort = 'mail'`)
    const [tel] = await r(sql`select (select count(*)::int from onderdrukkingslijst) as onderdrukt, (select count(*)::int from bel_me_niet) as belmeniet`)
    const wa = await waKoppeling(tx)
    return {
      kanalen: KANALEN.map((k) => ({ kanaal: k, afkoeling: ki.afkoeling[k], aan: !uit.includes(k) })),
      frequentieplafond: ki.frequentieplafond,
      mail: { status: mail?.status ?? 'uit', modus: mail?.instellingen?.modus ?? null, van: mail?.instellingen?.van ?? null, domein: mail?.instellingen?.domein ?? null, controle: mail?.instellingen?.controle ?? null, getestOp: mail?.getest_op ?? null, afmeldlink: true, onderdrukt: tel?.onderdrukt ?? 0 },
      whatsapp: { status: wa?.status ?? 'uit', modus: wa?.modus ?? null, optInTekst: wa?.optInTekst ?? OPT_IN_STANDAARD, getestOp: wa?.getestOp ?? null, webhookGeheim: !!wa?.webhookGeheim, sjablonen: await sjablonen(tx) },
      belMeNiet: tel?.belmeniet ?? 0,
    }
  })
})
