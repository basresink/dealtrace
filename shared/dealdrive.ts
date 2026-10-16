// De DealDrive-koppeling (P23, B21, ADR-021): ondertekenen, het pakket in contractvorm, foutcodes in
// gewone taal en wat een terugmelding betekent. Puur; de adapter en de server schrijven.
// Bron: docs/api/dealdrive-koppeling.md en dealdrive-koppeling.openapi.yaml (het contract gaat voor).
import { createHmac, timingSafeEqual } from 'node:crypto'
import { regelVoorReden, type Terugkomregel, type VerkoopverhaalStand } from './verkoopverhaal'

export const TIJDVENSTER_SEC = 5 * 60

/** `sha256=<hex>`: HMAC-SHA256 met het gedeelde geheim over `<tijd>.<ruwe body>` (hoofdstuk 2). */
export function tekenVerzoek(body: string, geheim: string, tijd: number | string): string {
  return `sha256=${createHmac('sha256', geheim).update(`${tijd}.${body}`).digest('hex')}`
}

export type HandtekeningFout = 'handtekening_ongeldig' | 'tijd_verlopen'
/** Controle van een binnenkomend verzoek: eerst de vorm, dan het tijdvenster (5 minuten), dan de HMAC in constante tijd. */
export function controleerHandtekening(headers: { handtekening?: string | null; tijd?: string | null }, ruweBody: string, geheim: string | null | undefined, nu = new Date()): { geldig: true } | { geldig: false; fout: HandtekeningFout } {
  if (!geheim || !headers.handtekening || !headers.tijd || !/^\d{1,12}$/.test(headers.tijd.trim())) return { geldig: false, fout: 'handtekening_ongeldig' }
  const tijd = Number(headers.tijd.trim())
  if (Math.abs(nu.getTime() / 1000 - tijd) > TIJDVENSTER_SEC) return { geldig: false, fout: 'tijd_verlopen' }
  const verwacht = Buffer.from(tekenVerzoek(ruweBody, geheim, tijd))
  const gekregen = Buffer.from(headers.handtekening.trim())
  return verwacht.length === gekregen.length && timingSafeEqual(verwacht, gekregen) ? { geldig: true } : { geldig: false, fout: 'handtekening_ongeldig' }
}

export const FOUTCODES = ['handtekening_ongeldig', 'tijd_verlopen', 'koppeling_uit', 'organisatie_onbekend', 'account_onbekend', 'ongeldige_invoer', 'al_klant', 'te_veel_verzoeken', 'interne_fout'] as const
export type FoutCode = typeof FOUTCODES[number]
export const FOUT_STATUS: Record<FoutCode, number> = { handtekening_ongeldig: 401, tijd_verlopen: 401, koppeling_uit: 403, organisatie_onbekend: 404, account_onbekend: 404, ongeldige_invoer: 422, al_klant: 409, te_veel_verzoeken: 429, interne_fout: 500 }
const MELDINGEN: Record<FoutCode, string> = {
  handtekening_ongeldig: 'DealDrive herkent de handtekening niet. Controleer of het gedeelde geheim aan beide kanten hetzelfde is.',
  tijd_verlopen: 'De klok van Dealtrace en DealDrive loopt meer dan 5 minuten uiteen. Het verzoek is geweigerd.',
  koppeling_uit: 'De koppeling staat in DealDrive uit. Vraag de beheerder van DealDrive om hem aan te zetten.',
  organisatie_onbekend: 'DealDrive kent deze organisatie niet. Controleer het organisatie-id van DealDrive.',
  account_onbekend: 'Het account is onbekend aan de andere kant.',
  ongeldige_invoer: 'DealDrive mist gegevens in de overdracht. Vul ze aan op de accountkaart en probeer het opnieuw.',
  al_klant: 'Dit bedrijf is al klant in DealDrive.',
  te_veel_verzoeken: 'DealDrive krijgt even te veel verzoeken. Dealtrace probeert het later opnieuw.',
  interne_fout: 'DealDrive had een storing. Dealtrace probeert het later opnieuw.',
}
/** Elke foutcode in gewone taal; een onbekende code valt terug op interne_fout. */
export function foutNaarMelding(code: string | null | undefined, velden?: string[] | null): string {
  const c = (FOUTCODES as readonly string[]).includes(code ?? '') ? code as FoutCode : 'interne_fout'
  return c === 'ongeldige_invoer' && velden?.length ? `${MELDINGEN[c]} Ontbreekt: ${velden.join(', ')}.` : MELDINGEN[c]
}
/** Opnieuw proberen alleen bij een time-out, 429 of 5xx (hoofdstuk 2). */
export const isTijdelijk = (status: number | null) => status == null || status === 429 || status >= 500

export const VERPLICHT = ['overdrachtId', 'overgedragenOp', 'overgedragenDoor.email', 'account.dealtraceId', 'account.naam', 'contacten', 'eersteAfspraak.datum', 'eersteAfspraak.uitkomst', 'vervolgstap.omschrijving'] as const
const pad = (o: any, p: string) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o)
const ROLLEN = ['beslisser', 'beinvloeder', 'champion', 'gebruiker', 'onbekend']
/** Sleutels op volgorde, zodat de hash van hetzelfde pakket altijd gelijk is. */
function gesorteerd(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(gesorteerd)
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, gesorteerd((v as any)[k])]))
  return v
}

/**
 * Het pakket uit overdrachtPakket (P17) als body van POST /overdrachten: verplichte velden aanwezig,
 * contacten op id, geen privégegevens (een als privé gemarkeerd nummer of adres gaat leeg mee), geen
 * offertes of deals (alleen het dealvoorstel), sleutels gesorteerd voor een vaste hash.
 */
