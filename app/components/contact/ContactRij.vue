<script setup lang="ts">
// Eén rij in de contactlijst (/contacten/alle), in de opzet van DealDrive en gelijk aan
// AccountRij: avatar met initialen, naam met labels (Bel me niet gevuld vooraan, dan de rol met
// eigen icoon, Vertrokken en Geen mail gestippeld), functie en account (link), de contactgegevens
// (LinkedIn, e-mail, telefoon) en inzichten en laatste activiteit van het account. Bij Bel me niet of
// zonder mailtoestemming is het nummer of adres geen link.
// De naam is de link; de streklink maakt de hele rij klikbaar zonder geneste links.
import { datumActiviteit, initialen, kleurUitNaam, telLink, toonTelefoon } from '~/utils/accountWeergave'

const props = defineProps<{ contact: any; weergave?: 'lijst' | 'compact' | 'kaarten' }>()
const c = computed(() => props.contact)
const geenMail = computed(() => c.value.consent?.email?.status === 'nee')
const vertrokken = computed(() => c.value.status === 'vertrokken')
const linkedin = computed(() => {
  const l = c.value.linkedin as string | null
  return l ? (/^https?:\/\//i.test(l) ? l : `https://${l}`) : null
})
const nummers = computed(() => [c.value.mobiel, c.value.telefoon].filter((n, i, a): n is string => !!n && a.indexOf(n) === i))
</script>

<template>
  <li class="ct-rij" :class="[`ct-rij--${weergave ?? 'lijst'}`, { 'ct-rij--vertrokken': vertrokken }]" :data-contact="c.id" data-test="contact-rij">
    <span class="ct-avatar" :style="{ background: kleurUitNaam(c.naam) }" aria-hidden="true"><img v-if="c.fotoUrl" :src="c.fotoUrl" alt="" class="ct-foto" loading="lazy" data-test="contact-foto"><template v-else>{{ initialen(c.naam) }}</template></span>
    <div class="ct-info">
      <div class="ct-regel1">
        <h3 class="ct-naam"><FunctieLink :to="`/contacten/${c.id}`" class="ct-link">{{ c.naam }}</FunctieLink></h3>
        <Label v-if="c.belMeNiet" soort="urgentie" waarde="bel-me-niet" data-test="bel-me-niet-pil" />
        <Label soort="rol" :waarde="c.rol || 'onbekend'" data-test="rol-pil" />
        <Label v-if="vertrokken" soort="status" waarde="vertrokken" />
        <Label v-if="geenMail" soort="status" waarde="geen-mail" titel="Geen toestemming voor e-mail" />
      </div>
      <div class="ct-regel2">
        <span class="ct-functie">{{ c.functie || 'Functie onbekend' }}</span>
        <span class="ct-sep" aria-hidden="true">·</span>
        <NuxtLink :to="`/accounts/${c.accountId}`" class="ct-account" data-test="contact-account">{{ c.bedrijf }}</NuxtLink>
        <span v-if="c.soort" class="ct-soort">{{ c.soort === 'klant' ? 'Klant' : 'Prospect' }}</span>
      </div>
      <div class="ct-kanalen">
        <template v-if="weergave !== 'compact'">
          <a v-if="linkedin" :href="linkedin" target="_blank" rel="noopener" class="ct-kanaal" :aria-label="`LinkedIn-profiel van ${c.naam}`" title="LinkedIn"><Icoon naam="Linkedin" :grootte="13" /></a>
          <template v-if="c.email">
            <span v-if="geenMail" class="ct-gegeven ct-gegeven--uit" title="Geen toestemming voor e-mail">{{ c.email }}</span>
            <a v-else :href="`mailto:${c.email}`" class="ct-gegeven ct-gegeven--link">{{ c.email }}</a>
          </template>
          <template v-for="n in nummers" :key="n">
            <span v-if="c.belMeNiet" class="ct-gegeven ct-gegeven--uit tnum" title="Bel me niet">{{ toonTelefoon(n) }}</span>
            <a v-else :href="telLink(n)" class="ct-gegeven ct-gegeven--link tnum">{{ toonTelefoon(n) }}</a>
          </template>
          <span v-if="!c.email && !nummers.length" class="ct-gegeven ct-gegeven--leeg">Geen e-mail of telefoon</span>
          <span class="tnum">Inzichten: {{ c.inzichten ?? 0 }}</span>
        </template>
        <span class="tnum">Laatste activiteit: {{ datumActiviteit(c.laatsteActiviteitOp) }}</span>
      </div>
    </div>
  </li>
</template>

<style scoped>
.ct-rij {
  position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 16px;
  min-height: var(--touch-target-comfortable, 48px); padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--wit);
  transition: background var(--transition-fast);
}
.ct-rij:last-child { border-bottom: 0; }
.ct-rij:hover { background: var(--surface); }
.ct-rij--vertrokken .ct-naam, .ct-rij--vertrokken .ct-avatar { opacity: 0.55; }
.ct-foto { width: 100%; height: 100%; object-fit: cover; }
.ct-avatar { overflow: hidden; display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; flex-shrink: 0; color: var(--wit); font-family: var(--font-serif); font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
.ct-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.ct-regel1 { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
.ct-naam { margin: 0; font-family: var(--font-serif); font-size: 17px; font-weight: 700; line-height: 1.3; color: var(--ink); overflow-wrap: anywhere; }
.ct-link { color: inherit; text-decoration: none; }
.ct-link::after { content: ''; position: absolute; inset: 0; }
.ct-link:focus-visible { outline: none; }
.ct-link:focus-visible::after { outline: 2px solid var(--yellow); outline-offset: -2px; }
.ct-regel2 { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; font-size: 13px; color: var(--ink-soft); }
.ct-functie { color: var(--ink); font-weight: 500; }
.ct-sep { color: var(--border-strong); }
.ct-account { position: relative; z-index: 1; color: var(--ink); font-weight: 600; text-decoration: none; border-bottom: 1px solid var(--border-strong); }
.ct-account:hover { border-bottom-color: var(--yellow); }
.ct-soort { font-size: 11px; color: var(--muted); }
.ct-kanalen { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; font-size: 12px; color: var(--muted); }
.ct-kanaal { position: relative; z-index: 1; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1px solid var(--border-strong); border-radius: 2px; background: var(--surface); color: var(--ink); }
.ct-kanaal:hover { background: var(--ink); color: var(--yellow); border-color: var(--ink); }
.ct-gegeven--link { position: relative; z-index: 1; color: var(--muted); text-decoration: none; border-bottom: 1px solid var(--border-strong); overflow-wrap: anywhere; }
.ct-gegeven--link:hover { color: var(--ink); border-bottom-color: var(--yellow); }
.ct-gegeven--uit { text-decoration: line-through; color: var(--muted-light, var(--muted)); }
.ct-gegeven--leeg { font-style: italic; }
a.ct-kanaal:focus-visible, .ct-gegeven--link:focus-visible, .ct-account:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }

/* Compact: dichter opeen, kleinere avatar. */
.ct-rij--compact { padding: 10px 20px; gap: 12px; }
.ct-rij--compact .ct-avatar { width: 40px; height: 40px; font-size: 15px; }
.ct-rij--compact .ct-naam { font-size: 15px; }

/* Kaarten: de rij als kaart in een raster (de lijst zet het raster). */
.ct-rij--kaarten { align-items: start; border: 1px solid var(--border); }
.ct-rij--kaarten:last-child { border-bottom: 1px solid var(--border); }

@media (max-width: 719px) {
  .ct-rij { padding: 14px 16px; gap: 12px; align-items: start; }
  .ct-avatar { width: 44px; height: 44px; font-size: 16px; }
  .ct-kanaal { width: 44px; height: 44px; }
  .ct-gegeven--link, .ct-account { display: inline-flex; align-items: center; min-height: 44px; border-bottom: 0; text-decoration: underline; text-decoration-color: var(--border-strong); }
}
</style>
