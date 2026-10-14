# Activity selling-regels

## Wat het is en waarvoor

De Activity selling-regels zijn de regelset waarmee een organisatie vastlegt welk werk DealDrive zelf voor de accountmanager klaarzet. Elke regel is een alsdan-afspraak: als er bij een account iets waar is (een contract loopt binnen 60 dagen af, er is 45 dagen geen contact geweest, een offerte is verstuurd, een deal is gewonnen), dan maakt de motor een inzicht of een taak aan, met een prioriteit, een actiesoort (bellen, bezoek, mailen) en een uitleg waarom.

Voor de accountmanager betekent dit dat hij 's ochtends op "Inzichten" en "Taken" werk vindt dat hij niet zelf hoefde te bedenken, met het bewijs erbij. Een inzicht is een signaal om te beoordelen; met "Maak taak" in de inzicht-flyout keurt hij het goed en wordt het een taak. Een regel met activiteit "Taak" slaat die stap over en zet direct werk in de takenlijst, de bellijst of de bezoeklijst.

Voor de salesmanager en de beheerder is dit het stuurwiel van de methodiek. Hier bepaal je hoe vaak een A-klant bezocht wordt, hoe snel een offerte wordt nagebeld en welke signalen überhaupt aandacht verdienen. Op "/rapportage-activiteiten" zie je per regel wat hij opleverde. Je komt hier niet dagelijks: inrichten bij de start, bijstellen per kwartaal, en "Draai motor nu" na een wijziging om het effect te zien.

Samenhang met andere features:

- Leest: accounts (accountklasse, journeyfase, contracteinddatum, laatste order, laatste contact, laatste bezoek), offertes, deals met hun BAND-kwalificatie, campagnes, de bel- en afspraakmatrix en de offertematrix van "/instellingen/accountritme", de journeyfases van "/instellingen/customer-journey" en het pakket van de organisatie.
- Schrijft: inzichten (tabel signals), taken (tabel tasks), de cadansadministratie (tabel rule_runs) en het AI-kostenlogboek (tabel agent_runs).
- Voedt: "/inzichten" (alleen actieve regels doen mee in de feed en het bronnenfilter), "/taken", de bellijst, "/bezoeken", de Pitstop (automatisch voorbereide concepten) en "/rapportage-activiteiten".

## Waar je het vindt

- Route: "/instellingen/activity-selling". Tabtitel: "Activity Selling: inzichten-master · DealDrive".
- Menu: in de zijbalk onder het kopje "Beheer" het item "Instellingen", daarna in het blok "Sub-pagina's" de link "Activity Selling-regels →".
- Rol: alleen beheerder en superuser. De routewachter stuurt elke andere rol weg met de melding "Je hebt geen toegang tot deze pagina.". Op de server mag iedere ingelogde gebruiker de regels lezen (de motor en "/inzichten" hebben ze nodig), maar opslaan, vervangen, verwijderen, importeren, exporteren en de motor draaien vragen de beheerderrol.
- Functievlag: geen. De AI-kant van de regels hangt wel aan het pakket (Starter, Plus, Compleet), zie Regels en berekeningen.
- Andere ingangen: de knop "Customer Journey →" op deze pagina en "Open Activity Selling →" op "/instellingen/customer-journey" verwijzen naar elkaar. De verwijsregel bovenaan linkt naar "Accountritme →", waar de accountklassen, de bel- en afspraakmatrix en de offertematrix staan.

![De pagina met de regellijst links en het bewerkpaneel van regel R001 rechts](shots/regels-1-pagina.png)

## Opbouw van de pagina

### Kop

- Kruimelpad "← Alle instellingen".
- Kicker "Methodiek · Activity Selling", titel "Inzichten-master · regels voor accountmanagers".
- Subtitel: "Definieer welke inzichten verschijnen voor de accountmanager, vanuit welke bron, hoe vaak en met welk verwachte gevolg. Actieve regels bepalen wat er op Inzichten verschijnt; daar zet de accountmanager een inzicht met één klik om in een taak."
- Verwijsregel: "Accountklassen, bel- en afspraakmatrix en opvolging op orderwaarde staan bij Accountritme →".

### Tellers rechtsboven

| Teller | Wat erin staat | Bron van het getal |
|---|---|---|
| Opslagstatus | "Opslaan…", "Opgeslagen" of rood "Opslaan mislukt, alleen op dit apparaat" | stand van de laatste schrijfactie |
| "N actief" | aantal regels met de schakelaar aan | regels met enabled waar |
| "N uit" | alleen zichtbaar als er regels uit staan | totaal min actief |
| "N door de motor" | regels die de motor echt uitvoert | aan, en een triggerpatroon of motor AI |
| "N totaal" | alle regels | lengte van de regelset |

