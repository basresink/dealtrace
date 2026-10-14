# Prospectreis (customer journey)

## Wat het is en waarvoor

De customer journey in DealDrive is een lijst fases die een organisatie zelf inricht, van eerste kennismaking tot ambassadeur. Elk account staat in hoogstens één fase (veld journeyStageId). Een account schuift door naar een volgende fase als er een gebeurtenis plaatsvindt waarvoor de beheerder een overgang heeft vastgelegd, bijvoorbeeld "Eerste afspraak gepland" in "Awareness" leidt naar "Overweging". Elke wissel komt in het auditlog.

De journey doet drie dingen voor de rest van DealDrive:

- Afbakening van regels: een Activity selling-regel kan een "Journey-fase" dragen en geldt dan alleen voor accounts in die fase. Een winbackregel hoort niet bij een verse klant, een kennismakingsregel niet bij een klant in retentie.
- Startset per fase: een regel met het triggerpatroon "Gebeurtenis" en de gebeurtenis "Fase betreden (startset)" vuurt direct wanneer een account een fase binnenkomt, en zet zo het eerste werk van die fase klaar.
- Toon van de AI: elke fase heeft een "Pitstop-accent", een korte instructie waarmee de agent belscripts, briefings en mailconcepten voor accounts in die fase kleurt, en die de motor ook gebruikt in zijn campagne-advies.

Voor prospects is dit in DealDrive de enige vorm van een reis. Een prospect stapt bij zijn eerste gebeurtenis in op de eerste fase en schuift daarna door op drie gebeurtenissen die de app echt meldt: een ingeplande afspraak, een gewonnen deal en een verloren deal. Er is geen apart reisobject met doelgroep, looptijd of status; de reis is alleen de huidige fase van het account plus de auditregels.

Voor de accountmanager is de fase vooral zichtbaar als het label "Journey" op de klantkaart. De salesmanager ziet op "/team" per teamlid hoeveel accounts er in elke fase staan. De beheerder richt de fases en overgangen een keer in en past ze aan als het verkoopproces verandert.

Hoe dit zich verhoudt tot de prospectreis die Dealtrace nodig heeft, beschrijft het Architectuurplan New Business in §3 (Het new business-proces): drie hoofdfases (pre-data en kwalificatie, prospectfase, verbindingsfase), een prospectreis als uitvoering van een procestemplate op een doelgroep met eigen status en historie, een statusmachine per account naast de journeyfase, en een starterset van elf journeyfases met een vaste gebeurtenissencatalogus. De laatste paragraaf van dit hoofdstuk zet de twee naast elkaar.

## Waar je het vindt

- Route: "/instellingen/customer-journey". Tabtitel: "Customer Journey · DealDrive".
- Menu: zijbalk, kopje "Beheer", item "Instellingen", dan in het blok "Sub-pagina's" de link "Customer Journey-fases →".
- Rol: alleen beheerder en superuser; andere rollen krijgen "Je hebt geen toegang tot deze pagina." en gaan terug naar hun startpagina. Geen functievlag.
- Andere ingangen: de knop "Customer Journey →" op "/instellingen/activity-selling", en omgekeerd de knop "Open Activity Selling →" onderaan deze pagina.
- Waar de fase verder te zien is: op de accountkaart ("/accounts/[id]") in de regel met datums onder de bedrijfsnaam, met het label "Journey"; in de historieflyout van een account; op "/team" in de journeyverdeling per teamlid; en als filter "Alle journey-fases" en veld "Journey-fase" op "/instellingen/activity-selling".

![De pagina Customer Journey-fases met de eerste twee fases van de standaardset](shots/reis-1-pagina.png)

## Opbouw van de pagina

### Kop

- Kruimelpad "← Alle instellingen", kicker "Methodiek · Customer Journey", titel "Customer Journey-fases".
- Subtitel: "Definieer de fases die jullie hanteren, van eerste contact tot ambassadeur. Aan elke Activity-Selling-regel kun je daarna een fase toewijzen, zodat het inzichten-feed context-gevoelig wordt: een prospect in Awareness krijgt andere taken dan een klant in Adoptie."
- Rechts één teller: "8 fases" (het aantal fases).

