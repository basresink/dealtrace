# P05: Standaard prospectreis, statusmachine en terugkomregels

| Onderdeel | Waarde |
|---|---|
| Sprint | 4 (Reis, motor en ritme) |
| Features | F05 Doelgroepen en prospectreis (standaard), statusmachine uit 7.2, terugkomregels uit F25 |
| Hangt af van | P01 (rechten, niveaus, audit), P03 (accounts, contacten, eigen velden, accountkaart), P04 (import als binnenkomst), P28 (leesmodel met branches, fasen en terugkomregels) |
| Bron in het bouwplan | hoofdstuk 7 (7.1 tot en met 7.4), F05 (standaardreis, doelgroepen, toewijzing, meldpunt, accountkaart), F03 ("Zet nee", "Overdragen"), F13 (afkoelperiode, terugkomregels), F25 (terugkomregels, fasen), ADR-004, ADR-018, Bijlage A (gaten 3, 5, 16, 41), Bijlage C (C.7, C.8, C.9 punt 5) |

## Lees eerst

- Bouwplan-Dealtrace.md: 0.2 (B17), hoofdstuk 7 volledig, F05 volledig (de maatwerkeditor alleen om te weten wat P22 later doet), F03 ("Zet nee", "Overdragen", stuurstrip), F09 (uitkomsten na de eerste afspraak), F17 (alinea "De overdracht na de eerste afspraak"), F13 (Regels en Terugkomregels), F25 (Terugkomregel en hercontactritme, Terugkomen, `terugkomDatum`), 8.5.5, 10.2 (Proces), ADR-004, ADR-013 (alleen ter kennis), ADR-018, Bijlage A (gaten 3, 5, 41), Bijlage C (C.7, C.8, C.9).
- DealDrive (commit 75bee61): `server/utils/journeyEngine.ts` (doorschuiven, audit), `app/composables/useCustomerJourney.ts`, `app/pages/instellingen/customer-journey.vue` (fasekaarten, overgangsrijen, kleurkeuze, accent), `server/utils/faseAccent.ts`, `server/utils/agentExecutor.ts` (Pitstop-accent), `shared/bandKwalificatie.ts`.

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Doelgroepen gekoppeld aan branches, de standaard prospectreis als echte rij per organisatie met tien fases tot en met de eerste afspraak en de overdracht, met een melder per gebeurtenis, het meldpunt voor gebeurtenissen, de statusmachine met nee, afkoelperiode en terugkomregel, en de reis, fase en status op de accountkaart met "Fase corrigeren", "Zet nee", "Pauzeer tot" en "Verplaats naar reis".

### Waarom

De reisfase zegt waar het account staat; de status zegt of het nu bewerkt wordt (7.2). In DealDrive was de starterset een klantjourney, werden vier gebeurtenissen nergens gemeld en was er geen handmatige correctie (gat 5). Nee is een datapunt: een nee krijgt een reden, een afkoelperiode per kanaal en een terugkomregel uit het verkoopverhaal (2.1, ADR-018). De maatwerkeditor is P22; deze prompt levert de standaardreis die zonder inrichting werkt.

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| accountmanager | Beginner | Fasepil, status en dagen in fase op de kaart; uitkomst of nee vastleggen waarmee fase en status meeschuiven; reden kiezen bij een nee; "Kwalificeer" |
| accountmanager | Gevorderd | Plus "Fase corrigeren" met reden; reisgeschiedenis lezen; lijsten filteren op reis en fase; reis bekijken met aantallen per fase; terugkomdatum per account aanpassen met reden; eigen accounts verplaatsen naar een andere reis |
| accountmanager | Expert | Plus de standaardreis lezen op `/reizen` (maatwerk maken is P22) |
| salesmanager | Gevorderd, Expert | Doelgroepen beheren met prioriteit en ambitietoets; accenten van de standaardreis bijstellen; alle accounts verplaatsen |
| beheerder | Expert | Alles, inclusief "Standaard terugzetten" en de afkoelperiodes per kanaal |

### Schermen

**Prospectreizen** (`/reizen`, zijbalk vanaf Expert en voor de salesmanager): kicker "PROSPECTREIZEN", titel "Doelgroepen en reizen". Niet vastgelegd welke kop; voorstel. Twee blokken: "Doelgroepen" (naam, status, prioriteit, branches, aantal accounts, reis) met "+ Doelgroep" (geel, salesmanager) en "Reizen" (in deze prompt alleen de standaardreis, met aantallen per fase). "+ Nieuwe reis" is P22.

