// Verkoopverhaal op de server (P28, ADR-017): de eigen inrichting als concept per onderdeel,
// bevestigen met versie en audit, de projectie naar het leesmodel vv_* (upsert op extern_id,
// verdwenen ids op actief=false, verwijzingen in accounts blijven op id) en het lezen van het
// leesmodel als VerkoopverhaalStand. Functies lezen alleen via leesStand; de bron is onzichtbaar.
import { sql } from 'drizzle-orm'
import {
  LEEG_CONCEPT, ONDERDELEN, moetControleren, ontbrekendeVelden, startsetAanvullingen, startsetConcepten, tekstenUitConcept, teveelHoog, CONCURRENT_SOORTEN,
  type Concepten, type Onderdeel, type VerkoopverhaalStand,
} from '../../shared/verkoopverhaal'
import { schrijfAudit } from './audit'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]
const fout = (status: number, bericht: string, data?: unknown): never => { throw Object.assign(new Error(bericht), { statusCode: status, statusMessage: bericht, data }) }

export interface Sublaag { onderdeel: Onderdeel; bron: string; status: string; versie: number; bevestigdOp: string | null; controleren: boolean; verouderd: boolean; concept: any; bijgewerktOp: string }

export async function sublagen(tx: Tx, org?: string): Promise<Record<Onderdeel, Sublaag>> {
  const r = await rijen(tx, org ? sql`select * from vv_sublagen where organisation_id = ${org}` : sql`select * from vv_sublagen`)
  return Object.fromEntries(ONDERDELEN.map((o) => {
    const x = r.find((y) => y.onderdeel === o)
    return [o, { onderdeel: o, bron: x?.bron ?? 'eigen', status: x?.status ?? 'concept', versie: x?.versie ?? 0, bevestigdOp: x?.bevestigd_op ? new Date(x.bevestigd_op).toISOString() : null, controleren: !!x?.controleren, verouderd: !!x?.verouderd, concept: x?.concept && Object.keys(x.concept).length ? x.concept : LEEG_CONCEPT[o], bijgewerktOp: x?.bijgewerkt_op ? new Date(x.bijgewerkt_op).toISOString() : '' }]
  })) as Record<Onderdeel, Sublaag>
}

/** Concept bewaren (automatisch per veld). 409 bij een gespiegeld onderdeel (vanaf P29). */
export async function bewaarConcept(tx: Tx, org: string, onderdeel: Onderdeel, concept: unknown) {
  const [s] = await rijen(tx, sql`select bron from vv_sublagen where organisation_id = ${org} and onderdeel = ${onderdeel}`)
  if (s?.bron === 'salesdna') fout(409, 'Dit onderdeel komt uit SalesDNA; wijzigen doe je daar')
  await tx.execute(sql`insert into vv_sublagen (organisation_id, onderdeel, concept, bijgewerkt_op) values (${org}, ${onderdeel}, ${JSON.stringify(concept)}::jsonb, now())
    on conflict (organisation_id, onderdeel) do update set concept = excluded.concept, bijgewerkt_op = now()`)
}

