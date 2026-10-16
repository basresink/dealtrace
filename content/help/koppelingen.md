---
titel: Koppelingen
categorie: Inrichten
collectie: product
samenvatting: KvK, Datacollectief, SalesDNA, DealDrive, WhatsApp Business en je agenda koppelen, testen en ontkoppelen.
routes: /instellingen/koppelingen/salesdna, /instellingen/koppelingen/dealdrive
---

# Koppelingen

De koppelingen staan bij **Leadgenerator**, tabblad **Koppelingen**. Alleen de beheerder richt ze in; een gebruiker vanaf Expert gebruikt ze.

## KvK koppelen

1. Vraag bij KvK een API-sleutel aan voor Zoeken en Basisprofiel.
2. Plak de sleutel in de kaart KvK.
3. Klik **Test verbinding**. Eerst testen, dan opslaan.
4. Zet desgewenst een **maandplafond** lager dan je pakket.
5. Klik **Opslaan**.

De sleutel wordt versleuteld bewaard en is daarna niet meer zichtbaar. Je ziet alleen of hij er is. Is de sleutel verlopen, dan zegt de kaart wat je moet doen: "De KvK-sleutel is verlopen. Vraag een nieuwe aan bij KvK en plak hem hier."

Zonder sleutel is KvK geen kiesbare bron in de Leadgenerator.

## Datacollectief koppelen

Datacollectief zit in Compleet. Op Starter of Plus zie je "Onderdeel van Compleet".

1. Vraag de API-sleutel op bij Datacollectief, uit jullie contract.
2. Plak hem in de kaart Datacollectief en klik **Test verbinding**. Werkt het, dan zie je ook jullie tegoed.
3. Zet desgewenst een **Maandplafond records**.
4. Klik **Opslaan**. Daarna zie je van de sleutel alleen een vingerafdruk van acht tekens.

Werkt de sleutel niet meer, dan staat er "De Datacollectief-sleutel werkt niet meer. Vraag een nieuwe aan bij Datacollectief en plak hem hier." Is het tegoed op, dan is de bron uitgeschakeld tot je het aanvult. Onder **Functies en laatste runs** zie je per aanroep hoeveel records er gelezen zijn.

## SalesDNA koppelen

Met SalesDNA komt jullie verkoopverhaal automatisch binnen. Dealtrace leest alleen versies die in SalesDNA zijn bevestigd. Terug gaan alleen suggesties die je salesmanager vrijgeeft, in kader 2; verder schrijft Dealtrace niets in SalesDNA. Je vindt de koppeling onder **Instellingen, Koppelingen, SalesDNA**. Alleen de beheerder richt hem in.

1. Vul het **adres van SalesDNA** en het **geheim** in. Na opslaan zie je van het geheim alleen een vingerafdruk van acht tekens.
2. Klik **Test verbinding**. Werkt het, dan staat er "Verbinding werkt".
3. Klik **Koppelen**. Dealtrace haalt meteen alle bevestigde onderdelen op. Het logboek toont per onderdeel wat er binnenkwam.

Geef het webhook-adres dat op de pagina staat door aan SalesDNA. Daarna komt elke nieuwe bevestigde versie vanzelf binnen, meestal binnen een minuut.

## Bron per onderdeel

Per onderdeel kies je de bron: **SalesDNA** of **Eigen inrichting**. Een onderdeel dat jullie nog niet zelf hadden ingevuld, neemt SalesDNA vanzelf over. Had je het wel zelf ingevuld, klik dan **Eerst vergelijken**: je ziet jullie versie naast die van SalesDNA en een controlelijst. Daarin staat bijvoorbeeld hoeveel accounts een branche hebben en aan welke branche in SalesDNA die op naam gekoppeld wordt. Klopt het, vink het aan en klik **SalesDNA wordt de bron**. Jullie eigen versie gaat naar het archief.

Een onderdeel uit SalesDNA kun je in Dealtrace niet bewerken. Er staat dan "Wijzigen doe je in SalesDNA" met de plek. De eigen aanvullingen, zoals SBI-codes per branche en ambitiedoelen, blijven wel bewerkbaar.

## Mogelijk verouderd in SalesDNA

Verandert in SalesDNA iets waar een onderdeel op leunt, dan zie je op Richting het label **Mogelijk verouderd in SalesDNA**. Dealtrace werkt gewoon door met de laatst bevestigde versie, tot SalesDNA een nieuwe bevestigt.

## Iets verdwenen of nieuw

Verdwijnt een concurrent of branche uit SalesDNA, dan blijft de verwijzing op accounts staan met "Verwijderd uit SalesDNA". Komt er een nieuwe branche zonder SBI-koppeling, dan krijgt de beheerder een taak om die koppeling te maken.

## Ontkoppelen

Klik **Ontkoppelen** en bevestig. De laatst bevestigde inhoud uit SalesDNA wordt jullie eigen inrichting. Daarna bewerk je hem zelf.

## DealDrive

Na een eerste afspraak met vervolg draag je een account over aan DealDrive. Bij **Instellingen**, **Koppelingen**, **DealDrive** zie je de stand:

- **Uit**: bij overdragen krijg je een overdrachtstaak met de briefing om te mailen of te downloaden. De status van het account wordt wel Overgedragen. Zolang DealDrive de ontvangende kant nog niet heeft, staat de koppeling voor klanten op uit; je ziet dan "Nog niet beschikbaar: DealDrive bouwt de ontvangende kant."
- **Mock**: de testomgeving met vaste antwoorden.
- **Aan**: de echte koppeling. Je ziet "Gekoppeld met DealDrive" met de datum van de laatste overdracht.

