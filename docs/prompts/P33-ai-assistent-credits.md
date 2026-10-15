# P33: AI-assistent en credits

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | F26 AI-assistent: chatten met AI; 11.4 AI-credits voor alle AI-onderdelen (één pot per organisatie, prijs per handeling, reservering, meldingen, plafonds, extra credits) |
| Hangt af van | P01 (rollen, rechtenmatrix, functiecatalogus, audit, mock-modus), P27 (mobiele schil, compacte kop, schuifvenster, meldingsstrook), P02 (organisaties, pakket, `pakketprijzen`, platformaudit, `requireFounder`), P03 (accounts en contacten als context), P07 (taken voor "Zet als taak klaar"), P08 (Bewaker, `agent_runs`, AI-provider met mock, dagplafonds per agent), P09 (helpcenter: artikelen, zoekfunctie, blok "Vraag AI"; `functies_per_niveau`), P28 (leesmodel `vv_*` van het verkoopverhaal) |
| Bron in het bouwplan | 0.2 (B20), F26 volledig, 11.1 tot en met 11.4, F21 ("Vraag AI"), F22 (Gebruikers: plafond voor AI-credits; Verbruik en AI-credits), F23 (Abonnement en pakket, AI-verbruik en credits), 3.3, 4.3 (rij F26), 6.3, 8.3, 8.4, 10.2 (`ai_*`), 13.4, 13.5, 15.2, 19, 22 (open vraag 24 en 26), ADR-022 |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 0.2 (B20), 2.3, 3.3, 4.3 (rij F26), 6.3, 8.3 (compacte kop met microfoon), 8.4 (Meer: AI-assistent), 8.9 (spraak), F21 ("Vraag AI"), F22, F23 (rechtentabel, Abonnementen, AI-verbruik), F25 (bevestigde versies, namenfilter), F26 volledig, hoofdstuk 11 volledig, 10.2, 13.4, 13.5 (AI op de mock-provider), 15.2, 19, 22, ADR-022.
- DealDrive op commit 75bee61 (alleen lezen): `server/utils/llm-provider.ts`, `server/utils/aiVerbruik.ts` (`leesVerbruik`, `plafondStand`), `shared/aiBundel.ts` (`BUNDEL_SOORTEN`, `LET_OP_VANAF`, `OVER_VANAF`, `standVoor`) als basis voor de credits (F26, Hergebruik).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt de AI-assistent waarmee iedere gebruiker op elk scherm en op de telefoon chat, met de context van het scherm, antwoorden met bronnen en acties die alleen een concept klaarzetten; en je bouwt het fundament van de AI-credits dat **alle** AI in Dealtrace gebruikt: één pot per organisatie per maand, de prijs per handeling in `shared/credits.ts`, een reservering vóór elke aanroep, meldingen, plafonds per gebruiker en het aanvragen van extra credits.

### Waarom

Hulp op het moment dat je hem nodig hebt verlaagt de drempel, juist voor beginners (B20, ADR-022). Credits maken de kosten voorspelbaar voor klant en leverancier; één pot per organisatie met een plafond per gebruiker geeft de beheerder grip. Credits gelden voor alle AI-onderdelen, niet alleen de chat (B20, open vraag 26 gesloten). Daarom bouw je de credits nu, in sprint 5: alle prompts daarna die AI gebruiken (belscript-invulling in P10, zoekronde en dossier in P11, Notulist in P13, concepten in P18, agents in P19, coach in P21, spraak en visitekaartje in P31) roepen `creditsVoor` en de reservering aan die deze prompt levert. In DealDrive stond het AI-plafond standaard uit en gold het alleen op de motor (Bijlage A, gat 14); in Dealtrace blokkeert de pot vóór elke aanroep.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Chatten vanuit elk scherm en op de telefoon; antwoorden met bron; een voorstel als concept laten klaarzetten; de eigen creditstand en het eigen verbruik zien |
| Accountmanager | Gevorderd | Idem |
| Accountmanager | Expert | Idem |
| Salesmanager | rol | Idem; verbruik van de organisatie lezen |
| Beheerder | rol | Credits van de organisatie zien, verbruik per soort en per gebruiker, een plafond per gebruiker zetten, een dagplafond per AI-soort voor de agents, extra credits aanvragen |
| Founder | rol | Credits per pakket vastleggen, de prijs per handeling aanpassen, extra credits toekennen, verbruik per organisatie zien (tellingen, geen inhoud van gesprekken) |