/** Bevestigen: minimale velden, nieuwe versie, projectie, verouderingsregel en audit. */
export async function bevestig(tx: Tx, org: string, onderdeel: Onderdeel, door: string) {
  const alle = await sublagen(tx, org)
  const s = alle[onderdeel]
  if (s.bron === 'salesdna') fout(409, 'Dit onderdeel komt uit SalesDNA; bevestigen doe je daar')
  const mist = ontbrekendeVelden(onderdeel, s.concept)
  if (mist.length) fout(422, `Vul eerst in: ${mist.join(', ')}`, { ontbreekt: mist })
  if (onderdeel === 'winpunten' && teveelHoog(s.concept)) fout(422, 'Hooguit drie winpunten op impact hoog')
  const versie = s.versie + 1
  const vorige = (await rijen(tx, sql`select inhoud from vv_versies where organisation_id = ${org} and onderdeel = ${onderdeel} order by versie desc limit 1`))[0]?.inhoud ?? null
  await tx.execute(sql`insert into vv_versies (organisation_id, onderdeel, versie, inhoud, door) values (${org}, ${onderdeel}, ${versie}, ${JSON.stringify(s.concept)}::jsonb, ${door})`)
  await tx.execute(sql`insert into vv_sublagen (organisation_id, onderdeel, status, versie, bevestigd_op, bevestigd_door, concept, controleren, bijgewerkt_op)
    values (${org}, ${onderdeel}, 'bevestigd', ${versie}, now(), ${door}, ${JSON.stringify(s.concept)}::jsonb, false, now())
    on conflict (organisation_id, onderdeel) do update set status = 'bevestigd', versie = ${versie}, bevestigd_op = now(), bevestigd_door = ${door}, controleren = false, bijgewerkt_op = now()`)
  await projecteer(tx, org, onderdeel, s.concept, versie)
  for (const o of moetControleren(onderdeel, vorige, s.concept)) {
    if (alle[o].status === 'bevestigd') await tx.execute(sql`update vv_sublagen set controleren = true where organisation_id = ${org} and onderdeel = ${o}`)
  }
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'verkoopverhaal.bevestig', resourceType: 'vv_sublagen', resourceId: onderdeel, changes: { versie } })
  return { onderdeel, versie }
}

export async function kloptNog(tx: Tx, org: string, onderdeel: Onderdeel, door: string) {
  await tx.execute(sql`update vv_sublagen set controleren = false where organisation_id = ${org} and onderdeel = ${onderdeel}`)
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'verkoopverhaal.kloptNog', resourceType: 'vv_sublagen', resourceId: onderdeel, changes: {} })
}

const arr = (a: string[] | undefined | null) => sql`${`{${(a ?? []).map((x) => `"${String(x).replace(/["\\]/g, '')}"`).join(',')}}`}::text[]`

