# LLM-connector

## Wat het is en waarvoor

De LLM-connector bepaalt welk taalmodel van welke aanbieder de AI-output van DealDrive maakt: de chat met de assistent, de Pitstop-concepten, briefings, accountplannen, verslag-analyses en de wekelijkse beoordelingen van de motor. Voor de founder lost hij drie problemen op. Je wisselt van model of aanbieder zonder release en zonder omgevingsvariabelen aan te passen. Je kunt één klant op een andere aanbieder of een eigen sleutel zetten (bijvoorbeeld een klant die zijn eigen Azure OpenAI-contract wil gebruiken), terwijl de rest op de platform-standaard blijft. En je ziet in één oogopslag wat er werkelijk draait, ook als een opgeslagen instelling kapot is.

Je gebruikt het scherm bij de eerste inrichting van een omgeving, bij een modelwissel (een nieuw model van Anthropic, OpenAI of Google, of een model dat de aanbieder uitzet), bij een klant die een eigen sleutel aanlevert, en bij storingen waarbij de AI in de klantapp nepantwoorden geeft.

De connector schrijft rijen in de tabel llm_connections: één rij voor het platform (onder een vaste systeem-organisatie) en hooguit één rij per klantorganisatie. De klantapp leest die rijen bij elke AI-aanroep via dezelfde oplosketen. Het scherm hangt samen met drie andere plekken in HQ: het klantdetail op "Klanten" (de organisatie-flyout heeft een eigen blok "LLM-connector" voor de afwijking per klant), het blok "Agent-prompts" direct daaronder (de connector bepaalt welk model draait, de prompts wat dat model te horen krijgt) en het blok "AI-kosten" in dezelfde flyout, waar elke testaanroep van de connector als kostenregel terugkomt.

## Waar je het vindt

In de zijbalk van DealDrive HQ staat de groep "AI" met als eerste item "LLM-connector" (stekker-icoon). De route is /admin/llm. De pagina hoort bij de HQ-build (DEALDRIVE_APP=hq) en bestaat niet in de klantapp; alle serverroutes eronder beginnen met /api/superuser en staan op de lijst van routes die alleen in HQ meegebouwd worden.

Alleen de rol superuser ziet en gebruikt het scherm. Elke serverroute controleert dat zelf en weigert anders met "Alleen voor superusers." (403). Er is geen aparte schrijf- of leesrol.

Je komt er ook via de tekstlink "Klanten" in de subtitel en in de eerste trede van de keten, die naar /admin wijzen: daar open je een klant en vind je in de brede organisatie-flyout het blok "LLM-connector". Dat blok gebruikt hetzelfde onderdeel (AdminLlmVerbinding) als de platform-pagina, maar met de organisatie als parameter en eigen serverroutes.

![De LLM-connector in DealDrive HQ, met de groep AI in de zijbalk en de oplosketen bovenaan](shots/llm-1-pagina.png)

## Opbouw van de pagina

De pagina heeft vier delen onder elkaar: de kop, het blok "Wat er nu draait", het blok "Platform-standaard" en het blok "Wat werkt waarop" met twee notities. Er zijn geen knoppen rechtsboven en geen statkaarten.

### Kop

Kicker: "DealDrive HQ · AI · LLM-connector", met het gele streepje ervoor. Titel: "Welke AI genereert de output?". Subtitel: "Eén standaard voor het platform, per klant te overschrijven in het klantdetail op Klanten. De keten hieronder bepaalt wat er werkelijk draait." Het woord "Klanten" is een link naar /admin.

### Blok "Wat er nu draait"

Kop "Wat er nu draait" met rechts de toelichting "eerste treffer in de keten wint". Daaronder vier kaarten naast elkaar, de treden van de oplosketen. De kaart die op deze server actief is krijgt een dikke zwarte rand, een witte achtergrond en achter het nummer het woord "actief".

