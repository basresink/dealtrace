// De mock van het CRM (P20, 13.5): vaste fictieve fixtures in de lijn van Voltvast (Bijlage C), per
// organisatie een eigen geheugen. Twee klanten in br-01 en br-02, twee prospects, één met hetzelfde
// KvK-nummer als pr-01 uit de seed en één zonder eigenaar. Alles wat geschreven wordt, staat in MOCK_CRM.
import type { CrmBedrijf, CrmContact } from '../../../../shared/crm'
import type { CrmActiviteit, CrmAdapter } from './adapter'

const vandaag = () => new Date()
const maandenTerug = (n: number) => { const d = vandaag(); d.setUTCMonth(d.getUTCMonth() - n); return d.toISOString().slice(0, 10) }
export function mockFixtures(): { bedrijven: CrmBedrijf[]; contacten: CrmContact[] } {
  return {
    bedrijven: [
      { id: 'hs-101', eigenaar: 'anouk@voltvast.test', velden: { name: 'Testklant Warmtewerk', kvk_nummer: '99100101', domain: 'warmtewerk.test', city: 'Deventer', zip: '7411 AB', numberofemployees: '24', lifecyclestage: 'customer', laatste_order: maandenTerug(1), branche: 'br-01' } },
      { id: 'hs-102', eigenaar: 'SANNE@voltvast.test', velden: { name: 'Testklant Leidingbouw', kvk_nummer: '99100102', domain: 'www.leidingbouw.test', city: 'Zwolle', zip: '8011 CD', numberofemployees: '40', lifecyclestage: 'customer', laatste_order: maandenTerug(7), branche: 'br-02' } },
      { id: 'hs-103', eigenaar: 'bram@voltvast.test', velden: { name: 'Testprospect Gasvast', kvk_nummer: '99100103', domain: 'gasvast.test', city: 'Apeldoorn', zip: '7311 EF', numberofemployees: '12', lifecyclestage: 'lead', branche: 'br-01' } },
      { id: 'hs-104', eigenaar: null, velden: { name: 'Testprospect Kabelkracht', kvk_nummer: '99100104', domain: 'kabelkracht.test', city: 'Enschede', zip: '7511 GH', numberofemployees: '8', lifecyclestage: 'opportunity', branche: 'br-02' } },
      { id: 'hs-105', eigenaar: 'onbekend@voltvast.test', velden: { name: 'Testinstallatie Koperwiek B.V.', kvk_nummer: '99000101', domain: 'koperwiek.test', city: 'Deventer', phone: '0570 000 101', lifecyclestage: 'lead' } },
    ],
    contacten: [
      { id: 'hc-201', bedrijfId: 'hs-101', velden: { firstname: 'Tessa', lastname: 'Testwarm', email: 'tessa@warmtewerk.test', jobtitle: 'Inkoper' } },
      { id: 'hc-202', bedrijfId: 'hs-103', velden: { firstname: 'Gijs', lastname: 'Testgas', email: 'gijs@gasvast.test', jobtitle: 'Directeur', phone: '055 000 0103' } },
      { id: 'hc-203', bedrijfId: 'hs-104', velden: { firstname: '', lastname: 'Testkabel', email: 'info@kabelkracht.test' } },
    ],
  }
}

interface Geheugen { bedrijven: CrmBedrijf[]; contacten: CrmContact[]; activiteiten: (CrmActiviteit & { id: string; overdracht?: boolean; eigenaar?: string | null })[]; volg: number }
/** Per organisatie: wat de mock-CRM bevat en wat Dealtrace schreef (voor tests en het voorbeeld). */
export const MOCK_CRM = new Map<string, Geheugen>()
export function mockGeheugen(org: string): Geheugen {
  let g = MOCK_CRM.get(org)
  if (!g) { g = { ...mockFixtures(), activiteiten: [], volg: 900 }; MOCK_CRM.set(org, g) }
  return g
}

export function mockAdapter(org: string, opties: { verlopen?: boolean } = {}): CrmAdapter {
  const g = () => mockGeheugen(org)
  const controleer = () => { if (opties.verlopen) throw Object.assign(new Error('De koppeling met HubSpot is verlopen. Verbind opnieuw om verder te synchroniseren.'), { code: 'verlopen' }) }
  return {
    async test() { controleer(); return { ok: true, melding: 'De verbinding met HubSpot werkt.', account: 'Testportaal Voltvast' } },
    async leesBedrijven() { controleer(); return structuredClone(g().bedrijven) },
    async leesContacten() { controleer(); return structuredClone(g().contacten) },
    async schrijfBedrijf(velden, externId) {
      controleer()
      const b = externId ? g().bedrijven.find((x) => x.id === externId) : undefined
      if (b) { b.velden = { ...b.velden, ...velden }; return { id: b.id } }
      const id = `hs-${++g().volg}`
      g().bedrijven.push({ id, eigenaar: (velden.eigenaar as string) ?? null, velden: { ...velden } })
      return { id }
    },
    async schrijfContact(velden, bedrijfId, externId) {
      controleer()
      const c = externId ? g().contacten.find((x) => x.id === externId) : undefined
      if (c) { c.velden = { ...c.velden, ...velden }; return { id: c.id } }
      const id = `hc-${++g().volg}`
      g().contacten.push({ id, bedrijfId, velden: { ...velden } })
      return { id }
    },
    async schrijfActiviteit(a) {
      controleer()
      const al = g().activiteiten.find((x) => x.sleutel === a.sleutel)
      if (al) return { id: al.id }
      const id = `ha-${++g().volg}`
      g().activiteiten.push({ ...a, id })
      return { id }
    },
    async schrijfOverdracht(a, eigenaarEmail) {
      controleer()
      const al = g().activiteiten.find((x) => x.sleutel === a.sleutel)
      if (al) return { id: al.id }
      const id = `ha-${++g().volg}`
      g().activiteiten.push({ ...a, id, overdracht: true, eigenaar: eigenaarEmail ?? null })
      if (eigenaarEmail) { const b = g().bedrijven.find((x) => x.id === a.bedrijfId); if (b) b.eigenaar = eigenaarEmail }
      return { id }
    },
  }
}
