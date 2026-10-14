# Agent-prompts

## Wat het is en waarvoor

Agent-prompts is de promptbibliotheek van DealDrive: per agent een paar instelbare stukken tekst (slots) waarmee de founder centraal bepaalt wat de AI-agents te horen krijgen. Het gaat om de opdracht, dus toon, opbouw, lengte en bij de motor de beoordelingsvraag. Het kader eromheen (niets uitvoeren, niets verzinnen, bewijsplicht, uitvoerformaat en taal) staat vast in de code en is hier bewust niet te wijzigen.

Het probleem dat dit oplost: zonder bibliotheek is elke verbetering van een belscript of een briefing een release. Met de bibliotheek pas je de opdracht aan voor alle klanten tegelijk, zie je met "Proefdraai" vooraf wat de agent ermee krijgt, en zet je een eerdere versie met één klik terug. Een klant die iets anders wil, krijgt per slot een eigen instructie in zijn organisatie op "Klanten", terwijl hij alle andere slots van het platform blijft volgen.

Je gebruikt het scherm als concepten of briefings in de klantapp structureel te lang, te stijf of verkeerd van toon zijn, als de motor te veel of te weinig inzichten oplevert, of als een klant een eigen schrijfstijl wil.

De bibliotheek staat als één rij met sleutel agentPrompts in de tabel org_settings, onder de systeem-organisatie voor het platform en eventueel onder een klant voor diens afwijkingen. De klantapp leest bij elke generatie de samengevoegde stand. Het scherm hangt samen met de LLM-connector (die bepaalt welk model draait; de prompts bepalen wat dat model gezegd krijgt, en beide volgen dezelfde trap van organisatie naar platform naar standaard), met het blok "Agent-prompts" in de organisatie-flyout op "Klanten", en met de instellingen van de customer journey in de klantapp, waar per fase een accent wordt toegevoegd.

## Waar je het vindt

In de zijbalk van DealDrive HQ staat de groep "AI" met als tweede item "Agent-prompts" (document-icoon). De route is /admin/prompts. Alleen de rol superuser kan de pagina gebruiken; elke serverroute weigert andere rollen met "Alleen voor superusers." (403). De klantapp heeft geen route naar deze bibliotheek.

De afwijking per klant zit niet op deze pagina maar in de organisatie-flyout: open op "Klanten" een klant en scrol naar het vijfde blok "Agent-prompts", direct onder "LLM-connector". De subtitel van de pagina verwijst daarnaar ("Wat een klant daarvan afwijkt zet je in zijn eigen organisatie, op Klanten."), maar bevat geen link.

![Agent-prompts in DealDrive HQ: kop, drie uitlegblokken en het begin van de Pitstop](shots/prompts-1-pagina.png)

## Opbouw van de pagina

De pagina heeft een kop, een band met drie uitlegblokken, en daaronder de bibliotheek, gegroepeerd per agent. Er zijn geen knoppen rechtsboven, geen statkaarten, geen filters en geen tabellen.

### Kop

Kicker: "DealDrive HQ · AI · Agent-prompts". Titel: "De opdracht per agent.". Subtitel: "Vijf agents, elk met een paar instelbare slots. Per slot stel jij centraal de opdracht in, voor álle organisaties tegelijk en zonder release. Wat een klant daarvan afwijkt zet je in zijn eigen organisatie, op Klanten. De proefdraai ernaast laat een wijziging zien voordat iemand hem ziet."

### Drie uitlegblokken

- "Wie hier zijn opdracht krijgt": de motor beoordeelt wekelijks per account of een regel een inzicht oplevert; bij een goedgekeurd inzicht of opgepakte taak schrijft de Pitstop een concept (belscript, mail of briefing); daarnaast leest de verslag-analyse een bezoekverslag uit, bereidt de briefing een gesprek voor en zet het accountplan de strategie per klant op papier.
- "Wat je hier instelt, en wat niet": je stelt de opdracht in, niet de bewijsplicht, niet het uitvoerformaat en niet de taal; per klant komt er een laag bovenop (eigen instructie op "Klanten" plus het fase-accent uit de customer journey).
- "De knop Proefdraai": stelt de volledige prompt samen op een vast voorbeeld per agent, zonder iets op te slaan of een echte taak te raken; alleen bij de Pitstop komt er een concept bij.

