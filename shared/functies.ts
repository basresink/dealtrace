// De functiecatalogus van Dealtrace (bouwplan 4.2, 4.3 en 6.1).
//
// Per functie staan hier de vaste gegevens: sleutel, naam, pakket, recht en
// helpartikel. Of een functie voor een niveau aanstaat, staat NIET in de code
// maar in de tabel functies_per_niveau; die regelt de founder (B18). De kolom
// startNiveau is alleen de beginstand waarmee de migratie die tabel vult.

import type {
  FunctieRegel,
  GebruikerContext,
  Niveau,
  OrganisatieContext,
  Pakket,
  Rol,
} from './types'
import { NIVEAUS, PAKKETTEN } from './types'

export type ZijbalkGroep = 'Start' | 'Werk' | 'Prospects' | 'Plannen' | 'Resultaat' | 'Manager' | 'Beheer'

export interface Functie {
  sleutel: string
  naam: string
  pakket: Pakket
  /** Rollen die de functie mogen gebruiken; 'iedereen' is elke rol behalve founder zonder organisatie. */
  rollen: readonly Rol[] | 'iedereen'
  helpartikel: string
  /** Beginstand in functies_per_niveau: aan vanaf dit niveau, uit voor de niveaus eronder. */
  startNiveau: Niveau
  /** Alleen voor zijbalkitems. */
  zijbalk?: {
    groep: ZijbalkGroep
    route: string
    icoon: string
    /** Extra label bij Beginner, zoals "meedoen" of "lezen" (6.1). */
    beginnerLabel?: string
  }
  /** Rollen voor wie de functie los van het niveau aanstaat (bijvoorbeeld Prospectreizen voor de salesmanager). */
  altijdVoor?: readonly Rol[]
  /** Tekst voor de uitlegflyout als de functie niet aanstaat (6.1). */
  uitleg: { watHetDoet: string; totDieTijd: string }
}

const MANAGERS: readonly Rol[] = ['salesmanager', 'beheerder']

