// Proefdraai van een agent-prompt (P24): het slot met voorbeelddata uit de startset Voltvast, via de provider
// van het platform (lokaal de mock). Telt in de credits van de systeemorganisatie, wordt nooit een concept.
import type { JsonSchema } from '../../shared/aiStap'
import type { AiSoort } from '../../shared/credits'
import { PROMPT_SLOTS, promptKeten, type PromptSlot } from '../../shared/platform'
import { voerAiStapMetCredits } from './llm-provider'

const WINPUNT = { id: 'wp-01', titel: 'Gratis projectschouw binnen 48 uur', omschrijving: 'Binnen 48 uur op de bouw, daarna levering per bouwfase.', bewijs: 'Monteurs bij Testbrontsma wachtten 30 procent minder op materiaal.' }
export const VOORBEELDEN: Record<PromptSlot, unknown> = {
  belscript: { blokken: [{ id: 'b1', soort: 'aanleiding' }, { id: 'b2', soort: 'winpunt' }], winpunt: WINPUNT, inzichten: [{ titel: 'Vacature servicemonteur', datum: '2026-10-12' }] },
  mailconcept: { type: 'mail', pitstop: true, winpunt: WINPUNT, aanleiding: 'Testbrontsma zoekt een servicemonteur' },
  linkedin: { type: 'linkedin', pitstop: true, winpunt: WINPUNT, aanleiding: 'Testbrontsma zoekt een servicemonteur' },
  briefing: { account: { naam: 'Testbrontsma Installatietechniek', branche: 'Installatiebedrijven woningbouw' }, contacten: [{ naam: 'Hilde Testbrontsma', rol: 'beslisser' }] },
  beoordelingsvraag: { inzicht: { titel: 'Vacature servicemonteur', bron: 'Website' } },
  verbetervoorstel: { verbetervoorstel: true, reis: 'Standaardreis', fases: [{ fase: 'Benaderd', conversie: 0.12 }] },
  coachvoorstel: { kpi: { pogingen: 120, gesprekken: 30, afspraken: 3 }, artikelen: ['een-goede-overdracht'] },
  helpvraag: { vraag: 'Hoe draag ik een account over aan DealDrive?', artikelen: ['een-goede-overdracht'] },
}
const SCHEMA: JsonSchema = { type: 'object' }

export async function proefdraai(slot: PromptSlot, tekst: string, door: string) {
  const def = PROMPT_SLOTS.find((s) => s.slot === slot)!
  const prompt = promptKeten({ platform: tekst, code: '' })
  const r = await voerAiStapMetCredits<unknown>(SYSTEEM, { soort: def.soort as AiSoort, agent: 'proefdraai', prompt, schema: SCHEMA, materiaal: VOORBEELDEN[slot], zonderKeten: true }, { gebruikerId: door })
  return { ok: r.ok, antwoord: r.ok ? r.waarde : null, fouten: r.ok ? [] : [r.reden], prompt }
}
const SYSTEEM = 'org-dealtrace'