### De bibliotheek

Zonder database staat bovenaan een gele melding: "Geen database actief. De promptbibliotheek werkt alleen met een databaseverbinding. Je ziet hieronder wel de ingebouwde standaarden." Kan de bibliotheek niet laden, dan staat er een rode regel met de fout of "Promptbibliotheek laden mislukt."

Daarna volgen vijf groepen met een kop per agent, in deze volgorde: "Pitstop", "Verslag-analyse", "Briefing", "Accountplan", "Motor". Elk slot is een witte kaart met:

- de naam van het slot als kop (bijvoorbeeld "Belscript");
- een uitlegregel (bij de Pitstop steeds "Hoe de agent dit concept schrijft: toon, opbouw, lengte.");
- "Standaard:" met de ingebouwde tekst uit de code (bij de motor op twee regels);
- rechtsboven het label "Aangepast" als er een eigen platformtekst is opgeslagen;
- een tekstvak van drie regels met de opgeslagen platformtekst, of leeg met de placeholder "Eigen instructie (leeg = terug naar de ingebouwde standaard)". Zonder database is het vak alleen-lezen met de placeholder "Zonder database alleen te lezen";
- "Vast:" met wat er omheen vast blijft staan;
- de knoppen "Opslaan", "Herstel standaard", "Proefdraai" en "Versies (n)" (zie Flyouts, vensters en knoppen).

![De eerste slots van de Pitstop, in de mock alleen te lezen](shots/prompts-2-pitstop-slots.png)

### De achttien slots

| Agent | Slot op het scherm | Sleutel | Ingebouwde standaard, kort |
|---|---|---|---|
| Pitstop | "Belscript" | belscript | opening met aanleiding, 2 tot 3 vragen, vervolgstap, in steekwoorden |
| Pitstop | "Mailconcept" | mailconcept | onderwerpregel plus tekst, maximaal 120 woorden, één vervolgstap |
| Pitstop | "Bericht (LinkedIn/app)" | berichtconcept | maximaal 60 woorden, laagdrempelig contact |
| Pitstop | "Bezoek-briefing" | bezoek-briefing | feiten, 3 gespreksonderwerpen, wat een geslaagd bezoek oplevert |
| Pitstop | "Meeting-briefing" | meeting-briefing | feiten, 3 agendapunten, gewenst resultaat |
| Pitstop | "Demo-briefing" | demo-briefing | feiten, 3 demo-onderdelen met waarom, vervolgstap |
| Pitstop | "Dealvoorbereiding" | deal-voorbereiding | stand van de deal, volgende stap, 2 tot 3 bezwaren met antwoord |
| Pitstop | "LinkedIn-actie" | linkedin-actie | welke actie en waarom, eventueel kort reactieconcept |
| Pitstop | "Research-notitie" | research-notitie | feiten op een rij, 3 onderzoeksvragen |
| Pitstop | "Algemene voorbereiding" | voorbereiding | aanleiding, gewenste uitkomst, eerste stap |
| Verslag-analyse | "Duiding van signalen" | verslag-analyse.duiding | budget of enthousiasme is een koopsignaal, geen bezwaar |
| Verslag-analyse | "Vorm van de actiepunten" | verslag-analyse.actiepuntvorm | actiepunten als opdracht |
| Briefing | "Schrijfstijl" | briefing.stijl | platte tekst, geen koppen of vet, opsomming met streepje |
| Briefing | "Lengte per blok" | briefing.lengte | maximaal ongeveer 110 woorden per blok |
| Accountplan | "Schrijfstijl" | accountplan.stijl | platte tekst, geen koppen of vet |
| Accountplan | "Lengte per sectie" | accountplan.lengte | ongeveer 100 woorden per sectie |
| Motor | "De beoordelingsvraag" | motor.inzicht.vraag | is er volgens deze regel een commercieel relevant inzicht? |
| Motor | "Schrijfregels en taakdrempel" | motor.inzicht.stijl | titel, tekst en commerciële hoek zakelijk; alleen een taak als er echt iets te doen valt |

