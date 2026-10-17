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

export type ZijbalkGroep = 'Start' | 'Activiteiten' | 'Prospects' | 'Rapportages' | 'Planning' | 'Manager' | 'Beheer'

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
    /** Menulabel als dat afwijkt van de functienaam. */
    naam?: string
    /** Staat in het menu direct onder dit item, los van de plek in de catalogus. */
    na?: string
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
    sleutel: 'nav.inzichten', naam: 'Inzichten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inzichten', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Activiteiten', route: '/inzichten', icoon: 'Lightbulb' },
    uitleg: { watHetDoet: 'Aanleidingen met bewijs die agents vinden, om te beoordelen en om te zetten in een taak.', totDieTijd: 'De belangrijkste aanleiding van de dag staat op Vandaag.' },
  },
  {
    sleutel: 'nav.acties', naam: 'Taken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'acties', startNiveau: 'beginner',
    zijbalk: { groep: 'Activiteiten', route: '/taken', icoon: 'SquareCheck' },
    uitleg: { watHetDoet: 'Al je taken op één plek, met uitkomst en volgende poging.', totDieTijd: 'Je taken van vandaag staan op Vandaag.' },
  },
  {
    // F7: alle opvolgreeksen van de gebruiker (salesmanager ook van zijn team), met wat op jou wacht bovenaan.
    sleutel: 'nav.opvolgreeksen', naam: 'Opvolgreeksen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'volgen', startNiveau: 'beginner',
    zijbalk: { groep: 'Activiteiten', route: '/opvolgreeksen', icoon: 'Repeat' },
    uitleg: { watHetDoet: 'Al je opvolgreeksen op één plek: wat op je goedkeuring wacht, wat vanzelf loopt en welke reeksen raak waren.', totDieTijd: 'De reeks van een account staat onder Volgen op de accountkaart.' },
  },
  {
    sleutel: 'nav.belblokken', naam: 'Belblokken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'belblokken', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/belblokken', icoon: 'Phone' },
    uitleg: { watHetDoet: 'Vaste tijdvakken om te bellen, met een gevulde bellijst en een gekozen script.', totDieTijd: 'Je salesmanager zet belblokken voor je klaar.' },
  },
  {
    sleutel: 'nav.bezoeken', naam: 'Bezoeken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/bezoeken', icoon: 'MapPin' },
    uitleg: { watHetDoet: 'Je route van de dag met kansen langs de route en bezoeken afronden.', totDieTijd: 'Je bezoeken staan in je agenda.' },
  },
  {
    sleutel: 'nav.meetings', naam: 'Meetings', pakket: 'starter', rollen: 'iedereen', helpartikel: 'agenda', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/meetings', icoon: 'Handshake' },
    uitleg: { watHetDoet: 'Je meetings van de komende weken per soort, met doel, briefing en verslag.', totDieTijd: 'Je meetings staan in je agenda.' },
  },
  {
    sleutel: 'nav.campagnes', naam: 'Campagnes', pakket: 'starter', rollen: 'iedereen', helpartikel: 'campagnes', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/campagnes', icoon: 'Megaphone', beginnerLabel: 'meedoen' },
    uitleg: { watHetDoet: 'Acties over een groep accounts met een soort, een boodschap en een ritme.', totDieTijd: 'Je doet mee aan campagnes van je salesmanager.' },
  },
  {
    sleutel: 'nav.accountplannen', naam: 'Accountplannen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'accountplannen', startNiveau: 'expert',
    zijbalk: { groep: 'Planning', route: '/accountplannen', icoon: 'ClipboardCheck' },
    uitleg: { watHetDoet: 'Eén plan per topprospect: doelen, kansen, bedreigingen, strategie en een actieplan waarvan elke actie een taak op het account is.', totDieTijd: 'Leg je plannen vast in de notities en taken op de accountkaart.' },
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
    zijbalk: { groep: 'Planning', route: '/leadgenerator', icoon: 'UserPlus' },
    uitleg: { watHetDoet: 'Nieuwe prospects vinden via de AI-zoeker, KvK, Datacollectief, import of je CRM. Elke lead komt met bewijs en een reden waarom hij past.', totDieTijd: 'Je salesmanager zet leads voor je klaar; die verschijnen als taak op Vandaag.' },
  },
  {
    // F5: de signalen van de laatste 30 dagen per branche en signaalsoort, met golven en een belronde in één klik.
    sleutel: 'nav.signaalradar', naam: 'Signaalradar', pakket: 'starter', rollen: 'iedereen', helpartikel: 'signaalradar', startNiveau: 'gevorderd',
    zijbalk: { groep: 'Planning', route: '/signaalradar', icoon: 'Radar' },
    uitleg: { watHetDoet: 'Ziet welke signalen nu opvallend vaak in een branche voorkomen en maakt er met één klik een gerichte belronde van.', totDieTijd: 'De signalen staan per account bij Inzichten.' },
  },
  {
    sleutel: 'nav.concepten', naam: 'Concepten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'concepten-goedkeuren-en-versturen', startNiveau: 'beginner',
    zijbalk: { groep: 'Activiteiten', route: '/concepten', icoon: 'Inbox' },
    uitleg: { watHetDoet: 'Wat agents klaarzetten ter goedkeuring: mails, berichten en briefings.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'nav.kennisbank', naam: 'Kennisbank', pakket: 'starter', rollen: 'iedereen', helpartikel: 'kennisbank', startNiveau: 'gevorderd',
    // Niet meer in het hoofdmenu: de ingang staat op /helpcenter (Kennisbank).
    uitleg: { watHetDoet: 'De documenten van je organisatie op één plek: cases, offertes, presentaties, productinfo en contracten, te doorzoeken, gekoppeld aan accounts en contacten en te bevragen met de AI.', totDieTijd: 'Documenten bij een account of contact staan op het tabblad Documenten van de accountkaart.' },
  },
  {
    sleutel: 'nav.planning', naam: 'Prospectplanning', pakket: 'starter', rollen: 'iedereen', helpartikel: 'prospectplanning', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/planning', icoon: 'CalendarRange' },
    uitleg: { watHetDoet: 'Je jaar- en maandplanning: wie je wanneer benadert, en wanneer een geparkeerd account terugkomt.', totDieTijd: 'De motor zet de volgende poging voor je klaar.' },
  },
  {
    sleutel: 'nav.richting', naam: 'Richting', pakket: 'starter', rollen: 'iedereen', helpartikel: 'richting', startNiveau: 'beginner',
    zijbalk: { groep: 'Planning', route: '/richting', icoon: 'Compass', beginnerLabel: 'lezen' },
    uitleg: { watHetDoet: 'Het verkoopverhaal van je organisatie: verhaal, belofte, concurrenten, winpunten.', totDieTijd: 'Niets; Richting is voor iedereen te lezen.' },
  },
  {
    sleutel: 'nav.reizen', naam: 'Prospectreizen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'doelgroepen-en-reizen', startNiveau: 'expert', altijdVoor: MANAGERS,
    zijbalk: { groep: 'Planning', route: '/reizen', icoon: 'Route' },
    uitleg: { watHetDoet: 'Een eigen prospectreis per doelgroep bouwen, met fases, overgangen en startactiviteiten.', totDieTijd: 'Je werkt met de standaardreis die je salesmanager heeft gekozen.' },
  },
  {
    sleutel: 'nav.resultaten', naam: 'Mijn dashboard', pakket: 'starter', rollen: 'iedereen', helpartikel: 'resultaten', startNiveau: 'beginner',
    zijbalk: { groep: 'Rapportages', route: '/mijn-dashboard', icoon: 'ChartColumn' },
    uitleg: { watHetDoet: 'Je eigen cijfers: pogingen, gesprekken, afspraken en overdrachten.', totDieTijd: 'Niets; Mijn dashboard staat altijd aan.' },
  },
  {
    sleutel: 'nav.funnel', naam: 'Funnel', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'beginner',
    zijbalk: { groep: 'Rapportages', route: '/funnel', icoon: 'Filter' },
    uitleg: { watHetDoet: 'Hoeveel accounts per fase van de prospectreis staan, doorstromen en uitvallen, tot en met de eerste afspraak.', totDieTijd: 'Je salesmanager bespreekt de funnel met je.' },
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
    // F2 en F7: Volgen op de account- en contactkaart (volgende beste stap en opvolgreeksen).
    sleutel: 'prospects.volgen', naam: 'Volgen: volgende stap en opvolgreeksen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'volgen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Per account één volgende stap met de reden erbij, en een opvolgreeks die vanzelf stopt bij een reactie.', totDieTijd: 'Kijk bij Taken en Inzichten wat er voor dit account klaarstaat.' },
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
    sleutel: 'prospects.klasseZetten', naam: 'Klasse zetten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-accountkaart-lezen', startNiveau: 'beginner',
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
    // Verwijderen bestaat niet meer (0064): de eigenaar, de salesmanager (eigen teams) en de beheerder deactiveren met een reden en heractiveren.
    sleutel: 'prospects.deactiveren', naam: 'Deactiveren en heractiveren', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-prospect-deactiveren', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een prospect met een reden deactiveren: de motor stopt, de historie blijft. Heractiveren kan altijd.', totDieTijd: 'Vraag je salesmanager.' },
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
    uitleg: { watHetDoet: 'Een account met een reden naar een andere reis verplaatsen (eigen accounts; de salesmanager alle).', totDieTijd: 'Je salesmanager verplaatst een account voor je.' },
  },
  {
    sleutel: 'doelgroepen.beheren', naam: 'Doelgroepen beheren', pakket: 'starter', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Doelgroepen maken met branches, filters, prioriteit en ambitietoets.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'reis.accentBijstellen', naam: 'Accenten bijstellen', pakket: 'starter', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Het Pitstop-accent per fase van de standaardreis bijstellen.', totDieTijd: 'Geen.' },
  },
  // P22: maatwerk prospectreizen (F05).
  {
    sleutel: 'reizen.maatwerk', naam: 'Eigen prospectreis bouwen', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-eigen-prospectreis-bouwen', startNiveau: 'expert', altijdVoor: MANAGERS,
    uitleg: { watHetDoet: 'Een maatwerkreis als concept: fases, overgangen en startactiviteiten, met Controleer en Droogloop.', totDieTijd: 'Je werkt met de reis die je salesmanager publiceerde.' },
  },
  {
    sleutel: 'reizen.publiceren', naam: 'Reizen publiceren', pakket: 'plus', rollen: MANAGERS, helpartikel: 'doelgroepen-en-reizen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een concept publiceren als nieuwe versie met fasemapping, terugdraaien, pauzeren en archiveren.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'reizen.voorstelAI', naam: 'Stel fases voor', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-eigen-prospectreis-bouwen', startNiveau: 'expert', altijdVoor: MANAGERS,
    uitleg: { watHetDoet: 'De Coach stelt fases en overgangen voor als concept (20 credits).', totDieTijd: 'Bouw de fases zelf.' },
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
    sleutel: 'regels.lezen', naam: 'Regels bekijken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'regels', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De regels lezen die je taken en inzichten klaarzetten, met droogloop.', totDieTijd: 'Bij elke taak staat "Waarom krijg ik dit?".' },
  },
  {
    sleutel: 'regels.persoonlijk', naam: 'Persoonlijke regels', pakket: 'starter', rollen: 'iedereen', helpartikel: 'regels', startNiveau: 'beginner',
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
    sleutel: 'matrix.klasseZetten', naam: 'Klasse zetten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'accountmatrix', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De accountklasse van een account kiezen.', totDieTijd: 'Je ziet de klasse van een account.' },
  },
  {
    sleutel: 'matrix.voorstellen', naam: 'Matrix voorstellen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'accountmatrix', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een wijziging van de accountmatrix voorstellen aan de beheerder.', totDieTijd: 'Je kunt de matrix lezen.' },
  },
  {
    sleutel: 'matrix.beheer', naam: 'Accountmatrix beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'accountmatrix', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Klassen, segmenten, belmatrix, afspraakmatrix en capaciteit instellen.', totDieTijd: 'Geen.' },
  },
  // P07: Vandaag, taken, inzichten en hercontactritme
  {
    sleutel: 'vandaag.basis', naam: 'Vandaag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je dag op één pagina: taken, aanleiding van de dag, prioriteiten en je werkblok.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'vandaag.agentsGedaan', naam: 'Door agents gedaan', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Wat de motor en de agents sinds gisteren voor je deden.', totDieTijd: 'Je ziet het resultaat in je taken.' },
  },
  {
    sleutel: 'vandaag.week', naam: 'Jouw week', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Vijf werkdagen met je taken, afspraken, belblokken en regiodagen.', totDieTijd: 'Vandaag toont je dag.' },
  },
  {
    sleutel: 'vandaag.indeling', naam: 'Eigen volgorde op Vandaag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De volgorde van de blokken op Vandaag zelf kiezen.', totDieTijd: 'De standaardvolgorde.' },
  },
  {
    sleutel: 'vandaag.eigenWeergaven', naam: 'Eigen weergaven op Vandaag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen filters op de takenkolom van Vandaag.', totDieTijd: 'De standaardvolgorde van taken.' },
  },
  {
    sleutel: 'vandaag.team', naam: 'Team vandaag', pakket: 'starter', rollen: MANAGERS, helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Wie in je team achterloopt en wat op goedkeuring wacht.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'taken.basis', naam: 'Taken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je taken in een lijst, afronden met een uitkomst en uitstellen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'taken.horizon', naam: 'Horizon', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Je taken in drie kolommen: vandaag, komende week, week 2 en 3.', totDieTijd: 'De lijst in groepen.' },
  },
  {
    sleutel: 'taken.bulk', naam: 'Bulkacties', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Meerdere taken tegelijk uitstellen, toewijzen of afronden.', totDieTijd: 'Per taak.' },
  },
  {
    sleutel: 'taken.herhaling', naam: 'Herhaling en herinnering', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een taak laten terugkomen en een herinnering vooraf.', totDieTijd: 'Maak de taak opnieuw.' },
  },
  {
    sleutel: 'inzichten.afwijzen', naam: 'Inzichten afwijzen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een inzicht afwijzen met reden; dat telt mee in de rapportage per regel.', totDieTijd: 'Markeer als gelezen.' },
  },
  {
    sleutel: 'taken.sjablonen', naam: 'Eigen taaksjablonen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-taak-afronden-met-een-uitkomst', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen sjablonen voor taken die je vaak maakt.', totDieTijd: 'Typ de taak zelf.' },
  },
  {
    sleutel: 'ritme.lezen', naam: 'Hercontactritme lezen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'hercontactritme', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De ritmes met hun stappen en wat ze opleveren.', totDieTijd: 'Je ziet "poging 3 van 5" bij je taken.' },
  },
  {
    sleutel: 'ritme.beheer', naam: 'Ritmes beheren', pakket: 'starter', rollen: MANAGERS, helpartikel: 'hercontactritme', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De stappen en parkeerduur van de ritmes aanpassen.', totDieTijd: 'Geen.' },
  },
  // P10: belblokken, belmodus en belscripts (F07, F08).
  {
    sleutel: 'belblok.uitvoeren', naam: 'Belmodus', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-belmodus', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Gesprek na gesprek bellen met een script en de uitkomst per gesprek.', totDieTijd: 'Je beltaken staan op Vandaag en bij Taken.' },
  },
  {
    sleutel: 'belblok.plannen', naam: 'Eigen belblokken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'belblokken', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Eigen vaste blokken met soort, plek en script, Top 10 en 15, en het blokdetail met "Vul aan".', totDieTijd: 'Je werkt met de twee standaard vaste blokken en de Top 5.' },
  },
  {
    sleutel: 'belblok.automatisch', naam: 'Blok vult zichzelf', pakket: 'starter', rollen: 'iedereen', helpartikel: 'belblokken', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een vast blok dat Dealtrace zelf vult, met de verhouding tussen nieuw en opvolging.', totDieTijd: 'Je vult je blokken zelf vanuit de bellijst.' },
  },
  {
    sleutel: 'belscript.kiezen', naam: 'Belscript kiezen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-belscript-kiezen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een script kiezen in het belpaneel en volgen tijdens het gesprek.', totDieTijd: 'Je belt met het standaardscript.' },
  },
  {
    sleutel: 'belscript.ai', naam: 'Script per account aanvullen', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-belscript-kiezen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'AI vult per account de aanleiding en het winpunt in, met bron.', totDieTijd: 'Het script werkt met vaste teksten en terugvalzinnen.' },
  },
  {
    sleutel: 'belscript.variant', naam: 'Mijn scripts', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-belscript-kiezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een persoonlijke variant van een script met je eigen formuleringen.', totDieTijd: 'Je belt met de scripts van je team.' },
  },
  {
    sleutel: 'belscript.vergelijken', naam: 'Scripts vergelijken', pakket: 'plus', rollen: 'iedereen', helpartikel: 'belscripts-maken', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Versies en varianten vergelijken op afspraken per gesprek.', totDieTijd: 'Je ziet de conversie per script in de keuzelijst.' },
  },
  {
    sleutel: 'belscript.beheer', naam: 'Belscripts beheren', pakket: 'starter', rollen: MANAGERS, helpartikel: 'belscripts-maken', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Scripts maken, testen en activeren voor teams.', totDieTijd: 'Vraag je salesmanager.' },
  },
  {
    sleutel: 'bellen.handsfree', naam: 'Handsfree bellen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'de-belmodus', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Dealtrace leest naam, reden en opening voor terwijl je rijdt.', totDieTijd: 'Je leest het script zelf op het scherm.' },
  },
  // P28: verkoopverhaal en Richting (F25).
  {
    sleutel: 'richting.concurrentiekaart', naam: 'Concurrentiekaart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'tegen-wie-we-verkopen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De concurrentkaarten downloaden om te printen of mee te nemen.', totDieTijd: 'Lees de concurrenten op Richting.' },
  },
  {
    sleutel: 'account.huidigeLeverancier', naam: 'Huidige leverancier zetten', pakket: 'starter', rollen: 'iedereen', helpartikel: 'tegen-wie-we-verkopen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Op de accountkaart kiezen bij wie de prospect nu koopt, met "Zo zeg je het" en bewijs.', totDieTijd: 'Je ziet de leverancier als iemand anders hem zette.' },
  },
  {
    sleutel: 'richting.voorstellen', naam: 'Voorstellen voor het verhaal', pakket: 'starter', rollen: 'iedereen', helpartikel: 'ons-verhaal', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een antwoord, bezwaar, winpunt of bewijs voorstellen aan je salesmanager.', totDieTijd: 'Bespreek het met je salesmanager.' },
  },
  {
    sleutel: 'verkoopverhaal.inrichten', naam: 'Verkoopverhaal inrichten', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'ons-verhaal', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De acht onderdelen van het verkoopverhaal vullen en bevestigen.', totDieTijd: 'Vraag je salesmanager of beheerder.' },
  },
  {
    sleutel: 'verkoopverhaal.mappings', naam: 'Mappings verkoopverhaal', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'ons-verhaal', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Branche naar SBI, verliesreden naar terugkomreden en ambitiedoelen beheren.', totDieTijd: 'Vraag je beheerder.' },
  },
  // P13: agenda, afspraken en meetingsoorten (F09).
  {
    sleutel: 'agenda.basis', naam: 'Afspraken plannen en afronden', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-afspraak-plannen-afronden-en-overdragen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een afspraak met een meetingsoort plannen en na afloop met één uitkomst afronden.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'agenda.aanDeBeurt', naam: 'Wie is er aan de beurt?', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-afspraak-plannen-afronden-en-overdragen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Hooguit acht voorstellen wie je nu moet spreken, met vormadvies.', totDieTijd: 'Je ziet je taken op Vandaag.' },
  },
  {
    sleutel: 'agenda.meetingAnalyse', naam: 'Meetinganalyse', pakket: 'starter', rollen: 'iedereen', helpartikel: 'agenda', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Haal je je meetingritme? Dekking per accountklasse, uitkomsten, verslagen en doorlooptijd naar vervolg. De salesmanager ziet ook zijn team.', totDieTijd: 'Je ziet je meetings op Meetings.' },
  },
  {
    sleutel: 'agenda.voorCollega', naam: 'Afspraak plannen voor een collega', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-afspraak-plannen-afronden-en-overdragen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Als binnendienst een afspraak in de agenda van de buitendienst zetten, met diens vrije momenten.', totDieTijd: 'Je plant afspraken voor jezelf.' },
  },
  {
    sleutel: 'agenda.koppeling', naam: 'Agenda koppelen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'koppelingen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Je agenda van Microsoft 365 of Google koppelen: bezet telt mee, afspraken komen erin.', totDieTijd: 'Je agenda staat alleen in Dealtrace.' },
  },
  {
    sleutel: 'agenda.weekritmeSoort', naam: 'Weekritme per meetingsoort', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-afspraak-plannen-afronden-en-overdragen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Hoeveel afspraken per meetingsoort je deze week had.', totDieTijd: 'Je ziet het totaal.' },
  },
  {
    sleutel: 'instellingen.meetingsoorten', naam: 'Meetingsoorten en uitkomsten', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'meetingsoorten-en-uitkomsten-inrichten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Soorten afspraken met duur, agendapunten en uitkomsten met gevolg beheren.', totDieTijd: 'De startset van zes meetingsoorten.' },
  },
  // P14: bezoeken, kansen langs de route en gebieden (F10, F18).
  {
    sleutel: 'bezoeken.route', naam: 'Route en kansen langs de route', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je route van vandaag met kaart, en de beste kansen vlak bij je bezoeken.', totDieTijd: 'Je bezoeken staan in je agenda.' },
  },
  {
    sleutel: 'bezoeken.kansenAlle', naam: 'Alle kansen met filters', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Alle kansen langs de route, met filters op bron, klasse, omrijtijd en aantal.', totDieTijd: 'Je ziet de drie beste kansen.' },
  },
  {
    sleutel: 'bezoeken.bellijst', naam: 'Bellijst naast je bezoeken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Wie je tussen de bezoeken door belt, zonder de accounts die je vandaag bezoekt.', totDieTijd: 'Je bellijst staat bij Belblokken.' },
  },
  {
    sleutel: 'bezoeken.teplannen', naam: 'Te plannen bezoeken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Open bezoektaken, oudste eerst, om in te plannen.', totDieTijd: 'Je bezoektaken staan bij Taken.' },
  },
  {
    sleutel: 'bezoeken.periode', naam: 'Periodefilter op bezoeken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Je route van morgen of een andere dag bekijken.', totDieTijd: 'Je ziet de route van vandaag.' },
  },
  {
    sleutel: 'bezoeken.klaarzetten', naam: 'Klaarzetten voor buitendienst', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een prospect klaarzetten voor de regiodag van een collega; hij verschijnt daar als kans.', totDieTijd: 'Je maakt een taak voor je collega.' },
  },
  {
    sleutel: 'bezoeken.eigenRegels', naam: 'Eigen kansregels en startadres', pakket: 'plus', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Ongeplande prospects in het gebied tonen, start- en eindadres per dag kiezen.', totDieTijd: 'De standaardregels gelden.' },
  },
  {
    sleutel: 'regio.analyse', naam: 'Bezoekanalyse', pakket: 'starter', rollen: 'iedereen', helpartikel: 'gebieden-en-regiodagen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Waar je omzet laat liggen: bezoekdekking per regio, uitkomsten, regiodagen en routes. De salesmanager ziet ook zijn team.', totDieTijd: 'Je ziet je bezoeken op Bezoeken.' },
  },
  {
    sleutel: 'instellingen.gebieden', naam: 'Gebieden en regiodagen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'gebieden-en-regiodagen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Regio\'s op postcode, eigenaren, regiodagen en synoniemen voor plaatsnamen.', totDieTijd: 'Accounts hebben nog geen regio.' },
  },
  // P30: onderweg op de telefoon (8.5.2, 8.5.3, 8.6, 8.8).
  {
    sleutel: 'onderweg.route', naam: 'Route op de telefoon', pakket: 'starter', rollen: 'iedereen', helpartikel: 'bezoeken-en-kansen-langs-de-route', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je volgende stop, de tijdlijn van de dag en kansen als tussenrij, ook offline.', totDieTijd: 'Je bezoeken staan op Vandaag.' },
  },
  {
    sleutel: 'onderweg.bezoekAfronden', naam: 'Bezoek afronden', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-bezoek-afronden-met-een-verslag', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Uitkomst, ingesproken verslag, foto en volgende stap in één venster, ook offline.', totDieTijd: 'Je rondt af in de agenda.' },
  },
  {
    sleutel: 'onderweg.dagpakket', naam: 'Dagpakket voor offline', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-dag-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Vandaag en morgen staan op je telefoon, zodat je ook zonder bereik verder kunt.', totDieTijd: 'Zonder verbinding zie je de laatst geladen schermen.' },
  },
  {
    sleutel: 'onderweg.inDeBuurt', naam: 'In de buurt', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Prospects en klanten binnen 15 minuten van waar je nu bent, met de reden.', totDieTijd: 'Je ziet de kansen langs je route.' },
  },
  {
    sleutel: 'onderweg.inloop', naam: 'Inloopbezoek', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een ongepland bezoek in drie tikken vastleggen.', totDieTijd: 'Je plant een afspraak en rondt hem af.' },
  },
  {
    sleutel: 'onderweg.aankomst', naam: 'Aankomstkaart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Open je de app bij een afspraak, dan staan Pitstop en Bezoek afronden bovenaan Vandaag.', totDieTijd: 'Je opent de afspraak via de route.' },
  },
  // P31: spraak, visitekaartje en meldingen voor onderweg (8.5.6, 8.9, 8.10).
  {
    sleutel: 'spraak.inspreken', naam: 'Inspreken in tekstvelden', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inspreken-in-plaats-van-typen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een verslag of notitie inspreken; de tekst komt in het veld. Transcriptie in de EU, de opname verdwijnt daarna.', totDieTijd: 'Je typt je verslag.' },
  },
  {
    sleutel: 'spraak.opdracht', naam: 'Spraakopdracht: taak en notitie', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inspreken-in-plaats-van-typen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Eén ingesproken zin wordt een echte taak of notitie op het juiste account.', totDieTijd: 'Je maakt een taak met + Taak.' },
  },
  {
    sleutel: 'spraak.opdrachtUitgebreid', naam: 'Spraakopdracht: afspraak en mail', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inspreken-in-plaats-van-typen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Ook een afspraak of een mailconcept inspreken. Een mail verstuur je altijd zelf.', totDieTijd: 'Je spreekt taken en notities in.' },
  },
  {
    sleutel: 'spraak.voorlezen', naam: 'Voorlezen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inspreken-in-plaats-van-typen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je dag, een briefing of de recap in een minuut voorgelezen.', totDieTijd: 'Je leest het zelf.' },
  },
  {
    sleutel: 'spraak.handsfree', naam: 'Handsfree bellen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'In de belmodus leest Dealtrace de opening voor en vraagt na het gesprek "Hoe ging het?".', totDieTijd: 'Je kijkt op je scherm tussen de gesprekken.' },
  },
  {
    sleutel: 'contact.visitekaartje', naam: 'Visitekaartje scannen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een foto van een visitekaartje wordt een contactpersoon, zonder overtypen en zonder dubbelen.', totDieTijd: 'Je typt de contactpersoon over.' },
  },
  {
    sleutel: 'meldingen.onderweg', naam: 'Meldingen voor onderweg', pakket: 'starter', rollen: 'iedereen', helpartikel: 'meldingen-instellen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Vertrek, briefing, verslag, dagstart en recap als pushmelding, met stille uren en een dagplafond.', totDieTijd: 'Je ziet meldingen in de app.' },
  },
  {
    sleutel: 'meldingen.perSoort', naam: 'Meldingsregels per soort', pakket: 'starter', rollen: 'iedereen', helpartikel: 'meldingen-instellen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Je eigen dagplafond en stille uren per soort melding.', totDieTijd: 'De standaard: zes per dag, stil van 19:00 tot 07:00 en in het weekend.' },
  },
  // P26: meldingen per kanaal, rijmodus, kanalen en consent, WhatsApp Business.
  {
    sleutel: 'meldingen.kanalen', naam: 'Meldingen per soort en kanaal', pakket: 'starter', rollen: 'iedereen', helpartikel: 'meldingen-instellen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Per soort melding kiezen: in de app, per e-mail of als push. Gelezen geldt op al je toestellen.', totDieTijd: 'Je ziet alle meldingen in de app.' },
  },
  {
    sleutel: 'meldingen.rijmodus', naam: 'Rijmodus', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Alleen grote knoppen voor voorlezen, inspreken en de volgende bellen; meldingen wachten tot je stopt en komen dan gebundeld.', totDieTijd: 'Meldingen komen binnen terwijl je rijdt; zet je telefoon zelf op stil.' },
  },
  {
    sleutel: 'instellingen.kanalen', naam: 'Kanalen en consent', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'kanalen-en-consent', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Afkoelperiodes en frequentieplafond per kanaal, de voorwaarden voor mail, WhatsApp-sjablonen en de bel-me-niet-lijst.', totDieTijd: 'De standaard afkoelperiodes en één bericht per kanaal per 3 werkdagen.' },
  },
  {
    sleutel: 'whatsapp.versturen', naam: 'WhatsApp versturen', pakket: 'plus', rollen: 'iedereen', helpartikel: 'concepten-goedkeuren-en-versturen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een goedgekeurd WhatsApp-concept gaat via de koppeling uit een goedgekeurd sjabloon, alleen naar wie toestemming gaf.', totDieTijd: 'Je opent het bericht in WhatsApp met de tekst al ingevuld.' },
  },
  {
    sleutel: 'koppeling.whatsapp', naam: 'WhatsApp Business koppelen', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'WhatsApp Business koppelen via de provider, met test, opt-in-tekst en sjablonen ter goedkeuring.', totDieTijd: 'WhatsApp gaat via de app van de gebruiker (wa.me).' },
  },
  // P16: campagnes (F12). Meedoen voor iedereen; maken vanaf Gevorderd; alle soorten, tussendoelen en mailreeks op mandaat B voor Expert.
  {
    sleutel: 'campagnes.meedoen', naam: 'Meedoen aan campagnes', pakket: 'starter', rollen: 'iedereen', helpartikel: 'campagnes', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Taken uit een campagne uitvoeren en het campagnebord lezen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'campagnes.maken', naam: 'Campagne maken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een campagne uit de acht startsoorten opzetten met de wizard, het bord gebruiken en taken spreiden over je belblokken.', totDieTijd: 'Je doet mee aan campagnes van je salesmanager.' },
  },
  {
    sleutel: 'campagnes.alleSoorten', naam: 'Alle campagnesoorten', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Naast de acht startsoorten alle soorten in vijf groepen, met zoeken.', totDieTijd: 'Je kiest uit de acht startsoorten.' },
  },
  {
    sleutel: 'campagnes.tussendoelen', naam: 'Tussendoelen in een campagne', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Tussendoelen uit de reis naast het einddoel van de campagne.', totDieTijd: 'De campagne heeft één einddoel.' },
  },
  {
    sleutel: 'campagnes.dynamisch', naam: 'Dynamische doelgroep', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Nieuwe accounts uit de doelgroep komen er tijdens de looptijd vanzelf bij.', totDieTijd: 'Je voegt accounts toe met + Accounts.' },
  },
  {
    sleutel: 'campagnes.mailreeksB', naam: 'Mailreeks door de Verzender', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Mail 2 en verder binnen een goedgekeurde campagne verstuurt de Verzender zelf (mandaat B), met dagplafond en afmeldlink.', totDieTijd: 'Elke mail staat als concept klaar en je verstuurt hem zelf.' },
  },
  {
    sleutel: 'campagnes.boodschapAI', naam: 'Boodschap en winpunt met AI', pakket: 'plus', rollen: 'iedereen', helpartikel: 'een-campagne-opzetten', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een winpuntvoorstel en een boodschap per kanaal met stijlscore, uit het bevestigde verkoopverhaal.', totDieTijd: 'Je kiest het winpunt en gebruikt de vaste scripttekst.' },
  },
  {
    sleutel: 'campagnes.team', naam: 'Campagnes van het team', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'een-campagne-opzetten', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Activeren boven capaciteit, verdelen over verkopers en resultaat per campagne.', totDieTijd: 'Vraag je salesmanager.' },
  },
  {
    sleutel: 'instellingen.campagnesoorten', naam: 'Campagnesoorten', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'een-campagne-opzetten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Campagnesoorten aan en uit zetten.', totDieTijd: 'De acht startsoorten staan aan.' },
  },
  // P17: funnel van de prospectreis en overdracht (F17).
  {
    sleutel: 'funnel.eigen', naam: 'Je eigen funnel', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Hoeveel accounts per fase, en waar het het meest stokt.', totDieTijd: 'Je salesmanager bespreekt de funnel met je.' },
  },
  {
    sleutel: 'funnel.filters', naam: 'Funnel per doelgroep, reis en campagne', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Conversie, doorlooptijd, uitval met reden en pogingen tot afspraak, per doelgroep, reis of campagne.', totDieTijd: 'Je ziet de aantallen en het stokpunt.' },
  },
  {
    sleutel: 'funnel.vergelijken', naam: 'Reizen vergelijken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Twee reizen naast elkaar op hoofdfase.', totDieTijd: 'Je kiest één reis tegelijk.' },
  },
  {
    sleutel: 'funnel.export', naam: 'Funnel downloaden', pakket: 'starter', rollen: 'iedereen', helpartikel: 'funnel', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De funnel zoals op het scherm als CSV.', totDieTijd: 'Je leest de funnel op het scherm.' },
  },
  {
    sleutel: 'funnel.team', naam: 'Funnel van het team', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'funnel', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De funnel per team en per persoon, met download.', totDieTijd: 'Vraag je salesmanager.' },
  },
  {
    sleutel: 'overdracht.basis', naam: 'Overdragen na de eerste afspraak', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-afspraak-plannen-afronden-en-overdragen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Na een eerste afspraak met vervolg het account overdragen aan DealDrive, het CRM of een collega, met briefing.', totDieTijd: 'Geen.' },
  },
  // P23: overdracht naar DealDrive en het bewijs na een gewonnen deal (F17, F25).
  {
    sleutel: 'overdracht.dealdrive', naam: 'Overdragen aan DealDrive', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-goede-overdracht', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Na de eerste afspraak gaat het account met briefing naar DealDrive; je ziet de link en de bevestiging op de accountkaart.', totDieTijd: 'Je krijgt een overdrachtstaak met de briefing om te mailen of te downloaden.' },
  },
  {
    sleutel: 'overdracht.bewijsVoorstel', naam: 'Gewonnen deal als bewijs', pakket: 'starter', rollen: 'iedereen', helpartikel: 'een-goede-overdracht', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Na een gewonnen deal in DealDrive beantwoord je "Mag dit een bewijs worden?"; ja wordt een suggestie voor de salesmanager.', totDieTijd: 'De gewonnen deal telt mee in de funnel; je salesmanager kiest zelf bewijs.' },
  },
  {
    sleutel: 'instellingen.funnelNormen', naam: 'Normen per fase', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'funnel', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Conversie- en doorlooptijdnormen per fase van de funnel.', totDieTijd: 'De standaardnormen gelden.' },
  },
  // P18: briefings, Pitstop, Schrijver en mail (F11, 11.5, 8.5.7, 12).
  {
    sleutel: 'briefing.lezen', naam: 'Briefing lezen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'briefing-en-pitstop', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Voor elk gesprek een briefing met de juiste soort, ook zonder AI-credits.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'briefing.bewerken', naam: 'Briefing bewerken en delen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'briefing-en-pitstop', startNiveau: 'gevorderd',
    // Het overzicht /briefings staat in het hoofdmenu direct onder Taken.
    zijbalk: { groep: 'Activiteiten', route: '/briefings', icoon: 'FileText', naam: 'Briefings', na: 'nav.acties' },
    uitleg: { watHetDoet: 'Eigen tekst per blok, het overzicht van je briefings en de volledige printbare briefing.', totDieTijd: 'Je leest de berekende briefing.' },
  },
  {
    sleutel: 'briefing.soortVastzetten', naam: 'Briefingsoort vastzetten', pakket: 'plus', rollen: 'iedereen', helpartikel: 'briefing-en-pitstop', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De soort briefing per gesprek zelf kiezen en vastzetten.', totDieTijd: 'Dealtrace kiest de soort.' },
  },
  {
    sleutel: 'pitstop.maken', naam: 'Pitstop', pakket: 'plus', rollen: 'iedereen', helpartikel: 'briefing-en-pitstop', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De Schrijver maakt per taak of afspraak een concept: belscript, mail, LinkedIn-bericht of bezoekbriefing. Jij keurt goed.', totDieTijd: 'Je gebruikt de berekende briefing.' },
  },
  {
    sleutel: 'pitstop.opnieuw', naam: 'Pitstop opnieuw maken', pakket: 'plus', rollen: 'iedereen', helpartikel: 'briefing-en-pitstop', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een nieuw concept laten schrijven, met een andere toon.', totDieTijd: 'Je past het concept zelf aan.' },
  },
  {
    sleutel: 'concepten.inbox', naam: 'Concepten goedkeuren', pakket: 'starter', rollen: 'iedereen', helpartikel: 'concepten-goedkeuren-en-versturen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Alles wat agents klaarzetten op één plek, met goedkeuren, aanpassen en verwerpen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'mail.versturen', naam: 'Mail versturen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'concepten-goedkeuren-en-versturen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een goedgekeurde mail versturen via de mail van de organisatie, binnen consent en afkoelperiode.', totDieTijd: 'Je verstuurt via je eigen mailapp.' },
  },
  {
    sleutel: 'koppeling.mail', naam: 'Mail koppelen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De SMTP van de organisatie koppelen, met test en controle op SPF, DKIM en DMARC.', totDieTijd: 'Mail gaat via de mailapp van de gebruiker.' },
  },
  {
    sleutel: 'instellingen.mailsjablonen', naam: 'Mailsjablonen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'concepten-goedkeuren-en-versturen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Sjablonen per kanaal met variabelen, voor campagnes en concepten.', totDieTijd: 'De Schrijver schrijft zonder sjabloon.' },
  },
  {
    // F7: sjablonen voor opvolgreeksen per organisatie (stappen, kanaal, instructie voor de Schrijver, stopregels).
    sleutel: 'instellingen.opvolgreeksen', naam: 'Sjablonen voor opvolgreeksen', pakket: 'starter', rollen: MANAGERS, helpartikel: 'volgen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Sjablonen voor opvolgreeksen maken en wijzigen: stappen per dag, kanaal, onderwerp en instructie voor de Schrijver, stopregels en bij welke uitkomst ze starten.', totDieTijd: 'De drie startsjablonen gelden.' },
  },
  // P33: AI-assistent en credits (F26, 11.4). Op alle niveaus; de credits begrenzen, niet het niveau.
  {
    sleutel: 'assistent.chat', naam: 'AI-assistent', pakket: 'starter', rollen: 'iedereen', helpartikel: 'chatten-met-de-ai-assistent', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Vragen stellen bij elk scherm, met bronnen en voorstellen als concept.', totDieTijd: 'Zoek in het helpcenter.' },
  },
  {
    sleutel: 'assistent.webonderzoek', naam: 'Webonderzoek door de assistent', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'chatten-met-de-ai-assistent', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'De assistent zoekt op internet, na akkoord over de kosten.', totDieTijd: 'De assistent gebruikt alleen jullie eigen gegevens.' },
  },
  {
    sleutel: 'credits.eigenVerbruik', naam: 'Eigen AI-verbruik', pakket: 'starter', rollen: 'iedereen', helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Zien hoeveel AI-credits je deze maand gebruikte.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'credits.beheer', naam: 'AI-credits beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Verbruik per soort en gebruiker, plafonds, dagplafonds voor agents en extra credits aanvragen.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'credits.verbruikLezen', naam: 'Verbruik van de organisatie lezen', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Het AI-verbruik van de organisatie per soort en per gebruiker lezen.', totDieTijd: 'Je ziet je eigen verbruik.' },
  },
  // P32: dagritme-kern en Vandaag op de telefoon (F01, hoofdstuk 8).
  {
    sleutel: 'vandaag.telefoon', naam: 'Vandaag op de telefoon', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Groet, eerste zet, telstrip en stapels met de handeling in de regel.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'vandaag.voorlezen', naam: 'Lees voor', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je dag in een minuut voorgelezen door je telefoon.', totDieTijd: 'Lees de dag zelf.' },
  },
  {
    sleutel: 'vandaag.signaal', naam: 'Signaal van de dag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Eén signaal per keer met bewijs, af te handelen met Gedaan, Later of Weg.', totDieTijd: 'De belangrijkste aanleiding van de dag staat op Vandaag.' },
  },
  {
    sleutel: 'vandaag.tip', naam: 'Tip van de dag', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Eén regel advies onder je eerste zet.', totDieTijd: 'Geen tip.' },
  },
  {
    sleutel: 'vandaag.dagkiezerWeek', naam: 'Dagkiezer met Week', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Vandaag, morgen of een dag in de week bekijken.', totDieTijd: 'Je kijkt vooruit naar morgen.' },
  },
  {
    sleutel: 'vandaag.recapRisico', naam: 'Recap met risico\'s', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Na 16:00 ook achterstand en stilstaande reizen in de recap.', totDieTijd: 'De recap toont verslagen en morgen.' },
  },
  {
    sleutel: 'vandaag.recapWeek', naam: 'Recap met weekterugblik', pakket: 'starter', rollen: 'iedereen', helpartikel: 'vandaag', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De recap met gesprekken, afspraken en overdrachten van deze week.', totDieTijd: 'De recap toont de dag.' },
  },
  // Dagritme: dagstart (F3 Dagplanner), weekstart en weekreview (F10), ook per e-mail. Bereikbaar vanaf Vandaag en Mijn dashboard.
  {
    sleutel: 'dagritme.dagstart', naam: 'Dagstart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dagstart', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Je dag ingedeeld: afspraken vast, bezoeken op route, belblokken in het uur waarop je doelgroep opneemt en een voorbereidingsblok.', totDieTijd: 'Je dag staat op Vandaag en in je agenda.' },
  },
  {
    sleutel: 'dagritme.weekstart', naam: 'Weekstart', pakket: 'starter', rollen: 'iedereen', helpartikel: 'weekstart', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Op maandag je weekplan: afspraken, bezoeken, belblokken, je voornemens met hun stand, wat openstaat en je tempo.', totDieTijd: 'Je week staat in je agenda.' },
  },
  {
    sleutel: 'dagritme.weekreview', naam: 'Weekreview', pakket: 'starter', rollen: 'iedereen', helpartikel: 'weekreview', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Vrijdag in vijf minuten: wat bewoog, wat werkte, wat bleef liggen en drie voornemens die meteen ingepland staan.', totDieTijd: 'Je cijfers staan op Mijn dashboard.' },
  },
  {
    sleutel: 'dagritme.mail', naam: 'Dagritme per mail', pakket: 'starter', rollen: 'iedereen', helpartikel: 'meldingen-instellen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Weekreview, weekstart en dagstart per e-mail, elk met een eigen schakelaar en tijdstip.', totDieTijd: 'Je opent ze in de app.' },
  },
  // P29: SalesDNA-koppeling (F25).
  {
    sleutel: 'koppeling.salesdna', naam: 'SalesDNA koppelen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Het verkoopverhaal automatisch uit SalesDNA laten komen, met status en logboek.', totDieTijd: 'Jullie richten het verkoopverhaal zelf in.' },
  },
  {
    sleutel: 'koppeling.salesdna.bronPerOnderdeel', naam: 'Bron per onderdeel kiezen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Per onderdeel kiezen of SalesDNA of de eigen inrichting de bron is, met vergelijken en een controlelijst.', totDieTijd: 'Alles komt uit de eigen inrichting.' },
  },
  // P23: suggesties naar SalesDNA en de DealDrive-koppeling (F25, hoofdstuk 12).
  {
    sleutel: 'salesdna.suggesties.vrijgeven', naam: 'Suggesties naar SalesDNA vrijgeven', pakket: 'plus', rollen: ['salesmanager', 'beheerder'], helpartikel: 'verbetervoorstellen-beoordelen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De wekelijkse bundel suggesties met bewijs beoordelen, aanpassen en vrijgeven naar kader 2 in SalesDNA.', totDieTijd: 'Wat Dealtrace leert, blijft in Dealtrace; je past het verkoopverhaal zelf aan.' },
  },
  {
    sleutel: 'koppelingen.dealdrive', naam: 'DealDrive-koppeling', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De stand van de DealDrive-koppeling, Test verbinding en de lijst mislukte overdrachten. De founder richt de koppeling in.', totDieTijd: 'Overdrachten gaan als taak met briefing.' },
  },
  // P27: inloggen met code en de mobiele schil (F24, hoofdstuk 8).
  {
    sleutel: 'auth.toestellen', naam: 'Toestellen en sessies', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Zien waar je bent ingelogd en uitloggen op één of alle toestellen.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'schil.onderbalk', naam: 'Onderbalk', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Op de telefoon vijf tabs per werkplek en Meer voor de rest.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'schil.handschoenmodus', naam: 'Handschoenmodus', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Grotere knoppen op de telefoon.', totDieTijd: 'Geen.' },
  },
  {
    sleutel: 'schil.zonlichtmodus', naam: 'Zonlichtmodus', pakket: 'starter', rollen: 'iedereen', helpartikel: 'dealtrace-op-je-telefoon-en-offline', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Meer contrast buiten in de zon.', totDieTijd: 'Geen.' },
  },
  // P12: prospectplanning en terugkomregels (F13, F25).
  {
    sleutel: 'planning.jaar', naam: 'Jaarplanning', pakket: 'starter', rollen: 'iedereen', helpartikel: 'prospectplanning', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Zien wie dit verkoopjaar aan de beurt is per potentie, en wat er knelt.', totDieTijd: 'De motor zet je belpogingen klaar op Vandaag.' },
  },
  {
    sleutel: 'planning.inplannen', naam: 'Plan in belblokken', pakket: 'starter', rollen: 'iedereen', helpartikel: 'prospectplanning', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een achterstand met één klik verdelen over je koude belblokken.', totDieTijd: 'Plan je belblokken zelf of laat de motor het doen.' },
  },
  {
    sleutel: 'planning.vensters', naam: 'Vensters per potentie', pakket: 'starter', rollen: ['salesmanager', 'beheerder'], helpartikel: 'prospectplanning', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Startmaand, vensters en de potentie per klasse instellen.', totDieTijd: 'Vraag je salesmanager.' },
  },
  {
    sleutel: 'terugkomen.lezen', naam: 'Terugkomregels', pakket: 'starter', rollen: 'iedereen', helpartikel: 'wanneer-we-iemand-terugbellen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Zien wanneer en hoe je terugkomt na een nee of een verlies.', totDieTijd: 'Op de terugkomdatum staat een taak met de aanpak.' },
  },
  {
    sleutel: 'terugkomen.koppelenEnOpbrengst', naam: 'Opbrengst per terugkomregel', pakket: 'starter', rollen: 'iedereen', helpartikel: 'wanneer-we-iemand-terugbellen', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Per regel zien wat terugkomen opleverde, en een regel aan een ander ritme voorstellen.', totDieTijd: 'Je ziet de regels zelf.' },
  },
  // P11: leadgenerator, AI-zoeker en KvK (F02).
  {
    sleutel: 'leads.overnemen', naam: 'Neem over', pakket: 'starter', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een gevonden lead overnemen als prospect met eerste taak, of afwijzen met een reden.', totDieTijd: 'Je salesmanager zet leads voor je klaar; ze staan als taak op Vandaag.' },
  },
  {
    sleutel: 'leads.kvk', naam: 'Zoeken in KvK', pakket: 'plus', rollen: 'iedereen', helpartikel: 'kvk-en-datacollectief', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Bedrijven zoeken in het handelsregister op branche, plaats en postcode.', totDieTijd: 'Voeg een prospect met de hand toe.' },
  },
  {
    sleutel: 'leads.aiZoeker', naam: 'AI-zoeker', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De Zoeker vindt bedrijven die passen bij je doelgroep, met bewijs, bron en datum.', totDieTijd: 'Zoek in KvK of importeer een lijst.' },
  },
  {
    sleutel: 'leads.opgeslagen', naam: 'Opgeslagen zoekopdrachten', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een zoekopdracht bewaren en later opnieuw draaien.', totDieTijd: 'Stel de zoekopdracht elke keer opnieuw samen.' },
  },
  {
    sleutel: 'leads.automatisch', naam: 'Automatische rondes', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Een opgeslagen zoekopdracht elke week laten draaien.', totDieTijd: 'Start een ronde zelf.' },
  },
  {
    sleutel: 'koppeling.kvk', naam: 'KvK koppelen', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De KvK-sleutel van je organisatie plakken, testen en een maandplafond zetten.', totDieTijd: 'Vraag je beheerder.' },
  },
  // P15: Datacollectief als vijfde bron (F02).
  {
    sleutel: 'leadgenerator.datacollectief', naam: 'Datacollectief in rondes', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'kvk-en-datacollectief', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Selecties op doelgroep met contactpersonen (functie, direct nummer, zakelijk e-mailadres) als bron in zoekrondes.', totDieTijd: 'Zoek met KvK of de AI-zoeker.' },
  },
  {
    sleutel: 'datacollectief.verrijken', naam: 'Contactpersonen zoeken via Datacollectief', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'kvk-en-datacollectief', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Op een account contactpersonen met functie en nummer ophalen.', totDieTijd: 'Voeg contactpersonen zelf toe.' },
  },
  // P20: CRM-koppeling (F02, hoofdstuk 12).
  {
    sleutel: 'koppeling.crm', naam: 'CRM koppelen', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Het CRM verbinden, de veldtoewijzing, de richting per object, de eigenaarsregel en de overdracht naar het CRM instellen.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'koppeling.crmSync', naam: 'CRM synchroniseren', pakket: 'plus', rollen: 'iedereen', helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Synchroniseer nu en het synchronisatielog van het CRM.', totDieTijd: 'Het CRM synchroniseert elk uur vanzelf.' },
  },
  {
    sleutel: 'leadgenerator.crm', naam: 'CRM als bron', pakket: 'plus', rollen: 'iedereen', helpartikel: 'leadgenerator', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Prospects uit het CRM die nog niet in Dealtrace staan als leads, met dezelfde groepen en ontdubbeling.', totDieTijd: 'Treffers in het CRM staan wel bij Al in je bestand.' },
  },
  {
    sleutel: 'koppeling.datacollectief', naam: 'Datacollectief koppelen', pakket: 'compleet', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De sleutel van jullie Datacollectief-contract plakken, testen en een maandplafond zetten.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'onderweg.kvkOpzoeken', naam: 'KvK opzoeken', pakket: 'plus', rollen: 'iedereen', helpartikel: 'kvk-en-datacollectief', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Een bedrijf dat je passeert opzoeken in KvK en met één tik toevoegen.', totDieTijd: 'Voeg een prospect met de hand toe.' },
  },
  // P09: helpcenter en niveaus (F21, 4.2).
  {
    sleutel: 'help.lezen', naam: 'Helpcenter', pakket: 'starter', rollen: 'iedereen', helpartikel: 'je-eerste-dag-in-dealtrace', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Uitleg over elk scherm en over new business, met hulp per scherm.', totDieTijd: 'Geen; het helpcenter staat altijd aan.' },
  },
  {
    sleutel: 'help.eigenArtikelen', naam: 'Eigen helpartikelen', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen artikelen voor de organisatie schrijven en publiceren, met statistiek.', totDieTijd: 'Iedereen leest de artikelen van Dealtrace.' },
  },
  {
    sleutel: 'help.kennisbankBron', naam: 'Eigen kennisbank voor de AI-assistent', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'koppelingen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De eigen artikelen als bron voor de AI-assistent aanzetten.', totDieTijd: 'De AI-assistent antwoordt uit de artikelen van Dealtrace.' },
  },
  {
    sleutel: 'help.verbergen', naam: 'Artikelen verbergen', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Een artikel van Dealtrace verbergen voor je organisatie.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'niveaus.iedereenAlles', naam: 'Iedereen ziet alles', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'gebruikers-rollen-niveaus', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Voor iedereen alle functies uit het pakket aanzetten, los van het niveau.', totDieTijd: 'Vraag je beheerder.' },
  },
  // P08: agents en mandaten (11.3, F14).
  {
    sleutel: 'agents.lezen', naam: 'Agents en mandaten lezen', pakket: 'starter', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Zien welke agents er zijn, met welk mandaat, en wat de Bewaker vandaag tegenhield.', totDieTijd: 'Je ziet bij elke taak van een agent wie het deed.' },
  },
  {
    sleutel: 'agents.eigenMandaat', naam: 'Eigen mandaat', pakket: 'plus', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Je eigen mandaat en dagplafond per agent zetten, binnen wat de organisatie toestaat.', totDieTijd: 'Het mandaat van de organisatie geldt.' },
  },
  {
    sleutel: 'agents.beheer', naam: 'Mandaten beheren', pakket: 'starter', rollen: ['beheerder'], helpartikel: 'agents-en-mandaten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Mandaten per agent zetten, dagplafonds en de knop Agents pauzeren.', totDieTijd: 'Vraag je beheerder.' },
  },
  {
    sleutel: 'agents.waaromNiet', naam: 'Waarom niet?', pakket: 'plus', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Zien welke handelingen de Bewaker bij je accounts tegenhield, met de reden.', totDieTijd: 'Geen.' },
  },
  // P19: agents voor interne en externe bronnen (F14).
  {
    sleutel: 'inzichten.handmatig', naam: 'Inzicht met bron', pakket: 'starter', rollen: 'iedereen', helpartikel: 'inzichten-beoordelen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Zelf een inzicht toevoegen met bron en citaat.', totDieTijd: 'Maak een taak met een notitie.' },
  },
  {
    sleutel: 'account.opnieuwOnderzoeken', naam: 'Laat opnieuw onderzoeken', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De Verrijker ververst het dossier van een account (10 credits).', totDieTijd: 'De Verrijker ververst het dossier in de wekelijkse run.' },
  },
  {
    sleutel: 'account.bronnenVolgen', naam: 'Bronnen om te volgen', pakket: 'compleet', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Eigen URL\'s en trefwoorden per account die de Waarnemer meeneemt.', totDieTijd: 'De Waarnemer volgt het profiel van de doelgroep.' },
  },
  {
    sleutel: 'waarnemer.profielen', naam: 'Waarnemer instellen', pakket: 'plus', rollen: 'iedereen', helpartikel: 'agents-en-mandaten', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Per doelgroep instellen op welke signalen de Waarnemer let.', totDieTijd: 'De Waarnemer gebruikt het standaardprofiel.' },
  },
  {
    sleutel: 'verbruik.lezen', naam: 'AI-verbruik lezen', pakket: 'starter', rollen: ['salesmanager'], helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De AI-credits die de agents deze maand verbruikten.', totDieTijd: 'Vraag je beheerder.' },
  },
  // Datakwaliteit: de gaten in je accounts, contacten, taken en afspraken, met een score.
  {
    sleutel: 'data.kwaliteit', naam: 'Datakwaliteit', pakket: 'starter', rollen: 'iedereen', helpartikel: 'datakwaliteit', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Welke gegevens ontbreken bij je prospects en contacten: beslisser, telefoon, e-mail, branche, reis, verslagen en meer, met een score en een lijst per gat.', totDieTijd: 'Op de accountkaart zie je per account wat er ontbreekt.' },
  },
  // P21: team, coaching, analyse en Mijn resultaten (F20).
  {
    sleutel: 'resultaten.trend', naam: 'Trend en teamgemiddelde', pakket: 'starter', rollen: 'iedereen', helpartikel: 'je-cijfers-lezen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Je cijfers over vier weken en het teamgemiddelde, zonder namen van collega\'s.', totDieTijd: 'Je ziet je eigen cijfers van deze periode.' },
  },
  {
    sleutel: 'resultaten.zelfanalyse', naam: 'Wat kan ik beter doen?', pakket: 'plus', rollen: 'iedereen', helpartikel: 'je-cijfers-lezen', startNiveau: 'expert',
    uitleg: { watHetDoet: 'De Coach geeft hoogstens drie punten voor deze week, met cijfers en een artikel (20 credits).', totDieTijd: 'Bespreek je cijfers met je salesmanager.' },
  },
  {
    sleutel: 'coaching.coachVoorstel', naam: 'Coachingpunten van de Coach', pakket: 'plus', rollen: MANAGERS, helpartikel: 'coachingsgesprek', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'De Coach stelt hoogstens drie coachingpunten voor met onderbouwing; jij beslist en deelt.', totDieTijd: 'Schrijf de coachingpunten zelf.' },
  },
  {
    sleutel: 'analyse.verbetervoorstel', naam: 'Verbetervoorstellen', pakket: 'plus', rollen: MANAGERS, helpartikel: 'verbetervoorstellen-beoordelen', startNiveau: 'gevorderd',
    uitleg: { watHetDoet: 'Elke maand een voorstel van de Coach per reisversie, met Accepteer, Wijs af en Later.', totDieTijd: 'Pas de reis zelf aan.' },
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
  // P24: de rest van Platformbeheer (alleen founder) en de spiegels voor de beheerder.
  ...([
    ['platform.abonnementen', 'Abonnementen', 'Pakketten met functies, bronnen, AI-credits per gebruiker en prijzen met geldig-vanaf.'],
    ['platform.features', 'Features per niveau', 'Per functie en niveau aan of uit, voor alle organisaties of als afwijking voor één.'],
    ['platform.facturen', 'Facturen', 'Facturen uit Stripe, marge per klant, extra credits als factuurregel en Moneybird.'],
    ['platform.verbruik', 'Verbruik en credits', 'Credits per klant, soort en gebruiker; extra credits en de prijs per handeling.'],
    ['platform.ai', 'AI-koppeling', 'Provider, sleutel als vingerafdruk, modellen per soort en modelprijzen.'],
    ['platform.prompts', 'Agent-prompts', 'Per slot de platformlaag met versies, het vaste kader en Proefdraai.'],
    ['platform.help', 'Help-artikelen', 'De platformartikelen met versie en status.'],
    ['platform.roadmap', 'Roadmap', 'Het bord over alle klanten met Maak issue.'],
    ['platform.motor', 'Motor', 'Laatste runs per organisatie, fouten per stap en Draai opnieuw.'],
    ['platform.audit', 'Platformaudit', 'Alles wat founders deden, met filters.'],
  ] as const).map(([sleutel, naam, wat]) => ({ sleutel, naam, pakket: 'starter' as const, rollen: ['founder'] as Rol[], helpartikel: '', startNiveau: 'beginner' as const, uitleg: { watHetDoet: wat, totDieTijd: 'Geen.' } })),
  {
    sleutel: 'instellingen.prompts', naam: 'Eigen agent-prompts', pakket: 'plus', rollen: ['beheerder'], helpartikel: 'abonnement-verbruik-ai-credits', startNiveau: 'expert',
    uitleg: { watHetDoet: 'Per slot een eigen laag boven de prompt van het platform, met Proefdraai.', totDieTijd: 'De AI gebruikt de prompts van het platform.' },
  },
  {
    sleutel: 'roadmap', naam: 'Roadmap', pakket: 'starter', rollen: 'iedereen', helpartikel: 'je-eerste-dag-in-dealtrace', startNiveau: 'beginner',
    uitleg: { watHetDoet: 'Wensen indienen en stemmen binnen je organisatie, en zien wat er gebouwd wordt.', totDieTijd: 'Geef je wens door aan je beheerder.' },
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

/**
 * Wat er voor deze gebruiker aanstaat (4.2, 4.4): aan, nog niet aangezet (met het niveau
 * waarop de functie aangaat), buiten het pakket en verborgen door "Toon minder". Een
 * functie voor een andere rol telt nergens mee.
 */
export function functiesVoor(
  gebruiker: Pick<GebruikerContext, 'rol' | 'niveau'>,
  organisatie: OrganisatieContext,
  stand: FunctieRegel[],
  verborgen: string[] = [],
) {
  const weg = new Set(verborgen)
  const uit = { aan: [] as string[], nietAangezet: [] as { sleutel: string; niveau: Niveau | null }[], buitenPakket: [] as { sleutel: string; pakket: Pakket }[], verborgen: [] as string[] }
  for (const f of FUNCTIES) {
    const b = beschikbaar(f.sleutel, gebruiker, organisatie, stand)
    if (b.ok) (weg.has(f.sleutel) ? uit.verborgen : uit.aan).push(f.sleutel)
    else if (b.reden === 'niveau') uit.nietAangezet.push({ sleutel: f.sleutel, niveau: aanVanaf(f.sleutel, organisatie, stand) })
    else if (b.reden === 'pakket' && rolMagFunctie(gebruiker.rol, f)) uit.buitenPakket.push({ sleutel: f.sleutel, pakket: f.pakket })
  }
  return uit
}

const WEEK_MS = 7 * 24 * 3600 * 1000
/** De datum voor functies die er al waren toen de gebruiker voor het eerst keek: nooit "nieuw". */
export const AL_GEZIEN = '2000-01-01T00:00:00.000Z'

/**
 * Welke functies gingen voor deze gebruiker aan? `gezien` houdt per functie bij sinds
 * wanneer hij aanstaat. Een functie die uit en weer aan gaat, is opnieuw nieuw; precies
 * 7 dagen na het aangaan is hij niet meer nieuw.
 */
export function nieuwVoorMij(aanNu: string[], gezien: Record<string, string> | undefined, nu: Date): { gezien: Record<string, string>; nieuw: string[]; netAan: string[]; gewijzigd: boolean } {
  const eerste = !gezien
  const uit: Record<string, string> = {}
  const netAan: string[] = []
  for (const s of aanNu) {
    if (gezien?.[s]) uit[s] = gezien[s]!
    else { uit[s] = eerste ? AL_GEZIEN : nu.toISOString(); if (!eerste) netAan.push(s) }
  }
  const gewijzigd = eerste || netAan.length > 0 || Object.keys(gezien ?? {}).some((s) => !(s in uit))
  const nieuw = Object.entries(uit).filter(([, op]) => nu.getTime() - Date.parse(op) < WEEK_MS).map(([s]) => s)
  return { gezien: uit, nieuw, netAan, gewijzigd }
}

/** De feature (hoofdstuk 7, F01 tot en met F26) waar een functie bij hoort, voor het raster van de founder. */
const FEATURE_GROEPEN: [RegExp, string][] = [
  [/^(resultaten|coaching|analyse)\./, 'F20 Salesmanager en resultaten'], [/^waarnemer\.|^account\.(opnieuwOnderzoeken|bronnenVolgen)$/, 'F14 Agents en mandaten'], [/^nav\./, 'Navigatie'], [/^agenda\.|^instellingen\.meetingsoorten/, 'F09 Agenda en meetings'], [/^(bezoeken|onderweg)\./, 'F10 Bezoeken en kansen'], [/^regio\.|^instellingen\.gebieden/, 'F18 Gebieden en regio-analyse'], [/^(assistent|credits)\./, 'F26 AI-assistent en credits'], [/^campagnes\.|^instellingen\.campagnesoorten/, 'F12 Campagnes'], [/^(funnel|overdracht)\.|^instellingen\.funnelNormen|^koppelingen\.dealdrive/, 'F17 Funnel en overdracht'], [/^(briefing|pitstop|concepten|mail|whatsapp)\.|^koppeling\.(mail|whatsapp)|^instellingen\.(mailsjablonen|kanalen)/, 'F11 Briefings, Pitstop en mail'], [/^(spraak|meldingen)\.|^contact\.visitekaartje/, 'F24 Spraak en meldingen'], [/^(vandaag|dagritme)\./, 'F06 Vandaag'], [/^(taken|inzichten)\./, 'F06 Taken en inzichten'],
  [/^prospects\.|^data\./, 'F02 Prospects'], [/^contacten\./, 'F03 Contacten'], [/^eigenVelden\./, 'F04 Eigen velden'], [/^import\./, 'F04 Importeren'],
  [/^(reis|reizen|account|doelgroepen)\.|^instellingen\.afkoeling/, 'F05 Prospectreis'], [/^ritme\.|^planning\.|^terugkomen\./, 'F13 Prospectplanning en ritme'],
  [/^agents\.|^verbruik\./, 'F14 Agents en mandaten'], [/^(regels|motor)\./, 'F15 Regels en motor'], [/^matrix\./, 'F16 Accountmatrix'],
  [/^platform\.|^roadmap$|^instellingen\.(abonnement|prompts|audit)$|^credits\./, 'F23 Platformbeheer en abonnement'], [/^help\.|^niveaus\.|^mij\./, 'F21 Helpcenter en niveaus'], [/^auth\.|^schil\./, 'F24 Inloggen en telefoon'], [/^richting\.|^verkoopverhaal\.|^account\.huidigeLeverancier|^koppeling\.salesdna|^salesdna\./, 'F25 Verkoopverhaal en Richting'], [/^belblok\.|^bellen\./, 'F07 Belblokken en belmodus'], [/^belscript\./, 'F08 Belscripts'], [/^leads\.|^koppeling\.kvk|^koppeling\.crm|^leadgenerator\.crm|^onderweg\.kvk|datacollectief/, 'F02 Leadgenerator'], [/^(gebruikers|instellingen)\./, 'F22 Instellingen'],
]
export function featureGroep(sleutel: string): string {
  return FEATURE_GROEPEN.find(([r]) => r.test(sleutel))?.[1] ?? 'Overig'
}
