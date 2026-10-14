# P08: Mandaten, Bewaker, Planner

| Onderdeel | Waarde |
|---|---|
| Sprint | 5 |
| Features | 11.3 Agents en mandaten (fundament voor alle agents), met de Bewaker en de Planner als eerste twee agents; 11.4 bundel en plafond |
| Hangt af van | P01 (rollen, niveaus, functiecatalogus, audit, instellingen), P02 (pakket per organisatie, platformmaxima), P05 (statusmachine, afkoelperiodes, `magBenaderen`), P06 (motorrun, `landingsmoment`, capaciteit), P07 (taken, hercontactritme, `rondTaakAf`) |
| Bron in het bouwplan | Hoofdstuk 11 (11.1 tot en met 11.4), 3.3 (rij Agentmandaten), 4.3 (rij F14), F14 (agentpagina, "Agents pauzeren", "Vandaag tegengehouden door de Bewaker"), F15 (capaciteit en landing), F23 (AI-verbruik, platformmaxima), 13.3 (flow 5), 15.2, 19, ADR-005, ADR-007, Bijlage A (gat 14, 16, 22) |

## Lees eerst

- `Bouwplan-Dealtrace.md`: 1 (drie harde principes), 2.1, 3.3, 4.2 en 4.3, 7.2, hoofdstuk 11 volledig, F14 (Agentpagina en Regels), F15 (Regels van de motor), F16 (afkoelperiodes en frequentieplafond), F23 (AI-verbruik, AI-koppeling), 10.2 (`agent_runs`, `tasks.executor`, `tasks.executor_status`), 13.3, 15.2, 19, ADR-005 en ADR-007, Bijlage A, Bijlage B (rij AI).
- DealDrive op commit 75bee61 (alleen lezen): `server/utils/llm-provider.ts`, `server/utils/agentExecutor.ts` (`executorStatus` en `bereidTaakVoor`), `server/utils/aiVerbruik.ts` (`leesVerbruik`, `plafondStand`), `shared/aiBundel.ts` (`BUNDEL_SOORTEN`, `LET_OP_VANAF`, `OVER_VANAF`, `standVoor`), `server/utils/promptBibliotheek.ts`, `server/utils/promptStandaarden.ts`, `shared/promptSlots.ts`, `server/utils/aiInsight.ts`, `server/utils/autoVoorbereiding.ts`, `server/utils/ruleEngine.ts` (`logAgentRun`), `server/utils/belblokVuller.ts`, `server/utils/dexPlafond.ts`, `server/utils/dexKaart.ts` (de zes `executorStatus`-waarden in `PITSTOP_STATUS`).

## Deel 1: Functioneel (wat en waarom)

### Wat je bouwt

Je bouwt het mandaatmodel in vier niveaus, de Bewaker die elke agenthandeling vooraf toetst, de Planner die pogingen plant en taken laat landen binnen de capaciteit, en het AI-plafond per bundelsoort dat vóór elke aanroep blokkeert.

### Waarom

Een van de drie harde principes van Dealtrace is: AI handelt nooit buiten zijn mandaat en verstuurt nooit een eerste bericht zonder goedkeuring (1). Elke latere agent (Zoeker, Verrijker, Waarnemer, Schrijver, Verzender) loopt door dezelfde poort, dus die poort moet er eerst zijn. In DealDrive stond het AI-plafond standaard uit, gold het alleen op de motor en kwam er geen melding bij 80 procent (Bijlage A, gat 14), en had `executorStatus` vier waarden die nergens werden gezet (gat 22).

### Gebruikers en niveaus

| Rol | Niveau | Wat |
|---|---|---|
| Accountmanager | Beginner | Ziet resultaten van agents met de mandaatletter (alleen in de flyout bij Expert zichtbaar als code, 4.5). Schrijver: elk concept per stuk goedkeuren; Verzender uit (elke mail als concept, C) |
| Accountmanager | Gevorderd | Agentpagina alleen lezen; Verzender B binnen een door de salesmanager goedgekeurde campagne |
| Accountmanager | Expert | Verzender B met eigen dagplafond tot het organisatiemaximum; ziet "Waarom niet?" (handelingen die de Bewaker tegenhield) bij inzichten; eigen mandaat binnen het organisatiemaximum |
| Salesmanager | Gevorderd of Expert | Agentmandaten lezen (3.3); keurt campagnes goed die mandaat B mogelijk maken; verbruik van het team lezen |
| Beheerder | Expert | Mandaten per agent zetten binnen de platformmaxima; "Agents pauzeren"; ziet "Vandaag tegengehouden door de Bewaker" |
| Founder | n.v.t. | Zet de platformmaxima en de bundel per pakket (F23); ziet AI-kosten in euro's per model en soort |

