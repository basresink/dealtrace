// GET /api/accounts/:id: de accountkaart. Eigen velden alleen voor het eigen niveau
// (ook niet in de respons, F19); de scoreopbouw alleen voor Expert.
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { ontbrekendeRollen, primairContact, sorteerContacten } from '../../../../shared/contactgegevens'
import { telOpenTaken } from '../../../../shared/score'
import { contactUit, effectiefNiveau, eigenVeldenVoor, kan, zichtbareCustomFields } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { eigenTeams } from '../../../utils/gebruikers'
import { fase as zoekFase, verblijfOverschreden } from '../../../../shared/reis'
import { afkoelingTot, KANALEN, magBenaderen } from '../../../../shared/nbStatus'
import { terugkomTekst } from '../../../../shared/verkoopverhaal'
import { terugkomControleLui, verkoopverhaal } from '../../../utils/reis'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    await terugkomControleLui(tx, ctx.organisatie.id)
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const niveau = effectiefNiveau(ctx)
    const velden = await eigenVeldenVoor(tx, 'account', niveau)
    const contactVelden = await eigenVeldenVoor(tx, 'contact', niveau)
    const contacten = sorteerContacten((await tx.select().from(schema.contacts).where(eq(schema.contacts.accountId, id))).map((c) => contactUit(c, contactVelden)))
    const acts = await tx.select().from(schema.activiteiten).where(inArray(schema.activiteiten.accountId, [id, ...(a.data?.samengevoegdUit ?? [])])).orderBy(desc(schema.activiteiten.op)).limit(100)
    const gebruikers = await tx.select({ id: schema.users.id, naam: schema.users.name, rol: schema.users.role, teamId: schema.users.teamId, status: schema.users.status }).from(schema.users)
    const namen = new Map(gebruikers.map((u) => [u.id, u.naam]))
    const [klasseRij] = await tx.select().from(schema.orgSettings).where(eq(schema.orgSettings.key, 'klassen'))
    const eigenaarTeam = gebruikers.find((u) => u.id === a.ownerId)?.teamId
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    const magVerwijderen = kan(ctx, 'prospects.verwijderen') && (ctx.gebruiker.rol === 'beheerder' || (!!eigenaarTeam && teams.includes(eigenaarTeam)) || a.ownerId === ctx.gebruiker.id)
    const primair = primairContact(contacten)
    const fase = a.faseSinds ? Math.floor((Date.now() - Date.parse(a.faseSinds)) / 864e5) : null
    // P05: reis, fase, status, dagen in fase en een lopende terugkomregel.
    const reizen = await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, data: schema.reistemplates.data, status: schema.reistemplates.status, isStandaard: schema.reistemplates.isStandaard }).from(schema.reistemplates)
    const reis = reizen.find((r) => r.id === a.reisId)
    const f = reis ? zoekFase(reis.data, a.faseId) : undefined
    const nu = new Date()
    const vv = a.accountKind === 'prospect' ? await verkoopverhaal(tx) : null
    // Een verwijzing naar iets dat uit SalesDNA verdween, blijft op id staan met een label (P29).
    const weg: { branche?: any; leverancier?: any } = {}
    if (a.vvBrancheId && !(vv?.branches ?? []).some((b) => b.id === a.vvBrancheId)) {
      const [r] = (await tx.execute(sql`select extern_id, naam, bron from vv_branches where extern_id = ${a.vvBrancheId} and not actief`)).rows as any[]
      if (r) weg.branche = { id: r.extern_id, naam: r.naam, verwijderd: r.bron === 'salesdna' ? 'Verwijderd uit SalesDNA' : 'Niet meer actief' }
    }
    if (a.huidigeLeverancierId && !((vv?.concurrenten ?? []) as any[]).some((c) => c.id === a.huidigeLeverancierId)) {
      const [r] = (await tx.execute(sql`select extern_id, naam, bron from vv_concurrenten where extern_id = ${a.huidigeLeverancierId} and not actief`)).rows as any[]
      if (r) weg.leverancier = { id: r.extern_id, naam: r.naam, verwijderd: r.bron === 'salesdna' ? 'Verwijderd uit SalesDNA' : 'Niet meer actief' }
    }
    const regel = a.terugRegelId ? vv?.terugkomregels.find((r) => r.id === a.terugRegelId) ?? null : null
    const eigen = a.ownerId === ctx.gebruiker.id
    const manager = ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder'
    const reisInfo = reis ? {
      id: reis.id, naam: reis.naam,
      fase: f ? { id: f.id, label: f.label, kleur: f.kleur, hoofdfase: f.hoofdfase, accent: f.accent, verwachtVerblijfDagen: f.verwachtVerblijfDagen ?? null, eind: f.eind ?? null, overschreden: verblijfOverschreden(a, f, nu) } : null,
      fases: reis.data.fases.map((x) => ({ id: x.id, label: x.label, kleur: x.kleur, hoofdfase: x.hoofdfase })),
    } : null
    const terugkom = a.terugOp ? {
      datum: a.terugOp, reden: a.data?.terugkom?.reden ?? regel?.reden ?? null, aanpak: a.data?.terugkom?.aanpak ?? regel?.aanpak ?? null, kanaal: a.data?.terugkom?.kanaal ?? null,
      tekst: terugkomTekst(a.terugOp, { reden: a.data?.terugkom?.reden ?? regel?.reden ?? '', aanpak: a.data?.terugkom?.aanpak ?? regel?.aanpak ?? '' }),
    } : null
    const benaderen = Object.fromEntries(KANALEN.map((k) => [k, magBenaderen(a, k, nu)]))
    const momenten = acts.filter((x) => ['gebeld', 'mail', 'bericht', 'afspraak', 'bezoek'].includes(x.soort))
    const laatste = (s: string[]) => momenten.find((m) => s.includes(m.soort))?.op ?? null
    // P17: de laatste overdracht en of er nu overgedragen kan worden.
    const [ov] = (await tx.execute(sql`select o.*, u.name as door_naam from overdrachten o left join users u on u.id = o.door where o.account_id = ${a.id} order by o.op desc limit 1`)).rows as any[]
    const [afv] = (await tx.execute(sql`select 1 from appointments where account_id = ${a.id} and status = 'afgerond' and coalesce((data->>'overdragen')::boolean, false) limit 1`)).rows as any[]
    const overdracht = ov ? { id: ov.id, naar: ov.naar, status: ov.status, op: new Date(ov.op).toISOString(), door: String(ov.door_naam ?? '').replace(/^Testgebruiker /, ''), externUrl: ov.extern_url, laatsteFout: ov.laatste_fout, alKlant: !!ov.data?.alKlant } : null
    // P19: wat de agents zagen (laatste inzichten op dit account) en de bronnen om te volgen.
    const agentInzichten = (await tx.execute(sql`select id, title, agent, type, bron, relevance_score, status, created_at, data->'bron' as bron_info from signals
      where account_id = ${a.id} and status in ('nieuw', 'gelezen', 'omgezet') and agent is not null order by created_at desc limit 5`)).rows.map((r: any) => ({
      id: r.id, title: r.title, agent: r.agent, type: r.type, bron: r.bron, relevantie: r.relevance_score, status: r.status, op: new Date(r.created_at).toISOString(), bronNaam: r.bron_info?.naam ?? null, url: r.bron_info?.url ?? null,
    }))
    return {
      id: a.id, naam: a.name, soort: a.accountKind, klasse: a.klasse, status: a.nbStatus, dagenInFase: fase, score: a.score,
      scoreOpbouw: kan(ctx, 'prospects.scoreOpbouw') ? a.data?.scoreOpbouw ?? null : null,
      eigenaar: a.ownerId ? { id: a.ownerId, naam: namen.get(a.ownerId) ?? null } : null,
      plaats: a.city, postcode: a.postcode, kvk: a.kvk, domein: a.domein, laatsteContactOp: a.laatsteContactOp,
      website: a.data?.website ?? null, telefoon: a.data?.telefoon ?? null, email: a.data?.email ?? null, linkedin: a.data?.linkedin ?? null,
      adres: a.data?.adres ?? null, branche: a.data?.branche ?? null, land: a.data?.land ?? 'NL', medewerkers: a.data?.medewerkers ?? null,
      aanleiding: a.data?.aanleiding ?? null, dossier: a.data?.dossier ?? null, band: a.data?.band ?? {},
      // P20: het extern id uit het CRM; de link alleen met een echte koppeling (de mock heeft geen portaal).
      crm: (a.data as any)?.extern?.hubspot?.id ? { label: 'HubSpot', id: (a.data as any).extern.hubspot.id, url: `https://app.hubspot.com/contacts/${process.env.HUBSPOT_PORTAAL ?? '0'}/company/${(a.data as any).extern.hubspot.id}` } : null,
      agentInzichten, volgBronnen: kan(ctx, 'account.bronnenVolgen') ? (a.data as any)?.volgBronnen ?? [] : [],
      herkomst: niveau === 'expert' ? a.data?.herkomst ?? {} : {},
      customFields: zichtbareCustomFields(a.data?.customFields, velden),
      eigenVelden: velden.map((v) => ({ id: v.id, sleutel: v.sleutel, naam: v.naam, type: v.type, sectie: v.sectie, opties: v.data.opties ?? [], hulp: v.data.hulp ?? null, bewerkbaarDoor: v.data.bewerkbaarDoor ?? 'iedereen' })),
      contacten, primairContactId: primair?.id ?? null, ontbrekendeRollen: ontbrekendeRollen(contacten),
      stuur: { laatsteActie: acts[0]?.op ?? null, laatsteCall: laatste(['gebeld']), laatsteBezoek: laatste(['bezoek', 'afspraak']) },
      openTaken: telOpenTaken([], { accountId: id }),
      tijdlijn: acts.map((x) => ({ id: x.id, soort: x.soort, kanaal: x.kanaal, uitkomst: x.uitkomst, op: x.op, door: x.door ? namen.get(x.door) ?? x.door : null, tekst: (x.data as any)?.tekst ?? null, contactId: x.contactId })),
      overdracht, kanOverdragen: !!afv && a.nbStatus !== 'overgedragen' && (!ov || ov.status === 'mislukt' || !!ov.data?.alKlant),
      reis: reisInfo, terugkom, nee: a.data?.nee ? { ...a.data.nee, tot: Object.fromEntries(KANALEN.map((k) => [k, afkoelingTot(a.data!.nee, k)])) } : null, wachtendTot: a.data?.wachtendTot ?? null, benaderen,
      reizen: kan(ctx, 'reis.verplaatsen') ? reizen.filter((r) => r.status === 'actief' && r.id !== a.reisId).map((r) => ({ id: r.id, naam: r.naam })) : [],
      concurrenten: vv?.concurrenten ?? [],
      // Verkoopverhaal op de kaart (P28): branche uit het verhaal en de huidige leverancier.
      vvBranche: a.vvBrancheId ? (vv?.branches ?? []).find((b) => b.id === a.vvBrancheId) ?? weg.branche ?? { id: a.vvBrancheId, naam: a.vvBrancheId } : null,
      huidigeLeverancier: a.huidigeLeverancierId ? ((vv?.concurrenten ?? []) as any[]).find((c) => c.id === a.huidigeLeverancierId) ?? weg.leverancier ?? { id: a.huidigeLeverancierId, naam: 'Onbekende leverancier' } : null,
      kanLeverancier: kan(ctx, 'account.huidigeLeverancier'),
      klassen: ((klasseRij?.value as any[]) ?? []).filter((k) => !k.tabblad || k.tabblad === (a.accountKind === 'klant' ? 'Klanten' : 'Prospects')),
      gebruikers: gebruikers.filter((u) => u.status !== 'gearchiveerd').map((u) => ({ id: u.id, naam: u.naam })),
      kan: {
        klasse: kan(ctx, 'prospects.klasseZetten'), eigenaar: kan(ctx, 'prospects.eigenaarWijzigen'), verwijderen: magVerwijderen,
        samenvoegen: kan(ctx, 'prospects.samenvoegen'), scoreOpbouw: kan(ctx, 'prospects.scoreOpbouw'), voorstellen: kan(ctx, 'eigenVelden.voorstellen'),
        verhuizen: kan(ctx, 'contacten.verhuizen'),
        reis: kan(ctx, 'reis.zien') && a.accountKind === 'prospect',
        kwalificeer: kan(ctx, 'reis.kwalificeer') && a.nbStatus === 'nieuw' && ['gevonden', 'dossier-compleet'].includes(a.faseId ?? ''),
        faseCorrigeren: kan(ctx, 'reis.faseCorrigeren') && a.accountKind === 'prospect',
        geschiedenis: kan(ctx, 'reis.geschiedenis'),
        reisBekijken: kan(ctx, 'reis.overzicht'),
        nee: kan(ctx, 'account.nee') && ['nieuw', 'in reis', 'wachtend', 'gescoord'].includes(a.nbStatus),
        pauzeer: kan(ctx, 'account.nee') && ['nieuw', 'in reis'].includes(a.nbStatus),
        verplaatsen: kan(ctx, 'reis.verplaatsen') && (eigen || manager) && a.accountKind === 'prospect',
        terugOp: kan(ctx, 'account.terugOpAanpassen') && !!a.terugOp,
        onderzoek: kan(ctx, 'account.opnieuwOnderzoeken'), bronnenVolgen: kan(ctx, 'account.bronnenVolgen'),
      },
    }
  })
})
