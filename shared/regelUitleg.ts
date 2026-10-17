// De uitleg per veld van een regel (de knop ⓘ in het bewerkpaneel op /instellingen/regels). De teksten
// beschrijven wat de motor (shared/motor.ts, shared/regelPatronen.ts) echt doet; verandert de motor, dan
// horen deze teksten mee te veranderen.

export const REGEL_UITLEG = {
  aanUit: 'Een regel die uit staat bestaat nog, maar doet niets. Zijn taken en inzichten blijven staan: uitzetten is veilig, weggooien is niet nodig.',
  naam: 'De korte naam waaronder de regel overal verschijnt: in de lijst, het runverslag en bij "Waarom krijg ik dit?". Maak hem herkenbaar voor het team.',
  categorie: 'De groep in de lijst: Vinden, Bewerken, Verbinden, Ritme, Signalen of Kwaliteit. De categorie stuurt de motor niet; dat doen de trigger en het gevolg.',
  subcategorie: 'Een vrije extra groep binnen de categorie, voor je eigen ordening.',
  omschrijving: 'Komt letterlijk in "Waarom krijg ik dit?" bij elke taak en elk inzicht. Schrijf hem zoals je het een collega zou zeggen.',
  activiteit: 'Wat de motor maakt. Een inzicht gaat eerst ter goedkeuring en wordt pas een taak als iemand het omzet. Een taak komt direct in de takenlijst. Een Beginner krijgt motorvoorstellen altijd als inzicht, behalve ritmepogingen.',
  cadans: 'Hoe vaak de regel hoogstens vuurt per onderwerp (account, afspraak of overgang). Binnen de cadans komt hetzelfde niet nog een keer. Een ritmeregel met matrix neemt de cadans per klasse uit de accountmatrix. AI-regels draaien hooguit wekelijks.',
  prioriteit: 'Hoe zwaar het resultaat weegt: de kleur en volgorde in de takenlijst en de relevantie van een inzicht. Hoog is voor wat een afspraak direct raakt; laag is ritmeonderhoud.',
  reis: 'De prospectreis waarin de regel geldt. Leeg is elke reis. Een regel geldt alleen voor prospects; klanten volgen hun ritme in DealDrive.',
  fases: 'De fases van de reis waarin de regel geldt. Zonder vinkjes geldt hij in elke fase; met vinkjes alleen waar hij hoort. Filter de lijst op fase om te zien welke regels bij een fase horen.',
  bron: 'Waar het signaal vandaan komt: intern (je eigen gegevens in Dealtrace) of extern (web, nieuws, KvK). Stuurt het bronfilter bij Inzichten.',
  specifiekeBron: 'De precieze plek binnen de bron, bijvoorbeeld "Web: vacatures". Zo weet je bij elk inzicht waar het bewijs vandaan komt.',
  triggerPatroon: 'De alsvraag van de regel: wat moet er waar zijn voordat de motor iets doet (zoveel dagen stilte, een overgang in de reis, een afspraak zonder overdracht). Dit is het hart van de regel.',
  triggerParameters: 'De getallen en keuzes in de alsvraag: het aantal dagen, het datumveld, de fase of gebeurtenis. Hier stel je scherp: 30 dagen stilte of 60 is het verschil tussen attent en opdringerig.',
  overgang: 'Een overgang in de prospectreis als trigger: van welke fase, door welke gebeurtenis, naar welke fase. Leeg is elke. De motor leest de overgangen uit de reisgeschiedenis van de laatste zeven dagen en vuurt één keer per overgang.',
  motor: 'Regel rekent op harde gegevens: gratis, voorspelbaar, draait altijd. AI leest tekst en kost credits; hij draait daarom hooguit wekelijks en alleen als het pakket het dekt.',
  afbakening: 'Op welke prospects de regel werkt: status, klasse en doelgroep. Zonder vinkjes in een groep telt die groep niet mee.',
  actiesoort: 'Waar het resultaat landt: bellen op de bellijst en in het belblok, bezoek op de regiodag, mailen, LinkedIn, WhatsApp of SMS. Een ritmeregel leest bij bellen de belmatrix en bij bezoek de afspraakmatrix.',
  uitvoerder: 'Wie de taak op zijn naam krijgt: de eigenaar van het account, alleen accounts van de binnendienst of de buitendienst, of de salesmanager van het team.',
  termijn: 'Binnen hoeveel werkdagen de taak af moet. De vervaldatum zelf is het eerstvolgende belblok of de regiodag.',
  taaksjabloon: 'De titel van de taak. {account}, {contact}, {afspraak} en {winpunt} vult de motor per prospect in.',
  winpunten: 'Winpunten uit het verkoopverhaal die de taak als gespreksonderwerp meekrijgt. De motor kiest per prospect het eerste winpunt dat bij de hoofdfase van de prospect past, anders het eerste. Het winpunt staat in de taak, het belscript en de briefing.',
  pitstop: 'Met Pitstop aan zet de Schrijver een concept klaar bij de taak (belscript, briefing of mail). Goedkeuren blijft aan jou. Alleen bij activiteit Taak; vraagt pakket Plus of Compleet.',
  signaaltype: 'De soort inzicht, voor het filter bij Inzichten. Leeg is het triggerpatroon.',
  verwachtResultaat: 'Wat de regel moet opleveren: de meetlat voor de leerlus. Ligt vast zodra hij is ingevuld, zodat de meetlat niet per week verandert.',
} as const

export type RegelUitlegSleutel = keyof typeof REGEL_UITLEG
