// Teksten voor accounts en contacten (één plek voor alle schermen). Labels staan in shared/labels.ts.
export const STATUS_LABEL: Record<string, string> = {
  nieuw: 'Nieuw', 'in reis': 'In reis', wachtend: 'Wachtend', nee: 'Nee', gescoord: 'Gescoord', klant: 'Klant', overgedragen: 'Overgedragen',
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
/** Alleen cijfers en een plus aan het begin, zodat ook 030-200 13 70 of (06) 1234 5678 op elke telefoon belt. */
export const telLink = (n: string) => `tel:${n.trim().replace(/(?!^\+)[^\d]/g, '')}`

export const SCORE_DELEN: Record<string, string> = {
  aanleiding: 'Versheid van aanleidingen', bereikbaarheid: 'Bereikbaarheid', fit: 'Fit met de doelgroep', momentum: 'Momentum', recentheid: 'Recentheid van contact',
}

/** +31331000101 wordt +31 33 100 0101; +31612345678 wordt +31 6 1234 5678. */
export function toonTelefoon(n: string | null | undefined): string {
  if (!n) return ''
  const m = /^\+31(6)(\d{4})(\d{4})$/.exec(n) ?? /^\+31(\d{2})(\d{3})(\d{4})$/.exec(n)
  return m ? `+31 ${m[1]} ${m[2]} ${m[3]}` : n
}

/** Klassenaam voor het klasselabel: "A · Corporate" zonder de toelichting tussen haakjes. */
export function klasseLabel(id: string | null | undefined, klassen: { id: string; naam: string }[]): string {
  if (!id) return ''
  const k = klassen.find((x) => x.id === id)
  return k ? k.naam.replace(/\s*\([^)]*\)\s*$/, '').trim() : id
}

const NAAM_KLEUREN = ['var(--blue)', 'var(--green)', 'var(--purple)', 'var(--orange)', 'var(--red)', 'var(--ink)']
/** Vaste kleur per naam of id: hetzelfde bedrijf houdt dezelfde kleur. */
export function kleurUitNaam(naam: string): string {
  let som = 0
  for (let i = 0; i < naam.length; i++) som = (som * 31 + naam.charCodeAt(i)) >>> 0
  return NAAM_KLEUREN[som % NAAM_KLEUREN.length]!
}

/** "1 aug", met jaartal als het niet dit jaar is; zonder datum "geen". */
export function datumActiviteit(t: string | null | undefined, nu = new Date()): string {
  if (!t) return 'geen'
  const d = new Date(t)
  const opties: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', ...(d.getFullYear() === nu.getFullYear() ? {} : { year: 'numeric' }) }
  return new Intl.DateTimeFormat('nl-NL', opties).format(d).replace('.', '')
}
