// De verzender voor meldingen (P26, F24, 8.10): elke rij in notificaties zonder kanalen_verstuurd gaat
// per soort naar de kanalen die de gebruiker koos (in de app, e-mail, push). Tijdens de rijmodus of een
// belblok met "meldingen stil" blijft alles liggen; daarna komt het gebundeld (één push per gebruiker).
// In de stille uren en het weekend wachten push en e-mail tot erna; in de app staat de melding meteen.
// "Gelezen" staat op de server, dus op alle toestellen gelijk.
import { sql } from 'drizzle-orm'
import { bundel, bundelTitel, houdtVast, kanalenVoor } from '../../shared/kanalen'
import { naStilte } from '../../shared/meldingsregels'
import { gebruikDb } from './db'
import { stuurMeldingMail } from './mailer'
import { instellingVan } from './onderwegMeldingen'
import { stuurPush } from './push'

type Tx = Parameters<Parameters<ReturnType<typeof gebruikDb>['transaction']>[0]>[0]
type Rij = Record<string, any>
const rijen = async (tx: Tx, q: ReturnType<typeof sql>) => (await tx.execute(q)).rows as Rij[]

/** De verzender voor één organisatie. Geeft per kanaal het aantal en hoeveel er bleven liggen. */
export async function verzendMeldingen(tx: Tx, org: string, nu = new Date(), alleenGebruiker?: string) {
  const tel = { inApp: 0, email: 0, push: 0, gebundeld: 0, wacht: 0, verborgen: 0 }
  const open = await rijen(tx, sql`select n.id, n.gebruiker_id, n.soort, n.titel, n.tekst, n.link, n.op, n.data, u.email, u.data as udata, p.data as pdata
    from notificaties n join users u on u.id = n.gebruiker_id left join persoonlijke_instellingen p on p.id = n.gebruiker_id
    where n.kanalen_verstuurd is null and n.op <= ${nu.toISOString()} ${alleenGebruiker ? sql`and n.gebruiker_id = ${alleenGebruiker}` : sql``}
    order by n.gebruiker_id, n.op limit 500`)
  const perGebruiker = new Map<string, Rij[]>()
  for (const r of open) perGebruiker.set(r.gebruiker_id, [...(perGebruiker.get(r.gebruiker_id) ?? []), r])
  for (const [gid, lijst] of perGebruiker) {
    const eerste = lijst[0]!
    if (houdtVast(eerste.udata, nu)) { tel.wacht += lijst.length; continue }
    const inst = await instellingVan(tx, gid)
    const stil = naStilte(nu, inst).getTime() > nu.getTime()
    const plan = lijst.map((r) => ({ r, k: kanalenVoor(r.soort, r.pdata?.kanalen, r.pdata?.meldingen) }))
    // Uit in de app: verbergen. Dan is er ook geen push of mail.
    for (const { r, k } of plan.filter((x) => !x.k.inApp)) {
      await tx.execute(sql`update notificaties set verborgen_op = ${nu.toISOString()}, kanalen_verstuurd = ${JSON.stringify({ inApp: false, email: false, push: false })}::jsonb where id = ${r.id}`)
      tel.verborgen++
    }
    const zichtbaar = plan.filter((x) => x.k.inApp)
    // Stille uren: in de app staat hij al; push en mail wachten tot erna (de rij blijft open).
    if (stil) {
      for (const x of zichtbaar) { if (x.k.push || x.k.email) tel.wacht++; else { await markeer(tx, x.r.id, { inApp: true }); tel.inApp++ } }
      continue
    }
    const push = zichtbaar.filter((x) => x.k.push)
    // Meer dan één push tegelijk (na de rijmodus, een belblok of de stille uren): één gebundelde push.
    if (push.length > 1) {
      const b = bundel(push.map((x) => ({ soort: x.r.soort, titel: x.r.titel })))
      await stuurPush(tx, gid, { id: push[0]!.r.id, titel: bundelTitel(b), tekst: b.map((x) => x.tekst || x.titel).join(' · ').slice(0, 180), link: '/meldingen' }).catch(() => 0)
      tel.gebundeld++
    } else if (push.length === 1) {
      const r = push[0]!.r
      await stuurPush(tx, gid, { id: r.id, titel: r.titel, tekst: r.tekst, link: r.link, actie: r.data?.actie ?? null }).catch(() => 0)
    }
    tel.push += push.length
    // E-mail: één mail per ronde met alle meldingen die per mail mogen.
    const mail = zichtbaar.filter((x) => x.k.email)
    if (mail.length && eerste.email) {
      const onderwerp = mail.length === 1 ? mail[0]!.r.titel : `${mail.length} meldingen in Dealtrace`
      const tekst = mail.map((x) => `${x.r.titel}${x.r.tekst ? `\n${x.r.tekst}` : ''}${x.r.link ? `\nOpen: ${x.r.link}` : ''}`).join('\n\n') + '\n\nJe kiest per soort hoe je meldingen krijgt in Mijn instellingen.'
      try { await stuurMeldingMail(eerste.email, onderwerp, tekst); tel.email += mail.length } catch { /* mail mislukt: in de app staat hij al */ }
    }
    for (const { r, k } of zichtbaar) { await markeer(tx, r.id, { inApp: true, email: k.email && !!eerste.email, push: k.push, ...(push.length > 1 && k.push ? { gebundeld: true } : {}) }); tel.inApp++ }
  }
  return tel
}

const markeer = (tx: Tx, id: string, k: Record<string, boolean>) => tx.execute(sql`update notificaties set kanalen_verstuurd = ${JSON.stringify(k)}::jsonb where id = ${id}`)
