// PUT /api/koppelingen/mail {instellingen, wachtwoord?} of {uit: true}: opslaan kan alleen na een geslaagde
// test (de test draait hier opnieuw). Het wachtwoord wordt versleuteld (AES-256-GCM, eigen doel mail).
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../../utils/audit'
import { metOrganisatie } from '../../../utils/db'
import { ontsleutel, versleutel } from '../../../utils/geheimen'
import { testMail } from '../../../utils/mail'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'koppeling.mail')
  const b = await readBody<any>(event)
  const org = ctx.organisatie.id
  if (b?.uit) {
    await metOrganisatie(org, async (tx) => {
      await tx.execute(sql`update koppelingen set status = 'uit', updated_at = now() where soort = 'mail'`)
      await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'koppeling.mail.uit', resourceType: 'koppelingen', resourceId: 'mail', changes: {} })
    })
    return { status: 'uit' }
  }
  const i = { modus: b?.instellingen?.modus === 'mock' ? 'mock' : 'smtp', host: String(b?.instellingen?.host ?? ''), poort: Number(b?.instellingen?.poort) || 587, gebruiker: String(b?.instellingen?.gebruiker ?? ''), van: String(b?.instellingen?.van ?? ''), naam: b?.instellingen?.naam ?? null, domein: b?.instellingen?.domein ?? null, dkimSelector: b?.instellingen?.dkimSelector ?? 'default' } as any
  const oud = await metOrganisatie(org, async (tx) => ((await tx.execute(sql`select geheimen from koppelingen where soort = 'mail'`)).rows as any[])[0]?.geheimen ?? null)
  const wachtwoord = b?.wachtwoord || ontsleutel(oud, 'mail')?.wachtwoord || null
  const t = await testMail(i, wachtwoord)
  if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.tekst })
  return metOrganisatie(org, async (tx) => {
    await tx.execute(sql`insert into koppelingen (organisation_id, soort, status, geheimen, instellingen, getest_op) values (${org}, 'mail', 'actief', ${wachtwoord ? versleutel({ wachtwoord }, 'mail') : null}, ${JSON.stringify(i)}::jsonb, now())
      on conflict (organisation_id, soort) do update set status = 'actief', geheimen = excluded.geheimen, instellingen = excluded.instellingen, getest_op = now(), updated_at = now()`)
    await schrijfAudit(tx, { organisationId: org, actorId: ctx.gebruiker.id, action: 'koppeling.mail.opslaan', resourceType: 'koppelingen', resourceId: 'mail', changes: { modus: i.modus, host: i.host, van: i.van } })
    return { status: 'actief', tekst: t.tekst }
  })
})
