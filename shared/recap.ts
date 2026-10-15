// Recap (P32, 8.13, uit dexRecap): na 16:00 bovenaan Vandaag. Verslagen eerst, dan de
// terugkomregels van morgen; vanaf Gevorderd de risico's, voor Expert de weekterugblik. Puur.
import { nlMoment } from './datum'
import type { Vorm } from './dagritme'

export interface RecapBron { zonderVerslag: { accountNaam: string | null; taakId: string | null }[]; morgenTerug: { id: string; naam: string }[]; achterstallig: number; reisStil: number; week?: { gesprekken: number; afspraken: number; overgedragen: number } | null }
export interface Recap { titel: string; regels: string[]; verslagen: number; morgen: number; risicos: string[]; week: string | null }

export const RECAP_VANAF_UUR = 16
const mv = (n: number, een: string, meer: string) => `${n} ${n === 1 ? een : meer}`

export function bouwRecap(bron: RecapBron, niveau: 'beginner' | 'gevorderd' | 'expert', nu: Date, vorm: Vorm = 'dagstart'): Recap | null {
  if (nlMoment(nu).uur < RECAP_VANAF_UUR) return null
  const regels: string[] = []
  if (bron.zonderVerslag.length) regels.push(`${mv(bron.zonderVerslag.length, 'gesprek', 'gesprekken')} zonder verslag`)
  if (bron.morgenTerug.length) regels.push(`Morgen ${bron.morgenTerug.length === 1 ? 'komt' : 'komen'} ${mv(bron.morgenTerug.length, 'account', 'accounts')} terug: ${bron.morgenTerug.slice(0, 3).map((a) => a.naam).join(', ')}`)
  const risicos: string[] = []
  if (niveau !== 'beginner') {
    if (bron.achterstallig) risicos.push(`${mv(bron.achterstallig, 'actie', 'acties')} achterstallig`)
    if (bron.reisStil) risicos.push(`${mv(bron.reisStil, 'reis staat', 'reizen staan')} stil`)
  }
  const week = niveau === 'expert' && bron.week
    ? `Deze week: ${mv(bron.week.gesprekken, 'gesprek', 'gesprekken')}, ${mv(bron.week.afspraken, 'afspraak', 'afspraken')}, ${bron.week.overgedragen} overgedragen.` : null
  if (!regels.length && !risicos.length && !week) regels.push('Alles is vastgelegd. Goed gedaan.')
  return { titel: vorm === 'weekafsluiting' ? 'De week in het kort' : 'De dag in het kort', regels, verslagen: bron.zonderVerslag.length, morgen: bron.morgenTerug.length, risicos, week }
}