### Actiebalk

Een balk die bovenaan blijft staan bij scrollen. Links de hint "Volgorde bepaalt waar de fase verschijnt in dropdowns en lijsten. Gebruik ↑ ↓ om te herordenen." Rechts de knoppen "Standaardset terugzetten" en "+ Fase".

### Lijst met fases

Elke fase is een kaart met:

- Links een zwart blokje met het volgnummer (1, 2, 3); de tooltip toont het technische id, bijvoorbeeld "Technisch id: cj-awareness".
- Een naamveld (placeholder "Naam van de fase"), een kleurkeuze (Zwart, Geel, Paars, Groen, Blauw, Rood, Oranje) en een voorbeeldlabel in die kleur met de naam in hoofdletters.
- Een omschrijving (placeholder "Korte omschrijving van wat er in deze fase gebeurt…").
- Het veld "Pitstop-accent (AI-agent)" met de placeholder "Hoe moet de pitstop taken, afspraken en deals in deze fase voorbereiden? Bv. 'Anticipeer op bezwaren rond prijs en voorwaarden.'"
- De regel "Gekoppelde regels: N": het aantal Activity selling-regels met deze fase als "Journey-fase".
- Rechts drie knoppen: ↑ (omhoog, uit bij de eerste fase), ↓ (omlaag, uit bij de laatste fase) en × (verwijderen).

Lege staat: "Nog geen customer-journey-fases. Klik op + Fase om de eerste toe te voegen."

De standaardset op deze pagina heeft acht fases:

| Nr | Fase | Omschrijving | Kleur |
|---|---|---|---|
| 1 | Awareness | Klant wordt bekend met je merk of categorie. | Zwart |
| 2 | Overweging | Klant vergelijkt jouw oplossing met alternatieven. | Geel |
| 3 | Evaluatie | Diepgaande check (demo, POC, referenties, business case). | Oranje |
| 4 | Beslissing | Onderhandeling en contractering: go/no-go besluit. | Paars |
| 5 | Onboarding | Eerste 30-60 dagen na de deal: adoptie zekerstellen. | Blauw |
| 6 | Adoptie & gebruik | Klant gebruikt actief. Waarde wordt zichtbaar. | Groen |
| 7 | Retentie | Verlenging, jaargesprekken, churn-preventie. | Groen |
| 8 | Loyalty & advocacy | Ambassadeurschap: referrals, cases, testimonials. | Rood |

Fase 1 tot en met 4 zijn de prospecthelft, fase 5 tot en met 8 de klanthelft. Deze acht hebben geen Pitstop-accent.

![Fase Beslissing met de kleurkeuze opengeklapt en een ingevuld Pitstop-accent](shots/reis-2-fase-kleur-accent.png)

### Blok "Doorschuiven op gebeurtenis"

- Kop "Doorschuiven op gebeurtenis" met de uitleg: "Een account schuift automatisch door wanneer een gebeurtenis plaatsvindt in een bepaalde fase, bv. deal gewonnen in Beslissing → Onboarding. Zonder overgang voor een gebeurtenis blijft het account gewoon staan. Elke fase-wisseling wordt in het auditlog vastgelegd."
- Rechts de knop "+ Overgang".
- Per overgang een rij: een keuzelijst "vanuit fase", een plusteken, een keuzelijst met de gebeurtenis, een pijl, een keuzelijst "naar fase" en een kruisje "Verwijder overgang".
- De gebeurtenissen: "Eerste afspraak gepland", "Deal gewonnen", "Deal verloren", "Eerste order", "Contract getekend", "Contract verlengd" en "Handmatig".
- Lege staat: "Nog geen overgangen. Accounts schuiven dan nergens automatisch door. Klik op + Overgang om de eerste te maken."

![Twee overgangen: Awareness met Eerste afspraak gepland naar Overweging, en Beslissing met Deal gewonnen naar Onboarding](shots/reis-3-overgangen.png)

