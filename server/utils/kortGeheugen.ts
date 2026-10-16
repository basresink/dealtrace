// Een kort geheugen per serverinstantie voor wat elk verzoek nodig heeft maar zelden verandert: de
// organisatiecontext (organisatie, "iedereen ziet alles", functies per niveau) en de geldigheid van een
// toestel. Online kost elke databasevraag een rondreis naar de database; dit scheelt er zes tot zeven per
// verzoek. Wie deze gegevens wijzigt, wist ze meteen (op dezelfde instantie); andere instanties zien de
// wijziging uiterlijk na de bewaartijd.
const opslag = new Map<string, { tot: number; waarde: Promise<unknown> }>()

export function onthoud<T>(sleutel: string, ms: number, maak: () => Promise<T>): Promise<T> {
  const nu = Date.now()
  const h = opslag.get(sleutel)
  if (h && h.tot > nu) return h.waarde as Promise<T>
  const waarde = maak()
  opslag.set(sleutel, { tot: nu + ms, waarde })
  // Een mislukte lezing bewaren we niet.
  waarde.catch(() => opslag.delete(sleutel))
  if (opslag.size > 2000) for (const [k, v] of opslag) if (v.tot <= nu) opslag.delete(k)
  return waarde
}

/** Wis alles wat met dit voorvoegsel begint (zonder voorvoegsel: alles). */
export function vergeet(voorvoegsel = '') {
  for (const k of opslag.keys()) if (k.startsWith(voorvoegsel)) opslag.delete(k)
}
export const vergeetOrganisaties = () => vergeet('org:')
