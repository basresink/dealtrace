// Status prospect: hoe warm een prospect is, met de hand gekozen door de accountmanager. Vier keuzes van
// koud naar heet; geen keuze is "nog geen status". Opslag in accounts.data.prospectStatus, met een
// auditregel per wijziging (server/utils/prospectStatus.ts). Het label staat in shared/labels.ts
// (soort prospectstatus) en Mijn dashboard telt de prospects per status.

export const PROSPECT_STATUSSEN = ['koud', 'lauw', 'warm', 'heet'] as const
export type ProspectStatus = (typeof PROSPECT_STATUSSEN)[number]

export const PROSPECT_STATUS_LABEL: Record<ProspectStatus, string> = { koud: 'Koud', lauw: 'Lauw', warm: 'Warm', heet: 'Heet' }

export const isProspectStatus = (v: unknown): v is ProspectStatus => typeof v === 'string' && (PROSPECT_STATUSSEN as readonly string[]).includes(v)

/** De status uit accounts.data; een onbekende waarde telt als geen status. */
export const prospectStatusUit = (data: unknown): ProspectStatus | null => {
  const v = (data as { prospectStatus?: unknown } | null | undefined)?.prospectStatus
  return isProspectStatus(v) ? v : null
}

export interface StatusKolom { sleutel: ProspectStatus; label: string; aantal: number; procent: number }

/** Aantal prospects per status in vaste volgorde (koud, lauw, warm, heet), plus hoeveel nog geen status hebben. */
export function telPerStatus(statussen: (string | null | undefined)[]): { kolommen: StatusKolom[]; zonder: number; totaal: number } {
  const tel: Record<ProspectStatus, number> = { koud: 0, lauw: 0, warm: 0, heet: 0 }
  let zonder = 0
  for (const s of statussen) {
    if (isProspectStatus(s)) tel[s]++
    else zonder++
  }
  const met = PROSPECT_STATUSSEN.reduce((n, s) => n + tel[s], 0)
  return {
    kolommen: PROSPECT_STATUSSEN.map((s) => ({ sleutel: s, label: PROSPECT_STATUS_LABEL[s], aantal: tel[s], procent: met ? Math.round((tel[s] / met) * 100) : 0 })),
    zonder,
    totaal: statussen.length,
  }
}
