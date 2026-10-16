// PUT /api/accounts/:id: patch; null wist (gat 10). Eigenaar alleen salesmanager en
// beheerder, klasse vanaf Gevorderd. account_kind en status klant zijn niet te zetten (B17).
// Een nieuw aantal medewerkers leidt de klasse opnieuw af, tenzij die met de hand gekozen is
// (herkomst klasse "hand"); daarna draait de motor voor dit account (nieuw interval).
import { geocodeerOntbrekend, wijsRegiosToe } from '../../../utils/bezoeken'
import { eq } from 'drizzle-orm'
import { normaliseerTelefoon } from '../../../../shared/contactgegevens'
import { normaliseerDomein } from '../../../../shared/ontdubbelen'
import { schrijfAudit } from '../../../utils/audit'
import { effectiefNiveau, eigenVeldenVoor, herbereken, kan } from '../../../utils/accounts'
import { metOrganisatie, schema } from '../../../utils/db'
import { klassenVan } from '../../../utils/leads'
import { draaiMotor } from '../../../utils/motor'
import { klasseNaOmvangWijziging, klasseVoorOmvang, omvangVan } from '../../../../shared/ritmematrix'
import { vereisFunctie, weigerFunctie } from '../../../utils/sessie'
import { pasDataToe, pasEigenVeldenToe } from '../../../utils/velden'