De teller "door de motor" is bewust toegevoegd: de standaardset telt 37 groene schakelaars maar geen enkele regel heeft een triggerpatroon, dus de kop toont "37 actief" naast "0 door de motor". De tooltip zegt: "Alleen regels met een triggerpatroon (of de AI-motor) voert de motor zelf uit; de rest stuurt alleen de inzichtenfeed."

### Filter- en actiebalk

De balk blijft bovenaan staan als je scrolt. Links staan het zoekveld "Zoek regel…" en drie keuzelijsten ("Alle categorieën", "Beide bronnen", "Alle journey-fases"). Rechts staan zes knoppen: "▶ Draai motor nu", "Customer Journey →", "↓ Exporteren", "↑ Importeren", "Back-up" en "Standaardset terugzetten".

### Regellijst (links, 360 pixels breed)

- Kop "Regels" met de telling "X van Y aan · Z met trigger" en de knop "+ Regel".
- Per rij: een aan/uit-schakelaar, een kicker met de categorie (bij de standaardset gevolgd door het id, bijvoorbeeld "Contactmomenten · R001"), de naam (de subcategorie, of "(zonder subcategorie)"), het label "motor" als de motor deze regel uitvoert, en rechts een gekleurde stip voor de prioriteit.
- Eigen regels krijgen een willekeurig id dat niet als kicker in beeld komt; alleen ids van de vorm R plus drie cijfers worden getoond.
- De gekozen regel heeft een gele rand links; een uitgezette regel is grijs.
- Onderaan een legenda: Kritiek, Hoog, Midden, Laag.
- Lege staat zonder regels: "Nog geen regels. Maak er één met + Regel of haal de standaardset terug via Standaardset terugzetten."
- Lege staat door een filter: "Geen regels in deze filter." met de knop "Filter wissen".

### Bewerkpaneel (rechts)

Het paneel toont alle velden van de gekozen regel, in drie blokken. Bij openen is de eerste regel gekozen. Elk veld heeft een knop ⓘ die een uitleg voor de beheerder openklapt; meerdere uitleggen mogen tegelijk open staan. Onder 900 pixels breedte schuift het paneel onder de lijst.

Paneelkop: het id (alleen bij de standaardset), de naam, de schakelaar met "Actief" of "Uit", een ⓘ en de knop "Verwijderen".

| Blok | Veld | Invoer | Standaard en opmerkingen |
|---|---|---|---|
| Wat & wanneer | "Categorie" | keuzelijst, 38 categorieën | waarde buiten de lijst blijft kiesbaar met "(eigen)" |
| Wat & wanneer | "Subcategorie" | keuzelijst per categorie | 232 subcategorieën in totaal |
| Wat & wanneer | "Omschrijving (taakvoorbeeld)" | tekstvak | placeholder "bv. Bel binnen 24u…" |
| Wat & wanneer | "Activiteit" | "Inzicht" of "Taak" | standaard Inzicht |
| Wat & wanneer | "Cadans" | 11 frequenties | bij motor AI vallen er vier af |
| Wat & wanneer | "Prioriteit" | Laag, Midden, Hoog, Kritiek | veld kleurt mee |
| Sturing | "Bron" | Intern of Extern | |
| Sturing | "Specifieke bron" | keuzelijst in drie groepen | oude waarde blijft kiesbaar met "(oud)" |
| Sturing | "Toelichting bij de aanleiding" | vrije tekst | stuurt de motor niet |
| Sturing | "Triggerpatroon (motor)" | 8 keuzes | "Geen (motor slaat over)" |
| Sturing | "Trigger-parameters" | wisselt per patroon | zie Regels en berekeningen |
| Sturing | "Journey-fase" | "Geen fase" of een fase | |
| Sturing | "Motor" | "Regel" of "AI" | standaard Regel |
| Sturing | "Accountklasse" | vinkjes A, B, C, D | geen vinkje toont "alle" |
| Gevolg | "Actiesoort" | "Uit categorie", "Bellen", "Bezoek", "Mailen", "Geen" | |
| Gevolg | "Pitstop" | vinkje "Automatisch voorbereiden" | alleen aan te zetten bij Taak |
| Gevolg | "Eigenaar / uitvoerder" | vrije tekst | placeholder "bv. Accountmanager" |
| Gevolg | "Verwachte uitkomst (vast)" | alleen lezen | wordt alleen bij aanmaken gevuld |

De groepen van "Specifieke bron" zijn: "Intern: DealDrive-data" (CRM (DealDrive), CRM/agenda, CRM/telefonie, CRM/email, CRM/order data, CRM/Contractenregister, ERP/order data, Finance), "Extern: automatisch (web-connector)" (Web: vacatures, Web: nieuws) en "Extern: handmatige check (nog niet aangesloten)" (Klantwebsite, LinkedIn, KvK, Google Alerts, Vakmedia, Beurs, Persoonlijk netwerk, Manual check).

De velden KPI en Levensfase bestaan in elke regel, maar staan niet in het paneel. Je ziet en wijzigt ze alleen via de Excel-export en -import; het zoekveld doorzoekt de KPI wel.

