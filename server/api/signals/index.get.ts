// GET /api/signals: inzichten met filters (gelezen, bron, agent, periode of sinds, fase, soort account en
// teller). Tegengehouden inzichten staan hier niet in (P19); die komen uit /api/signals/tegengehouden.
// Elke rij draagt wat de kaart in de opzet van DealDrive toont: account met soort, bronlabel, tag en de
// AI-context (de commerciële duiding: winpunt, voorgestelde taak of de vaste duiding per soort).
import { and, eq, inArray } from 'drizzle-orm'
import { ACTIE_LABEL } from '../../../shared/taken'
import { metOrganisatie, schema } from '../../utils/db'
import { vereisFunctie } from '../../utils/sessie'

const AGENT_NAAM: Record<string, string> = { waarnemer: 'Waarnemer', verrijker: 'Verrijker', profielbouwer: 'Profielbouwer', notulist: 'Notulist', handmatig: 'Handmatig' }

/** De vaste duiding voor inzichten zonder voorstel of winpunt (vooral die van de motor). */
const DUIDING: Record<string, string> = {
  'te-lang-in-fase': 'Zet het account een stap verder of parkeer het met een terugkomdatum, zodat de reis blijft lopen.',
  kansanalyse: 'Kijk wat er sinds de vorige analyse veranderde en kies één volgende stap voor dit account.',
  koopsignaal: 'Je gesprekspartner noemde het zelf: maak het het eerste punt van je volgende gesprek.',
  'regel-voorstel': 'Een voorstel voor je regels: beoordeel het bij Instellingen en Regels.',
  'campagne-achterstand': 'Begin bij de accounts waar het het langst stil is; het bord rekent ze voor je uit.',
  website: 'Een wijziging op de site is een natuurlijke aanleiding om te bellen; vraag wat erachter zit.',
  nieuws: 'Feliciteer of reageer op het nieuws en vraag wat het betekent voor hun planning.',
  vacature: 'Groei in het team betekent meer werk tegelijk; vraag hoe ze dat nu organiseren.',
  kvk: 'Een wijziging in het register kan nieuwe beslissers of een nieuwe koers betekenen.',
  aanbesteding: 'Lees de eisen en kijk of je winpunt erop aansluit voor je contact opneemt.',
}

/** Bronnaam voor de kaart: de specifieke bron, anders de agent, anders CRM (intern) of Web (extern). */
function bronLabel(s: { specifiekeBron: string | null; agent: string | null; bron: string }) {
  return s.specifiekeBron ?? (s.agent ? AGENT_NAAM[s.agent] ?? s.agent : s.bron === 'extern' ? 'Web' : 'CRM')
}

function aiContext(s: { type: string; winpuntVoorstel: string | null; voorstel: { title: string; actionType?: string } | null }) {
  if (s.winpuntVoorstel) return `Winpunt: ${s.winpuntVoorstel}`
  if (s.voorstel?.title) return `Voorstel${s.voorstel.actionType && ACTIE_LABEL[s.voorstel.actionType] ? ` (${ACTIE_LABEL[s.voorstel.actionType]!.toLowerCase()})` : ''}: ${s.voorstel.title}`
  return DUIDING[s.type] ?? null
}