export const FUNCTIES: readonly Functie[] = [
  {
    sleutel: 'nav.vandaag', naam: 'Vandaag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'beginner',
    zijbalk: { groep: 'Start', route: '/', icoon: 'House' },
    uitleg: { watHetDoet: 'Je dag op één pagina: wat je nu doet, waarom, en wat er voor je klaarstaat.', totDieTijd: 'Niets; Vandaag staat altijd aan.' },
  },
  {
    sleutel: 'nav.agenda', naam: 'Agenda', pakket: 'starter', rollen: 'iedereen', helpartikel: 'agenda', startNiveau: 'beginner',
    zijbalk: { groep: 'Start', route: '/agenda', icoon: 'Calendar' },
    uitleg: { watHetDoet: 'Je afspraken, belblokken en regiodagen in een dag-, week- of maandweergave.', totDieTijd: 'Je afspraken van vandaag staan op Vandaag.' },
  },
  {
    sleutel: 'nav.acties', naam: 'Acties', pakket: 'starter', rollen: 'iedereen', helpartikel: 'acties', startNiveau: 'beginner',
    zijbalk: { groep: 'Werk', route: '/acties', icoon: 'SquareCheck' },
    uitleg: { watHetDoet: 'Al je taken en inzichten op één plek, met uitkomst en volgende poging.', totDieTijd: 'Je taken van vandaag staan op Vandaag.' },
  },
  {
    sleutel: 'nav.belblokken', naam: 'Belblokken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'belblokken', startNiveau: 'beginner',
    zijbalk: { groep: 'Werk', route: '/belblokken', icoon: 'Phone' },
    uitleg: { watHetDoet: 'Vaste tijdvakken om te bellen, met een gevulde bellijst en een gekozen script.', totDieTijd: 'Je salesmanager zet belblokken voor je klaar.' },
  },
  {
    sleutel: 'nav.bezoeken', naam: 'Bezoeken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken', startNiveau: 'beginner',
    zijbalk: { groep: 'Werk', route: '/bezoeken', icoon: 'MapPin' },
    uitleg: { watHetDoet: 'Je route van de dag met kansen langs de route en bezoeken afronden.', totDieTijd: 'Je bezoeken staan in je agenda.' },
  },
  {
    sleutel: 'nav.campagnes', naam: 'Campagnes', pakket: 'starter', rollen: 'iedereen', helpartikel: 'campagnes', startNiveau: 'beginner',
    zijbalk: { groep: 'Werk', route: '/campagnes', icoon: 'Megaphone', beginnerLabel: 'meedoen' },
    uitleg: { watHetDoet: 'Acties over een groep accounts met een soort, een boodschap en een ritme.', totDieTijd: 'Je doet mee aan campagnes van je salesmanager.' },
  },
  {
    sleutel: 'nav.funnel', naam: 'Funnel', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'beginner',
    zijbalk: { groep: 'Werk', route: '/funnel', icoon: 'Filter' },
    uitleg: { watHetDoet: 'Hoeveel accounts per fase van de prospectreis staan, doorstromen en uitvallen, tot en met de eerste afspraak.', totDieTijd: 'Je salesmanager bespreekt de funnel met je.' },
  },
  {
    sleutel: 'nav.prospects', naam: 'Prospects', pakket: 'starter', rollen: 'iedereen', helpartikel: 'prospects', startNiveau: 'beginner',
    zijbalk: { groep: 'Prospects', route: '/prospects', icoon: 'Building2' },
    uitleg: { watHetDoet: 'Alle bedrijven die je bewerkt, met hun reis, status en volgende stap.', totDieTijd: 'Niets; Prospects staat altijd aan.' },
  },
  {
    sleutel: 'nav.contacten', naam: 'Contacten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'contacten', startNiveau: 'beginner',
    zijbalk: { groep: 'Prospects', route: '/contacten', icoon: 'Users' },
    uitleg: { watHetDoet: 'De mensen bij je prospects, met hun rol in het buying committee.', totDieTijd: 'Contacten staan ook op de accountkaart.' },
  },
  {
    sleutel: 'nav.leadgenerator', naam: 'Leadgenerator', pakket: 'starter', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Prospects', route: '/leadgenerator', icoon: 'UserPlus' },
    uitleg: { watHetDoet: 'Nieuwe prospects vinden via de AI-zoeker, KvK, Datacollectief, import of je CRM. Elke lead komt met bewijs en een reden waarom hij past.', totDieTijd: 'Je salesmanager zet leads voor je klaar; die verschijnen als taak op Vandaag.' },
  },
  {
    sleutel: 'nav.inzichten', naam: 'Inzichten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inzichten', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Prospects', route: '/inzichten', icoon: 'Lightbulb' },
    uitleg: { watHetDoet: 'Aanleidingen met bewijs die agents vinden, om te beoordelen en om te zetten in een taak.', totDieTijd: 'De belangrijkste aanleiding van de dag staat op Vandaag.' },
  },
  {
    sleutel: 'nav.planning', naam: 'Prospectplanning', pakket: 'starter', rollen: 'iedereen', helpartikel: 'prospectplanning', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Plannen', route: '/planning', icoon: 'CalendarRange' },
    uitleg: { watHetDoet: 'Je jaar- en maandplanning: wie je wanneer benadert, en wanneer een geparkeerd account terugkomt.', totDieTijd: 'De motor zet de volgende poging voor je klaar.' },
  },
  {
    sleutel: 'nav.richting', naam: 'Richting', pakket: 'starter', rollen: 'iedereen', helpartikel: 'richting', startNiveau: 'beginner',
    zijbalk: { groep: 'Plannen', route: '/richting', icoon: 'Compass', beginnerLabel: 'lezen' },
    uitleg: { watHetDoet: 'Het verkoopverhaal van je organisatie: verhaal, belofte, concurrenten, winpunten.', totDieTijd: 'Niets; Richting is voor iedereen te lezen.' },
  },
  {
    sleutel: 'nav.reizen', naam: 'Prospectreizen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'doelgroepen-en-reizen', startNiveau: 'expert', altijdVoor: MANAGERS,
    zijbalk: { groep: 'Plannen', route: '/reizen', icoon: 'Route' },
    uitleg: { watHetDoet: 'Een eigen prospectreis per doelgroep bouwen, met fases, overgangen en startactiviteiten.', totDieTijd: 'Je werkt met de standaardreis die je salesmanager heeft gekozen.' },
  },
  {
    sleutel: 'nav.resultaten', naam: 'Mijn resultaten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'resultaten', startNiveau: 'beginner',
    zijbalk: { groep: 'Resultaat', route: '/resultaten', icoon: 'ChartColumn' },
    uitleg: { watHetDoet: 'Je eigen cijfers: pogingen, gesprekken, afspraken en overdrachten.', totDieTijd: 'Niets; Mijn resultaten staat altijd aan.' },
  },
  {
    sleutel: 'nav.team', naam: 'Team', pakket: 'starter', rollen: MANAGERS, helpartikel: 'team-controleren', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Manager', route: '/team', icoon: 'UsersRound' },
    uitleg: { watHetDoet: 'Wie loopt op schema, wat blijft liggen en wat wacht op goedkeuring.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.coaching', naam: 'Coaching', pakket: 'starter', rollen: MANAGERS, helpartikel: 'coachingsgesprek', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Manager', route: '/coaching', icoon: 'MessagesSquare' },
    uitleg: { watHetDoet: 'Een coachingkaart per accountmanager met cijfers, gesprekken en afspraken.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.analyse', naam: 'Analyse', pakket: 'starter', rollen: MANAGERS, helpartikel: 'analyse-lezen', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Manager', route: '/analyse', icoon: 'ChartLine' },
    uitleg: { watHetDoet: 'Funnel, activiteit, campagnes, scripts en bronnen per team.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.audit', naam: 'Audit', pakket: 'starter', rollen: MANAGERS, helpartikel: 'audit', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Manager', route: '/audit', icoon: 'ScrollText' },
    uitleg: { watHetDoet: 'Wie wat wanneer heeft gewijzigd.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.instellingen', naam: 'Instellingen', pakket: 'starter', rollen: MANAGERS, helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'beginner',
    zijbalk: { groep: 'Beheer', route: '/instellingen', icoon: 'Settings' },
    uitleg: { watHetDoet: 'Gebruikers, teams, niveaus en de inrichting van je organisatie.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.platform', naam: 'Platformbeheer', pakket: 'starter', rollen: ['founder'], helpartikel: 'platformbeheer', startNiveau: 'beginner',
    zijbalk: { groep: 'Beheer', route: '/platform/klanten', icoon: 'Server' },
    uitleg: { watHetDoet: 'Organisaties, abonnementen en features per niveau.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'gebruikers.niveau', naam: 'Niveau van gebruikers kiezen', pakket: 'starter', rollen: MANAGERS, helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Het niveau van een gebruiker kiezen: Beginner, Gevorderd of Expert.', totDieTijd: 'Geen.' },
  },
  // P03: prospects, contacten en eigen velden
  {
    sleutel: 'prospects.lijst', naam: 'Prospectlijst', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-prospect-toevoegen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De lijst met al je prospects, met zoeken en filters.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.kaart', naam: 'Accountkaart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Het dossier van een bedrijf voor en na elk gesprek.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.nieuw', naam: 'Nieuwe prospect', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-prospect-toevoegen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een bedrijf toevoegen, met dubbelcheck.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.filtersAlle', naam: 'Alle filters', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Alle filters met meerekenende tellers en sorteren.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.weergaven', naam: 'Weergaven', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Lijst, compact of kaarten.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.opgeslagenFilters', naam: 'Opgeslagen filters', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Je eigen filters bewaren.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.klasseZetten', naam: 'Klasse zetten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De klasse van een account kiezen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.samenvoegen', naam: 'Samenvoegen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Dubbele accounts samenvoegen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.export', naam: 'Exporteren', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een lijst als CSV downloaden.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.scoreOpbouw', naam: 'Scoreopbouw', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Zien hoe de score is opgebouwd.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.verwijderen', naam: 'Accounts verwijderen', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een account met zijn contacten verwijderen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'prospects.eigenaarWijzigen', naam: 'Eigenaar wijzigen', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'de-accountkaart-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een account aan een collega geven.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'contacten.basis', naam: 'Contacten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'buying-committee', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Contactpersonen met hun rol.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'contacten.filters', naam: 'Contactfilters', pakket: 'starter', rollen: 'iedereen', helpartikel: 'buying-committee', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Filteren op e-mail, telefoon en laatste contact.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'contacten.samenvoegen', naam: 'Contacten samenvoegen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'buying-committee', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Dubbele contacten samenvoegen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'contacten.verhuizen', naam: 'Contact verhuizen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'buying-committee', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een contact naar een ander bedrijf verhuizen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'eigenVelden.invullen', naam: 'Eigen velden invullen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'eigen-velden', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De velden die jullie zelf nodig hebben invullen.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'eigenVelden.filteren', naam: 'Filteren op eigen velden', pakket: 'starter', rollen: 'iedereen', helpartikel: 'eigen-velden', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Filteren en sorteren op eigen velden.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'eigenVelden.voorstellen', naam: 'Eigen veld voorstellen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'eigen-velden', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een nieuw veld voorstellen aan de beheerder.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  {
    sleutel: 'eigenVelden.beheren', naam: 'Eigen velden beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'eigen-velden', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen velden maken, wijzigen, ordenen en archiveren.', totDieTijd: 'Vraag een collega of je manager.' },
  },
  // P04: import
  {
    sleutel: 'import.uitvoeren', naam: 'Importeren', pakket: 'starter', rollen: 'iedereen', helpartikel: 'importeren', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een lijst uit Excel of CSV in één keer binnenhalen, met ontdubbelen en een foutenrapport.', totDieTijd: 'Vraag je manager om een lijst te importeren, of voeg prospects een voor een toe.' },
  },
  {
    sleutel: 'import.terugdraaien', naam: 'Import terugdraaien', pakket: 'starter', rollen: 'iedereen', helpartikel: 'importeren', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een import ongedaan maken zolang er nog niets met de accounts is gebeurd.', totDieTijd: 'Vraag je manager.' },
  },
  {
    sleutel: 'import.teamVerdelen', naam: 'Import verdelen over het team', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'importeren', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De nieuwe accounts gelijk verdelen over het team.', totDieTijd: 'Geen.' },
  },
  // P05: prospectreis, statusmachine en terugkomregels
  {
    sleutel: 'reis.zien', naam: 'Reis en fase op de kaart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Reis, fase, status en dagen in fase op de accountkaart.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'reis.kwalificeer', naam: 'Kwalificeer', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een account na het dossier kwalificeren, zodat het in de reis komt.', totDieTijd: 'Vraag je manager.' },
  },
  {
    sleutel: 'account.nee', naam: 'Zet nee', pakket: 'starter', rollen: 'iedereen', helpartikel: 'nee-met-reden-en-afkoelperiode', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een nee vastleggen met reden, afkoelperiode en terugkomdatum.', totDieTijd: 'Vraag je manager.' },
  },
  {
    sleutel: 'reis.faseCorrigeren', naam: 'Fase corrigeren', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een account met een reden in de juiste fase zetten.', totDieTijd: 'De fase schuift mee met je uitkomsten.' },
  },
  {
    sleutel: 'reis.geschiedenis', naam: 'Reisgeschiedenis', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Per account zien wanneer het van fase wisselde, door wie en waarom.', totDieTijd: 'De tijdlijn laat de belangrijkste momenten zien.' },
  },
  {
    sleutel: 'reis.overzicht', naam: 'Reis bekijken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De reis van je doelgroep met aantallen per fase, alleen lezen.', totDieTijd: 'Je ziet de fase op de kaart.' },
  },
  {
    sleutel: 'account.terugOpAanpassen', naam: 'Terugkomdatum aanpassen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'nee-met-reden-en-afkoelperiode', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De terugkomdatum van een account met een reden verschuiven.', totDieTijd: 'De datum volgt de terugkomregel.' },
  },
  {
    sleutel: 'reis.verplaatsen', naam: 'Verplaats naar reis', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-prospectreis-en-fases', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een account met een reden naar een andere reis verplaatsen (eigen accounts; de salesmanager alle).', totDieTijd: 'Vraag je salesmanager.' },
  },
  {
    sleutel: 'doelgroepen.beheren', naam: 'Doelgroepen beheren', pakket: 'starter', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Doelgroepen maken met branches, filters, prioriteit en ambitietoets.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'reis.accentBijstellen', naam: 'Accenten bijstellen', pakket: 'starter', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Het Pitstop-accent per fase van de standaardreis bijstellen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'reis.standaardTerug', naam: 'Standaard terugzetten', pakket: 'starter', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Fases, accenten, overgangen en startactiviteiten van een reis terugzetten naar de standaard.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'instellingen.afkoeling', naam: 'Afkoelperiodes', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'nee-met-reden-en-afkoelperiode', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De afkoelperiode per kanaal na een nee instellen.', totDieTijd: 'Geen.' },
  },
  // P06: motor, regels en accountmatrix
  {
    sleutel: 'regels.lezen', naam: 'Regels bekijken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'regels', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De regels lezen die je taken en inzichten klaarzetten, met droogloop.', totDieTijd: 'Bij elke taak staat "Waarom krijg ik dit?".' },
  },
  {
    sleutel: 'regels.persoonlijk', naam: 'Persoonlijke regels', pakket: 'starter', rollen: 'iedereen', helpartikel: 'regels', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen regels maken voor je eigen accounts, en teamregels voorstellen.', totDieTijd: 'De regels van je organisatie gelden voor jou.' },
  },
  {
    sleutel: 'regels.team', naam: 'Teamregels', pakket: 'starter', rollen: ['salesmanager'], helpartikel: 'regels', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Teamregels aan- en uitzetten, cadans, drempels en klassen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'regels.beheer', naam: 'Regels beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'regels', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Alle regels, Excel, back-up en de starterset.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'motor.ai', naam: 'AI-regels', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'regels', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Regels die met AI signalen beoordelen (kansanalyse, vacatures, nieuws).', totDieTijd: 'De gewone regels draaien wel.' },
  },
  {
    sleutel: 'matrix.klasseZetten', naam: 'Klasse zetten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'accountmatrix', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De accountklasse van een account kiezen.', totDieTijd: 'Je ziet de klasse van een account.' },
  },
  {
    sleutel: 'matrix.voorstellen', naam: 'Matrix voorstellen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'accountmatrix', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een wijziging van de accountmatrix voorstellen aan de beheerder.', totDieTijd: 'Je kunt de matrix lezen.' },
  },
  {
    sleutel: 'matrix.beheer', naam: 'Accountmatrix beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'accountmatrix', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Klassen, segmenten, belmatrix, afspraakmatrix en capaciteit instellen.', totDieTijd: 'Geen.' },
  },
  // P02: platform (alleen founder, geen regels in functies_per_niveau) en de spiegel voor de beheerder.
  {
    sleutel: 'platform.klanten', naam: 'Klanten', pakket: 'starter', rollen: ['founder'], helpartikel: '', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Alle organisaties met gezondheid, pakket en gebruikers.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'platform.werkIn', naam: 'Werken in een organisatie', pakket: 'starter', rollen: ['founder'], helpartikel: '', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Met reden, modus en tijdslimiet werken in een organisatie.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'instellingen.abonnement', naam: 'Abonnement', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Je pakket in gewone woorden, seats in gebruik en je contract.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'instellingen.audit', naam: 'Audit en toegang leverancier', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'als-dealtrace-meekijkt', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Wie wat wijzigde, ook de leverancier, en of de leverancier mag meekijken.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'instellingen.gebruikersAanvragen', naam: 'Gebruikers aanvragen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een gebruiker aanvragen als je seats vol zijn of de leverancier toevoegt.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'mij.toonMinder', naam: 'Toon minder', pakket: 'starter', rollen: 'iedereen', helpartikel: 'niveau-en-functies', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Zelf functies verbergen die je niet gebruikt.', totDieTijd: 'Geen.' },
  },
]