/** Concept naar leesmodel. Upsert op extern_id; wat niet meer in het concept staat, wordt inactief. */
export async function projecteer(tx: Tx, org: string, onderdeel: Onderdeel, c: any, versie: number, bron: 'eigen' | 'salesdna' = 'eigen') {
  if (['golden_circle', 'bedrijfsverhaal', 'ambitie', 'waarde'].includes(onderdeel)) {
    const teksten = tekstenUitConcept(onderdeel as 'waarde', c)
    const sub = teksten[0]?.sublaag ?? ({ golden_circle: 'L0.0', bedrijfsverhaal: 'L0.1', ambitie: 'L0.2', waarde: 'L0.4' } as Record<string, string>)[onderdeel]
    await tx.execute(sql`delete from vv_teksten where organisation_id = ${org} and sublaag = ${sub}`)
    for (const t of teksten) {
      await tx.execute(sql`insert into vv_teksten (organisation_id, extern_id, sublaag, sleutel, branche_id, tekst, kernzin, versie, bron) values (${org}, ${t.id}, ${t.sublaag}, ${t.sleutel}, ${t.brancheId}, ${t.tekst}, ${t.kernzin ?? null}, ${versie}, ${bron})`)
    }
    return
  }
  if (onderdeel === 'branches') {
    const items = (c as Concepten['branches']).items ?? []
    await tx.execute(sql`update vv_branches set actief = false where organisation_id = ${org}`)
    for (const [i, b] of items.entries()) {
      await tx.execute(sql`insert into vv_branches (organisation_id, extern_id, naam, focus, horizon, termijn, prioriteit, volgorde, actief, bron) values (${org}, ${b.id}, ${b.naam}, ${b.focus}, ${b.horizon ?? null}, ${b.termijn ?? null}, ${b.prioriteit ?? null}, ${i + 1}, ${b.actief !== false}, ${bron})
        on conflict (organisation_id, extern_id) do update set naam = excluded.naam, focus = excluded.focus, horizon = excluded.horizon, termijn = excluded.termijn, prioriteit = excluded.prioriteit, volgorde = excluded.volgorde, actief = excluded.actief, bron = excluded.bron`)
    }
    return
  }
  if (onderdeel === 'concurrenten') {
    await tx.execute(sql`update vv_concurrenten set actief = false where organisation_id = ${org}`)
    for (const [i, x] of ((c as Concepten['concurrenten']).items ?? []).entries()) {
      const { id, naam, soort, actief, ...data } = x
      await tx.execute(sql`insert into vv_concurrenten (organisation_id, extern_id, naam, soort, data, volgorde, actief, bron) values (${org}, ${id}, ${naam}, ${soort}, ${JSON.stringify(data)}::jsonb, ${i + 1}, ${actief !== false}, ${bron})
        on conflict (organisation_id, extern_id) do update set naam = excluded.naam, soort = excluded.soort, data = excluded.data, volgorde = excluded.volgorde, actief = excluded.actief, bron = excluded.bron`)
    }
    return
  }
  if (onderdeel === 'winpunten') {
    const w = c as Concepten['winpunten']
    for (const f of w.fasen ?? []) {
      await tx.execute(sql`insert into vv_fasen (organisation_id, extern_id, naam, soort, volgorde, reis_hoofdfase, bron) values (${org}, ${f.id}, ${f.naam}, ${f.soort ?? null}, ${f.volgorde}, ${f.reisHoofdfase ?? null}, ${bron})
        on conflict (organisation_id, extern_id) do update set naam = excluded.naam, soort = excluded.soort, volgorde = excluded.volgorde, reis_hoofdfase = coalesce(excluded.reis_hoofdfase, vv_fasen.reis_hoofdfase), bron = excluded.bron`)
    }
    await tx.execute(sql`update vv_winpunten set actief = false where organisation_id = ${org}`)
    for (const [i, x] of (w.items ?? []).entries()) {
      await tx.execute(sql`insert into vv_winpunten (organisation_id, extern_id, fase_id, titel, omschrijving, waarom, impact, concurrent_ids, context, weging, volgorde, actief, bron)
        values (${org}, ${x.id}, ${x.faseId}, ${x.titel}, ${x.omschrijving}, ${x.waarom ?? null}, ${x.impact}, ${arr(x.concurrentIds)}, ${JSON.stringify(x.context ?? {})}::jsonb, ${x.weging ?? 1}, ${i + 1}, ${x.actief !== false}, ${bron})
        on conflict (organisation_id, extern_id) do update set fase_id = excluded.fase_id, titel = excluded.titel, omschrijving = excluded.omschrijving, waarom = excluded.waarom, impact = excluded.impact,
          concurrent_ids = excluded.concurrent_ids, context = excluded.context, weging = excluded.weging, volgorde = excluded.volgorde, actief = excluded.actief, bron = excluded.bron`)
    }
    return
  }
  if (onderdeel === 'terugkomregels') {
    await tx.execute(sql`update vv_terugkomregels set actief = false where organisation_id = ${org}`)
    for (const [i, r] of ((c as Concepten['terugkomregels']).items ?? []).entries()) {
      await tx.execute(sql`insert into vv_terugkomregels (organisation_id, extern_id, lijst, reden, termijn, termijn_dagen, kanaal, klassen, rollen, aanpak, hercontactritme_id, volgorde, actief, bron)
        values (${org}, ${r.id}, ${r.lijst}, ${r.reden}, ${r.termijn}, ${r.termijnDagen}, ${r.kanaal}, ${arr(r.klassen)}, ${arr(r.rollen)}, ${r.aanpak}, ${r.hercontactritmeId ?? null}, ${i + 1}, true, ${bron})
        on conflict (organisation_id, extern_id) do update set lijst = excluded.lijst, reden = excluded.reden, termijn = excluded.termijn, termijn_dagen = excluded.termijn_dagen, kanaal = excluded.kanaal,
          klassen = excluded.klassen, rollen = excluded.rollen, aanpak = excluded.aanpak, hercontactritme_id = excluded.hercontactritme_id, volgorde = excluded.volgorde, actief = true, bron = excluded.bron`)
    }
  }
}

