/* Dealtrace mockup · gedeelde schil en bediening.
   Bouwt de strook Mockup-instellingen, de zijbalk volgens tabel 6.1, de
   mobiele schil uit hoofdstuk 8 (compacte kop, onderbalk, schuifvensters),
   de vergrendelde functies met hun uitlegflyout, en kleine interacties
   (tabbladen, flyouts, toasts). Geen afhankelijkheden, geen netwerk. */
(function () {
  'use strict';

  /* ===== Opslag ===== */
  var SLEUTEL = 'dealtrace-mockup-v1';
  var NIVEAUS = ['beginner', 'gevorderd', 'expert'];
  var STANDAARD = { niveau: 'beginner', werkplek: 'binnendienst', rol: 'accountmanager', slotOpen: false, werktIn: false };
  function lees() {
    try { return JSON.parse(window.localStorage.getItem(SLEUTEL)) || {}; } catch (e) { return {}; }
  }
  function bewaar() {
    try { window.localStorage.setItem(SLEUTEL, JSON.stringify(staat)); } catch (e) { /* privévenster: de keuze geldt dan alleen voor deze pagina */ }
  }
  var staat = Object.assign({}, STANDAARD, lees());
  if (NIVEAUS.indexOf(staat.niveau) < 0) staat.niveau = STANDAARD.niveau;
  if (['binnendienst', 'buitendienst'].indexOf(staat.werkplek) < 0) staat.werkplek = STANDAARD.werkplek;
  if (['accountmanager', 'salesmanager', 'beheerder', 'founder'].indexOf(staat.rol) < 0) staat.rol = STANDAARD.rol;
  function nIdx(n) { return NIVEAUS.indexOf(n || 'beginner'); }
  function groot(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* ===== Iconen (Lucide, 24 bij 24, lijn 2) ===== */
  var ICONEN = {
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    'calendar-range': '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M3 10h18"/><path d="M8 2v4"/><path d="M17 14h-6"/><path d="M13 18H7"/><path d="M7 14h.01"/><path d="M17 18h.01"/>',
    'square-check': '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'map-pin': '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    kanban: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 7v7"/><path d="M12 7v4"/><path d="M16 7v9"/>',
    building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'user-plus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/>',
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    'chart-column': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    'chart-line': '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="m19 9-5 5-4-4-3 3"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-right': '<path d="m9 18 6-6-6-6"/>',
    'chevron-left': '<path d="m15 18-6-6 6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    navigation: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    volume: '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>',
    'cloud-off': '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
    'wifi-off': '<path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    message: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'circle-x': '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><path d="M19 5v14"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    filter: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    linkedin: '<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>',
    door: '<path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/>',
    locate: '<path d="M2 12h3"/><path d="M19 12h3"/><path d="M12 2v3"/><path d="M12 19v3"/><circle cx="12" cy="12" r="7"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    trending: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    stop: '<rect width="14" height="14" x="5" y="5" rx="2"/>'
  };
  function ic(naam, klasse) {
    return '<svg class="icoon ' + (klasse || '') + '" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-' + naam + '"/></svg>';
  }
  function plaatsSprite() {
    if (document.getElementById('dt-sprite')) return;
    var s = '';
    Object.keys(ICONEN).forEach(function (k) { s += '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONEN[k] + '</symbol>'; });
    document.body.insertAdjacentHTML('afterbegin', '<svg id="dt-sprite" class="verborgen-sprite" aria-hidden="true" focusable="false"><defs>' + s + '</defs></svg>');
  }

  /* ===== Gebruikers per rol en werkplek (verzonnen) ===== */
  function gebruiker() {
    if (staat.rol === 'salesmanager') return { naam: 'Ilse Bosman', voornaam: 'Ilse', ini: 'IB', rol: 'Salesmanager' };
    if (staat.rol === 'beheerder') return { naam: 'Ruud Hendriks', voornaam: 'Ruud', ini: 'RH', rol: 'Beheerder' };
    if (staat.rol === 'founder') return { naam: 'Mira Dekker', voornaam: 'Mira', ini: 'MD', rol: 'Founder' };
    if (staat.werkplek === 'buitendienst') return { naam: 'Jan Wolters', voornaam: 'Jan', ini: 'JW', rol: 'Accountmanager' };
    return { naam: 'Sanne Kuipers', voornaam: 'Sanne', ini: 'SK', rol: 'Accountmanager' };
  }

  /* ===== Navigatie volgens tabel 6.1 ===== */
  var MGR = ['salesmanager', 'beheerder', 'founder'];
  var NAV = [
    { k: 'vandaag', n: 'Vandaag', g: 'Start', h: 'vandaag.html', i: 'home' },
    { k: 'agenda', n: 'Agenda', g: 'Start', i: 'calendar' },
    { k: 'acties', n: 'Acties', g: 'Werk', i: 'square-check' },
    { k: 'belblokken', n: 'Belblokken', g: 'Werk', h: 'belblokken.html', i: 'phone' },
    { k: 'bezoeken', n: 'Bezoeken', g: 'Werk', h: 'bezoeken.html', i: 'map-pin' },
    { k: 'campagnes', n: 'Campagnes', g: 'Werk', h: 'campagnes.html', i: 'megaphone', pilBeginner: 'meedoen' },
    { k: 'pipeline', n: 'Pipeline', g: 'Werk', i: 'kanban', min: 'gevorderd',
      wat: 'Deals en offertes maken en opvolgen, van het eerste gesprek tot de getekende opdracht. Per fase zie je wat openstaat en wat de volgende stap is.',
      tot: 'Leidt een afspraak tot een deal, dan zet je salesmanager hem voor je klaar. Je ziet de deal op de accountkaart.' },
    { k: 'prospects', n: 'Prospects', g: 'Prospects', h: 'prospects.html', i: 'building' },
    { k: 'contacten', n: 'Contacten', g: 'Prospects', i: 'users' },
    { k: 'leadgenerator', n: 'Leadgenerator', g: 'Prospects', h: 'leadgenerator.html', i: 'user-plus', min: 'gevorderd',
      wat: 'Zelf bedrijven zoeken in KvK, een lijst importeren uit Excel of CSV en leads overnemen met bewijs per criterium. Dubbele bedrijven vangt Dealtrace vooraf.',
      tot: 'Je salesmanager en de agents zetten leads voor je klaar. Je vindt ze als taak op Vandaag, met de eerste belpoging al ingepland.' },
    { k: 'inzichten', n: 'Inzichten', g: 'Prospects', i: 'lightbulb', min: 'gevorderd',
      wat: 'Nieuwe aanleidingen bij je accounts beoordelen, zoals een vacature, een nieuwe directeur of een verhuizing. Met één klik maak je er een taak van.',
      tot: 'Het belangrijkste inzicht van de dag staat bovenaan Vandaag als aanleiding, met de knop "Maak taak".' },
    { k: 'planning', n: 'Prospectplanning', g: 'Plannen', i: 'calendar-range', min: 'gevorderd',
      wat: 'Je jaar en je maand plannen: welke prospects wanneer aan de beurt zijn en in welk ritme. Zo staat er elke week genoeg nieuw werk klaar.',
      tot: 'Dealtrace zet de volgende poging voor je klaar. Je ziet hem op Vandaag en op de accountkaart.' },
    { k: 'richting', n: 'Richting', g: 'Plannen', h: 'richting.html', i: 'compass' },
    { k: 'reizen', n: 'Prospectreizen', g: 'Plannen', i: 'route', min: 'expert',
      wat: 'Een eigen prospectreis per doelgroep bouwen, met fases en overgangen. Je salesmanager activeert de reis voor het team.',
      tot: 'Je werkt met de standaardreis van je organisatie. Op elke accountkaart zie je in welke fase het account staat.' },
    { k: 'resultaten', n: 'Mijn resultaten', g: 'Resultaat', i: 'chart-column' },
    { k: 'team', n: 'Team', g: 'Manager', i: 'users', rollen: MGR },
    { k: 'coaching', n: 'Coaching', g: 'Manager', h: 'coaching.html', i: 'target', rollen: MGR },
    { k: 'analyse', n: 'Analyse', g: 'Manager', i: 'chart-line', rollen: MGR },
    { k: 'audit', n: 'Audit', g: 'Manager', i: 'shield-check', rollen: MGR },
    { k: 'instellingen', n: 'Instellingen', g: 'Beheer', h: 'instellingen-belscripts.html', i: 'settings', rollen: ['beheerder', 'founder'], groot: true },
    { k: 'platform', n: 'Platformbeheer', g: 'Beheer', h: 'platform.html', i: 'server', rollen: ['founder'], groot: true }
  ];
  /* Losse functies met een vergrendelde knop op de pagina (4.5). */
  var FUNCTIES = {
    'campagne-maken': { n: 'Campagne maken', min: 'gevorderd',
      wat: 'Een campagne maken uit de acht standaardsoorten, met doelgroep, winpunt, script en planning. Het bord laat per account zien waar het staat.',
      tot: 'Je voert de taken uit van campagnes waarin je meedoet. Ze staan op Vandaag met het script of concept erbij.' },
    'bellijst-top10': { n: 'Top 10 en Top 15', min: 'gevorderd',
      wat: 'Een langere bellijst samenstellen en zelf ordenen, en eigen vaste belblokken maken. Zo plan je je eigen belweek.',
      tot: 'Je belt de Top 5 die Dealtrace voor je klaarzet, in de twee standaard vaste blokken.' },
    'route-plannen': { n: 'Route plannen en kansen toevoegen', min: 'gevorderd',
      wat: 'Je route zelf plannen, kansen toevoegen aan je dag en filteren op periode. Ook inloopbezoeken vastleggen.',
      tot: 'Je ziet de top drie kansen langs je route en kunt ze met "+ Tussenstop" inplannen.' },
    'script-variant': { n: 'Persoonlijke scriptvariant', min: 'gevorderd',
      wat: 'Een kopie van een template maken met je eigen formuleringen. Als het origineel verandert, zie je het verschil.',
      tot: 'Je kiest een script uit de templates van je team. AI vult per account de aanleiding en het winpunt in.' },
    'kansregels': { n: 'Eigen afstands- en kansregels', min: 'expert',
      wat: 'Eigen kansbronnen, een eigen straal en de laag met ongeplande prospects in je gebied instellen. Ook regiodagen plannen.',
      tot: 'Dealtrace gebruikt de standaardregels van je organisatie: hooguit 20 minuten omrijden.' }
  };
  var CRITERIA = {
    gevorderd: [
      ['Minimaal 20 werkdagen actief', '14 van 20', 70],
      ['Minimaal 80 procent van de taken afgerond op de dag zelf, laatste 4 weken', '76 procent', 95],
      ['Minimaal 100 uitkomsten vastgelegd', '63 van 100', 63],
      ['Leerpad Beginner afgerond', '3 van 5 artikelen', 60]
    ],
    expert: [
      ['Minimaal 60 werkdagen als Gevorderd', '22 van 60', 37],
      ['Minimaal 2 eigen campagnes afgerond met een uitkomst', '1 van 2', 50],
      ['Conversie prospect naar afspraak minimaal op teamgemiddelde', '9 procent, team 11 procent', 82],
      ['Leerpad Gevorderd afgerond', '2 van 5 artikelen', 40]
    ]
  };

  function magRol(item) { return !item.rollen || item.rollen.indexOf(staat.rol) >= 0; }
  function isOpen(item) { return nIdx(staat.niveau) >= nIdx(item.min); }
  function navVolgorde() {
    var lijst = NAV.slice();
    if (staat.werkplek === 'buitendienst') {
      var a = lijst.findIndex(function (x) { return x.k === 'belblokken'; });
      var b = lijst.findIndex(function (x) { return x.k === 'bezoeken'; });
      var t = lijst[a]; lijst[a] = lijst[b]; lijst[b] = t;
    }
    return lijst;
  }
  function navItem(k) { return NAV.filter(function (x) { return x.k === k; })[0] || FUNCTIES[k]; }
  function href(item) { return item.h || 'index.html#niet-uitgewerkt'; }
  function stubAttr(item) { return item.h ? '' : ' data-stub="' + item.n + '"'; }

  var PAGINA_NAV = { account: 'prospects', 'instellingen-belscripts': 'instellingen' };
  function paginaKey() { return document.body.getAttribute('data-pagina') || ''; }

  /* ===== Strook Mockup-instellingen ===== */
  function selectHtml(id, label, waarde, opties) {
    return '<label class="mk-veld"><span class="mk-veld-label">' + label + '</span><select id="' + id + '" aria-label="' + label + '">' +
      opties.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === waarde ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
      '</select></label>';
  }
  function renderStrip() {
    var oud = document.getElementById('mk-strip');
    if (oud) oud.remove();
    var html = '<div class="mk-strip" id="mk-strip" role="region" aria-label="Mockup-instellingen">' +
      '<span class="mk-strip-titel">Mockup-instellingen</span>' +
      selectHtml('mk-niveau', 'Niveau', staat.niveau, [['beginner', 'Beginner'], ['gevorderd', 'Gevorderd'], ['expert', 'Expert']]) +
      selectHtml('mk-werkplek', 'Werkplek', staat.werkplek, [['binnendienst', 'Binnendienst'], ['buitendienst', 'Buitendienst']]) +
      selectHtml('mk-rol', 'Rol', staat.rol, [['accountmanager', 'Accountmanager'], ['salesmanager', 'Salesmanager'], ['beheerder', 'Beheerder'], ['founder', 'Founder']]) +
      '<span class="mk-links"><a href="index.html">Alle schermen</a><a href="telefoon.html">Telefoon</a></span></div>';
    document.body.insertAdjacentHTML('afterbegin', html);
    ['niveau', 'werkplek', 'rol'].forEach(function (veld) {
      document.getElementById('mk-' + veld).addEventListener('change', function (e) { wijzig(veld, e.target.value); });
    });
    meetStrip();
  }
  function meetStrip() {
    var s = document.getElementById('mk-strip');
    if (s) document.documentElement.style.setProperty('--strip-h', s.offsetHeight + 'px');
  }
  function wijzig(veld, waarde) {
    staat[veld] = waarde;
    if (staat.rol === 'salesmanager' && staat.niveau === 'beginner') {
      staat.niveau = veld === 'rol' ? 'expert' : 'gevorderd';
      toast('Een salesmanager is minimaal Gevorderd en standaard Expert.');
    }
    if (staat.rol !== 'founder') staat.werktIn = false;
    bewaar();
    renderAlles();
  }

  /* ===== Zijbalk ===== */
  function renderZijbalk() {
    var shell = document.querySelector('.app-shell');
    if (!shell) return;
    var oud = shell.querySelector('.app-sidebar');
    if (oud) oud.remove();
    var g = gebruiker();
    var actief = PAGINA_NAV[paginaKey()] || paginaKey();
    var groepen = [];
    var perGroep = {};
    var slot = [];
    navVolgorde().forEach(function (it) {
      if (!magRol(it)) return;
      if (!isOpen(it)) { slot.push(it); return; }
      if (!perGroep[it.g]) { perGroep[it.g] = []; groepen.push(it.g); }
      perGroep[it.g].push(it);
    });
    var nav = groepen.map(function (gr) {
      return '<div class="sb-groep"><div class="sb-groep-kop">' + gr + '</div><div class="sb-scheiding"></div>' +
        perGroep[gr].map(function (it) {
          var isA = it.k === actief;
          var pil = (it.pilBeginner && staat.niveau === 'beginner') ? '<span class="sb-link-pil">' + it.pilBeginner + '</span>' : '';
          return '<a class="sb-link' + (isA ? ' sb-link--actief' : '') + '" href="' + href(it) + '"' + stubAttr(it) + (isA ? ' aria-current="page"' : '') + ' title="' + it.n + '">' +
            ic(it.i, 'sb-link-icoon') + '<span class="sb-link-tekst">' + it.n + '</span>' + pil + '</a>';
        }).join('') + '</div>';
    }).join('');
    if (slot.length) {
      nav += '<div class="sb-groep sb-slotgroep' + (staat.slotOpen ? ' sb-slotgroep--open' : '') + '">' +
        '<button type="button" class="sb-slotgroep-kop" aria-expanded="' + staat.slotOpen + '" data-slotgroep>' +
        '<span class="sb-slotgroep-tekst">Nog te ontgrendelen</span><span class="sb-slotgroep-teller">' + slot.length + '</span>' + ic('chevron-down', 'icoon--14 sb-slotgroep-pijl') + '</button>' +
        '<div class="sb-slotgroep-lijst"' + (staat.slotOpen ? '' : ' hidden') + '>' +
        slot.map(function (it) {
          return '<a class="sb-link sb-link--slot" href="' + href(it) + '" aria-disabled="true" data-slot="' + it.k + '" title="' + it.n + '">' +
            ic(it.i, 'sb-link-icoon') + '<span class="sb-link-tekst">' + it.n + '</span>' + ic('lock', 'sb-slot-icoon') + '</a>';
        }).join('') + '</div></div>';
    }
    var org = staat.rol === 'founder'
      ? '<div class="sb-org"><a class="sb-org-knop" href="platform.html">' + ic('server') + '<span class="sb-org-tekst">' + (staat.werktIn ? 'Testbedrijf Voltvast' : 'Platform') + '</span>' + ic('chevron-down', 'icoon--14') + '</a></div>'
      : '';
    var html = '<aside class="app-sidebar" aria-label="Hoofdmenu">' +
      '<div class="sb-merk"><a class="sb-merk-link" href="vandaag.html" title="Dealtrace">' +
      '<svg class="sb-merk-icoon" viewBox="0 0 32 32" aria-hidden="true"><circle class="merk-geel" cx="16" cy="16" r="14"/><circle class="merk-inkt" cx="16" cy="16" r="8"/><circle class="merk-geel" cx="16" cy="16" r="3"/></svg>' +
      '<span class="sb-merk-naam">Dealtrace</span></a>' +
      '<button class="sb-inklap" type="button" aria-label="Zijbalk inklappen" title="Zijbalk inklappen" data-inklap>' + ic('panel') + '</button></div>' +
      org +
      '<div class="sb-meta"><span class="sb-live"><span class="sb-live-stip"></span><span class="sb-live-tekst">LIVE</span></span><span class="sb-datum tnum">14 okt</span></div>' +
      '<div class="sb-zoek-vak"><button class="sb-zoek" type="button" aria-label="Zoeken" data-zoek>' + ic('search', 'sb-link-icoon') + '<span class="sb-zoek-tekst">Zoeken</span><kbd class="sb-kbd">Ctrl K</kbd></button></div>' +
      '<nav class="sb-nav" aria-label="Hoofdnavigatie">' + nav + '</nav>' +
      '<div class="sb-voet">' +
      '<button class="sb-bel" type="button" data-meldingen><span class="sb-bel-icoon">' + ic('bell') + '<span class="sb-bel-teller tnum">4</span></span><span class="sb-bel-tekst">Meldingen</span></button>' +
      '<a class="sb-bel' + (paginaKey() === 'helpcenter' ? ' sb-bel--actief' : '') + '" href="helpcenter.html"><span class="sb-bel-icoon">' + ic('help') + '</span><span class="sb-bel-tekst">Helpcenter</span></a>' +
      '<div class="sb-gebruiker"><button class="sb-gebruiker-knop" type="button" aria-expanded="false" data-gebruikersmenu>' +
      '<span class="sb-avatar">' + g.ini + '</span><span class="sb-gebruiker-info"><span class="sb-gebruiker-naam">' + g.naam + '</span><span class="sb-gebruiker-rol">' + g.rol + ' · ' + groot(staat.niveau) + '</span></span>' +
      ic('chevron-down', 'sb-gebruiker-pijl') + '</button>' +
      '<div class="sb-gebruiker-menu" role="menu" hidden>' +
      '<a role="menuitem" href="index.html#niet-uitgewerkt" data-stub="Mijn instellingen">' + ic('user') + 'Mijn instellingen</a>' +
      '<a role="menuitem" href="index.html#niet-uitgewerkt" data-stub="Roadmap">' + ic('flag') + 'Roadmap</a>' +
      '<a role="menuitem" href="index.html#niet-uitgewerkt" data-stub="Uitloggen">' + ic('log-out') + 'Uitloggen</a>' +
      '</div></div></div></aside>';
    shell.insertAdjacentHTML('afterbegin', html);
  }

  /* ===== Mobiele schil (8.3, 8.4) ===== */
  var T = {
    vandaag: { k: 'vandaag', n: 'Vandaag', i: 'home', h: 'vandaag.html', p: ['vandaag'], tf: 'tf-vandaag' },
    route: { k: 'route', n: 'Route', i: 'navigation', h: 'bezoeken.html', p: ['bezoeken'], tf: 'tf-route' },
    bellen: { k: 'bellen', n: 'Bellen', i: 'phone', h: 'belblokken.html', p: ['belblokken'], tf: 'tf-bellen' },
    belblok: { k: 'belblok', n: 'Belblok', i: 'phone', h: 'belblokken.html', p: ['belblokken'], tf: 'tf-bellen' },
    acties: { k: 'acties', n: 'Acties', i: 'square-check', p: [], tf: 'tf-vandaag' },
    prospects: { k: 'prospects', n: 'Prospects', i: 'building', h: 'prospects.html', p: ['prospects', 'account'], tf: 'tf-account' },
    team: { k: 'team', n: 'Team', i: 'users', p: [], tf: 'tf-vandaag' },
    coaching: { k: 'coaching', n: 'Coaching', i: 'target', h: 'coaching.html', p: ['coaching'], tf: 'tf-vandaag' },
    meer: { k: 'meer', n: 'Meer', i: 'ellipsis', p: [], tf: 'tf-meer' }
  };
  function tabs() {
    if (staat.rol === 'salesmanager') return [T.team, T.coaching, T.acties, T.prospects, T.meer];
    if (staat.werkplek === 'buitendienst') return [T.vandaag, T.route, T.bellen, T.prospects, T.meer];
    return [T.vandaag, T.belblok, T.acties, T.prospects, T.meer];
  }
  function tabVoor(pagina) {
    var t = tabs().filter(function (x) { return x.p.indexOf(pagina) >= 0; })[0];
    return t ? t.k : 'meer';
  }
  function tabKeyVoorFrame(soort) {
    var lijst = tabs().map(function (x) { return x.k; });
    if (soort === 'bel') return lijst.indexOf('bellen') >= 0 ? 'bellen' : (lijst.indexOf('belblok') >= 0 ? 'belblok' : 'meer');
    return lijst.indexOf(soort) >= 0 ? soort : 'meer';
  }
  function kopHtml(titel, terug) {
    var links = terug
      ? '<a class="mob-terug" href="' + terug.split('|')[0] + '">' + ic('chevron-left', 'icoon--20') + terug.split('|')[1] + '</a><span class="mob-kop-titel"></span>'
      : '<span class="mob-kop-titel">' + titel + '</span>';
    return '<div class="mob-kop" data-gen>' + links +
      '<button class="mob-icoonknop" type="button" aria-label="Zoeken" data-zoek>' + ic('search') + '</button>' +
      '<button class="mob-icoonknop" type="button" aria-label="Inspreken" data-inspreken>' + ic('mic') + '</button>' +
      '<button class="mob-icoonknop" type="button" aria-label="Meldingen" data-meldingen>' + ic('bell') + '<span class="mob-teller">4</span></button></div>';
  }
  function onderbalkHtml(actief, inKader) {
    return '<nav class="mob-onderbalk" aria-label="Onderbalk" data-gen>' + tabs().map(function (t) {
      var a = t.k === actief;
      var cls = 'mob-tab' + (a ? ' mob-tab--actief' : '');
      var inhoud = ic(t.i) + '<span>' + t.n + '</span>';
      if (t.k === 'meer') return '<button type="button" class="' + cls + '" data-meer' + (a ? ' aria-current="page"' : '') + '>' + inhoud + '</button>';
      var doel = inKader ? '#' + t.tf : (t.h || 'index.html#niet-uitgewerkt');
      var stub = (!inKader && !t.h) ? ' data-stub="' + t.n + '"' : '';
      return '<a class="' + cls + '" href="' + doel + '"' + stub + (a ? ' aria-current="page"' : '') + '>' + inhoud + '</a>';
    }).join('') + '</nav>';
  }
  function renderMobiel() {
    var main = document.querySelector('.app-shell-main');
    if (!main) return;
    document.querySelectorAll('body > .mob-onderbalk, .app-shell-main > .mob-kop').forEach(function (e) { e.remove(); });
    var b = document.body;
    main.insertAdjacentHTML('afterbegin', kopHtml(b.getAttribute('data-titel') || document.title, b.getAttribute('data-terug')));
    document.body.insertAdjacentHTML('beforeend', onderbalkHtml(tabVoor(paginaKey()), false));
  }

  /* Inhoud van het Meer-venster: de rest van de zijbalk van je niveau (8.4). */
  function meerHtml(inKader) {
    var inBalk = tabs().map(function (t) { return t.k; });
    var dubbel = { route: 'bezoeken', bellen: 'belblokken', belblok: 'belblokken' };
    var weg = inBalk.map(function (k) { return dubbel[k] || k; });
    var groepen = []; var per = {}; var slot = [];
    navVolgorde().forEach(function (it) {
      if (!magRol(it) || weg.indexOf(it.k) >= 0) return;
      if (!isOpen(it)) { slot.push(it); return; }
      if (!per[it.g]) { per[it.g] = []; groepen.push(it.g); }
      per[it.g].push(it);
    });
    function item(it) {
      var doel = it.h || 'index.html#niet-uitgewerkt';
      var extra = it.groot ? '<small>Beter op een groot scherm</small>' : '';
      return '<a class="meer-item" href="' + doel + '"' + stubAttr(it) + '>' + ic(it.i) + it.n + extra + '</a>';
    }
    var concepten = '<a class="meer-item" href="' + (inKader ? '#tf-concepten' : 'telefoon.html#tf-concepten') + '">' + ic('inbox') + 'Concepten<small>3 wachten</small></a>';
    var html = groepen.map(function (g, nr) {
      var items = per[g].map(item).join('');
      if (g === 'Werk' || (nr === 0 && groepen.indexOf('Werk') < 0)) items = items + concepten;
      return '<div class="meer-groep"><div class="meer-groep-kop">' + g + '</div>' + items + '</div>';
    }).join('');
    html += '<div class="meer-groep"><div class="meer-groep-kop">Jij</div>' +
      '<a class="meer-item" href="helpcenter.html">' + ic('help') + 'Helpcenter</a>' +
      '<a class="meer-item" href="index.html#niet-uitgewerkt" data-stub="Mijn instellingen">' + ic('user') + 'Mijn instellingen</a>' +
      '<a class="meer-item" href="index.html#niet-uitgewerkt" data-stub="Uitloggen">' + ic('log-out') + 'Uitloggen</a></div>';
    if (slot.length) {
      html += '<div class="meer-groep"><button type="button" class="meer-item meer-item--slot" aria-expanded="false" data-meer-slot>' + ic('lock') + 'Nog te ontgrendelen<small>' + slot.length + '</small></button>' +
        '<div hidden data-meer-slotlijst>' + slot.map(function (it) {
          return '<button type="button" class="meer-item meer-item--slot" data-slot="' + it.k + '">' + ic(it.i) + it.n + ic('lock', 'icoon-slot') + '</button>';
        }).join('') + '</div></div>';
    }
    return html;
  }

  /* ===== Schuifvensters en vensters ===== */
  function openSheet(titel, body, voet) {
    sluitSheet();
    var html = '<div class="sheet-overlay" id="dt-sheet" data-sheet-overlay><div class="sheet" role="dialog" aria-modal="true" aria-label="' + titel + '">' +
      '<span class="sheet-greep" aria-hidden="true"></span>' +
      '<div class="sheet-kop"><span class="sheet-titel">' + titel + '</span><button class="sheet-sluit" type="button" data-sheet-sluit>Sluiten</button></div>' +
      '<div class="sheet-body">' + body + '</div>' + (voet ? '<div class="sheet-voet">' + voet + '</div>' : '') + '</div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  }
  function sluitSheet() { var s = document.getElementById('dt-sheet'); if (s) s.remove(); }

  var ZOEK = '<label class="veld"><span class="veld-label">Zoek prospects, contacten, campagnes en helpartikelen</span><input class="invoer" type="search" value="bront" aria-label="Zoeken"></label>' +
    '<p class="meer-groep-kop mt-12">Prospects</p>' +
    '<a class="meer-item" href="account.html">' + ic('building') + 'Brontsma Installatietechniek<small>Drachten</small></a>' +
    '<p class="meer-groep-kop">Contacten</p>' +
    '<a class="meer-item" href="account.html">' + ic('user') + 'Hilde Brontsma<small>eigenaar</small></a>' +
    '<p class="meer-groep-kop">Helpartikelen</p>' +
    '<a class="meer-item" href="helpcenter.html">' + ic('book') + 'De accountkaart lezen</a>' +
    '<p class="meer-groep-kop">Functies</p>' +
    '<button type="button" class="meer-item" data-slot-of-link="leadgenerator">' + ic('user-plus') + 'Leadgenerator</button>';
  var MELDINGEN = '<div class="stapelrij"><strong>Dagstart</strong><span>"3 bezoeken, 5 belacties. Eerst: Brontsma Installatietechniek om 09:30."</span><span class="meta">07:45</span></div>' +
    '<div class="stapelrij"><strong>Vertrek</strong><span>"Vertrek over 10 minuten naar Brontsma Installatietechniek"</span><span class="meta">09:02</span></div>' +
    '<div class="stapelrij"><strong>Verslag</strong><span>"Hoe ging het bij Oldenhave Klimaattechniek?"</span><span class="meta">11:45</span></div>' +
    '<div class="stapelrij"><strong>Klaargezet</strong><span>Sanne zette Marskamp Installaties klaar voor je regiodag.</span><span class="meta">gisteren</span></div>';
  function spraakHtml() {
    var acc = paginaKey() === 'account' ? 'Brontsma Installatietechniek (van dit scherm)' : 'Brontsma Installatietechniek';
    return '<div class="spraakgolf" aria-hidden="true"><span class="g1"></span><span class="g2"></span><span class="g3"></span><span class="g2"></span><span class="g3"></span><span class="g1"></span></div>' +
      '<p class="tekst tekst--lees tekst--inkt">"Bel Hilde volgende week dinsdag over de offerte."</p>' +
      '<article class="fo-blok fo-blok--agent mt-12"><span class="fo-blok-kicker">Concept</span>' +
      '<dl class="defs"><div class="def-rij"><dt>Soort</dt><dd>Taak · bellen</dd></div><div class="def-rij"><dt>Account</dt><dd>' + acc + '</dd></div>' +
      '<div class="def-rij"><dt>Persoon</dt><dd>Hilde Brontsma</dd></div><div class="def-rij"><dt>Titel</dt><dd>Bel Hilde over de offerte</dd></div>' +
      '<div class="def-rij"><dt>Datum</dt><dd>di 20 okt 2026</dd></div><div class="def-rij"><dt>Checks</dt><dd>Account bestaat · persoon gevonden · datum is een werkdag</dd></div></dl></article>' +
      '<p class="meta mt-8" data-max="beginner">Als Beginner maak je met spraak een taak of notitie. Afspraak en mail komen bij Gevorderd.</p>';
  }

  /* ===== Vergrendeld: uitlegflyout (6.1) ===== */
  function slotFlyout(k) {
    var it = navItem(k);
    if (!it) return;
    var doel = it.min || 'gevorderd';
    var stap = nIdx(staat.niveau) + 1 >= nIdx(doel) ? doel : 'gevorderd';
    var crit = CRITERIA[stap].map(function (c) {
      return '<div class="niveau-criterium"><span>' + c[0] + '</span><span class="meta tnum">' + c[1] + '</span>' +
        '<div class="voortgang" role="progressbar" aria-valuenow="' + c[2] + '" aria-valuemin="0" aria-valuemax="100"><span class="voortgang-vul' + (c[2] >= 100 ? ' voortgang-vul--groen' : '') + '" style="width:' + c[2] + '%"></span></div></div>';
    }).join('');
    var extra = stap !== doel ? '<p class="meta">Eerst Gevorderd, daarna Expert. Hieronder de criteria voor de eerste stap.</p>' : '';
    var html = '<div class="fo-overlay" id="dt-slot" data-fo-overlay><aside class="fo-panel fo-panel--smal" role="dialog" aria-modal="true" aria-labelledby="dt-slot-titel" tabindex="-1">' +
      '<header class="fo-head"><div class="fo-head-tekst"><span class="fo-kicker">' + groot(doel) + ' · vergrendeld</span>' +
      '<h2 class="fo-titel" id="dt-slot-titel">' + it.n + '</h2><p class="fo-meta">Dit is een functie voor ' + groot(doel) + '. Je salesmanager kan hem voor je vrijgeven.</p></div>' +
      '<button type="button" class="fo-sluit" aria-label="Sluiten" data-fo-sluit>×</button></header>' +
      '<div class="fo-body">' +
      '<article class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Wat het doet</h3></header><p class="fo-tekst">' + it.wat + '</p></article>' +
      '<article class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Wanneer het opengaat</h3></header>' + extra + crit +
      '<p class="meta">De salesmanager bevestigt de overgang; een mens beslist.</p></article>' +
      '<article class="fo-blok fo-blok--accent"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Tot die tijd</h3></header><p class="fo-tekst">' + it.tot + '</p></article>' +
      '<p><a class="tekst-link" href="helpcenter.html">Lees hoe het werkt</a></p></div>' +
      '<footer class="fo-foot dd-acties"><button type="button" class="dd-act dd-act--primair" data-toast="Je vraag staat als taak bij je salesmanager." data-fo-sluit>Vraag je salesmanager</button><span class="dd-acties-vul fo-foot-vul"></span></footer>' +
      '</aside></div>';
    var oud = document.getElementById('dt-slot'); if (oud) oud.remove();
    document.body.insertAdjacentHTML('beforeend', html);
    var p = document.querySelector('#dt-slot .fo-panel'); if (p) p.focus();
  }

  /* ===== Pagina vergrendeld of buiten de rol (6.1) ===== */
  function renderPaginaSlot() {
    var main = document.querySelector('.app-shell-main');
    if (!main) return;
    var oud = document.getElementById('dt-paginaslot'); if (oud) oud.remove();
    var secties = main.querySelectorAll(':scope > section, :scope > div.pagina-inhoud');
    secties.forEach(function (s) { s.hidden = false; });
    var b = document.body;
    var min = b.getAttribute('data-pagina-min');
    var rollen = b.getAttribute('data-pagina-rollen');
    var html = '';
    var k = PAGINA_NAV[paginaKey()] || paginaKey();
    if (rollen && rollen.split(',').indexOf(staat.rol) < 0) {
      html = '<section class="section" id="dt-paginaslot"><div class="container"><div class="slotblok">' +
        '<span class="kicker kicker--streep">Niet voor jouw rol</span><h1 class="title">' + (b.getAttribute('data-titel') || '') + '</h1>' +
        '<p class="subtitle">Dit scherm is voor de rol ' + rollen.split(',').join(' of ') + '. In Dealtrace ziet een ' + staat.rol + ' het niet in het menu.</p>' +
        '<article class="fo-blok fo-blok--accent"><p class="fo-tekst">In deze mockup wissel je de rol bovenin, bij Mockup-instellingen.</p></article></div></div></section>';
    } else if (min && nIdx(staat.niveau) < nIdx(min)) {
      var it = navItem(k) || { n: b.getAttribute('data-titel'), wat: '', tot: '' };
      html = '<section class="section" id="dt-paginaslot"><div class="container"><div class="slotblok">' +
        '<span class="kicker kicker--streep">Vergrendeld</span><h1 class="title">' + it.n + '</h1>' +
        '<p class="subtitle">Dit is een functie voor ' + groot(min) + '. Je salesmanager kan hem voor je vrijgeven.</p>' +
        '<article class="fo-blok"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Wat het doet</h3></header><p class="fo-tekst">' + it.wat + '</p></article>' +
        '<article class="fo-blok fo-blok--accent"><header class="fo-blok-kop"><h3 class="fo-blok-titel">Tot die tijd</h3></header><p class="fo-tekst">' + it.tot + '</p></article>' +
        '<div class="toolbar-buttons mt-16"><button type="button" class="dd-actie dd-actie--primair" data-slot="' + k + '">' + ic('lock', 'dd-actie-icoon') + 'Wanneer gaat het open?</button>' +
        '<a class="dd-actie dd-actie--secundair" href="helpcenter.html">Lees hoe het werkt</a></div></div></div></section>';
    }
    if (html) {
      secties.forEach(function (s) { s.hidden = true; });
      var kop = main.querySelector('.mob-kop');
      var balk = main.querySelector('.gele-balk');
      var na = balk || kop;
      if (na) na.insertAdjacentHTML('afterend', html); else main.insertAdjacentHTML('afterbegin', html);
    }
  }

  /* ===== Gele balk voor de founder (F23) ===== */
  function renderGeleBalk() {
    document.querySelectorAll('.gele-balk[data-gen]').forEach(function (e) { e.remove(); });
    var main = document.querySelector('.app-shell-main');
    if (!main || staat.rol !== 'founder' || !staat.werktIn) return;
    var html = '<div class="gele-balk" role="status" data-gen><span>Je werkt in Testbedrijf Voltvast als founder · ' + (staat.werktIn === 'wijzigen' ? 'ook wijzigen' : 'alleen meekijken') + ' · nog 7 uur 42</span>' +
      '<button type="button" data-terug-platform>Terug naar platform</button></div>';
    var kop = main.querySelector('.mob-kop');
    if (kop) kop.insertAdjacentHTML('afterend', html); else main.insertAdjacentHTML('afterbegin', html);
  }

  /* ===== Telefoonkaders (telefoon.html) ===== */
  function renderTelefoons() {
    document.querySelectorAll('.tf').forEach(function (tf) {
      tf.querySelectorAll('[data-gen]').forEach(function (e) { e.remove(); });
      var scherm = tf.querySelector('.tf-scherm');
      var kop = kopHtml(tf.getAttribute('data-titel') || '', tf.getAttribute('data-terug'));
      if (tf.hasAttribute('data-offline')) kop += '<div class="offline-strook" data-gen>' + ic('wifi-off', 'icoon--14') + 'Offline · 3 wijzigingen wachten</div>';
      scherm.insertAdjacentHTML('beforebegin', kop);
      scherm.insertAdjacentHTML('afterend', onderbalkHtml(tabKeyVoorFrame(tf.getAttribute('data-tab')), true));
    });
    document.querySelectorAll('[data-meer-inhoud]').forEach(function (e) { e.innerHTML = meerHtml(true); });
  }

  /* ===== Toasts ===== */
  function toast(tekst) {
    var stack = document.getElementById('dt-toasts');
    if (!stack) {
      document.body.insertAdjacentHTML('beforeend', '<div class="toast-stack" id="dt-toasts" role="status" aria-live="polite"></div>');
      stack = document.getElementById('dt-toasts');
    }
    var t = document.createElement('div');
    t.className = 'toast toast--succes';
    t.innerHTML = ic('circle-check', 'toast-icoon') + '<span class="toast-tekst"></span>';
    t.querySelector('.toast-tekst').textContent = tekst;
    stack.appendChild(t);
    setTimeout(function () { t.remove(); }, 4000);
  }
  window.dtToast = toast;

  /* ===== Alles toepassen ===== */
  function pasToe() {
    var h = document.documentElement;
    h.setAttribute('data-niveau', staat.niveau);
    h.setAttribute('data-werkplek', staat.werkplek);
    h.setAttribute('data-rol', staat.rol);
    document.querySelectorAll('[data-rollen]').forEach(function (e) {
      e.classList.toggle('rol-uit', e.getAttribute('data-rollen').split(',').indexOf(staat.rol) < 0);
    });
    var g = gebruiker();
    document.querySelectorAll('[data-veld="voornaam"]').forEach(function (e) { e.textContent = g.voornaam; });
    document.querySelectorAll('[data-veld="naam"]').forEach(function (e) { e.textContent = g.naam; });
    document.querySelectorAll('[data-veld="niveau"]').forEach(function (e) { e.textContent = groot(staat.niveau); });
    document.querySelectorAll('[data-veld="volgend-niveau"]').forEach(function (e) { e.textContent = staat.niveau === 'beginner' ? 'Gevorderd' : 'Expert'; });
  }
  function renderAlles() {
    pasToe();
    renderStrip();
    renderZijbalk();
    renderMobiel();
    renderGeleBalk();
    renderPaginaSlot();
    renderTelefoons();
    document.dispatchEvent(new CustomEvent('dt:staat', { detail: staat }));
  }
  window.dtStaat = function () { return staat; };

  /* ===== Interactie (gedelegeerd) ===== */
  document.addEventListener('click', function (e) {
    var el;
    if ((el = e.target.closest('[data-slot]')) && !el.closest('.sb-link:not(.sb-link--slot)')) {
      e.preventDefault(); sluitSheet(); slotFlyout(el.getAttribute('data-slot')); return;
    }
    if ((el = e.target.closest('[data-slot-of-link]'))) {
      var it = navItem(el.getAttribute('data-slot-of-link'));
      if (isOpen(it)) { window.location.href = it.h; } else { sluitSheet(); slotFlyout(el.getAttribute('data-slot-of-link')); }
      return;
    }
    if ((el = e.target.closest('[data-stub]'))) {
      e.preventDefault(); toast(el.getAttribute('data-stub') + ' is niet uitgewerkt in deze mockup.'); return;
    }
    if ((el = e.target.closest('[data-slotgroep]'))) {
      staat.slotOpen = !staat.slotOpen; bewaar(); renderZijbalk(); return;
    }
    if ((el = e.target.closest('[data-inklap]'))) {
      document.querySelector('.app-shell').classList.toggle('app-shell--ingeklapt'); return;
    }
    if ((el = e.target.closest('[data-gebruikersmenu]'))) {
      var menu = el.parentNode.querySelector('.sb-gebruiker-menu');
      menu.hidden = !menu.hidden; el.setAttribute('aria-expanded', String(!menu.hidden));
      el.parentNode.classList.toggle('sb-gebruiker--open', !menu.hidden); return;
    }
    if ((el = e.target.closest('[data-zoek]'))) { openSheet('Zoeken', ZOEK); return; }
    if ((el = e.target.closest('[data-meldingen]'))) { openSheet('Meldingen', MELDINGEN); return; }
    if ((el = e.target.closest('[data-inspreken]'))) {
      openSheet('Spraakopdracht', spraakHtml(), '<button type="button" class="dd-actie dd-actie--secundair" data-sheet-sluit>Aanpassen</button><button type="button" class="dd-actie dd-actie--primair" data-sheet-sluit data-toast="Taak bewaard op de accountkaart.">Bewaar</button>');
      return;
    }
    if ((el = e.target.closest('[data-meer]'))) {
      if (el.closest('.tf')) { window.location.hash = 'tf-meer'; } else { openSheet('Meer', meerHtml(false)); }
      return;
    }
    if ((el = e.target.closest('[data-meer-slot]'))) {
      var lijst = el.parentNode.querySelector('[data-meer-slotlijst]');
      lijst.hidden = !lijst.hidden; el.setAttribute('aria-expanded', String(!lijst.hidden)); return;
    }
    if ((el = e.target.closest('[data-instappen]'))) {
      var reden = document.getElementById('vi-reden');
      var fout = document.getElementById('vi-fout');
      if (!reden || reden.value.trim().length < 5) { if (fout) fout.hidden = false; return; }
      var keuze = document.querySelector('input[name="vi-modus"]:checked');
      el.closest('.mk-venster-overlay').hidden = true;
      staat.werktIn = keuze && keuze.value === 'wijzigen' ? 'wijzigen' : 'meekijken';
      bewaar(); renderAlles();
      toast('Je werkt nu in Testbedrijf Voltvast. De beheerder kreeg een melding.');
      return;
    }
    if ((el = e.target.closest('[data-terug-platform]'))) {
      staat.werktIn = false; bewaar(); window.location.href = 'platform.html'; return;
    }
    if ((el = e.target.closest('[data-sheet-sluit]')) || e.target.matches('[data-sheet-overlay]')) {
      if (el && el.hasAttribute('data-toast')) toast(el.getAttribute('data-toast'));
      sluitSheet(); return;
    }
    if ((el = e.target.closest('[data-open]'))) {
      e.preventDefault();
      var doel = document.getElementById(el.getAttribute('data-open'));
      if (doel) { doel.hidden = false; var pnl = doel.querySelector('[tabindex="-1"]'); if (pnl) pnl.focus(); }
      if (el.hasAttribute('data-toast')) toast(el.getAttribute('data-toast'));
      return;
    }
    if ((el = e.target.closest('[data-fo-sluit]')) || e.target.matches('.fo-overlay, .mk-venster-overlay, .belmodus-achter')) {
      var laag = el ? el.closest('.fo-overlay, .mk-venster-overlay, .belmodus') : e.target;
      if (el && el.hasAttribute('data-toast')) toast(el.getAttribute('data-toast'));
      if (laag) { if (laag.id === 'dt-slot') laag.remove(); else laag.hidden = true; }
      return;
    }
    if ((el = e.target.closest('[data-tab-knop]'))) {
      var set = el.closest('[data-tabset]');
      set.querySelectorAll('[data-tab-knop]').forEach(function (k) {
        var aan = k === el;
        k.classList.toggle('tab--actief', aan);
        if (aan) k.setAttribute('aria-current', 'page'); else k.removeAttribute('aria-current');
        var p = document.getElementById(k.getAttribute('data-tab-knop'));
        if (p) p.hidden = !aan;
      });
      return;
    }
    if ((el = e.target.closest('.keuzegroep-knop'))) {
      el.parentNode.querySelectorAll('.keuzegroep-knop').forEach(function (k) {
        k.classList.toggle('keuzegroep-knop--aan', k === el); k.setAttribute('aria-pressed', String(k === el));
      });
    }
    if ((el = e.target.closest('.filter-pil')) && !el.disabled) { el.classList.toggle('filter-pil--aan'); }
    if ((el = e.target.closest('.schakelaar'))) {
      var aan2 = !el.classList.contains('schakelaar--aan');
      el.classList.toggle('schakelaar--aan', aan2); el.setAttribute('aria-checked', String(aan2));
    }
    if ((el = e.target.closest('.uitkomst'))) {
      el.parentNode.querySelectorAll('.uitkomst').forEach(function (k) { k.classList.toggle('uitkomst--aan', k === el); });
    }
    if ((el = e.target.closest('[data-bezwaar]'))) {
      var ant = document.getElementById(el.getAttribute('data-bezwaar'));
      if (ant) { ant.hidden = !ant.hidden; el.setAttribute('aria-expanded', String(!ant.hidden)); }
      if (ant && !ant.hidden && el.hasAttribute('data-concurrent')) toast('Bezwaar geteld. ' + el.getAttribute('data-concurrent') + ' vastgelegd op het account.');
      return;
    }
    if ((el = e.target.closest('[data-toast]'))) { toast(el.getAttribute('data-toast')); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      sluitSheet();
      var s = document.getElementById('dt-slot'); if (s) { s.remove(); return; }
      var open = document.querySelectorAll('.fo-overlay:not([hidden]), .mk-venster-overlay:not([hidden]), .belmodus:not([hidden])');
      if (open.length) open[open.length - 1].hidden = true;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openSheet('Zoeken', ZOEK); }
  });
  window.addEventListener('resize', meetStrip);

  /* Hulpfuncties voor pagina's */
  window.dtStelIn = function (veld, waarde) { staat[veld] = waarde; bewaar(); renderAlles(); };
  window.dtIcoon = ic;


  /* ===== Belmodus: gesprek na gesprek (F07) ===== */
  var GESPREKKEN = [
    ['Brontsma Installatietechniek', 'Hilde Brontsma'], ['Teunisveld Installatie', 'Lotte Teunisveld'],
    ['Oldenhave Klimaattechniek', 'Ronald Oldenhave'], ['Marskamp Installaties', 'Bart Marskamp'],
    ['De Kemphaan Zonnetechniek', 'Saskia de Jong'], ['Wildeboer Elektro', 'Pieter Wildeboer']
  ];
  var gesprek = 0;
  function toonGesprek() {
    var bm = document.querySelector('[data-belmodus]');
    if (!bm) return;
    var g = GESPREKKEN[gesprek];
    bm.querySelectorAll('[data-bm-account]').forEach(function (e) { e.textContent = g[0]; });
    bm.querySelectorAll('[data-bm-contact]').forEach(function (e) { e.textContent = g[1]; });
    var t = bm.querySelector('[data-bm-teller]'); if (t) t.textContent = 'gesprek ' + (gesprek + 1) + ' van ' + GESPREKKEN.length;
    bm.querySelectorAll('[data-bm-wachtrij] .wachtrij-item').forEach(function (e, i) { e.classList.toggle('wachtrij-item--nu', i === gesprek); });
    bm.querySelectorAll('.uitkomst').forEach(function (k) { k.classList.remove('uitkomst--aan'); });
  }
  document.addEventListener('click', function (e) {
    var w = e.target.closest('[data-wissel-klasse]');
    if (w) {
      var d = w.getAttribute('data-wissel-klasse').split('|');
      var doel = document.getElementById(d[0]); if (doel) doel.classList.toggle(d[1]);
      return;
    }
    var bm = e.target.closest('[data-belmodus]');
    if (!bm) return;
    var u = e.target.closest('.uitkomst');
    if (u) {
      var naam = GESPREKKEN[gesprek][0];
      toast(naam + ': ' + u.textContent + '. Volgende poging staat gepland.');
      setTimeout(function () {
        if (gesprek < GESPREKKEN.length - 1) { gesprek += 1; toonGesprek(); }
        else { var r = bm.querySelector('[data-bm-resultaat]'); if (r) r.hidden = false; }
      }, 500);
    }
    if (e.target.closest('[data-bm-stop]')) { var r2 = bm.querySelector('[data-bm-resultaat]'); if (r2) r2.hidden = false; }
  });
  function openUitHash() {
    var h = window.location.hash.replace('#', '');
    if (h === 'start') { var bm = document.getElementById('belmodus'); if (bm) bm.hidden = false; }
    var fo = h && document.getElementById(h);
    if (fo && fo.classList.contains('fo-overlay')) fo.hidden = false;
  }

  plaatsSprite();
  renderAlles();
  openUitHash();
}());
