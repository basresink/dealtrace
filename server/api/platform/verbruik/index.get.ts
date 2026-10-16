// GET /api/platform/verbruik?maand=&klant=&soort=: per klant de pot en het verbruik in credits per soort en
// per gebruiker, met geschatte kosten in euro's per model. Externe databronnen kosten geen credits en staan
// er los bij. Alleen tellingen, nooit inhoud. Founder.
import { sql } from 'drizzle-orm'
import { AI_SOORT, type AiSoort } from '../../../../shared/credits'
import { KOSTPRIJS_CENT_PER_CREDIT } from '../../../../shared/platform'
import { STANDAARD_MODEL } from '../../../utils/aiKoppeling'
import { alsPlatform, requireFounder } from '../../../utils/platform'

export default defineEventHandler(async (event) => {
  await requireFounder(event)
  const q = getQuery(event)
  const maand = typeof q.maand === 'string' && /^\d{4}-\d{2}$/.test(q.maand) ? q.maand : new Date().toISOString().slice(0, 7)
  return alsPlatform(async (tx) => {
    const rijen = ((await tx.execute(sql`select * from dealtrace_platform_verbruik(${maand})`)).rows as any[])
      .filter((r) => (!q.klant || r.organisation_id === q.klant) && (!q.soort || r.soort === q.soort))
    const potten = (await tx.execute(sql`select * from dealtrace_platform_credits()`)).rows as any[]
    const [k] = (await tx.execute(sql`select modellen from llm_connections where organisation_id is null`)).rows as any[]
    const model = (s: string) => k?.modellen?.[s] ?? k?.modellen?.standaard ?? STANDAARD_MODEL
    const namen = new Map(((await tx.execute(sql`select id, name from users`)).rows as any[]).map((u) => [u.id, String(u.name).replace(/^Testgebruiker /, '')]))
    const klanten = potten.filter((o) => o.organisation_id !== 'org-dealtrace').map((o) => {
      const eigen = rijen.filter((r) => r.organisation_id === o.organisation_id)
      const perSoort = new Map<string, number>()
      const perGebruiker = new Map<string, number>()
      for (const r of eigen) { perSoort.set(r.soort, (perSoort.get(r.soort) ?? 0) + Number(r.credits)); if (r.gebruiker_id) perGebruiker.set(r.gebruiker_id, (perGebruiker.get(r.gebruiker_id) ?? 0) + Number(r.credits)) }
      const verbruikt = [...perSoort.values()].reduce((s, n) => s + n, 0)
      return {
        id: o.organisation_id, naam: o.naam, pakket: o.pakket, pot: Number(o.toegekend) + Number(o.extra), extra: Number(o.extra), verbruikt, openAanvragen: Number(o.open_aanvragen),
        perSoort: [...perSoort].map(([s, c]) => ({ soort: s, naam: AI_SOORT[s as AiSoort]?.naam ?? s, credits: c, model: model(s), kostenCent: Math.round(c * KOSTPRIJS_CENT_PER_CREDIT) })).sort((a, b) => b.credits - a.credits),
        perGebruiker: [...perGebruiker].map(([g, c]) => ({ gebruiker: namen.get(g) ?? g, credits: c })).sort((a, b) => b.credits - a.credits),
        kostenCent: Math.round(verbruikt * KOSTPRIJS_CENT_PER_CREDIT),
      }
    })
    return { maand, klanten, totaalCredits: klanten.reduce((s, k) => s + k.verbruikt, 0), totaalKostenCent: klanten.reduce((s, k) => s + k.kostenCent, 0) }
  })
})