export function naarContract(pakket: Record<string, any>): Record<string, unknown> {
  const ontbreekt = VERPLICHT.filter((p) => { const v = pad(pakket, p); return v == null || v === '' || (Array.isArray(v) && !v.length) })
  if (ontbreekt.length) throw Object.assign(new Error(`Ontbreekt in de overdracht: ${ontbreekt.join(', ')}`), { code: 'ongeldige_invoer', velden: ontbreekt })
  const { offertes: _o, deals: _d, ...rest } = pakket
  const contacten = [...(pakket.contacten as any[])].sort((a, b) => String(a.dealtraceId).localeCompare(String(b.dealtraceId))).map((c) => {
    const { prive, ...k } = c
    for (const veld of ['email', 'telefoon', 'mobiel']) if (Array.isArray(prive) && prive.includes(veld)) k[veld] = null
    return { ...k, achternaam: k.achternaam ?? '', voornaam: k.voornaam ?? '', rol: ROLLEN.includes(k.rol) ? k.rol : 'onbekend' }
  })
  return gesorteerd({ ...rest, contacten }) as Record<string, unknown>
}

// ── Terugmeldingen (hoofdstuk 5) ────────────────────────────────────────────

export const GEBEURTENIS_SOORTEN = ['overdracht.verwerkt', 'deal.gewonnen', 'deal.verloren', 'klant.slapend', 'account.eigenaar-gewijzigd', 'ping'] as const
export type GebeurtenisSoort = typeof GEBEURTENIS_SOORTEN[number]
export interface Terugmelding { gebeurtenisId: string; soort: GebeurtenisSoort; op: string; dealtraceAccountId?: string; dealdriveAccountId?: string; gegevens?: Record<string, any> }
export type TerugmeldActie =
  | { soort: 'overdracht-bevestigd'; overdrachtId: string | null }
  | { soort: 'gewonnen'; dealId: string | null; waarde: number | null; op: string }
  | { soort: 'winback'; bronSoort: 'deal_verloren'; reden: string; verlorenAan: string | null; regel: Terugkomregel | null }
  | { soort: 'herwin'; bronSoort: 'slapend'; reden: string; maanden: number; laatsteOrder: string | null; regel: Terugkomregel | null }
  | { soort: 'eigenaar'; eigenaar: string }
  | { soort: 'niets' }

/** Vormcontrole van een terugmelding; geeft de velden die ontbreken. */
export function controleerTerugmelding(b: any): string[] {
  const fout: string[] = []
  if (!b || typeof b !== 'object') return ['body']
  if (typeof b.gebeurtenisId !== 'string' || !b.gebeurtenisId) fout.push('gebeurtenisId')
  if (!(GEBEURTENIS_SOORTEN as readonly string[]).includes(b.soort)) fout.push('soort')
  if (typeof b.op !== 'string' || Number.isNaN(Date.parse(b.op))) fout.push('op')
  if (b.soort !== 'ping' && typeof b.dealtraceAccountId !== 'string') fout.push('dealtraceAccountId')
  if (b.soort === 'klant.slapend' && ![3, 6, 12].includes(b.gegevens?.maandenNietBesteld)) fout.push('gegevens.maandenNietBesteld')
  return fout
}

/**
 * Wat Dealtrace doet met een terugmelding. Een onbekend account en een dubbel gebeurtenisId vangt de
 * server af (404 en "al verwerkt"); hier gaat het om de betekenis. De terugkomdatum rekent de server
 * met de afkoelperiode uit (terugkomDatum, P12); de regel komt uit dezelfde redenmapping.
 * - deal.verloren: de reden via de redenmapping (bron deal_verloren) naar een terugkomregel (Prijs: hc-03).
 * - klant.slapend: "<n> maanden niet besteld" uit de lijst slapend (Voltvast hc-04 bij 6).
 */
export function verwerkTerugmelding(g: Terugmelding, stand: Pick<VerkoopverhaalStand, 'terugkomregels' | 'redenmapping'>): TerugmeldActie {
  switch (g.soort) {
    case 'overdracht.verwerkt': return { soort: 'overdracht-bevestigd', overdrachtId: g.gegevens?.overdrachtId ?? null }
    case 'deal.gewonnen': return { soort: 'gewonnen', dealId: g.gegevens?.dealId ?? null, waarde: Number.isFinite(g.gegevens?.waarde) ? g.gegevens!.waarde : null, op: g.gegevens?.gewonnenOp ?? g.op }
    case 'deal.verloren': {
      const reden = String(g.gegevens?.reden || 'Verloren')
      return { soort: 'winback', bronSoort: 'deal_verloren', reden, verlorenAan: g.gegevens?.verlorenAan ?? null, regel: regelVoorReden(reden, stand, 'deal_verloren') }
    }
    case 'klant.slapend': {
      const maanden = Number(g.gegevens?.maandenNietBesteld)
      const reden = `${maanden} maanden niet besteld`
      return { soort: 'herwin', bronSoort: 'slapend', reden, maanden, laatsteOrder: g.gegevens?.laatsteOrder ?? null, regel: regelVoorReden(reden, stand, 'slapend') ?? stand.terugkomregels.find((r) => r.lijst === 'slapend' && r.reden === reden) ?? null }
    }
    case 'account.eigenaar-gewijzigd': return g.gegevens?.eigenaar ? { soort: 'eigenaar', eigenaar: String(g.gegevens.eigenaar) } : { soort: 'niets' }
    default: return { soort: 'niets' }
  }
}