const PER_SLEUTEL = new Map(FUNCTIES.map((f) => [f.sleutel, f]))

export function functie(sleutel: string): Functie | undefined {
  return PER_SLEUTEL.get(sleutel)
}

/** Startregels voor functies_per_niveau: aan vanaf startNiveau, uit daaronder. */
export function startindeling(): Omit<FunctieRegel, 'organisationId'>[] {
  const regels: Omit<FunctieRegel, 'organisationId'>[] = []
  for (const f of FUNCTIES) {
    // Founderfuncties hangen niet af van een niveau (P02).
    if (f.rollen !== 'iedereen' && f.rollen.length === 1 && f.rollen[0] === 'founder') continue
    const vanaf = NIVEAUS.indexOf(f.startNiveau)
    for (const n of NIVEAUS) regels.push({ functie: f.sleutel, niveau: n, aan: NIVEAUS.indexOf(n) >= vanaf })
  }
  return regels
}

/** Het niveau waarvoor een functie voor het eerst aanstaat, volgens de stand. */
export function aanVanaf(sleutel: string, organisatie: Pick<OrganisatieContext, 'id'>, stand: FunctieRegel[]): Niveau | null {
  for (const n of NIVEAUS) if (aanVoorNiveau(sleutel, n, organisatie, stand)) return n
  return null
}

