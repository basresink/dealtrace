// GET /api/accounts/:id/tabbladen: wat de tabbladen van de accountkaart tonen (opzet uit DealDrive):
// taken, inzichten, afspraken, e-mails, gespreksverslagen, deals (overdracht en stand in DealDrive),
// campagnes en documenten. Eén ronde naar de database per soort, geen query per rij.
import { sql } from 'drizzle-orm'
import { isAchterstallig } from '../../../../shared/taken'
import { metOrganisatie } from '../../../utils/db'
import { vereisFunctie } from '../../../utils/sessie'

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
const kaal = (n: unknown) => String(n ?? '').replace(/^Testgebruiker /, '')
const doelTekst = (d: any) => (!d ? null : d.type === 'procent' ? `doel: ${d.waarde}% conversie naar afspraak` : d.type === 'afspraken' ? `doel: ${d.waarde} ${d.waarde === 1 ? 'afspraak' : 'afspraken'}` : `doel: ${d.waarde} ${d.type}`)
const woorden = (t: unknown) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const nu = new Date()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const rijen = async (q: any) => (await tx.execute(q)).rows as any[]
    const [acc] = await rijen(sql`select id, name, data from accounts where id = ${id}`)
    if (!acc) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const ids = [id, ...((acc.data?.samengevoegdUit as string[] | undefined) ?? [])]
    const idLijst = sql.join(ids.map((x) => sql`${x}`), sql`, `)

    const taken = (await rijen(sql`select t.*, u.name as eigenaar from tasks t left join users u on u.id = t.owner_id
      where t.account_id in (${idLijst}) and (t.status in ('open', 'bezig') or t.updated_at > now() - interval '180 days') order by coalesce(t.due_date, t.created_at) desc limit 200`)).map((t) => {
      const open = ['open', 'bezig'].includes(t.status)
      return {
        id: t.id, title: t.title, actionType: t.action_type, priority: t.priority, status: t.status, dueDate: iso(t.due_date), uitkomst: t.uitkomst, afgerondOp: open ? null : iso(t.updated_at),
        achterstallig: open && isAchterstallig({ dueDate: iso(t.due_date) } as any, nu), herkomst: (typeof t.data?.herkomst === 'string' ? t.data.herkomst : t.data?.herkomst?.bron) ?? (t.rule_id ? 'regel' : t.signal_id ? 'inzicht' : t.campaign_id ? 'campagne' : 'handmatig'),
        aanleiding: t.data?.aanleiding ?? t.data?.waarom ?? null, poging: t.data?.poging ?? null, eigenaar: kaal(t.eigenaar), account: { id, naam: acc.name },
      }
    })

    const inzichten = (await rijen(sql`select * from signals where account_id in (${idLijst}) and status in ('nieuw', 'gelezen', 'omgezet') order by created_at desc limit 100`)).map((s) => ({
      id: s.id, title: s.title, type: s.type, status: s.status, bron: s.bron, relevantie: s.relevance_score, createdAt: iso(s.created_at), ruleId: s.rule_id,
      agent: s.agent ?? s.data?.agent ?? null, evidence: s.data?.evidence ?? [], zekerheid: s.data?.zekerheid ?? (s.confidence != null ? Math.round(Number(s.confidence) * 100) : null),
      winpuntVoorstel: s.data?.winpuntVoorstel ?? null, bronUrl: s.data?.bron?.url ?? null, bronDatum: s.data?.bron?.datum ?? null, specifiekeBron: s.data?.bron?.naam ?? null,
      waarom: s.data?.waarom ?? null, bewijs: s.data?.bewijs ?? [], voorstel: s.data?.voorstel ?? null, account: { id, naam: acc.name },
    }))

    const afsprakenRij = await rijen(sql`select a.*, m.naam as soort_naam, c.first_name, c.last_name, u.name as eigenaar from appointments a
      left join meetingsoorten m on m.id = a.meetingsoort_id left join contacts c on c.id = a.contact_id left join users u on u.id = a.owner_id
      where a.account_id in (${idLijst}) order by a.start_at desc limit 200`)
    const contactNaam = (r: any) => [r.first_name, r.last_name].filter(Boolean).join(' ') || null
    const afspraken = afsprakenRij.map((a) => ({
      id: a.id, soort: a.soort_naam ?? 'Afspraak', vorm: a.vorm, status: a.status, start: iso(a.start_at), eind: iso(a.end_at), locatie: a.data?.locatie ?? null,
      uitkomst: a.uitkomst_code, contact: contactNaam(a), eigenaar: kaal(a.eigenaar), heeftVerslag: !!a.data?.verslag?.tekst,
    }))

    const acts = await rijen(sql`select a.*, c.first_name, c.last_name, u.name as door_naam from activiteiten a left join contacts c on c.id = a.contact_id left join users u on u.id = a.door
      where a.account_id in (${idLijst}) and a.soort in ('mail', 'gebeld') order by a.op desc limit 300`)
    const conceptMails = await rijen(sql`select id, concept, status, op from concepten where account_id in (${idLijst}) and concept->>'type' = 'mail' and status in ('klaar', 'goedgekeurd') order by op desc limit 20`)
    const mails = [
      ...acts.filter((x) => x.soort === 'mail').map((m) => ({ id: m.id, onderwerp: m.data?.onderwerp ?? 'Mail', tekst: m.data?.tekst ?? null, status: m.uitkomst ?? 'verzonden', op: iso(m.op), aan: contactNaam(m), door: kaal(m.door_naam), concept: false })),
      ...conceptMails.map((c) => ({ id: c.id, onderwerp: c.concept?.onderwerp ?? 'Mailconcept', tekst: c.concept?.tekst ?? null, status: c.status === 'goedgekeurd' ? 'goedgekeurd' : 'concept', op: iso(c.op), aan: null, door: null, concept: true })),
    ].sort((a, b) => String(b.op).localeCompare(String(a.op)))

    // Gespreksverslagen: het verslag op een afspraak, een transcript en de notitie bij een belpoging.
    const transcripten = await rijen(sql`select t.id, t.record_id, t.tekst, t.op from transcripten t where t.record_soort = 'appointments' and t.record_id in (select id from appointments where account_id in (${idLijst}))`)
    const verslagen = [
      ...afsprakenRij.filter((a) => a.data?.verslag?.tekst).map((a) => ({ id: `afspraak-${a.id}`, bron: 'afspraak', bronLabel: 'Afspraak', typeLabel: a.soort_naam ?? 'Afspraak', titel: `${a.soort_naam ?? 'Afspraak'} met ${acc.name}`, tekst: a.data.verslag.tekst, datum: iso(a.start_at), contact: contactNaam(a), woorden: woorden(a.data.verslag.tekst), afspraakId: a.id })),
      ...transcripten.map((t) => ({ id: `transcript-${t.id}`, bron: 'afspraak', bronLabel: 'Transcript', typeLabel: 'Opname', titel: `Transcript van ${acc.name}`, tekst: t.tekst, datum: iso(t.op), contact: null, woorden: woorden(t.tekst), afspraakId: t.record_id })),
      ...acts.filter((x) => x.soort === 'gebeld' && (x.data?.tekst || x.data?.notitie)).map((g) => ({ id: `bel-${g.id}`, bron: 'taak', bronLabel: 'Beltaak', typeLabel: 'Gesprek', titel: `Gesprek met ${contactNaam(g) ?? acc.name}`, tekst: g.data?.tekst ?? g.data?.notitie, datum: iso(g.op), contact: contactNaam(g), woorden: woorden(g.data?.tekst ?? g.data?.notitie), afspraakId: null })),
    ].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))

    // Deals: Dealtrace draagt over; de deal zelf loopt in DealDrive (of het CRM). We tonen de overdrachten en wat DealDrive terugmeldde.
    const overdrachten = await rijen(sql`select o.*, u.name as door_naam from overdrachten o left join users u on u.id = o.door where o.account_id in (${idLijst}) order by o.op desc`)
    const gebeurtenissen = await rijen(sql`select soort, ontvangen_op, resultaat from dealdrive_gebeurtenissen where account_id in (${idLijst}) order by ontvangen_op desc limit 50`)
    const dd = acc.data?.extern?.dealdrive ?? {}
    const deals = overdrachten.map((o) => ({
      id: o.id, naar: o.naar, status: o.status, op: iso(o.op), door: kaal(o.door_naam), externUrl: o.extern_url, titel: o.pakket?.titel ?? `Overdracht ${acc.name}`,
      waarde: o.pakket?.waarde ?? null, fase: o.naar === 'dealdrive' ? (dd.gewonnenOp ? 'gewonnen' : acc.data?.winback ? 'verloren' : o.status === 'bevestigd' ? 'lopend' : 'overgedragen') : o.status,
      eigenaar: o.naar === 'dealdrive' ? dd.eigenaar ?? null : null, gewonnenOp: o.naar === 'dealdrive' ? dd.gewonnenOp ?? null : null,
    }))

    const campagnes = (await rijen(sql`select c.id, c.naam, c.soort, c.status, c.data->'doel' as doel, i.kolom, i.poging, i.volgende_stap, i.volgende_op, i.einddoel_gehaald
      from campagne_items i join campagnes c on c.id = i.campagne_id where i.account_id in (${idLijst}) order by c.created_at desc`)).map((c) => ({
      id: c.id, naam: c.naam, soort: c.soort, status: c.status, doel: doelTekst(c.doel), kolom: c.kolom, poging: c.poging, volgendeStap: c.volgende_stap, volgendeOp: iso(c.volgende_op), gehaald: !!c.einddoel_gehaald,
    }))

    const documenten = (await rijen(sql`select b.id, b.naam, b.soort, b.mime, b.grootte, b.op, b.eigenaar_id, u.name as door_naam from bijlagen b left join users u on u.id = b.eigenaar_id
      where (b.record_soort = 'account' and b.record_id in (${idLijst})) or (b.record_soort = 'appointments' and b.record_id in (select id from appointments where account_id in (${idLijst})))
      order by b.op desc`)).map((b) => ({ id: b.id, naam: b.naam ?? (b.soort === 'foto' ? 'Foto' : b.soort === 'opname' ? 'Opname' : b.soort === 'visitekaartje' ? 'Visitekaartje' : 'Document'), soort: b.soort, mime: b.mime, grootte: b.grootte, op: iso(b.op), door: kaal(b.door_naam), magVerwijderen: b.eigenaar_id === ctx.gebruiker.id && b.soort === 'document' }))

    return { taken, inzichten, afspraken, mails, verslagen, deals, gebeurtenissen: gebeurtenissen.map((g) => ({ soort: g.soort, op: iso(g.ontvangen_op), resultaat: g.resultaat })), campagnes, documenten }
  })
})
