// Plaatsen- en postcoderegister voor de terugval van de geocodering (P14, F18). Bij benadering: het
// middelpunt van een plaats en van een postcodegebied van twee cijfers. Een account met alleen een
// postcode of plaats krijgt zo toch een punt, met de herkomst "op postcode" of "op plaats".
export type Punt = { lat: number; lng: number }

export const PLAATSEN: Record<string, Punt> = {
  'amsterdam': { lat: 52.37, lng: 4.90 }, 'rotterdam': { lat: 51.92, lng: 4.48 }, 'den haag': { lat: 52.08, lng: 4.30 }, 'utrecht': { lat: 52.09, lng: 5.12 },
  'eindhoven': { lat: 51.44, lng: 5.48 }, 'groningen': { lat: 53.22, lng: 6.57 }, 'tilburg': { lat: 51.56, lng: 5.09 }, 'almere': { lat: 52.37, lng: 5.21 },
  'breda': { lat: 51.59, lng: 4.78 }, 'nijmegen': { lat: 51.84, lng: 5.85 }, 'apeldoorn': { lat: 52.21, lng: 5.97 }, 'arnhem': { lat: 51.98, lng: 5.91 },
  'haarlem': { lat: 52.38, lng: 4.64 }, 'enschede': { lat: 52.22, lng: 6.89 }, 'amersfoort': { lat: 52.16, lng: 5.39 }, "'s-hertogenbosch": { lat: 51.69, lng: 5.30 },
  'zwolle': { lat: 52.51, lng: 6.09 }, 'leeuwarden': { lat: 53.20, lng: 5.80 }, 'leiden': { lat: 52.16, lng: 4.49 }, 'maastricht': { lat: 50.85, lng: 5.69 },
  'dordrecht': { lat: 51.81, lng: 4.67 }, 'zoetermeer': { lat: 52.06, lng: 4.49 }, 'deventer': { lat: 52.25, lng: 6.16 }, 'delft': { lat: 52.01, lng: 4.36 },
  'alkmaar': { lat: 52.63, lng: 4.75 }, 'venlo': { lat: 51.37, lng: 6.17 }, 'helmond': { lat: 51.48, lng: 5.66 }, 'emmen': { lat: 52.79, lng: 6.90 },
  'hilversum': { lat: 52.22, lng: 5.18 }, 'assen': { lat: 52.99, lng: 6.56 }, 'lelystad': { lat: 52.52, lng: 5.47 }, 'meppel': { lat: 52.70, lng: 6.19 },
  'hoogeveen': { lat: 52.72, lng: 6.48 }, 'kampen': { lat: 52.56, lng: 5.91 }, 'harderwijk': { lat: 52.34, lng: 5.62 }, 'zeist': { lat: 52.09, lng: 5.23 },
  'veenendaal': { lat: 52.03, lng: 5.56 }, 'drachten': { lat: 53.11, lng: 6.10 }, 'sneek': { lat: 53.03, lng: 5.66 }, 'heerenveen': { lat: 52.96, lng: 5.92 },
  'hengelo': { lat: 52.27, lng: 6.79 }, 'almelo': { lat: 52.36, lng: 6.66 }, 'ede': { lat: 52.04, lng: 5.67 }, 'doetinchem': { lat: 51.97, lng: 6.29 },
  'veendam': { lat: 53.10, lng: 6.88 }, 'winschoten': { lat: 53.14, lng: 7.03 }, 'stadskanaal': { lat: 52.99, lng: 6.95 }, 'middelburg': { lat: 51.50, lng: 3.61 },
  'gouda': { lat: 52.01, lng: 4.71 }, 'nieuwegein': { lat: 52.03, lng: 5.08 }, 'houten': { lat: 52.03, lng: 5.17 }, 'woerden': { lat: 52.08, lng: 4.88 },
  'barneveld': { lat: 52.14, lng: 5.58 }, 'nijkerk': { lat: 52.22, lng: 5.49 }, 'steenwijk': { lat: 52.79, lng: 6.12 }, 'coevorden': { lat: 52.66, lng: 6.74 },
  'hardenberg': { lat: 52.58, lng: 6.62 }, 'zutphen': { lat: 52.14, lng: 6.20 }, 'harlingen': { lat: 53.17, lng: 5.42 }, 'dokkum': { lat: 53.33, lng: 6.00 },
  'delfzijl': { lat: 53.33, lng: 6.92 }, 'emmeloord': { lat: 52.71, lng: 5.75 }, 'roden': { lat: 53.14, lng: 6.43 }, 'hoogezand': { lat: 53.16, lng: 6.76 },
}