**Reis bekijken** (`/reizen/:id`): tabbladen "Fases" (fasekaarten met volgnummer, naam, kleur, omschrijving, hoofdfase, verwacht verblijf, Pitstop-accent in een geel blok; voor de salesmanager is het accent bewerkbaar), "Overgangen" (alleen lezen), "Activiteiten" (startactiviteiten per fase en rol, alleen lezen; uitvoering door de motor in P06), "Stroom" (kolommen per hoofdfase, fases als blokken, overgangen als pijlen met gebeurtenislabel). Knop "Standaard terugzetten" (beheerder) met de tekst wat verloren gaat: "Standaard terugzetten? Fases, accenten, overgangen en startactiviteiten van deze reis gaan terug naar de standaard. Jullie aangepaste accenten gaan verloren." Niet vastgelegd welke tekst; voorstel.

Gevorderd ziet geen zijbalkitem Prospectreizen, maar mag volgens 4.3 "reis per doelgroep bekijken met aantallen per fase". Niet vastgelegd waar; voorstel: een klik op de reisnaam in de stuurstrip van de accountkaart opent `/reizen/:id` alleen lezen, met kicker "Reis" en zonder knoppen.

**Doelgroep** (flyout, salesmanager): naam, omschrijving, branches uit het leesmodel (primair eerst), SBI (uit `vv_branche_mapping`, aan te vullen), klassen of omvang, gebieden (vanaf P14) of postcodes, bron (koud, warm, referral, winback), eigen-veldfilters, uitsluitingen, prioriteit. Vraag "Past deze doelgroep bij onze ambitie?" (ja, deels, nee) met de ambitiezin erbij. Live teller "214 accounts vallen in deze doelgroep, waarvan 37 al in een andere reis". Bij overlap met een andere doelgroep kies je de prioriteit.

**Accountkaart** (uitbreiding van P03)

- Stuurstrip: "Reis" (naam), fasepil in de kleur van de fase, statuspil, "12 dagen in fase" (oranje als het verwachte verblijf overschreden is), en "Terug op 14 januari 2027 · Beslissing uitgesteld · e-mail met nieuwe aanleiding" als er een terugkomregel loopt.
- Klik op de fasepil opent de reisgeschiedenis (flyout): per regel datum, van fase, naar fase, gebeurtenis, door (gebruiker of "motor"), reden.
- Knop "Kwalificeer" (bij status `nieuw` en fase Gevonden of Dossier compleet). Niet vastgelegd waar de knop staat; voorstel: in het blok "Kwalificatie BAND", en de melding gaat ook automatisch bij BAND minimaal 3 van 4.
- "Fase corrigeren" (Gevorderd): fase en reden (verplicht); meldt `handmatig`.
- Blok "Ritme": "Zet nee", "Pauzeer tot", "Verplaats naar reis". De ritmestand ("poging 3 van 5") komt in P07.
- **Zet nee** (flyout, op de telefoon schuifvenster): keuzelijst met de vaste redenen "Geen behoefte", "Tevreden met huidige leverancier", "Geen budget", "Verkeerd moment", "Niet de beslisser", "Niet geschikt", "Anders" (toelichting verplicht bij "Anders"); bij "Tevreden met huidige leverancier" de vraag "Bij wie?" (keuze uit de concurrenten uit P28, wordt "Verloren aan"); terugkomdatum (voorstel volgens reden en terugkomregel); afkoelperiode per kanaal (voorgevuld). Knop "Zet op nee". Bevestiging "Teeuwen Bouw staat op nee tot 13 januari 2027."
- **Pauzeer tot**: datum; status `wachtend` tot die datum. Niet vastgelegd welke velden; voorstel: datum en optionele reden.
- **Verplaats naar reis**: reis en reden (Gevorderd voor eigen accounts, salesmanager voor alle).
- **Geen promoveren** (B17): Dealtrace maakt geen klant van een prospect. De reis eindigt in de fase Overgedragen, alleen te bereiken via de gebeurtenis `overgedragen` na een gehouden eerste afspraak (P17 Funnel van de prospectreis en overdracht). Accounts met status klant komen uit DealDrive of het CRM (kansen langs de route en winback).

**Lijsten** (P03): filters "Status" (Nieuw, In reis, Wachtend, Nee, Gescoord) en "Reis en fase" zijn nu gevuld; sortering "Dagen in fase" werkt.