De chat staat op alle drie niveaus aan (4.3, rij F26); wat iemand kan vragen, wordt begrensd door de credits en de rechten, niet door het niveau. Een chat alleen voor hogere niveaus is afgewezen (ADR-022).

### Schermen

**Waar je de assistent vindt** (F26, 6.3)

- Laptop: de knop "Vraag AI" (sparkle-icoon) in elke paginakop; de chat opent als flyout rechts van 480 px en blijft open terwijl je doorwerkt.
- Telefoon: in de compacte kop naast de microfoon (8.3); de chat opent als schuifvenster. Ook in "Meer" als "AI-assistent" (8.4).
- Helpcenter: de chat vervangt het blok "Stel je vraag"; het blok "Vraag AI" (P09) opent de chat met de context "Helpcenter".
- Op Vandaag: de snelle actie "AI" in de paginakop (6.3) opent dezelfde chat.

**Opbouw van de chat**, van boven naar beneden:

1. **Kop**: "AI-assistent", de context als chip ("Bij: Testinstallatie Koperwiek" of "Scherm: Belblokken"), te verwijderen met een kruisje, en rechts de stand van de credits ("412 credits over deze maand").
2. **Voorstellen** bij een lege chat, passend bij het scherm: "Hoe begin ik dit gesprek?", "Welke bezwaren kan ik verwachten?", "Hoe werkt een belblok?", "Wat staat er vandaag voor mij klaar?".
3. **Gesprek**: elk antwoord met bronnen als chips ("Helpcenter: Om de afspraak vragen", "Verhaal: kernzin Installatiebedrijven woningbouw", "Verslag 9 okt"). Geen bron, geen bewering over een account.
4. **Acties** onder een antwoord, altijd als concept en nooit uitgevoerd: "Zet als taak klaar", "Maak mailconcept", "Open het artikel", "Open het account".
5. **Invoer** met "Inspreken" en "Verstuur"; onder de invoer: "De assistent voert niets uit. Jij beslist."

**Vóór een dure vraag** (webonderzoek, 10 credits): de regel "Dit kost ongeveer 10 credits. Doorgaan?" met "Doorgaan" en "Annuleren" (F26). Webonderzoek kan alleen als het pakket het heeft (Compleet, 11.4); anders zegt de chat "Webonderzoek zit niet in jullie pakket." (Niet vastgelegd in het bouwplan; voorstel voor de tekst).

**Geen antwoord in het helpcenter**: "Daar staat nog niets over in het helpcenter. Je vraag is doorgestuurd." (F21); de vraag gaat als signaal naar de beheerder of founder voor een nieuw artikel.

**Credits op**: "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen." (11.4, F26). De invoer is dan uitgeschakeld met die regel als uitleg; de rest van de app werkt door.

**Plafond van de gebruiker bereikt**: Niet vastgelegd in het bouwplan; voorstel: "Je hebt je AI-credits voor deze maand gebruikt. Je beheerder kan je plafond verhogen."

**Verbruik en AI-credits** (`/instellingen/verbruik`, beheerder; F22, F23), van boven naar beneden:

1. Kop: kicker "VERBRUIK · OKTOBER 2026", titel als zin ("4.120 van 6.000 credits gebruikt, 69 procent."), meter van de pot met markeringen bij 80 procent (melding) en 90 procent gebruikt (agents stoppen bij 10 procent over).
2. Verbruik per soort (de soorten uit 11.4): handelingen en credits deze maand. De beheerder ziet alleen credits en handelingen, geen euro's (F23).
3. Verbruik per gebruiker met per rij het plafond (leeg is geen plafond) en een veld om het te wijzigen.
4. Dagplafond per AI-soort voor de agents (11.4); de dagplafonds per agent uit P08 staan ernaast.
5. Knop "Extra credits aanvragen" met aantal en toelichting.

Ook in `/instellingen/gebruikers` (F22): kolom "Plafond AI-credits" per gebruiker.

**Mijn instellingen** (iedere gebruiker): "Jouw AI-verbruik deze maand" met credits per soort en, als er een plafond is, "142 van 300 credits".

