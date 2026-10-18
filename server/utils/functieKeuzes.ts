// Functies per niveau voor de organisatie (Instellingen, Niveaus). De beheerder zet per functie en niveau
// aan of uit; de keuzes staan in org_settings 'functieKeuzes' en alleen wat afwijkt van de standaard van
// Dealtrace (functies_per_niveau, beginstand startNiveau). Grenzen die blijven: het pakket, de rol en een
// uitzetting door Dealtrace (shared/niveauOverzicht.ts keuzeFout). Elke wijziging is een auditregel in
// dezelfde transactie. Alles binnen metOrganisatie (RLS); elke query filtert ook zelf op de organisatie.
import { and, eq } from 'drizzle-orm'
import { functie } from '../../shared/functies'
import { aantalKeuzes, keuzeFout, niveauOverzicht, schoneKeuzes, zetKeuze, type FunctieKeuzes } from '../../shared/niveauOverzicht'
import type { FunctieRegel, Niveau, OrganisatieContext, Rol } from '../../shared/types'
import { schrijfAudit } from './audit'
import { schema } from './db'
import { vergeetOrganisaties } from './kortGeheugen'

type Tx = Parameters<Parameters<ReturnType<typeof import('./db').gebruikDb>['transaction']>[0]>[0]

export interface KeuzeCtx {
  gebruiker: { id: string; rol: Rol }
  organisatie: OrganisatieContext
  stand: FunctieRegel[]
}

/** Alleen de beheerder van de organisatie wijzigt functies per niveau. */
export function vereisNiveauBeheer(ctx: { gebruiker: { rol: Rol } }) {
  if (ctx.gebruiker.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: 'Alleen de beheerder zet functies aan of uit' })
}

export async function leesKeuzes(tx: Tx, organisationId: string): Promise<FunctieKeuzes> {
  const [r] = await tx.select({ value: schema.orgSettings.value }).from(schema.orgSettings)
    .where(and(eq(schema.orgSettings.organisationId, organisationId), eq(schema.orgSettings.key, 'functieKeuzes')))
  return schoneKeuzes(r?.value)
}

async function bewaarKeuzes(tx: Tx, organisationId: string, keuzes: FunctieKeuzes) {
  const nu = new Date().toISOString()
  await tx.insert(schema.orgSettings).values({ organisationId, key: 'functieKeuzes', value: keuzes, updatedAt: nu })
    .onConflictDoUpdate({ target: [schema.orgSettings.organisationId, schema.orgSettings.key], set: { value: keuzes, updatedAt: nu } })
  vergeetOrganisaties()
}

/** Het overzicht met de keuzes zoals ze nu in de database staan (niet uit het korte geheugen). */
export async function overzichtNu(tx: Tx, ctx: KeuzeCtx) {
  const keuzes = await leesKeuzes(tx, ctx.organisatie.id)
  return niveauOverzicht({ ...ctx.organisatie, keuzes }, ctx.stand)
}

/** Eén schakelaar: functie en niveau aan of uit. Gelijk aan de standaard haalt de keuze weg. */
export async function zetFunctieKeuze(tx: Tx, ctx: KeuzeCtx, invoer: { functie?: unknown; niveau?: unknown; aan?: unknown }) {
  vereisNiveauBeheer(ctx)
  const sleutel = String(invoer.functie ?? '')
  const niveau = String(invoer.niveau ?? '')
  const fout = keuzeFout(sleutel, niveau, invoer.aan, ctx.organisatie, ctx.stand)
  if (fout) throw createError({ statusCode: fout.status, statusMessage: fout.tekst })
  const aan = invoer.aan as boolean
  const oud = await leesKeuzes(tx, ctx.organisatie.id)
  const org = { ...ctx.organisatie, keuzes: oud }
  const voor = niveauOverzicht(org, ctx.stand)
  const vanCel = voor.groepen.flatMap((g) => g.functies).find((f) => f.sleutel === sleutel)!.cellen[niveau as Niveau]
  const nieuw = zetKeuze(oud, sleutel, niveau as Niveau, aan, ctx.organisatie, ctx.stand)
  if (JSON.stringify(nieuw) !== JSON.stringify(oud)) {
    await bewaarKeuzes(tx, ctx.organisatie.id, nieuw)
    await schrijfAudit(tx, {
      organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: aan ? 'instelling.functieAan' : 'instelling.functieUit',
      resourceType: 'functie', resourceId: `${sleutel}|${niveau}`,
      changes: { van: vanCel.aan, naar: aan, standaard: vanCel.standaard },
      metadata: { functie: sleutel, naam: functie(sleutel)?.naam ?? sleutel, niveau },
    })
  }
  return niveauOverzicht({ ...ctx.organisatie, keuzes: nieuw }, ctx.stand)
}

/** Terug naar de standaard: alle keuzes van de organisatie weg. Zonder keuzes verandert er niets. */
export async function keuzesNaarStandaard(tx: Tx, ctx: KeuzeCtx) {
  vereisNiveauBeheer(ctx)
  const oud = await leesKeuzes(tx, ctx.organisatie.id)
  const aantal = aantalKeuzes(oud)
  if (aantal) {
    await bewaarKeuzes(tx, ctx.organisatie.id, {})
    await schrijfAudit(tx, {
      organisationId: ctx.organisatie.id, actorId: ctx.gebruiker.id, action: 'instelling.functiesStandaard',
      resourceType: 'org_settings', resourceId: 'functieKeuzes', changes: { van: oud, naar: {} }, metadata: { aantal },
    })
  }
  return { aantal, overzicht: niveauOverzicht({ ...ctx.organisatie, keuzes: {} }, ctx.stand) }
}
