// POST /api/assistent/vraag {chatId?, tekst, context, akkoordKosten?}: een vraag aan de Gids (F26).
// 402 met de schermtekst als de credits of het plafond op zijn; 409 kostenBevestigen voor
// webonderzoek zonder akkoord. Een account zonder leesrecht valt uit de context.
import { sql } from 'drizzle-orm'
import { AI_SOORT, creditsVoor } from '../../../shared/credits'
import { ASSISTENT_PROMPT, ASSISTENT_SCHEMA, controleerAntwoord, materiaalVoor, soortVoor, type Antwoord, type AssistentContext } from '../../utils/assistent'
import { metOrganisatie } from '../../utils/db'
import { platformCredits, stand, verbruikGebruiker } from '../../utils/credits'
import { voerAiStapMetCredits } from '../../utils/llm-provider'
import { vereisFunctie } from '../../utils/sessie'

import { schoonVanNamen, verbodenNamen } from '../../utils/suggesties'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'assistent.chat')
  const b = await readBody<{ chatId?: string; tekst?: string; context?: AssistentContext; akkoordKosten?: boolean }>(event)
  const tekst = String(b?.tekst ?? '').trim().slice(0, 2000)
  if (!tekst) throw createError({ statusCode: 422, statusMessage: 'Stel een vraag' })
  const org = ctx.organisatie.id
  const g = ctx.gebruiker.id

  const voor = await metOrganisatie(org, async (tx) => {
    const context: AssistentContext = { route: b?.context?.route ?? null, accountId: null }
    if (b?.context?.accountId) {
      const [a] = (await tx.execute(sql`select id from accounts where id = ${b.context.accountId}`)).rows as { id: string }[]
      context.accountId = a?.id ?? null
    }
    const s = soortVoor(tekst, context, ctx.organisatie.pakket)
    let chatId = b?.chatId ?? null
    if (chatId) {
      const [c] = (await tx.execute(sql`select id from ai_chats where id = ${chatId} and gebruiker_id = ${g}`)).rows as { id: string }[]
      chatId = c?.id ?? null
    }
    if (!chatId) chatId = ((await tx.execute(sql`insert into ai_chats (organisation_id, gebruiker_id, context, titel) values (${org}, ${g}, ${JSON.stringify(context)}::jsonb, ${tekst.slice(0, 80)}) returning id`)).rows[0] as any).id as string
    const materiaal = s.nietInPakket ? null : await materiaalVoor(tx, g, tekst, context)
    const { prijzen } = await platformCredits(tx)
    return { context, s, chatId, materiaal, kosten: creditsVoor(s.soort, { prijzen, bronnen: materiaal ? materiaal.helpcenter.length + (materiaal.account?.verslagen.length ?? 0) : 0 }) }
  })

  const bewaar = (a: Antwoord, credits: number) => metOrganisatie(org, async (tx) => {
    await tx.execute(sql`insert into ai_chat_berichten (organisation_id, chat_id, rol, tekst) values (${org}, ${voor.chatId}, 'gebruiker', ${tekst})`)
    const [r] = (await tx.execute(sql`insert into ai_chat_berichten (organisation_id, chat_id, rol, tekst, bronnen, acties, credits) values (${org}, ${voor.chatId}, 'assistent', ${a.tekst}, ${JSON.stringify(a.bronnen)}::jsonb, ${JSON.stringify(a.acties)}::jsonb, ${credits}) returning id, op`)).rows as any[]
    // Geen antwoord in het helpcenter: de vraag gaat als melding naar de beheerder voor een nieuw artikel (F21).
    if (a.doorgestuurd) {
      // P25: de vraag zonder namen (11.2) als signaal in de statistiek, bij de beheerder en bij de founders.
      const zonderNamen = schoonVanNamen(tekst, await verbodenNamen(tx)).slice(0, 200)
      await tx.execute(sql`insert into help_zoekopdrachten (organisation_id, term, resultaten, soort, beantwoord) values (${org}, ${zonderNamen}, 0, 'vraag', false)`)
      const [beh] = (await tx.execute(sql`select id from users where role = 'beheerder' and status = 'actief' limit 1`)).rows as { id: string }[]
      if (beh) await tx.execute(sql`insert into notificaties (id, organisation_id, gebruiker_id, soort, titel, tekst, link, op, data) values (${crypto.randomUUID()}, ${org}, ${beh.id}, 'systeem', 'Vraag zonder helpartikel', ${zonderNamen}, '/instellingen/help?tab=statistiek', now(), '{}'::jsonb)`)
      await tx.execute(sql`select dealtrace_meld_founders('Vraag zonder helpartikel', ${zonderNamen}, '/platform/help?tab=vragen')`)
    }
    const st = await stand(tx, org)
    const eigen = await verbruikGebruiker(tx, org, g)
    return { chatId: voor.chatId, bericht: { id: r.id, rol: 'assistent', ...a, credits, op: r.op }, credits: { over: st.over, pot: st.pot, eigen } }
  })

  if (voor.s.nietInPakket) return bewaar({ tekst: 'Webonderzoek zit niet in jullie pakket.', bronnen: [], acties: [] }, 0)
  if (voor.s.soort === 'webonderzoek' && !b?.akkoordKosten) {
    throw createError({ statusCode: 409, statusMessage: `Dit kost ongeveer ${voor.kosten} credits. Doorgaan?`, data: { kostenBevestigen: true, kosten: voor.kosten, soort: AI_SOORT.webonderzoek.naam } })
  }
  const uit = await voerAiStapMetCredits<Antwoord>(org, { soort: voor.s.soort, prompt: ASSISTENT_PROMPT, schema: ASSISTENT_SCHEMA, materiaal: voor.materiaal, agent: 'gids', accountId: voor.context.accountId, gebruiker: null },
    { gebruikerId: g, automatisch: false, context: { bronnen: voor.materiaal!.helpcenter.length + (voor.materiaal!.account?.verslagen.length ?? 0) }, credits: () => voor.kosten })
    .catch((e: any) => { throw createError({ statusCode: e?.statusCode ?? 500, statusMessage: e?.statusMessage ?? 'De assistent is even niet bereikbaar', data: e?.data }) })
  if (!uit.ok) return bewaar({ tekst: 'De assistent kon nu geen bruikbaar antwoord geven. Er zijn geen credits afgeschreven.', bronnen: [], acties: [] }, 0)
  return bewaar(controleerAntwoord(voor.materiaal!, uit.waarde), uit.credits)
})
