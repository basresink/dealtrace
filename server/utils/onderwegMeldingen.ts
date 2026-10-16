// De sweep voor onderweg-meldingen (P31, 8.10): elke 5 minuten vertrek, briefing en verslag bij
// afspraken, hete aanleidingen op eigen accounts, en de dagstart en recap op hun tijd. Elke melding
// loopt door magMelden (stille uren, dagplafond, per soort) en komt in melding_log, ook als hij
// wordt overgeslagen, met de reden. De sleutel voorkomt dubbel versturen.
import { sql } from 'drizzle-orm'
import { houdtVast } from '../../shared/kanalen'
import { meldingInstelling, magMelden, NOTIFICATIE_SOORT, onderwegMeldingen, type DueMelding, type MeldingInstelling, type MeldAfspraak, type OnderwegSoort } from '../../shared/meldingsregels'
import { nlMoment, nlTijdstip } from '../../shared/datum'
import { schatReistijd } from '../../shared/route'
import { gebruikDb } from './db'
import { stuurPush } from './push'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v))

/** De instelling van één gebruiker: organisatie plus eigen keuzes (Expert ook per soort). */
export async function instellingVan(tx: Tx, gebruikerId: string): Promise<MeldingInstelling> {
  const [o] = await rijen(tx, sql`select value from org_settings where key = 'meldingsregels'`)
  const [p] = await rijen(tx, sql`select data->'onderweg' as onderweg from persoonlijke_instellingen where id = ${gebruikerId}`)
  const [u] = await rijen(tx, sql`select niveau from users where id = ${gebruikerId}`)
  return meldingInstelling(o?.value as any, p?.onderweg as any, u?.niveau === 'expert')
}

/** Eén melding: controleren, in de app zetten, pushen en loggen. Geeft de status. */
export async function meld(tx: Tx, org: string, d: DueMelding, nu = new Date(), telling?: { inBelblok?: boolean; rijmodus?: boolean }) {
  const [al] = await rijen(tx, sql`select status from melding_log where gebruiker_id = ${d.gebruikerId} and sleutel = ${d.sleutel}`)
  if (al) return al.status as string
  const inst = await instellingVan(tx, d.gebruikerId)
  // Rijmodus en belblok (P26): als de aanroeper het niet meegeeft, uit de gebruiker zelf.
  if (!telling) { const [u] = await rijen(tx, sql`select data from users where id = ${d.gebruikerId}`); const v = houdtVast(u?.data, nu); telling = { rijmodus: v === 'rijmodus', inBelblok: v === 'belblok' } }
  const [t] = await rijen(tx, sql`select count(*)::int as n from melding_log where gebruiker_id = ${d.gebruikerId} and status = 'verstuurd' and soort not in ('dagstart', 'recap') and op >= ${nlTijdstip(nlMoment(nu).datum, 0).toISOString()} and op <= ${nu.toISOString()}`)
  const m = magMelden(inst, d.soort, nu, { vandaag: t?.n ?? 0, ...telling })
  if (!m.versturen) {
    // Uitgesteld (stille uren, belblok): wel in de app, zonder push. Overgeslagen: alleen in het log.
    if (m.uitstellenTot) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${d.gebruikerId}, ${NOTIFICATIE_SOORT[d.soort]}, ${d.titel}, ${d.tekst}, ${d.link}, ${nu.toISOString()}, ${JSON.stringify({ onderweg: d.soort, actie: d.actie, stil: true })}::jsonb)`)
    await tx.execute(sql`insert into melding_log (organisation_id, gebruiker_id, soort, sleutel, status, reden, op) values (${org}, ${d.gebruikerId}, ${d.soort}, ${d.sleutel}, ${m.uitstellenTot ? 'uitgesteld' : 'overgeslagen'}, ${m.reden}, ${nu.toISOString()}) on conflict (gebruiker_id, sleutel) do nothing`)
    return m.uitstellenTot ? 'uitgesteld' : 'overgeslagen'
  }
  const id = crypto.randomUUID()
  // Direct gepusht: de verzender (P26) slaat deze rij over.
  await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data, kanalen_verstuurd) values (${id}, ${org}, ${d.gebruikerId}, ${NOTIFICATIE_SOORT[d.soort]}, ${d.titel}, ${d.tekst}, ${d.link}, ${nu.toISOString()}, ${JSON.stringify({ onderweg: d.soort, actie: d.actie })}::jsonb, '{"inApp": true, "push": true}'::jsonb)`)
  await tx.execute(sql`insert into melding_log (organisation_id, gebruiker_id, soort, sleutel, status, reden, op) values (${org}, ${d.gebruikerId}, ${d.soort}, ${d.sleutel}, 'verstuurd', null, ${nu.toISOString()}) on conflict (gebruiker_id, sleutel) do nothing`)
  await stuurPush(tx, d.gebruikerId, { id, titel: d.titel, tekst: d.tekst, link: d.link, actie: d.actie }).catch(() => 0)
  return 'verstuurd'
}