De "Vast:"-regels verschillen per agent. Pitstop: "Het veiligheidskader ("je voert niets uit"), de bekende feiten en de bewijsplicht staan eromheen en zijn niet instelbaar." Verslag-analyse: alles moet herleidbaar zijn tot het verslag en de code filtert daarop, en "in het Nederlands" staat vast. Briefing en accountplan: blokindeling, zes secties en het toolschema liggen vast, en er is een harde bovengrens aan het antwoord, zodat meer tekst vragen afkapping oplevert in plaats van een langere briefing. Motor: de citeerplicht en "geen bewijs = niet relevant" staan eromheen en de code gooit elk citaat weg dat niet letterlijk in het materiaal staat; de ondergrens voor een voorgestelde taak staat in de code.

De volgorde en de teksten van uitleg en "Vast:" komen uit het register shared/promptSlots.ts; de standaardteksten uit de promptbouwer van elke agent zelf. De pagina toont alleen slots die de server ook kent.

![De twee slots van de motor](shots/prompts-3-motor-slots.png)

### Het blok "Agent-prompts" in de organisatie-flyout

In de organisatie-flyout heet het blok "Agent-prompts", met rechts in de kop de teller "[n] van de 18 wijken af van het platform". Daaronder dezelfde vijf groepen, maar als compacte rijen: de naam van het slot, een herkomstregel, een label en de knop "Bewerken". Het label en de regel hebben drie standen:

| Label | Herkomstregel | Betekenis |
|---|---|---|
| eigen | "Eigen instructie; volgt het platform niet meer." | de klant heeft een eigen tekst |
| platform | "Volgt de platformbibliotheek." | de platformbibliotheek heeft een tekst |
| standaard | "Volgt de ingebouwde standaard in de code." | nergens een tekst opgeslagen |

De teller telt het aantal slots met label eigen. Zonder database staat er "Geen database actief op deze omgeving, dus geen promptbibliotheek." In de mock is dit blok niet te bereiken, omdat er zonder database geen klanten zijn; de beschrijving komt uit de code.

## Doorklikken: de stappen

1. **Een platformprompt aanpassen.** Open "Agent-prompts" en zoek het slot, bijvoorbeeld "Belscript" onder "Pitstop". Typ de nieuwe opdracht in het tekstvak. "Opslaan" wordt pas klikbaar zodra de tekst afwijkt van wat er is opgeslagen. Klik "Opslaan"; de knop toont "Opslaan…". Daarna staat het label "Aangepast" bij het slot, verschijnt "Versies (1)" als er al een eerdere eigen tekst was, en is "Opslaan" weer grijs. Er is geen groene bevestiging of toast. De klantapp gebruikt de nieuwe tekst binnen een minuut.
2. **Vooraf proefdraaien.** Klik bij een slot op "Proefdraai" (tijdens het samenstellen "Proefdraai…"). Onder de knoppen verschijnt "Proefdraai:" met het voorbeeldscenario, een inklapbaar deel "Samengestelde prompt" en, alleen bij de Pitstop, het gegenereerde concept. De proefdraai gebruikt de tekst die nu in het vak staat, ook als die nog niet is opgeslagen. Bij de vier agents met een toolschema kost dit niets; bij de Pitstop is het een echte aanroep van het model (in deze beschrijving daarom alleen bij de motor gebruikt).
3. **Terug naar de ingebouwde standaard.** Klik "Herstel standaard" (alleen zichtbaar bij "Aangepast"). De eigen tekst gaat naar de versiegeschiedenis, het vak wordt leeg en de agent volgt weer de standaard uit de code. Hetzelfde gebeurt als je de tekst wist en "Opslaan" klikt. Er is geen bevestigingsvraag.
4. **Een eerdere versie terugzetten.** Klik "Versies (n)". Onder het slot opent een lijst met eerdere teksten, nieuwste eerst, elk met datum en tijd en de knop "Zet terug". Klik "Zet terug" bij de gewenste versie: die tekst wordt direct opgeslagen als de huidige, en de tekst die er stond schuift naar de geschiedenis. "Verberg versies" klapt de lijst weer in. Er kan steeds één versielijst tegelijk open staan.
5. **Eén klant een eigen instructie geven.** Ga naar "Klanten", open de klant, scrol naar "Agent-prompts" en klik "Bewerken" bij het slot. Direct onder die rij opent de bewerker met de kop "Eigen instructie voor [agent] › [slot]" (bijvoorbeeld "Eigen instructie voor Briefing › Schrijfstijl"). Typ de tekst en klik "Opslaan" (tijdens het opslaan "Bezig…"). Het label springt op eigen en de teller gaat omhoog. "Sluiten" klapt de bewerker in.
6. **Een klant weer het platform laten volgen.** Open de bewerker van een slot met label eigen en klik "Platform volgen". De eigen tekst gaat naar de geschiedenis van die klant en het slot volgt weer de platformtekst, of de standaard als het platform niets heeft.