- "Trede 1 · Organisatie": altijd dezelfde uitleg, "Eigen rij per klant; die beheer je in het klantdetail op Klanten. Deze keten toont de platform-stand." Deze kaart wordt op de platform-pagina nooit actief, omdat de pagina de keten zonder organisatie oplost.
- "Trede 2 · Platform": actief toont "Claude (Anthropic), model claude-sonnet-5. Dit is wat er draait." (aanbieder en model uit de opgeslagen rij). Staat er wel een rij maar is hij niet actief, dan "Opgeslagen: aanbieder, model." Zonder rij: "Nog geen platform-rij; die stel je hieronder in." of, zonder database, "Nog geen platform-rij; instellen vraagt een database."
- "Trede 3 · Omgeving": actief toont aanbieder en model uit de omgevingsvariabelen met "Dit is wat er draait." Niet actief maar wel ingesteld: "LLM_PROVIDER staat hier op [aanbieder]. Vangnet, geen keuze." Niet ingesteld: "LLM_PROVIDER en LLM_MODEL, hier niet gezet. Vangnet, geen keuze."
- "Trede 4 · Mock": actief toont "mock, model mock-v1: de AI-functies geven nepantwoorden, maar zwijgen nooit." Anders "Geen werkende configuratie: nepantwoorden, maar nooit stil."

Is de geldende configuratie kapot, dan staat onder de kaarten een rode regel met de reden (zie Regels en berekeningen). Onderaan het blok staat een vaste voetnoot: dit is de stand van de HQ-site; de klantapp draait op een eigen omgeving en controleer je via /api/config/status op de klantsite (een link als de HQ-site het adres van de klantapp kent). Mist de klantsite CALENDAR_TOKEN_SECRET, dan draait de AI daar op mock terwijl deze keten gezond staat; onder "versleuteling" hoort "secret_set" daar true te zijn.

Alle gegevens in dit blok komen uit één aanroep van GET /api/superuser/llm-connector, uit het veld geldendHier: de stand zoals de server hem werkelijk oplost, niet wat er toevallig in een rij staat. Tijdens het laden staat er "Keten laden…", bij een fout de foutmelding van de server of "De keten is niet op te halen."

![Detail van de oplosketen: vier treden, de actieve trede met dikke rand](shots/llm-2-oplosketen.png)

### Blok "Platform-standaard"

Kop "Platform-standaard" met rechts "geldt voor elke organisatie zonder eigen rij; sleutels worden versleuteld opgeslagen". In het blok staat het connectorpaneel. Bovenaan een standregel:

- met een opgeslagen rij: "Platform-standaard: Claude (Anthropic)" gevolgd door de modelnaam in een grijs label;
- zonder rij: "Nog geen platform-standaard. Nu geldt de omgevingsinstelling van de server:" met aanbieder en model.

Daaronder, alleen als het nodig is, rode waarschuwingen: "Let op: wat hierboven staat is niet wat DealDrive HQ oplost." met de reden (de opgeslagen rij is onbruikbaar), "De omgevingsinstelling van de server klopt niet, dus die terugval draait op mock: …", "Er is geen database gekoppeld; de connector is hier niet in te stellen." en "Versleuteling is niet geconfigureerd (CALENDAR_TOKEN_SECRET ontbreekt). Sleutels kunnen nu niet veilig worden opgeslagen."

Met een database volgt het formulier met "Provider", "Model", eventueel "Basis-URL", "API-sleutel" en de knoppen "Opslaan", "Test verbinding" en "Terug naar omgevingsinstelling" (dat laatste alleen als er een platform-rij is). Het formulier staat beschreven onder Flyouts, vensters en knoppen.

![Het platformpaneel in de mock: geen database, dus geen formulier](shots/llm-3-platform-standaard.png)

### Blok "Wat werkt waarop"

Kop "Wat werkt waarop" met rechts "niet alles kan bij elke aanbieder". Een vaste tabel; hij beschrijft de code en wordt niet berekend.

