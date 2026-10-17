// GET /api/instellingen/prompts: per slot de eigen laag (versies), de platformtekst, de standaard uit de code
// (de teksten die de stappen zelf meegeven) en welke laag nu geldt, plus het vaste kader. Alleen instructies,
// geen sleutels. Beheerder vanaf Plus (403 met reden pakket op Starter).
import { PROMPT_SLOTS, VAST_KADER, type PromptSlot } from '../../../../shared/platform'
import { PROMPT_BELSCRIPT_ACCOUNT, PROMPT_BELSCRIPT_PROSPECT, PROMPT_BUYING_COMMITTEE, PROMPT_CAMPAGNE_BOODSCHAP, PROMPT_REISVOORSTEL, PROMPT_VERBETERVOORSTEL, promptCoachpunten, promptSchrijver } from '../../../../shared/promptStandaard'
import { ASSISTENT_PROMPT } from '../../../utils/assistent'
import { vereisBeheerder } from '../../../utils/beheerder'
import { metOrganisatie } from '../../../utils/db'
import { promptversies } from '../../../utils/platformBeheer'

const ACCENT = '{fase-accent van het account}'
const SCHRIJVER_NOOT = ' Bij een stap uit een opvolgreeks komen de opdracht en het onderwerp van die stap erbij.'
/** Per slot de standaard uit de code, per plek waar een stap hem gebruikt. Een leeg slot heeft alleen het vaste kader. */
const CODE: Record<PromptSlot, { bij: string; tekst: string }[]> = {
  belscript: [
    { bij: 'Belscript invullen voor een account', tekst: PROMPT_BELSCRIPT_ACCOUNT },
    { bij: 'Belscript voor een prospect in de studio', tekst: PROMPT_BELSCRIPT_PROSPECT },
  ],
  mailconcept: [
    { bij: 'Bereid voor: mail', tekst: promptSchrijver({ type: 'mail', faseAccent: ACCENT }) + SCHRIJVER_NOOT },
    { bij: 'Boodschap van een campagne', tekst: PROMPT_CAMPAGNE_BOODSCHAP },
  ],
  linkedin: [{ bij: 'Bereid voor: LinkedIn-bericht', tekst: promptSchrijver({ type: 'linkedin', faseAccent: ACCENT }) + SCHRIJVER_NOOT }],
  briefing: [{ bij: 'Buying committee (Profielbouwer)', tekst: PROMPT_BUYING_COMMITTEE }],
  beoordelingsvraag: [],
  verbetervoorstel: [{ bij: 'Maandelijks verbetervoorstel per reisversie', tekst: PROMPT_VERBETERVOORSTEL }],
  coachvoorstel: [
    { bij: 'Coachingpunten voor een accountmanager', tekst: promptCoachpunten(false) },
    { bij: 'Coachingpunten voor jezelf (Expert)', tekst: promptCoachpunten(true) },
    { bij: 'Fases voorstellen voor een prospectreis', tekst: PROMPT_REISVOORSTEL },
  ],
  helpvraag: [{ bij: 'Vraag aan de Gids', tekst: ASSISTENT_PROMPT }],
}

export default defineEventHandler(async (event) => {
  const ctx = await vereisBeheerder(event, 'instellingen.prompts')
  return metOrganisatie(ctx.organisatie.id, async (tx) => ({
    kader: VAST_KADER,
    slots: await Promise.all(PROMPT_SLOTS.map(async (s) => {
      const platform = (await promptversies(tx, s.slot, 'platform'))[0]?.tekst ?? null
      const versies = await promptversies(tx, s.slot, 'organisatie')
      // Dezelfde volgorde als de promptketen: de eerste niet-lege laag geldt.
      const geldt = versies[0]?.tekst?.trim() ? 'organisatie' : platform?.trim() ? 'platform' : 'code'
      return { ...s, platform, versies, code: CODE[s.slot], geldt }
    })),
  }))
})