### Afsluitend blok

Een donker blok "Koppel fases aan Activity Selling-regels" met de tekst "Kies een regel op Activity Selling en zet in het bewerkpaneel de Journey-fase, of filter de lijst links op fase om te zien welke regels bij een fase horen." en de gele knop "Open Activity Selling →".

### Waar de fase op de accountkaart staat

Op de accountkaart staat onder de bedrijfsnaam een smalle regel met "Laatste actie", "Laatste call", "Laatste bezoek" en, als het account een fase heeft, "Journey" met de naam van de fase. Het is alleen-lezen: in de code staat dat handmatig verzetten de audit zou omzeilen. Heeft het account geen fase, dan ontbreekt het label helemaal. Staat het account in een fase die niet meer bestaat, dan toont het label het kale technische id. In de mockmodus hebben de demo-accounts geen fase, daarom ontbreekt "Journey" op de schermafbeelding.

![De accountkaart van prospect Polder Mobiliteit: de datumregel onder de naam, zonder Journey-label omdat dit account nog geen fase heeft](shots/reis-7-accountkaart-stuurstrip.png)

## Doorklikken: de stappen

### Een prospectreis inrichten

1. Ga naar "Instellingen" en klik op "Customer Journey-fases →".
2. Hernoem de fases in de naamvelden naar je eigen verkoopstappen, of klik op "+ Fase" voor een extra fase. Er verschijnt de melding "Nieuwe fase toegevoegd" en de pagina scrolt naar de nieuwe kaart "Nieuwe fase" in de kleur Zwart.
3. Zet de volgorde met ↑ en ↓. De eerste fase in de lijst is de instapfase voor elke prospect.
4. Schrijf per fase een "Pitstop-accent", bijvoorbeeld in de prospectfases "Kennismaken: één reden voor contact, geen pitch."
5. Elke wijziging wordt na 400 milliseconden zonder verdere invoer bewaard; er is geen opslaanknop en geen opslagmelding.

### Doorschuiven vastleggen

1. Klik in het blok "Doorschuiven op gebeurtenis" op "+ Overgang". Er verschijnt een rij met de eerste fase, "Deal gewonnen" en de tweede fase.
2. Kies de fase waarin het account nu staat, de gebeurtenis en de fase waar het naartoe moet.
3. Herhaal dit voor elke stap van de reis. Een gebeurtenis zonder overgang voor de huidige fase laat het account staan.
4. Verwijderen kan met het kruisje achter de rij; dat gebeurt direct, zonder bevestiging of melding.

![De keuzelijst met gebeurtenissen in een overgang, opengeklapt](shots/reis-4-gebeurtenis-keuzelijst.png)

### Een startset per fase maken

1. Klik op "Open Activity Selling →" en kies een regel, of maak er een met "+ Regel".
2. Kies bij "Triggerpatroon (motor)" de optie "Gebeurtenis" en bij de parameters "Fase betreden (startset)".
3. Kies bij "Journey-fase" de fase waarvoor deze startset geldt, zet de activiteit op "Taak" en kies de actiesoort.
4. Op de journeypagina telt "Gekoppelde regels" van die fase nu één meer. Zodra een account de fase binnenkomt, maakt de motor de taak direct aan.

![Het veld Journey-fase in het bewerkpaneel van een regel, opengeklapt met de acht fases](shots/reis-6-regel-journeyfase.png)

### Een fase verwijderen

1. Klik op × bij de fase. Er verschijnt het venster "Fase verwijderen" met "Fase "Loyalty & advocacy" verwijderen?". Zijn er regels aan gekoppeld, dan staat er "N Activity-Selling-regels verliezen hun fase-koppeling."
2. Klik op "Verwijderen". De fase verdwijnt, de volgnummers sluiten aan en er komt de melding "Fase verwijderd". "Annuleren" of Escape laat alles staan.

![Het bevestigingsvenster bij het verwijderen van een fase](shots/reis-5-fase-verwijderen.png)

### Zien hoe een prospect doorschuift