**Instellingen, Verkoop, Redenen voor nee en terugkomregels** (F22): de vaste redenen (alleen lezen), de afkoelperiode per kanaal (bellen 90, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365 dagen, instelbaar per organisatie), en de mapping van reden voor nee naar terugkomreden (`vv_redenmapping` uit P28).

**Telefoon (390 px).** Op de compacte accountkaart (8.5.5) staan klasse- en fasepil en de status in de reis bovenaan; "Zet nee" en "Fase corrigeren" openen als schuifvenster met de primaire knop rechts onderaan; de reisgeschiedenis als schuifvenster. `/reizen` opent met "Beter op een groot scherm" (8.12, reiseditor).

### Klikpaden

1. Een import (P04) maakt een account: meldpunt `import`, fase Gevonden, status `nieuw`, `fase_sinds` vandaag, reisgeschiedenis "import".
2. De accountmanager klikt "Kwalificeer": gebeurtenis `gekwalificeerd`; fase Gekwalificeerd (vanuit Dossier compleet) en status `in reis`.
3. Hij klikt "Zet nee", kiest "Verkeerd moment"; Dealtrace stelt de terugkomdatum voor uit de terugkomregel die bij die reden hoort, en schuift hem op naar het einde van de afkoelperiode als hij erbinnen valt; "Zet op nee"; status `nee`, bevestiging met datum.
4. Op de terugkomdatum meldt de dagelijkse controle `heropvolging`: fase Gekwalificeerd, status `in reis`, met de aanpak uit de terugkomregel in de reisgeschiedenis. Het hercontactritme dat dan start, is P07.
5. Een Gevorderde ziet een account dat in de verkeerde fase staat, klikt "Fase corrigeren", kiest "Benaderd" en reden "Gesprek was via de beurs, niet gelogd"; gebeurtenis `handmatig`; reisgeschiedenis met reden.
6. Salesmanager maakt doelgroep "Installatiebedrijven woningbouw" met branche br-01, prioriteit 1; de teller toont hoeveel accounts erin vallen; bij de volgende binnenkomst kiest `kiesReis` deze doelgroep.
7. Beheerder klikt op de standaardreis "Standaard terugzetten": na bevestiging staan fases, accenten, overgangen en startactiviteiten van die reis terug; andere reizen blijven ongemoeid.

### Regels

**Statusmachine** (7.2): `nieuw`, `in reis`, `wachtend`, `nee`, `gescoord`, `overgedragen`.

| Status | Komt erin door | Gaat eruit door |
|---|---|---|
| `nieuw` | leadgenerator, import, signaal, referral | `gekwalificeerd` of niet geschikt |
| `in reis` | kwalificatie, terugkomst uit wachtend of nee | laatste poging zonder reactie, nee, afspraak |
| `wachtend` | laatste poging zonder resultaat, "gesproken, later", pauzeren | terugkomdatum, nieuwe aanleiding |
| `nee` | uitkomst "niet geschikt" of "geen interesse", "Zet nee" | terugkomdatum of nieuwe aanleiding |
| `gescoord` | `eerste-afspraak-gepland` (eerste afspraak gepland, nog niet gehouden of nog niet afgerond) | `overgedragen`, nee (`geen-vervolg`), of terug naar `in reis` (`afspraak-niet-verschenen` of geannuleerd) |
| `overgedragen` | `overgedragen` (eerste afspraak gehouden met vervolg en overgedragen) | n.v.t.; komt het account later terug uit DealDrive of het CRM (verloren deal, slapende klant), dan via een terugkomregel als winback-kandidaat |

**Uitkomsten en status** (7.3; de ritmestappen zelf zijn P07): "Gesproken, afspraak" naar `gescoord` via `eerste-afspraak-gepland`; "Gesproken, later" met datum naar `wachtend` tot de datum; "Niet geschikt" naar `nee` met afkoelperiode 365 dagen voor alle kanalen; "Geen interesse" met reden naar `nee` met afkoelperiode per kanaal. Na de eerste afspraak (uitkomsten uit F09, melders in P13): `eerste-afspraak-gehouden` houdt `gescoord` tot de overdracht; `overgedragen` geeft `overgedragen`; `geen-vervolg` geeft `nee` met reden en terugkomregel; `afspraak-niet-verschenen` (of geannuleerd) geeft `in reis` in de fase In gesprek.

**Afkoelperiode**: bellen 90 dagen, mail 60, LinkedIn 90, WhatsApp 180, bezoek 180, kaart 365; instelbaar per organisatie; gecontroleerd vóór elke poging (`magBenaderen`).