/** Afspraken met reistijd (vanaf de vorige afspraak of de thuisbasis) en de briefing in drie regels. */
async function afsprakenRond(tx: Tx, nu: Date): Promise<(MeldAfspraak & { bezoek: boolean })[]> {
  const rows = await rijen(tx, sql`select ap.id, ap.owner_id, ap.start_at, ap.end_at, ap.status, ap.vorm, ap.data, a.name, a.lat, a.lng, a.data->>'adres' as adres, m.naam as soort, m.data->>'doel' as doel, u.data->'thuisbasis' as thuis
    from appointments ap join meetingsoorten m on m.id = ap.meetingsoort_id left join accounts a on a.id = ap.account_id join users u on u.id = ap.owner_id
    where ap.status = 'gepland' and ap.start_at < ${new Date(nu.getTime() + 4 * 3600_000).toISOString()} and ap.end_at > ${new Date(nu.getTime() - 3600_000).toISOString()} order by ap.owner_id, ap.start_at`)
  return rows.map((r, i) => {
    const v0 = rows[i - 1]
    const vorige = v0 && v0.owner_id === r.owner_id && Date.parse(iso(v0.end_at)) <= Date.parse(iso(r.start_at)) ? v0 : null
    const van = vorige?.lat != null ? { lat: vorige.lat, lng: vorige.lng } : r.thuis?.lat != null ? { lat: r.thuis.lat, lng: r.thuis.lng } : null
    const reis = r.lat != null && van ? schatReistijd(van, { lat: r.lat, lng: r.lng }).minuten : null
    return {
      id: r.id, gebruikerId: r.owner_id, accountNaam: r.name, start: iso(r.start_at), eind: iso(r.end_at), status: r.status, verslag: !!r.data?.verslag?.tekst,
      reistijdMin: reis, bezoek: r.vorm === 'bezoek',
      briefing: [`${r.soort} om ${new Date(iso(r.start_at)).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' })}.`, r.data?.briefing ?? r.data?.aanleiding ?? null, r.doel ? `Doel: ${r.doel}` : null],
      adres: r.adres,
    }
  })
}

/** De sweep voor één organisatie. Geeft per status het aantal. */
export async function sweepOnderweg(tx: Tx, org: string, nu = new Date()) {
  const tel: Record<string, number> = {}
  const doe = async (d: DueMelding) => { const s = await meld(tx, org, d, nu); tel[s] = (tel[s] ?? 0) + 1 }
  const afs = await afsprakenRond(tx, nu)
  // Vertrek alleen bij een bezoek; online en telefoon krijgen briefing en verslag.
  for (const d of onderwegMeldingen(afs, nu).filter((d) => d.soort !== 'vertrek' || afs.find((a) => `vertrek:${a.id}` === d.sleutel)?.bezoek)) await doe(d)
  // Hete aanleidingen op eigen accounts in de laatste tien minuten.
  for (const s of await rijen(tx, sql`select s.id, s.title, s.data, a.owner_id, a.name from signals s join accounts a on a.id = s.account_id where s.relevance_score >= 85 and s.created_at > ${new Date(nu.getTime() - 10 * 60_000).toISOString()} and a.owner_id is not null`)) {
    await doe({ soort: 'heet', sleutel: `heet:${s.id}`, gebruikerId: s.owner_id, titel: `Hete aanleiding: ${s.name}`, tekst: String(s.title).slice(0, 140), link: `/inzichten?inzicht=${s.id}`, actie: 'Open' })
  }
  // Dagstart op de eigen tijd en de recap om 17:00, voor wie vandaag werk heeft.
  const m = nlMoment(nu)
  for (const u of await rijen(tx, sql`select u.id, coalesce(p.data->'onderweg'->>'dagstart', '07:45') as dagstart from users u left join persoonlijke_instellingen p on p.id = u.id where u.status = 'actief' and u.role <> 'founder'`)) {
    const [h, mi] = String(u.dagstart).split(':').map(Number)
    const doel = h! * 60 + mi!; const nuMin = m.uur * 60 + nu.getUTCMinutes()
    if (nuMin >= doel && nuMin < doel + 10) {
      const [c] = await rijen(tx, sql`select (select count(*)::int from appointments where owner_id = ${u.id} and status = 'gepland' and start_at::date = ${m.datum}::date) as afs, (select count(*)::int from tasks where owner_id = ${u.id} and action_type = 'bellen' and status in ('open', 'bezig') and due_date::date <= ${m.datum}::date) as bel,
        (select a.name || ' om ' || to_char(ap.start_at at time zone 'Europe/Amsterdam', 'HH24:MI') from appointments ap left join accounts a on a.id = ap.account_id where ap.owner_id = ${u.id} and ap.status = 'gepland' and ap.start_at::date = ${m.datum}::date order by ap.start_at limit 1) as eerste`)
      if (c && (c.afs || c.bel)) await doe({ soort: 'dagstart', sleutel: `dagstart:${m.datum}`, gebruikerId: u.id, titel: `${c.afs} ${c.afs === 1 ? 'bezoek' : 'bezoeken'}, ${c.bel} ${c.bel === 1 ? 'belactie' : 'belacties'}.${c.eerste ? ` Eerst: ${c.eerste}.` : ''}`, tekst: 'Je dag in het kort.', link: '/', actie: 'Lees voor' })
    }
    if (m.uur === 17 && nu.getUTCMinutes() < 10) {
      const [z] = await rijen(tx, sql`select count(*)::int as n from appointments where owner_id = ${u.id} and status = 'gepland' and end_at < ${nu.toISOString()} and start_at::date = ${m.datum}::date`)
      await doe({ soort: 'recap', sleutel: `recap:${m.datum}`, gebruikerId: u.id, titel: z?.n ? `De dag rond: ${z.n} ${z.n === 1 ? 'verslag ontbreekt' : 'verslagen ontbreken'}` : 'De dag rond: alles vastgelegd', tekst: 'Tik voor je recap.', link: '/', actie: 'Open' })
    }
  }
  return tel
}
export type { OnderwegSoort }