![Het blok Sturing met triggerpatroon Inactiviteit, de parameters Laatste contact en 30 dagen, en de opengeklapte uitleg](shots/regels-2-sturing-trigger.png)

### Live voorbeeld onderin het paneel

Onder het blok Gevolg staat "Zo verschijnt hij in de takenlijst" met de regel "Live preview, ingevuld met voorbeeldklant Bouwbedrijf De Vries.". Het kaartje toont een geel label met de actiesoort ("Uit categorie" als die leeg is), een label "Taak" of "Inzicht", de prioriteitsstip, de taaktekst en een metaregel "Accountmanager · prioriteit Hoog · cadans Maandelijks". De taaktekst volgt dezelfde volgorde als de motor: eerst het taaksjabloon, anders het taakvoorbeeld, anders "Actie voor {account}". De plaatshouders {account} en {offerte} worden ingevuld met "Bouwbedrijf De Vries" en "OFF-2026-0142". Bij motor AI staat eronder: "AI-regel: de agent schrijft de definitieve tekst per klant; dit is de terugvaltekst." Helemaal onderaan: "Wijzigingen worden per veld direct bewaard. Er is geen aparte opslaan-knop." Zonder gekozen regel staat er "Kies een regel uit de lijst om te bewerken."

![Het blok Gevolg met actiesoort Bezoek, automatisch voorbereiden aan en het live voorbeeld als taakkaart](shots/regels-4-gevolg-preview.png)

### Blok "AI-verbruik per regel"

Onder de regels staat een kostenblok, alleen zichtbaar als er AI-aanroepen gelogd zijn (of als de database de kolommen voor cachetokens mist, dan met een waarschuwing). In de mockmodus is het blok leeg en dus verborgen. Kop "AI-verbruik per regel", rechts een totaal als "≈ $0.0000" met vier decimalen, met een sterretje als er geschatte bedragen in zitten en een kruisje (†) als er aanroepen zonder modelnaam in zitten.

| Kolom | Inhoud |
|---|---|
| "Regel" en "Soort" | regel-id ("(los)" zonder regel) en het soort aanroep |
| "Model" | het gelogde model |
| "Aanroepen" en "Fouten" | aantal aanroepen en mislukte aanroepen |
| "Tokens in/uit" en "Cache lees/schrijf" | tokens, cachetokens apart |
| "Webzoek" en "≈ Kosten" | webzoekopdrachten en geschat bedrag in dollars |

De soorten zijn onder meer "Inzicht-beoordeling", "Web-beoordeling (vacatures/nieuws)", "Agent-concept", "Gespreksverslag-analyse", "Dex-gespreksvoorbereiding", "Dex-opvolgmail", "Assistent-chat" en "Verbindingstest (LLM-connector)". De tabel groepeert het logboek per regel, soort en model over de hele bewaartermijn (standaard 396 dagen), met de prijstabel van Claude, OpenAI en Gemini met peildatum 22 augustus 2026. Het blok heet "per regel", maar telt ook aanroepen mee die niets met een regel te maken hebben, zoals de assistent-chat.

### Afsluitend blok

Een donker blok "Gekoppeld aan Inzichten" met de tekst dat alleen actieve regels meedoen op Inzichten, en de knop "Open Inzichten →".

## Doorklikken: de stappen

### Een bestaande regel laten draaien in de motor

1. Klik in de lijst op de regel, bijvoorbeeld "Bezoek op locatie klant". Het paneel rechts vult zich.
2. Kies bij "Triggerpatroon (motor)" een patroon, bijvoorbeeld "Inactiviteit". Het veld "Trigger-parameters" toont meteen een keuzelijst met het datumveld ("Laatste contact") en een getal (30).
3. Pas het datumveld en de drempel aan. Elke wijziging wordt na 600 milliseconden stilte bewaard; rechtsboven verschijnt "Opslaan…" en daarna "Opgeslagen".
4. Vink bij "Accountklasse" de klassen aan waarvoor de regel geldt. Zonder vinkje raakt hij alle accounts.
5. De regel krijgt in de lijst het label "motor" en de teller "door de motor" gaat één omhoog.

![De keuzelijst van het triggerpatroon met de acht mogelijkheden](shots/regels-3-triggerpatroon-keuzelijst.png)

### Een nieuwe regel toevoegen

1. Klik op "+ Regel" in de kop van de lijst. Rechts schuift de flyout "Welke regel voeg je toe?" open.
2. Kies een categorie en een subcategorie. Bestaat die combinatie al, dan verschijnt een gele waarschuwing, bijvoorbeeld "Er is al een regel "Call na website-bezoek (intent)" in Warm calling (R035). Deze komt er als tweede naast."
3. Vul bron, cadans, prioriteit, eigenaar, verwachte uitkomst en taakvoorbeeld in en laat "Direct actief: meteen meedoen op Inzichten" aan of zet het uit.
4. Klik op "+ Regel toevoegen". De flyout sluit, de regel staat onderaan de lijst en is meteen gekozen in het paneel. Er volgt geen melding.
5. Stel in het paneel het triggerpatroon, de motor, de actiesoort en de accountklasse in; die vraagt de flyout bewust niet.

