// Fictief importbestand (Bijlage C): installateurs in Midden- en Noord-Nederland,
// verzonnen namen, KvK-nummers in de reeks 9900xxxx en domeinen op .test.
// Opbouw: nieuw, 50 al in het bestand (KvK van de seed-accounts), 30 dubbel binnen
// het bestand en 20 met fouten. Gebruikt door tests en de e2e-wizard.
import { schrijfCsv } from '../../shared/csv'

export const KOP = ['Bedrijfsnaam', 'KvK-nummer', 'Website', 'Postcode', 'Plaats', 'Telefoon', 'Voornaam', 'Achternaam', 'Functie', 'E-mail', 'Aantal monteurs', 'Laatste contact']

export function maakImportRijen(aantal = 1000, opties: { bestaandeDomeinen?: string[]; alIn?: number; dubbel?: number; fouten?: number } = {}): string[][] {
  const { bestaandeDomeinen = [], alIn = 50, dubbel = 30, fouten = 20 } = opties
  const plaatsen = ['Amersfoort', 'Zwolle', 'Groningen', 'Assen', 'Utrecht', 'Apeldoorn', 'Leeuwarden', 'Emmen']
  const rijen: string[][] = []
  const nieuw = aantal - alIn - dubbel - fouten
  for (let i = 0; i < nieuw; i++) {
    const n = String(i).padStart(4, '0')
    rijen.push([`Testimport Installatie ${n}`, `9950${n}`, `testimport${n}.test`, `${3800 + (i % 100)} TA`, plaatsen[i % plaatsen.length]!, `033${String(1000000 + i).slice(-7)}`, 'Pim', `Testimport${n}`, 'Directeur', `pim${n}@testimport${n}.test`, String(5 + (i % 40)), '2025-01-01'])
  }
  for (let i = 0; i < alIn; i++) {
    // Een bestaand account onder een andere naam: gevonden op domein (www. en hoofdletters doen niet mee).
    const domein = bestaandeDomeinen[i] ?? `onbekend${i}.test`
    rijen.push([`Andere Naam Voor Bestaand ${i}`, '', `https://WWW.${domein}`, '', 'Utrecht', '', '', '', '', '', '', ''])
  }
  for (let i = 0; i < dubbel; i++) {
    const n = String(i).padStart(4, '0')
    rijen.push([`Testimport Installatie ${n} B.V.`, `9950${n}`, '', '', '', '', 'Sanne', `Testdubbel${n}`, 'Inkoper', `sanne${n}@testimport${n}.test`, '', ''])
  }
  for (let i = 0; i < fouten; i++) {
    const n = String(i).padStart(4, '0')
    rijen.push([`Testfout Techniek ${n}`, '', '', i % 2 ? '3512 A' : '1234AB', 'Zeist', i % 2 ? '' : '12345', '', '', '', i % 2 ? 'geen-email' : '', i % 3 === 0 ? 'veel' : '', ''])
  }
  return rijen
}

export function maakImportCsv(aantal = 1000, opties: Parameters<typeof maakImportRijen>[1] = {}): string {
  return schrijfCsv([KOP, ...maakImportRijen(aantal, opties)])
}