| Functie | Claude | OpenAI | Gemini | Eigen endpoint |
|---|---|---|---|---|
| Chat, briefings, accountplannen, analyses | ja | ja | ja | ja |
| Opzoekingen in het eigen CRM tijdens de chat | ja | ja | ja | geprobeerd |
| Webresearch van Dex en de motor | ja | nee | nee | nee |

"ja" is een groen label, "geprobeerd" oranje, "nee" rood. Onder de tabel twee notities met een gele rand links. De eerste, "Die ene rij vol nee is een keuze, geen tekortkoming.", legt uit dat alleen Anthropic de gevonden zoekresultaten los van de citaten teruggeeft met letterlijke brontekst, dat de controle op verzonnen bronnen daaraan hangt, en dat een organisatie op een andere aanbieder voor webresearch de Claude-sleutel van het platform of de omgeving gebruikt. De tweede, "Nieuwe aanbieder aansluiten.", staat er alleen met een database en zegt dat je met "Eigen endpoint (OpenAI-compatibel)" plus basis-URL en sleutel zonder codewijziging aansluit op Azure OpenAI, Mistral, Groq, DeepSeek of een lokaal model.

![Onderkant van de pagina: de matrix Wat werkt waarop met de toelichting](shots/llm-4-wat-werkt-waarop.png)

### Het blok "LLM-connector" in de organisatie-flyout

In de organisatie-flyout op "Klanten" staat het vierde blok "LLM-connector", tussen "Gebruikers" en "Agent-prompts". Het toont hetzelfde paneel in de organisatieweergave. De standregel luidt dan "Eigen instelling: [aanbieder] [model]", "Volgt de platform-standaard: [aanbieder] [model]" of "Volgt de platform-standaard. Die is nog niet ingesteld, dus geldt de omgevingsconfiguratie van de server."

Daaronder staat altijd een duiding die begint met "Gemeten op DealDrive HQ: hier geldt …" (bijvoorbeeld "Claude (Anthropic) claude-sonnet-5 (de platform-standaard)"), met de waarschuwing dat dit niet zegt wat de verkoper krijgt, omdat de klantapp een eigen site met eigen variabelen is, en een verwijzing naar /api/config/status op de klantsite. Die duiding staat er bewust ook als alles klopt: het gevaarlijke geval (HQ heeft het versleutelgeheim wel, de klantsite niet) is vanuit HQ niet te meten.

Heeft de klant geen eigen rij, dan zie je eerst alleen de knop "Eigen provider instellen". Pas na die klik verschijnt het formulier, voorgevuld met aanbieder en model van de platform-standaard maar zonder sleutel.

In de mock is dit blok niet te zien: zonder database kun je geen klant aanmaken ("Zonder database is organisaties aanmaken niet mogelijk.") en is de klantenlijst leeg. De beschrijving hier komt uit de code.

## Doorklikken: de stappen