### Regels in Excel bewerken en terugzetten

1. Klik op "↓ Exporteren". De knop toont "Bezig…" en daarna download je "activity-selling-regels-JJJJ-MM-DD.xlsx", met de melding "37 regels geëxporteerd naar Excel".
2. Bewerk de werkmap in Excel. Het blad "Regels" heeft een vastgezette koprij en keuzelijsten per kolom; het blad "Toelichting" legt elke kolom uit.
3. Klik op "↑ Importeren" en kies het bestand bij "Bladeren…". De server leest het en toont hoeveel rijen bruikbaar zijn, hoeveel overgeslagen en hoeveel bestaande regels geraakt worden, met per overgeslagen rij de reden.
4. Kies "Samenvoegen" (bestaande regels blijven, gelijke ids worden overschreven) of "Alles vervangen" (de hele set wordt vervangen). De flyout sluit met de melding "N regels samengevoegd met de huidige set" of "N regels ingelezen; de vorige set is vervangen".

### De motor nu laten draaien

1. Klik op "▶ Draai motor nu". De knop toont "Motor draait…" en is zolang uitgeschakeld.
2. Na afloop verschijnt de melding "Motor klaar: X nieuwe inzichten, Y bijgewerkt, Z taken (N regels, M × cadans-skip)", aangevuld met " · AI: K beoordeeld, F fouten" als er AI-regels draaiden.
3. De app haalt meteen de verse gegevens op, zodat "/inzichten" en "/taken" kloppen zonder te herladen.
4. In de mockmodus is er geen database en verschijnt de rode melding "Geen database beschikbaar: de motor is niet gedraaid."

![De foutmelding na Draai motor nu in de mockmodus zonder database](shots/regels-8-draai-motor-toast.png)

### Een regel uitzetten of verwijderen

1. Zet de schakelaar in de lijst of in de paneelkop uit. De regel wordt grijs, blijft bestaan en zijn geschiedenis blijft in de rapportage staan.
2. Wil je hem echt weg, klik dan op "Verwijderen" in de paneelkop. Er volgt een bevestiging "Regel verwijderen?" in de rode variant.
3. Na bevestigen kiest het paneel automatisch de volgende zichtbare regel, of de vorige als het de laatste was.

## Flyouts, vensters en knoppen

### Flyout "Welke regel voeg je toe?"

- Opent met "+ Regel". Schuift van rechts in (maximaal 560 pixels breed) over een donkere achtergrond; de pagina eronder scrollt niet mee.
- Kop: kicker "Activity Selling · nieuwe regel", titel "Welke regel voeg je toe?", uitleg "De regel komt in de lijst en opent meteen in het bewerkpaneel. Triggerpatroon, motor, actiesoort en accountklasse stel je daar in."
- Velden met standaardwaarde: "Categorie" (Contactmomenten), "Subcategorie" (leeg, verplicht, "Kies een subcategorie"; wisselt de categorie en past de subcategorie niet meer, dan wordt hij leeggemaakt), "Bron" (Intern), "Specifieke bron" (CRM (DealDrive)), "Cadans / ritme" (Wekelijks), "Prioriteit" (Midden), "Eigenaar" (Accountmanager), "Verwachte uitkomst" (leeg, met de hint "Ligt na het aanmaken vast."; leeg opgeslagen wordt het "Nieuwe regel"), "Taakvoorbeeld" (leeg) en het vinkje "Direct actief: meteen meedoen op Inzichten" (aan).
- Validatie: alleen categorie en subcategorie zijn verplicht; zonder subcategorie blijft "+ Regel toevoegen" uitgeschakeld. Een dubbele combinatie geeft een waarschuwing, geen blokkade.
- Knoppen: "Annuleren" sluit zonder opslaan; "+ Regel toevoegen" (tijdens opslaan "Opslaan…") maakt de regel aan met activiteit Inzicht, motor Regel en een lege toelichting.
- Sluiten: met Escape, het kruisje of een klik naast het paneel.

![De flyout voor een nieuwe regel met de waarschuwing dat de combinatie al bestaat](shots/regels-6-nieuwe-regel.png)

### Flyout "Regels uit Excel inlezen"

