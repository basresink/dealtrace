// Terugkomregels uit het verkoopverhaal (F25, ADR-018, 7.3). Het volledige
// leesmodel komt met P28; tot dan staan de regels, de redenmapping en de
// concurrenten in org_settings 'verkoopverhaal' (startset uit Bijlage C).
import { AFKOELING_STANDAARD, type Afkoeling, type Kanaal } from './nbStatus'

export interface Terugkomregel {
  id: string
  lijst: 'verloren' | 'slapend'
  reden: string
  termijn: string
  termijnDagen: number
  kanaal: string
  rollen: string[]
  aanpak: string
  klassen?: string[]
}

export interface Redenmapping {
  bronSoort: 'nee' | 'deal_verloren' | 'offerte_verloren' | 'slapend'
  reden: string
  terugkomregelId: string | null
}

export interface Concurrent {
  id: string; naam: string; soort: string
  zoZegJeHet?: string; alsDeKlantZegt?: string; bewijs?: string; onderscheid?: string
}
export interface VerhaalTekst { id: string; sublaag: string; sleutel: string; brancheId: string | null; tekst: string; kernzin?: string | null }
export interface Winpunt { id: string; titel: string; omschrijving: string; faseId: string | null; weging: number; onderNorm: boolean; actief: boolean }

export interface Branche { id: string; naam: string; focus: string }

export interface VerkoopverhaalStand {
  branches?: Branche[]
  /** De ambitiezin (L0.2), voor de ambitietoets bij een doelgroep. */
  ambitie?: string | null
  terugkomregels: Terugkomregel[]
  redenmapping: Redenmapping[]
  concurrenten: Concurrent[]
  /** P10: teksten (kernzin, verhaal per branche, belofte) en winpunten voor de scripts. Tot P28 uit de seed. */
  teksten?: VerhaalTekst[]
  winpunten?: Winpunt[]
  /** P11: SBI-codes en trefwoorden per branche (vv_branche_mapping), voor de leadgenerator. */
  brancheMapping?: { brancheId: string; sbiCodes: string[]; trefwoorden: string[] }[]
}

/** Kanaal uit de regel ("Telefoon", "E-mail", "Bezoek") naar het kanaal van de afkoelperiode. */
export function kanaalVanRegel(k: string | null | undefined): Kanaal {
  const t = (k ?? '').toLowerCase()
  if (t.includes('mail')) return 'mail'
  if (t.includes('bezoek')) return 'bezoek'
  if (t.includes('linkedin')) return 'linkedin'
  if (t.includes('whatsapp')) return 'whatsapp'
  if (t.includes('kaart')) return 'kaart'
  return 'bellen'
}

/** De regel die bij een reden hoort: eerst via de mapping, anders op gelijke naam. */
export function regelVoorReden(reden: string, stand: Pick<VerkoopverhaalStand, 'terugkomregels' | 'redenmapping'>, bronSoort?: Redenmapping['bronSoort']): Terugkomregel | null {
  const m = stand.redenmapping.find((x) => x.reden === reden && (!bronSoort || x.bronSoort === bronSoort))
    ?? stand.redenmapping.find((x) => x.reden === reden)
  if (m) return m.terugkomregelId ? stand.terugkomregels.find((r) => r.id === m.terugkomregelId) ?? null : null
  return stand.terugkomregels.find((r) => r.reden.toLowerCase() === reden.toLowerCase()) ?? null
}

export interface TerugkomVoorstel {
  datum: string
  dagen: number
  kanaal: Kanaal
  regel: Terugkomregel | null
  /** De datum is opgeschoven naar het einde van de afkoelperiode. */
  opgeschoven: boolean
}

const DAG = 24 * 3600 * 1000
const plusDagen = (nu: Date, d: number) => new Date(Date.UTC(nu.getUTCFullYear(), nu.getUTCMonth(), nu.getUTCDate()) + d * DAG).toISOString().slice(0, 10)