1. Plan bij een prospect een afspraak via "+ Afspraak". De app meldt op de achtergrond de gebeurtenis "eerste-afspraak-gepland".
2. Had het account nog geen fase, dan stapt het eerst in op de eerste fase en daarna past de engine de overgang toe.
3. Op de accountkaart verschijnt "Journey" met de nieuwe fase; in het auditlog staat een regel "journey-doorschuiven" met van, naar en de gebeurtenis.
4. Zet je later de deal op gewonnen of verloren in de pipeline, dan volgt "deal-gewonnen" of "deal-verloren".

## Flyouts, vensters en knoppen

De pagina heeft geen flyouts; alles wordt op de kaarten zelf bewerkt.

| Knop | Wat er gebeurt | Bevestiging of melding |
|---|---|---|
| "+ Fase" | nieuwe fase "Nieuwe fase", kleur Zwart, achteraan | "Nieuwe fase toegevoegd" |
| ↑ en ↓ | ruilt de volgorde met de buurfase | geen |
| × bij een fase | verwijdert de fase en hernummert | venster "Fase verwijderen", daarna "Fase verwijderd" |
| "Standaardset terugzetten" | vervangt alle fases door de acht standaardfases | venster, daarna "Standaardset teruggezet" |
| "+ Overgang" | nieuwe rij: eerste fase, "Deal gewonnen", tweede fase | geen |
| × bij een overgang | verwijdert de rij | geen |
| "Open Activity Selling →" | naar "/instellingen/activity-selling" | geen |

Het venster bij "Standaardset terugzetten" heeft de titel "Standaardset terugzetten?", de tekst "Alle fases worden vervangen door de standaardset. Je eigen fases, hun volgorde en hun kleuren gaan verloren." en de rode knop "Standaardset terugzetten". De overgangen blijven daarbij staan, en ook de Pitstop-accenten gaan verloren, wat de tekst niet noemt.

Validatie is er nauwelijks: een lege naam mag (het label toont dan een streep), twee fases met dezelfde naam mogen, en een overgang van een fase naar dezelfde fase mag.

## Filters, zoeken, sorteren en weergaven

De pagina zelf heeft geen filters, zoekveld of weergaven; de volgorde is de handmatig gezette volgorde (veld order) en niets komt in de URL. Het filteren op fase gebeurt elders:

- "/instellingen/activity-selling": het filter "Alle journey-fases" met "Zonder fase" en elke fase, in de volgorde van deze pagina.
- "/team": het journeyblok verdeelt de accounts van elk teamlid over de fases, met een emmer "Zonder fase" voor accounts zonder fase; elke fase opent een lijst. Het blok volgt het paginafilter.
- De keuzelijsten "Journey-fase" in de regeleditor en in de overgangen tonen de fases altijd in de volgorde van deze pagina.

## Regels en berekeningen

### Instap: welke fase een nieuw account krijgt

Een account krijgt zijn eerste fase niet bij het aanmaken, maar pas bij zijn eerste journeygebeurtenis. De engine bepaalt dan de instapfase:

- Prospect: de fase met het laagste volgnummer.
- Klant: de fase halverwege de lijst, afgerond naar boven. Bij acht fases is dat de vijfde (Onboarding), bij het starterspakket van vijf fases de vierde (Onboarding).
- Klant of prospect volgt uit het veld accountKind van het account: alleen "klant" telt als klant, al het andere als prospect. De bel- en afspraakmatrix kijkt daarnaast naar het segment; die twee indelingen kunnen dus verschillen.

Gevolg: een prospect die nog nooit een afspraak of deal had, heeft geen fase. Regels met een "Journey-fase" raken hem niet, de accountkaart toont geen "Journey" en op "/team" telt hij onder "Zonder fase".

### Doorschuiven

1. De app meldt een gebeurtenis voor een account bij de server.
2. Heeft het account nog geen fase, dan wordt eerst de instapfase bepaald.
3. De engine zoekt de eerste overgang met dezelfde vanuit-fase en dezelfde gebeurtenis.
4. Is die er, dan krijgt het account de naar-fase. Is die er niet, dan wordt alleen de instap vastgelegd (als die net bepaald is) of gebeurt er niets.
5. Bij een wissel komt er een auditregel met de actie "journey-doorschuiven", de oude en nieuwe fase, de gebeurtenis en de gebruiker die de gebeurtenis veroorzaakte.