/**
 * Staat de functie aan voor dit niveau? Een regel voor deze organisatie gaat voor
 * de regel voor alle organisaties. Een functie zonder regel staat uit.
 */
export function aanVoorNiveau(
  sleutel: string,
  niveau: Niveau,
  organisatie: Pick<OrganisatieContext, 'id'>,
  stand: FunctieRegel[],
): boolean {
  let algemeen: boolean | undefined
  for (const r of stand) {
    if (r.functie !== sleutel || r.niveau !== niveau) continue
    if (r.organisationId === organisatie.id) return r.aan
    if (r.organisationId === null) algemeen = r.aan
  }
  return algemeen ?? false
}

export function pakketBevat(organisatie: Pick<OrganisatieContext, 'pakket' | 'features'>, f: Functie): boolean {
  if (organisatie.features.uit?.includes(f.sleutel)) return false
  if (organisatie.features.aan?.includes(f.sleutel)) return true
  return PAKKETTEN.indexOf(organisatie.pakket) >= PAKKETTEN.indexOf(f.pakket)
}

export function rolMagFunctie(rol: Rol, f: Functie): boolean {
  if (f.rollen === 'iedereen') return rol !== 'founder'
  return f.rollen.includes(rol)
}

export type Weigerreden = 'pakket' | 'rol' | 'niveau'
export type Beschikbaarheid = { ok: true } | { ok: false; reden: Weigerreden }

