// Het dagritme (P32, 8.13, uit dexRitme): de vorm van het moment, de focus (de eerste zet met de
// reden erbij) en de tip van de dag. Puur, met `nu` als parameter. Dealtrace rekent met de reis in
// plaats van met deals (B17).
import { nlMoment } from './datum'
import type { Dag, Regel } from './dag'

export type Vorm = 'weekstart' | 'weekafsluiting' | 'dagstart'
/** Maandag weekstart, vrijdag vanaf 15:00 weekafsluiting, anders dagstart (Nederlandse tijd). */
export function bepaalVorm(nu: Date): Vorm {
  const m = nlMoment(nu)
  const wd = new Date(`${m.datum}T12:00:00Z`).getUTCDay()
  if (wd === 1) return 'weekstart'
  if (wd === 5 && m.uur >= 15) return 'weekafsluiting'
  return 'dagstart'
}

export interface Focus {
  regel: '1-eerste-afspraak' | '2-afspraak' | '2b-verslag' | '2c-poging' | '3-achterstallig' | '4-overdragen' | '5-kans' | 'leeg'
  wat: string; waarom: string; wanneer: string | null; accountId: string | null; taakId: string | null; verslagVan: string | null
  knop: { soort: 'navigeer' | 'bel' | 'verslag' | 'open' | 'overdragen' | 'bellijst'; tekst: string; href: string | null }
}

/**
 * De eerste zet (Dex, uitgebreid met de reis): 1. komende eerste afspraak; 2. eerste komende of
 * lopende afspraak; 2b. alles geweest en een afspraak zonder verslag; 2c. de poging die vandaag moet
 * uit het hercontactritme; 3. de zwaarste achterstallige actie; 4. een gehouden eerste afspraak die
 * nog niet is overgedragen; 5. een kans langs de route (vanaf P14). Een afspraak op precies het
 * eindtijdstip is geweest.
 */
export function kiesFocus(dag: Pick<Dag, 'stapels' | 'isVandaag'>, nu: Date, kansen: { accountId: string; naam: string; waarom: string }[] = []): Focus | null {
  if (!dag.isVandaag) return null
  const t = nu.getTime()
  const { afspraken, bellen, acties, eersteAfspraken } = dag.stapels
  const komend = afspraken.filter((a) => a.eind && Date.parse(a.eind) > t)
  const naar = (a: Regel, regel: Focus['regel'], waarom: string): Focus => ({
    regel, wat: `${a.tijd ?? ''} ${a.accountNaam ?? a.titel}`.trim(), waarom, wanneer: a.start, accountId: a.accountId, taakId: a.taakId, verslagVan: null,
    knop: a.navigeer ? { soort: 'navigeer', tekst: `Navigeer naar ${a.accountNaam ?? 'de afspraak'}`, href: a.navigeer } : { soort: 'open', tekst: `Open ${a.accountNaam ?? 'de afspraak'}`, href: a.accountId ? `/accounts/${a.accountId}` : null },
  })
  const eerste = komend.find((a) => a.eerste)
  if (eerste) return naar(eerste, '1-eerste-afspraak', 'Je eerste afspraak met dit account. Bereid je voor op wie erbij zit en wat je wilt weten.')
  if (komend[0]) return naar(komend[0], '2-afspraak', Date.parse(komend[0].start ?? '') <= t ? 'Deze afspraak loopt nu.' : 'Je volgende afspraak vandaag.')
  const zonder = afspraken.find((a) => a.zonderVerslag)
  if (zonder) return { regel: '2b-verslag', wat: `Verslag van ${zonder.accountNaam ?? zonder.titel}`, waarom: 'De afspraak is geweest en het verslag ontbreekt nog.', wanneer: zonder.start, accountId: zonder.accountId, taakId: zonder.taakId, verslagVan: zonder.taakId, knop: { soort: 'verslag', tekst: 'Leg het verslag vast', href: null } }
  const bel = (r: Regel, regel: Focus['regel'], waarom: string): Focus => ({
    regel, wat: r.titel, waarom, wanneer: r.start, accountId: r.accountId, taakId: r.taakId, verslagVan: null,
    knop: r.contact?.tel ? { soort: 'bel', tekst: `Bel ${r.contact.naam}`, href: r.contact.tel } : { soort: 'open', tekst: 'Open de actie', href: r.accountId ? `/accounts/${r.accountId}` : null },
  })
  const poging = bellen.find((r) => r.poging && !r.achterstallig)
  if (poging) return bel(poging, '2c-poging', 'Deze poging uit het hercontactritme moet vandaag.')
  const zwaarste = [...bellen, ...acties].filter((r) => r.achterstallig).sort((a, b) => (a.priority === 'urgent' ? 0 : a.priority === 'hoog' ? 1 : 2) - (b.priority === 'urgent' ? 0 : b.priority === 'hoog' ? 1 : 2) || (a.start ?? '').localeCompare(b.start ?? ''))[0]
  if (zwaarste) return bel(zwaarste, '3-achterstallig', 'Je zwaarste achterstallige actie. Daarna wordt de rest kleiner.')
  const overdragen = eersteAfspraken.find((r) => r.knop === 'overdragen')
  if (overdragen) return { regel: '4-overdragen', wat: overdragen.titel, waarom: 'De eerste afspraak is gehouden; draag hem over zodat het vervolg niet blijft liggen.', wanneer: null, accountId: overdragen.accountId, taakId: null, verslagVan: null, knop: { soort: 'overdragen', tekst: `Open ${overdragen.accountNaam}`, href: `/accounts/${overdragen.accountId}` } }
  const kans = kansen[0]
  if (kans) return { regel: '5-kans', wat: kans.naam, waarom: kans.waarom, wanneer: null, accountId: kans.accountId, taakId: null, verslagVan: null, knop: { soort: 'open', tekst: `Open ${kans.naam}`, href: `/accounts/${kans.accountId}` } }
  const eerstvolgende = [...bellen, ...acties][0]
  if (eerstvolgende) return bel(eerstvolgende, '3-achterstallig', 'De eerste actie van vandaag.')
  return null
}