export interface Aanvullingen {
  brancheMapping: { brancheId: string; sbiCodes: string[]; trefwoorden: string[]; doelgroepIds?: string[] }[]
  ambitiedoelen: { id: string; naam: string; doel: number; eenheid: string; jaar: number | null; stand: number | null }[]
  redenmapping: { bronSoort: string; reden: string; terugkomregelId: string | null }[]
  eigenOpties?: { sublaag: string; veld: string; waarde: string }[]
}
/** Eigen aanvullingen vervangen (mappings, ambitiedoelen, redenmapping); altijd bewerkbaar. */
export async function zetAanvullingen(tx: Tx, org: string, a: Partial<Aanvullingen>) {
  if (a.brancheMapping) {
    await tx.execute(sql`delete from vv_branche_mapping where organisation_id = ${org}`)
    for (const m of a.brancheMapping) await tx.execute(sql`insert into vv_branche_mapping (organisation_id, branche_id, sbi_codes, trefwoorden, doelgroep_ids) values (${org}, ${m.brancheId}, ${arr(m.sbiCodes)}, ${arr(m.trefwoorden)}, ${arr(m.doelgroepIds)})`)
  }
  if (a.ambitiedoelen) {
    await tx.execute(sql`delete from vv_ambitiedoelen where organisation_id = ${org}`)
    for (const d of a.ambitiedoelen) await tx.execute(sql`insert into vv_ambitiedoelen (organisation_id, extern_id, naam, doel, eenheid, jaar, stand, stand_op) values (${org}, ${d.id}, ${d.naam}, ${d.doel}, ${d.eenheid}, ${d.jaar}, ${d.stand}, ${d.stand != null ? new Date().toISOString().slice(0, 10) : null})`)
  }
  if (a.redenmapping) {
    await tx.execute(sql`delete from vv_redenmapping where organisation_id = ${org}`)
    for (const m of a.redenmapping) await tx.execute(sql`insert into vv_redenmapping (organisation_id, bron_soort, reden, terugkomregel_id) values (${org}, ${m.bronSoort}, ${m.reden}, ${m.terugkomregelId}) on conflict do nothing`)
  }
  if (a.eigenOpties) {
    await tx.execute(sql`delete from vv_eigen_opties where organisation_id = ${org}`)
    for (const o of a.eigenOpties) await tx.execute(sql`insert into vv_eigen_opties (organisation_id, sublaag, veld, waarde) values (${org}, ${o.sublaag}, ${o.veld}, ${o.waarde}) on conflict do nothing`)
  }
}

/** "Kopieer uit startset": alle acht onderdelen als concept (nooit bevestigd), plus de aanvullingen. 409 met bevestigde inhoud. */
export async function kopieerStartset(tx: Tx, org: string, vvSeed: any, door: string) {
  const [b] = await rijen(tx, sql`select count(*)::int n from vv_sublagen where organisation_id = ${org} and status = 'bevestigd'`)
  if (b?.n) fout(409, 'Er is al bevestigde inhoud; de startset overschrijft die niet')
  const c = startsetConcepten(vvSeed)
  for (const o of ONDERDELEN) await bewaarConcept(tx, org, o, c[o])
  await zetAanvullingen(tx, org, startsetAanvullingen(vvSeed))
  await schrijfAudit(tx, { organisationId: org, actorId: door, action: 'verkoopverhaal.startset', resourceType: 'vv_sublagen', resourceId: 'startset', changes: {} })
}