- Opent met "↑ Importeren". Kicker "Activity Selling · importeren", titel "Regels uit Excel inlezen", uitleg "Je ziet eerst wat eruit komt. Er wordt niets bewaard voordat je hieronder kiest."
- Stap "1 · Kies je bestand": de knop "Bladeren…" accepteert alleen .xlsx. Eronder: "Nog geen bestand? Download het voorbeeldbestand: daar staan alle kolommen in, met uitleg en keuzelijsten." Het voorbeeldbestand ("activity-selling-import-voorbeeld.xlsx") wordt bij elk verzoek opnieuw uit dezelfde kolomtabel gebouwd en bevat twee voorbeeldregels: een ritmeregel die een taak maakt en een datumdrempelregel die een inzicht maakt.
- Tijdens lezen: "Bezig met lezen…". Foutmeldingen: "Dit bestand is geen Excel-werkmap (.xlsx). Sla het in Excel op als "Excel-werkmap" en probeer opnieuw.", een melding bij meer dan 5 MB, en bij meer dan 2000 rijen "alleen de eerste 2000 zijn gelezen".
- Stap "2 · Wat er in het bestand staat": drie cijfers "bruikbaar", "overgeslagen" en "bestaande regels geraakt", een lijst "Overgeslagen rijen" (per rij het rijnummer en de reden) en een lijst "Let op" met waarschuwingen.
- Stap "3 · Hoe wil je ze toevoegen?" met uitleg over samenvoegen en vervangen.
- Knoppen: "Samenvoegen", "Alles vervangen" (beide uitgeschakeld zolang er niets bruikbaars is) en "Annuleren". "Alles vervangen" vraagt geen extra bevestiging.
- Sluiten: Escape, kruisje of klik naast het paneel; bij opnieuw openen is de vorige uitslag weg.

![De importflyout in de beginstand met de knop Bladeren en de link naar het voorbeeldbestand](shots/regels-7-import-excel.png)

### Bevestigingen en meldingen

| Actie | Venster of melding |
|---|---|
| "Verwijderen" | bevestiging "Regel verwijderen?" (rood) |
| "Standaardset terugzetten" | venster "Standaardset terugzetten?" met "Alle regels vervangen door de standaardset? Je eigen regels gaan verloren." en de knop "Standaardset terugzetten" |
| "↓ Exporteren" | "N regels geëxporteerd naar Excel" of "De export is niet gelukt." |
| "Back-up" | download van een JSON-bestand en "N regels geëxporteerd als JSON" |
| Import toepassen | "N regels samengevoegd…", "N regels ingelezen…" of "De regels konden niet bewaard worden." |
| "▶ Draai motor nu" | "Motor klaar: …" of de reden waarom niet |

### Knop "Back-up"

"Back-up" schrijft alle regels verliesloos weg als "activity-selling-regels-JJJJ-MM-DD.json" (met versie, exportdatum, aantal en de regels zelf). De tooltip belooft "om later terug te zetten", maar de pagina heeft geen knop om een JSON-bestand terug te lezen: de importflyout accepteert alleen .xlsx. Terugzetten kan dus alleen buiten het scherm om.

## Filters, zoeken, sorteren en weergaven

- "Zoek regel…": zoekt hoofdletterongevoelig in id, categorie, subcategorie, specifieke bron, KPI, eigenaar, taakvoorbeeld en verwachte uitkomst. De tooltip noemt alleen subcategorie, KPI en taakvoorbeeld.
- "Alle categorieën": de 38 categorieën uit de catalogus.
- "Beide bronnen": Intern of Extern.
- "Alle journey-fases": "Zonder fase" (regels zonder journeyfase) of een fase uit "/instellingen/customer-journey".
- Combinaties: alle filters werken tegelijk (en-voorwaarde).
- Reset: de knop "Filter wissen" verschijnt alleen in de lege staat en zet alle vier terug.
- Sorteren: er is geen sortering; de lijst volgt de volgorde van de regelset (nieuwe regels onderaan).
- URL: filters komen niet in de URL en zijn na herladen weg.
- Tellers: "X van Y aan · Z met trigger" in de lijstkop telt de hele set, niet de gefilterde rijen.
- Het paneel leest uit de hele set, zodat een nieuwe regel die buiten het filter valt toch bewerkbaar blijft.

![De keuzelijst van het journeyfasefilter, opengeklapt](shots/regels-5-filter-journeyfase.png)

## Regels en berekeningen

### Wanneer de motor draait

- Elk uur automatisch: een geplande Netlify-functie roept per organisatie de motor aan (alleen op de HQ-site, beveiligd met een gedeeld geheim).
- Op verzoek: "▶ Draai motor nu" draait de geplande run voor de eigen organisatie.
- Direct bij een gebeurtenis: zodra de app een journeygebeurtenis meldt (een afspraak ingepland, een deal op gewonnen of verloren gezet) draaien de gebeurtenisregels voor dat ene account.
- Open sessies zien nieuwe inzichten volgens het handboek binnen ongeveer 3 minuten.

### Welke regels meedoen

Een regel doet mee als de schakelaar aan staat en hij niet gepauzeerd is. Een deterministische regel draait alleen met een triggerpatroon; zonder patroon slaat de motor hem over en stuurt hij alleen de inzichtenfeed. Een AI-regel heeft geen patroon nodig. Regels met de oude doelgroep "kandidaat" uit de verwijderde recruitmentmodule worden overal weggefilterd.

