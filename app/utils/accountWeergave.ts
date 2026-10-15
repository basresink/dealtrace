// Labels en pillen voor accounts en contacten (één plek voor alle schermen).
export const STATUS_LABEL: Record<string, string> = {
  nieuw: 'Nieuw', 'in reis': 'In reis', wachtend: 'Wachtend', nee: 'Nee', gescoord: 'Gescoord', klant: 'Klant', overgedragen: 'Overgedragen',
}
export const STATUS_PIL: Record<string, string> = {
  nieuw: 'pil--blauw', 'in reis': 'pil--paars', wachtend: 'pil--geel', nee: 'pil--grijs', gescoord: 'pil--groen', klant: 'pil--blauw-vol', overgedragen: 'pil--groen-vol',
}
export const BEREIK_LABEL: Record<string, string> = { zonderTelefoon: 'Zonder telefoon', zonderEmail: 'Zonder e-mail', zonderBeslisser: 'Zonder beslisser' }
export const CONTACT_LABEL: Record<string, string> = { nooit: 'Nog nooit', 30: 'Ouder dan 30 dagen', 90: 'Ouder dan 90 dagen' }

export function klasseKort(id: string | null | undefined, klassen: { id: string; naam: string }[]): string {
  if (!id) return ''
  const k = klassen.find((x) => x.id === id)
  return k ? k.naam.split('·')[0]!.trim() : id
}

export function initialen(naam: string): string {
  return naam.replace(/^Test/, '').split(/\s+/).filter(Boolean).map((d) => d[0]).slice(0, 2).join('').toUpperCase() || '?'
}

export function datumKort(t: string | null | undefined): string {
  return t ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(t)) : 'nog nooit'
}

/** Telefoonlink voor een E.164-nummer. */
export const telLink = (n: string) => `tel:${n.replace(/\s/g, '')}`

export const SCORE_DELEN: Record<string, string> = {
  aanleiding: 'Versheid van aanleidingen', bereikbaarheid: 'Bereikbaarheid', fit: 'Fit met de doelgroep', momentum: 'Momentum', recentheid: 'Recentheid van contact',
}

/** +31331000101 wordt +31 33 100 0101; +31612345678 wordt +31 6 1234 5678. */
export function toonTelefoon(n: string | null | undefined): string {
  if (!n) return ''
  const m = /^\+31(6)(\d{4})(\d{4})$/.exec(n) ?? /^\+31(\d{2})(\d{3})(\d{4})$/.exec(n)
  return m ? `+31 ${m[1]} ${m[2]} ${m[3]}` : n
}
