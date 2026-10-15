// GET /api/leads/context: wat het tabblad Zoeken nodig heeft om een zoekopdracht samen te
// stellen: doelgroepen, branches met SBI uit het verkoopverhaal, zoeksjablonen, "Lijkt op mijn
// klanten" (alleen klanten), klassen, thuisbasis, bronnen met hun stand, team en reizen.
import { eq, ne } from 'drizzle-orm'
import { AFWIJSREDENEN, leidZoekopdrachtAf, zoeksjablonen } from '../../../shared/leadGenerator'
import { kan } from '../../utils/accounts'
import { creditsStandVoor } from '../../utils/agents/bewaker'
import { kvkStatus } from '../../utils/bronnen/kvk'
import { metOrganisatie, schema } from '../../utils/db'
import { klassenVan } from '../../utils/leads'
import { verkoopverhaal } from '../../utils/reis'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!kan(ctx, 'nav.leadgenerator') && !kan(ctx, 'leads.overnemen')) weigerFunctie('nav.leadgenerator', 'niveau')
  return metOrganisatie(ctx.organisatie!.id, async (tx) => {
    const vv = await verkoopverhaal(tx)
    const mapping = vv.brancheMapping ?? []
    const doelgroepen = (await tx.select().from(schema.doelgroepen).where(ne(schema.doelgroepen.status, 'gearchiveerd'))).map((d) => ({ id: d.id, naam: d.naam, data: d.data }))
    const accounts = await tx.select({ accountKind: schema.accounts.accountKind, postcode: schema.accounts.postcode, data: schema.accounts.data }).from(schema.accounts).where(eq(schema.accounts.accountKind, 'klant'))
    const kvk = await kvkStatus(tx, ctx.organisatie!.pakket)
    const credits = await creditsStandVoor(tx, ctx.organisatie!.id)
    const manager = ['salesmanager', 'beheerder', 'founder'].includes(ctx.gebruiker.rol)
    const team = manager ? (await tx.select({ id: schema.users.id, naam: schema.users.name, werkplek: schema.users.werkplek, rol: schema.users.role }).from(schema.users)).filter((u) => u.rol !== 'founder') : []
    const reizen = (await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, status: schema.reistemplates.status, isStandaard: schema.reistemplates.isStandaard }).from(schema.reistemplates)).filter((r) => r.status === 'actief')
    const aiAan = kan(ctx, 'leads.aiZoeker')
    return {
      doelgroepen, klassen: (await klassenVan(tx)).filter((k) => k.tabblad !== 'Klanten'),
      branches: (vv.branches ?? []).map((b) => ({ ...b, sbi: mapping.find((m) => m.brancheId === b.id)?.sbiCodes ?? [] })),
      sjablonen: zoeksjablonen(vv.concurrenten),
      lijktOpKlanten: leidZoekopdrachtAf(accounts.map((a) => ({ accountKind: a.accountKind, postcode: a.postcode, sbi: (a.data as any)?.sbi ?? [] }))),
      thuisbasis: (ctx.gebruiker.data as any)?.thuisbasis ?? null,
      bronnen: {
        kvk: { beschikbaar: kvk.gekoppeld && kan(ctx, 'leads.kvk'), reden: !kvk.gekoppeld ? (kvk.pakketPlafond ? 'KvK is nog niet gekoppeld' : 'Onderdeel van Plus') : !kan(ctx, 'leads.kvk') ? 'Nog niet aangezet' : null },
        ai: { beschikbaar: aiAan, reden: aiAan ? null : ctx.organisatie!.pakket !== 'compleet' ? 'Onderdeel van Compleet' : 'Nog niet aangezet' },
      },
      meters: { credits: credits.over, kvk: { gebruikt: kvk.gebruikt, plafond: kvk.plafond } },
      team, reizen, afwijsredenen: AFWIJSREDENEN, werkplek: ctx.gebruiker.werkplek, ik: ctx.gebruiker.id,
      kan: { ronde: kan(ctx, 'nav.leadgenerator'), overnemen: kan(ctx, 'leads.overnemen'), opslaan: kan(ctx, 'leads.opgeslagen'), automatisch: kan(ctx, 'leads.automatisch'), koppelen: kan(ctx, 'koppeling.kvk') },
    }
  })
})
