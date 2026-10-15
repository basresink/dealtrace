// GET /api/contacten?q&rol&soort&mijn&zonderEmail&zonderTelefoon&geenContact&sort: de contactlijst (F04).
import { eq, inArray } from 'drizzle-orm'
import { normaliseerNaam } from '../../../shared/ontdubbelen'
import { ROLLEN_CONTACT } from '../../../shared/contactgegevens'
import { contactUit, effectiefNiveau, eigenVeldenVoor, kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'contacten.basis')
  const q = getQuery(event) as Record<string, string>
  const filters = kan(ctx, 'contacten.filters')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const velden = await eigenVeldenVoor(tx, 'contact', effectiefNiveau(ctx))
    const accounts = await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, kind: schema.accounts.accountKind, owner: schema.accounts.ownerId, lc: schema.accounts.laatsteContactOp, score: schema.accounts.score }).from(schema.accounts)
    const acc = new Map(accounts.map((a) => [a.id, a]))
    let lijst = (await tx.select().from(schema.contacts)).map((c) => ({ ...contactUit(c, velden), bedrijf: acc.get(c.accountId)?.naam ?? '', soort: acc.get(c.accountId)?.kind, eigenaarId: acc.get(c.accountId)?.owner, laatsteContactOp: acc.get(c.accountId)?.lc ?? null, score: acc.get(c.accountId)?.score ?? 0 }))
    if (q.top === '1') lijst = lijst.filter((c) => c.status === 'actief' && ['beslisser', 'beinvloeder'].includes(c.rol) && c.eigenaarId === ctx.gebruiker.id).sort((a, b) => b.score - a.score).slice(0, 12)
    if (q.q) { const n = normaliseerNaam(q.q); lijst = lijst.filter((c) => normaliseerNaam(`${c.naam} ${c.functie ?? ''} ${c.bedrijf}`).includes(n)) }
    if (q.rol && (ROLLEN_CONTACT as readonly string[]).includes(q.rol)) lijst = lijst.filter((c) => c.rol === q.rol)
    if (q.soort === 'prospect' || q.soort === 'klant') lijst = lijst.filter((c) => c.soort === q.soort)
    if ((q.mijn ?? '1') === '1' && q.top !== '1') lijst = lijst.filter((c) => c.eigenaarId === ctx.gebruiker.id)
    if (filters) {
      if (q.zonderEmail === '1') lijst = lijst.filter((c) => !c.email)
      if (q.zonderTelefoon === '1') lijst = lijst.filter((c) => !c.telefoon && !c.mobiel)
      if (q.geenContact) { const d = Number(q.geenContact) * 864e5; lijst = lijst.filter((c) => !c.laatsteContactOp || Date.now() - Date.parse(c.laatsteContactOp) > d) }
    }
    const volgorde = ROLLEN_CONTACT as readonly string[]
    if (q.sort === 'bedrijf') lijst.sort((a, b) => a.bedrijf.localeCompare(b.bedrijf, 'nl'))
    else if (q.sort === 'laatsteContact') lijst.sort((a, b) => (b.laatsteContactOp ?? '').localeCompare(a.laatsteContactOp ?? ''))
    else lijst.sort((a, b) => volgorde.indexOf(a.rol) - volgorde.indexOf(b.rol) || a.naam.localeCompare(b.naam, 'nl'))
    return { contacten: lijst.slice(0, Number(q.limiet) || 200), aantal: lijst.length, kan: { filters } }
  })
})
void inArray; void eq