Per gebeurtenis schuift een account hoogstens één fase op. De engine zet een account nooit uit zichzelf terug, maar een overgang die naar een eerdere fase wijst, wordt gewoon uitgevoerd.

### Welke gebeurtenissen de app werkelijk meldt

| Gebeurtenis | Wie meldt hem | Opmerking |
|---|---|---|
| eerste-afspraak-gepland | het venster voor een nieuwe afspraak | bij elke nieuwe afspraak met een account, niet alleen de eerste |
| deal-gewonnen | een dealwissel naar een fase van het soort gewonnen | ook bij slepen op het kanbanbord |
| deal-verloren | een dealwissel naar een fase van het soort verloren | |
| eerste-order, contract-getekend, contract-verlengd | niemand | kiesbaar, maar vuurt nooit |
| handmatig | niemand | er is geen knop om een fase met de hand te zetten |

Het handboek en de code van de engine zeggen dat de accountmanager een fase altijd handmatig kan corrigeren. In het scherm kan dat niet: het label op de accountkaart is alleen-lezen en er is geen knop die de gebeurtenis "handmatig" stuurt.

### Gebeurtenisregels na een gebeurtenis

Na elke gemelde gebeurtenis draait de motor direct de gebeurtenisregels voor dat ene account:

- regels met het patroon "Gebeurtenis" en precies deze gebeurtenis;
- als het account van fase wisselde (ook bij de instap), regels met "Fase betreden (startset)" waarvan de "Journey-fase" gelijk is aan de nieuwe fase, of leeg is. Een startsetregel zonder fase vuurt dus bij elke fasewissel.

Daarna gelden de gewone poorten: accountklasse en journeyfase moeten passen, en de cadans moet verstreken zijn. De server antwoordt met hoeveel inzichten en taken er ontstonden.

### Het Pitstop-accent

Als de agent een concept voorbereidt (belscript, briefing, mailconcept of afspraakvoorbereiding), zoekt hij de fase van het account op en zet de naam en het accent in zijn opdracht. Zonder fase of zonder accent wordt het concept alleen soberder. De motor gebruikt dezelfde teksten in het advies bij een achterlopende campagne, zodat Pitstop en inzicht hetzelfde zeggen.

### Starterspakket tegenover standaardset

Een nieuwe organisatie in de database krijgt een starterspakket met vijf fases (Awareness, Overweging, Beslissing, Onboarding, Retentie), elk met een Pitstop-accent, en vier overgangen:

| Vanuit fase | Gebeurtenis | Naar fase |
|---|---|---|
| Awareness | Eerste afspraak gepland | Overweging |
| Overweging | Deal gewonnen | Onboarding |
| Beslissing | Deal gewonnen | Onboarding |
| Onboarding | Eerste order | Retentie |

Met deze inrichting loopt een prospect van Awareness via Overweging (eerste afspraak) direct naar Onboarding (deal gewonnen). Geen overgang leidt naar Beslissing, dus die fase wordt in de praktijk nooit bereikt. "Eerste order" wordt niet gemeld, dus Retentie ook niet. Een verloren deal laat de prospect in Overweging staan.

"Standaardset terugzetten" op de pagina laadt iets anders: acht fases zonder accent, en laat de overgangen ongemoeid.

### Opslaan

Fases en overgangen zijn organisatie-instellingen. Elke wijziging gaat na 400 milliseconden naar de server; mislukt dat, dan blijft de wijziging op het scherm staan zonder melding en komt bij de volgende keer laden de serverstand terug. Zonder database (de mockmodus) staat alles alleen in het geheugen van de browser, en de server weigert de gebeurtenis met "Geen database beschikbaar: de journey-gebeurtenis is niet verwerkt.".

### Waar code en scherm uit elkaar lopen

