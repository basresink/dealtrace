// Eigen velden (F19): typen, validatie, zichtbaarheid per niveau en sleutels.
import type { Niveau } from './types'
import { geldigEmail, normaliseerTelefoon } from './contactgegevens'

export const VELDTYPEN = ['tekst', 'langeTekst', 'getal', 'bedrag', 'datum', 'janee', 'keuzelijst', 'meerkeuze', 'telefoon', 'email', 'link', 'gebruiker'] as const
export type Veldtype = typeof VELDTYPEN[number]
export const VELDTYPE_LABEL: Record<Veldtype, string> = {
  tekst: 'Tekst', langeTekst: 'Lange tekst', getal: 'Getal', bedrag: 'Bedrag', datum: 'Datum', janee: 'Ja of nee',
  keuzelijst: 'Keuzelijst', meerkeuze: 'Meerkeuze', telefoon: 'Telefoon', email: 'E-mail', link: 'Link', gebruiker: 'Gebruiker',
}
export const VELD_OBJECTEN = ['account', 'contact', 'campagne', 'afspraak', 'accountplan'] as const
export type VeldObject = typeof VELD_OBJECTEN[number]
export const MAX_VELDEN_PER_OBJECT = 100

export interface Optie { waarde: string; label: string; kleur?: string }
export interface VeldDefinitie {
  id?: string
  object: VeldObject
  sleutel: string
  naam: string
  type: Veldtype
  sectie: string
  volgorde?: number
  gearchiveerd?: boolean
  data: {
    opties?: Optie[]
    verplicht?: 'nee' | 'bijAanmaken' | 'bijFase'
    standaard?: unknown
    hulp?: string
    zichtbaarVanaf?: Niveau
    bewerkbaarDoor?: 'iedereen' | 'eigenaarEnManager' | 'beheerder'
    filterbaar?: boolean
    bron?: 'handmatig' | 'import' | 'kvk' | 'datacollectief' | 'crm'
    toonInKop?: boolean
    /** Meenemen in Datakwaliteit: een lege waarde telt als gat ("Zonder <naam>"); alleen account en contact. */
    datakwaliteit?: boolean
  }
}

const NIVEAUS: Niveau[] = ['beginner', 'gevorderd', 'expert']

/** De velden die een niveau mag zien; gearchiveerd nooit. */
export function veldenVoorNiveau<T extends Pick<VeldDefinitie, 'gearchiveerd' | 'data'>>(velden: T[], niveau: Niveau): T[] {
  return velden.filter((v) => !v.gearchiveerd && NIVEAUS.indexOf(niveau) >= NIVEAUS.indexOf(v.data.zichtbaarVanaf ?? 'beginner'))
}

/** Valideert (en normaliseert) een waarde. null of '' wist het veld. */
export function valideerWaarde(veld: Pick<VeldDefinitie, 'type' | 'data' | 'naam'>, waarde: unknown): { ok: true; waarde: unknown } | { ok: false; fout: string } {
  if (waarde === null || waarde === undefined || waarde === '') return { ok: true, waarde: null }
  const fout = (f: string) => ({ ok: false as const, fout: `${veld.naam}: ${f}` })
  switch (veld.type) {
    case 'tekst': case 'langeTekst': case 'link':
      if (typeof waarde !== 'string') return fout('verwacht tekst')
      if (veld.type === 'link' && !/^https?:\/\/\S+$/.test(waarde)) return fout('geen geldige link')
      return { ok: true, waarde: waarde.trim() }
    case 'getal': case 'bedrag': {
      const n = typeof waarde === 'number' ? waarde : Number(String(waarde).replace(',', '.'))
      return Number.isFinite(n) ? { ok: true, waarde: n } : fout('verwacht een getal')
    }
    case 'datum':
      return typeof waarde === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(waarde) && !Number.isNaN(Date.parse(waarde)) ? { ok: true, waarde } : fout('verwacht een datum (jjjj-mm-dd)')
    case 'janee':
      if (typeof waarde === 'boolean') return { ok: true, waarde }
      if (['ja', 'true', '1'].includes(String(waarde).toLowerCase())) return { ok: true, waarde: true }
      if (['nee', 'false', '0'].includes(String(waarde).toLowerCase())) return { ok: true, waarde: false }
      return fout('verwacht ja of nee')
    case 'keuzelijst': {
      const opties = (veld.data.opties ?? []).map((o) => o.waarde)
      return opties.includes(String(waarde)) ? { ok: true, waarde: String(waarde) } : fout(`onbekende keuze "${waarde}"`)
    }
    case 'meerkeuze': {
      const lijst = Array.isArray(waarde) ? waarde.map(String) : String(waarde).split(/[;,]/).map((x) => x.trim()).filter(Boolean)
      const opties = new Set((veld.data.opties ?? []).map((o) => o.waarde))
      const onbekend = lijst.find((x) => !opties.has(x))
      return onbekend ? fout(`onbekende keuze "${onbekend}"`) : { ok: true, waarde: lijst }
    }
    case 'telefoon': {
      const t = normaliseerTelefoon(String(waarde))
      return t.ok ? { ok: true, waarde: t.e164 } : fout(t.fout)
    }
    case 'email':
      return geldigEmail(String(waarde)) ? { ok: true, waarde: String(waarde).trim().toLowerCase() } : fout('geen geldig e-mailadres')
    case 'gebruiker':
      return typeof waarde === 'string' ? { ok: true, waarde } : fout('verwacht een gebruiker')
  }
}

/** Sleutel uit de naam: kleine letters, underscores, uniek binnen het object. */
export function sleutelUitNaam(naam: string, bestaand: Iterable<string> = []): string {
  const basis = naam.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  let sleutel = /^[a-z]/.test(basis) ? basis.slice(0, 50) : `veld_${basis}`.slice(0, 50)
  if (!sleutel || sleutel === 'veld_') sleutel = 'veld'
  const set = new Set(bestaand)
  if (!set.has(sleutel)) return sleutel
  let i = 2
  while (set.has(`${sleutel}_${i}`)) i++
  return `${sleutel}_${i}`
}

/** Variabele voor scripts en sjablonen. */
export const cfVariabele = (sleutel: string) => `{cf.${sleutel}}`

/** Mag het type wijzigen? Geeft de records waarvan de waarde ongeldig zou worden. */
export function typeWisselAfwijkend(nieuw: Pick<VeldDefinitie, 'type' | 'data' | 'naam'>, waarden: { id: string; waarde: unknown }[]): string[] {
  return waarden.filter((w) => !valideerWaarde(nieuw, w.waarde).ok).map((w) => w.id)
}