![Na een klik op Proefdraai bij de beoordelingsvraag van de motor](shots/prompts-4-proefdraai-motor.png)

## Flyouts, vensters en knoppen

De pagina heeft geen flyouts of vensters. Alles opent binnen de kaart van het slot. Escape doet niets.

### Knoppen per slot op /admin/prompts

- "Opslaan" (primaire knop): uitgeschakeld zonder database, tijdens het opslaan van dit slot, of als de tekst gelijk is aan de opgeslagen tekst (spaties aan begin en eind tellen niet). Zonder database staat onder de knoppen "Opslaan vraagt een database; op deze omgeving kun je de slots alleen lezen en proefdraaien." en geeft de knop bij aanwijzen "Opslaan vraagt een database.".
- "Herstel standaard": alleen bij label "Aangepast". Slaat een lege tekst op.
- "Proefdraai": altijd beschikbaar, ook zonder database.
- "Versies (n)" en "Verberg versies": alleen als er eerdere versies zijn.
- "Zet terug": per versie in de geopende lijst.

Een fout bij opslaan of proefdraaien verschijnt als rode regel onder de knoppen van dat slot, met de tekst van de server of "Opslaan mislukt." of "Proefdraai mislukt.". De ingetypte tekst blijft dan staan.

### Het proefdraairesultaat

Onder een gestippelde lijn verschijnt de kop "Proefdraai:" met het scenario in hoofdletters. Per agent is het scenario vast:

| Agent | Scenario | Concept erbij |
|---|---|---|
| Pitstop | een taak "offerte bespreken" in de dealfase, met vier CRM-feiten | ja, via het geldende model |
| Motor | één account tegen een aflopend contract, met drie CRM-feiten | nee |
| Verslag-analyse | een kort bezoekverslag met een bezwaar en een koopsignaal | nee |
| Briefing | briefing voor een 1e-gesprek bij een A-klant met een aflopend contract | nee |
| Accountplan | accountplan voor een A-klant met een aflopend contract en een open deal | nee |

Bij de vier agents zonder concept staat er een gedempte regel met de reden, bijvoorbeeld "De motor dwingt zijn uitvoer af met het toolschema geef_oordeel. Een generatie zonder dat schema toont iets wat er in productie nooit uitkomt." Bij de Pitstop staat er "geen LLM-key: alleen de prompt" als er geen echte aanbieder geldt, of "Claude-aanroep mislukt: …" bij een fout. Het deel "Samengestelde prompt" toont de volledige tekst in een vast lettertype; bij de motor bijvoorbeeld de regel, de beoordelingsvraag, de vaste regels over citeren en bewijs, de schrijfregels en "Antwoord via de tool geef_oordeel."

![De samengestelde prompt van de motor, uitgeklapt](shots/prompts-5-samengestelde-prompt.png)

### De bewerker in de organisatie-flyout

Opent onder de aangeklikte rij. Bevat de kop "Eigen instructie voor [agent] › [slot]", de uitlegregel van het slot, een tekstvak van vier regels met de placeholder "Leeg laten betekent: volg het platform", de "Vast:"-tekst, en rechts het kader "Wat hij zonder eigen instructie volgt" met de geërfde tekst en de bron: "Uit de platformbibliotheek. Wijzig je die, dan wijzigt dit mee." of "De ingebouwde standaard uit de code." Het tekstvak wordt bewust niet voorgevuld met de geërfde tekst: dan zou opslaan van een ongewijzigd vak een kopie maken die daarna stil achterloopt op elke platformwijziging. Knoppen: "Opslaan" en, alleen bij een eigen tekst, "Platform volgen". Een fout staat naast de knoppen; lijst en ingetypte tekst blijven dan staan.