**Terugkomregel** (7.3, ADR-018): een nee, een geparkeerd account of een account dat uit DealDrive of het CRM terugkomt (verloren deal, slapende klant) krijgt naast de reden een terugkomregel uit het verkoopverhaal: terugkomdatum, kanaal, rol en aanpak. De afkoelperiode is de ondergrens: een terugkomdatum binnen de afkoelperiode schuift op naar het einde ervan. Op de terugkomdatum start de motor het hercontactritme uit de regel; de binnendienst krijgt telefoon en mail, de buitendienst een bezoek op de eerstvolgende regiodag (taken in P07, regiodag in P14). Niet vastgelegd welke afkoelperiode de ondergrens is als de regel een kanaal noemt; voorstel: de afkoelperiode van het kanaal uit de regel, of bij "Niet geschikt" 365 dagen.

**Standaardreis**: tien fases in vijf hoofdfases, met accent en verwacht verblijf; de reis eindigt bij de eerste afspraak en de overdracht (B17):

| Hoofdfase | Fase | Pitstop-accent | Verwacht verblijf |
|---|---|---|---|
| Vinden | Gevonden | Alleen feiten uit het dossier; geen aannames over behoefte. | 5 dagen |
| Vinden | Dossier compleet | Benoem één concrete aanleiding uit het dossier. | 5 dagen |
| Bewerken | Gekwalificeerd | Kennismaken: één reden voor contact, geen pitch. | 10 dagen |
| Bewerken | Benaderd | Verwijs naar het eerdere contact en stel één vraag. | 21 dagen |
| Bewerken | In gesprek | Onderscheid benoemen en vergelijkingscriteria opvragen. | 21 dagen |
| Verbinden | Afspraak gepland | Bevestigen, voorbereiden: wie zit erbij, wat wil je weten, welk winpunt. | tot de afspraak |
| Verbinden | Afspraak gehouden | Behoefte, beslisser, noodzaak, draagvlak toetsen; vervolg afspreken. | 2 dagen |
| Overgedragen | Overgedragen | Overdracht met briefing; de deal ontstaat in DealDrive of het CRM. | eindfase |
| Verloren | Verloren | Heropvolging over drie maanden, zonder druk. | eindfase |
| Verloren | Geparkeerd | Alleen bij een nieuwe aanleiding. | tot terugkomdatum |

Kleuren per hoofdfase: Vinden zwart, Bewerken geel, Verbinden paars en oranje, Overgedragen groen, Verloren rood en grijs (via tokens).

**Overgangen** van de standaardreis: exact de tabel in F05 (van instap tot heropvolging), met na Afspraak gepland: `eerste-afspraak-gehouden` naar Afspraak gehouden, `afspraak-niet-verschenen` of geannuleerd terug naar In gesprek; na Afspraak gehouden: `overgedragen` naar Overgedragen, `geen-vervolg` naar Verloren. Elke fase is bereikbaar en elke fase heeft een uitweg.

**Startactiviteiten** per fase en rol: exact de tabel in F05 (Gevonden: "Dossier controleren (taak, 2 werkdagen)"; Dossier compleet: kwalificeren met BAND-vragen; Gekwalificeerd: eerste belpoging met het script "Koude acquisitie beslisser" of kans langs de route; Benaderd: opvolgpoging volgens het ritme; Afspraak gepland: briefing maken en afspraak bevestigen (binnendienst) of Pitstop klaarzetten op de dag van het bezoek (buitendienst); Afspraak gehouden: overdracht klaarzetten (binnendienst) of afronden met verslag en overdragen binnen 24 uur (buitendienst); Geparkeerd: terugkomtaak op de terugkomdatum). Ze staan als rijen in `activiteitstemplates`; de motor (P06) voert ze uit bij "fase betreden".

**Toewijzing aan een reis**: bij binnenkomst (overname, import, CRM) kiest `kiesReis` de eerste actieve doelgroep in prioriteitsvolgorde waarin het account past, anders de standaardreis. Een account zit in hoogstens één actieve reis. Een afgeronde reis bewaart fase en historie; heropvolging start een nieuwe inschrijving, geen overschrijving.