**Platformbeheer** (founder): op `/platform/abonnementen` de credits per gebruiker per maand per pakket en de prijs per handeling; op `/platform/verbruik` het verbruik per organisatie in credits en in euro's per model en soort; bij een organisatie "Extra credits toekennen". De volledige pagina's bouw je in P24; Niet vastgelegd in het bouwplan wat hiervan in sprint 5 nodig is; voorstel: P33 bouwt de endpoints en een eenvoudige tabel per organisatie (pot, verbruikt, extra, aanvragen met "Toekennen"), P24 maakt de pagina's compleet met facturatie en marge.

**Telefoon (390 px).** De chat opent vanuit de compacte kop als schuifvenster tot 92 procent hoogte, met de invoer in de plakkende balk onderaan boven het toetsenbord; bronchips en actieknoppen minimaal 44 px; lopende tekst minimaal 15 px. "Inspreken" in de chat gebruikt de spraakopdracht uit P31 (sprint 8). Niet vastgelegd in het bouwplan wat de knop doet zolang P31 er niet is; voorstel: de knop ontbreekt tot de functie `spraak.opdracht` in de catalogus staat. Offline toont de chat "Je bent offline. De AI-assistent werkt alleen met verbinding." en bewaart de vraag niet in de wachtrij (Niet vastgelegd in het bouwplan; voorstel: een vraag kost credits en hoort bij het moment). `/instellingen/verbruik` opent met "Beter op een groot scherm" en werkt wel (8.4).

### Klikpaden

1. **Vraag bij een account.** Op de accountkaart van Testinstallatie Koperwiek klik "Vraag AI"; de chat opent met de chip "Bij: Testinstallatie Koperwiek". Vraag "Welke bezwaren kan ik verwachten?"; het antwoord noemt "Online is het goedkoper." met het antwoord uit het verkoopverhaal en de bronchip "Verhaal: bezwaren"; de stand van de credits gaat omlaag met de kosten van de vraag.
2. **Zet als taak klaar.** Onder een antwoord klik "Zet als taak klaar"; de flyout Nieuwe taak (P07) opent voorgevuld met account, titel en aanleiding uit het antwoord; pas na "Opslaan" bestaat de taak, met herkomst "AI-assistent".
3. **Maak mailconcept.** Klik "Maak mailconcept"; er komt een concept dat je ziet, kopieert of opslaat als concept; er wordt nooit iets verstuurd. De inbox Concepten bouwt P18; Niet vastgelegd in het bouwplan waar het concept tot dan staat; voorstel: in de chat zelf met "Kopieer", en vanaf P18 ook als concept in de inbox.
4. **Vraag in het helpcenter.** Op `/help` klik "Vraag AI", vraag "Hoe werkt een belblok?"; het antwoord citeert het artikel en linkt ernaar.
5. **Webonderzoek.** Vraag "Wat staat er op de vacaturepagina van Testinstallatie Koperwiek?"; de chat vraagt eerst "Dit kost ongeveer 10 credits. Doorgaan?"; bij "Doorgaan" reserveert de server 10 credits en zoekt.
6. **Credits op.** Bij 0 credits geeft "Verstuur" de melding en geen aanroep; een belscript valt terug op vaste teksten en een briefing op berekende tekst; taken afronden werkt gewoon.
7. **Plafond zetten** (beheerder). In `/instellingen/verbruik` zet een plafond van 300 voor Bram Middelkamp; toast "Plafond voor Bram Middelkamp is 300 credits per maand."
8. **Extra credits aanvragen** (beheerder). "Extra credits aanvragen", 1.000, toelichting; de founder krijgt een melding; na "Toekennen" stijgt de pot direct en ziet de beheerder "1.000 extra credits toegekend."
9. **Context weghalen.** Klik het kruisje op de chip; de volgende vraag gaat zonder accountgegevens en kost minder.

### Filters en sorteren

- `/instellingen/verbruik?maand=&soort=&gebruiker=`; standaard de lopende maand.
- Gesprekken: de laatste 30 dagen, nieuwste eerst, in de chat onder "Eerdere gesprekken" (Niet vastgelegd in het bouwplan; voorstel).

### Regels

**De assistent**

