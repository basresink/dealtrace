// De standaard uit de code per AI-stap: de onderste laag van de promptketen (organisatie, platform, code).
// De stappen zelf gebruiken deze teksten, zodat /instellingen/prompts precies toont wat geldt als er geen
// platform- of eigen laag is. Alleen instructies, nooit sleutels of andere geheime waarden.

export const PROMPT_BELSCRIPT_ACCOUNT = 'Vul de blokken van dit belscript in voor dit account. Elke zin heeft een bron uit het materiaal; geen feiten buiten het materiaal; hooguit 60 woorden per blok.'
export const PROMPT_BELSCRIPT_PROSPECT = 'Vul de AI-blokken van dit belscript voor dit prospect. Gebruik alleen de meegegeven gegevens en verzin niets; ontbreekt iets, laat het blok dan weg. Houd variabelen tussen accolades zoals {contact.voornaam} staan. Hooguit 60 woorden per blok, je-vorm of u-vorm zoals in het blok, geen gedachtestreepjes.'
export const PROMPT_CAMPAGNE_BOODSCHAP = 'Schrijf een eerste bericht: waarom, hoe, vraag. Eén winpunt met één bewijs. Je-vorm, geen gedachtestreepjes. Geef een stijlscore van 0 tot 10.'
export const PROMPT_BUYING_COMMITTEE = 'Stel het buying committee voor: per functie de rol, de bron en je zekerheid van 0 tot 100. Verzin geen namen.'
export const PROMPT_VERBETERVOORSTEL = 'Doe één verbetervoorstel voor deze reisversie: welke fase of overgang moet anders, met de cijfers waarop het rust.'
export const PROMPT_REISVOORSTEL = 'Stel een prospectreis voor deze doelgroep voor: fases met hoofdfase, een instapfase, een eindfase overgedragen en een eindfase verloren, en de overgangen met gebeurtenissen uit de lijst. Geen fases voor offertes of deals. Schrijf geen winpunten.'

/** De Coach: hoogstens drie coachingpunten, voor de manager of (zelf) voor de Expert. */
export function promptCoachpunten(zelf = false): string {
  return `Geef hoogstens drie coachingpunten${zelf ? ' voor deze week, in de je-vorm' : ''}. Elk punt noemt de cijfers waarop het rust en verwijst naar een artikel uit de lijst. Vergelijk niet als er te weinig gesprekken zijn. Geen niveauvoorstel.`
}

/** De Schrijver bij Bereid voor: per soort concept, met het fase-accent en de opdracht van een stap uit een opvolgreeks. */
export function promptSchrijver(o: { type: string; faseAccent?: string | null; instructie?: string | null; onderwerp?: string | null }): string {
  return `Schrijf als Schrijver een ${o.type === 'briefing' ? 'voorbereiding per blok' : o.type} voor een eerste of volgend contact. Volgorde: waarom (de aanleiding), hoe (precies één winpunt met één bewijs), één vraag. Geen "wat" in de eerste alinea. Je-vorm, geen gedachtestreepjes, geen namen van personen. Fase-accent: ${o.faseAccent ?? 'geen'}.${o.instructie ? ` Opdracht voor deze stap van de opvolgreeks: ${o.instructie}` : ''}${o.onderwerp ? ` Onderwerp: ${o.onderwerp}.` : ''}`
}