1. **De platform-standaard voor het eerst instellen.** Open "LLM-connector". Kies bij "Provider" een aanbieder; het modelveld springt naar het aanbevolen model van die aanbieder. Kies een model of "Eigen modelnaam…" en typ de naam. Plak de sleutel in "API-sleutel" en klik "Opslaan". De knop toont "Bezig…", daarna verschijnt even "Opgeslagen" (2,5 seconde), het sleutelveld wordt leeg en de placeholder toont het gemaskeerde voorproefje. Trede 2 in de keten wordt actief na herladen van de pagina.
2. **Van model wisselen zonder de sleutel opnieuw te plakken.** Kies in "Model" een ander model van dezelfde aanbieder, laat "API-sleutel" leeg en klik "Opslaan". De bestaande versleutelde sleutel blijft staan. Wissel je van aanbieder, dan weigert de server zonder nieuwe sleutel: "Vul de API-sleutel in: bij een providerwissel gaat de oude sleutel niet mee."
3. **Een klant een eigen aanbieder of sleutel geven.** Ga naar "Klanten", open de klant en scrol naar het blok "LLM-connector". Klik "Eigen provider instellen", pas aanbieder en model aan, plak de sleutel van de klant en klik "Opslaan". De standregel wordt "Eigen instelling: …". Vanaf dat moment wint deze rij voor die klant van de platform-standaard, binnen een minuut ook in de klantapp. Wil je toch niet, dan sluit "Annuleren" het formulier zolang er nog niets is opgeslagen.
4. **Een klant terugzetten op het platform.** Klik in het blok van de klant op "Platform volgen". De rij met de versleutelde sleutel wordt direct verwijderd, zonder bevestigingsvraag; de standregel wordt "Volgt de platform-standaard: …".
5. **Een verbinding testen.** Klik "Test verbinding". Met een getypte sleutel test de server precies wat er in het formulier staat; zonder getypte sleutel test hij de configuratie die nu werkelijk geldt (voor de klant of het platform), met haar eigen aanbieder, model en basis-URL. De uitslag verschijnt onder de knoppen: "Verbinding werkt: [model] antwoordde in [n] ms." of een rode foutregel. Dit doet een echte, betaalde aanroep; in deze beschrijving is de knop daarom niet gebruikt.
6. **Terug naar de omgevingsinstelling.** Klik op de platform-pagina "Terug naar omgevingsinstelling". De platform-rij en de sleutel worden gewist, zonder bevestiging. Daarna geldt trede 3 (de omgevingsvariabelen) of, zonder die, mock.

## Flyouts, vensters en knoppen

Het scherm heeft geen flyouts of vensters; alles staat in het paneel zelf. Het paneel is in beide weergaven hetzelfde formulier.

### Het formulier

| Veld | Soort | Verplicht | Standaard en gedrag |
|---|---|---|---|
| "Provider" | keuzelijst | ja | "Claude (Anthropic)"; bij een opgeslagen rij de aanbieder daarvan |
| "Model" | keuzelijst plus vrij veld | ja | aanbevolen model van de aanbieder; laatste optie "Eigen modelnaam…" opent een tekstveld |
| "Basis-URL" | tekstveld | alleen bij eigen endpoint | placeholder "https://api.voorbeeld.nl/v1"; moet met http:// of https:// beginnen |
| "API-sleutel" | wachtwoordveld | eerste keer en bij aanbiederwissel | nooit voorgevuld; leeg laten is behouden |

Onder "Provider" staat de uitlegtekst van de gekozen aanbieder. Wissel je van aanbieder, dan springt het model naar het standaardmodel van de nieuwe aanbieder, tenzij het huidige model al in diens lijst staat; een eerdere testuitslag verdwijnt. De placeholder van het sleutelveld heeft drie standen: "plak hier de API-sleutel" (niets opgeslagen), de eerste vier tekens gevolgd door vier bolletjes en "(n tekens) · leeg laten om te behouden" (opgeslagen en leesbaar), en "de opgeslagen sleutel is onleesbaar, plak hier een nieuwe" (opgeslagen maar niet te ontsleutelen).

### Modellen in de keuzelijst

De lijst staat in shared/llmProviders.ts, met peildatum 22 augustus 2026. Per aanbieder loopt hij van vlaggenschip via werkpaard naar snel en goedkoop.

| Aanbieder | Vooringevuld | Overige keuzes |
|---|---|---|
| Claude (Anthropic) | claude-sonnet-5 | claude-opus-5, claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5 |
| OpenAI (GPT) | gpt-5.6-terra | gpt-5.6-sol, gpt-5.6-luna, gpt-5.1, gpt-5-mini, gpt-5-nano, o3, o4-mini, gpt-4o-mini |
| Google Gemini | gemini-2.5-flash | gemini-3.1-pro-preview, gemini-2.5-pro, gemini-3.6-flash, gemini-2.5-flash-lite |
| Eigen endpoint (OpenAI-compatibel) | geen | geen lijst, alleen vrije invoer |

