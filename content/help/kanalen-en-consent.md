---
titel: Kanalen en consent
categorie: Inrichten
collectie: product
samenvatting: Afkoelperiodes en frequentieplafond per kanaal, de voorwaarden voor mail, WhatsApp-sjablonen met opt-in en de bel-me-niet-lijst.
routes: /instellingen/kanalen
---

# Kanalen en consent

Onder **Instellingen, Data en AI, Kanalen en consent** legt de beheerder vast hoe Dealtrace prospects benadert. De Bewaker houdt zich er bij elke handeling aan; wat hij tegenhoudt, staat met de reden op de kaart "Vandaag tegengehouden door de Bewaker".

## Per kanaal

| Kanaal | Afkoelperiode na een nee |
|---|---|
| Bellen | 90 dagen |
| Mail | 60 dagen |
| LinkedIn | 90 dagen |
| WhatsApp | 180 dagen |
| Bezoek | 180 dagen |
| Kaart | 365 dagen |

Je past de dagen per kanaal aan en zet een kanaal uit; een uitgezet kanaal gebruikt geen enkele agent. Het **frequentieplafond** is standaard één bericht per kanaal per 3 werkdagen buiten het ritme. Feestdagen tellen niet als werkdag.

## Mail

Dealtrace mailt alleen als SPF, DKIM en DMARC van je domein in orde zijn; dat controleert de test bij **Mail koppelen**. Elke eerste mail aan een prospect krijgt een afmeldlink. Wie zich afmeldt, komt gehasht op de onderdrukkingslijst en krijgt ook na een nieuwe import geen mail meer.

## WhatsApp Business

1. Kies de provider en tik **Koppel**. Met **Test verbinding** controleer je de koppeling. Je krijgt één keer een webhookadres met geheim voor de provider; daarmee komen statussen en afmeldingen binnen.
2. Maak een **sjabloon**: een naam in kleine letters (zoals `eerste_contact`), de taal en een tekst van hooguit 60 woorden. `{{1}}` wordt de tekst van het goedgekeurde concept.
3. Tik **Dien in**. Pas als de provider het sjabloon goedkeurt, is het kiesbaar.

Een WhatsApp-bericht gaat alleen naar een contact met toestemming "ja" (met datum en bron, in de contactflyout) en altijd na jouw goedkeuring. Zonder toestemming houdt de Bewaker het tegen met "Geen consent voor WhatsApp". Antwoordt iemand STOP, dan zet Dealtrace de toestemming op nee.

## Bel-me-niet-lijst

Een nummer op de lijst verdwijnt uit elke bellijst; Dealtrace controleert de lijst vóór elke bellijst. Je voegt een nummer toe met een reden, of zet bij een contact **Bel me niet** aan. Verwijderen kan alleen met een reden. Met **Exporteren** download je de lijst.

## Controlevragen

1. Hoe lang geldt een nee standaard voor WhatsApp?
   - [ ] 60 dagen
   - [x] 180 dagen
   - [ ] 365 dagen
2. Wanneer gaat een WhatsApp-bericht via de koppeling?
   - [ ] Zodra de Schrijver het concept maakt
   - [x] Na jouw goedkeuring, met opt-in en een goedgekeurd sjabloon
   - [ ] Altijd, als er een mobiel nummer is
