// De tabbladen van de accountkaart en de contactkaart (opzet uit DealDrive): taken, inzichten, afspraken,
// e-mails, gespreksverslagen, deals, campagnes, documenten en de momenten uit de activiteitenlog (tijdlijn en
// notities). Eén ronde naar de database per soort. Elk item draagt contactId en contactNaam (via contact_id),
// zodat de accountkaart per item laat zien met wie het was. Met een contactId tonen de tabbladen alleen wat bij
// dat contact hoort; deals blijven de stand van het account.
import { sql } from 'drizzle-orm'
import { isAchterstallig } from '../../shared/taken'

const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null)
const kaal = (n: unknown) => String(n ?? '').replace(/^Testgebruiker /, '')
const doelTekst = (d: any) => (!d ? null : d.type === 'procent' ? `doel: ${d.waarde}% conversie naar afspraak` : d.type === 'afspraken' ? `doel: ${d.waarde} ${d.waarde === 1 ? 'afspraak' : 'afspraken'}` : `doel: ${d.waarde} ${d.type}`)
const woorden = (t: unknown) => String(t ?? '').trim().split(/\s+/).filter(Boolean).length
const naamVan = (r: any) => [r.c_voornaam, r.c_achternaam].filter(Boolean).join(' ') || null

export interface KaartBereik {
  /** Het account (en de accounts die erin zijn samengevoegd). */
  account: { id: string; naam: string; ids: string[] }
  /** Alleen wat bij dit contact hoort. */
  contactId?: string | null
  gebruikerId: string
}