**Fasen van het verkoopverhaal**: elke SalesDNA-fase of eigen fase in `vv_fasen` koppelt aan een hoofdfase (`reis_hoofdfase`); de winpunten van die fase verschijnen bij de fases van die hoofdfase. Bijlage C.7 noemt de fasen Signaal, Kennismaking, Behoefte en schouw, Offerte, Klant en uitbouw, maar geen hoofdfase. Niet vastgelegd welke Voltvast-fase bij welke hoofdfase hoort; voorstel: Signaal naar Vinden, Kennismaking naar Bewerken, Behoefte en schouw naar Verbinden, Offerte en Klant en uitbouw naar Overgedragen, als mapping in Instellingen die de beheerder controleert. SalesDNA-fases na de eerste afspraak (soort offerte en klantrelatie) koppelen aan de hoofdfase Overgedragen: hun winpunten staan op `/richting` en in de overdrachtsbriefing, maar Dealtrace bewerkt ze niet (F05, B17).

### Helpartikelen

- "De prospectreis en fases" (Prospects): tien fases tot en met de eerste afspraak en de overdracht, hoofdfases, status naast fase, dagen in fase, fase corrigeren.
- "Nee met reden en afkoelperiode" (Prospects): de zeven redenen, afkoelperiode per kanaal, terugkomdatum.
- "Doelgroepen en reizen" (Inrichten): doelgroep maken, prioriteit, ambitietoets, standaard terugzetten.
- Academie: "Nee is een datapunt" en "Parkeren en terughalen" (Volhouden), elk met "Zo doe je het in Dealtrace".

## Deel 2: Technisch (hoe)

### Datamodel

Migratie `0007_reis_status`. Alles met `organisation_id` en RLS `org_isolation`.

```ts
doelgroepen: id, organisation_id, naam, status ('concept'|'actief'|'gearchiveerd'), prioriteit int, versie int, data jsonb
  data: omschrijving, sbi[], brancheIds[], klassen[], omvang {min, max}, gebiedIds[], postcodes[],
        bron ('koud'|'warm'|'referral'|'winback'), eigenVeldFilters [{sleutel, vergelijking, waarde}],
        uitsluitingen {segmenten[], tags[]}, geschatteOmvang, ambitieToets ('ja'|'deels'|'nee')
reistemplates: id, organisation_id, naam, doelgroep_id (null = standaardreis), versie int,
               status ('concept'|'actief'|'gepauzeerd'|'gearchiveerd'), is_standaard boolean,
               bron {reisId?, versie?}, eigenaar_id, data jsonb
  data: fases [{id, hoofdfase, label, omschrijving, volgorde, kleur, accent, verwachtVerblijfDagen?, instap?, eind?}],
        overgangen [{id, vanFaseId, gebeurtenis, naarFaseId, voorwaarde?, prioriteit}], overschrijvingen {}
activiteitstemplates: id, organisation_id, reistemplate_id, fase_id, versie int, data jsonb
prospectreizen: id, organisation_id, reistemplate_id, template_versie int, account_id, fase_id, nb_status,
                fase_sinds, gestart_op, afgerond_op, data jsonb
reisgeschiedenis: id, organisation_id, account_id, prospectreis_id, versie, van_fase_id, naar_fase_id,
                  gebeurtenis, door, op, reden
```

- `doelgroepen.data.brancheIds[]` staat niet in het datamodel van F05 maar wel in de functionele tekst ("kiest een of meer branches uit het leesmodel"). Niet vastgelegd; voorstel: dit veld.
- `accounts`: `reis_id`, `fase_id`, `nb_status`, `fase_sinds`, `doelgroep_id`, `terug_op`, `terug_regel_id` als kolommen; `data.nee {reden, toelichting?, verlorenAan? (concurrent-id), op, door, afkoeling {bellen, mail, linkedin, whatsapp, bezoek, kaart}}`, `data.wachtendTot`.
- `activity_rules.reis_id` en `activity_rules.fase_id` (null is alle) komen met de motor in P06.
- De standaardreis wordt bij het aanmaken van een organisatie als echte rij gemaakt (`is_standaard true`), via het startsetregister van P02; nooit alleen in code. Voor bestaande organisaties: "Startset aanvullen".
- `org_settings`: `afkoeling` (dagen per kanaal), `nee.redenen` (vast, alleen lezen).
- Versie: accenten bijstellen maakt een nieuwe versie van de standaardreis zonder fasemapping, want de fases blijven gelijk. Niet vastgelegd; voorstel.
- Sync-allowlist: `accounts` (alleen via de mutatiesoorten `account.nee`, `account.pauzeer`; fasewissel nooit rechtstreeks, alleen via het meldpunt). Niet vastgelegd welke mutatiesoorten; voorstel, zodat "Zet nee" offline kan (8.8).