/** Middelpunt per postcodegebied van twee cijfers (10 tot en met 99). */
const PC2: Record<string, Punt> = {}
const zet = (van: number, tot: number, p: Punt) => { for (let i = van; i <= tot; i++) PC2[String(i)] = p }
zet(10, 11, PLAATSEN['amsterdam']!); zet(12, 12, PLAATSEN['hilversum']!); zet(13, 13, PLAATSEN['almere']!); zet(14, 14, { lat: 52.50, lng: 4.95 }); zet(15, 15, { lat: 52.44, lng: 4.81 })
zet(16, 16, { lat: 52.64, lng: 5.06 }); zet(17, 17, { lat: 52.85, lng: 4.85 }); zet(18, 18, PLAATSEN['alkmaar']!); zet(19, 19, { lat: 52.48, lng: 4.66 }); zet(20, 21, PLAATSEN['haarlem']!)
zet(22, 23, PLAATSEN['leiden']!); zet(24, 24, { lat: 52.13, lng: 4.66 }); zet(25, 25, PLAATSEN['den haag']!); zet(26, 26, PLAATSEN['delft']!); zet(27, 27, PLAATSEN['zoetermeer']!)
zet(28, 28, PLAATSEN['gouda']!); zet(29, 29, { lat: 51.92, lng: 4.60 }); zet(30, 31, PLAATSEN['rotterdam']!); zet(32, 32, { lat: 51.84, lng: 4.33 }); zet(33, 33, PLAATSEN['dordrecht']!)
zet(34, 34, PLAATSEN['nieuwegein']!); zet(35, 35, PLAATSEN['utrecht']!); zet(36, 36, { lat: 52.13, lng: 5.03 }); zet(37, 37, PLAATSEN['zeist']!); zet(38, 38, PLAATSEN['amersfoort']!)
zet(39, 39, PLAATSEN['veenendaal']!); zet(40, 40, { lat: 51.89, lng: 5.43 }); zet(41, 41, { lat: 51.95, lng: 5.23 }); zet(42, 42, { lat: 51.83, lng: 4.97 }); zet(43, 43, { lat: 51.65, lng: 3.92 })
zet(44, 44, { lat: 51.50, lng: 3.89 }); zet(45, 45, { lat: 51.33, lng: 3.83 }); zet(46, 46, { lat: 51.49, lng: 4.29 }); zet(47, 47, { lat: 51.53, lng: 4.46 }); zet(48, 48, PLAATSEN['breda']!)
zet(49, 49, { lat: 51.64, lng: 4.86 }); zet(50, 50, PLAATSEN['tilburg']!); zet(51, 51, { lat: 51.69, lng: 5.07 }); zet(52, 52, PLAATSEN["'s-hertogenbosch"]!); zet(53, 53, { lat: 51.77, lng: 5.52 })
zet(54, 54, { lat: 51.66, lng: 5.62 }); zet(55, 55, { lat: 51.42, lng: 5.40 }); zet(56, 56, PLAATSEN['eindhoven']!); zet(57, 57, PLAATSEN['helmond']!); zet(58, 58, { lat: 51.53, lng: 5.98 })
zet(59, 59, PLAATSEN['venlo']!); zet(60, 60, { lat: 51.25, lng: 5.71 }); zet(61, 61, { lat: 51.00, lng: 5.87 }); zet(62, 62, PLAATSEN['maastricht']!); zet(63, 64, { lat: 50.89, lng: 5.98 })
zet(65, 65, PLAATSEN['nijmegen']!); zet(66, 66, { lat: 51.81, lng: 5.73 }); zet(67, 67, PLAATSEN['ede']!); zet(68, 68, PLAATSEN['arnhem']!); zet(69, 69, { lat: 51.93, lng: 6.07 })
zet(70, 70, PLAATSEN['doetinchem']!); zet(71, 71, { lat: 51.97, lng: 6.72 }); zet(72, 72, PLAATSEN['zutphen']!); zet(73, 73, PLAATSEN['apeldoorn']!); zet(74, 74, PLAATSEN['deventer']!)
zet(75, 75, PLAATSEN['enschede']!); zet(76, 76, PLAATSEN['almelo']!); zet(77, 77, PLAATSEN['hardenberg']!); zet(78, 78, PLAATSEN['emmen']!); zet(79, 79, PLAATSEN['hoogeveen']!)
zet(80, 80, PLAATSEN['zwolle']!); zet(81, 81, { lat: 52.39, lng: 6.27 }); zet(82, 82, { lat: 52.52, lng: 5.60 }); zet(83, 83, PLAATSEN['emmeloord']!); zet(84, 84, PLAATSEN['heerenveen']!)
zet(85, 85, { lat: 52.97, lng: 5.79 }); zet(86, 86, PLAATSEN['sneek']!); zet(87, 87, { lat: 53.06, lng: 5.53 }); zet(88, 88, { lat: 53.19, lng: 5.54 }); zet(89, 89, PLAATSEN['leeuwarden']!)
zet(90, 90, { lat: 53.10, lng: 5.85 }); zet(91, 91, PLAATSEN['dokkum']!); zet(92, 92, PLAATSEN['drachten']!); zet(93, 93, PLAATSEN['roden']!); zet(94, 94, PLAATSEN['assen']!)
zet(95, 95, PLAATSEN['stadskanaal']!); zet(96, 96, PLAATSEN['hoogezand']!); zet(97, 97, PLAATSEN['groningen']!); zet(98, 98, { lat: 53.30, lng: 6.55 }); zet(99, 99, PLAATSEN['delfzijl']!)
export { PC2 }

/** Synoniemen die altijd gelden; de organisatie voegt eigen synoniemen toe (instelling plaatsSynoniemen). */
export const SYNONIEMEN_STANDAARD: Record<string, string> = { 'den bosch': "'s-hertogenbosch", 's-hertogenbosch': "'s-hertogenbosch", "'s-gravenhage": 'den haag', 's-gravenhage': 'den haag' }