Filters, zoeken, sorteren en weergaven zijn niet van toepassing: de pagina toont altijd alle achttien slots in vaste volgorde, zonder iets in de URL.

## Regels en berekeningen

### De keten per sleutel

Welke tekst een agent krijgt, wordt per slot bepaald, in drie treden:

1. de eigen tekst van de organisatie;
2. de tekst van het platform (deze pagina);
3. de ingebouwde standaard in de code.

De functie getActievePrompts leest de platformrij en de rij van de organisatie, houdt van elk alleen de niet-lege, getrimde teksten over en voegt ze samen, waarbij de organisatie wint. Dat gaat per sleutel en niet per bibliotheek, en dat is een bewuste keuze: een klant met één eigen belscript blijft voor de andere zeventien slots elke latere platformverbetering volgen. Gevolg: leeg opslaan betekent op platformniveau terug naar de code, maar op klantniveau terug naar het platform.

Het zijn twee aparte leesbeurten in plaats van één gecombineerde query, omdat de rijbeveiliging van de database op organisatie filtert; één query over twee organisaties bestaat niet. Kan de bibliotheek niet gelezen worden, dan krijgt de agent de ingebouwde standaarden en wordt die fout niet bewaard, zodat een korte storing niet een minuut doorwerkt. De bibliotheek kan een generatie dus nooit blokkeren of kapotmaken.

### Tussengeheugen

De samengevoegde stand wordt per organisatie een minuut (60.000 ms) bewaard. Elke schrijfactie leegt dat tussengeheugen in het eigen proces, zodat de proefdraai meteen de nieuwe tekst ziet. De klantapp is een apart proces en pakt een wijziging uit HQ binnen een minuut op.

### Opslaan en versies

PUT /api/superuser/agent-prompts ontvangt het slot en de tekst. De server weigert zonder database ("Zonder database is de promptbibliotheek niet beschikbaar.", 503), bij een onbekend slot ("Onbekend promptslot."), zonder tekst ("instructie (string) vereist.") en boven 4.000 tekens ("Instructie is te lang (max 4000 tekens)."). Het scherm heeft geen tekenteller; je merkt de grens pas bij opslaan.

Bij elke opslag met een nieuwe tekst schuift de vorige tekst met zijn datum vooraan in de geschiedenis van dat slot. Bij een lege tekst wordt de huidige tekst leeg en gaat de oude naar de geschiedenis; zonder bestaande tekst gebeurt er niets. Per slot worden maximaal 10 oude versies bewaard; oudere vallen eraf. "Zet terug" is een gewone opslag van de oude tekst, dus de geschiedenis blijft groeien en kan dezelfde tekst meerdere keren bevatten. De hele bibliotheek is één JSON-waarde die bij elke opslag wordt gelezen, aangepast en teruggeschreven, zonder vergrendeling: als twee mensen tegelijk opslaan, kan de laatste de wijziging van de eerste overschrijven. De klantroute (PUT /api/superuser/organisations/[id]/prompts) volgt dezelfde regels, schrijft onder de organisatie en geeft de nieuwe geldende stand terug.

### Wat de agent werkelijk krijgt

Elke agent bouwt zijn prompt zelf en vult de opdracht in met de bibliotheektekst of de standaard:

- **Pitstop** (agentExecutor): de tekst staat op één regel "OPDRACHT: …". Daarvoor staan altijd het veiligheidskader ("Je voert NIETS uit …"), de taak of afspraak, aanleiding, account, contactpersoon, journey-fase met fase-accent, het broninzicht (gemarkeerd als interpretatie, geen feit) en "BEKENDE FEITEN (verzin niets daarbuiten)". Daarna altijd: Nederlands, zakelijk, alleen het concept, platte tekst zonder opmaak. Gebruikt op drie plekken: bij een taak, een afspraak en een deal. Antwoordbudget 1.024 tokens.
- **Motor** (aiInsight): vraag en schrijfregels komen in het stabiele deel van de prompt, met de regel van de klant en de vaste regels over citeren en bewijs. Dat stabiele deel staat vooraan, zodat de aanbieder het kan hergebruiken (promptcache). De code gooit elk bewijs weg dat niet letterlijk in het materiaal staat, en een voorgestelde taak blijft alleen staan bij een zekerheid van minstens 60.
- **Verslag-analyse**, **Briefing** en **Accountplan**: dwingen hun uitvoer af met een toolschema; antwoordbudget 1.500, 2.000 en 3.000 tokens. Bij de briefing telt een ingestelde stijl- of lengtetekst mee in de vingerafdruk van een bewaarde briefing, zodat die na een wijziging opnieuw wordt gemaakt. Alleen als er iets is ingesteld: anders zouden bij de uitrol alle bestaande briefingen van alle klanten tegelijk verouderen.

Het fase-accent per journey-fase stelt de klant zelf in, in de klantapp onder de instellingen van de customer journey. Dat is dus een derde laag naast platform en organisatie, maar die werkt alleen in de Pitstop-prompt (en in het campagne-advies van de motor, dat geen instelbaar slot heeft). Een promptwijziging kan het kader nooit uitschakelen, en dat is precies waarom het beheer uit handen gegeven kan worden.

### De proefdraai

POST /api/superuser/agent-prompts/test stelt de prompt samen met de tekst uit het vak (of de standaard als het vak leeg is) op vaste voorbeelddata uit server/utils/promptVoorbeeld.ts. Die voorbeelddata zijn dezelfde als die van de vastgelegde controletests (achttien hashes van de prompts), zodat "de proefdraai zag er goed uit" iets zegt over wat er straks draait. Alleen voor de Pitstop volgt een echte generatie via de LLM-connector, met de organisatie van de ingelogde superuser en een budget van 1.024 tokens. De proefdraai wordt bewust niet in het kostenlogboek gezet: het is gereedschap van de founder, geen klantverbruik.

Twee punten waar scherm en code afwijken. Het uitlegblok zegt "Alleen bij de Pitstop schrijft Claude er ook een concept bij" en bij een fout staat er "Claude-aanroep mislukt", maar de aanroep gaat naar het model dat de connector oplevert; dat kan ook OpenAI, Gemini of een eigen eindpunt zijn. En het commentaar in de serverroute spreekt van "de meegegeven of opgeslagen instructie", terwijl de route alleen de meegegeven tekst gebruikt; het scherm stuurt altijd de inhoud van het vak mee.

### Waarom agentPrompts en aiBundel niet in SETTING_KEYS staan

SETTING_KEYS in shared/settingKeys.ts is de lijst sleutels die een organisatie zelf mag opslaan via PUT /api/settings/[sleutel]. Die route is open voor de klant-beheerder (en voor activePipeline zelfs voor elke gebruiker). Twee sleutels die wel per organisatie in org_settings staan, beheert de leverancier en niet de klant: agentPrompts (de promptbibliotheek) en aiBundel (de AI-bundel met het maandplafond). Stonden ze in de lijst, dan kon een klant-beheerder zijn eigen prompts herschrijven en zijn eigen plafond ophogen; een plafond dat de klant zelf zet, is geen plafond maar een suggestie. De afwezigheid in de lijst is de beveiliging aan de schrijfkant: de route weigert met "Onbekende instelling".

Aan de leeskant is een tweede maatregel nodig. GET /api/settings stuurt alle instellingen van de eigen organisatie naar elke ingelogde gebruiker, zonder rechtencontrole. Daarom filtert loadSettings de sleutels uit VERBORGEN_KEYS (agentPrompts en aiBundel) al bij het lezen, ook voor andere aanroepers. Anders zou het complete AI-recept, inclusief tot tien versies per slot, in de browser van elke accountmanager belanden zodra er één klantrij bestaat. De code zegt erbij dat die filter er moest staan voordat er ooit zo'n rij onder een echte klant stond. Beide sleutels worden alleen beheerd via eigen superuser-routes; de bundel ziet de klant op /instellingen/verbruik via een eigen route met een eigen rechtencheck.