- De assistent legt uit, bereidt voor en stelt voor; hij voert niets uit (F26). Acties zijn altijd een concept of een link.
- Hij mag gebruiken: het helpcenter (beide collecties) en de eigen artikelen van de organisatie; het **bevestigde** verkoopverhaal (F25: verhaal, belofte, concurrenten, winpunten, terugkomregels); de gegevens die de gebruiker zelf mag zien volgens 3.3 (het account en de contacten van het scherm, de reis, de laatste contactmomenten en verslagen, de eigen taken en afspraken). Nooit gegevens van een andere organisatie, nooit privénotities van een manager.
- Geen internet, tenzij de vraag om webonderzoek gaat en het pakket het heeft; dan meer credits en vooraf de kosten.
- Vangrails uit 11.2: schema op elk antwoord, bewijsplicht (citaten alleen letterlijk uit het materiaal), bronvermelding, namenfilter op het verkoopverhaal, geen privégegevens (privémail en privémobiel gemaskeerd vóór de aanroep), nooit buiten mandaat (de Gids heeft mandaat A, alleen lezen en concepten, 11.3).
- Een gesprek wordt 30 dagen bewaard voor de gebruiker zelf en daarna verwijderd; de founder ziet alleen tellingen, geen inhoud.

**Credits voor alle AI** (11.4)

- Elke organisatie heeft één pot AI-credits per maand. Pot = credits per gebruiker per maand van het pakket × aantal actieve gebruikers: Starter 200, Plus 600, Compleet 1.500 (voorlopig, open vraag 24). Credits van een maand vervallen aan het einde van de maand. Niet vastgelegd in het bouwplan hoe de pot meebeweegt met gebruikers binnen een maand; voorstel: berekend op de eerste van de maand en verhoogd (nooit verlaagd) als er in de maand een gebruiker bij komt.
- Elke AI-handeling kost een vast aantal credits, ongeacht het model, volgens de tabel in `shared/credits.ts`:

  | Soort (sleutel) | Model | Credits per handeling | Aan in pakket |
  |---|---|---|---|
  | `assistent.vraag` | Claude Haiku | 1 | Starter, Plus, Compleet |
  | `assistent.vraagMetAccount` (accountgegevens of lang antwoord) | Claude Sonnet | 2 tot 5 | Starter, Plus, Compleet |
  | `webonderzoek` (assistent of agent) | Claude Sonnet met websearch | 10 | Compleet |
  | `zoekronde` (leadgenerator) | Claude Sonnet met websearch | 20 | Compleet |
  | `dossier` | Claude Sonnet met websearch | 10 | Compleet |
  | `inzicht` (beoordeling, intern) | Claude Sonnet | 1 | Plus, Compleet |
  | `concept` (Pitstop, boodschap) | Claude Sonnet | 2 | Plus, Compleet |
  | `belscript` (invulling) | Claude Haiku of Sonnet | 1 | Plus, Compleet |
  | `notulist` (verslaganalyse) | Claude Sonnet | 5 | Plus, Compleet |
  | `brief` (brief en buying committee) | Claude Sonnet | 3 | Plus, Compleet |
  | `coach` (coach en verbetervoorstel) | Claude Opus | 20 | Plus, Compleet |
  | `spraakopdracht` | Claude Haiku of Sonnet | 1 | Starter, Plus, Compleet |
  | `visitekaartje` | Claude Haiku of Sonnet | 2 | Starter, Plus, Compleet |
  | `transcriptie` | EU-transcriptiedienst | 1 per begonnen minuut | Starter, Plus, Compleet |

  De sleutels zijn Niet vastgelegd in het bouwplan; voorstel zoals in de eerste kolom. Waar de prijs 2 tot 5 is: Niet vastgelegd in het bouwplan; voorstel: 2 voor een vraag met accountgegevens, plus 1 per extra bron boven de drie (verslagen, artikelen), plus 1 bij een antwoord boven 300 woorden, met een maximum van 5.