Labels dragen de klasse en waar bekend de uitzetdatum, bijvoorbeeld "o4-mini · redeneermodel (stopt 23 okt 2026)" en "gpt-5-mini · vorige generatie (stopt 11 dec 2026)". De uitleg bij Gemini waarschuwt dat het introtarief van 3.6 Flash tot en met 31 december 2026 loopt en daarna verdubbelt. De code zegt zelf dat deze lijst stil veroudert: een model dat de aanbieder uitzet, blijft staan en geeft dan een mislukte aanroep.

### Knoppen

- "Opslaan": stuurt aanbieder, model, basis-URL en sleutel naar de server (PUT). Tijdens het opslaan "Bezig…", daarna "Opgeslagen" in groen naast de knoppen en een verse lading van het paneel. Een weigering verschijnt als rode regel onder de knoppen.
- "Test verbinding": tijdens de aanroep "Testen…". Zie stap 5 en Regels en berekeningen.
- "Annuleren": alleen in de klantweergave, zolang de klant nog geen eigen rij heeft en het formulier open staat.
- "Platform volgen" (klant) of "Terug naar omgevingsinstelling" (platform): alleen als er een rij is. Verwijdert de rij zonder bevestiging.

Alle knoppen zijn uitgeschakeld zolang een andere actie loopt. Er zijn geen toasts buiten de groene regel "Opgeslagen", geen bevestigingsvensters en geen gedrag op Escape.

Filters, zoeken, sorteren en weergaven zijn niet van toepassing: de pagina toont één configuratie en geen lijst.

## Regels en berekeningen

### De oplosketen

Bij elke AI-aanroep bepaalt de functie resolveLlmInstellingen welke configuratie geldt. De eerste treffer wint:

1. de eigen rij van de organisatie in llm_connections;
2. de rij van de systeem-organisatie (de platform-standaard uit HQ);
3. de omgevingsvariabelen LLM_PROVIDER, LLM_MODEL en de sleutel van die aanbieder (ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY of GOOGLE_API_KEY, LLM_API_KEY plus LLM_BASE_URL voor een eigen endpoint);
4. mock, met model mock-v1: nepantwoorden zonder kosten.

Daar gaat één noodrem aan vooraf: staat LLM_PROVIDER in de omgeving letterlijk op mock, dan wint mock van alles, ook van opgeslagen rijen. Dat is de afspraak waar ontwikkeling en geautomatiseerde tests op leunen: mock betekent nooit betaalde aanroepen. Is de database onleesbaar, dan valt de keten terug op de omgeving, zodat een databasestoring de AI niet platlegt.

### Een kapotte rij valt niet door

Een rij die er wel staat maar niet deugt, valt bewust niet door naar de volgende trede. De klant krijgt dan mock met een leesbare reden (configFout), die de keten op /admin/llm en de testknop tonen. Doorvallen zou de klant ongemerkt op een andere aanbieder, een ander model en een ander tarief zetten dan HQ toont. De redenen, met hun letterlijke boodschap ingekort:

- onbekende aanbieder: "… noemt een provider die deze versie van DealDrive niet kent". Realistisch als HQ al een nieuwe aanbieder kent en de klantapp nog niet is bijgewerkt;
- sleutel niet te ontsleutelen met het huidige geheim: "Waarschijnlijk is dat geheim gewisseld … Voer de API-sleutel opnieuw in bij DealDrive HQ.";
- versleutelgeheim ontbreekt op die site: "CALENDAR_TOKEN_SECRET ontbreekt in deze omgeving. Zet die variabele op elke site waar DealDrive draait, overal met dezelfde waarde.";
- geen sleutel (behalve bij een eigen endpoint, dat sleutelloos lokaal mag zijn);
- eigen endpoint zonder basis-URL;
- geen modelnaam;
- model en aanbieder botsen, bijvoorbeeld aanbieder OpenAI met een model dat met claude begint.

Dezelfde fout wordt maar één keer in het serverlog gezet, niet bij elke aanroep.

### Samenhang van aanbieder en model