const DAG = 864e5
const SINDS: Record<string, number> = { vandaag: DAG, week: 7 * DAG, maand: 30 * DAG, kwartaal: 91 * DAG }

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'taken.basis')
  const q = getQuery(event) as Record<string, string | undefined>
  const nu = Date.now()
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const statussen = q.gelezen === 'alle' ? ['nieuw', 'gelezen'] : q.gelezen === 'gelezen' ? ['gelezen'] : ['nieuw']
    const rijen = await tx.select().from(schema.signals).where(and(eq(schema.signals.ownerId, ctx.gebruiker.id), inArray(schema.signals.status, ['nieuw', 'gelezen'])))
    const ids = [...new Set(rijen.map((s) => s.accountId).filter(Boolean))] as string[]
    const accounts = ids.length ? await tx.select({ id: schema.accounts.id, naam: schema.accounts.name, kind: schema.accounts.accountKind, faseId: schema.accounts.faseId, reisId: schema.accounts.reisId, klasse: schema.accounts.klasse }).from(schema.accounts).where(inArray(schema.accounts.id, ids)) : []
    const reizen = accounts.length ? await tx.select({ id: schema.reistemplates.id, data: schema.reistemplates.data }).from(schema.reistemplates) : []
    const faseLabel = (a?: typeof accounts[number]) => (a?.faseId ? reizen.find((r) => r.id === a.reisId)?.data.fases.find((f) => f.id === a.faseId)?.label ?? null : null)
    const per = new Map(accounts.map((a) => [a.id, a]))
    const alle = rijen.map((s) => {
      const d = (s.data ?? {}) as any
      const a = s.accountId ? per.get(s.accountId) : undefined
      const rij = {
        id: s.id, title: s.title, type: s.type, status: s.status, bron: s.bron, relevantie: s.relevanceScore, createdAt: s.createdAt, ruleId: s.ruleId,
        agent: s.agent ?? d.agent ?? null, evidence: d.evidence ?? [], zekerheid: d.zekerheid ?? (s.confidence != null ? Math.round(s.confidence * 100) : null),
        winpuntVoorstel: d.winpuntVoorstel ?? null, bronUrl: d.bron?.url ?? null, bronDatum: d.bron?.datum ?? null,
        specifiekeBron: d.bron?.naam ?? null, waarom: d.waarom ?? null, bewijs: d.bewijs ?? [], voorstel: d.voorstel ?? null,
        account: s.accountId ? { id: s.accountId, naam: a?.naam ?? null, soort: a?.kind ?? null, faseId: a?.faseId ?? null, fase: faseLabel(a) } : null,
        tag: s.type === 'agenda' ? 'agenda' : s.bron === 'extern' ? 'extern' : 'intern',
        bronLabel: '', context: null as string | null,
      }
      rij.bronLabel = bronLabel(rij)
      rij.context = aiContext(rij)
      return rij
    })
    const ouderdom = (s: { createdAt: string }) => nu - Date.parse(s.createdAt)
    // Alle filters behalve de teller: de tellers en de lijst vertellen zo dezelfde waarheid.
    let basis = alle.filter((s) => statussen.includes(s.status))
    // Prospects is een uitsluiting: inzichten bij klanten vallen weg, inzichten zonder account blijven staan.
    if (q.soort === 'prospect') basis = basis.filter((s) => s.account?.soort !== 'klant')
    if (q.soort === 'klant') basis = basis.filter((s) => s.account?.soort === 'klant')
    if (q.bron === 'intern' || q.bron === 'extern') basis = basis.filter((s) => s.bron === q.bron)
    const sinds = SINDS[q.sinds ?? ''] ?? (q.periode === 'week' ? SINDS.week : undefined)
    if (sinds) basis = basis.filter((s) => ouderdom(s) <= sinds)
    if (q.agent) basis = basis.filter((s) => (q.agent === 'motor' ? !s.agent : s.agent === q.agent))
    if (q.fase) basis = basis.filter((s) => s.account?.faseId === q.fase)
    basis.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const teller = { nieuw: (s: typeof alle[number]) => ouderdom(s) <= DAG, hot: (s: typeof alle[number]) => s.relevantie >= 75, week: (s: typeof alle[number]) => ouderdom(s) <= 7 * DAG }
    const lijst = q.teller && q.teller in teller ? basis.filter(teller[q.teller as keyof typeof teller]) : basis
    // De fases waarin je inzichten hebt, voor het filter.
    const fases = [...new Map(alle.filter((s) => s.account?.faseId && s.account.fase).map((s) => [s.account!.faseId!, { id: s.account!.faseId!, label: s.account!.fase! }])).values()].sort((a, b) => a.label.localeCompare(b.label, 'nl'))
    return {
      tellers: {
        nieuw: basis.filter(teller.nieuw).length,
        hot: basis.filter(teller.hot).length,
        week: basis.filter(teller.week).length,
        totaal: basis.length,
        open: alle.length,
      },
      fases,
      inzichten: lijst.slice(0, 200),
      // Een inzicht uit een link (?inzicht=), ook als het buiten de filters valt.
      uitgelicht: q.inzicht ? alle.find((s) => s.id === q.inzicht) ?? null : null,
    }
  })
})
