// De CRM-adapterlaag (P20, F02): één interface, per CRM een implementatie. Lokaal en in tests altijd
// de mock (13.5); een echte HubSpot alleen met CRM_MODUS=http en een gekoppeld token.
import type { CrmBedrijf, CrmContact } from '../../../../shared/crm'

export interface CrmActiviteit { sleutel: string; bedrijfId: string; contactId?: string | null; onderwerp: string; tekst: string; datum: string; kanaal?: string | null; uitkomst?: string | null }
export interface CrmAdapter {
  test(): Promise<{ ok: boolean; melding: string; account?: string }>
  leesBedrijven(): Promise<CrmBedrijf[]>
  leesContacten(): Promise<CrmContact[]>
  schrijfBedrijf(velden: Record<string, unknown>, externId?: string | null): Promise<{ id: string }>
  schrijfContact(velden: Record<string, unknown>, bedrijfId: string, externId?: string | null): Promise<{ id: string }>
  /** Idempotent op de sleutel: een tweede keer dezelfde sleutel geeft hetzelfde id terug. */
  schrijfActiviteit(a: CrmActiviteit): Promise<{ id: string }>
  /** De overdracht na de eerste afspraak: een activiteit met de briefing; het CRM maakt de deal (B17). */
  schrijfOverdracht(a: CrmActiviteit, eigenaarEmail?: string | null): Promise<{ id: string }>
}

/** Een fout in gewone taal; tijdelijk = opnieuw proberen heeft zin (limiet, storing). */
export class CrmFout extends Error {
  constructor(message: string, public code: 'verlopen' | 'scope' | 'limiet' | 'veld' | 'fout' = 'fout', public tijdelijk = false) { super(message) }
}
export const crmModus = (): 'mock' | 'http' => (process.env.CRM_MODUS === 'http' ? 'http' : 'mock')