Het modelveld is vrije invoer, zodat een net uitgebracht model zonder release bruikbaar is. Daarom herkent de code de overduidelijke gevallen aan het begin van de naam: claude hoort bij Anthropic, gpt of o gevolgd door een cijfer bij OpenAI, gemini bij Google. Een naam die nergens op wijst krijgt geen oordeel. Bij een eigen endpoint is er nooit een botsing. Opslaan van een botsende combinatie wordt hard geweigerd met bijvoorbeeld: "claude-sonnet-5 is een model van Claude (Anthropic), maar de provider staat op OpenAI (GPT). Zet het model op bijvoorbeeld gpt-5.6-terra, of kies Claude (Anthropic) als provider." De reden voor weigeren in plaats van waarschuwen: de lezer zou zo'n rij meteen op mock zetten, dus opslaan zou de AI uitzetten.

### Validatie bij opslaan

De server (PUT op /api/superuser/llm-connector of /api/superuser/organisations/[id]/llm) controleert in deze volgorde: rol superuser; een database ("Geen database gekoppeld: de connector kan niet worden bewaard.", 503); het versleutelgeheim ("Versleuteling is niet geconfigureerd (CALENDAR_TOKEN_SECRET ontbreekt in de omgeving).", 503); een bekende aanbieder ("Onbekende provider."); een model, met het standaardmodel als invulling bij een leeg veld ("Vul een modelnaam in." als ook dat leeg is); een geldige basis-URL bij een eigen endpoint ("Vul een geldige basis-URL in (https://…)."); de samenhang van model en aanbieder; en een sleutel bij de eerste keer of bij een aanbiederwissel ("Vul de API-sleutel in."). De klantroute weigert bovendien de systeem-organisatie als doel ("Ongeldige organisatie.").

### Hoe sleutels beveiligd worden

- De sleutel komt één keer in klare tekst binnen, over een versleutelde verbinding, en wordt direct versleuteld met AES-256-GCM. De sleutel daarvoor is de SHA-256 van het omgevingsgeheim CALENDAR_TOKEN_SECRET, hetzelfde geheim dat de agenda-koppelingen beschermt. Elke versleuteling krijgt een verse willekeurige startwaarde van 12 bytes; het opslagformaat is v1, startwaarde, controlecode en geheimtekst, gescheiden door dubbele punten. Het versienummer maakt een latere wissel van sleutel of algoritme mogelijk.
- Zonder geheim weigert de server op te slaan. Er is bewust geen standaardsleutel: dan zou versleuteld een schijnzekerheid zijn die iedereen met de broncode kan openen.
- De sleutel staat in een eigen kolom (geheim_versleuteld) in een eigen tabel, niet in org_settings of in de organisatiegegevens. Die twee gaan integraal naar de browser van elke ingelogde gebruiker.
- Leesroutes geven nooit de sleutel terug, alleen een voorproefje: of hij er is, de lengte en de eerste vier tekens. De testroute geeft de sleutel ook nooit terug.
- Een bestaande sleutel verhuist nooit mee naar een andere aanbieder: bij een aanbiederwissel moet je een nieuwe plakken, zodat een Claude-sleutel nooit ongemerkt naar een ander adres gaat.
- De testknop kent twee strikt gescheiden smaken. Met een getypte sleutel test hij precies het formulier. Zonder getypte sleutel test hij de opgeslagen configuratie als geheel en negeert hij aanbieder, model en basis-URL uit het formulier. Zo is een opgeslagen sleutel nooit te combineren met een door de gebruiker gekozen adres, wat de sleutel naar een vreemd eindpunt zou sturen.
- Wissel je het geheim, dan zijn alle opgeslagen sleutels onleesbaar en draait de AI op mock met de melding om de sleutel opnieuw in te voeren. Er lekt dan niets.

Twee kanttekeningen uit de code. De statuspagina /api/config/status toont sinds kort geen eerste vier tekens meer maar een vingerafdruk van acht tekens, met als reden dat vier tekens plus de lengte een sleutel herkenbaar maken. Het HQ-paneel toont nog wel de eerste vier tekens, terwijl het commentaar bij de leesroute beweert dat het hetzelfde patroon volgt als de statuspagina. Dat loopt dus uit de pas. Daarnaast kent de tabel een status "verbroken" (volgens het schema: de laatste testaanroep faalde) en een kolom laatste_fout, maar geen enkele route zet die; opslaan maakt de status altijd "actief" en de fout leeg, en het paneel toont ze niet.

