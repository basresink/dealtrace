// POST /api/leads/:id/overnemen: "Voeg toe" (voorheen Neem over). In één transactie het account (klasse in
// accounts.klasse, gat 2), contacten, herkomst, bewijs als notitie, instap met `lead-overgenomen` en de
// eerste taak. De flyout Voeg toe stuurt mee:
// - gegevens {naam, plaats, postcode, adres, website, telefoon, email, kvk, medewerkers, contacten[]}: aangevuld;
// - inReis (false: niet in een prospectreis), reisId en faseId (een fase van die reis, geen eindfase);
// - taak: null (geen eerste taak) of {type: belblok|bellen|mailen|bezoek|linkedin|bericht|taak, datum, contact};
// - eigenaar (alleen een salesmanager kiest een ander). Zonder deze velden geldt eersteStap zoals voorheen.
// 409 als de lead al is toegevoegd of het bedrijf al in het bestand staat; 422 bij een klant of foute keuze.
import { metOrganisatie } from '../../../utils/db'
import { neemOver, type EersteStap, type VoegToeKeuze } from '../../../utils/leads'
import { vereisFunctie } from '../../../utils/sessie'

export default defineEventHandler(async (event) => {
  const ctx = await vereisFunctie(event, 'leads.overnemen')
  const b = (await readBody<any>(event)) ?? {}
  const stap = (['belblok', 'bellen', 'bezoek'] as const).find((s) => s === b.eersteStap) as EersteStap | undefined
  const tekst = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const t = b.taak
  const keuze: VoegToeKeuze = {
    eigenaar: tekst(b.eigenaar), reisId: tekst(b.reisId), faseId: tekst(b.faseId), inReis: b.inReis !== false, eersteStap: stap ?? null,
    taak: t === null ? null : t && typeof t === 'object' ? { type: String(t.type ?? '') as any, datum: tekst(t.datum), contact: Number.isInteger(t.contact) ? t.contact : null } : undefined,
    gegevens: b.gegevens && typeof b.gegevens === 'object' ? b.gegevens : undefined,
  }
  return metOrganisatie(ctx.organisatie!.id, (tx) => neemOver(tx, ctx.organisatie!.id, { id: ctx.gebruiker.id, rol: ctx.gebruiker.rol, niveau: ctx.gebruiker.niveau, data: ctx.gebruiker.data }, getRouterParam(event, 'id')!, keuze))
})
