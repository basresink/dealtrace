// GET /api/afspraken/:id: de afspraak met klant in context, wie erbij zit (buying committee), doel en
// agenda van de soort, uitkomsten, verslag en de actiebalk voor de telefoon. Daarnaast titel en
// beschrijving, het gekoppelde contact, het transcript (geplakt of geüpload), de analyse van de
// Notulist, de reeks en de uitgenodigde collega's.
import { sql } from 'drizzle-orm'
import { telLink } from '../../../../shared/dag'
import { afspraakTitel } from '../../../../shared/agenda'
import { telWoorden } from '../../../../shared/transcript'
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
    const gekoppeld = ap.contact_id ? ((await tx.execute(sql`select id, first_name, last_name, rol, email, data from contacts where id = ${ap.contact_id}`)).rows as any[])[0] : null
    const [tr] = (await tx.execute(sql`select id, tekst, dienst, op from transcripten where record_soort = 'appointments' and record_id = ${id} and bijlage_id is null order by op desc limit 1`)).rows as any[]
    const uitgenodigd = (ap.data?.uitgenodigd ?? []) as string[]
    const collegas = uitgenodigd.length ? (await tx.execute(sql`select id, name from users where id = any(string_to_array(${uitgenodigd.join(',')}, ','))`)).rows as any[] : []
    const reeks = ap.data?.reeksId ? Number(((await tx.execute(sql`select count(*)::int as n from appointments where data->>'reeksId' = ${ap.data.reeksId}`)).rows as any[])[0]?.n ?? 1) : 1
    const n = ap.data?.notulist
    const adres = [ap.account_data?.adres, ap.city].filter(Boolean).join(', ')
    return {
      id: ap.id, status: ap.status, vorm: ap.vorm, start: new Date(ap.start_at).toISOString(), eind: new Date(ap.end_at).toISOString(), uitkomst: ap.uitkomst_code,
      eigenaar: { id: ap.owner_id, naam: ap.owner_naam }, geplandDoor: ap.gepland_door !== ap.owner_id ? ap.gepland_door_naam : null,
      soort: { id: ap.meetingsoort_id, naam: ap.soort_naam, slug: ap.slug, type: ap.type, kleur: ap.soort_data?.kleur ?? null, doel: ap.soort_data?.doel, agenda: ap.data?.agenda ?? ap.soort_data?.agenda ?? [], voorbereiding: ap.soort_data?.voorbereiding ?? [], uitkomsten: ap.soort_data?.uitkomsten ?? [] },
      titel: afspraakTitel(ap.data?.titel, ap.soort_naam, ap.account_naam), eigenTitel: !!ap.data?.titel, beschrijving: ap.data?.beschrijving ?? null,
      contact: gekoppeld ? { id: gekoppeld.id, naam: [gekoppeld.first_name, gekoppeld.last_name].filter(Boolean).join(' '), rol: gekoppeld.rol, functie: gekoppeld.data?.functie ?? null } : null,
      transcript: tr ? { id: tr.id, tekst: tr.tekst, bestandsnaam: ap.data?.transcriptBestand ?? null, bron: tr.dienst, op: new Date(tr.op).toISOString(), woorden: telWoorden(tr.tekst) } : null,
      analyse: n ? { samenvatting: n.samenvatting || (n.perAgendapunt ?? []).map((p: any) => p.samenvatting).filter((t: string) => t && t !== 'Niet besproken.').join(' ') || null, perAgendapunt: n.perAgendapunt ?? [], actiepunten: n.actiepunten ?? [], koopsignalen: n.koopsignalen ?? [], bezwaren: n.bezwaren ?? [], openVragen: n.openVragen ?? [], concurrenten: n.concurrenten ?? [], voorgesteldeUitkomst: n.voorgesteldeUitkomst ?? null, op: n.op ?? null, basis: n.basis ?? null } : null,
      herhaling: { reeksId: ap.data?.reeksId ?? null, aantal: reeks, soort: ap.data?.herhaling ?? 'geen' },
      uitgenodigd: collegas.map((u) => ({ id: u.id, naam: String(u.name).replace(/^Testgebruiker /, '') })),
      herinneringMin: ap.data?.herinnering ?? null,
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