### Mandaat per agent en per gebruikersniveau

Mandaatniveaus: **A** autonoom (doet het zelf, logt het, de mens ziet het achteraf), **B** autonoom binnen een goedgekeurd kader, **C** per stuk goedkeuren, **D** altijd mens. Harde grenzen: D blijft D; nooit zonder consent of in een afkoelperiode; nooit buiten het ritme; nooit een template, regel of verhaal wijzigen; alles herleidbaar; stopknop "Agents pauzeren".

| Agent | Organisatiemaximum | Beginner | Gevorderd | Expert |
|---|---|---|---|---|
| Zoeker, Verrijker, Waarnemer, Profielbouwer, Planner, Notulist, Coach, Gids | A | A | A | A |
| Schrijver | A voor concepten | A (concept); elk concept per stuk goedkeuren | A | A |
| Verzender | B voor vervolgmails, C voor de eerste mail en elke mail aan een beslisser | uit; elke mail als concept (C) | B binnen een door de salesmanager goedgekeurde campagne | B met eigen dagplafond tot het organisatiemaximum |
| Berichtgever, LinkedIn-assistent | C (LinkedIn-assistent C en D) | C | C | C |
| Bewaker | A, kan alleen blokkeren en melden | altijd aan | altijd aan | altijd aan |

### Schermen

**Agents en mandaten** (`/instellingen/agents`; beheerder, alleen lezen voor Gevorderd en hoger). De volledige pagina met Waarnemer-instellingen hoort bij F14 (P19). Niet vastgelegd in het bouwplan; voorstel voor de knip: P08 bouwt de onderdelen die over mandaten en de Bewaker gaan, P19 voegt het instellen van de Waarnemer en de bronnen toe. Van boven naar beneden:

1. Kop met kruimelpad "Instellingen · Data en AI", titel "Agents en mandaten". Rechts de gevaarknop **"Agents pauzeren"** (rood, met bevestiging).
2. Kaart **"Mandaten in vier niveaus"**: A autonoom, B binnen een goedgekeurd kader, C per stuk goedkeuren, D altijd mens, met de harde grenzen eronder. Mandaatpillen volgens 14: A zwart met geel, B geel met inkt, C wit met inktrand, D gestippeld.
3. **Tabel van agents**: agent, mandaat (keuze tot het platformmaximum), dagplafond, vandaag gedaan, aan of uit. Een agent waarvan de feature nog niet gebouwd is, staat er met "Komt later" (Niet vastgelegd in het bouwplan; voorstel).
4. Kaart **"Vandaag tegengehouden door de Bewaker"** met per regel de reden ("Geen consent voor WhatsApp", "Afkoelperiode mail tot 3 december", "Dagplafond bereikt").
5. Kaart **AI-verbruik deze maand** per bundelsoort: handelingen tegen de bundel, met "let op" vanaf 80 procent en "op" bij 100 procent; de beheerder ziet alleen handelingen, geen euro's (F23).

Bevestiging bij "Agents pauzeren": titel als vraag ("Alle agents pauzeren?"), in de tekst het gevolg ("Alle B-handelingen stoppen direct. Lopende ritmes gaan als taak naar de mens."), knop "Pauzeren" in rood. Daarna een gele strook bovenaan de pagina "Agents staan op pauze sinds 2026-10-14 10:12" met "Hervat". Niet vastgelegd in het bouwplan; voorstel voor de teksten van de strook en "Hervat".

Lege staat van "Vandaag tegengehouden": Niet vastgelegd in het bouwplan; voorstel: "De Bewaker heeft vandaag niets tegengehouden."

**Bundelmeldingen.** Bij 80 procent een melding aan de beheerder (F24, soort "bundel op 80 procent"); bij 100 procent blokkeert de server de aanroep en ziet de gebruiker de melding in de vorm van F23: "Je maandbundel voor dossiers is op." Per soort de eigen naam ("Je maandbundel voor belscript-invullingen is op.").

