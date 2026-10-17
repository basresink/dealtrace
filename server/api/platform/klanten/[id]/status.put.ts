// PUT /api/platform/klanten/:id/status: de organisatie opzeggen of de opzegging intrekken (F23, pakket C).
// Opzeggen {status: 'opgezegd', einddatum, reden, naam}: de naam van de organisatie letterlijk overgetypt en
// een herbevestiging (authenticator-code) binnen 15 minuten, anders 428. De klant werkt door tot en met de
// einddatum; daarna kan de beheerder nog 30 dagen exporteren en mag de data weg (verwijderenOp).
// Intrekken {status: 'actief'} zet het contract terug naar de stand van daarvoor (actief of proef). Elke stap: platformaudit en een melding aan de beheerders.
import { eq } from 'drizzle-orm'
import { BEWAREN_NA_OPZEGGEN_DAGEN, plusDagen, valideerOpzegging } from '../../../../../shared/platformAvg'
import { schema } from '../../../../utils/db'
import { vergeetOrganisaties } from '../../../../utils/kortGeheugen'
import { alsPlatform, meldBeheerders, platformAudit, requireFounder, vereisHerbevestiging } from '../../../../utils/platform'
import { vandaagNL } from '../../../../utils/platformAvg'

const datumNL = (d: string) => new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

export default defineEventHandler(async (event) => {
  event.node.res.once('finish', vergeetOrganisaties)
  const ctx = await requireFounder(event)
  const id = getRouterParam(event, 'id')!
  const b = await readBody<{ status?: string; einddatum?: string; reden?: string; naam?: string }>(event)
  if (b?.status !== 'opgezegd' && b?.status !== 'actief') throw createError({ statusCode: 400, statusMessage: 'Kies opgezegd of actief' })
  const vandaag = vandaagNL()
  return alsPlatform(async (tx) => {
    const [o] = await tx.select().from(schema.organisations).where(eq(schema.organisations.id, id))
    if (!o || o.status === 'systeem') throw createError({ statusCode: 404, statusMessage: 'Klant onbekend' })
    const voor = o.contract ?? {}
    const contract = { ...voor } as schema.Contract
    if (b.status === 'opgezegd') {
      if (voor.status === 'opgezegd') throw createError({ statusCode: 409, statusMessage: 'Deze klant is al opgezegd' })
      const fouten = valideerOpzegging(b, o.name, vandaag)
      if (fouten.length) throw createError({ statusCode: 422, statusMessage: fouten[0], data: { fouten } })
      vereisHerbevestiging(ctx)
      Object.assign(contract, { status: 'opgezegd', einddatum: b.einddatum, opgezegdOp: vandaag, opzegReden: b.reden!.trim().slice(0, 300), verwijderenOp: plusDagen(b.einddatum!, BEWAREN_NA_OPZEGGEN_DAGEN), statusVoorOpzeggen: voor.status ?? 'actief' })
      await tx.update(schema.organisations).set({ contract, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
      await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'organisatie.opzeggen', object: id, voor, na: contract, reden: contract.opzegReden })
      await meldBeheerders(tx, id, 'Je abonnement is opgezegd',
        `Dealtrace werkt voor je organisatie tot en met ${datumNL(b.einddatum!)}. Exporteer je gegevens via Instellingen, Privacy; na ${datumNL(contract.verwijderenOp!)} verwijderen we ze.`, '/instellingen/privacy')
      return { contract }
    }
    if (voor.status !== 'opgezegd') throw createError({ statusCode: 409, statusMessage: 'Deze klant is niet opgezegd' })
    // Terug naar de stand van vóór het opzeggen (een proef blijft een proef met zijn einddatum).
    contract.status = voor.statusVoorOpzeggen === 'proef' && voor.proefTot ? 'proef' : 'actief'
    if (contract.status !== 'proef') delete contract.proefTot
    delete contract.einddatum; delete contract.opgezegdOp; delete contract.opzegReden; delete contract.verwijderenOp; delete contract.statusVoorOpzeggen
    await tx.update(schema.organisations).set({ contract, updatedAt: new Date().toISOString() }).where(eq(schema.organisations.id, id))
    await platformAudit(tx, event, ctx, { organisatieId: id, handeling: 'organisatie.opzeggingIntrekken', object: id, voor, na: contract })
    await meldBeheerders(tx, id, 'De opzegging is ingetrokken', 'Je abonnement loopt gewoon door.', '/instellingen/abonnement')
    return { contract }
  })
})
