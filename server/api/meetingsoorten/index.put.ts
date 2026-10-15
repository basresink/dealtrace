// PUT /api/meetingsoorten {id?, slug?, naam, type, duurMin, vorm, data, actief?}: een meetingsoort maken of
// wijzigen (beheerder). 400 bij een uitkomst zonder gevolg. Geen offertebespreking (B17).
import { sql } from 'drizzle-orm'
import { schrijfAudit } from '../../utils/audit'
import { metOrganisatie } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const GEVOLGEN = ['gehouden', 'later', 'contactpersoon', 'nee', 'afspraak', 'geen']
export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'instellingen.meetingsoorten')
  const b = await readBody<any>(event)
  const naam = String(b?.naam ?? '').trim()
  if (naam.length < 2) throw createError({ statusCode: 422, statusMessage: 'Geef de meetingsoort een naam' })
  if (/offerte|onderhandel/i.test(naam)) throw createError({ statusCode: 422, statusMessage: 'Offertes en onderhandelingen horen in DealDrive of het CRM' })
  const type = b?.type === 'intern' ? 'intern' : 'klant'
  const vorm = ['bezoek', 'online', 'telefoon'].includes(b?.vorm) ? b.vorm : 'online'
  const duur = Math.max(5, Math.min(480, Math.round(Number(b?.duurMin) || 30)))
  const uitkomsten = Array.isArray(b?.data?.uitkomsten) ? b.data.uitkomsten : []
  for (const u of uitkomsten) if (!u?.code || !u?.label || !GEVOLGEN.includes(u?.gevolg?.type)) throw createError({ statusCode: 400, statusMessage: `Uitkomst "${u?.label ?? u?.code ?? ''}" heeft geen gevolg` })
  const data = { doel: String(b?.data?.doel ?? ''), standaardLocatie: b?.data?.standaardLocatie ?? null, agenda: (b?.data?.agenda ?? []).map((p: any) => ({ punt: String(p.punt), verplicht: !!p.verplicht })), voorbereiding: (b?.data?.voorbereiding ?? []).map(String), uitkomsten, eersteAfspraak: !!b?.data?.eersteAfspraak, herinneringMin: Math.max(0, Number(b?.data?.herinneringMin) || 15), kleur: String(b?.data?.kleur ?? 'grijs') }
  const slug = String(b?.slug ?? naam).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [r] = (b?.id
      ? await tx.execute(sql`update meetingsoorten set naam = ${naam}, type = ${type}, duur_min = ${duur}, vorm = ${vorm}, data = ${JSON.stringify(data)}::jsonb, actief = ${b?.actief !== false}, versie = versie + 1 where id = ${b.id} returning id`)
      : await tx.execute(sql`insert into meetingsoorten (organisation_id, slug, naam, type, duur_min, vorm, data) values (${ctx.organisatie.id}, ${slug}, ${naam}, ${type}, ${duur}, ${vorm}, ${JSON.stringify(data)}::jsonb) returning id`)).rows as any[]
    if (!r) throw createError({ statusCode: 404, statusMessage: 'Meetingsoort niet gevonden' })
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'meetingsoort.bewaren', resourceType: 'meetingsoorten', resourceId: r.id, changes: { naam, type, duur, vorm } })
    return { id: r.id }
  })
})
