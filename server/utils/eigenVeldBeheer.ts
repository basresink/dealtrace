import { MAX_VELDEN_PER_OBJECT, VELDTYPEN, VELD_OBJECTEN, type VeldDefinitie } from '../../shared/eigenVelden'
import type { Niveau } from '../../shared/types'

/** Controleert en normaliseert een definitie uit een formulier. */
export function leesDefinitie(b: any): Omit<VeldDefinitie, 'sleutel' | 'object'> & { object?: string } {
  const naam = String(b.naam ?? '').trim()
  if (!naam) throw createError({ statusCode: 400, statusMessage: 'Naam is verplicht' })
  if (!(VELDTYPEN as readonly string[]).includes(b.type)) throw createError({ statusCode: 400, statusMessage: 'Onbekend type' })
  if (b.object && !(VELD_OBJECTEN as readonly string[]).includes(b.object)) throw createError({ statusCode: 400, statusMessage: 'Onbekend object' })
  const d = b.data ?? {}
  const opties = Array.isArray(d.opties) ? d.opties.filter((o: any) => o?.waarde).map((o: any) => ({ waarde: String(o.waarde).trim(), label: String(o.label ?? o.waarde).trim(), kleur: o.kleur })) : []
  if (['keuzelijst', 'meerkeuze'].includes(b.type) && !opties.length) throw createError({ statusCode: 400, statusMessage: 'Een keuzelijst heeft minstens één optie' })
  const niveaus: Niveau[] = ['beginner', 'gevorderd', 'expert']
  return {
    object: b.object, naam, type: b.type, sectie: String(b.sectie ?? 'Stamgegevens').trim() || 'Stamgegevens', volgorde: Number(b.volgorde) || 0,
    data: {
      opties, verplicht: ['nee', 'bijAanmaken', 'bijFase'].includes(d.verplicht) ? d.verplicht : 'nee', standaard: d.standaard ?? null,
      hulp: d.hulp ? String(d.hulp).slice(0, 300) : undefined, zichtbaarVanaf: niveaus.includes(d.zichtbaarVanaf) ? d.zichtbaarVanaf : 'beginner',
      bewerkbaarDoor: ['iedereen', 'eigenaarEnManager', 'beheerder'].includes(d.bewerkbaarDoor) ? d.bewerkbaarDoor : 'iedereen',
      filterbaar: !!d.filterbaar, bron: ['handmatig', 'import', 'kvk', 'datacollectief', 'crm'].includes(d.bron) ? d.bron : 'handmatig', toonInKop: !!d.toonInKop,
    },
  }
}
export { MAX_VELDEN_PER_OBJECT }