- `creditsVoor(soort, context)` is de **enige** plek waar de prijs per handeling staat; de tabel is de standaard en de founder past hem aan in Platformbeheer zonder release (11.4).
- **Reservering**: elke AI-aanroep reserveert zijn credits vóór de aanroep in `ai_credits` en het logboek (`agent_runs`) en boekt ze definitief na afloop; een mislukte aanroep kost niets (de reservering wordt vrijgegeven). Een reservering die na 10 minuten niet geboekt of vrijgegeven is, vervalt (Niet vastgelegd in het bouwplan; voorstel).
- **80 procent**: één melding per maand aan de beheerder en alle gebruikers van de organisatie (F24, soort "AI-credits op 80 procent").
- **10 procent over**: automatische AI (agents, motorrondes, automatische voorbereiding) stopt, zodat er credits overblijven voor wat gebruikers zelf vragen; de beheerder krijgt een melding. Wat een gebruiker zelf vraagt, gaat door.
- **0**: alle AI-handelingen stoppen, ook de chat, met de melding uit 11.4; de server geeft 402 met die schermtekst. Al het werk zonder AI gaat door: scripts met vaste teksten, briefings met berekende tekst, handmatig invoeren.
- **Plafond per gebruiker**: de beheerder kan per gebruiker een plafond zetten; wat een gebruiker zelf vraagt telt op zijn plafond en op de pot. Niet vastgelegd in het bouwplan op wie automatische AI telt; voorstel: op de organisatie, niet op een gebruiker.
- **Dagplafond per AI-soort voor de agents**: de beheerder zet per soort een dagplafond (11.4); de Bewaker toetst het samen met de dagplafonds per agent uit P08.
- **Extra credits**: de beheerder vraagt ze aan in Abonnement of Verbruik; de founder zet ze direct of via de facturatie (F23, P24); ze gelden voor de lopende maand. De prijs van extra credits is open vraag 24; Niet vastgelegd in het bouwplan; voorstel: tot het besluit alleen toekennen door de founder, zonder automatische factuurregel.
- Achterstallige betaling pauzeert AI-werk, niet de app (F23); dat sluit P24 aan op dezelfde poort.
- Externe databronnen (KvK, Datacollectief) zijn geen AI en vallen buiten de credits (11.4).
- Een Beginner op Starter heeft geen AI-invulling van scripts; het script werkt met vaste teksten (11.4, F08).

### Helpartikelen

- "Chatten met de AI-assistent" (Hoe werkt Dealtrace, Aan de slag): waar je hem vindt, wat hij weet en niet weet, bronnen, concepten, "Jij beslist".
- "Abonnement, verbruik en AI-credits" (Inrichten): de pot, de prijs per handeling, 80 procent, 10 procent, 0, plafonds, extra credits.
- Een korte uitleg op de pagina Verbruik met "Lees hoe het werkt".

## Deel 2: Technisch (hoe)

### Datamodel

- `ai_chats: id, organisation_id, gebruiker_id, context {route, accountId?, contactId?}, gemaakt_op, verloopt_op` (F26); `verloopt_op` = gemaakt op + 30 dagen.
- `ai_chat_berichten: id, chat_id, rol ('gebruiker'|'assistent'), tekst, bronnen jsonb, credits int, op` (F26).
- `ai_credits: organisation_id, maand, toegekend, extra, verbruikt` (F26). Niet vastgelegd in het bouwplan; voorstel: kolom `gereserveerd int` erbij, en een vlag per maand voor de verstuurde melding bij 80 procent en bij 10 procent.
- `ai_credit_plafonds: organisation_id, gebruiker_id, plafond` (F26).
- Credits per pakket in `pakketprijzen` (F23), met geldig-vanaf.
- Prijs per handeling: standaard in `shared/credits.ts`; aanpassingen van de founder Niet vastgelegd in het bouwplan; voorstel: platformtabel `credit_prijzen (soort, credits, geldig_vanaf, gewijzigd_door)` die alleen de founder schrijft, en die `creditsVoor` als tweede argument meekrijgt.
- `agent_runs` (P08) krijgt `soort`, `credits`, `credit_status ('gereserveerd'|'geboekt'|'vrijgegeven')`, `gebruiker_id?`; elke AI-aanroep in de app heeft een rij, ook die van de chat (agent Gids).
- Extra credits aanvragen: Niet vastgelegd in het bouwplan; voorstel: `credit_aanvragen (id, organisation_id, aantal, toelichting, status ('open'|'toegekend'|'afgewezen'), aangevraagd_door, op, besloten_door?, besloten_op?)`.
- Dagplafond per soort voor de agents: `org_settings` sleutel `aiDagplafonds {soort: aantal}`.
- `pakket`, `aiCredits` en de prijs per handeling staan in `VERBORGEN_KEYS` (F22): nooit via de klantinstellingen te schrijven.
- RLS: `ai_chats` en `ai_chat_berichten` alleen eigen rijen (gebruiker), ook niet voor de beheerder; `ai_credits`, `ai_credit_plafonds` en `credit_aanvragen` met `org_isolation`, schrijven alleen via de server; de founder ziet tellingen via een security-definer-functie van `dealtrace_platform` (F23), nooit berichten.
- Rechtenmatrix (3.3, F23): Abonnement, facturen, verbruik: accountmanager eigen verbruik; salesmanager verbruik lezen; beheerder lezen, plafonds zetten en extra aanvragen; founder alles.
- Geen sync: de chat en de credits werken alleen online.
- Opruimjob (dagelijks): verwijdert chats en berichten na `verloopt_op`; laat vervallen reserveringen vrij.