- Het verwijdervenster belooft dat gekoppelde regels "hun fase-koppeling verliezen", maar de code laat het fase-id op de regels staan. Die regels raken daarna alleen accounts die nog in de verwijderde fase staan, en zulke accounts tonen op de kaart het kale id.
- Overgangen die naar een verwijderde fase wijzen, blijven bestaan.
- Handmatig corrigeren wordt beloofd maar is niet te doen.
- De gebeurtenis heet "eerste afspraak gepland" maar wordt bij elke nieuwe afspraak gemeld; dat is onschuldig zolang er per fase maar één overgang voor die gebeurtenis is.

## Gegevens

Een fase (JourneyStage) staat in de organisatie-instelling journeyStages:

| Veld | Betekenis | Voorbeeld |
|---|---|---|
| id | technische sleutel | cj-awareness |
| label | naam van de fase | Awareness |
| description | omschrijving | Klant wordt bekend met je merk of categorie. |
| order | volgorde, vanaf 0 | 0 |
| color | ink, yellow, purple, green, blue, red of orange | ink |
| voorbereidingsAccent | Pitstop-accent, optioneel | Kennismaken, geen pitch. |
| createdAt | aanmaakmoment | datum en tijd |

Een overgang staat in de instelling journeyTransitions met drie velden: de vanuit-fase (fromStageId), de gebeurtenis (event) en de naar-fase (toStageId).

Op het account staat de huidige fase in de kolom journey_stage_id (met een index) en als kopie in de JSON-data. Er is geen geschiedenis van fases op het account zelf; die staat alleen in het auditlog, als gebeurtenis "journey-doorschuiven" met de wijziging van en naar en de gebeurtenis als metadata. Een Activity selling-regel draagt de fase in journeyStageId.

Van andere features komen de gebeurtenissen (afspraken en dealfases), het soort account (klant of prospect) en de regels; naar andere features gaan de fase (regeltargeting, accountkaart, teamoverzicht) en het accent (Pitstop en campagne-advies).

## Wat dit betekent voor Dealtrace

- Overnemen: fases en overgangen als inrichting per organisatie, doorschuiven alleen op gebeurtenis en nooit op het afvinken van een taak, een auditregel per wissel, en de startset per fase via "fase betreden". Dat is precies de ruggengraat die het Architectuurplan in §3 en §7 voor de prospectreis beschrijft.
- Overnemen: het Pitstop-accent per fase. Voor new business is de toon per fase (kennismaken, verwijzen naar eerder contact, bezwaren voor zijn) het verschil tussen een bruikbaar en een generiek belscript.
- Anders: laat een account instappen zodra het binnenkomt (lead overgenomen, import), niet pas bij de eerste afspraak. Een prospectreis begint in de pre-datafase, en juist daar heeft DealDrive geen fase.
- Anders: meld elke gebeurtenis uit de catalogus ook echt (gekwalificeerd, eerste contact, offerte verstuurd, heropvolging, handmatig) en geef de accountmanager een knop om met reden handmatig te corrigeren, met auditregel. Kiesbare gebeurtenissen die nooit vuren, zoals nu, ondermijnen het vertrouwen.
- Nodig voor een prospectreis, en ontbreekt in DealDrive: een reisobject per doelgroep met procestemplate, versie, status (concept, actief, gepauzeerd, afgerond) en historie; een nb_status per account naast de fase (nieuw, in reis, wachtend, nee, gescoord, klant) met cooldown per kanaal; en een reisgeschiedenis per account in plaats van alleen het auditlog.
- Nodig voor binnendienst en buitendienst: dezelfde reis met andere standaardactiviteiten per kanaal (bellen tegenover bezoek), zodat de startset per fase de juiste actiesoort en uitvoerder kiest.
- Verbeteren: bij het verwijderen van een fase de gekoppelde regels, overgangen en accounts echt omzetten (naar een gekozen andere fase), en een controle die waarschuwt voor een fase waar geen enkele overgang naartoe leidt, zoals "Beslissing" in het huidige starterspakket.