export async function kaartTabbladen(tx: any, b: KaartBereik) {
  const nu = new Date()
  const rijen = async (q: any) => (await tx.execute(q)).rows as any[]
  const { id, naam: accNaam } = b.account
  const idLijst = sql.join(b.account.ids.map((x) => sql`${x}`), sql`, `)
  const cid = b.contactId ?? null
  // Het filter per tabel: op het account, of op het contact.
  const op = (alias: string) => (cid ? sql`${sql.raw(alias)}.contact_id = ${cid}` : sql`${sql.raw(alias)}.account_id in (${idLijst})`)
  const metContact = (r: any) => ({ contactId: r.contact_id ?? null, contactNaam: r.contact_id ? naamVan(r) : null })

  const taken = (await rijen(sql`select t.*, u.name as eigenaar, c.first_name as c_voornaam, c.last_name as c_achternaam from tasks t left join users u on u.id = t.owner_id left join contacts c on c.id = t.contact_id
    where ${op('t')} and (t.status in ('open', 'bezig') or t.updated_at > now() - interval '180 days') order by coalesce(t.due_date, t.created_at) desc limit 200`)).map((t) => {
    const open = ['open', 'bezig'].includes(t.status)
    return {
      id: t.id, title: t.title, actionType: t.action_type, priority: t.priority, status: t.status, dueDate: iso(t.due_date), uitkomst: t.uitkomst, afgerondOp: open ? null : iso(t.updated_at),
      achterstallig: open && isAchterstallig({ dueDate: iso(t.due_date) } as any, nu), herkomst: (typeof t.data?.herkomst === 'string' ? t.data.herkomst : t.data?.herkomst?.bron) ?? (t.rule_id ? 'regel' : t.signal_id ? 'inzicht' : t.campaign_id ? 'campagne' : 'handmatig'),
      aanleiding: t.data?.aanleiding ?? t.data?.waarom ?? null, poging: t.data?.poging ?? null, eigenaar: kaal(t.eigenaar), account: { id, naam: accNaam }, ...metContact(t),
    }
  })

  const inzichten = (await rijen(sql`select s.*, c.first_name as c_voornaam, c.last_name as c_achternaam from signals s left join contacts c on c.id = s.contact_id
    where ${op('s')} and s.status in ('nieuw', 'gelezen', 'omgezet') order by s.created_at desc limit 100`)).map((s) => ({
    id: s.id, title: s.title, type: s.type, status: s.status, bron: s.bron, relevantie: s.relevance_score, createdAt: iso(s.created_at), ruleId: s.rule_id,
    agent: s.agent ?? s.data?.agent ?? null, evidence: s.data?.evidence ?? [], zekerheid: s.data?.zekerheid ?? (s.confidence != null ? Math.round(Number(s.confidence) * 100) : null),
    winpuntVoorstel: s.data?.winpuntVoorstel ?? null, bronUrl: s.data?.bron?.url ?? null, bronDatum: s.data?.bron?.datum ?? null, specifiekeBron: s.data?.bron?.naam ?? null,
    waarom: s.data?.waarom ?? null, bewijs: s.data?.bewijs ?? [], voorstel: s.data?.voorstel ?? null, account: { id, naam: accNaam }, ...metContact(s),
  }))

  const afsprakenRij = await rijen(sql`select a.*, m.naam as soort_naam, c.first_name as c_voornaam, c.last_name as c_achternaam, u.name as eigenaar from appointments a
    left join meetingsoorten m on m.id = a.meetingsoort_id left join contacts c on c.id = a.contact_id left join users u on u.id = a.owner_id
    where ${op('a')} order by a.start_at desc limit 200`)
  const afspraken = afsprakenRij.map((a) => ({
    id: a.id, soort: a.soort_naam ?? 'Afspraak', vorm: a.vorm, status: a.status, start: iso(a.start_at), eind: iso(a.end_at), locatie: a.data?.locatie ?? null,
    uitkomst: a.uitkomst_code, contact: naamVan(a), eigenaar: kaal(a.eigenaar), heeftVerslag: !!a.data?.verslag?.tekst, titel: a.data?.titel ?? null, ...metContact(a),
  }))
  const afspraakIds = afsprakenRij.map((a) => a.id as string)
  const afspraakLijst = afspraakIds.length ? sql.join(afspraakIds.map((x) => sql`${x}`), sql`, `) : sql`null`

  // De activiteitenlog: contactmomenten, notities, mails en belpogingen.
  const acts = await rijen(sql`select a.*, c.first_name as c_voornaam, c.last_name as c_achternaam, u.name as door_naam from activiteiten a left join contacts c on c.id = a.contact_id left join users u on u.id = a.door
    where ${op('a')} order by a.op desc limit 400`)
  const momenten = acts.map((x) => ({ id: x.id, soort: x.soort, kanaal: x.kanaal, uitkomst: x.uitkomst, op: iso(x.op), door: x.door_naam ?? null, tekst: x.data?.tekst ?? x.data?.notitie ?? null, ...metContact(x) }))

  const conceptMails = await rijen(cid
    ? sql`select k.id, k.concept, k.status, k.op from concepten k where k.concept->>'type' = 'mail' and k.status in ('klaar', 'goedgekeurd')
        and (k.concept->>'contactId' = ${cid} or k.task_id in (select id from tasks where contact_id = ${cid}) or k.appointment_id in (select id from appointments where contact_id = ${cid})) order by k.op desc limit 20`
    : sql`select id, concept, status, op from concepten where account_id in (${idLijst}) and concept->>'type' = 'mail' and status in ('klaar', 'goedgekeurd') order by op desc limit 20`)
  const mails = [
    ...acts.filter((x) => x.soort === 'mail').map((m) => ({ id: m.id, onderwerp: m.data?.onderwerp ?? 'Mail', tekst: m.data?.tekst ?? null, status: m.uitkomst ?? 'verzonden', op: iso(m.op), aan: naamVan(m), door: kaal(m.door_naam), concept: false, ...metContact(m) })),
    ...conceptMails.map((c) => ({ id: c.id, onderwerp: c.concept?.onderwerp ?? 'Mailconcept', tekst: c.concept?.tekst ?? null, status: c.status === 'goedgekeurd' ? 'goedgekeurd' : 'concept', op: iso(c.op), aan: null, door: null, concept: true, contactId: null, contactNaam: null })),
  ].sort((a, b) => String(b.op).localeCompare(String(a.op)))

  // Gespreksverslagen: het verslag op een afspraak, een transcript en de notitie bij een belpoging.
  const transcripten = await rijen(sql`select t.id, t.record_id, t.tekst, t.op from transcripten t where t.record_soort = 'appointments' and t.record_id in (${afspraakLijst})`)
  const perAfspraak = new Map(afsprakenRij.map((a) => [a.id, a]))
  const verslagen = [
    ...afsprakenRij.filter((a) => a.data?.verslag?.tekst).map((a) => ({ id: `afspraak-${a.id}`, bron: 'afspraak', bronLabel: 'Afspraak', typeLabel: a.soort_naam ?? 'Afspraak', titel: `${a.soort_naam ?? 'Afspraak'} met ${naamVan(a) ?? accNaam}`, tekst: a.data.verslag.tekst, datum: iso(a.start_at), contact: naamVan(a), woorden: woorden(a.data.verslag.tekst), afspraakId: a.id, ...metContact(a) })),
    ...transcripten.map((t) => { const a = perAfspraak.get(t.record_id) ?? {}; return { id: `transcript-${t.id}`, bron: 'afspraak', bronLabel: 'Transcript', typeLabel: 'Opname', titel: `Transcript van ${naamVan(a) ?? accNaam}`, tekst: t.tekst, datum: iso(t.op), contact: naamVan(a), woorden: woorden(t.tekst), afspraakId: t.record_id, ...metContact(a) } }),
    ...acts.filter((x) => x.soort === 'gebeld' && (x.data?.tekst || x.data?.notitie)).map((g) => ({ id: `bel-${g.id}`, bron: 'taak', bronLabel: 'Beltaak', typeLabel: 'Gesprek', titel: `Gesprek met ${naamVan(g) ?? accNaam}`, tekst: g.data?.tekst ?? g.data?.notitie, datum: iso(g.op), contact: naamVan(g), woorden: woorden(g.data?.tekst ?? g.data?.notitie), afspraakId: null, ...metContact(g) })),
  ].sort((a, b) => String(b.datum).localeCompare(String(a.datum)))

  // Deals: Dealtrace draagt over; de deal zelf loopt in DealDrive (of het CRM). Altijd de stand van het account.
  const [acc] = await rijen(sql`select data from accounts where id = ${id}`)
  const overdrachten = await rijen(sql`select o.*, u.name as door_naam from overdrachten o left join users u on u.id = o.door where o.account_id in (${idLijst}) order by o.op desc`)
  const gebeurtenissen = await rijen(sql`select soort, ontvangen_op, resultaat from dealdrive_gebeurtenissen where account_id in (${idLijst}) order by ontvangen_op desc limit 50`)
  const dd = acc?.data?.extern?.dealdrive ?? {}
  const deals = overdrachten.map((o) => ({
    id: o.id, naar: o.naar, status: o.status, op: iso(o.op), door: kaal(o.door_naam), externUrl: o.extern_url, titel: o.pakket?.titel ?? `Overdracht ${accNaam}`,
    waarde: o.pakket?.waarde ?? null, fase: o.naar === 'dealdrive' ? (dd.gewonnenOp ? 'gewonnen' : acc?.data?.winback ? 'verloren' : o.status === 'bevestigd' ? 'lopend' : 'overgedragen') : o.status,
    eigenaar: o.naar === 'dealdrive' ? dd.eigenaar ?? null : null, gewonnenOp: o.naar === 'dealdrive' ? dd.gewonnenOp ?? null : null,
  }))

  // Campagnes: op het account alle; op het contact de campagnes met een taak of moment voor dat contact.
  const campagnes = (await rijen(sql`select c.id, c.naam, c.soort, c.status, c.data->'doel' as doel, i.kolom, i.poging, i.volgende_stap, i.volgende_op, i.einddoel_gehaald
    from campagne_items i join campagnes c on c.id = i.campagne_id where i.account_id in (${idLijst})
    ${cid ? sql`and c.id in (select campaign_id from tasks where contact_id = ${cid} and campaign_id is not null union select campaign_id from activiteiten where contact_id = ${cid} and campaign_id is not null)` : sql``}
    order by c.created_at desc`)).map((c) => ({
    id: c.id, naam: c.naam, soort: c.soort, status: c.status, doel: doelTekst(c.doel), kolom: c.kolom, poging: c.poging, volgendeStap: c.volgende_stap, volgendeOp: iso(c.volgende_op), gehaald: !!c.einddoel_gehaald,
  }))

  // Documenten: bij het account, bij een contact (van het account) en uit de afspraken.
  const documenten = (await rijen(sql`select b.id, b.naam, b.soort, b.mime, b.grootte, b.op, b.eigenaar_id, b.record_soort, b.record_id, u.name as door_naam from bijlagen b left join users u on u.id = b.eigenaar_id
    where ${cid
      ? sql`(b.record_soort = 'contact' and b.record_id = ${cid})`
      : sql`(b.record_soort = 'account' and b.record_id in (${idLijst})) or (b.record_soort = 'contact' and b.record_id in (select id from contacts where account_id in (${idLijst})))`}
      or (b.record_soort = 'appointments' and b.record_id in (${afspraakLijst}))
    order by b.op desc`)).map((d) => ({ id: d.id, naam: d.naam ?? (d.soort === 'foto' ? 'Foto' : d.soort === 'opname' ? 'Opname' : d.soort === 'visitekaartje' ? 'Visitekaartje' : 'Document'), soort: d.soort, mime: d.mime, grootte: d.grootte, op: iso(d.op), door: kaal(d.door_naam), magVerwijderen: d.eigenaar_id === b.gebruikerId && d.soort === 'document' && ['account', 'contact'].includes(d.record_soort) }))

  return { taken, inzichten, afspraken, mails, verslagen, deals, gebeurtenissen: gebeurtenissen.map((g) => ({ soort: g.soort, op: iso(g.ontvangen_op), resultaat: g.resultaat })), campagnes, documenten, momenten }
}
