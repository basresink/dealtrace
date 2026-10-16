// POST /api/documenten/:id/vraag {vraag}: "Vraag de AI over dit document" via de AI-assistent (agent Gids,
// soort assistentUitgebreid, met credits). De datavelden gaan altijd mee; de uitgelezen tekst alleen als die er
// is, en dan staat in het antwoord met `metInhoud` of de AI de inhoud kende. Het gesprek komt bij je
// gesprekken met de assistent. 402 als de credits op zijn.
import { sql } from 'drizzle-orm'
import { creditsVoor } from '../../../../shared/credits'
import { DOCUMENT_PROMPT, DOCUMENT_SCHEMA, controleerDocumentAntwoord, documentMateriaal, type DocumentAntwoord } from '../../../../shared/kennisbank'
import { promptKeten } from '../../../../shared/platform'
import { platformCredits, stand, verbruikGebruiker } from '../../../utils/credits'
import { metOrganisatie } from '../../../utils/db'
import { documentDetail } from '../../../utils/kennisbank'
import { vereisDocumenten } from '../../../utils/kennisbankToegang'
import { voerAiStapMetCredits } from '../../../utils/llm-provider'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisDocumenten(event)
  await vereisFunctie(event, 'assistent.chat')
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ vraag?: string }>(event)
  const vraag = String(b?.vraag ?? '').trim().slice(0, 2000)
  if (!vraag) throw createError({ statusCode: 422, statusMessage: 'Stel een vraag' })
  const org = ctx.organisatie.id
  const g = ctx.gebruiker.id

  const voor = await metOrganisatie(org, async (tx) => {
    const d = await documentDetail(tx, id, ctx.gebruiker)
    const materiaal = documentMateriaal({
      naam: d.naam, type: d.type, versie: d.versie, mime: d.mime, grootte: d.grootte, bijgewerktOp: d.bijgewerktOp, door: d.eigenaar?.naam ?? null,
      beschrijving: d.beschrijving, klanten: d.accounts.map((a) => a.naam), contacten: d.contacten.map((c) => c.naam), tekst: d.tekst,
    }, vraag)
    const accountId = d.accounts.length === 1 ? d.accounts[0]!.id : null
    const [c] = (await tx.execute(sql`insert into ai_chats (organisation_id, gebruiker_id, context, titel) values (${org}, ${g}, ${JSON.stringify({ route: '/kennisbank', documentId: id, accountId })}::jsonb, ${`${d.naam}: ${vraag}`.slice(0, 80)}) returning id`)).rows as { id: string }[]
    const { prijzen } = await platformCredits(tx)
    return { materiaal, accountId, chatId: c!.id, kosten: creditsVoor('assistentUitgebreid', { prijzen, tekens: materiaal.document.inhoud?.length ?? 0 }) }
  })

  const uit = await voerAiStapMetCredits<DocumentAntwoord>(org, {
    soort: 'assistentUitgebreid', prompt: promptKeten({ code: DOCUMENT_PROMPT }), zonderKeten: true, schema: DOCUMENT_SCHEMA,
    materiaal: voor.materiaal, agent: 'gids', accountId: voor.accountId, gebruiker: null,
  }, { gebruikerId: g, automatisch: false, context: { bronnen: 1 }, credits: () => voor.kosten })
    .catch((e: any) => { throw createError({ statusCode: e?.statusCode ?? 500, statusMessage: e?.statusMessage ?? 'De assistent is even niet bereikbaar', data: e?.data }) })

  const antwoord: DocumentAntwoord = uit.ok
    ? controleerDocumentAntwoord(voor.materiaal, uit.waarde)
    : { tekst: 'De AI kon nu geen bruikbaar antwoord geven. Er zijn geen credits afgeschreven.', bronnen: [], acties: [] }
  const credits = uit.ok ? uit.credits : 0
  return metOrganisatie(org, async (tx) => {
    await tx.execute(sql`insert into ai_chat_berichten (organisation_id, chat_id, rol, tekst) values (${org}, ${voor.chatId}, 'gebruiker', ${vraag})`)
    await tx.execute(sql`insert into ai_chat_berichten (organisation_id, chat_id, rol, tekst, bronnen, acties, credits) values (${org}, ${voor.chatId}, 'assistent', ${antwoord.tekst}, ${JSON.stringify(antwoord.bronnen)}::jsonb, '[]'::jsonb, ${credits})`)
    const st = await stand(tx, org)
    return {
      vraag, antwoord: antwoord.tekst, bronnen: antwoord.bronnen, metInhoud: voor.materiaal.document.inhoudGelezen, ingekort: voor.materiaal.document.inhoudIngekort,
      credits: { gebruikt: credits, over: st.over, eigen: await verbruikGebruiker(tx, org, g) },
    }
  })
})
