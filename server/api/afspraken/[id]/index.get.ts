// GET /api/afspraken/:id: de afspraak met klant in context, wie erbij zit (buying committee), doel en
// agenda van de soort, uitkomsten, verslag en de actiebalk voor de telefoon.
import { sql } from 'drizzle-orm'
import { telLink } from '../../../../shared/dag'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'agenda.basis')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [ap] = (await tx.execute(sql`select ap.*, m.naam as soort_naam, m.slug, m.type, m.data as soort_data, a.name as account_naam, a.city, a.data as account_data, a.fase_id, a.nb_status, u.name as owner_naam, g.name as gepland_door_naam
      from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id join users u on u.id = ap.owner_id left join users g on g.id = ap.gepland_door where ap.id = ${id}`)).rows as any[]
    if (!ap) throw createError({ statusCode: 404, statusMessage: 'Afspraak niet gevonden' })
    const contacten = ap.account_id ? (await tx.execute(sql`select id, first_name, last_name, rol, email, data from contacts where account_id = ${ap.account_id} and status <> 'vertrokken' order by (rol = 'beslisser') desc, last_name`)).rows as any[] : []
    const hoofd = contacten.find((c) => c.id === ap.contact_id) ?? contacten[0]
    const adres = [ap.account_data?.adres, ap.city].filter(Boolean).join(', ')
    return {
      id: ap.id, status: ap.status, vorm: ap.vorm, start: new Date(ap.start_at).toISOString(), eind: new Date(ap.end_at).toISOString(), uitkomst: ap.uitkomst_code,
      eigenaar: { id: ap.owner_id, naam: ap.owner_naam }, geplandDoor: ap.gepland_door !== ap.owner_id ? ap.gepland_door_naam : null,
      soort: { naam: ap.soort_naam, slug: ap.slug, type: ap.type, doel: ap.soort_data?.doel, agenda: ap.data?.agenda ?? ap.soort_data?.agenda ?? [], voorbereiding: ap.soort_data?.voorbereiding ?? [], uitkomsten: ap.soort_data?.uitkomsten ?? [] },
      account: ap.account_id ? { id: ap.account_id, naam: ap.account_naam, plaats: ap.city, fase: ap.fase_id, status: ap.nb_status } : null,
      wieZitErbij: contacten.map((c) => ({ id: c.id, naam: [c.first_name, c.last_name].filter(Boolean).join(' '), rol: c.rol, functie: c.data?.functie ?? null })),
      locatie: ap.data?.locatie ?? null, meetinglink: ap.data?.meetinglink ?? null, aanleiding: ap.data?.aanleiding ?? null, briefing: ap.data?.briefing ?? null, verslag: ap.data?.verslag ?? null, taskId: ap.task_id,
      actiebalk: {
        bellen: telLink({ mobiel: hoofd?.data?.mobiel, telefoon: hoofd?.data?.telefoon ?? ap.account_data?.telefoon }), mail: hoofd?.email ? `mailto:${hoofd.email}` : null,
        whatsapp: hoofd?.data?.mobiel ? `https://wa.me/${String(telLink({ mobiel: hoofd.data.mobiel })).replace('tel:+', '')}` : null,
        navigeer: adres ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adres)}` : null,
      },
      afgelopen: Date.parse(new Date(ap.end_at).toISOString()) <= Date.now(),
    }
  })
})