### Pure functies

Alle in `shared/credits.ts` (F26, 11.4), tenzij anders vermeld:

| Functie | Invoer en uitvoer | Randgevallen en unit-tests |
|---|---|---|
| `creditsVoor(soort, context, prijzen?)` | `{credits, model}` | elke soort uit de tabel; 2 tot 5 voor een vraag met accountgegevens; transcriptie 61 seconden is 2 credits; soort niet in het pakket geeft `{nietInPakket: true}`; aangepaste prijs van de founder wint |
| `potVoor(pakket, actieveGebruikers, extra)` | getal | 0 gebruikers; pakketwissel midden in de maand |
| `creditsStand(organisatie, maand)` | `{pot, verbruikt, gereserveerd, over, procent}` | gereserveerd telt als niet beschikbaar; extra credits |
| `magVragen(stand, plafond, verbruiktGebruiker, kosten, automatisch)` | `{ja}` of `{nee, reden: 'op'\|'plafond'\|'agentgrens'\|'pakket'}` | precies 0 over; precies 10 procent over bij automatisch; plafond precies bereikt; kosten groter dan wat over is |
| `meldingNodig(standVoor, standNa, vlaggen)` | `'80'\|'10'\|null` | over de grens in één handeling; al gemeld deze maand |
| `kiesAssistentSoort(vraag, context, pakket)` | soort | chip verwijderd; webonderzoek zonder pakket |
| `bronnenVoorAntwoord(materiaal, antwoord)` | bronchips | citaat dat niet letterlijk in het materiaal staat wordt afgewezen (bewijsplicht) |

Op de server in `server/utils/credits.ts` (Niet vastgelegd in het bouwplan; voorstel):

- `reserveer(event, {soort, context, automatisch})`: leest prijs en stand, roept `magVragen`, reserveert met één atomaire update (`gereserveerd = gereserveerd + n` met de voorwaarde dat er genoeg over is) en schrijft een rij in `agent_runs` met `credit_status = 'gereserveerd'`; geeft een reservering of gooit 402.
- `boek(reservering, werkelijk?)` en `geefVrij(reservering)`.
- `metCredits(event, soort, context, fn)`: de verpakking die elke AI-aanroep in Dealtrace gebruikt (reserveer, roep aan, boek of geef vrij). **Alle prompts die AI gebruiken, roepen hun aanroep via deze verpakking aan**; een bouwcheck faalt als `llm-provider` buiten `metCredits` wordt aangeroepen (Niet vastgelegd in het bouwplan; voorstel: uitbreiding van `check:rechten` of een eigen `check:credits`).

De Bewaker uit P08 toetst "bundel" voortaan met `magVragen` op de pot in plaats van een bundel per soort; het plafond per bundelsoort uit P08 vervalt (11.2: één pot per organisatie). Pas P08 daarop aan.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `POST /api/assistent/vraag` | iedere gebruiker met `assistent.chat` | `{chatId?, tekst, context, akkoordKosten?}` | stromend antwoord met tekst, bronnen, acties, credits | 402 met de schermtekst bij 0 of plafond; 409 `kostenBevestigen` met de kosten als `akkoordKosten` ontbreekt bij webonderzoek; 403 voor een account zonder leesrecht (de context wordt dan leeg, geen fout als er geen account in de vraag zit) |
| `GET /api/assistent/chats` | iedere gebruiker | | eigen chats van de laatste 30 dagen | |
| `GET /api/assistent/credits` | iedere gebruiker | | stand van de pot en het eigen verbruik en plafond | |
| `GET /api/instellingen/verbruik?maand=` | beheerder, salesmanager (lezen) | | per soort en per gebruiker | |
| `PUT /api/instellingen/credits/plafond` | beheerder | `{gebruikerId, plafond}` | plafond | 422 bij een negatief getal |
| `PUT /api/instellingen/credits/dagplafonds` | beheerder | `{soort: aantal}` | stand | 422 bij onbekende soort |
| `POST /api/abonnement/extra-credits` | beheerder | `{aantal, toelichting}` | aanvraag | 422 zonder aantal |
| `GET /api/platform/credits` | founder | | per organisatie pot, verbruik, extra, open aanvragen | 404 zonder founderrol |
| `POST /api/platform/credits/:organisatieId/extra` | founder, tweestapsverificatie | `{aantal, aanvraagId?}` | stand | |
| `PUT /api/platform/credits/prijzen` | founder, tweestapsverificatie | `{soort, credits}` | prijs | 422 bij onbekende soort |
| `PUT /api/platform/pakketten/:pakket/credits` | founder | `{perGebruiker}` | pakket | |