/**
 * De terugkomdatum bij een reden. De afkoelperiode is de ondergrens: een datum
 * binnen de afkoelperiode van het kanaal uit de regel schuift op naar het einde
 * ervan. "Niet geschikt" heeft 365 dagen; zonder regel geldt de afkoelperiode
 * van bellen (voorstel).
 */
export function terugkomDatum(
  reden: string,
  stand: Pick<VerkoopverhaalStand, 'terugkomregels' | 'redenmapping'>,
  nu: Date,
  afkoeling: Partial<Afkoeling> = AFKOELING_STANDAARD,
  bronSoort?: Redenmapping['bronSoort'],
): TerugkomVoorstel {
  const regel = reden === 'Niet geschikt' ? null : regelVoorReden(reden, stand, bronSoort)
  const kanaal = regel ? kanaalVanRegel(regel.kanaal) : 'bellen'
  const af = { ...AFKOELING_STANDAARD, ...afkoeling }
  const ondergrens = reden === 'Niet geschikt' ? 365 : af[kanaal]
  const gewenst = regel ? regel.termijnDagen : ondergrens
  const dagen = Math.max(gewenst, ondergrens)
  return { datum: plusDagen(nu, dagen), dagen, kanaal, regel, opgeschoven: dagen > gewenst }
}