**Op een record.** Elke handeling van een agent op een taak of inzicht toont wie het deed met mandaatletter (F14). Een taak die de Bewaker naar de mens zette, toont in de aanleiding de reden ("Tegengehouden door de Bewaker: afkoelperiode mail tot 3 december").

**Telefoon (390 px).** Instellingen staan bewust niet op de telefoon (8.12): `/instellingen/agents` opent met "Beter op een groot scherm" in één kolom. De bundelmelding en de reden van de Bewaker op een taak zijn op de telefoon volledig leesbaar.

### Klikpaden

1. **Mandaat verlagen.** De beheerder kiest bij de Schrijver mandaat C in plaats van A; opslaan na 600 ms; auditregel; vanaf nu wacht elk concept op goedkeuring per stuk.
2. **Mandaat boven het platformmaximum.** De keuzelijst toont alleen niveaus tot het platformmaximum; een directe API-aanroep met een hoger niveau geeft 422.
3. **Agents pauzeren.** Klik de rode knop, bevestig; de Verzender stopt direct, de volgende mails komen als taak bij de mens; toast "Agents gepauzeerd."
4. **Bewaker houdt tegen.** De Planner wil een belpoging plannen voor een account in afkoeling; de Bewaker weigert met reden; de handeling verschijnt in "Vandaag tegengehouden" en in `agent_runs`; er komt geen taak.
5. **Bundel op.** Een gebruiker vraagt een belscript-invulling als de bundel op 100 procent staat; de server weigert vóór de aanroep met de melding en het script valt terug op vaste teksten (F08).
6. **Planner landt een taak.** De motor maakt een beltaak voor de binnendienst; de Planner zet de vervaldatum op het eerstvolgende passende belblok of, zonder belblok, op het volgende werkmoment; boven het dagplafond van 40 schuift hij naar de volgende werkdag met een melding.

### Regels

- **Hoe een agent werkt** (11.3): 1. voorstel (uit een regel, ritme, trigger of job), 2. Bewaker `magHandelen(agent, handeling, account, contact, nu)`, 3. uitvoering: A en B direct met een rij in `activiteiten` en `agent_runs`, C als taak met concept, D als taak met voorbereiding.
- **De Bewaker toetst** mandaat, consent, afkoeling, ritme, capaciteit, bundel en werkuren. Hij kan alleen blokkeren en melden; hij voert zelf nooit iets uit. Elke blokkade wordt gelogd met reden.
- **Mandaat effectief** = het laagste van platformmaximum, organisatiemaximum, gebruikersniveau en eventueel eigen mandaat (Expert). D blijft D; een gepauzeerde organisatie zet alles van B naar de mens.
- **Werkuren**: Niet vastgelegd in het bouwplan; voorstel: de werkdag uit 8.13 (08:00 tot 18:00) en de werkdagen met feestdagen uit `shared/datum.ts`; buiten werkuren schuift een B-handeling naar het volgende werkmoment.
- **Planner** (mandaat A): plant pogingen volgens het ritme, vult belblokken, landt taken op regiodagen, bewaakt capaciteit. Capaciteit per uitvoerder: binnendienst 40 beltaken per dag, buitendienst 6 bezoeken per regiodag; wat erboven valt schuift naar de volgende werkdag en wordt gemeld (F15). Landing: binnendienst het eerstvolgende passende belblok, buitendienst de regiodag van het account. Belblokken (P10) en regiodagen (P14) bestaan nog niet; tot dan landt de Planner op `volgendWerkmoment`.
- **Plafond per soort**: bundel per organisatie per maand; blokkade vóór de aanroep; melding bij 80 procent; standaard aan, op alle soorten (11.2, gat 14).
- **Bundel per pakket** (11.4), in handelingen per maand, Starter / Plus / Compleet: zoekronde 0 / 0 / 120; dossier 0 / 0 / 240; inzicht-beoordeling 0 / 8.000 / 8.000; webonderzoek 0 / 0 / 3.000; concept 0 / 1.500 / 1.500; belscript-invulling 0 / 3.000 / 3.000; Notulist 0 / 300 / 300; brief en committee 0 / 500 / 500; coach en verbetervoorstel 0 / 50 / 50; helpvraag 200 / 1.000 / 1.000; Datacollectief-records 0 / 0 / volgens contract; KvK-bevragingen 0 / 500 / 2.000.
- **Meting van overname**: per concept ongewijzigd, aangepast of verworpen; KPI per agent (11.2).
- **Geen privégegevens**: privémail en privémobiel worden gemaskeerd vóór elke aanroep (11.2, 15.2).