Elke platformroute roept `requireFounder(event)` aan en schrijft een platformaudit; elke wijziging van een plafond of dagplafond een auditregel bij de klant.

### AI-stappen

- **Agent Gids** (11.3), mandaat A: alleen lezen en concepten.
- **Materiaal**: dezelfde zoekfunctie als het helpcenter (`GET /api/help`, P09), het leesmodel `vv_*` (alleen bevestigde versies, P28) en de accountcontext binnen de rechten van de gebruiker; de server stelt het materiaal samen, nooit de client.
- **Model**: Claude Haiku voor eenvoudige vragen, Claude Sonnet voor vragen met accountgegevens, gekozen door `creditsVoor` (F26); de modelkeuze per soort staat in de AI-koppeling (F23) zodat wisselen zonder release kan.
- **Schema** voor acties: `taak {accountId, titel, actiesoort, aanleiding}`, `mailconcept {accountId, contactId?, onderwerp, tekst}`, `artikel {slug}`, `account {accountId}`; `additionalProperties false`; bij afwijking één keer opnieuw, daarna een antwoord zonder acties (11.2).
- **Vangrails**: bewijsplicht op citaten; geen bewering over een account zonder bron; namenfilter op het verkoopverhaal in combinatie met account- of contactgegevens; privégegevens gemaskeerd vóór de aanroep; zero-retention-provider (11.2).
- **Mock**: de mock-provider met vaste antwoorden en bronnen (13.5, `AI_PROVIDER=mock`); tests draaien zonder netwerk en zonder kosten; de mock boekt wel credits, zodat de pot in tests klopt.
- **Credits**: elke vraag via `metCredits` met soort `assistent.vraag`, `assistent.vraagMetAccount` of `webonderzoek`.
- **Golden master** voor de prompt van de Gids met drie vaste vragen uit de Voltvast-seed.

### Integraties

- AI-provider via `server/utils/llm-provider.ts` met de oplosketen uit F23 (organisatie, platform, omgeving, mock). Lokaal standaard de mock (13.5).
- Geen andere integraties. Facturatie van extra credits (Stripe, Moneybird) hoort bij P24.

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel (startindeling uit 4.3: alles aan op alle niveaus):

| Sleutel | Startniveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `assistent.chat` | Beginner | Starter | iedereen | Chatten met de AI-assistent |
| `assistent.webonderzoek` | Beginner | Compleet | iedereen | Chatten met de AI-assistent |
| `credits.eigenVerbruik` | Beginner | Starter | iedereen | Abonnement, verbruik en AI-credits |
| `credits.beheer` (plafonds, dagplafonds, extra aanvragen) | Beginner | Starter | beheerder | Abonnement, verbruik en AI-credits |

### Hergebruik uit DealDrive

- `server/utils/llm-provider.ts`: provider en oplosketen; voeg de verpakking `metCredits` eromheen toe.
- `server/utils/aiVerbruik.ts` (`leesVerbruik`, `plafondStand`) en `shared/aiBundel.ts` (`LET_OP_VANAF`, `standVoor`) als basis voor `creditsStand` en de meldingen; vervang de bundel per soort door één pot met een prijs per handeling (F26).

### Buiten scope