/** "Terug op 14 januari 2027 · Beslissing uitgesteld · e-mail met nieuwe aanleiding". */
export function terugkomTekst(datum: string, regel: Pick<Terugkomregel, 'reden' | 'aanpak'> | null): string {
  const d = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${datum}T00:00:00Z`))
  return [`Terug op ${d}`, regel?.reden, regel?.aanpak].filter(Boolean).join(' · ')
}

/** Startset uit seed/voltvast.json (Bijlage C.6, C.8 en de redenmapping). */
export function verkoopverhaalUitSeed(vv: any): VerkoopverhaalStand {
  return {
    ambitie: (vv?.vv_teksten ?? []).find((t: any) => t.sleutel === 'ambitie')?.tekst ?? null,
    branches: (vv?.vv_branches ?? []).sort((a: any, b: any) => (a.focus === 'primair' ? 0 : 1) - (b.focus === 'primair' ? 0 : 1) || a.volgorde - b.volgorde)
      .map((b: any) => ({ id: b.extern_id, naam: b.naam, focus: b.focus })),
    terugkomregels: (vv?.vv_terugkomregels ?? []).map((r: any) => ({
      id: r.extern_id, lijst: r.lijst, reden: r.reden, termijn: r.termijn, termijnDagen: r.termijn_dagen, kanaal: r.kanaal,
      rollen: r.rollen_label ?? [], aanpak: r.aanpak, klassen: r.klassen ?? [],
    })),
    redenmapping: (vv?.eigen_aanvullingen?.vv_redenmapping ?? []).map((m: any) => ({ bronSoort: m.bron_soort, reden: m.dealtrace_reden, terugkomregelId: m.terugkomregel_id })),
    concurrenten: (vv?.vv_concurrenten ?? []).map((c: any) => ({ id: c.extern_id, naam: c.concurrent, soort: c.soort_label, zoZegJeHet: c.zoZegJeHet, alsDeKlantZegt: c.alsDeKlantZegt, bewijs: c.bewijs, onderscheid: c.onderscheid })),
    teksten: (vv?.vv_teksten ?? []).map((t: any) => ({ id: t.id, sublaag: t.sublaag, sleutel: t.sleutel, brancheId: t.branche_id ?? null, tekst: t.tekst, kernzin: t.kernzin ?? null })),
    brancheMapping: (vv?.eigen_aanvullingen?.vv_branche_mapping ?? []).map((m: any) => ({ brancheId: m.branche_id, sbiCodes: m.sbi_codes ?? [], trefwoorden: m.trefwoorden ?? [] })),
    winpunten: (vv?.vv_winpunten ?? []).map((w: any) => ({
      id: w.extern_id, titel: w.titel, omschrijving: w.omschrijving, faseId: w.fase ?? null, weging: Number(w.weging ?? 1),
      onderNorm: !!w.context?.klantfeedback?.onder_norm, actief: w.actief !== false,
    })),
  }
}

// ── Leesmodel voor scripts en concepten (F25; volledig in P28) ──────────────

const eersteZin = (t: string) => (/^.*?[.!?](\s|$)/.exec(t)?.[0] ?? t).trim()

/** De kernzin van de branche, met terugval op het algemene verhaal en een melding (C.9 geval 1). */
export function kernzinVoor(stand: Pick<VerkoopverhaalStand, 'teksten'>, brancheId: string | null | undefined): { tekst: string | null; terugval: boolean; melding?: string } {
  const t = stand.teksten ?? []
  const eigen = brancheId ? t.find((x) => x.sleutel === 'verhaal' && x.brancheId === brancheId) : undefined
  if (eigen) return { tekst: eigen.kernzin || eersteZin(eigen.tekst), terugval: false }
  const alg = t.find((x) => x.sleutel === 'bedrijfsverhaal' && !x.brancheId)
  return { tekst: alg ? alg.kernzin || eersteZin(alg.tekst) : null, terugval: true, melding: brancheId ? 'Deze branche heeft nog geen eigen verhaal; het algemene verhaal geldt.' : undefined }
}

/** De belofte van de branche (kernbelofte), met terugval op de algemene. */
export function beloftVoor(stand: Pick<VerkoopverhaalStand, 'teksten'>, brancheId: string | null | undefined): { tekst: string | null; terugval: boolean; melding?: string } {
  const t = stand.teksten ?? []
  const eigen = brancheId ? t.find((x) => x.sleutel === 'kernbelofte' && x.brancheId === brancheId) : undefined
  if (eigen) return { tekst: eigen.tekst, terugval: false }
  const alg = t.find((x) => x.sleutel === 'kernbelofte' && !x.brancheId)
  return { tekst: alg?.tekst ?? null, terugval: true, melding: brancheId ? 'Deze branche heeft nog geen eigen belofte; de algemene geldt.' : undefined }
}

/**
 * Het winpunt voor een gesprek: actief, bij voorkeur van de fase, hoogste weging. Een
 * winpunt onder de norm van de klantfeedback komt nooit als eerste (C.9 geval 4). Een
 * eerder gebruikt winpunt gaat achteraan (bericht 2 gebruikt een ander, 11.5).
 */
export function kiesWinpunt(winpunten: Winpunt[], opties: { faseId?: string | null; eerderGebruikt?: string[] } = {}): Winpunt | null {
  const kandidaten = winpunten.filter((w) => w.actief)
  if (!kandidaten.length) return null
  const gebruikt = new Set(opties.eerderGebruikt ?? [])
  const sleutel = (w: Winpunt) => [w.onderNorm ? 1 : 0, gebruikt.has(w.id) ? 1 : 0, opties.faseId && w.faseId === opties.faseId ? 0 : 1, -w.weging]
  return [...kandidaten].sort((a, b) => { const x = sleutel(a), y = sleutel(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i]! - y[i]!; return a.id.localeCompare(b.id) })[0]!
}

/** "Als de klant zegt": '"Online is het goedkoper." Antwoord: "Per stuk soms wel."' naar bezwaar en antwoord. */
export function leesAlsDeKlantZegt(t: string | null | undefined): { bezwaar: string; antwoord: string } | null {
  if (!t) return null
  const m = /^\s*"?(.+?)"?\s*Antwoord:\s*"?(.+?)"?\s*$/s.exec(t)
  return m ? { bezwaar: m[1]!.trim(), antwoord: m[2]!.trim() } : null
}
