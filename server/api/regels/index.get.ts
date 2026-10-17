// GET /api/regels: regels met tellers en keuzelijsten (Gevorderd en hoger; Beginner 403).
import { CADANSEN, PATRONEN, triggerInWoorden } from '../../../shared/regelPatronen'
import { kan } from '../../utils/accounts'
import { metOrganisatie, schema } from '../../utils/db'
import { eigenTeams } from '../../utils/gebruikers'
import { laadRegelWinpunten, regelUitRij } from '../../utils/motor'
import { GEBEURTENIS_LABEL } from '../../../shared/nbStatus'
import { magRegelSchrijven, magRegelsLezen } from '../../utils/regels'
import { vereisOrganisatie, weigerFunctie } from '../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisOrganisatie(event)
  if (!magRegelsLezen(ctx)) weigerFunctie('regels.lezen', 'niveau')
  return metOrganisatie(ctx.organisatie.id, async (tx) => {
    const teams = ctx.gebruiker.rol === 'salesmanager' ? await eigenTeams(tx, ctx.gebruiker.id) : []
    const regels = (await tx.select().from(schema.activityRules)).map(regelUitRij)
      // Persoonlijke regels van anderen ziet alleen de beheerder.
      .filter((r) => r.scope !== 'persoonlijk' || r.eigenaarId === ctx.gebruiker.id || ctx.gebruiker.rol === 'beheerder')
      .sort((a, b) => (a.code ?? 'ZZ').localeCompare(b.code ?? 'ZZ') || a.naam.localeCompare(b.naam))
    const reizen = (await tx.select({ id: schema.reistemplates.id, naam: schema.reistemplates.naam, status: schema.reistemplates.status, data: schema.reistemplates.data }).from(schema.reistemplates)).filter((r) => r.status !== 'concept')
    const doelgroepen = await tx.select({ id: schema.doelgroepen.id, naam: schema.doelgroepen.naam }).from(schema.doelgroepen)
    const tms = await tx.select({ id: schema.teams.id, naam: schema.teams.naam }).from(schema.teams)
    // Dealtrace: winpunten uit het verkoopverhaal om aan de activiteit van een regel te koppelen.
    const winpunten = await laadRegelWinpunten(tx)
    const actief = regels.filter((r) => r.actief).length
    return {
      tellers: { actief, uit: regels.length - actief, motor: regels.filter((r) => r.actief && r.data.activiteit === 'taak').length, totaal: regels.length },
      regels: regels.map((r) => ({
        ...r, trigger: triggerInWoorden(r),
        kanSchrijven: magRegelSchrijven(ctx, r, teams).mag || (ctx.gebruiker.rol === 'salesmanager' && r.scope === 'organisatie'),
        alleenBeperkt: ctx.gebruiker.rol === 'salesmanager' && r.scope === 'organisatie',
      })),
      keuzes: {
        patronen: Object.entries(PATRONEN).map(([id, p]) => ({ id, label: p.label, parameters: p.parameters })), cadansen: CADANSEN,
        reizen: reizen.map((r) => ({
          id: r.id, naam: r.naam,
          fases: [...r.data.fases].sort((a, b) => a.volgorde - b.volgorde).map((f) => ({ id: f.id, label: f.label, hoofdfase: f.hoofdfase })),
          overgangen: (r.data.overgangen ?? []).map((o) => ({ id: o.id, vanFaseId: o.vanFaseId, gebeurtenis: o.gebeurtenis, naarFaseId: o.naarFaseId })),
        })),
        doelgroepen, teams: tms.filter((t) => ctx.gebruiker.rol !== 'salesmanager' || teams.includes(t.id)),
        winpunten: winpunten.filter((w) => w.actief).map((w) => ({ id: w.id, titel: w.titel, omschrijving: w.omschrijving ?? null, hoofdfase: w.hoofdfase ?? null })),
        gebeurtenissen: Object.entries(GEBEURTENIS_LABEL).map(([id, label]) => ({ id, label })),
      },
      kan: {
        persoonlijk: kan(ctx, 'regels.persoonlijk'), team: kan(ctx, 'regels.team'), beheer: kan(ctx, 'regels.beheer'), ai: kan(ctx, 'motor.ai'),
        motor: kan(ctx, 'regels.team') || kan(ctx, 'regels.beheer'), export: kan(ctx, 'regels.team') || kan(ctx, 'regels.beheer'),
      },
    }
  })
})