Afbakening per account: zijn er accountklassen aangevinkt, dan moet de klasse van het account erin staan (een account zonder klasse valt dan af). Is er een journeyfase gekozen, dan moet het account precies in die fase staan.

### De triggerpatronen

| Patroon | Vuurt als | Parameters en standaard | Onderwerp |
|---|---|---|---|
| Datum-drempel | datum ligt 0 tot N dagen in de toekomst | veld (standaard contracteinddatum), 60 dagen | account |
| Inactiviteit | datum ligt N dagen of meer in het verleden | veld (standaard laatste contact), 30 dagen | account |
| Ritme | altijd, de cadans is de enige poort | geen ("volgt cadans") | account |
| Gebeurtenis | journeygebeurtenis of fase betreden | gebeurtenis (standaard "Fase betreden (startset)") | account |
| Campagne-achterstand | actieve campagne ligt N procentpunten achter | marge 10, bereik 1 tot 100 | campagne |
| Offerte verstuurd | offerte staat op verstuurd, niet ouder dan 30 dagen | werkdagen tot bellen, 3, bereik 1 tot 20 | offerte |
| Deal onvoldoende gekwalificeerd | open deal vanaf bedrag, ouder dan N dagen, BAND 1 of 0 | €10.000 en 14 dagen | deal |

De datumvelden zijn "Contract-einddatum" (alleen bij datum-drempel), "Laatste bestelling", "Laatste contact" en "Laatste bezoek". Een account zonder die datum levert nooit een treffer op: een inactiviteitsregel op "Laatste contact" doet dus niets bij een nieuwe prospect die nog nooit gesproken is. De gebeurtenissen zijn "Fase betreden (startset)", "Eerste afspraak gepland", "Deal gewonnen", "Deal verloren", "Eerste order", "Contract getekend" en "Contract verlengd". Van die zes worden er in de app maar drie echt gemeld: eerste afspraak gepland, deal gewonnen en deal verloren (zie het hoofdstuk Prospectreis).

### Cadans en de poortwachter

De cadans bepaalt hoe vaak dezelfde regel voor hetzelfde onderwerp opnieuw mag vuren. De motor bewaart per regel en onderwerp het moment van het laatste resultaat (tabel rule_runs) en slaat over zolang de cadans niet verstreken is; dat telt als "cadans-skip".

| Cadans | Dagen | Cadans | Dagen |
|---|---|---|---|
| Dagelijks | 1 | Maandelijks | 30 |
| 2 dagen | 2 | 2 maanden | 61 |
| 3 dagen | 3 | Kwartaal | 91 |
| Wekelijks | 7 | Half jaar | 182 |
| 2 weken | 14 | Jaarlijks | 365 |
| Continu | 1 | onbekend | 7 |

Offertes en deals zijn eenmalig: één offerte krijgt hooguit één opvolging en één deal hooguit één BAND-inzicht, wat de cadans ook zegt. Bij offertes telt daarnaast een openstaande opvolgtaak (bellen, mailen of bezoek) als slot, ook als iemand die zelf maakte.

### Ritmeregels en de matrices

Bij een ritmeregel kan de inrichting op "/instellingen/accountritme" de cadans overrulen. Met actiesoort Bellen leest de motor de belmatrix (per accounttype klant of prospect en per klasse), met actiesoort Bezoek de bezoekrij van de afspraakmatrix. Het aantal keer per jaar wordt een interval van 365 gedeeld door dat aantal, afgerond, minimaal 1 dag. Staat er 0, dan is het ritme voor die klasse uit en komt er geen taak. Heeft het account geen klasse of zwijgt de matrix, dan geldt de cadans van de regel. De taak legt dat uit, bijvoorbeeld "Terugkerend volgens belmatrix (prospect, klasse B): 12× per jaar (interval 30 dagen, in plaats van regelcadans Kwartaal)". Standaard belt de matrix een prospect A of B maandelijks, C per kwartaal en D per halfjaar.

### Wat de motor aanmaakt

- Activiteit Taak: titel uit het taaksjabloon, anders het taakvoorbeeld, anders "Actie voor {account}"; vervaldatum altijd 7 dagen na de run; prioriteit Kritiek wordt urgent, Hoog high, Midden medium, Laag low; eigenaar is de accounteigenaar, anders de beheerder; het taaktype volgt de actiesoort (Bezoek wordt afspraak, Bellen call, Mailen mail, anders to-do).
- Activiteit Inzicht: titel "subcategorie · accountnaam", de reden als tekst, relevantie 90 bij Kritiek, 80 bij Hoog en 65 voor de rest, zekerheid 100, het bronveld met waarde als bewijs, en een taakvoorstel als er een sjabloon of taakvoorbeeld is. Staat er al een open inzicht (nieuw of gelezen) van deze regel voor dit account, dan wordt dat bijgewerkt in plaats van verdubbeld.
- Uitzonderingen: offerte verstuurd levert altijd een taak, ook als de regel Inzicht zegt; AI-regels leveren altijd een inzicht.
- Offerteopvolging: het bedrag kiest via de offertematrix het kanaal en de uitvoerderrol; een offerte die als contract herkend wordt gaat altijd face-to-face; de vervaldatum is verstuurdatum plus N werkdagen (weekend telt niet, feestdagen wel).
- Lopend accountplan: alles wat de motor maakt, krijgt het id van het accountplan dat op dat moment loopt.

