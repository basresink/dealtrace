// Rechten en invoercontrole voor regels (F15, 3.3). De editor is de enige bron:
// schoonRegel houdt precies de velden die de editor toont, geen veld valt weg (gat 7).
import { ACTIESOORTEN, CADANSEN, PATRONEN, PATROON_SLEUTELS, PRIORITEITEN, UITVOERDERROLLEN, valideerRegel, type Regel, type RegelData } from '../../shared/regelPatronen'
import { kan } from './accounts'
import type { Context } from './sessie'

type Ctx = Context & { organisatie: NonNullable<Context['organisatie']> }

const lijst = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String).filter(Boolean))] : [])

/** Maakt een regel uit invoer (editor of Excel), met de standaard waar een veld ontbreekt. */
export function schoonRegel(b: any, basis?: Partial<Regel>): Omit<Regel, 'id'> {
  const d = { ...(basis?.data ?? {}), ...(b?.data ?? {}) } as Partial<RegelData>
  const patroon = (PATROON_SLEUTELS as readonly string[]).includes(d.trigger?.patroon as string) ? d.trigger!.patroon : (basis?.data?.trigger.patroon ?? 'inactiviteit')
  const standaardParams = PATRONEN[patroon].parameters
  const params: Record<string, unknown> = {}
  for (const [k, w] of Object.entries(standaardParams)) params[k] = d.trigger?.parameters?.[k] ?? w
  const gevolg = { ...(basis?.data?.gevolg ?? {}), ...(d.gevolg ?? {}) } as any
  const regel: Omit<Regel, 'id'> = {
    code: b?.code ?? basis?.code ?? null,
    naam: String(b?.naam ?? basis?.naam ?? '').trim().slice(0, 120),
    categorie: String(b?.categorie ?? basis?.categorie ?? 'Bewerken').slice(0, 60),
    actief: b?.actief ?? basis?.actief ?? true,
    motor: b?.motor === 'ai' ? 'ai' : b?.motor === 'regel' ? 'regel' : basis?.motor ?? 'regel',
    scope: (['organisatie', 'team', 'persoonlijk'] as const).find((s) => s === b?.scope) ?? basis?.scope ?? 'organisatie',
    teamId: b?.teamId ?? basis?.teamId ?? null,
    eigenaarId: b?.eigenaarId ?? basis?.eigenaarId ?? null,
    reisId: b?.reisId ?? basis?.reisId ?? null,
    faseId: b?.faseId ?? basis?.faseId ?? null,
    cadansDagen: Number.isInteger(b?.cadansDagen) ? b.cadansDagen : basis?.cadansDagen ?? 7,
    prioriteit: (PRIORITEITEN as readonly string[]).includes(b?.prioriteit) ? b.prioriteit : basis?.prioriteit ?? 'middel',
    data: {
      subcategorie: String(d.subcategorie ?? '').slice(0, 60) || undefined,
      omschrijving: String(d.omschrijving ?? '').slice(0, 500),
      activiteit: d.activiteit === 'taak' ? 'taak' : 'inzicht',
      bron: d.bron === 'extern' ? 'extern' : 'intern',
      specifiekeBron: String(d.specifiekeBron ?? '').slice(0, 80) || undefined,
      trigger: { patroon, parameters: params },
      afbakening: {
        accounttypes: lijst(d.afbakening?.accounttypes).filter((x) => x === 'prospect' || x === 'klant') as any,
        statussen: lijst(d.afbakening?.statussen), reisIds: lijst(d.afbakening?.reisIds), faseIds: lijst(d.afbakening?.faseIds),
        doelgroepIds: lijst(d.afbakening?.doelgroepIds), campagneIds: lijst(d.afbakening?.campagneIds), klassen: lijst(d.afbakening?.klassen),
      },
      gevolg: {
        actiesoort: (ACTIESOORTEN as readonly string[]).includes(gevolg.actiesoort) ? gevolg.actiesoort : 'geen',
        uitvoerderrol: (UITVOERDERROLLEN as readonly string[]).includes(gevolg.uitvoerderrol) ? gevolg.uitvoerderrol : 'eigenaar',
        termijnWerkdagen: Number.isInteger(gevolg.termijnWerkdagen) ? Math.max(0, Math.min(30, gevolg.termijnWerkdagen)) : 3,
        taaksjabloon: String(gevolg.taaksjabloon ?? '').slice(0, 200),
        belscriptId: gevolg.belscriptId ?? null,
        automatischVoorbereiden: !!gevolg.automatischVoorbereiden,
        signaaltype: gevolg.signaaltype ?? null,
        verwachtResultaat: gevolg.verwachtResultaat ?? null,
      },
      herkomst: d.herkomst ?? basis?.data?.herkomst ?? 'eigen',
    },
  }
  if (!CADANSEN.some((c) => c.dagen === regel.cadansDagen)) regel.cadansDagen = 7
  return regel
}

export function regelFouten(r: Omit<Regel, 'id'>): string[] {
  return valideerRegel(r as Regel)
}

/** Velden die een salesmanager aan een organisatieregel mag wijzigen: aan/uit, cadans, drempels, klassen. */
const MANAGER_VELDEN = new Set(['actief', 'cadansDagen'])

/**
 * Mag deze gebruiker de regel (bestaand of nieuw) zo opslaan? Beheerder alles;
 * salesmanager teamregels van zijn teams en aan/uit, cadans, drempels en klassen van
 * organisatieregels; Expert alleen zijn eigen persoonlijke regels.
 */
export function magRegelSchrijven(ctx: Ctx, regel: Pick<Regel, 'scope' | 'teamId' | 'eigenaarId'>, teams: string[], patch?: any): { mag: boolean; reden?: string } {
  if (ctx.gebruiker.rol === 'beheerder') return { mag: true }
  if (ctx.gebruiker.rol === 'salesmanager') {
    if (regel.scope === 'team') return regel.teamId && teams.includes(regel.teamId) ? { mag: true } : { mag: false, reden: 'Alleen regels van je eigen teams' }
    if (regel.scope === 'persoonlijk') return { mag: false, reden: 'Persoonlijke regels zijn van de eigenaar' }
    if (!patch) return { mag: false, reden: 'Een organisatieregel maakt de beheerder' }
    const velden = Object.keys(patch).filter((k) => k !== 'versie')
    const dataVelden = Object.keys(patch.data ?? {})
    const ok = velden.every((k) => MANAGER_VELDEN.has(k) || k === 'data')
      && dataVelden.every((k) => k === 'trigger' || k === 'afbakening')
      && !patch.data?.trigger?.patroon
      && Object.keys(patch.data?.afbakening ?? {}).every((k) => k === 'klassen')
    return ok ? { mag: true } : { mag: false, reden: 'Je wijzigt bij organisatieregels alleen aan of uit, cadans, drempels en klassen' }
  }
  if (regel.scope === 'persoonlijk' && regel.eigenaarId === ctx.gebruiker.id && kan(ctx, 'regels.persoonlijk')) return { mag: true }
  return { mag: false, reden: regel.scope === 'persoonlijk' ? 'Alleen je eigen persoonlijke regels' : 'Een teamregel kun je alleen voorstellen' }
}

export function magRegelsLezen(ctx: Ctx): boolean {
  return kan(ctx, 'regels.lezen') || kan(ctx, 'regels.team') || kan(ctx, 'regels.beheer')
}