- De AI-stappen van andere features (belscript-invulling P10, zoekronde en dossier P11, Notulist P13, concepten P18, agents P19, coach P21, spraak en visitekaartje P31); die roepen `creditsVoor` en `metCredits` uit deze prompt aan.
- Facturen, Stripe en Moneybird, de volledige pagina's `/platform/abonnementen` en `/platform/verbruik` met marge (P24).
- Inspreken in de chat (P31) en de inbox Concepten (P18).
- Eigen kennisbank van de organisatie als bron (eigen artikelen in P25).

## Acceptatiecriteria

1. Op elk gebouwd scherm opent "Vraag AI" de chat met de juiste contextchip; op de telefoon opent hij vanuit de compacte kop als schuifvenster.
2. Een gebruiker zonder leesrecht op een account krijgt geen gegevens van dat account in een antwoord (wegwerp-Postgres met twee organisaties en een salesmanager buiten het team).
3. Elk antwoord over een account heeft minstens één bron; een citaat dat niet letterlijk in het materiaal staat, wordt niet getoond (golden master).
4. Een actie uit de chat maakt een concept of opent een voorgevuld formulier; nooit een verstuurd bericht of een opgeslagen taak zonder klik van de gebruiker.
5. Een vraag met de mock-provider reserveert credits vóór de aanroep, boekt ze na afloop en laat ze vrij bij een fout; een mislukte aanroep kost niets.
6. Bij 0 credits geeft de server 402 met "De AI-credits van deze maand zijn op. Je beheerder kan extra credits aanvragen."; taken afronden, een belscript met vaste teksten en een berekende briefing werken door.
7. Bij 80 procent krijgen beheerder en gebruikers precies één melding per maand.
8. Bij 10 procent over weigert `metCredits` een automatische aanroep (agent of motor) en laat een vraag van een gebruiker door.
9. Een gebruiker met een plafond van 300 krijgt na 300 credits de melding over zijn plafond, terwijl een collega zonder plafond doorgaat.
10. Twintig gelijktijdige vragen bij een stand van 10 credits laten de pot nooit onder 0 komen (atomaire reservering, wegwerp-Postgres).
11. `creditsVoor` geeft voor elke soort uit 11.4 de prijs uit de tabel; een aangepaste prijs van de founder geldt direct zonder release; de prijs staat op geen andere plek in de code (codezoektocht).
12. Webonderzoek vraagt eerst "Dit kost ongeveer 10 credits. Doorgaan?" en kan alleen in Compleet.
13. Een beheerder kan pakket, credits per pakket of de prijs per handeling niet via instellingen of sync schrijven; elke `/api/platform/credits`-route geeft 404 zonder founderrol.
14. Een chat is na 30 dagen verwijderd; de founder ziet alleen tellingen, geen inhoud; een beheerder ziet de gesprekken van een gebruiker niet.
15. Bijlage A, gat 14: het plafond geldt op alle AI-soorten, staat standaard aan en meldt bij 80 procent.
16. De eerste woorden van een antwoord verschijnen binnen 2 seconden (mock en één echte run in het sprintverslag, F26).
17. Telefoon (375, 390, 412 px): chat zonder horizontale scroll, invoer boven het toetsenbord, knoppen en chips minimaal 44 px; offline toont de chat de offline-melding en verstuurt niets.
18. Per niveau getest met de Voltvast-seed: Beginner (Bram Middelkamp), Gevorderd (Sanne Belhuis) en Expert (Joost Stuurman) kunnen alle drie chatten binnen de credits van de organisatie; geen van drieën ziet het verbruik per gebruiker of kan een plafond zetten; de beheerder wel.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Unit-tests voor alle functies in `shared/credits.ts` met grenzen (0, 10 procent, 80 procent, precies het plafond), lege invoer en een pakketwissel.
- Wegwerp-Postgres voor de atomaire reservering, RLS op `ai_chats` en `ai_chat_berichten`, cross-tenant en platformscheiding.
- Playwright desktop en telefoon voor de chat (laptopflyout en schuifvenster), `/instellingen/verbruik` en de melding bij 0 credits.
- De bouwcheck op `metCredits` is groen en P08 gebruikt de pot in plaats van de bundel per soort.
- Golden master voor de Gids; één echte AI-run met kosten in het sprintverslag.
- Helpartikelen "Chatten met de AI-assistent" en "Abonnement, verbruik en AI-credits" in `content/help/`.
- `docs/HOE-HET-WERKT.md` beschrijft de pot, `creditsVoor`, de reservering en hoe een nieuwe AI-stap `metCredits` gebruikt.