### Helpartikelen

- "Agents en mandaten" (collectie Hoe werkt Dealtrace, categorie Inrichten; ook in het leerpad Expert, F21): de vier niveaus, de harde grenzen, mandaat per niveau, de Bewaker, pauzeren.
- "Abonnement en verbruik" (Inrichten): bundel per soort, melding bij 80 procent, wat er bij 100 procent gebeurt. Niet vastgelegd in het bouwplan of dit artikel in P08 of P24 komt; voorstel: P08 schrijft het deel over verbruik, P24 vult abonnement aan.

## Deel 2: Technisch (hoe)

### Datamodel

- `agent_runs` (10.2, F14): Niet vastgelegd in het bouwplan in kolommen; voorstel: `id, organisation_id, agent, handeling, mandaat_niveau ('A'|'B'|'C'|'D'), gebruiker_id?, account_id?, contact_id?, task_id?, uitkomst ('uitgevoerd'|'als_taak'|'geblokkeerd'|'fout'), reden?, bronnen jsonb, kosten jsonb {soort, aantal, cent?}, op`. Bewaartermijn 13 maanden (15.2).
- `tasks.executor` (`'mens'|'ai'` plus de agentnaam in `data.agent`) en `tasks.executor_status`: alleen waarden die gebruikt worden (gat 22). DealDrive kende `wacht`, `bezig`, `concept-klaar`, `goedgekeurd`, `uitgevoerd`, `mislukt`, waarvan alleen `concept-klaar` werd gezet. Niet vastgelegd in het bouwplan; voorstel: `concept-klaar`, `goedgekeurd`, `uitgevoerd`, `tegengehouden`, elk met precies één schrijver in de code, en `tasks.data.mandaat` met de letter per handeling.
- Mandaatinstellingen: Niet vastgelegd in het bouwplan; voorstel: instellingssleutel `agentmandaten` in `org_settings` (`{agent: {mandaat, dagplafond, aan}}`) en `agentenGepauzeerd {sinds, door}`; platformmaxima in een platformtabel die alleen de founder schrijft (F23) en die als `VERBORGEN_KEYS` nooit via de klantinstellingen te schrijven is (F22).
- `users.data.mandaat` voor het eigen mandaat van een Expert (voorstel).
- Bundel: `lead_verbruik` bestaat voor leads (F02); voor AI het verbruik per soort per maand. Niet vastgelegd in het bouwplan in een tabelnaam; voorstel: `ai_verbruik: organisation_id, maand, soort, aantal, kosten_cent`, met `llm_prijzen` (11.4) voor de kosten.
- RLS `org_isolation` op alle nieuwe tabellen; `agent_runs` alleen toevoegen.
- Rechtenmatrix (3.3): agentmandaten accountmanager lezen, salesmanager lezen, beheerder schrijven binnen platformmaxima, founder platformmaxima zetten.
- Sync-allowlist: geen nieuwe mutatie; mandaten en pauzeren alleen via de endpoints.

### Pure functies

| Functie | Invoer | Uitvoer | Randgevallen en unit-tests |
|---|---|---|---|
| `effectiefMandaat(agent, platform, organisatie, niveau, eigen?, gepauzeerd)` | | A, B, C of D | Beginner met Verzender geeft C; gepauzeerd zet B naar C; D blijft D; eigen mandaat boven organisatie wordt afgekapt |
| `magHandelen(agent, handeling, account, contact, nu, context)` | context met mandaat, consent, afkoeling, ritmestand, capaciteit, bundelstand, werkuren | `{mag, uitvoering: 'direct'|'als_taak_concept'|'als_taak_mens'|'geblokkeerd', reden?}` | afkoeling precies op de grens; geen consent voor WhatsApp; account in ander ritme; bundel op 100; zaterdag; dagplafond bereikt |
| `bundelStand(verbruik, bundel)` | | `{stand: 'ok'|'let_op'|'op', percentage}` | 79, 80 en 100 procent; bundel 0 (Starter) geeft direct "op" |
| `landingsmoment(taak, gebruiker, blokken, regiodagen)` | uit P06 | datum en tijd | hier hergebruiken, niet kopiëren |
| `verdeelCapaciteit(taken, plafonds, nu)` | uit P06 | `{geland, geschoven}` | hier hergebruiken |
| `planPoging(stand, ritme, nu)` | ritmestand | taakvoorstel met kanaal en datum | laatste stap; account in afkoeling |
| `maskeerPrive(materiaal)` | tekst en velden | gemaskeerd materiaal | privémobiel, privémail, zakelijk nummer blijft |