### Actiesoort en categorie

Het veld "Actiesoort" bepaalt in welke lijst het werk landt en welk concept de agent voorbereidt. Staat het op "Uit categorie", dan leidt de motor de actiesoort af uit de categorienaam, en dat doet hij maar voor één categorie: "Bezoek" wordt bezoek, alle andere leveren geen actiesoort. "Geen" zet de afleiding expliciet uit.

### AI-regels

- Pakket: Starter draait alleen de deterministische motor; Plus voegt AI-inzichten en automatisch voorbereiden toe; Compleet voegt de webbronnen toe ("Web: vacatures" en "Web: nieuws"). Wat het pakket niet dekt wordt overgeslagen en geteld.
- Maandplafond: staat het plafond van de klant op geblokkeerd, dan slaat de motor het automatische AI-werk over; de assistent, de Pitstop en Dex blijven werken.
- Kostenrem: een AI-regel beoordeelt een account nooit vaker dan eens per 7 dagen, ongeacht de cadans; daarom verdwijnen "Dagelijks", "2 dagen", "3 dagen" en "Continu" uit de keuzelijst zodra je "AI" kiest, en springt een te snelle cadans naar "Wekelijks". Per regel worden per run maximaal 25 accounts beoordeeld; de rest volgt later.
- Werkwijze: eerst verzamelt de motor zonder AI de feiten van het account (klasse, contracteinddatum, laatste bestelling, laatste contact, laatste bezoek, branche, segment, MRR, actuele aanleiding). Daarna oordeelt het model in een vast schema of het relevant is, met zekerheid, commerciële hoek en bewijs. Elk bewijscitaat wordt gecontroleerd tegen het aangeleverde materiaal. Onder zekerheid 60 komt er wel een inzicht maar geen taakvoorstel. Webregels doen maximaal 3 zoekopdrachten per beoordeling en links die de zoektool niet echt vond worden geschrapt.
- Elke aanroep komt in het kostenlogboek, ook mislukte.

### Automatisch voorbereiden

Met het vinkje "Automatisch voorbereiden" (alleen bij Taak) laat de motor na de run de agent een concept op de nieuwe taak zetten: een belscript, briefing of mailconcept, gekleurd met het Pitstop-accent van de journeyfase. Dit vraagt een pakket met agentconcepten (Plus of Compleet) en is begrensd op 10 taken per run. Goedkeuren blijft mensenwerk.

### Opslaan

Elke veldwijziging past de lokale stand direct aan en stuurt de regel na 600 milliseconden zonder verdere wijziging één keer naar de server; per regel loopt er hooguit één verzoek tegelijk, zodat een traag antwoord nooit een nieuwere stand overschrijft. Bij het verlaten van de pagina wordt wat nog wacht meteen verstuurd. Mislukt het opslaan, dan blijft de wijziging op het scherm staan en toont de kop "Opslaan mislukt, alleen op dit apparaat". Zonder database (de mockmodus) blijft alles in het geheugen van de browser.

### Waar code en scherm uit elkaar lopen

- "Standaardset terugzetten" laadt de 37 demoregels R001 tot en met R037. Die hebben geen enkel triggerpatroon, dus na terugzetten voert de motor niets meer uit. Een nieuwe organisatie in de database krijgt juist een ander starterspakket van 14 regels (SR01 tot en met SR14) die elk patroon één keer laten zien, met accountklassen, journeyfases met Pitstop-accent en vier overgangen.
- De starterregels SR01 tot en met SR14 dragen hun beschrijving in een veld "omschrijving" dat het paneel niet toont; het veld "Omschrijving (taakvoorbeeld)" staat bij die regels leeg. De AI-beoordelaar leest wel eerst "omschrijving".
- De zoektooltip noemt drie velden, het zoekveld doorzoekt er acht.
- Het kostenblok heet "per regel" maar bevat ook aanroepen zonder regel.
- "Back-up" is niet terug te zetten via het scherm.
- De gebeurtenissen "Eerste order", "Contract getekend" en "Contract verlengd" zijn kiesbaar, maar de app meldt ze nergens; regels daarop vuren nooit.

## Gegevens

Een regel wordt per organisatie bewaard in de tabel activity_rules. Drie kolommen (status, motor, activiteit) staan los; de volledige regel staat als JSON in de kolom data. De rijbeveiliging per organisatie zorgt dat een organisatie alleen haar eigen regels ziet.