De stand, het adres van DealDrive en het gedeelde geheim richt de leverancier in. Jij ziet de stand, klikt **Test verbinding** en ziet de lijst **Mislukte overdrachten** met de reden en **Opnieuw proberen**. Het logboek bewaart geen inhoud, alleen wat er gebeurde en of het lukte.

Een mislukte overdracht betekent: DealDrive nam hem na de laatste poging niet aan. Het account blijft overgedragen; de eigenaar krijgt een taak en jij een melding. Veelvoorkomende redenen staan er in gewone taal bij, zoals "DealDrive herkent de handtekening niet. Controleer of het gedeelde geheim aan beide kanten hetzelfde is."

Bij import en in de Leadgenerator kijkt Dealtrace ook in DealDrive: je ziet de pil **Al klant in DealDrive** of **Prospect in DealDrive** met de eigenaar. Een klant van DealDrive benader je niet, tenzij je salesmanager het toestaat.

## Mail

De beheerder koppelt de mail van de organisatie bij **Instellingen**, **Mail koppelen**: verzendadres, mailserver, poort, gebruikersnaam en wachtwoord. Tik eerst **Test**: Dealtrace controleert of het domein SPF, DKIM en DMARC heeft en of de mailserver de verbinding aanneemt. Pas daarna kun je **Opslaan**. Het wachtwoord wordt versleuteld bewaard en nooit meer getoond. Zonder mailkoppeling verstuur je concepten via je eigen mailapp.

## Je agenda koppelen

Met een gekoppelde agenda van Microsoft 365 of Google telt wat daarin staat mee als bezet: bij vrije momenten voor een afspraak, bij het advies voor een belblok en bij het vullen van je dag. Afspraken die je in Dealtrace plant, komen in je agenda, met een Teams- of Meet-link als de afspraak online is.

1. De beheerder zet de koppeling aan in **Mijn instellingen**, kaart **Gekoppelde agenda**, met **Agendakoppeling aan voor de organisatie**.
2. Daarna koppelt iedereen vanaf Gevorderd zelf: **Mijn instellingen**, **Gekoppelde agenda**, **Koppel Microsoft 365** of **Koppel Google**.
3. Geef toestemming bij Microsoft of Google. Terug in Dealtrace zie je "Agenda gekoppeld."

Met **Ontkoppel** wis je de toegang weer. De toegang wordt versleuteld bewaard, met een eigen sleutel die alleen voor agenda's is. Werkt de koppeling niet meer, dan staat er "ontkoppeld, koppel opnieuw".


## CRM koppelen (HubSpot)

De CRM-koppeling voorkomt dat je een klant of een prospect van een collega opnieuw benadert, en zet wat je in Dealtrace doet terug in je CRM. Deals en offertes maakt het CRM zelf.

1. Ga naar **Instellingen**, **CRM** en klik **Verbind met HubSpot**. Geef toestemming in HubSpot. Terug in Dealtrace zie je "HubSpot is gekoppeld."
2. **Eerst lezen, dan schrijven.** Een nieuwe koppeling leest alleen: bedrijven en contacten komen binnen voor ontdubbelen en het klantprofiel. Klanten uit het CRM worden klant-accounts. Zet een object pas op **Schrijven** of **Beide** als de veldtoewijzing klopt. Vanaf dat moment gaan overgenomen leads, contactpersonen en uitkomsten van pogingen naar het CRM, elk precies één keer.
3. **Veldtoewijzing met voorbeeld.** Per veld zie je welke waarde uit het eerste CRM-record binnenkomt. Een eigen veld koppel je als `cf:sleutel`. Een leeg veld in het CRM wist niets in Dealtrace.
4. **Eigenaarsregel.** De eigenaar in het CRM wordt de gebruiker met hetzelfde e-mailadres. Is het adres onbekend, dan kies je wie het krijgt; de onbekende adressen staan in een lijst.
5. **Overdracht naar dit CRM.** Staat deze schakelaar aan, dan kies je het CRM bij "Overdragen?" na een gehouden eerste afspraak. Dealtrace zet een activiteit met de briefing bij het bedrijf.
6. **Slapende klanten.** Wijs het veld "Laatste order" toe. Een klant die 3, 6 of 12 maanden niet bestelde, krijgt een herwintaak met de terugkomregel.

**Bronprioriteit.** Wat je zelf invulde, wint altijd. Daarna KvK, Datacollectief, CRM, SalesDNA, web, AI en import. Houdt Dealtrace zijn eigen waarde, dan zie je het verschil in het **synchronisatielog**.

Dealtrace synchroniseert elk uur. Vanaf Expert klik je **Synchroniseer nu**. Werkt de koppeling niet meer, dan staat er in gewone taal wat er mis is en krijgt de beheerder een melding; met **Verbind opnieuw** herstel je hem.

## WhatsApp Business

WhatsApp koppel je onder **Instellingen, Kanalen en consent**: provider kiezen, **Koppel**, **Test verbinding** en daarna sjablonen indienen. Zonder koppeling open je een goedgekeurd WhatsApp-concept in WhatsApp, met de tekst al ingevuld. Lees meer in [Kanalen en consent](/help/kanalen-en-consent).