Bestanden: `server/utils/agents/bewaker.ts`, `server/utils/agents/planner.ts` met `draai(context)` (11.3), de rekenfuncties in `shared/mandaat.ts` en `shared/aiBundel.ts` (Niet vastgelegd in het bouwplan; voorstel voor `shared/mandaat.ts`).

### Endpoints

| Methode en route | Recht | Invoer | Uitvoer | Fouten |
|---|---|---|---|---|
| `GET /api/agents` | Gevorderd en hoger | | stand per agent, tellers, tegengehouden vandaag | 403 bij Beginner |
| `PUT /api/agents/:agent/mandaat` | beheerder; Expert voor het eigen mandaat | `{mandaat, dagplafond?, aan?}` | agent | 422 boven het maximum of bij Bewaker uit; 403 |
| `POST /api/agents/pauzeer` | beheerder | `{pauze: boolean}` | stand | |
| `GET /api/ai/verbruik` | beheerder (handelingen), salesmanager (team lezen) | maand | per soort aantal en bundel | (Niet vastgelegd in het bouwplan; voorstel voor de route) |
| `GET /api/agents/tegengehouden?datum=` | beheerder; Expert voor eigen accounts | | blokkades met reden | (voorstel) |

De providerlaag (`server/utils/llm-provider.ts`) roept vóór elke aanroep `bundelStand` aan en weigert met 429 en de melding uit F23; de motor roept voor elke agenthandeling `magHandelen` aan. Een endpoint dat de Bewaker omzeilt, bestaat niet: een bouwcheck faalt als een module in `server/utils/agents/` een schrijfactie doet zonder voorafgaande `magHandelen` (Niet vastgelegd in het bouwplan; voorstel, naar het voorbeeld van `check:platform`).

### AI-stappen

Bewaker en Planner gebruiken geen AI. Wel geldt voor elke AI-stap die vanaf nu gebouwd wordt: schema op elk antwoord (tool-use met JSON-schema, `additionalProperties false`, één keer opnieuw, daarna fout zonder opslag), bewijsplicht, bronvermelding, namenfilter, mock met vaste fixtures (11.2). Deze prompt levert de gemeenschappelijke schil: `voerAiStapUit(soort, prompt, schema, materiaal)` in de providerlaag met bundelcheck, maskering, schemavalidatie en logging in `agent_runs` (Niet vastgelegd in het bouwplan; voorstel voor de naam).

### Integraties

Geen nieuwe. De AI-provider loopt via `llm-provider.ts` met mock-provider (13.1).

### Functiecatalogus

Niet vastgelegd in het bouwplan; voorstel:

| Sleutel | Niveau | Pakket | Recht | Helpartikel |
|---|---|---|---|---|
| `agents.lezen` | Gevorderd | Starter | iedereen | Agents en mandaten |
| `agents.eigenMandaat` | Expert | Plus | accountmanager | Agents en mandaten |
| `agents.beheer` | Expert | Starter | beheerder | Agents en mandaten |
| `agents.waaromNiet` | Expert | Plus | iedereen | Agents en mandaten |
| `verbruik.lezen` | Gevorderd | Starter | salesmanager | Abonnement en verbruik |

### Hergebruik uit DealDrive

- `server/utils/llm-provider.ts`: providerlaag met mock; voeg bundelcheck en maskering toe vóór elke aanroep.
- `server/utils/aiVerbruik.ts` en `shared/aiBundel.ts`: verbruik per soort en de standen; zet het plafond standaard aan op alle soorten en voeg de melding bij 80 procent toe (gat 14).
- `server/utils/agentExecutor.ts`: de manier waarop een concept aan een taak hangt; vervang `executorStatus` door de beperkte set waarden (gat 22) en voeg de mandaatletter toe.
- `server/utils/ruleEngine.ts` (`logAgentRun`): basis voor `agent_runs`.
- `server/utils/autoVoorbereiding.ts`: stap "automatisch voorbereiden" in de motorrun, nu achter `magHandelen`.
- `server/utils/dexPlafond.ts`: patroon voor dagplafonds.

### Buiten scope

