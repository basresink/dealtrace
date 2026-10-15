// POST /api/belscripts/opzet {doel}: "Laat AI een opzet maken" (salesmanager, beheerder). Altijd
// een concept; de mens activeert. AI schrijft geen winpunten. Kosten: concept (2 credits).
import { verwijderNamen, type JsonSchema } from '../../../shared/aiStap'
import { BLOK_VOLGORDE, DOEL_LABEL, SCRIPT_DOELEN, STARTSET_SCRIPTS } from '../../../shared/belscripts'
import { kernzinVoor } from '../../../shared/verkoopverhaal'
import { metOrganisatie, schema } from '../../utils/db'
import { schoonData, valideerVoorOrg } from '../../utils/belscripts'
import { voerAiStapUit } from '../../utils/llm-provider'
import { verkoopverhaal } from '../../utils/reis'
import { vereisFunctie } from '../../utils/sessie'

const SCHEMA: JsonSchema = { type: 'object', required: ['naam', 'blokken'], additionalProperties: false, properties: {
  naam: { type: 'string', maxLength: 120 },
  blokken: { type: 'array', minItems: 3, items: { type: 'object', required: ['soort', 'tekst'], additionalProperties: false, properties: { soort: { type: 'string', enum: BLOK_VOLGORDE }, tekst: { type: 'string', maxLength: 600 } } } },
} }

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'belscript.beheer')
  const b = await readBody<{ doel?: string }>(event)
  const doel = SCRIPT_DOELEN.includes(b?.doel as any) ? b!.doel as (typeof SCRIPT_DOELEN)[number] : 'koud'
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const vv = await verkoopverhaal(tx)
    const voorbeeld = (STARTSET_SCRIPTS.find((s) => s.doel === doel) ?? STARTSET_SCRIPTS[0]!).data.blokken.map((x) => ({ soort: x.soort, tekst: x.tekst }))
    const uit = await voerAiStapUit<{ naam: string; blokken: { soort: string; tekst: string }[] }>(tx, ctx.organisatie.id, {
      soort: 'concept', agent: 'schrijver', gebruiker: { id: ctx.gebruiker.id, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data as any },
      prompt: 'Maak een belscript als concept: opening met het waarom, één aanleiding, één vraag, afsluiting met twee tijden en een voicemail. Gebruik de variabelen tussen accolades; schrijf geen winpunten.',
      schema: SCHEMA, materiaal: verwijderNamen({ opzet: { doel, doelLabel: DOEL_LABEL[doel], voorbeeld }, kernzin: kernzinVoor(vv, null).tekst }, []),
    })
    if (!uit.ok) throw createError({ statusCode: 422, statusMessage: uit.reden ?? 'De AI kon geen opzet maken' })
    const data = schoonData({ blokken: uit.antwoord.blokken.map((x, i) => ({ id: `b${i + 1}`, soort: x.soort, tekst: x.tekst, invulwijze: x.soort === 'aanleiding' || x.soort === 'winpunt' ? 'ai_aanvullen' : 'vast' })), bezwaren: [] })
    const naam = uit.antwoord.naam
    const v = await valideerVoorOrg(tx, { naam, doel, data })
    if (v.fouten.length) throw createError({ statusCode: 422, statusMessage: v.fouten[0]!, data: v })
    const [r] = await tx.insert(schema.belscripts).values({ organisationId: ctx.organisatie.id, naam, doel, status: 'concept', versie: 0, eigenaarId: ctx.gebruiker.id, data: { ...data, opmerking: 'Opzet door AI; controleer en activeer.' } }).returning({ id: schema.belscripts.id })
    return { id: r!.id }
  })
})
