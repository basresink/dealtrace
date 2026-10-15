// Gezondheid van een klant (F23): vaste regels, geen score. Risico gaat boven
// Let op; Leeg gaat boven alles. Een telling die (nog) niet bestaat is undefined
// en die regel slaat de functie over (gat 48: tel wat er in deze sprint bestaat).

export type Stand = 'leeg' | 'risico' | 'let_op' | 'gezond'

export const STAND_LABEL: Record<Stand, string> = { leeg: 'Leeg', risico: 'Risico', let_op: 'Let op', gezond: 'Gezond' }

export interface Telling {
  gebruikers: number
  metLogin: number
  /** Laatste activiteit van welke soort ook: inloggen, pogingen, berichten, nieuwe prospects, afspraken. */
  laatstActief: string | null
  accounts?: number
  takenZonderAfronding30d?: number
  dagenMotorZonderResultaat?: number
  eersteGesprekkenPerVerkoperPerWeek?: number
}

export interface GezondheidInstellingen {
  afgesprokenEersteGesprekken?: number
}

const DAG = 24 * 3600 * 1000

export function gezondheid(t: Telling, nu: Date, instellingen: GezondheidInstellingen = {}): { stand: Stand; redenen: string[] } {
  if (t.gebruikers === 0) return { stand: 'leeg', redenen: ['Nog geen gebruikers'] }

  const dagenStil = t.laatstActief ? Math.floor((nu.getTime() - new Date(t.laatstActief).getTime()) / DAG) : null
  const risico: string[] = []
  if (t.metLogin === 0) risico.push('Niemand heeft ingelogd')
  if (dagenStil === null) risico.push('Nog nooit activiteit')
  else if (dagenStil > 30) risico.push(`${dagenStil} dagen geen activiteit`)
  if (t.accounts === 0) risico.push('Nog geen accounts')
  if (risico.length) return { stand: 'risico', redenen: risico }

  const letOp: string[] = []
  if (t.metLogin * 2 < t.gebruikers) letOp.push(`${t.metLogin} van ${t.gebruikers} gebruikers met login`)
  if (dagenStil !== null && dagenStil >= 15) letOp.push(`${dagenStil} dagen stil`)
  if (t.takenZonderAfronding30d) letOp.push('Taken zonder afronding in 30 dagen')
  if (t.dagenMotorZonderResultaat !== undefined && t.dagenMotorZonderResultaat >= 14) letOp.push('Motor 14 dagen zonder resultaat')
  if (instellingen.afgesprokenEersteGesprekken !== undefined && t.eersteGesprekkenPerVerkoperPerWeek !== undefined
    && t.eersteGesprekkenPerVerkoperPerWeek < instellingen.afgesprokenEersteGesprekken) letOp.push('Minder eerste gesprekken dan afgesproken')
  if (letOp.length) return { stand: 'let_op', redenen: letOp }

  return { stand: 'gezond', redenen: [] }
}
