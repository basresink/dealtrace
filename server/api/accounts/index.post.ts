// POST /api/accounts: nieuwe prospect met dubbelcheck (409 met de match bij een
// zeker duplicaat) en een berekende score (geen vaste 50, gat 25). De matrixvelden (branche uit het
// verkoopverhaal, aantal medewerkers, klasse, huidige leverancier) en de regio uit postcode of plaats
// gaan mee in de instap, zodat doelgroep, reis, ritme en planning meteen kloppen. Zonder gekozen
// klasse volgt de klasse uit het aantal medewerkers. Ook e-mail en KvK-nummer gaan mee, en eigen velden die
// bij aanmaken verplicht zijn moeten gevuld zijn (400).
import { normaliseerDomein, zoekDuplicaat } from '../../../shared/ontdubbelen'
import { websiteUitEmail } from '../../../shared/logo'
import { schrijfAudit } from '../../utils/audit'
import { effectiefNiveau, eigenVeldenVoor, herbereken } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { alsDoelgroepAccount, alsHttpFout, instapVelden, laadInstapContext, schrijfInstap } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'
import { pasEigenVeldenToe } from '../../utils/velden'
import { controleerVerplichteVelden, leesBasisVelden, leesMatrixVelden, regioEnPunt, zetPunt } from '../../utils/nieuweProspect'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.nieuw')
  const b = await readBody<{ naam?: string; plaats?: string; postcode?: string; adres?: string; telefoon?: string; website?: string; linkedin?: string; kvk?: string; klasse?: string; email?: string; contactEmail?: string; customFields?: Record<string, unknown>; negeerMogelijk?: boolean }>(event)
  // Website uit de invoer, anders uit het e-maildomein (bedrijf of contact); het logo volgt uit het domein.
  if (!b.website?.trim()) b.website = websiteUitEmail(b.email, b.contactEmail) ?? undefined
  const naam = b.naam?.trim()
  if (!naam) throw createError({ statusCode: 400, statusMessage: 'Bedrijfsnaam is verplicht' })
  const basis = leesBasisVelden(b)
  const telefoon = basis.telefoon ?? undefined
  if (b.postcode && !/^\d{4}\s?[A-Za-z]{2}$/.test(b.postcode.trim())) throw createError({ statusCode: 400, statusMessage: 'Postcode is vier cijfers en twee letters' })
  const domein = normaliseerDomein(b.website)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const bestand = await tx.select({ id: schema.accounts.id, name: schema.accounts.name, kvk: schema.accounts.kvk, domein: schema.accounts.domein, city: schema.accounts.city }).from(schema.accounts)
    // B12: de plaats gaat mee; een andere plaats of een ander getal in de naam is hooguit mogelijk dubbel.
    const d = zoekDuplicaat({ name: naam, kvk: basis.kvk, domein, city: b.plaats?.trim() || null }, bestand)
    if (d.soort === 'zeker') throw createError({ statusCode: 409, statusMessage: `Bedoel je ${d.match!.name}${d.match!.city ? ` in ${d.match!.city}` : ''}? Al in je bestand.`, data: d })
    const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
    const herkomst: Record<string, any> = {}
    const op = new Date().toISOString()
    for (const k of ['naam', 'plaats', 'telefoon', 'website', 'email', 'kvk', 'postcode']) if ((b as any)[k]) herkomst[k] = { bron: 'hand', op, door: ctx.gebruiker.id }
    controleerVerplichteVelden(velden, b.customFields)
    const customFields = pasEigenVeldenToe({}, b.customFields, velden, { rol: ctx.gebruiker.rol, eigenaar: true }, herkomst, ctx.gebruiker.id)
    const m = await leesMatrixVelden(tx, ctx, b)
    if (m.medewerkers !== null) herkomst.medewerkers = { bron: 'hand', op, door: ctx.gebruiker.id }
    if (m.vvBrancheId) herkomst.branche = { bron: 'hand', op, door: ctx.gebruiker.id }
    if (m.huidigeLeverancierId) herkomst.huidigeLeverancier = { bron: 'hand', op, door: ctx.gebruiker.id }
    if (m.klasse) herkomst.klasse = m.klasseBron === 'hand' ? { bron: 'hand', op, door: ctx.gebruiker.id } : { bron: 'voorstel uit medewerkers', op }
    const city = b.plaats?.trim() || null
    const postcode = b.postcode?.trim().toUpperCase() || null
    const { gebiedId, punt } = await regioEnPunt(tx, { postcode, plaats: city })
    const id = crypto.randomUUID()
    const rij = {
      id, organisationId: ctx.organisatie.id, name: naam, accountKind: 'prospect', nbStatus: 'nieuw', ownerId: ctx.gebruiker.id,
      klasse: m.klasse, city, postcode, gebiedId, vvBrancheId: m.vvBrancheId, huidigeLeverancierId: m.huidigeLeverancierId,
      kvk: basis.kvk, domein, nbBron: 'hand',
      data: { telefoon, email: basis.email ?? undefined, website: b.website?.trim() || undefined, linkedin: b.linkedin?.trim() || undefined, adres: b.adres?.trim() || undefined, medewerkers: m.medewerkers ?? undefined, customFields, herkomst },
    }
    // Instap in de reis (F05): kiesReis op doelgroep (met branche, klasse, omvang en regio), anders de standaardreis; fase Gevonden.
    let iv: ReturnType<typeof instapVelden>
    try { iv = instapVelden(await laadInstapContext(tx), alsDoelgroepAccount(rij), 'lead-overgenomen') } catch (e) { alsHttpFout(e) }
    await tx.insert(schema.accounts).values({ ...rij, reisId: iv.reisId, faseId: iv.faseId, doelgroepId: iv.doelgroepId, faseSinds: op })
    await zetPunt(tx, id, punt)
    await schrijfInstap(tx, ctx.organisatie.id, [{ accountId: id, reisId: iv.reisId, faseId: iv.faseId, versie: iv.versie }], 'lead-overgenomen', ctx.gebruiker.id)
    const s = await herbereken(tx, id)
    await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'account.aanmaken', resourceType: 'accounts', resourceId: id, changes: { naam } })
    return { id, naam, score: s?.score ?? 0, klasse: m.klasse, gebiedId, doelgroepId: iv.doelgroepId, reisId: iv.reisId, mogelijkDuplicaat: d.soort === 'mogelijk' ? d.match : null }
  })
})