/** De focus op een lege dag (eerlijke lege staat). */
export const LEGE_FOCUS: Focus = {
  regel: 'leeg', wat: 'Niets dringends vandaag.', waarom: 'Een lege agenda is het beste moment om te prospecteren.', wanneer: null, accountId: null, taakId: null, verslagVan: null,
  knop: { soort: 'bellijst', tekst: 'Open de bellijst', href: '/bellen' },
}

const TIPS = [
  'Bel je lastigste gesprek voor 10:00; dan ben je het scherpst.',
  'Noem in elk gesprek één winpunt, niet vijf.',
  'Leg je verslag vast binnen een uur na de afspraak; dan weet je het nog precies.',
  'Vraag aan het eind van elk gesprek wanneer je terug mag bellen.',
  'Een nee met reden is ook een uitkomst. Leg hem vast, dan komt het account op tijd terug.',
]
/** Tip van de dag: na de werkdag niets; bij achterstand of een lege dag een passende tip; anders één per dag. */
export function kiesTip(p: { nu: Date; achterstallig: number; leeg: boolean; werkdagEind?: number }): string | null {
  const m = nlMoment(p.nu)
  if (m.uur >= (p.werkdagEind ?? 18)) return null
  if (p.achterstallig >= 3) return 'Begin met de oudste achterstallige actie. Elke afgeronde actie maakt de lijst korter.'
  if (p.leeg) return 'Geen afspraken vandaag: plan een belblok en bel je warmste prospects.'
  const dagNr = Math.floor(Date.parse(`${m.datum}T00:00:00Z`) / 864e5)
  return TIPS[dagNr % TIPS.length]!
}

/** Groet bij de vorm: "Goedemorgen, Jan. Een nieuwe week." */
export function groetMetVorm(groet: string, vorm: Vorm): string {
  return vorm === 'weekstart' ? `${groet} Een nieuwe week.` : vorm === 'weekafsluiting' ? `${groet} De week zit erop bijna.` : groet
}