### De testknop

POST /api/superuser/llm-connector/test stuurt één echte aanroep met de vraag "Antwoord met exact: OK" en een antwoordbudget van 512 tokens. Twintig tokens bleek te weinig: bij de redeneermodellen van OpenAI en de Gemini 2.5-modellen tellen denk-tokens mee, en dan kwam er een leeg antwoord terug dat als geslaagd gold. Een leeg antwoord telt nu als mislukt, met de uitleg dat het budget opraakte of het model stopte, en het advies de modelnaam te controleren. Een fout van de aanbieder komt terug als "Testaanroep mislukt: …", ingekort tot 300 tekens. Geldt er geen echte aanbieder, dan: "Er geldt nu geen echte provider (mock). Typ een sleutel om een nieuwe configuratie te testen." met de reden erachter.

Elke echte testaanroep, geslaagd of niet, komt als soort "verbindingstest" in het kostenlogboek agent_runs: de platformtest onder de systeem-organisatie, de test vanuit de klantflyout onder die klant. Bij een fout blijven de tokentellers leeg in plaats van nul, zodat de regel niet als gratis leest. Deze soort telt niet mee in de AI-bundel van de klant.

### Tussengeheugen en doorwerking

De opgeloste configuratie wordt per organisatie een minuut (60.000 ms) bewaard, zodat niet elke AI-aanroep de database leest. Na opslaan of verwijderen wordt dat tussengeheugen in het HQ-proces geleegd. De klantapp is een apart proces en pakt een wijziging uit HQ dus binnen een minuut op.

### Webresearch blijft Claude

Webresearch (de web-beoordeling van de motor en het webonderzoek van Dex) gaat altijd naar Anthropic. De functie resolveAnthropicSleutel zoekt daarvoor de eerste Claude-sleutel in de keten: eerst de geldende configuratie van de klant, dan de platform-rij, dan de omgeving. Een klant die voor de chat op Gemini draait, gebruikt voor webresearch dus de Claude-sleutel van het platform. Is de geldende rij kapot, dan stopt dat zoeken: geen webresearch, in plaats van stil een andere sleutel. Staat er een niet-Claude-model in de gevonden rij, dan gebruikt deze route claude-sonnet-5 en meldt dat één keer in het log.

### Wat de klantapp ermee doet

Elke generatie in de klantapp loopt via drie functies die allemaal resolveLlmInstellingen aanroepen met de organisatie van de ingelogde gebruiker: llmTekstAanroep voor vrije tekst (Pitstop-concepten), llmGestructureerdeAanroep voor uitvoer met een vast schema (briefing, accountplan, verslag-analyse, oordeel van de motor) en chatMetGereedschap voor de chat met CRM-opzoekingen. Geeft de keten mock, dan valt elke functie terug op haar eigen voorbeelduitvoer. Kan het model achter een eigen endpoint geen functieaanroepen, dan antwoordt de chat zonder opzoekingen. Elke aanroep komt in agent_runs met aanbieder, model en tokens, en voedt zo het blok "AI-kosten" in HQ.

### Scheiding tussen HQ en klantapp

HQ en de klantapp zijn twee sites uit dezelfde code, elk met eigen omgevingsvariabelen. De HQ-build bevat alleen de routes onder /admin, /login en /wachtwoord-instellen plus een vaste lijst serverroutes; de klantbuild bevat de /api/superuser-routes niet eens. Daarom heet het veld geldendHier: het is de stand op de HQ-site. Mist de klantsite het versleutelgeheim, dan staat HQ op groen terwijl de verkoper op mock zit. Het paneel zegt dat bij elke stand en verwijst naar /api/config/status op de klantsite, waar een beheerder onder "versleuteling" kan zien of "secret_set" true is.