| Veld | Betekenis | Excelkop |
|---|---|---|
| id | sleutel; R001 tot R037, SR01 tot SR14 of willekeurig | ID |
| categorie, subcategorie | groep en naam van de regel | Categorie, Subcategorie |
| taakvoorbeeld | omschrijving en terugvaltekst van de taak | Omschrijving |
| taakSjabloon | taaktitel met {account} en {offerte} | Taaksjabloon |
| activiteit | inzicht of taak | Activiteit |
| motor | deterministisch of ai | Motor |
| actionType | bellen, bezoek, mailen, geen of leeg | Actiesoort |
| autoVoorbereiden | automatisch voorbereiden ja of nee | Automatisch voorbereiden |
| trigger.patroon | het triggerpatroon | Triggerpatroon |
| trigger.veld | datumveld bij datum-drempel en inactiviteit | Triggerveld |
| trigger.dagen | dagen, marge of werkdagen | Drempel in dagen |
| trigger.minWaarde | ondergrens in centen (BAND) | Minimale waarde |
| trigger.gebeurtenis | gebeurtenis bij het patroon gebeurtenis | Gebeurtenis |
| cadans | een van de 11 frequenties | Cadans |
| journeyStageId | id van de journeyfase | Journey-fase |
| accountfase | lijst van klassecodes, leeg is alle | Accountklasse |
| levensfase | toelichting (Prospect koud tot Alle fases), stuurt niets | Levensfase |
| signalTypes | signaaltypes voor het filter op Inzichten | Signaaltypen |
| bron, specifiekeBron | herkomst van het signaal | Bron, Specifieke bron |
| triggerType | vrije toelichting bij de aanleiding | Trigger-type |
| prioriteit, kpi, eigenaar | weging, doel, uitvoerder | Prioriteit, KPI, Eigenaar |
| verwachteUitkomst | vaste meetlat voor de rapportage | Verwachte uitkomst |
| enabled | aan of uit | Actief |
| createdAt | aanmaakmoment | Aangemaakt op |

Verplicht bij de Excelimport zijn Categorie, Subcategorie, Cadans, Bron en Prioriteit. Een lege ID krijgt een nieuw id; een dubbele ID in hetzelfde bestand wordt geweigerd; onbekende kolommen geven een waarschuwing; triggergegevens zonder patroon worden weggehaald met een waarschuwing; een leeg Actief telt als ja.

Wat de motor schrijft: inzichten in signals (met ruleId, bewijs, zekerheid, eventueel taakvoorstel, accountplan, deal of campagne), taken in tasks (met ruleId, actiesoort, reden, vervaldatum), de runadministratie in rule_runs (regel, soort onderwerp, onderwerp-id, laatste resultaat) en AI-aanroepen in agent_runs. Van andere features komen de accountdatums (bijgewerkt bij het afronden van taken en afspraken), de accountklassen en matrices (Accountritme), de journeyfases (Customer Journey), de BAND-velden van deals en het pakket uit HQ.

## Wat dit betekent voor Dealtrace

- Overnemen: het model van één generieke motor met patroon plus parameters, de cadanspoort per regel en onderwerp, het ontdubbelen van open inzichten en de bewijsplicht. Dat is de kern die Architectuurplan New Business §7.2 al uitbreidt met hercontact-vervolg, geparkeerd-terug en trigger-heractivatie.
- Overnemen: het master-detailscherm met een live taakvoorbeeld en een uitleg per veld. Beheerders begrijpen zo wat een regel doet zonder handboek.
- Anders: lever een starterset die echt draait. De demoset van 37 regels zonder trigger maakt de motor stil; Dealtrace moet bij "Standaardset terugzetten" dezelfde werkende set laden als bij een nieuwe organisatie.
- Anders voor new business: inactiviteit moet ook vuren zonder datum ("nog nooit gesproken"), en de afbakening moet naast klasse en journeyfase ook op nb_status, doelgroep en campagne kunnen. Een binnendienstregel en een buitendienstregel verschillen vooral in actiesoort en uitvoerderrol; maak de rol een keuzelijst in plaats van vrije tekst.
- Anders: vervaldatum van regeltaken niet vast op 7 dagen, maar uit de regel (bijvoorbeeld "binnen 24 uur") en in werkdagen, zoals de offerteopvolging al doet.
- Ontbreekt: een droogloop die vóór het aanzetten toont hoeveel accounts een regel zou raken (de "182-taken-les" uit het handboek), een terugzetknop voor de JSON-back-up, en gebeurtenissen die de app ook echt meldt (eerste order, contract, gekwalificeerd, offerte verstuurd).
- Ontbreekt: een leerlus. De rapportage per regel bestaat, maar afgewezen inzichten sturen de regel niet bij; voor Dealtrace is dat de plek voor laag 6 (verbeteren) uit het architectuurplan.
