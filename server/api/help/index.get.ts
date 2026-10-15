// GET /api/help?zoek=&collectie=&niveau=: artikelen met gelezen-vinkje, "Voor jou" en
// zoeken (accent- en hoofdletterongevoelig). Een zoekterm wordt bewaard.
import { voorJou } from '../../../shared/help'
import { metOrganisatie, schema } from '../../utils/db'
import { kan } from '../../utils/accounts'
import { werkFunctiesGezienBij } from '../../utils/functiesGezien'
import { gelezenDoor, leesArtikelen, zoek } from '../../utils/help'
import { vereisOrganisatie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const q = getQuery(event)
  const term = typeof q.zoek === 'string' ? q.zoek.trim().slice(0, 100) : ''
  const beheer = kan(ctx, 'help.verbergen')
  const f = ctx.werkIn ? { nieuw: [] as string[] } : await werkFunctiesGezienBij(ctx.gebruiker, ctx.organisatie, ctx.stand)
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    let artikelen = await leesArtikelen(tx, { metVerborgen: beheer })
    const gelezen = await gelezenDoor(tx, ctx.gebruiker.id)
    // Inrichten alleen voor de beheerder, Voor de salesmanager alleen voor de salesmanager.
    artikelen = artikelen.filter((a) => (a.categorie !== 'Inrichten' || ctx.gebruiker.rol === 'beheerder') && (a.categorie !== 'Voor de salesmanager' || ctx.gebruiker.rol === 'salesmanager' || ctx.gebruiker.rol === 'beheerder'))
    if (typeof q.collectie === 'string' && q.collectie) artikelen = artikelen.filter((a) => a.collectie === q.collectie)
    if (typeof q.niveau === 'string' && q.niveau) artikelen = artikelen.filter((a) => a.niveau === q.niveau)
    let resultaten: typeof artikelen | null = null
    if (term) {
      const ids = await zoek(tx, term)
      const per = new Map(artikelen.map((a) => [a.id, a]))
      resultaten = ids.map((id) => per.get(id)).filter((a): a is (typeof artikelen)[number] => !!a)
      await tx.insert(schema.helpZoekopdrachten).values({ organisationId: ctx.organisatie.id, term, resultaten: resultaten.length })
    }
    const kort = (a: (typeof artikelen)[number]) => ({ id: a.id, slug: a.slug, titel: a.titel, categorie: a.categorie, collectie: a.collectie, samenvatting: a.samenvatting, niveau: a.niveau, routes: a.routes, gelezen: gelezen.has(a.id), verborgen: a.verborgen, bijgewerktOp: a.bijgewerktOp })
    const gelezenSlugs = new Set(artikelen.filter((a) => gelezen.has(a.id)).map((a) => a.slug))
    const vj = voorJou(f.nieuw, gelezenSlugs, artikelen.filter((a) => !a.verborgen))
    return {
      artikelen: artikelen.map(kort),
      resultaten: resultaten?.map(kort) ?? null,
      voorJou: { nieuw: vj.nieuw.map((a: any) => kort(a)), aanDeSlag: vj.aanDeSlag.map((a: any) => kort(a)), bijgewerkt: vj.bijgewerkt.map((a: any) => kort(a)) },
      kan: { verbergen: beheer },
    }
  })
})