De platformrij staat onder de systeem-organisatie, die geen echte organisatie is en vanuit een gewone gebruikerssessie onbereikbaar is; alleen de server leest hem. HQ zelf heeft /api/settings wel nodig (voor het roadmapbord), maar dat opent niets wat de klantapp niet al had.

### Mock tegenover productie

De HQ-mock op localhost:3096 draait zonder database. Daardoor zie je de ingebouwde standaarden, zijn alle tekstvakken alleen-lezen, is "Opslaan" grijs, en ontbreken het label "Aangepast", "Herstel standaard" en "Versies". "Proefdraai" werkt wel. De omgeving van deze mock heeft een sleutel voor Claude, dus een proefdraai bij een Pitstop-slot doet daar een echte aanroep. In productie, met database, zijn alle knoppen actief.

## Gegevens

Per niveau één rij in org_settings:

| Veld | Betekenis |
|---|---|
| organisatie (organisation_id) | de systeem-organisatie (__dealdrive-systeem__) voor het platform, of een klant |
| sleutel (key) | altijd agentPrompts |
| waarde (value) | de bibliotheek als JSON, zie hieronder |
| bijgewerkt (updated_at) | tijdstip van de laatste opslag van de rij |
| bijgewerkt door (updated_by) | de gebruiker van de laatste opslag van de rij |

De waarde bevat per slotsleutel een record met de huidige tekst (instructie), het tijdstip (updatedAt) en de geschiedenis (versies), een lijst van maximaal 10 eerdere teksten met hun tijdstip, nieuwste eerst. Een lege instructie betekent: geen eigen tekst op dit niveau. Per versie wordt niet bewaard wie hem schreef; alleen de rij als geheel kent een laatste bewerker.

Wat van andere features komt: de standaardteksten uit de promptbouwers in de code, het fase-accent uit de customer journey van de klant, de CRM-feiten van het account, het model uit de LLM-connector en, voor de Pitstop, het kostenlogboek agent_runs (soort concept). Het register van slots (shared/promptSlots.ts) noemt ook wat bewust niet instelbaar is gemaakt: de zoekinstructies en de beoordelingsvraag van de web-beoordeling, de toon van de assistent-chat en alles rond Dex.

## Wat dit betekent voor Dealtrace

- Neem het principe over dat de opdracht instelbaar is en het kader niet: geen verzonnen feiten, bewijsplicht, uitvoerformaat en taal blijven in de code. Voor een new business-tool hoort daar ook bij: geen berichten versturen zonder goedkeuring en geen LinkedIn-acties boven de limieten, ongeacht wat er in een prompt staat.
- Neem de keten per sleutel over (organisatie, platform, standaard) met de herkomstlabels eigen, platform en standaard, en het bewust lege bewerkveld. Dat voorkomt kopieën die stil achterlopen.
- Leg per versie vast wie hem schreef en waarom (een korte notitie), en toon een verschil tussen twee versies. DealDrive bewaart alleen tekst en datum, en terugzetten maakt dubbele versies.
- Voeg een tekenteller en een bevestiging toe bij opslaan, en vergrendel de bibliotheek tegen gelijktijdig opslaan. DealDrive schrijft de hele bibliotheek in één keer terug zonder vergrendeling en geeft geen succesmelding.
- Koppel promptwijzigingen aan resultaat: toon per slot het aantal generaties, de kosten en, voor outreach, de reactiegraad van berichten voor en na een wijziging. Voor Dealtrace zijn openingsberichten en prospectonderzoek de slots die er het meest toe doen.
- Laat de proefdraai kiezen uit een paar voorbeeldprospects (verschillende branches en fases) in plaats van één vast scenario, en log de kosten van een echte proefgeneratie apart in plaats van ze niet te loggen.
- Zet het fase-accent niet alleen bij de Pitstop maar bij alle agents, en maak in de bibliotheek zichtbaar welke klanten een eigen accent of eigen tekst hebben.
- Houd prompts en verbruiksplafonds net als in DealDrive buiten de lijst die een klant-beheerder zelf mag schrijven, en filter ze aan de leeskant, zodat het recept en de plafonds nooit in de browser van een gebruiker belanden.