- De andere agents zelf: Zoeker (P11), Verrijker, Waarnemer, Profielbouwer, Notulist (P19), Schrijver en Verzender (P16, P18), Coach (P21), Gids (P25).
- Belblokvuller (P10) en regiodagen (P14); de Planner gebruikt ze zodra ze bestaan.
- Platformbeheer van bundels, prijzen en platformmaxima in de founderschermen (P24); deze prompt leest de waarden en levert de founder alleen een endpoint achter `requireFounder`. Niet vastgelegd in het bouwplan; voorstel.
- Achterstallige facturen die AI-werk pauzeren (F23, P24).

## Acceptatiecriteria

1. Bijlage A, gat 14: het AI-plafond staat standaard aan op alle bundelsoorten uit 11.4; de server blokkeert vóór de aanroep; bij 80 procent krijgt de beheerder één melding per soort per maand.
2. Bijlage A, gat 22: `tasks.executor_status` kent alleen waarden die de code zet; een test zoekt per waarde de schrijver en faalt bij een waarde zonder schrijver; elke agenthandeling draagt de mandaatletter.
3. Bijlage A, gat 16: mandaatniveaus, bundelsoorten en bundelgetallen staan elk één keer in `shared/`.
4. `magHandelen` weigert in elk van deze gevallen met de juiste reden: geen consent, afkoelperiode, buiten het ritme, capaciteit vol, bundel op, buiten werkuren, mandaat D. Elke weigering staat in `agent_runs` met `uitkomst='geblokkeerd'`.
5. Een Beginner heeft voor de Verzender effectief mandaat C, ook als de organisatie B toestaat; een Gevorderde krijgt B alleen binnen een goedgekeurde campagne; een Expert met een eigen dagplafond kan niet boven het organisatiemaximum.
6. "Agents pauzeren" stopt alle B-handelingen direct; een daarna geplande vervolgmail wordt een taak voor de mens (test met de mock-Verzender).
7. De Planner houdt het dagplafond van 40 beltaken aan: 45 taken voor één gebruiker geven 40 op vandaag en 5 op de volgende werkdag met één melding; een tweede run verandert niets.
8. Mandaat boven het platformmaximum via de API geeft 422; een beheerder kan de platformmaxima niet via `PUT /api/settings` schrijven (wegwerp-Postgres).
9. Privémobiel en privémail staan nooit in het materiaal van een AI-aanroep (test op de opgeslagen promptinvoer van de mock).
10. Elke AI-aanroep zonder geldig schema-antwoord wordt één keer herhaald en daarna als fout gelogd zonder opslag.
11. Een organisatie op Starter krijgt bij een belscript-invulling direct "Je maandbundel voor belscript-invullingen is op." en het script werkt met vaste teksten (11.4, F08).
12. Cross-tenant: `agent_runs` en mandaten van organisatie A zijn onzichtbaar voor B; een founder in "Alleen meekijken" kan geen mandaat wijzigen.
13. Per niveau getest: Beginner ziet `/instellingen/agents` als vergrendelde pagina met uitleg en krijgt 403 op `GET /api/agents`; Gevorderd ziet de pagina alleen lezen; Expert kan zijn eigen mandaat zetten binnen het maximum en ziet "Waarom niet?".
14. Telefoon (375, 390, 412 px): `/instellingen/agents` opent met "Beter op een groot scherm" zonder horizontale scroll; de reden van de Bewaker op een taak is in het schuifvenster leesbaar; knoppen minimaal 44 px.
15. Testdata: Voltvast-startset (Bijlage C). Niet vastgelegd in het bouwplan; voorstel: een fictieve prospect in br-02 met status nee (reden "Geen interesse", afkoeling mail 60 dagen) als vast geval voor de Bewaker.

## Definition of Done

Hoofdstuk 19 geldt volledig. Specifiek voor deze prompt:

- Elke agenthandeling loopt via de Bewaker (19: "elke agenthandeling via de Bewaker"); de bouwcheck op `server/utils/agents/` is groen.
- Databasevrije suite voor `magHandelen`, `effectiefMandaat`, `bundelStand` en de Planner met de mock-provider; wegwerp-Postgres voor RLS, `agent_runs` en de rechten op mandaten.
- Golden master voor de gemeenschappelijke AI-schil (schema, herhaling, maskering).
- Bijlage A, gat 14, 16 en 22 afgevinkt in het sprintverslag; helpartikel "Agents en mandaten" in `content/help/`.