### Pure functies

**`shared/nbStatus.ts`** (de enige plek waar status en fase samen veranderen):

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `volgendeStatus(status, gebeurtenisOfUitkomst, context)` | huidige status, gebeurtenis of uitkomstcode | nieuwe status | elke rij van de tabel; `overgedragen` blijft `overgedragen` (terugkomst alleen via een terugkomregel); `afspraak-niet-verschenen` vanuit `gescoord` geeft `in reis`; onbekende combinatie geeft de huidige status terug |
| `cooldownActief(account, kanaal, nu)` | account met `data.nee` | boolean | precies op de laatste dag; ander kanaal; "Niet geschikt" 365 voor alles |
| `magBenaderen(account, kanaal, nu)` | account, kanaal | `{mag, reden?}` | status `nee` in afkoeling, `wachtend` tot een datum, bel me niet (P03) |

**`shared/reis.ts`**:

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `kiesReis(account, doelgroepen, reizen)` | account | reis-id | past in twee doelgroepen: hoogste prioriteit; past nergens: standaardreis; gearchiveerde doelgroep telt niet |
| `pastInDoelgroep(account, doelgroep)` | account, doelgroep | boolean | SBI, klassen, omvang, postcodes, eigen-veldfilters, uitsluitingen |
| `volgendeFase(template, faseId, gebeurtenis, context)` | template, fase, gebeurtenis | nieuwe fase of null | hoogste prioriteit wint; hoogstens één wissel per gebeurtenis; voorwaarde niet voldaan |
| `valideerReis(template)` | template | `{fouten[], waarschuwingen[], informatie[]}` | de standaardreis heeft geen fouten en geen waarschuwingen |
| `isEersteAfspraak(account, afspraken)` | account, afspraken | boolean | geannuleerde eerste afspraak telt niet; tweede afspraak geeft false (gat 3) |
| `dagenInFase(account, nu)` en `verblijfOverschreden(account, fase, nu)` | account | getal, boolean | eindfase nooit overschreden |

**`shared/verkoopverhaal.ts`** (uit P28): `terugkomDatum(reden, regels, nu, afkoeling)` krijgt hier de afkoelperiode als ondergrens. Test C.9 punt 5: reden "Prijs" via `vv_redenmapping` naar "Prijs te hoog" (hc-03) geeft 182 dagen en kanaal bezoek; de taak op de eerstvolgende regiodag is P14; het terugkomen van een verloren deal uit DealDrive of het CRM is P23 en P20.

Unit-tests per overgang van de standaardreis: elke fase is via een echte gebeurtenis bereikbaar.

### Meldpunt voor gebeurtenissen

`POST /api/reis/gebeurtenis {accountId, gebeurtenis, reden?}` is de enige plek waar fases veranderen. Na elke gebeurtenis in één transactie: `volgendeFase`, `volgendeStatus`, reisgeschiedenis, audit; daarna de gebeurtenisregels en startactiviteiten voor dat account (motor, P06). Idempotent: een gebeurtenis die geen wissel geeft, schrijft alleen een regel in `activiteiten`.

| Gebeurtenis | Melder | Prompt die de melder aansluit |
|---|---|---|
| `lead-overgenomen`, `import` | leadgenerator en import bij aanmaken | P11 en P04 (hier aansluiten) |
| `dossier-compleet` | Verrijker wanneer alle criteria een oordeel hebben | P19 |
| `gekwalificeerd` | knop "Kwalificeer" of BAND minimaal 3 van 4 | P05 |
| `eerste-contact` | eerste afgeronde poging met uitkomst anders dan geen reactie | P07 |
| `gesprek-gevoerd` | uitkomst "Gesproken" (later, afspraak) | P07 |
| `eerste-afspraak-gepland` | alleen de eerste niet-geannuleerde afspraak met een prospect | P13 (regel `isEersteAfspraak` hier) |
| `eerste-afspraak-gehouden` | "Rond af" van de eerste afspraak met een uitkomst (F09) | P13 |
| `afspraak-niet-verschenen` | eerste afspraak op status niet verschenen of geannuleerd | P13 |
| `overgedragen` | overdracht naar DealDrive, het CRM of een collega (F17) | P17 Funnel van de prospectreis en overdracht |
| `geen-vervolg` | uitkomst zonder vervolg na de eerste afspraak, met reden voor nee | P13 |
| `geparkeerd`, `heropvolging` | `hercontact.verwerkUitkomst` en de regels `geparkeerd-terug` of `trigger-heractivatie`; in deze prompt ook de dagelijkse controle op `terug_op` | P05 (terugkomdatum), P06 en P07 |
| `handmatig` | "Fase corrigeren" met verplichte reden | P05 |