/** Het leesmodel als VerkoopverhaalStand: alleen bevestigde inhoud, alleen actieve rijen. */
export async function leesStand(tx: Tx): Promise<VerkoopverhaalStand & { fasen: { id: string; naam: string; volgorde: number; reisHoofdfase: string | null }[]; ambitiedoelen: Aanvullingen['ambitiedoelen'] }> {
  const [teksten, branches, conc, fasen, winp, regels, mapping, reden, doelen] = await Promise.all([
    rijen(tx, sql`select * from vv_teksten`), rijen(tx, sql`select * from vv_branches where actief order by (focus = 'primair') desc, volgorde`),
    rijen(tx, sql`select * from vv_concurrenten where actief order by volgorde`), rijen(tx, sql`select * from vv_fasen order by volgorde`),
    rijen(tx, sql`select * from vv_winpunten order by volgorde`), rijen(tx, sql`select * from vv_terugkomregels where actief order by lijst, volgorde`),
    rijen(tx, sql`select * from vv_branche_mapping`), rijen(tx, sql`select * from vv_redenmapping`), rijen(tx, sql`select * from vv_ambitiedoelen order by extern_id`),
  ])
  return {
    ambitie: teksten.find((t) => t.sleutel === 'ambitie' && !t.branche_id)?.tekst ?? null,
    branches: branches.map((b) => ({ id: b.extern_id, naam: b.naam, focus: b.focus, horizon: b.horizon, termijn: b.termijn, prioriteit: b.prioriteit } as any)),
    teksten: teksten.map((t) => ({ id: t.extern_id, sublaag: t.sublaag, sleutel: t.sleutel, brancheId: t.branche_id, tekst: t.tekst, kernzin: t.kernzin })),
    concurrenten: conc.map((c) => ({ id: c.extern_id, naam: c.naam, soort: CONCURRENT_SOORTEN[c.soort as 'direct'] ?? c.soort, soortSleutel: c.soort, ...c.data } as any)),
    winpunten: winp.map((w) => ({ id: w.extern_id, titel: w.titel, omschrijving: w.omschrijving, faseId: w.fase_id, weging: Number(w.weging), onderNorm: !!w.context?.klantfeedback?.onder_norm, actief: w.actief, impact: w.impact, concurrentIds: w.concurrent_ids ?? [], waarom: w.waarom })),
    terugkomregels: regels.map((r) => ({ id: r.extern_id, lijst: r.lijst, reden: r.reden, termijn: r.termijn, termijnDagen: r.termijn_dagen, kanaal: r.kanaal, rollen: r.rollen ?? [], aanpak: r.aanpak, klassen: r.klassen ?? [], hercontactritmeId: r.hercontactritme_id } as any)),
    redenmapping: reden.map((m) => ({ bronSoort: m.bron_soort, reden: m.reden, terugkomregelId: m.terugkomregel_id })),
    brancheMapping: mapping.map((m) => ({ brancheId: m.branche_id, sbiCodes: m.sbi_codes ?? [], trefwoorden: m.trefwoorden ?? [] })),
    fasen: fasen.map((f) => ({ id: f.extern_id, naam: f.naam, volgorde: f.volgorde, reisHoofdfase: f.reis_hoofdfase })),
    ambitiedoelen: doelen.map((d) => ({ id: d.extern_id, naam: d.naam, doel: Number(d.doel), eenheid: d.eenheid, jaar: d.jaar, stand: d.stand == null ? null : Number(d.stand) })),
  }
}

/** De startset Voltvast als eigen inrichting en direct bevestigd (seed en de overstap van P10 tot P12). */
export async function laadStartsetBevestigd(tx: Tx, org: string, vvSeed: any, door: string) {
  await kopieerStartset(tx, org, vvSeed, door)
  for (const o of ONDERDELEN) if (!ontbrekendeVelden(o, startsetConcepten(vvSeed)[o]).length) await bevestig(tx, org, o, door)
}
