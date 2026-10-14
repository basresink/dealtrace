// Gedeelde schil van de mock-up: zijbalk, paginakop en hulpfuncties.
// Elke pagina levert { pad, titel, kicker, kop, knoppen, body, breed }.
export const MENU = [
  { groep: 'Start', items: [['vandaag', 'Vandaag', 6], ['taken', 'Taken'], ['inzichten', 'Inzichten', 3]] },
  { groep: 'Prospects', items: [['leadgenerator', 'Leadgenerator'], ['prospects', 'Prospects'], ['jaarplanning', 'Jaarplanning'], ['campagnes', 'Campagnes', 5], ['belblokken', 'Belblokken']] },
  { groep: 'Verkoop', items: [['pipeline', 'Pipeline'], ['offertes', 'Offertes', 2]] },
  { groep: 'Accounts', items: [['klanten', 'Klanten'], ['contacten', 'Contacten']] },
  { groep: 'Richting', items: [['richting', 'Richting'], ['winpunten', 'Winpunten'], ['prospectmix', 'Prospectmix'], ['hercontact', 'Hercontact'], ['meetings', 'Meetings'], ['kanalen', 'Kanalen']] },
  { groep: 'Sturen', items: [['dashboard', 'Dashboard']] },
  { groep: 'Beheer', items: [['instellingen', 'Instellingen'], ['agents', 'Agents']] },
  { groep: 'Mock-up', items: [['testronde', 'Testronde 1'], ['testronde2', 'Testronde 2 · live']] },
]

export const ICOON = {
  zoek: '<svg class="sb-link-icoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  web: '<svg class="kanaal-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
  in: '<svg class="kanaal-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4h4v16H4zM6 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h4v2a4 4 0 0 1 3-1c3 0 4 2 4 5v5h-4v-5c0-1-1-2-2-2s-2 1-2 2v5h-4z"/></svg>',
  pijl: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
}

export function zijbalk(actief) {
  const groepen = MENU.map(g => `
    <div class="sb-groep">
      <div class="sb-groep-kop">${g.groep}</div>
      ${g.items.map(([pad, naam, teller]) => `<a class="sb-link${pad === actief ? ' sb-link--actief' : ''}" href="./${pad}.html"><span class="sb-link-stip"></span><span class="sb-link-tekst">${naam}</span>${teller ? `<span class="sb-link-teller">${teller}</span>` : ''}</a>`).join('')}
    </div>`).join('')
  return `
  <aside class="app-sidebar" aria-label="Hoofdmenu">
    <div class="sb-merk"><a class="sb-merk-link" href="./vandaag.html"><span class="sb-merk-stip"></span><span class="sb-merk-naam">DealDrive</span> <span class="sb-merk-sub">New Business</span></a></div>
    <button class="sb-zoek" type="button" aria-label="Zoeken in New Business (Ctrl K)">${ICOON.zoek}<span>Zoeken</span><span class="sb-kbd">Ctrl K</span></button>
    <nav class="sb-nav">${groepen}</nav>
    <div class="sb-voet"><a class="sb-link" href="./instellingen.html#account"><span class="initialen initialen--klein">SB</span><span class="sb-link-tekst">Sanne de Boer</span></a></div>
  </aside>`
}

export function onderbalk(actief) {
  const items = [['vandaag', 'Vandaag'], ['taken', 'Taken'], ['campagnes', 'Campagnes'], ['prospects', 'Prospects'], ['belblokken', 'Bellen']]
  return `<nav class="onderbalk" aria-label="Menu onderaan">${items.map(([p, n]) => `<a class="onderbalk-link${p === actief ? ' onderbalk-link--actief' : ''}" href="./${p}.html">${n}</a>`).join('')}</nav>`
}

export function pagina({ pad, titel, kicker, kop, sub, knoppen = '', body, actief, breed = false, flyout = '' }) {
  return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titel} · DealDrive New Business</title>
<link rel="stylesheet" href="./stijl.css">
<link rel="stylesheet" href="./mockup.css">
</head>
<body>
<div class="app-shell">
  ${zijbalk(actief ?? pad)}
  <main class="app-shell-main" id="inhoud">
    <section class="section section--laatste">
      <div class="container${breed ? '' : ''}">
        <div class="sec-head">
          <div>
            <div class="kicker">${kicker}</div>
            <h1 class="title">${kop}</h1>
            ${sub ? `<p class="subtitle">${sub}</p>` : ''}
          </div>
          ${knoppen ? `<div class="header-actions">${knoppen}</div>` : ''}
        </div>
      </div>
    </section>
    ${body}
  </main>
  ${onderbalk(actief ?? pad)}
  ${flyout}
</div>
<script src="./mockup.js"></script>
</body>
</html>`
}

export const knop = (tekst, soort = 'secundair', extra = '') => `<button class="dd-actie dd-actie--${soort}" type="button" ${extra}>${tekst}</button>`
export const pil = (tekst, soort = 'grijs') => `<span class="pil ${/^(tempo|hoofdfase)--/.test(soort) ? soort : 'pil--' + soort}">${tekst}</span>`
export const klasse = (k) => `<span class="klasse klasse--${k.toLowerCase()}">Klasse ${k}</span>`
export const hoofdfase = (f, label) => `<span class="pil hoofdfase--${f}">${label}</span>`
export const stat = (label, num, foot = '', mod = '') => `<div class="stat-card${mod ? ' stat-card--' + mod : ''}"><div class="stat-label">${label}</div><div class="stat-num">${num}</div>${foot ? `<div class="stat-foot">${foot}</div>` : ''}</div>`
export const sectie = (inner, mod = '') => `<section class="section${mod ? ' section--' + mod : ''}"><div class="container">${inner}</div></section>`
export const lege = (kicker, titel, tekst, knopTekst) => `<div class="lege-staat"><div class="lege-staat-kicker">${kicker}</div><h2 class="lege-staat-titel">${titel}</h2><p class="lege-staat-tekst">${tekst}</p>${knopTekst ? `<div class="lege-staat-actie">${knop(knopTekst, 'primair')}</div>` : ''}</div>`
export const initialen = (naam, mod = '') => `<span class="initialen${mod ? ' initialen--' + mod : ''}">${naam.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>`
export const voortgang = (pct, kleur = '') => `<div class="voortgang" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="voortgang-vul${kleur ? ' voortgang-vul--' + kleur : ''}" style="width:${pct}%"></div></div>`