### Wat de mock laat zien

De HQ-mock op localhost:3096 draait zonder database. Daardoor staat trede 3 "Omgeving" actief (in deze mock met Claude en claude-haiku-4-5, omdat de omgeving daar een sleutel heeft), meldt het paneel "Er is geen database gekoppeld; de connector is hier niet in te stellen." en ontbreekt het formulier met alle knoppen. Ook de notitie "Nieuwe aanbieder aansluiten." staat er dan niet. In productie, met database, zie je het volledige formulier.

## Gegevens

Eén record per organisatie in de tabel llm_connections, met de organisatie als sleutel. De rij van de systeem-organisatie (vaste id __dealdrive-systeem__) is de platform-standaard.

| Veld | Betekenis |
|---|---|
| organisatie (organisation_id) | de klant, of de systeem-organisatie voor het platform; uniek |
| aanbieder (provider) | anthropic, openai, gemini of custom |
| model (model) | de letterlijke modelnaam van de aanbieder |
| instellingen (instellingen) | niet-geheime instellingen; alleen de basis-URL bij een eigen endpoint |
| versleutelde sleutel (geheim_versleuteld) | de sleutel in het formaat v1 met startwaarde, controlecode en geheimtekst |
| status (status) | actief of verbroken; in de praktijk altijd actief |
| laatste fout (laatste_fout) | bedoeld voor de laatste testfout; wordt niet gevuld |
| aangemaakt en bijgewerkt (created_at, updated_at) | tijdstempels |

Er wordt niet vastgelegd wie de rij heeft gewijzigd, en er is geen geschiedenis: opslaan overschrijft de rij, verwijderen wist hem. Wat er van andere features komt: het kostenlogboek agent_runs (soort verbindingstest), de omgevingsvariabelen van elke site en het versleutelgeheim dat met de agenda-koppeling gedeeld wordt.

## Wat dit betekent voor Dealtrace

- Neem de oplosketen per organisatie, dan platform, dan omgeving, dan mock over, inclusief de regel dat een kapotte rij niet stil doorvalt maar zichtbaar op mock gaat met een leesbare reden. Dat voorkomt dat een klant maandenlang op een ander model en tarief draait dan je denkt.
- Neem de sleutelbehandeling over: schrijf-alleen veld, versleuteld met een eigen geheim, nooit terug naar de browser, en geen sleutel die meeverhuist bij een aanbiederwissel. Gebruik voor Dealtrace wel een eigen geheim per doel in plaats van het agendageheim te delen, en toon een vingerafdruk in plaats van de eerste vier tekens.
- Leg wijzigingen vast: wie welke aanbieder en welk model wanneer zette, met geschiedenis. DealDrive heeft dat niet, en bij een kostensprong of kwaliteitsklacht wil je kunnen terugzien wat er veranderde.
- Een new business-tool draait veel meer op webresearch en dataverrijking dan op chat. Maak daarom per functie (prospectonderzoek, verrijking, berichtconcepten, scoring) een eigen modelkeuze mogelijk, met per functie een kostenplafond per klant, in plaats van één model voor alles.
- Laat de testknop ook de status bijwerken (actief of verbroken) en toon de laatste fout en het tijdstip, zodat de founder storingen ziet zonder zelf te testen. In DealDrive bestaan die velden maar worden ze niet gebruikt.
- Toon de stand van de klantapp zelf in HQ, bijvoorbeeld via een beveiligde statusroute die HQ server-side opvraagt, in plaats van de founder naar een andere site te sturen.
- Leg per aanbieder vast waar de data verwerkt wordt (EU of VS) en of de aanbieder data voor training gebruikt. Bij leads en contactpersonen uit openbare bronnen en LinkedIn telt de AVG mee in de keuze van de aanbieder per klant.
- Houd de modellijst bij met een peildatum en uitzetdatums, maar waarschuw actief zodra een gekozen model binnen dertig dagen stopt, in plaats van de datum alleen in het label te zetten.