const DATA_VELDEN = ['website', 'telefoon', 'email', 'linkedin', 'adres', 'branche', 'land', 'medewerkers', 'logoUrl', 'logoUit', 'instagram', 'facebook', 'officieleNaam']

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'prospects.kaart')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<Record<string, any>>(event)
  if ('accountKind' in b || 'soort' in b || b.status === 'klant') throw createError({ statusCode: 400, statusMessage: 'Dealtrace maakt geen klant van een prospect; dat gebeurt in DealDrive of je CRM' })
  if (['faseId', 'fase_id', 'reisId', 'reis_id', 'status', 'nbStatus', 'nb_status', 'terugOp'].some((k) => k in b)) {
    throw createError({ statusCode: 400, statusMessage: 'Fase en status veranderen alleen via het meldpunt (Kwalificeer, Fase corrigeren, Zet nee)' })
  }
  if ('klasse' in b && !kan(ctx, 'prospects.klasseZetten')) weigerFunctie('prospects.klasseZetten', 'niveau')
  if ('huidigeLeverancierId' in b && !kan(ctx, 'account.huidigeLeverancier')) weigerFunctie('account.huidigeLeverancier', 'niveau')
  if ('eigenaarId' in b && !kan(ctx, 'prospects.eigenaarWijzigen')) throw createError({ statusCode: 403, statusMessage: 'Alleen een salesmanager of beheerder wijzigt de eigenaar' })
  if (b.telefoon) {
    const t = normaliseerTelefoon(b.telefoon)
    if (!t.ok) throw createError({ statusCode: 400, statusMessage: t.fout })
    b.telefoon = t.e164
  }
  // Logo (opzet uit DealDrive): een eigen logo-URL is een webadres; logoUit zet het automatische logo uit.
  if (b.logoUrl && !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(String(b.logoUrl).trim())) throw createError({ statusCode: 400, statusMessage: 'Een logo-URL begint met http:// of https://' })
  if ('logoUit' in b) b.logoUit = b.logoUit ? true : null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const [a] = await tx.select().from(schema.accounts).where(eq(schema.accounts.id, id))
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Account onbekend' })
    const set: Partial<typeof schema.accounts.$inferInsert> = { updatedAt: new Date().toISOString() }
    if ('naam' in b) { if (!String(b.naam ?? '').trim()) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' }); set.name = String(b.naam).trim() }
    if ('plaats' in b) set.city = b.plaats || null
    if ('postcode' in b) set.postcode = b.postcode || null
    if ('kvk' in b) set.kvk = b.kvk ? String(b.kvk).replace(/\D/g, '') : null
    if ('website' in b) set.domein = normaliseerDomein(b.website)
    if ('klasse' in b) set.klasse = b.klasse || null
    if ('eigenaarId' in b) set.ownerId = b.eigenaarId || null
    if ('huidigeLeverancierId' in b) set.huidigeLeverancierId = b.huidigeLeverancierId || null
    const data = pasDataToe({ ...(a.data ?? {}) }, b, DATA_VELDEN, ctx.gebruiker.id)
    if (b.customFields) {
      const velden = await eigenVeldenVoor(tx, 'account', effectiefNiveau(ctx))
      data.customFields = pasEigenVeldenToe(a.data?.customFields, b.customFields, velden, { rol: ctx.gebruiker.rol, eigenaar: a.ownerId === ctx.gebruiker.id }, data.herkomst, ctx.gebruiker.id)
    }
    // Klasse en herkomst (B01): met de hand gekozen blijft staan; anders volgt de klasse de omvang.
    const op = new Date().toISOString()
    const herkomstKlasse = (a.data as any)?.herkomst?.klasse as { bron?: string } | undefined
    let klasseAfgeleid = false
    if ('klasse' in b) {
      if (b.klasse) data.herkomst = { ...data.herkomst, klasse: { bron: 'hand', op, door: ctx.gebruiker.id } }
      else { const { klasse: _weg, ...rest } = data.herkomst ?? {}; data.herkomst = rest }
    } else if (a.accountKind === 'prospect' && ('medewerkers' in b || b.customFields)) {
      const oudeOmvang = omvangVan(a.data as any)
      const nieuweOmvang = omvangVan(data)
      if (nieuweOmvang !== oudeOmvang) {
        const klassen = (await klassenVan(tx)).filter((k) => k.tabblad !== 'Klanten')
        const r = klasseNaOmvangWijziging({ klasse: a.klasse, bron: herkomstKlasse?.bron, oudeOmvang }, nieuweOmvang, klassen)
        if (r) {
          set.klasse = r.klasse
          data.herkomst = { ...data.herkomst, klasse: { bron: 'voorstel uit medewerkers', op } }
          klasseAfgeleid = true
        } else if (!herkomstKlasse && a.klasse) {
          // Nog geen herkomst: leg vast of de klasse bij de omvang past of bewust anders gekozen is.
          const past = a.klasse === klasseVoorOmvang(nieuweOmvang, klassen.length ? klassen : undefined)
          data.herkomst = { ...data.herkomst, klasse: past ? { bron: 'voorstel uit medewerkers', op } : { bron: 'hand', op } }
        }
      }
    }
    set.data = data
    // P14: een nieuw adres krijgt een nieuw punt en een nieuwe regio (terugval op postcode of plaats).
    const adresAnders = ('plaats' in b && (b.plaats || null) !== a.city) || ('postcode' in b && (b.postcode || null) !== a.postcode) || ('adres' in b && b.adres !== (a.data as any)?.adres)
    if (adresAnders) { set.lat = null; set.lng = null }
    await tx.update(schema.accounts).set(set).where(eq(schema.accounts.id, id))
    if (adresAnders) { await geocodeerOntbrekend(tx); await wijsRegiosToe(tx) }
    await herbereken(tx, id)
    if ('eigenaarId' in b || 'klasse' in b) {
      await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'eigenaarId' in b ? 'account.eigenaar' : 'account.klasse', resourceType: 'accounts', resourceId: id, changes: { eigenaarId: b.eigenaarId, klasse: b.klasse } })
    }
    if (klasseAfgeleid) {
      await schrijfAudit(tx, { organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'account.klasse', resourceType: 'accounts', resourceId: id, changes: { van: a.klasse, klasse: set.klasse, bron: 'voorstel uit medewerkers' } })
    }
    // Een nieuwe klasse geeft een nieuw interval: de motor draait meteen voor dit account.
    if (klasseAfgeleid || ('klasse' in b && (b.klasse || null) !== a.klasse)) await draaiMotor(tx, ctx.organisatie.id, { soort: 'gebeurtenis', door: ctx.gebruiker.id, accountIds: [id] })
    return { ok: true, klasse: set.klasse !== undefined ? set.klasse : a.klasse }
  })
})
