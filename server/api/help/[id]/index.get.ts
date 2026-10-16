// GET /api/help/:slug?alsNiveau=: één artikel met inhoud, controlevragen, leestijd, gelezen en gerelateerde
// artikelen. Een eigen artikel van een andere organisatie bestaat voor jou niet (404, via RLS). Artikelen bij
// het verkoopverhaal tonen de inhoud uit het leesmodel van de eigen organisatie (F25). Hoort het artikel bij
// een functie die voor jou niet aanstaat, dan staat er "Deze functie hoort bij Gevorderd." (4.2). De beheerder
// bekijkt een artikel ook als Beginner, Gevorderd of Expert.
import { aanVanaf, beschikbaar, FUNCTIES } from '../../../../shared/functies'
import { leestijd, vulVerhaal } from '../../../../shared/help'
import { NIVEAU_LABEL, NIVEAUS, type Niveau } from '../../../../shared/types'
import { metOrganisatie } from '../../../utils/db'
import { gelezenDoor, leesArtikelen } from '../../../utils/help'
import { vereisOrganisatie } from '../../../utils/sessie'
import { leesStand } from '../../../utils/vvProjectie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  const slug = getRouterParam(event, 'id') ?? ''
  const q = getQuery(event)
  const alsNiveau = ctx.gebruiker.rol === 'beheerder' && NIVEAUS.includes(q.alsNiveau as Niveau) ? q.alsNiveau as Niveau : null
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const artikelen = await leesArtikelen(tx, { metConcepten: ctx.gebruiker.rol === 'beheerder' })
    // Een eigen artikel gaat voor een platformartikel met dezelfde slug.
    const a = artikelen.find((x) => x.slug === slug && x.organisationId) ?? artikelen.find((x) => x.slug === slug || x.id === slug)
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Artikel onbekend' })
    const gelezen = await gelezenDoor(tx, ctx.gebruiker.id)
    const gerelateerd = artikelen.filter((x) => x.id !== a.id && x.categorie === a.categorie && x.collectie === a.collectie && x.status === 'gepubliceerd').slice(0, 3).map((x) => ({ slug: x.slug, titel: x.titel }))
    let inhoud = a.inhoud
    if (inhoud.includes('{{verhaal:')) {
      const vv = await leesStand(tx)
      const t = (sleutel: string) => (vv.teksten ?? []).find((x) => x.sleutel === sleutel && !x.brancheId)
      const leeg = !(vv.teksten ?? []).length && !(vv.winpunten ?? []).length
      inhoud = vulVerhaal(inhoud, leeg ? null : {
        kernzin: t('bedrijfsverhaal')?.kernzin ?? t('kernzin')?.tekst ?? null, kernbelofte: t('kernbelofte')?.tekst ?? null,
        winpunten: (vv.winpunten ?? []).filter((w) => w.actief).map((w) => ({ titel: w.titel, omschrijving: w.omschrijving })),
        concurrenten: (vv.concurrenten ?? []).map((c) => ({ naam: c.naam, alsDeKlantZegt: c.alsDeKlantZegt ?? null })),
        terugkomregels: vv.terugkomregels.map((r) => ({ reden: r.reden, termijn: r.termijn, kanaal: r.kanaal })), branches: vv.branches ?? [],
      })
    }
    // Functie die (voor dit niveau) niet aanstaat: een rustige regel, zonder verzoekknop.
    const gebruiker = alsNiveau ? { ...ctx.gebruiker, niveau: alsNiveau } : ctx.gebruiker
    const functies = FUNCTIES.filter((f) => f.helpartikel === a.slug && (f.rollen === 'iedereen' || f.rollen.includes(gebruiker.rol as any)))
    let nietAan: string | null = null
    if (functies.length && !functies.some((f) => beschikbaar(f.sleutel, gebruiker as any, ctx.organisatie, ctx.stand).ok)) {
      const vanaf = functies.map((f) => aanVanaf(f.sleutel, ctx.organisatie, ctx.stand)).filter(Boolean).sort((x, y) => NIVEAUS.indexOf(x!) - NIVEAUS.indexOf(y!))[0]
      nietAan = vanaf ? `Deze functie hoort bij ${NIVEAU_LABEL[vanaf]}.` : 'Deze functie zit niet in jullie pakket.'
    }
    return { ...a, inhoud, leestijd: leestijd(inhoud), gelezen: gelezen.has(a.id), gerelateerd, nietAan, alsNiveau }
  })
})
