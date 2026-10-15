// Patch op een account of contact verwerken: basisvelden, eigen velden (gevalideerd,
// per niveau en bewerkrecht), herkomst "hand" en wissen met null (gat 10).
import { valideerWaarde, type VeldDefinitie } from '../../shared/eigenVelden'

export function pasEigenVeldenToe(
  huidig: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
  velden: (VeldDefinitie & { id: string })[],
  mag: { rol: string; eigenaar: boolean },
  herkomst: Record<string, any>,
  door: string,
): Record<string, unknown> {
  const cf = { ...(huidig ?? {}) }
  if (!patch) return cf
  const op = new Date().toISOString()
  for (const [sleutel, waarde] of Object.entries(patch)) {
    const v = velden.find((x) => x.sleutel === sleutel)
    if (!v) throw createError({ statusCode: 400, statusMessage: `Onbekend of niet zichtbaar veld: ${sleutel}` })
    const recht = v.data.bewerkbaarDoor ?? 'iedereen'
    if (recht === 'beheerder' && mag.rol !== 'beheerder') throw createError({ statusCode: 403, statusMessage: `${v.naam} wijzigt alleen de beheerder` })
    if (recht === 'eigenaarEnManager' && !mag.eigenaar && !['salesmanager', 'beheerder'].includes(mag.rol)) throw createError({ statusCode: 403, statusMessage: `${v.naam} wijzigt alleen de eigenaar of een manager` })
    const r = valideerWaarde(v, waarde)
    if (!r.ok) throw createError({ statusCode: 400, statusMessage: r.fout })
    if (r.waarde === null) delete cf[sleutel]
    else cf[sleutel] = r.waarde
    herkomst[`cf.${sleutel}`] = { bron: 'hand', op, door }
  }
  return cf
}

/** Basisvelden in data: null wist, tekst wordt getrimd; herkomst "hand". */
export function pasDataToe(data: Record<string, any>, patch: Record<string, unknown>, sleutels: string[], door: string) {
  const op = new Date().toISOString()
  const herkomst = { ...(data.herkomst ?? {}) }
  for (const k of sleutels) {
    if (!(k in patch)) continue
    const w = patch[k]
    if (w === null || w === '') delete data[k]
    else data[k] = typeof w === 'string' ? w.trim() : w
    herkomst[k] = { bron: 'hand', op, door }
  }
  data.herkomst = herkomst
  return data
}
