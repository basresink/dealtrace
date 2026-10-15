---
titel: Koppelingen
categorie: Inrichten
collectie: product
samenvatting: KvK en SalesDNA koppelen, testen, de bron per onderdeel kiezen en ontkoppelen.
routes: /instellingen/koppelingen/salesdna
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

## SalesDNA koppelen

Met SalesDNA komt jullie verkoopverhaal automatisch binnen. Dealtrace leest alleen versies die in SalesDNA zijn bevestigd en schrijft niets terug. Je vindt de koppeling onder **Instellingen, Koppelingen, SalesDNA**. Alleen de beheerder richt hem in.

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

## Later

Datacollectief en de koppeling met je CRM komen in een volgende versie.