/**
 * beschikbaar = pakketBevat && rolMag && aanVoorNiveau (4.2). Er is geen
 * uitzondering per gebruiker. "Iedereen ziet alles" zet alles uit het pakket
 * aan, maar nooit boven pakket of rol. Een onbekende sleutel is geweigerd op rol.
 */
export function beschikbaar(
  sleutel: string,
  gebruiker: Pick<GebruikerContext, 'rol' | 'niveau'>,
  organisatie: OrganisatieContext,
  stand: FunctieRegel[],
): Beschikbaarheid {
  const f = functie(sleutel)
  if (!f) return { ok: false, reden: 'rol' }
  if (!rolMagFunctie(gebruiker.rol, f)) return { ok: false, reden: 'rol' }
  if (!pakketBevat(organisatie, f)) return { ok: false, reden: 'pakket' }
  if (organisatie.iedereenAlles) return { ok: true }
  // Managers en beheerders hebben de functies van hun rol altijd aan (4.1).
  if (f.rollen !== 'iedereen' || f.altijdVoor?.includes(gebruiker.rol)) return { ok: true }
  if (!aanVoorNiveau(sleutel, gebruiker.niveau, organisatie, stand)) return { ok: false, reden: 'niveau' }
  return { ok: true }
}

/** Alle functies met hun beschikbaarheid, voor GET /api/functies. */
export function catalogusVoor(
  gebruiker: Pick<GebruikerContext, 'rol' | 'niveau'>,
  organisatie: OrganisatieContext,
  stand: FunctieRegel[],
) {
  return FUNCTIES.map((f) => {
    const b = beschikbaar(f.sleutel, gebruiker, organisatie, stand)
    return {
      sleutel: f.sleutel,
      naam: f.naam,
      helpartikel: f.helpartikel,
      beschikbaar: b.ok,
      reden: b.ok ? null : b.reden,
      aanVanaf: aanVanaf(f.sleutel, organisatie, stand),
    }
  })
}