Testmelder: een databasevrije test roept elke gebeurtenis aan met een stub van de melder, zodat elke overgang nu al getest is, ook als de echte melder pas later komt.

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET/POST/PUT /api/doelgroepen` | lezen iedereen; schrijven salesmanager, beheerder | doelgroep | doelgroep | 422 zonder naam |
| `GET /api/doelgroepen/:id/telling` | Expert, salesmanager | | `{aantal, inAndereReis}` | |
| `GET /api/reizen`, `GET /api/reizen/:id` | lezen vanaf Gevorderd | | reis met aantallen per fase | 403 Beginner |
| `PUT /api/reizen/:id` | salesmanager (accenten van de standaardreis) | `{fases[{id, accent}]}` | nieuwe versie | 422 bij andere wijzigingen dan accenten op de standaardreis |
| `POST /api/reizen/:id/standaard-terug` | salesmanager, beheerder | `{bevestigd: true}` | reis | 428 zonder bevestiging |
| `POST /api/reis/gebeurtenis` | iedere gebruiker voor eigen handelingen; motor | `{accountId, gebeurtenis, reden?}` | `{fase, status, gewisseld}` | 422 `handmatig` zonder reden; 422 onbekende gebeurtenis |
| `POST /api/accounts/:id/verplaats-reis` | Gevorderd (eigen), salesmanager | `{reisId, reden}` | account | 403 |
| `POST /api/accounts/:id/nee` | schrijven | `{reden, toelichting?, terugOp?, afkoeling?}` | account met `terug_op` | 422 "Anders" zonder toelichting |

Niet vastgelegd in het bouwplan; voorstel: `POST /api/accounts/:id/pauzeer {tot, reden?}`, `GET /api/accounts/:id/reisgeschiedenis`, `PUT /api/accounts/:id/terug-op {datum, reden}` (Gevorderd), en een geplande functie `terugkomControle` (dagelijks 06:00) die `heropvolging` meldt voor accounts met `terug_op` vandaag of eerder.

### AI-stappen

Geen eigen AI-stap. Het Pitstop-accent van de fase is materiaal voor elke voorbereiding (P10, P18). "Stel fases voor" (Expert) hoort bij maatwerk in P22.

### Functiecatalogus

| Sleutel | Startindeling: aan vanaf | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `reis.zien` | Beginner | Starter | iedereen | "De prospectreis en fases" |
| `reis.kwalificeer`, `account.nee` | Beginner | Starter | iedereen | "Nee met reden en afkoelperiode" |
| `reis.faseCorrigeren`, `reis.geschiedenis`, `reis.overzicht`, `account.terugOpAanpassen` | Gevorderd | Starter | iedereen | "De prospectreis en fases" |
| `reis.verplaatsen` | Gevorderd | Starter | eigen accounts; salesmanager alle | "De prospectreis en fases" |
| `doelgroepen.beheren`, `reis.accentBijstellen` | Gevorderd | Starter | salesmanager, beheerder | "Doelgroepen en reizen" |
| `reis.standaardTerug`, `instellingen.afkoeling` | Expert | Starter | beheerder (standaard terug ook salesmanager) | "Doelgroepen en reizen" |

Pakket: het bouwplan legt per functie geen pakket vast; voorstel Starter.

### Hergebruik uit DealDrive

| Bestand | Wat je aanpast |
|---|---|
| `server/utils/journeyEngine.ts` | doorschuiven via het meldpunt; reis als object met versie, hoofdfase, instap bij binnenkomst |
| `useCustomerJourney.ts`, `instellingen/customer-journey.vue` | fasekaarten, kleurkeuze en accent als weergave op `/reizen/:id`; overgangen alleen lezen tot P22 |
| `server/utils/faseAccent.ts`, `agentExecutor.ts` | accent per fase uit `reistemplates.data.fases` |
| `shared/bandKwalificatie.ts` | letterlijk; BAND minimaal 3 van 4 meldt `gekwalificeerd` |
| journey-seed | vervalt; de standaardreis uit F05 is de enige seed (gat 16: twee journey-seeds in DealDrive) |

### Buiten scope

Maatwerkreizen, de editor, publiceren met fasemapping en "Fase verwijderen" (P22); motor en startactiviteiten uitvoeren (P06); hercontactritme en `verwerkUitkomst` met stappen (P07); de terugkomtaak op een regiodag (P14); de melders na de eerste afspraak (P13) en de overdracht (P17 Funnel van de prospectreis en overdracht); vergelijken van versies in Analyse (P21).

## Acceptatiecriteria

1. Een nieuwe organisatie heeft een werkende standaardreis als echte rij; een geïmporteerd account staat direct in Gevonden met status `nieuw`.
2. Elke fase van de standaardreis is via een echte gebeurtenis bereikbaar (test per overgang uit de tabel in F05); `valideerReis` geeft voor de standaardreis geen fouten en geen waarschuwingen.
3. Een account past in twee doelgroepen en komt in de reis van de doelgroep met de hoogste prioriteit; past het nergens, dan in de standaardreis.
4. "Zet nee" met "Anders" zonder toelichting faalt; met een reden staat het account op `nee` met afkoelperiode per kanaal en een terugkomdatum; de bevestiging noemt de datum.
5. Een terugkomdatum die binnen de afkoelperiode valt, schuift op naar het einde ervan (test met mail 60 dagen en een regel van 30 dagen).
6. Op de terugkomdatum meldt de dagelijkse controle `heropvolging` en staat het account in Gekwalificeerd met status `in reis`; een tweede run op dezelfde dag doet niets.
7. Bijlage C.9, punt 5 (deel van deze prompt): `terugkomDatum` met reden "Prijs" geeft via de mapping "Prijs te hoog", 182 dagen en kanaal bezoek.
8. "Niet geschikt" geeft een afkoelperiode van 365 dagen voor alle kanalen; `magBenaderen` weigert elk kanaal tot dan.
9. Bijlage A, gat 3: `isEersteAfspraak` en het meldpunt zorgen dat `eerste-afspraak-gepland` alleen bij de eerste niet-geannuleerde afspraak een wissel geeft; een tweede melding verandert niets.
10. Bijlage A, gat 5: de standaardreis is een prospectreis (geen klantjourney); elke gebeurtenis uit de catalogus heeft een melder (of een gedocumenteerde stub tot de prompt uit de tabel); "Fase corrigeren" met reden meldt `handmatig` en staat in de reisgeschiedenis.
11. Bijlage A, gat 41: "Standaard terugzetten" zet fases, overgangen, accenten en startactiviteiten van die reis samen terug en laat andere reizen ongemoeid.
12. Bijlage A, gat 16: statusovergangen staan alleen in `shared/nbStatus.ts`, reisregels alleen in `shared/reis.ts`; er is één reisseed.
13. Een Beginner ziet geen menu-item Prospectreizen en geen "Fase corrigeren"; een Gevorderde ziet "Fase corrigeren" en de reis alleen lezen; een Expert ziet `/reizen`; een salesmanager kan accenten bijstellen. Getest als Beginner, Gevorderd en Expert, salesmanager en beheerder.
14. "Zet nee" offline op de telefoon gaat via de wachtrij en komt na herstel precies één keer aan, met dezelfde terugkomdatum (8.8, 8.16).
15. Op 390 px: fasepil, statuspil en "Terug op" op de compacte kaart zonder horizontale scroll; "Zet nee" als schuifvenster met tikdoelen van minimaal 44 px; de reden kiezen en bewaren kost hooguit 3 tikken. Niet vastgelegd in 8.7; voorstel als tikdoel.
16. Wegwerp-Postgres: een fasewissel buiten het meldpunt (rechtstreeks `PUT /api/accounts/:id` met `fase_id`) wordt geweigerd.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Een databasevrije suite (`tsx`) laat een account de hele standaardreis doorlopen op echte gebeurtenissen; samen met P06 is de sprint-4-toestand "een overgenomen account doorloopt de reis op echte gebeurtenissen; de motor maakt precies de verwachte taken" te tonen.
- `docs/HOE-HET-WERKT.md` beschrijft reis, fase, status, het meldpunt met de melders per prompt, afkoelperiode en terugkomregel.
- De helpartikelen "De prospectreis en fases" en "Nee met reden en afkoelperiode" staan in `content/help/`.
- Testdata alleen uit Bijlage C (Voltvast: terugkomregels hc-01 tot en met hc-06, fasen uit C.7) en verzonnen accounts in die lijn.
